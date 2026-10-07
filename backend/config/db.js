const { Pool } = require('pg')

const ssl = process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: false }
  : false

const connectionConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'development_express',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    }

const pool = new Pool({
  ...connectionConfig,
  ssl,
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