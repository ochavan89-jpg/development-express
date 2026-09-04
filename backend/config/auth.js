const DEV_JWT_SECRET = 'devexpress_fallback_secret'

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production')
  }
  return DEV_JWT_SECRET
}

const isProduction = () => process.env.NODE_ENV === 'production'

module.exports = { getJwtSecret, isProduction }
