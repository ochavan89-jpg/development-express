process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const assert = require('node:assert/strict')
const { after, afterEach, before, test } = require('node:test')

const app = require('../server')
const { pool } = require('../config/db')

let server
let baseUrl

const originalQuery = pool.query.bind(pool)

before(() => {
  server = app.listen(0)
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
  await pool.end()
})

afterEach(() => {
  pool.query = originalQuery
  process.env.NODE_ENV = 'test'
})

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options)

test('auth routes are mounted under /api/auth', async () => {
  const res = await request('/api/auth/profile')
  assert.equal(res.status, 401)

  const body = await res.json()
  assert.equal(body.message, 'No token provided')
})

test('public registration always creates a client account', async () => {
  let insertedRole

  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
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

  const res = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'secret123',
      full_name: 'Attacker',
      role: 'admin',
    }),
  })

  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(insertedRole, 'client')
  assert.equal(body.data.user.role, 'client')
})

test('production login fails closed when the database is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })

  assert.equal(res.status, 503)
})
