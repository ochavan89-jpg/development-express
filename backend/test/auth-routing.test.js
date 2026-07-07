const { test, before, after, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

const JWT_SECRET = process.env.JWT_SECRET || 'devexpress_fallback_secret'
const originalQuery = pool.query
const originalNodeEnv = process.env.NODE_ENV

let server
let baseURL

before(async () => {
  server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  baseURL = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise(resolve => server.close(resolve))
})

afterEach(() => {
  pool.query = originalQuery
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
})

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body)
    const url = new URL(path, baseURL)
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, res => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { raw += chunk })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: raw ? JSON.parse(raw) : null,
        })
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function mockAuthenticatedUser(user) {
  pool.query = async (sql, params) => {
    if (sql.includes('FROM de_users WHERE id = $1')) {
      assert.equal(params[0], user.id)
      return { rows: [{ ...user, is_active: true }] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  }
}

test('mounted auth routes allow demo login and profile when not in production', async () => {
  process.env.NODE_ENV = 'test'
  pool.query = async () => { throw new Error('database unavailable') }

  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })

  assert.equal(login.status, 200)
  assert.equal(login.body.success, true)
  assert.ok(login.body.data.token)

  const profile = await request('GET', '/api/auth/profile', undefined, login.body.data.token)
  assert.equal(profile.status, 200)
  assert.equal(profile.body.data.role, 'admin')
})

test('production login fails closed instead of issuing demo admin token on DB errors', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => { throw new Error('database unavailable') }

  const response = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })

  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
})

test('production protected routes do not trust JWT payload when DB lookup fails', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => { throw new Error('database unavailable') }
  const token = tokenFor({ id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' })

  const response = await request('GET', '/api/auth/profile', undefined, token)

  assert.equal(response.status, 503)
  assert.equal(response.body.success, false)
})

test('public registration always creates client users', async () => {
  process.env.NODE_ENV = 'test'
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

  const response = await request('POST', '/api/auth/register', {
    username: 'evil-admin',
    email: 'evil@example.com',
    password: 'secret123',
    full_name: 'Evil Admin',
    role: 'admin',
  })

  assert.equal(response.status, 201)
  assert.equal(response.body.data.user.role, 'client')
  assert.equal(jwt.decode(response.body.data.token).role, 'client')
})

test('clients cannot cancel bookings they do not own', async () => {
  process.env.NODE_ENV = 'test'
  const user = { id: 3, username: 'client', role: 'client', full_name: 'Client', email: 'client@example.com' }
  const token = tokenFor(user)
  pool.query = async (sql, params) => {
    if (sql.includes('FROM de_users WHERE id = $1')) {
      return { rows: [{ ...user, is_active: true }] }
    }
    if (sql.includes('FROM bookings b')) {
      assert.equal(params[0], '99')
      return { rows: [{ client_id: 999, owner_id: 2 }] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  }

  const response = await request('PUT', '/api/bookings/99/cancel', undefined, token)

  assert.equal(response.status, 403)
  assert.equal(response.body.success, false)
})

test('owners cannot update machines owned by someone else', async () => {
  process.env.NODE_ENV = 'test'
  const user = { id: 2, username: 'owner', role: 'owner', full_name: 'Owner', email: 'owner@example.com' }
  const token = tokenFor(user)
  pool.query = async (sql, params) => {
    if (sql.includes('FROM de_users WHERE id = $1')) {
      return { rows: [{ ...user, is_active: true }] }
    }
    if (sql.includes('SELECT owner_id FROM machines')) {
      assert.equal(params[0], '7')
      return { rows: [{ owner_id: 999 }] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  }

  const response = await request('PUT', '/api/machines/7', { status: 'maintenance' }, token)

  assert.equal(response.status, 403)
  assert.equal(response.body.success, false)
})
