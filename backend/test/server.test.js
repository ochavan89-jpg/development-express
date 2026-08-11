process.env.NODE_ENV = 'test'
delete process.env.JWT_SECRET

const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

const request = (method, path, { body, headers } = {}) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const { port } = server.address()
    const payload = body ? JSON.stringify(body) : undefined
    const req = http.request({
      method,
      port,
      path,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        server.close(() => {
          resolve({
            status: res.statusCode,
            body: raw ? JSON.parse(raw) : null,
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

test.after(() => pool.end())

test('health endpoint is available under /api', async () => {
  const res = await request('GET', '/api/health')

  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
})

test('auth route is mounted instead of falling through to 404', async () => {
  const res = await request('POST', '/api/auth/login', { body: {} })

  assert.equal(res.status, 400)
  assert.equal(res.body.message, 'Username and password required')
})

test('protected route is mounted and requires a token', async () => {
  const res = await request('GET', '/api/machines')

  assert.equal(res.status, 401)
  assert.equal(res.body.message, 'No token provided')
})

test('profile accepts tokens signed with the same effective secret used by login', async () => {
  const originalQuery = pool.query
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  try {
    const secret = process.env.JWT_SECRET || 'devexpress_fallback_secret'
    const token = jwt.sign(
      { id: 123, username: 'client', role: 'client', full_name: 'Client User', email: 'client@example.test' },
      secret
    )
    const res = await request('GET', '/api/auth/profile', {
      headers: { authorization: `Bearer ${token}` },
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.id, 123)
    assert.equal(res.body.data.role, 'client')
  } finally {
    pool.query = originalQuery
  }
})

test('public registration always creates a client account', async () => {
  const originalQuery = pool.query
  let insertParams
  pool.query = async (sql, params) => {
    insertParams = params
    return {
      rows: [{
        id: 321,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  try {
    const res = await request('POST', '/api/auth/register', {
      body: {
        username: 'new-admin',
        email: 'new-admin@example.test',
        password: 'secret-pass',
        full_name: 'New Admin',
        role: 'admin',
      },
    })

    assert.equal(res.status, 201)
    assert.equal(insertParams[5], 'client')
    assert.equal(res.body.data.user.role, 'client')
  } finally {
    pool.query = originalQuery
  }
})

test('clients cannot cancel bookings they do not own', async () => {
  const originalQuery = pool.query
  let updateSql
  let updateParams
  pool.query = async (sql, params) => {
    if (sql.includes('FROM de_users WHERE id = $1')) {
      return {
        rows: [{
          id: 7,
          username: 'client',
          email: 'client@example.test',
          role: 'client',
          full_name: 'Client User',
          is_active: true,
        }],
      }
    }

    updateSql = sql
    updateParams = params
    return { rows: [] }
  }

  try {
    const token = jwt.sign(
      { id: 7, username: 'client', role: 'client', full_name: 'Client User', email: 'client@example.test' },
      process.env.JWT_SECRET || 'devexpress_fallback_secret'
    )
    const res = await request('PUT', '/api/bookings/99/cancel', {
      headers: { authorization: `Bearer ${token}` },
    })

    assert.equal(res.status, 404)
    assert.match(updateSql, /client_id=\$3/)
    assert.deepEqual(updateParams, ['99', 'client', 7])
  } finally {
    pool.query = originalQuery
  }
})
