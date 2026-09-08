const assert = require('node:assert/strict')
const { after, before, beforeEach, test } = require('node:test')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'

const app = require('../server')
const { pool } = require('../config/db')

let server
let baseUrl
const originalQuery = pool.query
const originalConnect = pool.connect

const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json()
  return { response, json }
}

const tokenFor = (user) => jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })

before(async () => {
  server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener))
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  pool.query = originalQuery
  pool.connect = originalConnect
})

after(async () => {
  pool.query = originalQuery
  pool.connect = originalConnect
  await new Promise((resolve) => server.close(resolve))
})

test('auth routes are mounted under /api/auth', async () => {
  const { response, json } = await request('GET', '/api/auth/profile')

  assert.equal(response.status, 401)
  assert.equal(json.message, 'No token provided')
})

test('production login does not fall back to demo users on database failure', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const { response, json } = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(response.status, 503)
  assert.equal(json.success, false)
})

test('public registration always creates a client role', async () => {
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
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

  const { response, json } = await request('POST', '/api/auth/register', {
    body: {
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'password123',
      full_name: 'Attacker',
      role: 'admin',
    },
  })

  assert.equal(response.status, 201)
  assert.equal(json.data.user.role, 'client')
})

test('booking completion debits wallet and writes ledger entry in one transaction', async () => {
  const queries = []
  const user = { id: 4, username: 'operator', role: 'operator', full_name: 'Operator' }
  pool.query = async () => ({
    rows: [{ ...user, is_active: true }],
  })
  pool.connect = async () => ({
    query: async (sql, params) => {
      queries.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (/SELECT \* FROM bookings/.test(sql)) {
        return { rows: [{ id: 7, client_id: 3, operator_id: 4, status: 'active', hourly_rate: '1500.00' }] }
      }
      if (/SELECT wallet_balance/.test(sql)) {
        return { rows: [{ wallet_balance: '10000.00' }] }
      }
      if (/UPDATE bookings/.test(sql)) {
        return { rows: [{ id: 7, status: 'completed', total_amount: params[1] }] }
      }
      return { rows: [], rowCount: 1 }
    },
    release: () => {},
  })

  const { response, json } = await request('PUT', '/api/bookings/7/complete', {
    token: tokenFor(user),
    body: { actual_hours: 2 },
  })

  assert.equal(response.status, 200)
  assert.equal(json.data.total_amount, 3000)
  assert.deepEqual(queries.map((q) => q.sql).filter((sql) => ['BEGIN', 'COMMIT'].includes(sql)), ['BEGIN', 'COMMIT'])
  assert.ok(queries.some((q) => /UPDATE de_users SET wallet_balance/.test(q.sql)))
  assert.ok(queries.some((q) => /INSERT INTO wallet_transactions/.test(q.sql)))
})

test('already completed bookings are rejected before a second wallet debit', async () => {
  const queries = []
  const user = { id: 4, username: 'operator', role: 'operator', full_name: 'Operator' }
  pool.query = async () => ({
    rows: [{ ...user, is_active: true }],
  })
  pool.connect = async () => ({
    query: async (sql) => {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (/SELECT \* FROM bookings/.test(sql)) {
        return { rows: [{ id: 7, client_id: 3, operator_id: 4, status: 'completed', hourly_rate: '1500.00' }] }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  })

  const { response, json } = await request('PUT', '/api/bookings/7/complete', {
    token: tokenFor(user),
    body: { actual_hours: 2 },
  })

  assert.equal(response.status, 400)
  assert.equal(json.message, 'Booking already completed')
  assert.ok(queries.includes('ROLLBACK'))
  assert.ok(!queries.some((sql) => /UPDATE de_users SET wallet_balance/.test(sql)))
})

test('wallet recharge rejects non-numeric amounts before opening a transaction', async () => {
  const user = { id: 1, username: 'admin', role: 'admin', full_name: 'Admin' }
  let connectCalled = false
  pool.query = async () => ({
    rows: [{ ...user, is_active: true }],
  })
  pool.connect = async () => {
    connectCalled = true
    throw new Error('should not connect')
  }

  const { response, json } = await request('POST', '/api/wallet/recharge', {
    token: tokenFor(user),
    body: { user_id: 3, amount: 'abc' },
  })

  assert.equal(response.status, 400)
  assert.equal(json.message, 'Invalid recharge data')
  assert.equal(connectCalled, false)
})

test('operator punch-out update remains scoped to the authenticated operator', async () => {
  const user = { id: 4, username: 'operator', role: 'operator', full_name: 'Operator' }
  const queries = []
  pool.query = async (sql, params) => {
    queries.push({ sql, params })
    if (/SELECT id, username/.test(sql)) {
      return { rows: [{ ...user, is_active: true }] }
    }
    if (/SELECT \* FROM attendance/.test(sql)) {
      return { rows: [{ id: 9, operator_id: 4, punch_in_time: new Date(Date.now() - 3600000).toISOString() }] }
    }
    if (/UPDATE attendance/.test(sql)) {
      return { rows: [{ id: 9, operator_id: params[2], total_hours: params[0] }] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const { response } = await request('PUT', '/api/attendance/9/punch-out', {
    token: tokenFor(user),
  })

  assert.equal(response.status, 200)
  const update = queries.find((q) => /UPDATE attendance/.test(q.sql))
  assert.match(update.sql, /operator_id=\$3/)
  assert.match(update.sql, /punch_out_time IS NULL/)
  assert.equal(update.params[2], user.id)
})
