const { Pool } = require('pg')

const usingConnectionString = Boolean(process.env.DATABASE_URL)
const sslEnabled = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production'

const pool = new Pool({
  ...(usingConnectionString
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'devexpress',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }),
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
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