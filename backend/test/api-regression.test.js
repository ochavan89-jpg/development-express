const assert = require('node:assert/strict')
const http = require('node:http')
const { afterEach, before, after, test } = require('node:test')

process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = 'test-secret'

const app = require('../server')
const { pool } = require('../config/db')

let server
let baseUrl
const originalQuery = pool.query.bind(pool)

before(async () => {
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

afterEach(() => {
  pool.query = originalQuery
})

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  return { response, body }
}

test('mounts API routers under /api instead of returning 404', async () => {
  const { response, body } = await request('/api/auth/profile')

  assert.equal(response.status, 401)
  assert.equal(body.success, false)
  assert.match(body.message, /token/i)
})

test('does not authenticate bundled demo users when production database auth fails', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const { response, body } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })

  assert.notEqual(response.status, 200)
  assert.equal(body.success, false)
})

test('public registration always creates a client role', async () => {
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

  const { response, body } = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: 'evil',
      email: 'evil@example.com',
      password: 'secret123',
      full_name: 'Evil Admin',
      role: 'admin',
    }),
  })

  assert.equal(response.status, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(body.data.user.role, 'client')
})
