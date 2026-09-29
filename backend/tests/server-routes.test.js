const http = require('http')
const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const app = require('../server')
const { pool } = require('../config/db')

const request = (server, path, options = {}) => {
  const { port } = server.address()
  return fetch(`http://127.0.0.1:${port}${path}`, options)
}

test('core API routers are mounted', async (t) => {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const authResponse = await request(server, '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(authResponse.status, 400)
  assert.equal((await authResponse.json()).message, 'Username and password required')

  const machinesResponse = await request(server, '/api/machines')
  assert.equal(machinesResponse.status, 401)
  assert.equal((await machinesResponse.json()).message, 'No token provided')
})

test('health remains available at deployment health-check paths', async (t) => {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))

  for (const path of ['/health', '/api/health']) {
    const response = await request(server, path)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).success, true)
  }
})

test('public registration cannot assign privileged roles', async (t) => {
  const originalQuery = pool.query
  let insertedRole
  pool.query = async (sql, params) => {
    insertedRole = params[5]
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
  t.after(() => {
    pool.query = originalQuery
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const response = await request(server, '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'password123',
      full_name: 'Privilege Escalation',
      role: 'admin',
    }),
  })

  assert.equal(response.status, 201)
  assert.equal(insertedRole, 'client')
  assert.equal((await response.json()).data.user.role, 'client')
})

test('production auth does not trust token payload when the database check fails', async (t) => {
  const originalQuery = pool.query
  const originalNodeEnv = process.env.NODE_ENV
  const originalJwtSecret = process.env.JWT_SECRET
  const originalDemoFlag = process.env.ALLOW_DEMO_AUTH

  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'test-secret'
  delete process.env.ALLOW_DEMO_AUTH
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  t.after(() => {
    pool.query = originalQuery
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalJwtSecret
    if (originalDemoFlag === undefined) delete process.env.ALLOW_DEMO_AUTH
    else process.env.ALLOW_DEMO_AUTH = originalDemoFlag
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' },
    'test-secret'
  )
  const response = await request(server, '/api/auth/profile', {
    headers: { Authorization: `Bearer ${token}` },
  })

  assert.equal(response.status, 401)
  assert.equal((await response.json()).message, 'Invalid token')
})
