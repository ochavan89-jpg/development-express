const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

process.env.NODE_ENV = 'production'
delete process.env.JWT_SECRET

const db = require('../config/db')
const app = require('../server')
delete process.env.JWT_SECRET

const request = (method, path, body, token) => new Promise((resolve, reject) => {
  const server = http.createServer(app)

  server.listen(0, () => {
    const { port } = server.address()
    const payload = body ? JSON.stringify(body) : null
    const req = http.request({
      method,
      port,
      path,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        server.close(() => {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
          })
        })
      })
    })

    req.on('error', (err) => {
      server.close(() => reject(err))
    })

    if (payload) req.write(payload)
    req.end()
  })
})

const tokenFor = (user) => jwt.sign(user, 'devexpress_fallback_secret')

test.after(() => {
  db.pool.end()
})

test('critical API contracts', async (t) => {
  await t.test('mounts auth router and clamps public registration to client role', async () => {
    db.pool.query = async (sql, params) => {
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
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'password123',
      full_name: 'Privilege Escalation',
      role: 'admin',
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.user.role, 'client')
  })

  await t.test('verifies fallback-signed JWTs on mounted protected routes', async () => {
    db.pool.query = async () => ({
      rows: [{
        id: 7,
        username: 'client',
        email: 'client@example.com',
        role: 'client',
        full_name: 'Client User',
        phone: null,
        is_active: true,
      }],
    })

    const res = await request('GET', '/api/auth/profile', null, tokenFor({
      id: 7,
      username: 'client',
      email: 'client@example.com',
      role: 'client',
      full_name: 'Client User',
    }))

    assert.equal(res.status, 200)
    assert.equal(res.body.data.id, 7)
  })

  await t.test('fails closed instead of demo admin login when production DB auth fails', async () => {
    db.pool.query = async () => {
      throw new Error('database unavailable')
    }

    const res = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    })

    assert.equal(res.status, 500)
    assert.equal(res.body.success, false)
  })

  await t.test('prevents clients from cancelling another client booking', async () => {
    db.pool.query = async (sql) => {
      if (/SELECT id, username, email, role, full_name, phone, is_active FROM de_users/.test(sql)) {
        return {
          rows: [{
            id: 7,
            username: 'client',
            email: 'client@example.com',
            role: 'client',
            full_name: 'Client User',
            phone: null,
            is_active: true,
          }],
        }
      }
      if (/SELECT id, client_id, status FROM bookings/.test(sql)) {
        return { rows: [{ id: 42, client_id: 999, status: 'active' }] }
      }
      throw new Error(`unexpected query: ${sql}`)
    }

    const res = await request('PUT', '/api/bookings/42/cancel', null, tokenFor({
      id: 7,
      username: 'client',
      email: 'client@example.com',
      role: 'client',
      full_name: 'Client User',
    }))

    assert.equal(res.status, 403)
  })

  await t.test('does not complete booking when wallet debit fails', async () => {
    const queries = []
    db.pool.query = async () => ({
      rows: [{
        id: 2,
        username: 'operator',
        email: 'operator@example.com',
        role: 'operator',
        full_name: 'Operator User',
        phone: null,
        is_active: true,
      }],
    })
    db.pool.connect = async () => ({
      query: async (sql) => {
        queries.push(sql)
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: null }
        if (/SELECT \* FROM bookings/.test(sql)) {
          return { rows: [{ id: 42, client_id: 7, hourly_rate: 1000, status: 'active' }] }
        }
        if (/UPDATE bookings SET status='completed'/.test(sql)) {
          return { rows: [{ id: 42, status: 'completed', total_amount: 2000 }], rowCount: 1 }
        }
        if (/UPDATE de_users SET wallet_balance=wallet_balance-\$1/.test(sql)) {
          throw new Error('wallet unavailable')
        }
        throw new Error(`unexpected query: ${sql}`)
      },
      release: () => {},
    })

    const res = await request('PUT', '/api/bookings/42/complete', {
      actual_hours: 2,
      end_fuel_reading: 10,
      end_hmr: 100,
    }, tokenFor({
      id: 2,
      username: 'operator',
      email: 'operator@example.com',
      role: 'operator',
      full_name: 'Operator User',
    }))

    assert.equal(res.status, 500)
    assert.equal(res.body.success, false)
    assert.ok(queries.includes('ROLLBACK'))
  })

  await t.test('rolls back wallet recharge when ledger insert fails', async () => {
    const queries = []
    db.pool.query = async () => ({
      rows: [{
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        full_name: 'Admin User',
        phone: null,
        is_active: true,
      }],
    })
    db.pool.connect = async () => ({
      query: async (sql) => {
        queries.push(sql)
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: null }
        if (/SELECT wallet_balance FROM de_users/.test(sql)) {
          return { rows: [{ wallet_balance: 1000 }] }
        }
        if (/UPDATE de_users SET wallet_balance=\$1 WHERE id=\$2/.test(sql)) {
          return { rows: [], rowCount: 1 }
        }
        if (/INSERT INTO wallet_transactions/.test(sql)) {
          throw new Error('ledger unavailable')
        }
        throw new Error(`unexpected query: ${sql}`)
      },
      release: () => {},
    })

    const res = await request('POST', '/api/wallet/recharge', {
      user_id: 7,
      amount: 500,
      reference_id: 'ref-1',
    }, tokenFor({
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      full_name: 'Admin User',
    }))

    assert.equal(res.status, 500)
    assert.equal(res.body.success, false)
    assert.ok(queries.includes('ROLLBACK'))
  })
})
