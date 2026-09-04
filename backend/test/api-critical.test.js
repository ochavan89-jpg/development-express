process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

const assert = require('node:assert/strict')
const { after, afterEach, before, test } = require('node:test')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

let server
let baseUrl

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)

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
  pool.connect = originalConnect
  process.env.NODE_ENV = 'test'
})

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options)

const tokenFor = (user) => jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })

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

test('client booking creation uses the server-side machine rate', async () => {
  let insertedRate
  pool.query = async (sql, params) => {
    if (/SELECT id, username/.test(sql)) {
      return { rows: [{ id: 3, username: 'client', role: 'client', full_name: 'Client', email: 'client@example.com', is_active: true }] }
    }
    if (/SELECT rate_per_hour FROM machines/.test(sql)) return { rows: [{ rate_per_hour: '1500.00' }] }
    if (/INSERT INTO bookings/.test(sql)) {
      insertedRate = params[5]
      return { rows: [{ id: 21, client_id: params[0], machine_id: params[1], hourly_rate: params[5] }] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request('/api/bookings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${tokenFor({ id: 3, username: 'client', role: 'client', full_name: 'Client', email: 'client@example.com' })}`,
    },
    body: JSON.stringify({
      machine_id: 2,
      operator_id: 9,
      start_time: '2026-09-04T10:00:00Z',
      estimated_hours: 4,
      hourly_rate: 1,
      site_address: 'Site A',
      work_description: 'Excavation',
    }),
  })

  assert.equal(res.status, 201)
  assert.equal(insertedRate, 1500)
})

test('booking completion updates booking, wallet, and ledger in one transaction', async () => {
  const queries = []
  const client = {
    query: async (sql, params) => {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (/SELECT \* FROM bookings/.test(sql)) {
        return { rows: [{ id: 7, client_id: 3, operator_id: 9, status: 'active', hourly_rate: '1500.00' }] }
      }
      if (/SELECT wallet_balance/.test(sql)) return { rows: [{ wallet_balance: '5000.00' }] }
      if (/UPDATE bookings/.test(sql)) {
        return { rows: [{ id: 7, status: 'completed', actual_hours: params[0], total_amount: params[1] }] }
      }
      if (/UPDATE de_users/.test(sql) || /INSERT INTO wallet_transactions/.test(sql)) return { rows: [], rowCount: 1 }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }

  pool.query = async () => ({
    rows: [{ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com', is_active: true }],
  })
  pool.connect = async () => client

  const res = await request('/api/bookings/7/complete', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' })}`,
    },
    body: JSON.stringify({ actual_hours: 2, end_fuel_reading: 100, end_hmr: 250 }),
  })

  assert.equal(res.status, 200)
  assert.ok(queries.includes('BEGIN'))
  assert.ok(queries.some((sql) => /INSERT INTO wallet_transactions/.test(sql)))
  assert.ok(queries.includes('COMMIT'))
})

test('booking completion does not double-charge completed bookings', async () => {
  const queries = []
  const client = {
    query: async (sql) => {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (/SELECT \* FROM bookings/.test(sql)) {
        return { rows: [{ id: 7, client_id: 3, operator_id: 9, status: 'completed', hourly_rate: '1500.00' }] }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }

  pool.query = async () => ({
    rows: [{ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com', is_active: true }],
  })
  pool.connect = async () => client

  const res = await request('/api/bookings/7/complete', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' })}`,
    },
    body: JSON.stringify({ actual_hours: 2 }),
  })

  assert.equal(res.status, 400)
  assert.ok(queries.includes('ROLLBACK'))
  assert.equal(queries.some((sql) => /UPDATE de_users/.test(sql)), false)
  assert.equal(queries.some((sql) => /INSERT INTO wallet_transactions/.test(sql)), false)
})

test('booking completion rejects charges above wallet balance', async () => {
  const queries = []
  const client = {
    query: async (sql) => {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (/SELECT \* FROM bookings/.test(sql)) {
        return { rows: [{ id: 7, client_id: 3, operator_id: 9, status: 'active', hourly_rate: '1500.00' }] }
      }
      if (/SELECT wallet_balance/.test(sql)) return { rows: [{ wallet_balance: '1000.00' }] }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }

  pool.query = async () => ({
    rows: [{ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com', is_active: true }],
  })
  pool.connect = async () => client

  const res = await request('/api/bookings/7/complete', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' })}`,
    },
    body: JSON.stringify({ actual_hours: 2 }),
  })

  assert.equal(res.status, 400)
  assert.ok(queries.includes('ROLLBACK'))
  assert.equal(queries.some((sql) => /UPDATE bookings/.test(sql)), false)
  assert.equal(queries.some((sql) => /UPDATE de_users/.test(sql)), false)
})
