import axios from 'axios'
import toast from 'react-hot-toast'

const DEFAULT_API_URL = 'https://development-express-api.onrender.com/api'

const normalizeBaseURL = (url) => {
  const raw = (url || DEFAULT_API_URL).replace(/\/+$/, '')
  return raw.endsWith('/api') ? raw : `${raw}/api`
}

const api = axios.create({
  baseURL: normalizeBaseURL(import.meta.env.VITE_API_URL),
  timeout: 30000,
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('de_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('de_token')
    delete api.defaults.headers.common.Authorization
    if (window.location.pathname !== '/login') window.location.href = '/login'
  } else {
    const msg = err.response?.data?.message || 'Server error'
    if (err.response?.status !== 404) toast.error(msg)
  }
  return Promise.reject(err)
})

export const authAPI = {
  login:          d => api.post('/auth/login', d),
  profile:        () => api.get('/auth/profile'),
  register:       d => api.post('/auth/register', d),
  changePassword: d => api.post('/auth/change-password', d),
}

export const machineAPI = {
  getAll:  p => api.get('/machines', { params: p }),
  getById: id => api.get(`/machines/${id}`),
  create:  d => api.post('/machines', d),
  update:  (id, d) => api.put(`/machines/${id}`, d),
  delete:  id => api.delete(`/machines/${id}`),
}

export const machinesAPI = machineAPI

export const bookingAPI = {
  getAll:   p => api.get('/bookings', { params: p }),
  getById:  id => api.get(`/bookings/${id}`),
  create:   d => api.post('/bookings', d),
  complete: (id, d) => api.put(`/bookings/${id}/complete`, d),
  cancel:   id => api.put(`/bookings/${id}/cancel`),
}

export const walletAPI = {
  getBalance:      () => api.get('/wallet/balance'),
  getTransactions: p => api.get('/wallet/transactions', { params: p }),
  recharge:        d => api.post('/wallet/recharge', d),
  getAllBalances:  () => api.get('/wallet/all-balances'),
}

export const dashboardAPI = {
  getAdmin:    () => api.get('/dashboard/admin'),
  getOwner:    () => api.get('/dashboard/owner'),
  getClient:   () => api.get('/dashboard/client'),
  getOperator: () => api.get('/dashboard/operator'),
  getStats:    () => api.get('/dashboard/admin'),
}

export const alertAPI = {
  getAll:   p => api.get('/alerts', { params: p }),
  markRead: id => api.put(`/alerts/${id}/read`),
  resolve:  id => api.put(`/alerts/${id}/resolve`),
}

export const userAPI = {
  getAll:  p => api.get('/users', { params: p }),
  getById: id => api.get(`/users/${id}`),
  update:  (id, d) => api.put(`/users/${id}`, d),
  delete:  id => api.delete(`/users/${id}`),
}

export const usersAPI = userAPI

export const attendanceAPI = {
  punchIn:  d => api.post('/attendance/punch-in', d),
  punchOut: (id, d) => api.put(`/attendance/${id}/punch-out`, d),
  getAll:   p => api.get('/attendance', { params: p }),
}

export default api