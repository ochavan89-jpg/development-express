const http = require('http')
const jwt = require('jsonwebtoken')
const assert = require('assert')

process.env.NODE_ENV = 'production'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-secret'
process.env.PORT = '0'

const app = require('../server')
const { pool } = require('../config/db')

const request = (server, method, path, body, headers = {}) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null
  const req = http.request({
    hostname: '127.0.0.1',
    port: server.address().port,
    method,
    path,
    headers: {
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      } : {}),
      ...headers,
    },
  }, (res) => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      try { data = data ? JSON.parse(data) : null } catch {}
      resolve({ status: res.statusCode, data })
    })
  })

  req.on('error', reject)
  if (payload) req.write(payload)
  req.end()
})

async function run() {
  const server = app.listen(0)

  try {
    let res = await request(server, 'GET', '/api/health')
    assert.strictEqual(res.status, 200)

    res = await request(server, 'GET', '/api/machines')
    assert.strictEqual(res.status, 401, 'mounted protected routes should reject missing tokens, not 404')

    pool.query = async () => { throw new Error('db down') }
    res = await request(server, 'POST', '/api/auth/login', { username: 'admin', password: 'admin123' })
    assert.strictEqual(res.status, 503, 'production DB-down login must not issue demo admin tokens')

    const token = jwt.sign({ id: 123, username: 'admin', role: 'admin' }, process.env.JWT_SECRET)
    res = await request(server, 'GET', '/api/auth/profile', null, { authorization: `Bearer ${token}` })
    assert.strictEqual(res.status, 503, 'protected auth must fail closed when user lookup fails')

    let insertedRole
    pool.query = async (sql, params) => {
      assert.match(String(sql), /INSERT INTO de_users/)
      insertedRole = params[5]
      return {
        rows: [{
          id: 77,
          username: params[0],
          email: params[1],
          full_name: params[3],
          role: insertedRole,
        }],
      }
    }
    res = await request(server, 'POST', '/api/auth/register', {
      username: 'evil',
      email: 'evil@example.com',
      password: 'pw123456',
      full_name: 'Evil Admin',
      role: 'admin',
    })
    assert.strictEqual(res.status, 201)
    assert.strictEqual(insertedRole, 'client')
    assert.strictEqual(res.data.data.user.role, 'client')

    console.log('auth/routing smoke passed')
  } finally {
    server.close()
    await pool.end().catch(() => {})
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
