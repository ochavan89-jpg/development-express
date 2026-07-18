const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const repoRoot = path.resolve(__dirname, '..')
const originalEnv = { ...process.env }
const fallbackSecret = 'devexpress_fallback_secret'

function resetEnv(overrides = {}) {
  for (const key of Object.keys(process.env)) delete process.env[key]
  Object.assign(process.env, originalEnv, overrides)
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
  }
}

function loadApp(overrides = {}) {
  resetEnv({ NODE_ENV: 'test', JWT_SECRET: undefined, ...overrides })
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(repoRoot)) delete require.cache[key]
  }
  return {
    app: require('../server'),
    db: require('../config/db'),
  }
}

function tokenFor(user) {
  return jwt.sign(user, process.env.JWT_SECRET || fallbackSecret)
}

async function request(app, method, url, body, headers = {}) {
  const server = app.listen(0)
  const { port } = server.address()

  try {
    return await new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body)
      const req = http.request(
        {
          method,
          port,
          path: url,
          host: '127.0.0.1',
          headers: {
            ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
            ...headers,
          },
        },
        (res) => {
          let raw = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => { raw += chunk })
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: raw ? JSON.parse(raw) : null,
            })
          })
        }
      )
      req.on('error', reject)
      if (payload) req.write(payload)
      req.end()
    })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('auth routes are mounted and fallback-signed demo tokens verify outside production', async () => {
  const { app, db } = loadApp()
  db.pool.query = async () => {
    throw new Error('database unavailable')
  }

  const login = await request(app, 'POST', '/api/auth/login', { username: 'admin', password: 'admin123' })

  assert.equal(login.status, 200)
  assert.equal(login.body.success, true)
  assert.equal(login.body.data.user.role, 'admin')

  const profile = await request(app, 'GET', '/api/auth/profile', undefined, {
    authorization: `Bearer ${login.body.data.token}`,
  })

  assert.equal(profile.status, 200)
  assert.equal(profile.body.data.role, 'admin')
})

test('production auth fails closed instead of issuing or trusting demo admin credentials on DB errors', async () => {
  const { app, db } = loadApp({ NODE_ENV: 'production' })
  db.pool.query = async () => {
    throw new Error('database unavailable')
  }

  const login = await request(app, 'POST', '/api/auth/login', { username: 'admin', password: 'admin123' })

  assert.equal(login.status, 503)
  assert.equal(login.body.message, 'Authentication service unavailable')

  const forgedDemoToken = tokenFor({
    id: 1,
    username: 'admin',
    role: 'admin',
    full_name: 'Demo Admin',
    email: 'admin@example.com',
  })
  const profile = await request(app, 'GET', '/api/auth/profile', undefined, {
    authorization: `Bearer ${forgedDemoToken}`,
  })

  assert.equal(profile.status, 503)
  assert.equal(profile.body.message, 'Authentication service unavailable')
})

test('public registration always creates a client even if a privileged role is submitted', async () => {
  const { app, db } = loadApp()
  let insertParams
  db.pool.query = async (_sql, params) => {
    insertParams = params
    return {
      rows: [{
        id: 44,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  const res = await request(app, 'POST', '/api/auth/register', {
    username: 'mallory',
    email: 'mallory@example.com',
    password: 'secret123',
    full_name: 'Mallory',
    role: 'admin',
  })

  assert.equal(res.status, 201)
  assert.equal(res.body.data.user.role, 'client')
  assert.equal(insertParams[5], 'client')
})

test('clients cannot cancel another client booking by guessing the booking id', async () => {
  const { app, db } = loadApp()
  const queries = []
  db.pool.query = async (sql, params) => {
    queries.push({ sql, params })
    if (sql.includes('FROM de_users WHERE id = $1')) {
      return { rows: [{ id: 3, username: 'client', role: 'client', is_active: true }] }
    }
    if (sql.includes('FROM bookings b')) {
      return { rows: [{ client_id: 99, owner_id: 20 }] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request(app, 'PUT', '/api/bookings/123/cancel', undefined, {
    authorization: `Bearer ${tokenFor({ id: 3, username: 'client', role: 'client' })}`,
  })

  assert.equal(res.status, 403)
  assert.equal(queries.some((q) => q.sql.startsWith('UPDATE bookings')), false)
})

test('completed bookings cannot be completed again and double-debit the client wallet', async () => {
  const { app, db } = loadApp()
  db.pool.query = async (sql) => {
    if (sql.includes('FROM de_users WHERE id = $1')) {
      return { rows: [{ id: 1, username: 'admin', role: 'admin', is_active: true }] }
    }
    throw new Error(`unexpected pool query: ${sql}`)
  }

  const clientQueries = []
  db.pool.connect = async () => ({
    query: async (sql) => {
      clientQueries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return {}
      if (sql.includes('FROM bookings WHERE id=$1')) {
        return { rows: [{ id: 55, status: 'completed', client_id: 3, hourly_rate: 1000 }] }
      }
      throw new Error(`unexpected client query: ${sql}`)
    },
    release: () => {},
  })

  const res = await request(app, 'PUT', '/api/bookings/55/complete', { actual_hours: 2 }, {
    authorization: `Bearer ${tokenFor({ id: 1, username: 'admin', role: 'admin' })}`,
  })

  assert.equal(res.status, 400)
  assert.equal(clientQueries.some((sql) => sql.startsWith('UPDATE de_users')), false)
})
