const assert = require('node:assert/strict')
const test = require('node:test')
const jwt = require('jsonwebtoken')
const { app } = require('../server')
const { pool, buildConnectionString, buildPoolConfig } = require('../config/db')

const request = (server, method, path, body, headers = {}) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null
  const req = require('node:http').request({
    hostname: '127.0.0.1',
    port: server.address().port,
    path,
    method,
    headers: {
      ...headers,
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      } : {}),
    },
  }, (res) => {
    let data = ''
    res.setEncoding('utf8')
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => {
      resolve({
        statusCode: res.statusCode,
        body: data ? JSON.parse(data) : null,
      })
    })
  })
  req.on('error', reject)
  if (payload) req.write(payload)
  req.end()
})

test('functional API routers are mounted under /api', async (t) => {
  const server = app.listen(0)
  t.after(() => server.close())

  const login = await request(server, 'POST', '/api/auth/login', {})
  assert.equal(login.statusCode, 400)
  assert.equal(login.body.success, false)

  const machines = await request(server, 'GET', '/api/machines')
  assert.equal(machines.statusCode, 401)
  assert.equal(machines.body.message, 'No token provided')
})

test('public registration cannot create privileged accounts', async (t) => {
  const server = app.listen(0)
  const originalQuery = pool.query
  let insertParams

  t.after(() => {
    pool.query = originalQuery
    server.close()
  })

  pool.query = async (sql, params) => {
    insertParams = params
    return {
      rows: [{
        id: 123,
        username: params[0],
        email: params[1],
        full_name: params[3],
        role: params[5],
      }],
    }
  }

  const res = await request(server, 'POST', '/api/auth/register', {
    username: 'attacker',
    email: 'attacker@example.com',
    password: 'secret123',
    full_name: 'Attacker',
    role: 'admin',
  })

  assert.equal(res.statusCode, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(res.body.data.user.role, 'client')
})

test('database config supports DB_* environment variables', () => {
  const env = {
    DB_HOST: 'db.internal',
    DB_PORT: '5432',
    DB_NAME: 'development express',
    DB_USER: 'de_user',
    DB_PASSWORD: 'p@ss word',
    NODE_ENV: 'production',
  }

  assert.equal(
    buildConnectionString(env),
    'postgresql://de_user:p%40ss%20word@db.internal:5432/development%20express'
  )
  assert.deepEqual(buildPoolConfig(env).ssl, { rejectUnauthorized: false })
})

test('production login fails closed when the database is unavailable', async (t) => {
  const server = app.listen(0)
  const originalQuery = pool.query
  const originalNodeEnv = process.env.NODE_ENV

  t.after(() => {
    pool.query = originalQuery
    process.env.NODE_ENV = originalNodeEnv
    server.close()
  })

  process.env.NODE_ENV = 'production'
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const res = await request(server, 'POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  })

  assert.equal(res.statusCode, 503)
  assert.equal(res.body.message, 'Authentication service unavailable')
})

test('clients cannot cancel another client booking', async (t) => {
  const server = app.listen(0)
  const originalQuery = pool.query
  let updateAttempted = false

  t.after(() => {
    pool.query = originalQuery
    server.close()
  })

  pool.query = async (sql) => {
    if (sql.includes('FROM de_users')) {
      return { rows: [{ id: 7, username: 'client-a', role: 'client', is_active: true }] }
    }
    if (sql.includes('FROM bookings')) {
      return { rows: [{ client_id: 8 }] }
    }
    if (sql.includes("UPDATE bookings SET status='cancelled'")) {
      updateAttempted = true
      return { rows: [] }
    }
    throw new Error(`Unexpected query: ${sql}`)
  }

  const token = jwt.sign(
    { id: 7, username: 'client-a', role: 'client', full_name: 'Client A', email: 'a@example.com' },
    'devexpress_fallback_secret'
  )

  const res = await request(server, 'PUT', '/api/bookings/99/cancel', null, {
    authorization: `Bearer ${token}`,
  })

  assert.equal(res.statusCode, 403)
  assert.equal(updateAttempted, false)
})
