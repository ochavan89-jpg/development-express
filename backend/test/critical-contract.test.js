const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

process.env.NODE_ENV = 'production'
delete process.env.JWT_SECRET

const db = require('../config/db')
const app = require('../server')

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

  const token = jwt.sign(
    { id: 7, username: 'client', email: 'client@example.com', role: 'client', full_name: 'Client User' },
    'devexpress_fallback_secret'
  )

  const res = await request('GET', '/api/auth/profile', null, token)

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

  const token = jwt.sign(
    { id: 7, username: 'client', email: 'client@example.com', role: 'client', full_name: 'Client User' },
    'devexpress_fallback_secret'
  )

  const res = await request('PUT', '/api/bookings/42/cancel', null, token)

  assert.equal(res.status, 403)
})
})
