const { Pool } = require('pg')

const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    }

const pool = new Pool({
  ...dbConfig,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

const testConnection = async () => {
  try {
    const client = await pool.connect()
    const res = await client.query('SELECT NOW()')
    client.release()
    console.log('Database connected:', res.rows[0].now)
    return true
  } catch (err) {
    console.error('Database connection failed:', err.message)
    console.log('Running without database (demo mode)')
    return false
  }
}

module.exports = { pool, testConnection }