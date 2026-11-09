const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const app = require('../server')
const { pool } = require('../config/db')

const originalEnv = { ...process.env }
const originalQuery = pool.query.bind(pool)

async function request(path, options = {}) {
  const server = app.listen(0)
  await once(server, 'listening')
  const { port } = server.address()
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
    const body = await response.json()
    return { status: response.status, body }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test.afterEach(() => {
  process.env = { ...originalEnv }
  pool.query = originalQuery
})

test('health endpoint stays available', async () => {
  const res = await request('/api/health')
  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
})

test('auth login route is mounted under /api/auth', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.equal(res.status, 400)
  assert.equal(res.body.message, 'Username and password required')
})

test('public registration always creates a client user', async () => {
  process.env.JWT_SECRET = 'test-secret'
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    assert.equal(params[5], 'client')
    return {
      rows: [{
        id: 99,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  const res = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'secret123',
      full_name: 'Attacker',
      role: 'admin',
    }),
  })

  assert.equal(res.status, 201)
  assert.equal(res.body.data.user.role, 'client')
})

test('production login does not fall back to demo users when the database fails', async () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'test-secret'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })

  assert.equal(res.status, 401)
  assert.equal(res.body.message, 'Invalid username or password')
})
