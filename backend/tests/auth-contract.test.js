const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const { pool } = require('../config/db')
const app = require('../server')

const request = (method, path, { body, headers } = {}) => new Promise((resolve, reject) => {
  const server = http.createServer(app)

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    const payload = body ? JSON.stringify(body) : null
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        server.close(() => {
          resolve({
            statusCode: res.statusCode,
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

test('auth login route is mounted below /api', async () => {
  const res = await request('POST', '/api/auth/login', {})

  assert.equal(res.statusCode, 400)
  assert.equal(res.body.success, false)
  assert.match(res.body.message, /Username and password required/)
})

test('fallback-signed tokens authenticate protected API routes', async () => {
  const originalQuery = pool.query
  const originalSecret = process.env.JWT_SECRET
  delete process.env.JWT_SECRET
  pool.query = async () => {
    throw new Error('demo mode')
  }

  try {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin', full_name: 'Demo Admin', email: 'admin@example.com' },
      'devexpress_fallback_secret',
      { expiresIn: '1h' }
    )
    const res = await request('GET', '/api/auth/profile', {
      headers: { authorization: `Bearer ${token}` },
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.role, 'admin')
  } finally {
    pool.query = originalQuery
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET
    } else {
      process.env.JWT_SECRET = originalSecret
    }
  }
})

test('public registration always creates client users', async () => {
  const originalQuery = pool.query
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    assert.equal(params[5], 'client')
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

  try {
    const res = await request('POST', '/api/auth/register', {
      body: {
        username: 'mallory',
        email: 'mallory@example.com',
        password: 'password123',
        full_name: 'Mallory User',
        role: 'admin',
      },
    })

    assert.equal(res.statusCode, 201)
    assert.equal(res.body.success, true)
    assert.equal(res.body.data.user.role, 'client')
  } finally {
    pool.query = originalQuery
  }
})
