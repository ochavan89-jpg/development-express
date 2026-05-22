const test = require('node:test')
const assert = require('node:assert/strict')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
process.env.RATE_LIMIT_MAX = '1000'

const app = require('../server')
const { pool } = require('../config/db')

test.after(async () => {
  await pool.end()
})

const listen = () => new Promise((resolve) => {
  const server = app.listen(0, () => resolve(server))
})

const close = (server) => new Promise((resolve, reject) => {
  server.close((err) => (err ? reject(err) : resolve()))
})

test('critical API routes are mounted under /api', async (t) => {
  const server = await listen()
  t.after(() => close(server))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const health = await fetch(`${baseUrl}/api/health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).success, true)

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(login.status, 400)

  const machines = await fetch(`${baseUrl}/api/machines`)
  assert.equal(machines.status, 401)
})

test('public registration always creates client users', async (t) => {
  const originalQuery = pool.query
  let insertedRole
  pool.query = async (sql, params) => {
    insertedRole = params[5]
    return {
      rows: [{
        id: 10,
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

  const server = await listen()
  t.after(() => close(server))
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  const response = await fetch(`${baseUrl}/api/auth/register`, {
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

  assert.equal(response.status, 201)
  const body = await response.json()
  assert.equal(insertedRole, 'client')
  assert.equal(body.data.user.role, 'client')
})
