const assert = require('node:assert/strict')
const test = require('node:test')
const { app } = require('../server')
const { pool } = require('../config/db')

const request = async (method, path, body) => {
  const server = app.listen(0)
  try {
    const { port } = server.address()
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

test('serves the API health route', async () => {
  const response = await request('GET', '/api/health')

  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.equal(response.body.app, 'Development Express API')
})

test('mounts auth routes under /api/auth', async (t) => {
  const originalQuery = pool.query
  t.after(() => {
    pool.query = originalQuery
  })

  pool.query = async () => {
    throw new Error('database unavailable')
  }

  const response = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  })

  assert.equal(response.status, 200)
  assert.equal(response.body.success, true)
  assert.ok(response.body.data.token)
})

test('public registration always creates client users', async (t) => {
  const originalQuery = pool.query
  t.after(() => {
    pool.query = originalQuery
  })

  let insertParams
  pool.query = async (sql, params) => {
    assert.match(sql, /INSERT INTO de_users/)
    insertParams = params
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

  const response = await request('POST', '/api/auth/register', {
    username: 'attacker',
    email: 'attacker@example.com',
    password: 'secret123',
    full_name: 'Privilege Attempt',
    role: 'admin',
  })

  assert.equal(response.status, 201)
  assert.equal(insertParams[5], 'client')
  assert.equal(response.body.data.user.role, 'client')
})
