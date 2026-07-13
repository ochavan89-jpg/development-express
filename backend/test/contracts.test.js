process.env.NODE_ENV = 'test'
process.env.PORT = '0'

const assert = require('node:assert/strict')
const http = require('node:http')
const { test, afterEach } = require('node:test')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query.bind(pool)
const JWT_SECRET = 'devexpress_fallback_secret'

function request(method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body === undefined ? undefined : JSON.stringify(body)
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        method,
        path,
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      }, (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          server.close(() => {
            resolve({
              statusCode: res.statusCode,
              body: raw ? JSON.parse(raw) : null,
            })
          })
        })
      })
      req.on('error', (err) => {
        server.close(() => reject(err))
      })
      if (payload) req.write(payload)
      req.end()
    })
  })
}

function tokenFor(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' })
}

afterEach(() => {
  process.env.NODE_ENV = 'test'
  delete process.env.JWT_SECRET
  pool.query = originalQuery
})

test('auth routes are mounted under /api/auth', async () => {
  const res = await request('POST', '/api/auth/login', { body: {} })

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.success, false)
  assert.match(res.body.message, /required/i)
})

test('tokens signed with fallback secret authenticate when JWT_SECRET is unset', async () => {
  pool.query = async () => {
    throw new Error('demo database unavailable')
  }

  const login = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })
  assert.equal(login.statusCode, 200)

  const profile = await request('GET', '/api/auth/profile', {
    token: login.body.data.token,
  })
  assert.equal(profile.statusCode, 200)
  assert.equal(profile.body.data.role, 'admin')
})

test('production login fails closed when the database is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.statusCode, 503)
  assert.match(res.body.message, /temporarily unavailable/i)
})

test('production protected auth fails closed on database lookup errors', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('GET', '/api/auth/profile', {
    token: tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'a@example.com' }),
  })

  assert.equal(res.statusCode, 503)
  assert.match(res.body.message, /temporarily unavailable/i)
})

test('public registration always creates a client role', async () => {
  let roleParam
  pool.query = async (sql, params) => {
    roleParam = params[5]
    return {
      rows: [{
        id: 42,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  const res = await request('POST', '/api/auth/register', {
    body: {
      username: 'mallory',
      email: 'mallory@example.com',
      password: 'password123',
      full_name: 'Mallory',
      role: 'admin',
    },
  })

  assert.equal(res.statusCode, 201)
  assert.equal(roleParam, 'client')
  assert.equal(res.body.data.user.role, 'client')
})

test('clients cannot cancel another client booking by id', async () => {
  const queries = []
  pool.query = async (sql, params) => {
    queries.push({ sql, params })
    if (/SELECT id, username/.test(sql)) {
      return { rows: [{ id: 101, username: 'client', role: 'client', is_active: true }] }
    }
    if (/UPDATE bookings SET status='cancelled'/.test(sql)) {
      assert.match(sql, /client_id=\$2/)
      assert.deepEqual(params, ['7', 101])
      return { rows: [] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request('PUT', '/api/bookings/7/cancel', {
    token: tokenFor({ id: 101, username: 'client', role: 'client' }),
  })

  assert.equal(res.statusCode, 403)
  assert.ok(queries.some(({ sql }) => /client_id=\$2/.test(sql)))
})

test('completed bookings cannot debit the client wallet again', async () => {
  const queries = []
  pool.query = async (sql) => {
    queries.push(sql)
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
    if (/SELECT id, username/.test(sql)) {
      return { rows: [{ id: 1, username: 'admin', role: 'admin', is_active: true }] }
    }
    if (/SELECT \* FROM bookings/.test(sql)) {
      return { rows: [{ id: 9, client_id: 3, operator_id: 4, status: 'completed', hourly_rate: 1500 }] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request('PUT', '/api/bookings/9/complete', {
    token: tokenFor({ id: 1, username: 'admin', role: 'admin' }),
    body: { actual_hours: 2 },
  })

  assert.equal(res.statusCode, 409)
  assert.equal(queries.some((sql) => /UPDATE de_users SET wallet_balance=wallet_balance/.test(sql)), false)
})
