process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test_secret'

const http = require('node:http')
const test = require('node:test')
const assert = require('node:assert/strict')

const { pool } = require('../config/db')
const app = require('../server')

const originalQuery = pool.query.bind(pool)

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body ? JSON.stringify(body) : null
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: server.address().port,
          path,
          method,
          headers: payload
            ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
            : undefined,
        },
        (res) => {
          let raw = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => { raw += chunk })
          res.on('end', () => {
            server.close()
            resolve({
              statusCode: res.statusCode,
              body: raw ? JSON.parse(raw) : null,
            })
          })
        }
      )
      req.on('error', (err) => {
        server.close()
        reject(err)
      })
      if (payload) req.write(payload)
      req.end()
    })
  })
}

test.afterEach(() => {
  pool.query = originalQuery
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test_secret'
})

test('mounts API routes instead of only health', async () => {
  const health = await request('GET', '/api/health')
  assert.equal(health.statusCode, 200)
  assert.equal(health.body.success, true)

  const profile = await request('GET', '/api/auth/profile')
  assert.equal(profile.statusCode, 401)
  assert.match(profile.body.message, /token/i)

  const dashboard = await request('GET', '/api/dashboard/admin')
  assert.equal(dashboard.statusCode, 401)
  assert.match(dashboard.body.message, /token/i)
})

test('production login does not fall back to demo credentials when DB is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('db unavailable')
  }

  const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })

  assert.equal(res.statusCode, 503)
  assert.equal(res.body.success, false)
})

test('public registration cannot self-select a privileged role', async () => {
  let insertedRole
  pool.query = async (_sql, params) => {
    insertedRole = params[5]
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
    username: 'attacker',
    email: 'attacker@example.test',
    password: 'password123',
    full_name: 'Attacker',
    role: 'admin',
  })

  assert.equal(res.statusCode, 201)
  assert.equal(insertedRole, 'client')
  assert.equal(res.body.data.user.role, 'client')
})
