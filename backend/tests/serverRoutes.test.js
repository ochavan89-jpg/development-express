const assert = require('node:assert/strict')
const test = require('node:test')
const app = require('../server')

const mountedRouters = () => (
  app._router.stack
    .filter((layer) => layer.name === 'router')
    .map((layer) => String(layer.regexp))
)

test('server mounts all business API routers', () => {
  const mounted = mountedRouters()
  const expected = [
    '/api/auth',
    '/api/machines',
    '/api/bookings',
    '/api/wallet',
    '/api/dashboard',
    '/api/alerts',
    '/api/users',
    '/api/attendance',
  ]

  for (const route of expected) {
    const escaped = route.replaceAll('/', '\\/')
    assert.ok(
      mounted.some((pattern) => pattern.includes(escaped)),
      `expected ${route} router to be mounted`
    )
  }
})

test('server can be imported without starting a listener', () => {
  assert.equal(typeof app.listen, 'function')
})
