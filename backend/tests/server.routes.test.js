const assert = require('node:assert/strict')
const { before, after, test } = require('node:test')
const http = require('node:http')
const app = require('../server')
const { pool } = require('../config/db')

let server
let baseUrl

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, () => {
      const { port } = server.address()
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

test('health route is available at deployment and API paths', async () => {
  for (const path of ['/health', '/api/health']) {
    const response = await fetch(`${baseUrl}${path}`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.app, 'Development Express API')
  }
})

test('auth router is mounted under /api/auth', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.message, 'Username and password required')
})

test('public registration cannot choose a privileged role', async () => {
  const originalQuery = pool.query
  let insertedParams

  pool.query = async (sql, params) => {
    insertedParams = params
    return {
      rows: [{
        id: 123,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  try {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'attacker',
        email: 'attacker@example.com',
        password: 'password123',
        full_name: 'Attacker',
        role: 'admin',
      }),
    })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(insertedParams[5], 'client')
    assert.equal(body.data.user.role, 'client')
  } finally {
    pool.query = originalQuery
  }
})

test('protected API routers are mounted and require authentication', async () => {
  for (const path of [
    '/api/machines',
    '/api/bookings',
    '/api/wallet/balance',
    '/api/dashboard/admin',
    '/api/alerts',
    '/api/users',
    '/api/attendance',
  ]) {
    const response = await fetch(`${baseUrl}${path}`)
    const body = await response.json()

    assert.equal(response.status, 401, `${path} should require authentication`)
    assert.equal(body.message, 'No token provided')
  }
})
