const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')

process.env.NODE_ENV = 'test'

const { app, server } = require('../server')
const { pool } = require('../config/db')

let baseUrl

before(async () => {
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await pool.end()
})

test('mounts auth routes under /api/auth', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })

  assert.equal(response.status, 400)
  assert.match(await response.text(), /Username and password required/)
})

test('returns json 404 for unknown API routes', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-real-route`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.success, false)
})

test('public registration rejects privileged roles before writing', async () => {
  const originalQuery = pool.query
  pool.query = async () => {
    throw new Error('registration should not write privileged roles')
  }

  try {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'attacker',
        email: 'attacker@example.com',
        password: 'password123',
        full_name: 'Attacker',
        role: 'admin',
      }),
    })
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.equal(body.success, false)
    assert.match(body.message, /Invalid registration role/)
  } finally {
    pool.query = originalQuery
  }
})
