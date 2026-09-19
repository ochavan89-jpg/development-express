const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'

const { app } = require('../server')

const request = (path, options = {}) => new Promise((resolve, reject) => {
  const server = http.createServer(app)
  server.listen(0, async () => {
    try {
      const { port } = server.address()
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
        ...options,
      })
      const data = await response.json().catch(() => null)
      server.close(() => resolve({ status: response.status, data }))
    } catch (err) {
      server.close(() => reject(err))
    }
  })
})

test('health endpoint is mounted', async () => {
  const response = await request('/api/health')

  assert.equal(response.status, 200)
  assert.equal(response.data.success, true)
})

test('auth login route is mounted', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({}),
  })

  assert.equal(response.status, 400)
  assert.equal(response.data.message, 'Username and password required')
})

test('dashboard route is mounted behind auth middleware', async () => {
  const response = await request('/api/dashboard/admin')

  assert.equal(response.status, 401)
  assert.equal(response.data.message, 'No token provided')
})
