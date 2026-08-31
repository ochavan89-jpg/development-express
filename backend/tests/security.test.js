const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query
const originalNodeEnv = process.env.NODE_ENV
const originalJwtSecret = process.env.JWT_SECRET

test.afterEach(() => {
  pool.query = originalQuery
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalJwtSecret
})

function request(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const { port } = server.address()
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'content-type': 'application/json',
            ...headers,
          },
        },
        (res) => {
          let raw = ''
          res.on('data', (chunk) => {
            raw += chunk
          })
          res.on('end', () => {
            server.close((err) => {
              if (err) return reject(err)
              resolve({
                status: res.statusCode,
                body: raw ? JSON.parse(raw) : null,
              })
            })
          })
        }
      )
      req.on('error', (err) => server.close(() => reject(err)))
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  })
}

test('dashboard router is mounted under /api', async () => {
  const res = await request('GET', '/api/dashboard/admin')

  assert.equal(res.status, 401)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, 'No token provided')
})

test('public registration always creates client users', async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test_secret'
  let capturedParams

  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    capturedParams = params
    return {
      rows: [
        {
          id: 123,
          username: params[0],
          email: params[1],
          full_name: params[3],
          role: params[5],
        },
      ],
    }
  }

  const res = await request('POST', '/api/auth/register', {
    body: {
      username: 'attacker',
      email: 'attacker@example.com',
      password: 'secret123',
      full_name: 'Privilege Escalation',
      role: 'admin',
    },
  })

  assert.equal(res.status, 201)
  assert.equal(capturedParams[5], 'client')
  assert.equal(res.body.data.user.role, 'client')
})

test('production login fails closed when the database is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'test_secret'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, 'Authentication temporarily unavailable')
})

test('production protected routes do not fall back to token payloads on database errors', async () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'test_secret'
  pool.query = async () => {
    throw new Error('database unavailable')
  }
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Admin User' },
    process.env.JWT_SECRET
  )

  const res = await request('GET', '/api/dashboard/admin', {
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, 'Authentication temporarily unavailable')
})

test('clients cannot cancel another client booking', async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test_secret'
  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) {
      return {
        rows: [
          {
            id: 3,
            username: 'client',
            email: 'client@example.com',
            role: 'client',
            full_name: 'Client User',
            is_active: true,
          },
        ],
      }
    }
    if (sql.includes('SELECT client_id FROM bookings')) {
      return { rows: [{ client_id: 4 }] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  }
  const token = jwt.sign(
    { id: 3, username: 'client', role: 'client', full_name: 'Client User' },
    process.env.JWT_SECRET
  )

  const res = await request('PUT', '/api/bookings/10/cancel', {
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(res.status, 403)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, 'Access denied for this booking')
})
