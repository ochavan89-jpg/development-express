const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const app = require('../server')
const { pool } = require('../config/db')

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET
const originalQuery = pool.query.bind(pool)

process.env.JWT_SECRET = 'test-secret'

let server
let baseUrl

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`
      resolve()
    })
  })
})

test.after(async () => {
  pool.query = originalQuery
  process.env.NODE_ENV = ORIGINAL_NODE_ENV
  process.env.JWT_SECRET = ORIGINAL_JWT_SECRET

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

test.afterEach(() => {
  pool.query = originalQuery
  process.env.NODE_ENV = ORIGINAL_NODE_ENV
  process.env.JWT_SECRET = 'test-secret'
})

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const body = await response.json()
  return { response, body }
}

test('auth API is mounted under /api/auth', async () => {
  const { response, body } = await request('/api/auth/profile')

  assert.equal(response.status, 401)
  assert.equal(body.success, false)
  assert.match(body.message, /token/i)
})

test('public registration always creates a client account', async () => {
  let insertParams

  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
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

  const { response, body } = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'password123',
      full_name: 'Privilege Escalation',
      role: 'admin',
    }),
  })

  assert.equal(response.status, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(body.data.user.role, 'client')
})

test('production auth fails closed when database lookup fails', async () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'test-secret'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const token = jwt.sign(
    { id: 999, username: 'ghost-admin', role: 'admin', full_name: 'Ghost Admin' },
    'test-secret'
  )

  const { response, body } = await request('/api/users', {
    headers: { Authorization: `Bearer ${token}` },
  })

  assert.equal(response.status, 503)
  assert.equal(body.success, false)
  assert.match(body.message, /unavailable/i)
})
