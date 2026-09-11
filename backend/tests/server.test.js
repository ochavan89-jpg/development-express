process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret'
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

const assert = require('node:assert/strict')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

const request = async (path, options = {}) => {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options)
    const text = await response.text()
    const body = text ? JSON.parse(text) : null

    return { status: response.status, body }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

test('mounts auth routes under /api/auth', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })

  assert.equal(response.status, 400)
  assert.equal(response.body.success, false)
  assert.match(response.body.message, /Username and password required/)
})

test('mounts protected business routes under /api', async () => {
  const response = await request('/api/machines')

  assert.equal(response.status, 401)
  assert.equal(response.body.success, false)
  assert.match(response.body.message, /No token provided/)
})

test('rejects privileged roles on public registration', async () => {
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'new-admin',
      email: 'new-admin@example.com',
      password: 'secret123',
      full_name: 'New Admin',
      role: 'admin',
    }),
  })

  assert.equal(response.status, 400)
  assert.equal(response.body.success, false)
  assert.match(response.body.message, /limited to client accounts/)
})

test('production login fails closed when the database is unavailable', async (t) => {
  const originalEnv = process.env.NODE_ENV
  const originalQuery = pool.query
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }
  t.after(() => {
    process.env.NODE_ENV = originalEnv
    pool.query = originalQuery
  })

  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })

  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
  assert.match(response.body.message, /Authentication service unavailable/)
})

test('production protected routes do not trust token payloads when user lookup fails', async (t) => {
  const originalEnv = process.env.NODE_ENV
  const originalQuery = pool.query
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }
  t.after(() => {
    process.env.NODE_ENV = originalEnv
    pool.query = originalQuery
  })

  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Admin User', email: 'admin@example.com' },
    process.env.JWT_SECRET
  )
  const response = await request('/api/auth/profile', {
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
  assert.match(response.body.message, /Authentication service unavailable/)
})
