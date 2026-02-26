import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('de_token')
    if (t) {
      api.defaults.headers.common['Authorization'] = `Bearer ${t}`
      api.get('/auth/profile')
        .then(r => setUser(r.data.data))
        .catch(() => { localStorage.removeItem('de_token'); delete api.defaults.headers.common['Authorization'] })
        .finally(() => setLoading(false))
    } else { setLoading(false) }
  }, [])

  const login = async (username, password) => {
    const r = await api.post('/auth/login', { username, password })
    const { token, user: u } = r.data.data
    localStorage.setItem('de_token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem('de_token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
