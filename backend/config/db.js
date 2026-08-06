const { Pool } = require('pg')

const buildConnectionString = (env = process.env) => {
  if (env.DATABASE_URL) return env.DATABASE_URL
  if (!env.DB_HOST) return undefined

  const user = encodeURIComponent(env.DB_USER || '')
  const password = encodeURIComponent(env.DB_PASSWORD || '')
  const auth = user ? `${user}${password ? `:${password}` : ''}@` : ''
  const port = env.DB_PORT ? `:${env.DB_PORT}` : ''
  const database = encodeURIComponent(env.DB_NAME || '')

  return `postgresql://${auth}${env.DB_HOST}${port}/${database}`
}

const buildPoolConfig = (env = process.env) => ({
  connectionString: buildConnectionString(env),
  ssl: env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

const pool = new Pool(buildPoolConfig())

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message)
})

const testConnection = async () => {
  try {
    const client = await pool.connect()
    const res = await client.query('SELECT NOW()')
    client.release()
    console.log('✅ Database connected:', res.rows[0].now)
    return true
  } catch (err) {
    console.error('❌ Database connection failed:', err.message)
    console.log('⚠️ Running without database (demo mode)')
    return false
  }
}

module.exports = { pool, testConnection, buildConnectionString, buildPoolConfig }