const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)

const request = async (method, path, { body, token } = {}) => {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))

  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json()
    return { status: response.status, data }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
  }
}

const restorePool = () => {
  pool.query = originalQuery
  pool.connect = originalConnect
}

const signTestToken = (overrides = {}) => jwt.sign({
  id: 1,
  username: 'admin',
  role: 'admin',
  full_name: 'Admin User',
  email: 'admin@example.com',
  ...overrides,
}, process.env.JWT_SECRET)

test.afterEach(() => {
  process.env.JWT_SECRET = 'test-secret'
  process.env.NODE_ENV = 'test'
  restorePool()
})

test.after(async () => {
  await pool.end()
})

test('auth login route is mounted and returns a token for valid database users', async () => {
  const password_hash = await bcrypt.hash('secret123', 4)
  pool.query = async (sql) => {
    if (sql.startsWith('SELECT * FROM de_users')) {
      return {
        rows: [{
          id: 7,
          username: 'real-user',
          email: 'real@example.com',
          full_name: 'Real User',
          role: 'client',
          is_active: true,
          password_hash,
        }],
      }
    }
    if (sql.startsWith('UPDATE de_users SET last_login')) return { rows: [], rowCount: 1 }
    throw new Error(`unexpected query: ${sql}`)
  }

  const response = await request('POST', '/api/auth/login', {
    body: { username: 'real-user', password: 'secret123' },
  })

  assert.equal(response.status, 200)
  assert.equal(response.data.success, true)
  assert.equal(typeof response.data.data.token, 'string')
  assert.equal(response.data.data.user.username, 'real-user')
})

test('public registration always creates a client user even if a privileged role is submitted', async () => {
  let insertedRole
  pool.query = async (sql, params) => {
    if (sql.includes('INSERT INTO de_users')) {
      insertedRole = params[5]
      return {
        rows: [{
          id: 8,
          username: params[0],
          email: params[1],
          full_name: params[3],
          role: params[5],
        }],
      }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const response = await request('POST', '/api/auth/register', {
    body: {
      username: 'intruder',
      email: 'intruder@example.com',
      password: 'secret123',
      full_name: 'Intruder',
      role: 'admin',
    },
  })

  assert.equal(response.status, 201)
  assert.equal(insertedRole, 'client')
  assert.equal(response.data.data.user.role, 'client')
})

test('production login fails closed instead of issuing demo admin tokens when the database is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const response = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(response.status, 503)
  assert.equal(response.data.success, false)
  assert.equal(response.data.data, undefined)
})

test('production protected routes fail closed instead of trusting token payloads when the database is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const response = await request('GET', '/api/users', {
    token: signTestToken(),
  })

  assert.equal(response.status, 503)
  assert.equal(response.data.success, false)
})

test('booking completion debits the wallet and writes the ledger in one transaction', async () => {
  const queries = []
  let released = false

  pool.query = async (sql) => {
    if (sql.startsWith('SELECT id, username')) {
      return {
        rows: [{
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          is_active: true,
        }],
      }
    }
    throw new Error(`unexpected pool query: ${sql}`)
  }

  pool.connect = async () => ({
    query: async (sql, params) => {
      queries.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM bookings b')) {
        return {
          rows: [{
            id: 22,
            client_id: 3,
            operator_id: 4,
            status: 'active',
            hourly_rate: '1500',
            wallet_balance: '5000',
          }],
        }
      }
      if (sql.startsWith('UPDATE bookings')) {
        return { rows: [{ id: 22, status: 'completed', total_amount: 3000 }], rowCount: 1 }
      }
      if (sql.startsWith('UPDATE de_users')) return { rows: [], rowCount: 1 }
      if (sql.includes('INSERT INTO wallet_transactions')) return { rows: [], rowCount: 1 }
      throw new Error(`unexpected transaction query: ${sql}`)
    },
    release: () => { released = true },
  })

  const response = await request('PUT', '/api/bookings/22/complete', {
    token: signTestToken(),
    body: { actual_hours: 2 },
  })

  assert.equal(response.status, 200)
  assert.equal(response.data.data.total_amount, 3000)
  assert.equal(queries[0].sql, 'BEGIN')
  assert.equal(queries.at(-1).sql, 'COMMIT')
  assert.equal(queries.some((q) => q.sql.startsWith('UPDATE de_users')), true)
  assert.equal(queries.some((q) => q.sql.includes('INSERT INTO wallet_transactions')), true)
  assert.equal(released, true)
})

test('booking completion rejects already completed bookings before debiting the wallet again', async () => {
  const queries = []

  pool.query = async (sql) => {
    if (sql.startsWith('SELECT id, username')) {
      return {
        rows: [{
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'admin',
          is_active: true,
        }],
      }
    }
    throw new Error(`unexpected pool query: ${sql}`)
  }

  pool.connect = async () => ({
    query: async (sql, params) => {
      queries.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM bookings b')) {
        return {
          rows: [{
            id: 22,
            client_id: 3,
            operator_id: 4,
            status: 'completed',
            hourly_rate: '1500',
            wallet_balance: '5000',
          }],
        }
      }
      throw new Error(`unexpected transaction query: ${sql}`)
    },
    release: () => {},
  })

  const response = await request('PUT', '/api/bookings/22/complete', {
    token: signTestToken(),
    body: { actual_hours: 2 },
  })

  assert.equal(response.status, 409)
  assert.equal(queries.some((q) => q.sql.startsWith('UPDATE de_users')), false)
  assert.equal(queries.some((q) => q.sql.includes('INSERT INTO wallet_transactions')), false)
  assert.equal(queries.at(-1).sql, 'ROLLBACK')
})
