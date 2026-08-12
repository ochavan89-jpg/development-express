import { createContext, useContext, useState, useEffect } from 'react'
import api, { authAPI, TOKEN_KEY } from '../services/api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (t) {
      api.defaults.headers.common['Authorization'] = `Bearer ${t}`
      authAPI.profile()
        .then(r => setUser(r.data.data))
        .catch(() => { localStorage.removeItem(TOKEN_KEY); delete api.defaults.headers.common['Authorization'] })
        .finally(() => setLoading(false))
    } else { setLoading(false) }
  }, [])

  const login = async (username, password) => {
    const r = await authAPI.login({ username, password })
    const { token, user: u } = r.data.data
    localStorage.setItem(TOKEN_KEY, token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
