const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const jwt = require('jsonwebtoken')

const app = require('../server')
const { pool } = require('../config/db')
const { getJwtSecret } = require('../middleware/auth')

let server

test.before(() => {
  server = app.listen(0)
})

test.after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await pool.end().catch(() => {})
})

function makeToken(user = {}) {
  return jwt.sign(
    {
      id: user.id || 1,
      username: user.username || 'admin',
      role: user.role || 'admin',
      full_name: user.full_name || 'Admin User',
      email: user.email || 'admin@example.com',
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  )
}

function request(method, path, { body, headers = {} } = {}) {
  const payload = body ? JSON.stringify(body) : undefined
  const { port } = server.address()

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        port,
        path,
        host: '127.0.0.1',
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          let data = raw
          try { data = raw ? JSON.parse(raw) : undefined } catch {}
          resolve({ status: res.statusCode, data })
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function withEnv(env, fn) {
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

async function withPoolStubs(stubs, fn) {
  const originalQuery = pool.query
  const originalConnect = pool.connect
  if (stubs.query) pool.query = stubs.query
  if (stubs.connect) pool.connect = stubs.connect
  try {
    return await fn()
  } finally {
    pool.query = originalQuery
    pool.connect = originalConnect
  }
}

test('auth routes are mounted and local demo login is reachable', async () => {
  await withEnv({ NODE_ENV: 'development' }, async () => {
    await withPoolStubs(
      { query: async () => { throw new Error('database unavailable') } },
      async () => {
        const res = await request('POST', '/api/auth/login', {
          body: { username: 'admin', password: 'admin123' },
        })

        assert.equal(res.status, 200)
        assert.equal(res.data.success, true)
        assert.ok(res.data.data.token)
      }
    )
  })
})

test('production login fails closed when the database is unavailable', async () => {
  await withEnv({ NODE_ENV: 'production' }, async () => {
    await withPoolStubs(
      { query: async () => { throw new Error('database unavailable') } },
      async () => {
        const res = await request('POST', '/api/auth/login', {
          body: { username: 'admin', password: 'admin123' },
        })

        assert.equal(res.status, 503)
        assert.equal(res.data.success, false)
      }
    )
  })
})

test('production protected routes do not trust token payloads when user lookup fails', async () => {
  await withEnv({ NODE_ENV: 'production' }, async () => {
    await withPoolStubs(
      { query: async () => { throw new Error('database unavailable') } },
      async () => {
        const res = await request('GET', '/api/auth/profile', {
          headers: { authorization: `Bearer ${makeToken({ role: 'admin' })}` },
        })

        assert.equal(res.status, 503)
        assert.equal(res.data.success, false)
      }
    )
  })
})

test('public registration always creates client accounts', async () => {
  let insertedRole
  await withPoolStubs(
    {
      query: async (sql, params) => {
        assert.match(sql, /INSERT INTO de_users/)
        insertedRole = params[5]
        return {
          rows: [{
            id: 42,
            username: params[0],
            email: params[1],
            full_name: params[3],
            role: params[5],
          }],
        }
      },
    },
    async () => {
      const res = await request('POST', '/api/auth/register', {
        body: {
          username: 'evil',
          email: 'evil@example.com',
          password: 'secret123',
          full_name: 'Evil User',
          role: 'admin',
        },
      })

      assert.equal(res.status, 201)
      assert.equal(insertedRole, 'client')
      assert.equal(res.data.data.user.role, 'client')
    }
  )
})

test('clients cannot cancel another client booking', async () => {
  const calls = []
  await withPoolStubs(
    {
      query: async (sql) => {
        calls.push(sql)
        if (/FROM de_users WHERE id/.test(sql)) {
          return { rows: [{ id: 10, username: 'client-a', email: 'a@example.com', role: 'client', full_name: 'Client A', is_active: true }] }
        }
        if (/FROM bookings b/.test(sql)) {
          return { rows: [{ client_id: 11, owner_id: 2, status: 'active' }] }
        }
        throw new Error(`unexpected query: ${sql}`)
      },
    },
    async () => {
      const res = await request('PUT', '/api/bookings/99/cancel', {
        headers: { authorization: `Bearer ${makeToken({ id: 10, role: 'client' })}` },
      })

      assert.equal(res.status, 403)
      assert.equal(calls.some((sql) => /UPDATE bookings SET status='cancelled'/.test(sql)), false)
    }
  )
})

test('completed bookings cannot be completed and debited again', async () => {
  let debited = false
  const client = {
    query: async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (/FROM bookings b/.test(sql)) {
        return {
          rows: [{
            id: 5,
            client_id: 3,
            operator_id: 4,
            status: 'completed',
            hourly_rate: 1000,
            wallet_balance: 100000,
          }],
        }
      }
      if (/UPDATE de_users/.test(sql)) debited = true
      throw new Error(`unexpected query: ${sql}`)
    },
    release: () => {},
  }

  await withPoolStubs(
    {
      query: async (sql) => {
        if (/FROM de_users WHERE id/.test(sql)) {
          return { rows: [{ id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', full_name: 'Admin', is_active: true }] }
        }
        throw new Error(`unexpected query: ${sql}`)
      },
      connect: async () => client,
    },
    async () => {
      const res = await request('PUT', '/api/bookings/5/complete', {
        headers: { authorization: `Bearer ${makeToken({ id: 1, role: 'admin' })}` },
        body: { actual_hours: 3 },
      })

      assert.equal(res.status, 409)
      assert.equal(debited, false)
    }
  )
})
