const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
process.env.NODE_ENV = 'test'
process.env.RATE_LIMIT_MAX = '1000'

const app = require('../server')
const { pool } = require('../config/db')

function setDbQuery(handler) {
  pool.query = handler
}

function request(path, { method = 'GET', body, token } = {}) {
  const server = http.createServer(app)

  return new Promise((resolve, reject) => {
    server.listen(0, async () => {
      try {
        const port = server.address().port
        const headers = {}
        if (body !== undefined) headers['content-type'] = 'application/json'
        if (token) headers.authorization = `Bearer ${token}`

        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const data = await response.json()
        resolve({ status: response.status, data })
      } catch (err) {
        reject(err)
      } finally {
        server.close()
      }
    })
  })
}

test('mounts the auth router under /api/auth', async () => {
  process.env.NODE_ENV = 'test'
  setDbQuery(async () => {
    throw new Error('database unavailable')
  })

  const response = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(response.status, 200)
  assert.equal(response.data.success, true)
  assert.ok(response.data.data.token)
})

test('does not fall back to demo credentials in production when the database fails', async () => {
  process.env.NODE_ENV = 'production'
  setDbQuery(async () => {
    throw new Error('database unavailable')
  })

  const response = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  })

  assert.notEqual(response.status, 200)
  assert.equal(response.data.success, false)
  assert.equal(response.data.data, undefined)
  process.env.NODE_ENV = 'test'
})

test('forces public registration to create client users', async () => {
  process.env.NODE_ENV = 'test'
  setDbQuery(async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    assert.equal(params[5], 'client')
    return {
      rows: [{
        id: 42,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  })

  const response = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'mallory',
      email: 'mallory@example.com',
      password: 'password123',
      full_name: 'Mallory',
      role: 'admin',
    },
  })

  assert.equal(response.status, 201)
  assert.equal(response.data.success, true)
  assert.equal(response.data.data.user.role, 'client')
})

test('does not debit wallet again when completing an already completed booking', async () => {
  process.env.NODE_ENV = 'test'
  const queries = []
  setDbQuery(async () => ({
    rows: [{
      id: 7,
      username: 'operator',
      email: 'operator@example.com',
      role: 'operator',
      full_name: 'Operator',
      is_active: true,
    }],
  }))
  pool.connect = async () => ({
    query: async (sql) => {
      queries.push(sql)
      if (/SELECT \* FROM bookings/.test(sql)) {
        return {
          rows: [{
            id: 123,
            client_id: 3,
            operator_id: 7,
            status: 'completed',
            hourly_rate: '1500',
          }],
        }
      }
      return { rows: [] }
    },
    release: () => {},
  })
  const token = jwt.sign(
    { id: 7, username: 'operator', role: 'operator', full_name: 'Operator', email: 'operator@example.com' },
    process.env.JWT_SECRET
  )

  const response = await request('/api/bookings/123/complete', {
    method: 'PUT',
    token,
    body: { actual_hours: 5 },
  })

  assert.equal(response.status, 200)
  assert.equal(response.data.message, 'Booking already completed')
  assert.equal(queries.some(sql => /UPDATE de_users/.test(sql)), false)
  assert.equal(queries.some(sql => /INSERT INTO wallet_transactions/.test(sql)), false)
})
