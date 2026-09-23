const assert = require('node:assert/strict')
const test = require('node:test')
const jwt = require('jsonwebtoken')
const request = require('supertest')

process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = 'test-secret'

const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query.bind(pool)

test.afterEach(() => {
  pool.query = originalQuery
})

test('protected API routers are mounted under /api', async () => {
  const res = await request(app).get('/api/machines')

  assert.equal(res.status, 401)
  assert.match(res.body.message, /token/i)
})

test('production login fails closed when the user database is unavailable', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
  assert.match(res.body.message, /unavailable/i)
})

test('production auth middleware does not trust token payloads after a database failure', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Admin User', email: 'admin@example.com' },
    process.env.JWT_SECRET
  )

  const res = await request(app)
    .get('/api/auth/profile')
    .set('Authorization', `Bearer ${token}`)

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
  assert.match(res.body.message, /unavailable/i)
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

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'new-admin',
      email: 'new-admin@example.com',
      password: 'secret123',
      full_name: 'New Admin',
      role: 'admin',
    })

  assert.equal(res.status, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(res.body.data.user.role, 'client')
})
