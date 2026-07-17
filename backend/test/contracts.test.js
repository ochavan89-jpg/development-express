const assert = require('node:assert/strict')
const { test, beforeEach, after } = require('node:test')
const jwt = require('jsonwebtoken')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = ''
process.env.JWT_EXPIRE = '1h'

const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)

after(() => {
  pool.query = originalQuery
  pool.connect = originalConnect
})

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = ''
  pool.query = async () => {
    throw new Error('database unavailable')
  }
  pool.connect = originalConnect
})

async function request(method, path, body, headers = {}) {
  const server = app.listen(0)
  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    return { status: response.status, data }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
  }
}

test('auth router is mounted and demo login works outside production when DB is down', async () => {
  const health = await request('GET', '/api/health')
  assert.equal(health.status, 200)

  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })

  assert.equal(login.status, 200)
  assert.equal(login.data.success, true)
  assert.ok(login.data.data.token)
})

test('production login fails closed instead of issuing demo admin tokens on DB errors', async () => {
  process.env.NODE_ENV = 'production'

  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })

  assert.equal(login.status, 503)
  assert.equal(login.data.success, false)
  assert.equal(login.data.data, undefined)
})

test('profile accepts tokens signed with the same fallback secret used by login outside production', async () => {
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Om Chavan', email: 'om.chavan2026@zohomail.in' },
    'devexpress_fallback_secret',
    { expiresIn: '1h' }
  )

  const profile = await request('GET', '/api/auth/profile', null, { authorization: `Bearer ${token}` })

  assert.equal(profile.status, 200)
  assert.equal(profile.data.data.username, 'admin')
})

test('production profile fails closed when user lookup errors instead of trusting token payload', async () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'production-secret'
  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, 'production-secret', { expiresIn: '1h' })

  const profile = await request('GET', '/api/auth/profile', null, { authorization: `Bearer ${token}` })

  assert.equal(profile.status, 503)
  assert.equal(profile.data.success, false)
})

test('public registration always creates client users even when a privileged role is submitted', async () => {
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    assert.equal(params[5], 'client')
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

  const registered = await request('POST', '/api/auth/register', {
    username: 'new-admin',
    email: 'new-admin@example.com',
    password: 'password123',
    full_name: 'New Admin',
    role: 'admin',
  })

  assert.equal(registered.status, 201)
  assert.equal(registered.data.data.user.role, 'client')
})

test('clients cannot cancel another client booking', async () => {
  process.env.JWT_SECRET = 'test-secret'
  const token = jwt.sign({ id: 3, username: 'client', role: 'client' }, 'test-secret', { expiresIn: '1h' })
  let updateAttempted = false

  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) {
      return { rows: [{ id: 3, username: 'client', role: 'client', is_active: true }] }
    }
    if (sql.includes('SELECT client_id,status FROM bookings')) {
      return { rows: [{ client_id: 99, status: 'active' }] }
    }
    if (sql.includes('UPDATE bookings')) {
      updateAttempted = true
    }
    return { rows: [] }
  }

  const response = await request('PUT', '/api/bookings/77/cancel', null, { authorization: `Bearer ${token}` })

  assert.equal(response.status, 403)
  assert.equal(updateAttempted, false)
})

test('completed bookings cannot be completed again and debit the wallet twice', async () => {
  process.env.JWT_SECRET = 'test-secret'
  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, 'test-secret', { expiresIn: '1h' })
  const clientQueries = []

  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) {
      return { rows: [{ id: 1, username: 'admin', role: 'admin', is_active: true }] }
    }
    return { rows: [] }
  }

  pool.connect = async () => ({
    query: async (sql) => {
      clientQueries.push(sql)
      if (sql.includes('SELECT * FROM bookings')) {
        return { rows: [{ id: 12, client_id: 3, operator_id: 4, status: 'completed', hourly_rate: 1000 }] }
      }
      return { rows: [] }
    },
    release: () => {},
  })

  const response = await request('PUT', '/api/bookings/12/complete', { actual_hours: 2 }, { authorization: `Bearer ${token}` })

  assert.equal(response.status, 409)
  assert.equal(clientQueries.some((sql) => sql.includes('UPDATE de_users')), false)
  assert.equal(clientQueries.some((sql) => sql.includes('wallet_transactions')), false)
})
