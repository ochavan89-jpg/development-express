const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

let server
let baseUrl

test.before(async () => {
  server = await new Promise(resolve => {
    const listening = app.listen(0, () => resolve(listening))
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  await pool.end()
})

const request = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) }
  let body
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(options.body)
  }
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, body })
  const payload = await response.json()
  return { response, payload }
}

test('auth router is mounted under /api/auth', async () => {
  const { response, payload } = await request('/api/auth/login', {
    method: 'POST',
    body: {},
  })

  assert.equal(response.status, 400)
  assert.equal(payload.success, false)
  assert.match(payload.message, /required/i)
})

test('protected API routers reject missing tokens instead of returning 404', async () => {
  const { response, payload } = await request('/api/machines')

  assert.equal(response.status, 401)
  assert.equal(payload.success, false)
})

test('public registration always creates a client role', async () => {
  const originalQuery = pool.query
  let insertParams
  pool.query = async (sql, params) => {
    insertParams = params
    return {
      rows: [{
        id: 101,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  try {
    const { response, payload } = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'attacker',
        email: 'attacker@example.com',
        password: 'secret123',
        full_name: 'Bad Actor',
        role: 'admin',
      },
    })

    assert.equal(response.status, 201)
    assert.equal(insertParams[5], 'client')
    assert.equal(payload.data.user.role, 'client')
  } finally {
    pool.query = originalQuery
  }
})

test('production auth does not trust token payloads when DB verification fails', async () => {
  const originalQuery = pool.query
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
  }
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'test-secret'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  try {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin', full_name: 'Admin User' },
      process.env.JWT_SECRET
    )
    const { response, payload } = await request('/api/auth/profile', {
      headers: { authorization: `Bearer ${token}` },
    })

    assert.equal(response.status, 503)
    assert.equal(payload.success, false)
  } finally {
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnv.NODE_ENV
    if (originalEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalEnv.JWT_SECRET
    pool.query = originalQuery
  }
})

test('booking completion rejects debits that exceed wallet balance', async () => {
  const originalQuery = pool.query
  const originalConnect = pool.connect
  const originalJwtSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = originalJwtSecret || 'test-secret'
  pool.query = async () => ({
    rows: [{
      id: 7,
      username: 'operator',
      email: 'operator@example.com',
      role: 'operator',
      full_name: 'Operator User',
      is_active: true,
    }],
  })

  const queries = []
  const client = {
    query: async (sql) => {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.startsWith('SELECT * FROM bookings')) {
        return {
          rows: [{
            id: 55,
            client_id: 12,
            operator_id: 7,
            status: 'active',
            hourly_rate: 1000,
          }],
        }
      }
      if (sql.startsWith('SELECT wallet_balance')) {
        return { rows: [{ wallet_balance: 500 }] }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }
  pool.connect = async () => client

  try {
    const token = jwt.sign(
      { id: 7, username: 'operator', role: 'operator', full_name: 'Operator User' },
      process.env.JWT_SECRET
    )
    const { response, payload } = await request('/api/bookings/55/complete', {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body: { actual_hours: 2 },
    })

    assert.equal(response.status, 400)
    assert.equal(payload.message, 'Insufficient wallet balance')
    assert.ok(queries.includes('ROLLBACK'))
    assert.ok(!queries.some(sql => sql.startsWith('UPDATE de_users')))
  } finally {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalJwtSecret
    pool.query = originalQuery
    pool.connect = originalConnect
  }
})
