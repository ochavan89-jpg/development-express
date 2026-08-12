const test = require('node:test')
const assert = require('node:assert/strict')

const DB_ENV_KEYS = ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'NODE_ENV']

function withDbEnv(env, fn) {
  const previous = Object.fromEntries(DB_ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of DB_ENV_KEYS) delete process.env[key]
  Object.assign(process.env, env)

  try {
    return fn()
  } finally {
    for (const key of DB_ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function loadDbConfig(env) {
  return withDbEnv(env, () => {
    let options
    const pgPath = require.resolve('pg')
    const dbPath = require.resolve('../config/db')

    delete require.cache[pgPath]
    delete require.cache[dbPath]

    require.cache[pgPath] = {
      id: pgPath,
      filename: pgPath,
      loaded: true,
      exports: {
        Pool: class FakePool {
          constructor(opts) {
            options = opts
          }

          on() {}
        },
      },
    }

    require('../config/db')

    delete require.cache[dbPath]
    delete require.cache[pgPath]

    return options
  })
}

test('database config prefers DATABASE_URL when provided', () => {
  const options = loadDbConfig({
    DATABASE_URL: 'postgresql://url-user:url-pass@db.example.com:5432/app',
    DB_HOST: 'ignored-db.example.com',
    NODE_ENV: 'production',
  })

  assert.equal(options.connectionString, 'postgresql://url-user:url-pass@db.example.com:5432/app')
  assert.equal(options.host, undefined)
  assert.deepEqual(options.ssl, { rejectUnauthorized: false })
})

test('database config falls back to documented DB_* variables', () => {
  const options = loadDbConfig({
    DB_HOST: 'db.example.com',
    DB_PORT: '6543',
    DB_NAME: 'postgres',
    DB_USER: 'postgres',
    DB_PASSWORD: 'secret',
    NODE_ENV: 'development',
  })

  assert.equal(options.connectionString, undefined)
  assert.equal(options.host, 'db.example.com')
  assert.equal(options.port, 6543)
  assert.equal(options.database, 'postgres')
  assert.equal(options.user, 'postgres')
  assert.equal(options.password, 'secret')
  assert.equal(options.ssl, false)
})
