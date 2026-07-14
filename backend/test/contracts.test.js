const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const { pool } = require('../config/db')
const app = require('../server')

const originalQuery = pool.query.bind(pool)
const originalConnect = pool.connect.bind(pool)
const originalEnv = { ...process.env }

const JWT_SECRET = 'devexpress_fallback_secret'

function resetEnv() {
  process.env = { ...originalEnv }
  process.env.NODE_ENV = 'test'
  delete process.env.JWT_SECRET
  delete process.env.ENABLE_DEMO_AUTH
}

function resetPool() {
  pool.query = originalQuery
  pool.connect = originalConnect
}

test.afterEach(() => {
  resetEnv()
  resetPool()
})

function request(method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body === undefined ? undefined : JSON.stringify(body)
      const headers = {}
      if (payload) headers['Content-Type'] = 'application/json'
      if (payload) headers['Content-Length'] = Buffer.byteLength(payload)
      if (token) headers.Authorization = `Bearer ${token}`

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: server.address().port,
          path,
          method,
          headers,
        },
        (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString()
            let json = null
            try { json = text ? JSON.parse(text) : null } catch {}
            server.close(() => resolve({ status: res.statusCode, body: json, text }))
          })
        }
      )

      req.on('error', (err) => server.close(() => reject(err)))
      if (payload) req.write(payload)
      req.end()
    })
  })
}

function tokenFor(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' })
}

test('auth routes are mounted and fallback-secret tokens verify in demo mode', async () => {
  resetEnv()
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const login = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(login.status, 200)
  assert.equal(login.body.success, true)
  assert.ok(login.body.data.token)

  const profile = await request('GET', '/api/auth/profile', {
    token: login.body.data.token,
  })

  assert.equal(profile.status, 200)
  assert.equal(profile.body.data.role, 'admin')
})

test('production login fails closed when the user database lookup fails', async () => {
  resetEnv()
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
})

test('public registration always creates client users', async () => {
  resetEnv()
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
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'password123',
      full_name: 'Attacker',
      role: 'admin',
    },
  })

  assert.equal(res.status, 201)
  assert.equal(res.body.data.user.role, 'client')
})

test('clients cannot cancel another client booking', async () => {
  resetEnv()
  let updateCalled = false

  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) {
      return { rows: [{ id: 7, username: 'client-a', email: 'a@example.com', role: 'client', full_name: 'Client A', is_active: true }] }
    }
    if (sql.includes('FROM bookings b')) {
      return { rows: [{ client_id: 8, machine_owner_id: 2 }] }
    }
    if (sql.includes("UPDATE bookings SET status='cancelled'")) {
      updateCalled = true
      return { rowCount: 1 }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request('PUT', '/api/bookings/99/cancel', {
    token: tokenFor({ id: 7, username: 'client-a', role: 'client', full_name: 'Client A', email: 'a@example.com' }),
  })

  assert.equal(res.status, 403)
  assert.equal(updateCalled, false)
})

test('completing an already completed booking does not debit the wallet again', async () => {
  resetEnv()

  let bookingStatus = 'active'
  let walletDebits = 0
  let transactionInserts = 0
  let commits = 0
  let rollbacks = 0

  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) {
      return { rows: [{ id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', full_name: 'Admin', is_active: true }] }
    }
    throw new Error(`unexpected pool query: ${sql}`)
  }

  pool.connect = async () => ({
    query: async (sql) => {
      if (sql === 'BEGIN') return {}
      if (sql === 'COMMIT') { commits += 1; return {} }
      if (sql === 'ROLLBACK') { rollbacks += 1; return {} }
      if (sql.includes('SELECT * FROM bookings')) {
        return { rows: [{ id: 11, client_id: 3, operator_id: 4, hourly_rate: 1500, status: bookingStatus }] }
      }
      if (sql.includes("UPDATE bookings SET status='completed'")) {
        bookingStatus = 'completed'
        return { rows: [{ id: 11, client_id: 3, total_amount: 3000, status: 'completed' }] }
      }
      if (sql.includes('UPDATE de_users SET wallet_balance=wallet_balance-$1')) {
        walletDebits += 1
        return { rowCount: 1 }
      }
      if (sql.includes('INSERT INTO wallet_transactions')) {
        transactionInserts += 1
        return { rows: [{ id: transactionInserts }] }
      }
      throw new Error(`unexpected client query: ${sql}`)
    },
    release: () => {},
  })

  const token = tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' })

  const first = await request('PUT', '/api/bookings/11/complete', {
    token,
    body: { actual_hours: 2 },
  })
  assert.equal(first.status, 200)
  assert.equal(walletDebits, 1)
  assert.equal(transactionInserts, 1)
  assert.equal(commits, 1)

  const second = await request('PUT', '/api/bookings/11/complete', {
    token,
    body: { actual_hours: 2 },
  })
  assert.equal(second.status, 409)
  assert.equal(walletDebits, 1)
  assert.equal(transactionInserts, 1)
  assert.equal(rollbacks, 1)
})
