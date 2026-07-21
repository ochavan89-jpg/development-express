const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const app = require('../server')
const { pool } = require('../config/db')

const originalEnv = { ...process.env }
const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)

const users = {
  admin: { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', full_name: 'Admin User', is_active: true },
  client: { id: 3, username: 'client', email: 'client@example.com', role: 'client', full_name: 'Client User', is_active: true },
  operator: { id: 4, username: 'operator', email: 'operator@example.com', role: 'operator', full_name: 'Operator User', is_active: true },
}

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET || 'devexpress_fallback_secret')
}

function resetState() {
  process.env = { ...originalEnv }
  delete process.env.NODE_ENV
  pool.query = originalQuery
  pool.connect = originalConnect
}

async function request(method, path, { body, token } = {}) {
  const server = app.listen(0)
  try {
    const { port } = server.address()
    const headers = { accept: 'application/json' }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`

    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    return {
      status: res.status,
      body: await res.json(),
    }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
  }
}

test.afterEach(resetState)
test.after(async () => {
  resetState()
  await pool.end()
})

test('auth routes are mounted and demo login works outside production', async () => {
  pool.query = async () => {
    throw new Error('db unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
  assert.ok(res.body.data.token)
  assert.equal(res.body.data.user.role, 'admin')
})

test('production login fails closed when the database is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('db unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, 'Authentication service unavailable')
})

test('production profile lookup fails closed instead of trusting token payload', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('db unavailable')
  }

  const res = await request('GET', '/api/auth/profile', {
    token: tokenFor(users.admin),
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, 'Authentication service unavailable')
})

test('public registration always creates a client role', async () => {
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    assert.equal(params[5], 'client')
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

  const res = await request('POST', '/api/auth/register', {
    body: {
      username: 'mallory',
      email: 'mallory@example.com',
      password: 'secret123',
      full_name: 'Mallory',
      role: 'admin',
    },
  })

  assert.equal(res.status, 201)
  assert.equal(res.body.data.user.role, 'client')
})

test('clients cannot cancel another client booking', async () => {
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT id, username')) return { rows: [users.client] }
    assert.match(sql, /UPDATE bookings SET status='cancelled'/)
    assert.match(sql, /client_id=\$2/)
    assert.deepEqual(params, ['99', users.client.id])
    return { rows: [] }
  }

  const res = await request('PUT', '/api/bookings/99/cancel', {
    token: tokenFor(users.client),
  })

  assert.equal(res.status, 404)
  assert.equal(res.body.success, false)
})

test('completed bookings are not debited a second time', async () => {
  const clientQueries = []
  const dbClient = {
    query: async (sql, params) => {
      clientQueries.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('SELECT * FROM bookings')) {
        assert.match(sql, /operator_id=\$2/)
        return { rows: [{ id: 77, status: 'completed', client_id: 3, operator_id: users.operator.id, hourly_rate: 1000 }] }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }

  pool.query = async (sql) => {
    if (sql.includes('SELECT id, username')) return { rows: [users.operator] }
    throw new Error(`unexpected pool query: ${sql}`)
  }
  pool.connect = async () => dbClient

  const res = await request('PUT', '/api/bookings/77/complete', {
    token: tokenFor(users.operator),
    body: { actual_hours: 4 },
  })

  assert.equal(res.status, 409)
  assert.equal(res.body.message, 'Booking already completed')
  assert.equal(clientQueries.some(({ sql }) => sql.includes('UPDATE de_users SET wallet_balance')), false)
})
