const FALLBACK_JWT_SECRET = 'devexpress_fallback_secret'

const isProduction = () => process.env.NODE_ENV === 'production'

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (!isProduction()) return FALLBACK_JWT_SECRET
  throw new Error('JWT_SECRET is required in production')
}

const isDemoModeAllowed = () => !isProduction() && process.env.ALLOW_DEMO_MODE !== 'false'

module.exports = {
  getJwtSecret,
  isDemoModeAllowed,
}
