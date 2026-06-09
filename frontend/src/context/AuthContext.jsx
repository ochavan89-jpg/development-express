import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const Ctx = createContext(null)
const TOKEN_KEY = 'de_token'
const LEGACY_TOKEN_KEY = 'token'

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
    const t = localStorage.getItem(TOKEN_KEY) || legacyToken
    if (legacyToken && !localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, legacyToken)
      localStorage.removeItem(LEGACY_TOKEN_KEY)
    }
    if (t) {
      api.defaults.headers.common['Authorization'] = `Bearer ${t}`
      api.get('/auth/profile')
        .then(r => setUser(r.data.data))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(LEGACY_TOKEN_KEY)
          delete api.defaults.headers.common['Authorization']
        })
        .finally(() => setLoading(false))
    } else { setLoading(false) }
  }, [])

  const login = async (username, password) => {
    const r = await api.post('/auth/login', { username, password })
    const { token, user: u } = r.data.data
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
