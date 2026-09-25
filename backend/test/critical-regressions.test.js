const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')

process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = 'test-secret'
process.env.BCRYPT_SALT_ROUNDS = '4'
process.env.RATE_LIMIT_MAX = '1000'

const app = require('../server')
const { pool } = require('../config/db')

const request = async (server, path, options = {}) => {
  const base = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(`${base}${path}`, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const body = await response.json()
  return { response, body }
}

test('critical API regressions stay fixed', async (t) => {
  const server = app.listen(0)
  const originalQuery = pool.query

  t.after(async () => {
    pool.query = originalQuery
    await new Promise(resolve => server.close(resolve))
    await pool.end()
  })

  await t.test('auth router is mounted under /api/auth', async () => {
    const { response, body } = await request(server, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    assert.equal(response.status, 400)
    assert.equal(body.success, false)
    assert.match(body.message, /required/i)
  })

  await t.test('production login does not fall back to demo admin credentials on DB failure', async () => {
    pool.query = async () => {
      throw new Error('database unavailable')
    }

    const { response, body } = await request(server, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })

    assert.equal(response.status, 503)
    assert.equal(body.success, false)
    assert.match(body.message, /authentication service unavailable/i)
  })

  await t.test('production auth middleware does not trust token role claims on DB failure', async () => {
    pool.query = async () => {
      throw new Error('database unavailable')
    }
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    const { response, body } = await request(server, '/api/auth/profile', {
      headers: { authorization: `Bearer ${token}` },
    })

    assert.equal(response.status, 503)
    assert.equal(body.success, false)
    assert.match(body.message, /authentication service unavailable/i)
  })

  await t.test('public registration cannot create privileged users', async () => {
    let insertedRole
    pool.query = async (sql, params) => {
      assert.match(sql, /INSERT INTO de_users/i)
      insertedRole = params[5]
      return {
        rows: [{
          id: 10,
          username: params[0],
          email: params[1],
          full_name: params[3],
          role: insertedRole,
        }],
      }
    }

    const { response, body } = await request(server, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'evil-admin',
        email: 'evil@example.com',
        password: 'password123',
        full_name: 'Evil Admin',
        role: 'admin',
      }),
    })

    assert.equal(response.status, 201)
    assert.equal(insertedRole, 'client')
    assert.equal(body.data.user.role, 'client')
  })
})
