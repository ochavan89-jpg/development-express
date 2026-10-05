const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'test_secret'

const app = require('../server')

const request = (server, method, path, body, token) => {
  const { port } = server.address()
  const payload = body ? JSON.stringify(body) : null

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
}

test('mounts auth routes and verifies issued tokens', async (t) => {
  const server = app.listen(0)
  t.after(() => new Promise((resolve) => server.close(resolve)))

  const login = await request(server, 'POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  })

  assert.equal(login.statusCode, 200)
  assert.equal(login.body.success, true)
  assert.equal(login.body.data.user.role, 'admin')
  assert.ok(login.body.data.token)

  const profile = await request(server, 'GET', '/api/auth/profile', null, login.body.data.token)

  assert.equal(profile.statusCode, 200)
  assert.equal(profile.body.success, true)
  assert.equal(profile.body.data.role, 'admin')
})
