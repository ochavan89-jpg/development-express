process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = 'test-secret'
process.env.RATE_LIMIT_MAX = '1000'

const assert = require('node:assert/strict')
const { after, afterEach, before, test } = require('node:test')
const jwt = require('jsonwebtoken')

const { pool } = require('../config/db')
const { createHttpServer } = require('../server')

const originalQuery = pool.query.bind(pool)
let server
let baseUrl

before(async () => {
  server = createHttpServer()
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(() => {
  pool.query = originalQuery
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

const request = (path, options) => fetch(`${baseUrl}${path}`, options)

test('mounts API routers behind /api instead of returning 404', async () => {
  const health = await request('/api/health')
  assert.equal(health.status, 200)

  for (const path of ['/api/machines', '/api/dashboard/admin', '/api/wallet/balance']) {
    const response = await request(path)
    assert.equal(response.status, 401, `${path} should hit auth middleware`)
    const body = await response.json()
    assert.equal(body.message, 'No token provided')
  }
})

test('does not allow production login to fall back to demo credentials when DB is unavailable', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })

  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.success, false)
  assert.equal(body.data, undefined)
})

test('does not trust token payloads in production when user lookup fails', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }
  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET)

  const response = await request('/api/machines', {
    headers: { Authorization: `Bearer ${token}` },
  })

  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.success, false)
})

test('public registration cannot create privileged users', async () => {
  let insertParams
  pool.query = async (sql, params) => {
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

  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'password123',
      full_name: 'Attacker',
      role: 'admin',
    }),
  })

  assert.equal(response.status, 201)
  assert.equal(insertParams[5], 'client')
  const body = await response.json()
  assert.equal(body.data.user.role, 'client')
})
