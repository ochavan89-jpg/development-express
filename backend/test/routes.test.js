const assert = require('node:assert/strict')
const { after, before, describe, it } = require('node:test')
const { server } = require('../server')

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
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

describe('API route mounting', () => {
  it('serves health checks under /api', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.app, 'Development Express API')
  })

  it('mounts auth routes instead of returning the catch-all 404', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.equal(body.message, 'Username and password required')
  })

  it('mounts protected business routes instead of returning the catch-all 404', async () => {
    const response = await fetch(`${baseUrl}/api/machines`)
    const body = await response.json()

    assert.equal(response.status, 401)
    assert.equal(body.message, 'No token provided')
  })
})
