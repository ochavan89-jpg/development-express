const jwt = require('jsonwebtoken')
const { pool } = require('../config/db')

const DEMO_JWT_SECRET = 'devexpress_fallback_secret'
const isDemoMode = () => process.env.ENABLE_DEMO_MODE === 'true'
const getJwtSecret = () => process.env.JWT_SECRET || (isDemoMode() ? DEMO_JWT_SECRET : null)

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' })
    }
    const token = auth.split(' ')[1]
    const secret = getJwtSecret()
    if (!secret) {
      return res.status(500).json({ success: false, message: 'JWT secret is not configured' })
    }
    const decoded = jwt.verify(token, secret)

    const { rows } = await pool.query(
      'SELECT id, username, email, role, full_name, phone, is_active FROM de_users WHERE id = $1',
      [decoded.id]
    )
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' })
    }
    req.user = rows[0]
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' })
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: `Access denied. Required roles: ${roles.join(', ')}` })
  }
  next()
}

module.exports = { protect, authorize, getJwtSecret, isDemoMode }
