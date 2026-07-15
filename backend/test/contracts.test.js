const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

process.env.NODE_ENV = 'test'

const app = require('../server')
const { pool } = require('../config/db')
const { getJwtSecret } = require('../middleware/auth')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)
const originalNodeEnv = process.env.NODE_ENV
const originalJwtSecret = process.env.JWT_SECRET

const adminUser = { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', full_name: 'Admin User', is_active: true }
const clientUser = { id: 7, username: 'client', email: 'client@example.com', role: 'client', full_name: 'Client User', is_active: true }

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email },
    getJwtSecret(),
    { expiresIn: '1h' }
  )
}

async function request(method, path, { body, token } = {}) {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    return { status: response.status, data }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test.afterEach(() => {
  pool.query = originalQuery
  pool.connect = originalConnect
  process.env.NODE_ENV = originalNodeEnv
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalJwtSecret
})

test('auth route is mounted under /api/auth', async () => {
  const res = await request('POST', '/api/auth/login', { body: {} })

  assert.equal(res.status, 400)
  assert.equal(res.data.success, false)
  assert.match(res.data.message, /required/i)
})

test('fallback JWT secret is used consistently for protected routes', async () => {
  delete process.env.JWT_SECRET
  pool.query = async () => ({ rows: [adminUser] })

  const res = await request('GET', '/api/auth/profile', { token: tokenFor(adminUser) })

  assert.equal(res.status, 200)
  assert.equal(res.data.success, true)
  assert.equal(res.data.data.role, 'admin')
})

test('production login fails closed instead of issuing demo admin token on DB error', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 503)
  assert.equal(res.data.success, false)
  assert.equal(res.data.data, undefined)
})

test('public registration cannot request a privileged role', async () => {
  let insertParams
  pool.query = async (sql, params) => {
    if (sql.includes('INSERT INTO de_users')) {
      insertParams = params
      return {
        rows: [{
          id: 44,
          username: params[0],
          email: params[1],
          full_name: params[3],
          role: params[5],
        }],
      }
    }
    throw new Error(`Unexpected query: ${sql}`)
  }

  const res = await request('POST', '/api/auth/register', {
    body: {
      username: 'evil',
      email: 'evil@example.com',
      password: 'secret123',
      full_name: 'Evil Admin',
      role: 'admin',
    },
  })

  assert.equal(res.status, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(res.data.data.user.role, 'client')
})

test('client cannot cancel another client booking', async () => {
  const calls = []
  pool.query = async (sql, params) => {
    calls.push(sql)
    if (sql.includes('FROM de_users')) return { rows: [clientUser] }
    if (sql.includes('SELECT id, client_id, operator_id, status FROM bookings')) {
      return { rows: [{ id: 99, client_id: 8, operator_id: 3, status: 'active' }] }
    }
    if (sql.includes('UPDATE bookings')) throw new Error('must not update another client booking')
    throw new Error(`Unexpected query: ${sql}`)
  }

  const res = await request('PUT', '/api/bookings/99/cancel', { token: tokenFor(clientUser) })

  assert.equal(res.status, 403)
  assert.equal(res.data.success, false)
  assert.equal(calls.some((sql) => sql.includes('UPDATE bookings')), false)
})

test('completed booking cannot be completed again and debited twice', async () => {
  const queries = []
  const client = {
    query: async (sql) => {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('SELECT * FROM bookings')) {
        return { rows: [{ id: 51, client_id: 7, operator_id: 2, status: 'completed', hourly_rate: 1500 }] }
      }
      if (sql.includes('UPDATE de_users')) throw new Error('must not debit wallet twice')
      throw new Error(`Unexpected query: ${sql}`)
    },
    release: () => {},
  }

  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) return { rows: [adminUser] }
    throw new Error(`Unexpected query: ${sql}`)
  }
  pool.connect = async () => client

  const res = await request('PUT', '/api/bookings/51/complete', {
    token: tokenFor(adminUser),
    body: { actual_hours: 2 },
  })

  assert.equal(res.status, 409)
  assert.equal(res.data.success, false)
  assert.equal(queries.some((sql) => sql.includes('UPDATE de_users')), false)
})
