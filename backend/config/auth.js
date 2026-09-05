const DEV_JWT_SECRET = 'devexpress_fallback_secret'

const isProduction = () => process.env.NODE_ENV === 'production'

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (isProduction()) {
    throw new Error('JWT_SECRET must be configured in production')
  }
  return DEV_JWT_SECRET
}

module.exports = { getJwtSecret, isProduction }
