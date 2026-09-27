const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')

const request = (server, method, path, { body, headers = {} } = {}) => {
  const payload = body ? JSON.stringify(body) : null
  const address = server.address()

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        ...headers,
        ...(payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {}),
      },
    }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
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

const withServer = async (fn) => {
  const server = app.listen(0)
  try {
    return await fn(server)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

const withEnv = async (env, fn) => {
  const previous = {}
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key]
    process.env[key] = env[key]
  }

  try {
    return await fn()
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test('mounts auth routes under /api', async () => {
  await withServer(async (server) => {
    const res = await request(server, 'GET', '/api/auth/profile')

    assert.equal(res.status, 401)
    assert.equal(res.body.success, false)
    assert.match(res.body.message, /token/i)
  })
})

test('production login does not fall back to demo credentials when DB auth fails', async () => {
  const originalQuery = pool.query
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  try {
    await withEnv({ NODE_ENV: 'production', JWT_SECRET: 'test-secret' }, async () => {
      await withServer(async (server) => {
        const res = await request(server, 'POST', '/api/auth/login', {
          body: { username: 'admin', password: 'admin123' },
        })

        assert.equal(res.status, 503)
        assert.equal(res.body.success, false)
        assert.equal(res.body.data, undefined)
      })
    })
  } finally {
    pool.query = originalQuery
  }
})

test('production protected routes reject token-payload fallback when DB lookup fails', async () => {
  const originalQuery = pool.query
  pool.query = async () => {
    throw new Error('database unavailable')
  }

  try {
    await withEnv({ NODE_ENV: 'production', JWT_SECRET: 'test-secret' }, async () => {
      await withServer(async (server) => {
        const token = jwt.sign(
          { id: 1, username: 'admin', role: 'admin', full_name: 'Admin', email: 'admin@example.com' },
          'test-secret'
        )
        const res = await request(server, 'GET', '/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        })

        assert.equal(res.status, 503)
        assert.equal(res.body.success, false)
      })
    })
  } finally {
    pool.query = originalQuery
  }
})

test('public registration always creates a client account', async () => {
  const originalQuery = pool.query
  let capturedParams

  pool.query = async (sql, params) => {
    capturedParams = params
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

  try {
    await withEnv({ NODE_ENV: 'production', JWT_SECRET: 'test-secret' }, async () => {
      await withServer(async (server) => {
        const res = await request(server, 'POST', '/api/auth/register', {
          body: {
            username: 'new-admin',
            email: 'admin@example.com',
            password: 'password123',
            full_name: 'New Admin',
            role: 'admin',
          },
        })

        assert.equal(res.status, 201)
        assert.equal(capturedParams[5], 'client')
        assert.equal(res.body.data.user.role, 'client')
      })
    })
  } finally {
    pool.query = originalQuery
  }
})
