process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = 'test-secret'
process.env.RATE_LIMIT_MAX = '1000'

const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const app = require('./server')
const { pool } = require('./config/db')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)

test.afterEach(() => {
  pool.query = originalQuery
  pool.connect = originalConnect
})

test.after(async () => {
  await pool.end()
})

const request = (method, path, body, headers = {}) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const req = http.request({
      port: server.address().port,
      method,
      path,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        server.close(() => {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
          })
        })
      })
    })
    req.on('error', (err) => server.close(() => reject(err)))
    if (payload) req.write(payload)
    req.end()
  })
})

test('auth routes are mounted under /api/auth', async () => {
  const res = await request('POST', '/api/auth/login', {})

  assert.equal(res.status, 400)
  assert.equal(res.body.success, false)
  assert.match(res.body.message, /Username and password required/)
})

test('production login fails closed instead of falling back to demo users on database errors', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  })

  assert.equal(res.status, 500)
  assert.equal(res.body.success, false)
  assert.ok(!res.body.data?.token)
})

test('public registration always creates client users', async () => {
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    assert.equal(params[5], 'client')
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

  const res = await request('POST', '/api/auth/register', {
    username: 'mallory',
    email: 'mallory@example.com',
    password: 'password123',
    full_name: 'Mallory',
    role: 'admin',
  })

  assert.equal(res.status, 201)
  assert.equal(res.body.data.user.role, 'client')
})

test('production auth does not trust token role payloads when the database check fails', async () => {
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Forged Admin', email: 'admin@example.com' },
    process.env.JWT_SECRET
  )
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('GET', '/api/users', undefined, {
    Authorization: `Bearer ${token}`,
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
})

test('completing an already-completed booking does not debit the wallet again', async () => {
  const token = jwt.sign(
    { id: 7, username: 'operator', role: 'operator', full_name: 'Operator', email: 'operator@example.com' },
    process.env.JWT_SECRET
  )
  pool.query = async () => ({
    rows: [{
      id: 7,
      username: 'operator',
      email: 'operator@example.com',
      role: 'operator',
      full_name: 'Operator',
      is_active: true,
    }],
  })

  const statements = []
  const client = {
    query: async (sql) => {
      statements.push(sql)
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (/SELECT \* FROM bookings/.test(sql)) {
        return {
          rows: [{
            id: 42,
            status: 'completed',
            operator_id: 7,
            client_id: 3,
            hourly_rate: 1500,
          }],
        }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }
  pool.connect = async () => client

  const res = await request('PUT', '/api/bookings/42/complete', {
    actual_hours: 2,
  }, {
    Authorization: `Bearer ${token}`,
  })

  assert.equal(res.status, 200)
  assert.equal(res.body.data.status, 'completed')
  assert.ok(!statements.some((sql) => /UPDATE de_users/.test(sql)))
  assert.ok(!statements.some((sql) => /INSERT INTO wallet_transactions/.test(sql)))
})
