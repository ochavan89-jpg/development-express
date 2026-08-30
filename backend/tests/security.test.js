process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret'

const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)

let server
let baseUrl

test.before(() => {
  server = app.listen(0)
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(() => {
  pool.query = originalQuery
  pool.connect = originalConnect
  server.close()
})

test.afterEach(() => {
  process.env.NODE_ENV = 'test'
  pool.query = originalQuery
  pool.connect = originalConnect
})

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await response.json()
  return { status: response.status, json }
}

function makeToken(payload = {}) {
  return jwt.sign(
    {
      id: 1,
      username: 'admin',
      role: 'admin',
      full_name: 'Admin User',
      email: 'admin@example.com',
      ...payload,
    },
    process.env.JWT_SECRET
  )
}

test('auth router is mounted under /api/auth', async () => {
  const res = await request('/api/auth/login', { method: 'POST', body: {} })

  assert.equal(res.status, 400)
  assert.equal(res.json.success, false)
  assert.match(res.json.message, /Username and password required/)
})

test('public registration always creates client users', async () => {
  let insertParams
  pool.query = async (sql, params) => {
    if (sql.includes('INSERT INTO de_users')) {
      insertParams = params
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
    throw new Error(`Unexpected query: ${sql}`)
  }

  const res = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'mallory',
      email: 'mallory@example.com',
      password: 'password123',
      full_name: 'Mallory',
      role: 'admin',
    },
  })

  assert.equal(res.status, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(res.json.data.user.role, 'client')
})

test('production login does not fall back to demo credentials when DB is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 503)
  assert.equal(res.json.success, false)
})

test('production auth rejects token payload fallback when DB user lookup fails', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('/api/auth/profile', {
    token: makeToken({ id: 7, role: 'admin' }),
  })

  assert.equal(res.status, 503)
  assert.equal(res.json.success, false)
})

test('clients cannot cancel bookings owned by other clients', async () => {
  let updateCalled = false
  pool.query = async (sql) => {
    if (sql.includes('SELECT id, username, email, role, full_name, phone, is_active FROM de_users')) {
      return {
        rows: [{
          id: 10,
          username: 'client-a',
          email: 'client-a@example.com',
          role: 'client',
          full_name: 'Client A',
          is_active: true,
        }],
      }
    }
    if (sql.includes('FROM bookings b LEFT JOIN machines m')) {
      return { rows: [{ client_id: 11, owner_id: 20, status: 'active' }] }
    }
    if (sql.includes("UPDATE bookings SET status='cancelled'")) {
      updateCalled = true
      return { rows: [] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  }

  const res = await request('/api/bookings/123/cancel', {
    method: 'PUT',
    token: makeToken({ id: 10, username: 'client-a', role: 'client' }),
  })

  assert.equal(res.status, 403)
  assert.equal(updateCalled, false)
})
