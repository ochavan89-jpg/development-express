const assert = require('node:assert/strict')
const test = require('node:test')
const jwt = require('jsonwebtoken')
const request = require('supertest')

process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = 'test-secret'

const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)

test.afterEach(() => {
  pool.query = originalQuery
  pool.connect = originalConnect
})

const tokenFor = (user) => jwt.sign(user, process.env.JWT_SECRET)

const dbUser = (overrides = {}) => ({
  id: 7,
  username: 'user',
  email: 'user@example.com',
  role: 'client',
  full_name: 'Test User',
  phone: null,
  is_active: true,
  ...overrides,
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

test('alert mutations are scoped to the authenticated user', async () => {
  const user = dbUser({ id: 7, role: 'client' })
  let alertUpdateParams
  pool.query = async (sql, params) => {
    if (sql.includes('FROM de_users')) return { rows: [user] }
    if (sql.startsWith('UPDATE alerts')) {
      alertUpdateParams = params
      return { rowCount: 0 }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request(app)
    .put('/api/alerts/99/read')
    .set('Authorization', `Bearer ${tokenFor(user)}`)

  assert.equal(res.status, 404)
  assert.deepEqual(alertUpdateParams, ['99', 7])
})

test('operators only enumerate bookings assigned to themselves', async () => {
  const user = dbUser({ id: 12, role: 'operator' })
  let bookingQuery
  let bookingParams
  pool.query = async (sql, params) => {
    if (sql.includes('FROM de_users')) return { rows: [user] }
    bookingQuery = sql
    bookingParams = params
    return { rows: [] }
  }

  const res = await request(app)
    .get('/api/bookings')
    .set('Authorization', `Bearer ${tokenFor(user)}`)

  assert.equal(res.status, 200)
  assert.match(bookingQuery, /b\.operator_id=\$1/)
  assert.deepEqual(bookingParams, [12])
})

test('duplicate recharge reference returns the existing transaction without crediting again', async () => {
  const user = dbUser({ id: 1, role: 'admin' })
  const existing = {
    id: 55,
    user_id: 3,
    transaction_type: 'credit',
    amount: '1000.00',
    reference_id: 'pay_123',
  }
  const client = {
    queries: [],
    query: async (sql, params) => {
      client.queries.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FROM wallet_transactions')) return { rows: [existing] }
      throw new Error(`unexpected client query: ${sql}`)
    },
    release: () => {},
  }
  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) return { rows: [user] }
    throw new Error(`unexpected pool query: ${sql}`)
  }
  pool.connect = async () => client

  const res = await request(app)
    .post('/api/wallet/recharge')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ user_id: 3, amount: 1000, reference_id: 'pay_123' })

  assert.equal(res.status, 200)
  assert.equal(res.body.data.id, existing.id)
  assert.equal(res.body.message, 'Recharge already recorded')
  assert.equal(client.queries.some(({ sql }) => sql.includes('UPDATE de_users')), false)
})
