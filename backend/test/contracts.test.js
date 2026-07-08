const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

process.env.NODE_ENV = 'test'

const app = require('../server')
const { pool } = require('../config/db')

const originalQuery = pool.query.bind(pool)
const originalEnv = { ...process.env }

const request = (method, path, { body, token } = {}) =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body ? JSON.stringify(body) : undefined
      const options = {
        method,
        port: server.address().port,
        path,
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      }

      const req = http.request(options, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          server.close()
          const text = Buffer.concat(chunks).toString()
          resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null })
        })
      })

      req.on('error', (err) => {
        server.close()
        reject(err)
      })

      if (payload) req.write(payload)
      req.end()
    })
  })

test.afterEach(() => {
  pool.query = originalQuery
  process.env = { ...originalEnv }
})

test.after(async () => {
  await pool.end()
})

test('auth and protected API routes are mounted and accept fallback JWT secret in demo mode', async () => {
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const login = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(login.status, 200)
  assert.equal(login.body.success, true)
  assert.ok(login.body.data.token)

  const machines = await request('GET', '/api/machines', { token: login.body.data.token })

  assert.equal(machines.status, 200)
  assert.equal(machines.body.success, true)
  assert.ok(Array.isArray(machines.body.data))
})

test('public registration always creates a client account', async () => {
  let insertedRole
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    insertedRole = params[5]
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

  const response = await request('POST', '/api/auth/register', {
    body: {
      username: 'mallory',
      email: 'mallory@example.com',
      password: 'secret123',
      full_name: 'Mallory Example',
      role: 'admin',
    },
  })

  assert.equal(response.status, 201)
  assert.equal(insertedRole, 'client')
  assert.equal(response.body.data.user.role, 'client')
})

test('production login fails closed when the database is unavailable', async () => {
  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const response = await request('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin123' },
  })

  assert.equal(response.status, 503)
})

test('production token auth fails closed instead of trusting payload when DB lookup fails', async () => {
  process.env.NODE_ENV = 'production'
  const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' },
    process.env.JWT_SECRET || 'devexpress_fallback_secret',
  )
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const response = await request('GET', '/api/auth/profile', { token })

  assert.equal(response.status, 503)
})

test('machine owners cannot update machines they do not own', async () => {
  const token = jwt.sign(
    { id: 2, username: 'owner', role: 'owner', full_name: 'Owner', email: 'owner@example.com' },
    process.env.JWT_SECRET || 'devexpress_fallback_secret',
  )
  let updateSql
  let updateParams

  pool.query = async (sql, params) => {
    if (/FROM de_users WHERE id/.test(sql)) {
      return { rows: [{ id: 2, username: 'owner', email: 'owner@example.com', role: 'owner', full_name: 'Owner', is_active: true }] }
    }

    updateSql = sql
    updateParams = params
    return { rows: [] }
  }

  const response = await request('PUT', '/api/machines/99', {
    token,
    body: { status: 'maintenance' },
  })

  assert.equal(response.status, 404)
  assert.match(updateSql, /owner_id=\$3/)
  assert.deepEqual(updateParams, ['maintenance', '99', 2])
})
