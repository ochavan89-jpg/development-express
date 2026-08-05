const assert = require('node:assert/strict')
const test = require('node:test')
const { app } = require('../server')
const { pool } = require('../config/db')

const request = (server, method, path, body) => new Promise((resolve, reject) => {
  const payload = body ? JSON.stringify(body) : null
  const req = require('node:http').request({
    hostname: '127.0.0.1',
    port: server.address().port,
    path,
    method,
    headers: payload ? {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    } : {},
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
