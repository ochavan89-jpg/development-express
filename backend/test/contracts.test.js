process.env.NODE_ENV = 'test'
delete process.env.JWT_SECRET

const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

let server
let baseUrl
let originalQuery
let originalConnect

test.before(async () => {
  originalQuery = pool.query
  originalConnect = pool.connect
  server = http.createServer(app)
  await new Promise(resolve => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  pool.query = originalQuery
  pool.connect = originalConnect
  await new Promise(resolve => server.close(resolve))
})

test.afterEach(() => {
  process.env.NODE_ENV = 'test'
  delete process.env.JWT_SECRET
  pool.query = originalQuery
  pool.connect = originalConnect
})

async function request(method, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => null)
  return { status: response.status, body: json }
}

function authHeader(user) {
  const token = jwt.sign(user, 'devexpress_fallback_secret')
  return { authorization: `Bearer ${token}` }
}

test('auth routes are mounted and development demo login works when DB is unavailable', async () => {
  pool.query = async () => {
    throw new Error('db unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  })

  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
  assert.equal(res.body.data.user.role, 'admin')
  assert.ok(res.body.data.token)
})

test('production login fails closed instead of accepting demo credentials on DB failure', async () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'production-test-secret'
  pool.query = async () => {
    throw new Error('db unavailable')
  }

  const res = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  })

  assert.equal(res.status, 500)
  assert.equal(res.body.success, false)
})

test('public registration always creates client users even when role is supplied', async () => {
  let roleParam
  pool.query = async (sql, params) => {
    if (sql.includes('INSERT INTO de_users')) {
      roleParam = params[5]
      return {
        rows: [{
          id: 99,
          username: params[0],
          email: params[1],
          full_name: params[3],
          role: params[5],
        }],
      }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request('POST', '/api/auth/register', {
    username: 'evil',
    email: 'evil@example.com',
    password: 'password123',
    full_name: 'Evil User',
    role: 'admin',
  })

  assert.equal(res.status, 201)
  assert.equal(roleParam, 'client')
  assert.equal(res.body.data.user.role, 'client')
})

test('protected auth fails closed in production when DB cannot verify token user', async () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'production-test-secret'
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' },
    process.env.JWT_SECRET
  )
  pool.query = async () => {
    throw new Error('db unavailable')
  }

  const res = await request('GET', '/api/auth/profile', null, {
    authorization: `Bearer ${token}`,
  })

  assert.equal(res.status, 503)
  assert.equal(res.body.success, false)
})

test('public users cannot cancel another client booking', async () => {
  pool.query = async (sql) => {
    if (sql.includes('SELECT b.client_id')) {
      return { rows: [{ client_id: 7, operator_id: 8, owner_id: 9 }] }
    }
    throw new Error(`unexpected query: ${sql}`)
  }

  const res = await request('PUT', '/api/bookings/123/cancel', null, authHeader({
    id: 3,
    username: 'client',
    role: 'client',
    full_name: 'Client',
    email: 'client@example.com',
  }))

  assert.equal(res.status, 403)
  assert.equal(res.body.success, false)
})

test('booking completion rolls back and does not debit inactive bookings twice', async () => {
  const queries = []
  pool.query = async () => {
    throw new Error('db unavailable')
  }
  const client = {
    query: async (sql) => {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('SELECT b.*, u.wallet_balance')) {
        return {
          rows: [{
            id: 123,
            client_id: 7,
            operator_id: 8,
            status: 'completed',
            hourly_rate: 100,
            wallet_balance: 1000,
          }],
        }
      }
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }
  pool.connect = async () => client

  const res = await request('PUT', '/api/bookings/123/complete', {
    actual_hours: 2,
  }, authHeader({
    id: 8,
    username: 'operator',
    role: 'operator',
    full_name: 'Operator',
    email: 'operator@example.com',
  }))

  assert.equal(res.status, 409)
  assert.equal(res.body.success, false)
  assert.ok(queries.includes('ROLLBACK'))
  assert.equal(queries.some(sql => sql.includes('UPDATE de_users SET wallet_balance')), false)
})
