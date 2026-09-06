const { Pool } = require('pg')

const poolConfig = {
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
}

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL
} else {
  poolConfig.host = process.env.DB_HOST
  poolConfig.port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined
  poolConfig.database = process.env.DB_NAME
  poolConfig.user = process.env.DB_USER
  poolConfig.password = process.env.DB_PASSWORD
}

const pool = new Pool(poolConfig)

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