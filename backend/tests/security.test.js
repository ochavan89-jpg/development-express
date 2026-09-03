const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const MODULES_TO_CLEAR = [
  '../server',
  '../routes/auth',
  '../routes/dashboard',
  '../routes/machines',
  '../routes/bookings',
  '../routes/wallet',
  '../routes/users',
  '../routes/attendance',
  '../routes/alerts',
  '../middleware/auth',
  '../config/db',
]

const ORIGINAL_ENV = { ...process.env }

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key]
  }
  Object.assign(process.env, ORIGINAL_ENV)
  clearModules()
})

function clearModules() {
  for (const modulePath of MODULES_TO_CLEAR) {
    try {
      delete require.cache[require.resolve(modulePath)]
    } catch {}
  }
}

function loadApp(pool, env = {}) {
  clearModules()
  Object.assign(process.env, env)
  if (!('JWT_SECRET' in env)) delete process.env.JWT_SECRET
  if (!('NODE_ENV' in env)) process.env.NODE_ENV = 'test'

  const dbPath = require.resolve('../config/db')
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { pool, testConnection: async () => true },
  }

  return require('../server')
}

function authToken(payload = {}, secret = 'test-secret') {
  return jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Admin User', email: 'admin@example.com', ...payload },
    secret,
    { expiresIn: '1h' }
  )
}

async function request(app, method, path, { body, token } = {}) {
  const server = http.createServer(app)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

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

    const text = await response.text()
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test('auth routes are mounted under /api/auth', async () => {
  const app = loadApp({
    query: async () => {
      throw new Error('db unavailable')
    },
  })

  const response = await request(app, 'POST', '/api/auth/login', {
    body: { username: 'client', password: 'client123' },
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
})

test('production login fails closed when the database is unavailable', async () => {
  const app = loadApp(
    {
      query: async () => {
        throw new Error('db unavailable')
      },
    },
    { NODE_ENV: 'production', JWT_SECRET: 'prod-secret' }
  )

  const response = await request(app, 'POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(response.status, 401)
  assert.equal(response.body.success, false)
})

test('public registration always creates a client user', async () => {
  const queries = []
  const app = loadApp({
    query: async (sql, params) => {
      queries.push({ sql, params })
      return {
        rows: [
          {
            id: 10,
            username: params[0],
            email: params[1],
            full_name: params[3],
            role: params[5],
          },
        ],
      }
    },
  })

  const response = await request(app, 'POST', '/api/auth/register', {
    body: {
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'secret123',
      full_name: 'Attack User',
      role: 'admin',
    },
  })

  assert.equal(response.status, 201)
  assert.equal(response.body.data.user.role, 'client')
  assert.equal(queries[0].params[5], 'client')
})

test('production token auth does not trust token payloads after database errors', async () => {
  const app = loadApp(
    {
      query: async () => {
        throw new Error('db unavailable')
      },
    },
    { NODE_ENV: 'production', JWT_SECRET: 'prod-secret' }
  )

  const response = await request(app, 'GET', '/api/machines', {
    token: authToken({ role: 'admin' }, 'prod-secret'),
  })

  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
})

test('clients cannot cancel another client booking', async () => {
  const queries = []
  const app = loadApp(
    {
      query: async (sql, params) => {
        queries.push({ sql, params })
        if (sql.includes('FROM de_users WHERE id = $1')) {
          return { rows: [{ id: 1, username: 'client-a', role: 'client', is_active: true }] }
        }
        if (sql.includes('FROM bookings b')) {
          return { rows: [{ id: 22, client_id: 2, owner_id: 3, operator_id: 4 }] }
        }
        throw new Error(`unexpected query: ${sql}`)
      },
    },
    { JWT_SECRET: 'test-secret' }
  )

  const response = await request(app, 'PUT', '/api/bookings/22/cancel', {
    token: authToken({ id: 1, role: 'client' }),
  })

  assert.equal(response.status, 403)
  assert.equal(response.body.success, false)
  assert.equal(queries.some(q => q.sql.includes("UPDATE bookings SET status='cancelled'")), false)
})

test('booking completion rolls back if any financial write fails', async () => {
  const calls = []
  const dbClient = {
    query: async (sql, params) => {
      calls.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('FROM bookings b')) {
        return {
          rows: [
            {
              id: 7,
              client_id: 2,
              operator_id: 1,
              hourly_rate: '1000',
              wallet_balance: '5000',
            },
          ],
        }
      }
      if (sql.includes('UPDATE bookings SET')) {
        return { rows: [{ id: 7, status: 'completed', total_amount: 2000 }] }
      }
      if (sql.includes('UPDATE de_users SET wallet_balance')) return { rows: [] }
      if (sql.includes('INSERT INTO wallet_transactions')) throw new Error('ledger write failed')
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => calls.push('RELEASE'),
  }

  const app = loadApp(
    {
      query: async (sql) => {
        if (sql.includes('FROM de_users WHERE id = $1')) {
          return { rows: [{ id: 1, username: 'operator', role: 'operator', is_active: true }] }
        }
        throw new Error(`unexpected pool query: ${sql}`)
      },
      connect: async () => dbClient,
    },
    { JWT_SECRET: 'test-secret' }
  )

  const response = await request(app, 'PUT', '/api/bookings/7/complete', {
    token: authToken({ id: 1, role: 'operator' }),
    body: { actual_hours: 2 },
  })

  assert.equal(response.status, 500)
  assert.ok(calls.includes('ROLLBACK'))
  assert.equal(calls.includes('COMMIT'), false)
  assert.equal(calls.at(-1), 'RELEASE')
})

test('wallet recharge rolls back if ledger insertion fails', async () => {
  const calls = []
  const dbClient = {
    query: async (sql) => {
      calls.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('SELECT wallet_balance')) return { rows: [{ wallet_balance: '100' }] }
      if (sql.includes('UPDATE de_users SET wallet_balance')) return { rows: [] }
      if (sql.includes('INSERT INTO wallet_transactions')) throw new Error('ledger write failed')
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => calls.push('RELEASE'),
  }

  const app = loadApp(
    {
      query: async (sql) => {
        if (sql.includes('FROM de_users WHERE id = $1')) {
          return { rows: [{ id: 1, username: 'admin', role: 'admin', is_active: true }] }
        }
        throw new Error(`unexpected pool query: ${sql}`)
      },
      connect: async () => dbClient,
    },
    { JWT_SECRET: 'test-secret' }
  )

  const response = await request(app, 'POST', '/api/wallet/recharge', {
    token: authToken({ role: 'admin' }),
    body: { user_id: 2, amount: 50, reference_id: 'pay_123' },
  })

  assert.equal(response.status, 500)
  assert.ok(calls.includes('ROLLBACK'))
  assert.equal(calls.includes('COMMIT'), false)
  assert.equal(calls.at(-1), 'RELEASE')
})
