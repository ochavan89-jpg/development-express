const assert = require('node:assert/strict')
const { test, beforeEach, after } = require('node:test')
const path = require('node:path')
const jwt = require('jsonwebtoken')

const mockPool = {
  query: async () => {
    throw new Error('mockPool.query not configured')
  },
  connect: async () => {
    throw new Error('mockPool.connect not configured')
  },
}

const dbPath = path.resolve(__dirname, '../config/db.js')
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { pool: mockPool, testConnection: async () => true },
}

const app = require('../server')
const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  mockPool.query = async () => {
    throw new Error('mockPool.query not configured')
  }
  mockPool.connect = async () => {
    throw new Error('mockPool.connect not configured')
  }
})

after(() => {
  process.env = originalEnv
})

const signToken = (user = { id: 1, username: 'admin', role: 'admin', full_name: 'Admin User', email: 'admin@example.com' }) =>
  jwt.sign(user, process.env.JWT_SECRET || 'devexpress_fallback_secret')

const withServer = async (fn) => {
  const server = app.listen(0)
  const { port } = server.address()
  try {
    return await fn(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
  }
}

const request = async (baseUrl, method, pathname, { body, token } = {}) => {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  }
}

test('auth router is mounted under /api/auth', async () => {
  await withServer(async (baseUrl) => {
    const res = await request(baseUrl, 'GET', '/api/auth/profile')

    assert.equal(res.status, 401)
    assert.equal(res.body.message, 'No token provided')
  })
})

test('public registration always creates client users', async () => {
  let insertedParams
  mockPool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    insertedParams = params
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

  await withServer(async (baseUrl) => {
    const res = await request(baseUrl, 'POST', '/api/auth/register', {
      body: {
        username: 'new-user',
        email: 'new@example.com',
        password: 'secret123',
        full_name: 'New User',
        role: 'admin',
      },
    })

    assert.equal(res.status, 201)
    assert.equal(insertedParams[5], 'client')
    assert.equal(res.body.data.user.role, 'client')
  })
})

test('production login does not fall back to demo users when the database fails', async () => {
  process.env.NODE_ENV = 'production'
  mockPool.query = async () => {
    throw new Error('database unavailable')
  }

  await withServer(async (baseUrl) => {
    const res = await request(baseUrl, 'POST', '/api/auth/login', {
      body: { username: 'admin', password: 'admin123' },
    })

    assert.equal(res.status, 500)
    assert.equal(res.body.success, false)
  })
})

test('production auth middleware fails closed when user lookup fails', async () => {
  process.env.NODE_ENV = 'production'
  mockPool.query = async () => {
    throw new Error('database unavailable')
  }

  await withServer(async (baseUrl) => {
    const res = await request(baseUrl, 'GET', '/api/auth/profile', {
      token: signToken(),
    })

    assert.equal(res.status, 503)
    assert.equal(res.body.message, 'Authentication service unavailable')
  })
})

test('client booking cancellation is scoped to the authenticated client', async () => {
  const calls = []
  mockPool.query = async (sql, params) => {
    calls.push({ sql, params })
    if (/SELECT id, username/.test(sql)) {
      return { rows: [{ id: 3, username: 'client', role: 'client', is_active: true }] }
    }
    if (/UPDATE bookings SET status='cancelled'/.test(sql)) {
      assert.match(sql, /client_id=\$2/)
      assert.deepEqual(params, ['99', 3])
      return { rowCount: 1, rows: [] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  await withServer(async (baseUrl) => {
    const res = await request(baseUrl, 'PUT', '/api/bookings/99/cancel', {
      token: signToken({ id: 3, username: 'client', role: 'client', full_name: 'Client User', email: 'client@example.com' }),
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
    assert.equal(calls.length, 2)
  })
})

test('booking completion commits booking, wallet, and ledger updates together', async () => {
  mockPool.query = async (sql) => {
    if (/SELECT id, username/.test(sql)) {
      return { rows: [{ id: 1, username: 'admin', role: 'admin', is_active: true }] }
    }
    throw new Error(`unexpected pool query: ${sql}`)
  }

  const txQueries = []
  const client = {
    query: async (sql, params) => {
      txQueries.push(sql)
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (/SELECT \* FROM bookings/.test(sql)) {
        return { rows: [{ id: 42, client_id: 3, hourly_rate: '1500.00' }] }
      }
      if (/SELECT wallet_balance/.test(sql)) {
        return { rows: [{ wallet_balance: '10000.00' }] }
      }
      if (/UPDATE bookings SET status='completed'/.test(sql)) {
        return { rows: [{ id: 42, status: 'completed', actual_hours: params[0], total_amount: params[1] }] }
      }
      if (/UPDATE de_users SET wallet_balance/.test(sql)) return { rows: [] }
      if (/INSERT INTO wallet_transactions/.test(sql)) return { rows: [] }
      throw new Error(`unexpected transaction query: ${sql}`)
    },
    release: () => {},
  }
  mockPool.connect = async () => client

  await withServer(async (baseUrl) => {
    const res = await request(baseUrl, 'PUT', '/api/bookings/42/complete', {
      token: signToken(),
      body: { actual_hours: 2, end_fuel_reading: 100, end_hmr: 200 },
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.total_amount, 3000)
    assert.deepEqual(txQueries, [
      'BEGIN',
      'SELECT * FROM bookings WHERE id=$1 FOR UPDATE',
      'SELECT wallet_balance FROM de_users WHERE id=$1 FOR UPDATE',
      `UPDATE bookings SET status='completed', end_time=NOW(), actual_hours=$1, total_amount=$2, end_fuel_reading=$3, end_hmr=$4 WHERE id=$5 RETURNING *`,
      'UPDATE de_users SET wallet_balance=$1 WHERE id=$2',
      `INSERT INTO wallet_transactions (user_id,transaction_type,amount,balance_before,balance_after,description,booking_id)
       VALUES ($1,'debit',$2,$3,$4,$5,$6)`,
      'COMMIT',
    ])
  })
})
