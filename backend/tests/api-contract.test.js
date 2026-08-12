const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

let queryHandler = async () => ({ rows: [] })

const dbPath = require.resolve('../config/db')
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    pool: {
      query: (...args) => queryHandler(...args),
    },
    testConnection: async () => true,
  },
}

const app = require('../server')

function request(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body ? JSON.stringify(body) : undefined
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: server.address().port,
          method,
          path,
          headers: {
            ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
            ...headers,
          },
        },
        (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => {
            server.close(() => {
              const text = Buffer.concat(chunks).toString()
              resolve({
                status: res.statusCode,
                body: text ? JSON.parse(text) : null,
              })
            })
          })
        }
      )
      req.on('error', (err) => server.close(() => reject(err)))
      if (payload) req.write(payload)
      req.end()
    })
  })
}

test('auth route is mounted under /api/auth', async () => {
  const res = await request('POST', '/api/auth/login', { body: {} })

  assert.equal(res.status, 400)
  assert.equal(res.body.success, false)
  assert.match(res.body.message, /Username and password required/)
})

test('public registration always creates client accounts', async () => {
  queryHandler = async (sql, params) => {
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

  const res = await request('POST', '/api/auth/register', {
    body: {
      username: 'new-admin',
      email: 'new-admin@example.com',
      password: 'password123',
      full_name: 'New Admin',
      role: 'admin',
    },
  })

  assert.equal(res.status, 201)
  assert.equal(res.body.data.user.role, 'client')
})

test('production login does not fall back to demo users when database auth fails', async (t) => {
  const previousEnv = process.env.NODE_ENV
  t.after(() => {
    process.env.NODE_ENV = previousEnv
  })

  process.env.NODE_ENV = 'production'
  queryHandler = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
})

test('clients cannot cancel bookings owned by another client', async () => {
  const token = jwt.sign({ id: 10, username: 'client-a', role: 'client' }, process.env.JWT_SECRET)
  let cancelled = false

  queryHandler = async (sql) => {
    if (/FROM de_users WHERE id/.test(sql)) {
      return { rows: [{ id: 10, username: 'client-a', role: 'client', is_active: true }] }
    }
    if (/SELECT client_id, status FROM bookings/.test(sql)) {
      return { rows: [{ client_id: 11, status: 'active' }] }
    }
    if (/UPDATE bookings SET status='cancelled'/.test(sql)) {
      cancelled = true
    }
    return { rows: [] }
  }

  const res = await request('PUT', '/api/bookings/123/cancel', {
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(res.status, 403)
  assert.equal(cancelled, false)
})
