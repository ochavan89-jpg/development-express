const { Pool } = require('pg')

const buildConnectionString = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const host = process.env.DB_HOST
  const database = process.env.DB_NAME || process.env.DB_DATABASE
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const port = process.env.DB_PORT || '5432'

  if (!host || !database || !user) return undefined

  const auth = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user)

  return `postgres://${auth}@${host}:${port}/${database}`
}

const pool = new Pool({
  connectionString: buildConnectionString(),
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

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

module.exports = { pool, testConnection }