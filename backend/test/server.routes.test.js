process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = 'test-secret'
process.env.RATE_LIMIT_MAX = '1000'

const assert = require('node:assert/strict')
const { after, afterEach, before, test } = require('node:test')
const jwt = require('jsonwebtoken')

const { pool } = require('../config/db')
const { createHttpServer } = require('../server')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)
let server
let baseUrl

before(async () => {
  server = createHttpServer()
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(() => {
  pool.query = originalQuery
  pool.connect = originalConnect
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

const request = (path, options) => fetch(`${baseUrl}${path}`, options)
const tokenFor = (user) => jwt.sign(user, process.env.JWT_SECRET)
const authHeaders = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` })

test('mounts API routers behind /api instead of returning 404', async () => {
  const health = await request('/api/health')
  assert.equal(health.status, 200)

  for (const path of ['/api/machines', '/api/dashboard/admin', '/api/wallet/balance']) {
    const response = await request(path)
    assert.equal(response.status, 401, `${path} should hit auth middleware`)
    const body = await response.json()
    assert.equal(body.message, 'No token provided')
  }
})

test('does not allow production login to fall back to demo credentials when DB is unavailable', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })

  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.success, false)
  assert.equal(body.data, undefined)
})

test('does not trust token payloads in production when user lookup fails', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }
  const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET)

  const response = await request('/api/machines', {
    headers: { Authorization: `Bearer ${token}` },
  })

  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.success, false)
})

test('public registration cannot create privileged users', async () => {
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

  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'password123',
      full_name: 'Attacker',
      role: 'admin',
    }),
  })

  assert.equal(response.status, 201)
  assert.equal(insertParams[5], 'client')
  const body = await response.json()
  assert.equal(body.data.user.role, 'client')
})

test('booking creation uses the server-side machine rate', async () => {
  let insertParams
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT id, username, email, role')) {
      return { rows: [{ id: 3, username: 'client', email: 'client@example.com', role: 'client', full_name: 'Client', is_active: true }] }
    }
    if (sql.startsWith('SELECT rate_per_hour FROM machines')) {
      return { rows: [{ rate_per_hour: '1500.00' }] }
    }
    if (sql.includes('INSERT INTO bookings')) {
      insertParams = params
      return { rows: [{ id: 10, client_id: params[0], machine_id: params[1], hourly_rate: params[5] }] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const response = await request('/api/bookings', {
    method: 'POST',
    headers: {
      ...authHeaders({ id: 3, username: 'client', role: 'client' }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      machine_id: 7,
      start_time: '2026-02-15T08:00:00Z',
      estimated_hours: 2,
      hourly_rate: 0,
      site_address: 'Site A',
    }),
  })

  assert.equal(response.status, 201)
  assert.equal(insertParams[5], 1500)
  const body = await response.json()
  assert.equal(body.data.hourly_rate, 1500)
})

test('booking completion debits wallet and writes ledger atomically', async () => {
  pool.query = async (sql) => {
    if (sql.includes('SELECT id, username, email, role')) {
      return { rows: [{ id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', full_name: 'Admin', is_active: true }] }
    }
    throw new Error(`unexpected auth query: ${sql}`)
  }

  const calls = []
  let released = false
  pool.connect = async () => ({
    query: async (sql, params = []) => {
      calls.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('SELECT b.*, u.wallet_balance')) {
        return { rows: [{ id: 5, client_id: 3, operator_id: 4, status: 'active', hourly_rate: '1500.00', wallet_balance: '5000.00' }] }
      }
      if (sql.startsWith('UPDATE de_users SET wallet_balance')) {
        return { rows: [{ wallet_balance: '2000.00' }] }
      }
      if (sql.includes('INSERT INTO wallet_transactions')) {
        return { rows: [] }
      }
      if (sql.startsWith('UPDATE bookings SET status')) {
        return { rows: [{ id: 5, status: 'completed', total_amount: params[1] }] }
      }
      throw new Error(`unexpected transaction query: ${sql}`)
    },
    release: () => { released = true },
  })

  const response = await request('/api/bookings/5/complete', {
    method: 'PUT',
    headers: {
      ...authHeaders({ id: 1, username: 'admin', role: 'admin' }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actual_hours: 2, end_fuel_reading: 100, end_hmr: 250 }),
  })

  assert.equal(response.status, 200)
  assert.equal(released, true)
  assert.ok(calls.some((call) => call.sql === 'BEGIN'))
  assert.ok(calls.some((call) => call.sql === 'COMMIT'))
  assert.equal(calls.some((call) => call.sql === 'ROLLBACK'), false)

  const walletUpdate = calls.find((call) => call.sql.startsWith('UPDATE de_users SET wallet_balance'))
  assert.deepEqual(walletUpdate.params, [3000, 3])
  const ledgerInsert = calls.find((call) => call.sql.includes('INSERT INTO wallet_transactions'))
  assert.deepEqual(ledgerInsert.params, [3, 3000, 5000, 2000, 'Booking completion debit', 5])
})

test('booking completion rejects repeat completion without another debit', async () => {
  pool.query = async (sql) => {
    if (sql.includes('SELECT id, username, email, role')) {
      return { rows: [{ id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', full_name: 'Admin', is_active: true }] }
    }
    throw new Error(`unexpected auth query: ${sql}`)
  }

  const calls = []
  pool.connect = async () => ({
    query: async (sql, params = []) => {
      calls.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('SELECT b.*, u.wallet_balance')) {
        return { rows: [{ id: 5, client_id: 3, operator_id: 4, status: 'completed', hourly_rate: '1500.00', wallet_balance: '5000.00' }] }
      }
      throw new Error(`unexpected transaction query: ${sql}`)
    },
    release: () => {},
  })

  const response = await request('/api/bookings/5/complete', {
    method: 'PUT',
    headers: {
      ...authHeaders({ id: 1, username: 'admin', role: 'admin' }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actual_hours: 2 }),
  })

  assert.equal(response.status, 409)
  assert.ok(calls.some((call) => call.sql === 'ROLLBACK'))
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE de_users SET wallet_balance')), false)
  assert.equal(calls.some((call) => call.sql.includes('INSERT INTO wallet_transactions')), false)
})

test('client booking cancellation is scoped to the owning client', async () => {
  let cancelSql
  let cancelParams
  pool.query = async (sql, params = []) => {
    if (sql.includes('SELECT id, username, email, role')) {
      return { rows: [{ id: 3, username: 'client', email: 'client@example.com', role: 'client', full_name: 'Client', is_active: true }] }
    }
    if (sql.startsWith("UPDATE bookings SET status='cancelled'")) {
      cancelSql = sql
      cancelParams = params
      return { rows: [] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const response = await request('/api/bookings/99/cancel', {
    method: 'PUT',
    headers: authHeaders({ id: 3, username: 'client', role: 'client' }),
  })

  assert.equal(response.status, 404)
  assert.match(cancelSql, /client_id=\$2/)
  assert.deepEqual(cancelParams, ['99', 3])
})
