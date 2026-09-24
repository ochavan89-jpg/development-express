process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
process.env.BCRYPT_SALT_ROUNDS = '1'

const { after, before, test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const app = require('./server')
const { pool } = require('./config/db')

let server
let baseUrl

const request = (method, path, body) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null
  const req = http.request(`${baseUrl}${path}`, {
    method,
    headers: payload
      ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
      : undefined,
  }, (res) => {
    let raw = ''
    res.setEncoding('utf8')
    res.on('data', chunk => { raw += chunk })
    res.on('end', () => {
      const data = raw ? JSON.parse(raw) : null
      resolve({ status: res.statusCode, data })
    })
  })
  req.on('error', reject)
  if (payload) req.write(payload)
  req.end()
})

before(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    const { port } = server.address()
    baseUrl = `http://127.0.0.1:${port}`
    resolve()
  })
}))

after(() => new Promise((resolve) => {
  server.close(resolve)
}))

after(async () => {
  await pool.end()
})

test('health endpoint is mounted under /api', async () => {
  const res = await request('GET', '/api/health')

  assert.equal(res.status, 200)
  assert.equal(res.data.app, 'Development Express API')
})

test('protected API routers are mounted instead of falling through to 404', async () => {
  const res = await request('GET', '/api/machines')

  assert.equal(res.status, 401)
  assert.equal(res.data.message, 'No token provided')
})

test('public registration always creates a client account', async () => {
  const originalQuery = pool.query
  let insertParams

  pool.query = async (_sql, params) => {
    insertParams = params
    return {
      rows: [{
        id: 101,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  try {
    const res = await request('POST', '/api/auth/register', {
      username: 'attacker',
      email: 'attacker@example.test',
      password: 'password123',
      full_name: 'Attacker',
      role: 'admin',
    })

    assert.equal(res.status, 201)
    assert.equal(insertParams[5], 'client')
    assert.equal(res.data.data.user.role, 'client')
  } finally {
    pool.query = originalQuery
  }
})

test('production login does not fall back to demo users when the database fails', async () => {
  const originalQuery = pool.query
  const originalNodeEnv = process.env.NODE_ENV

  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  try {
    const res = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    })

    assert.equal(res.status, 503)
    assert.equal(res.data.message, 'Authentication service unavailable')
  } finally {
    process.env.NODE_ENV = originalNodeEnv
    pool.query = originalQuery
  }
})
