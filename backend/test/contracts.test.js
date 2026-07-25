const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

const FALLBACK_SECRET = 'devexpress_fallback_secret'

function tokenFor(user, secret = process.env.JWT_SECRET || FALLBACK_SECRET) {
  return jwt.sign(user, secret, { expiresIn: '1h' })
}

function request(method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      const payload = body ? JSON.stringify(body) : null
      const req = http.request({
        method,
        port,
        path,
        host: '127.0.0.1',
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      }, (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { raw += chunk })
        res.on('end', () => {
          server.close(() => {
            resolve({
              status: res.statusCode,
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

test('API routers are mounted and demo login can reach protected routes in development', async (t) => {
  const originalEnv = process.env.NODE_ENV
  const originalQuery = pool.query
  process.env.NODE_ENV = 'development'
  pool.query = async () => { throw new Error('db unavailable') }
  t.after(() => {
    process.env.NODE_ENV = originalEnv
    pool.query = originalQuery
  })

  const login = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(login.status, 200)
  assert.ok(login.body.data.token)

  const machines = await request('GET', '/api/machines', { token: login.body.data.token })
  assert.equal(machines.status, 200)
  assert.equal(machines.body.success, true)
  assert.ok(Array.isArray(machines.body.data))
})

test('production login fails closed instead of issuing demo admin tokens on DB errors', async (t) => {
  const originalEnv = process.env.NODE_ENV
  const originalQuery = pool.query
  process.env.NODE_ENV = 'production'
  pool.query = async () => { throw new Error('db unavailable') }
  t.after(() => {
    process.env.NODE_ENV = originalEnv
    pool.query = originalQuery
  })

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
})

test('production protected auth fails closed when the user lookup errors', async (t) => {
  const originalEnv = process.env.NODE_ENV
  const originalQuery = pool.query
  process.env.NODE_ENV = 'production'
  pool.query = async () => { throw new Error('db unavailable') }
  t.after(() => {
    process.env.NODE_ENV = originalEnv
    pool.query = originalQuery
  })

  const token = tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'a@example.com' })
  const res = await request('GET', '/api/dashboard/admin', { token })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
})

test('public registration always creates client users', async (t) => {
  const originalQuery = pool.query
  let insertParams
  pool.query = async (_sql, params) => {
    insertParams = params
    return {
      rows: [{
        id: 10,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }
  t.after(() => {
    pool.query = originalQuery
  })

  const res = await request('POST', '/api/auth/register', {
    body: {
      username: 'mallory',
      email: 'mallory@example.com',
      password: 'secret123',
      full_name: 'Mallory',
      role: 'admin',
    },
  })

  assert.equal(res.status, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(res.body.data.user.role, 'client')
})

test('clients cannot cancel another client booking', async (t) => {
  const originalEnv = process.env.NODE_ENV
  const originalQuery = pool.query
  const calls = []
  process.env.NODE_ENV = 'development'
  pool.query = async (sql, params) => {
    calls.push({ sql, params })
    if (sql.startsWith('SELECT id, username')) {
      return { rows: [{ id: 3, username: 'client', role: 'client', full_name: 'Client', email: 'c@example.com', is_active: true }] }
    }
    if (sql.startsWith('SELECT client_id')) {
      return { rows: [{ client_id: 4, status: 'active' }] }
    }
    throw new Error('unexpected query')
  }
  t.after(() => {
    process.env.NODE_ENV = originalEnv
    pool.query = originalQuery
  })

  const token = tokenFor({ id: 3, username: 'client', role: 'client', full_name: 'Client', email: 'c@example.com' })
  const res = await request('PUT', '/api/bookings/99/cancel', { token })

  assert.equal(res.status, 403)
  assert.equal(calls.some(c => c.sql.includes("UPDATE bookings SET status='cancelled'")), false)
})

test('completed bookings cannot be completed again and debit wallets twice', async (t) => {
  const originalEnv = process.env.NODE_ENV
  const originalQuery = pool.query
  const originalConnect = pool.connect
  const clientQueries = []
  process.env.NODE_ENV = 'development'
  pool.query = async (sql) => {
    if (sql.startsWith('SELECT id, username')) {
      return { rows: [{ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'a@example.com', is_active: true }] }
    }
    throw new Error('unexpected pool query')
  }
  pool.connect = async () => ({
    query: async (sql) => {
      clientQueries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.startsWith('SELECT * FROM bookings')) {
        return { rows: [{ id: 7, status: 'completed', hourly_rate: 1500, client_id: 3, operator_id: 2 }] }
      }
      throw new Error('unexpected client query')
    },
    release: () => {},
  })
  t.after(() => {
    process.env.NODE_ENV = originalEnv
    pool.query = originalQuery
    pool.connect = originalConnect
  })

  const token = tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'a@example.com' })
  const res = await request('PUT', '/api/bookings/7/complete', {
    token,
    body: { actual_hours: 5 },
  })

  assert.equal(res.status, 409)
  assert.equal(clientQueries.some(sql => sql.startsWith('UPDATE de_users SET wallet_balance')), false)
})
