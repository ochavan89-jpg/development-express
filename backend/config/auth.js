const FALLBACK_JWT_SECRET = 'devexpress_fallback_secret'

const isDemoAuthEnabled = () =>
  process.env.ALLOW_DEMO_AUTH === 'true' || process.env.NODE_ENV !== 'production'

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (isDemoAuthEnabled()) return FALLBACK_JWT_SECRET

  const err = new Error('JWT_SECRET is required')
  err.code = 'JWT_SECRET_MISSING'
  throw err
}

module.exports = { getJwtSecret, isDemoAuthEnabled }
