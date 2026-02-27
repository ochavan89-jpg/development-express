const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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