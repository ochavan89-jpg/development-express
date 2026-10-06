import axios from 'axios'

const normalizeApiBaseUrl = (rawBaseUrl) => {
  const baseUrl = (rawBaseUrl || 'https://development-express-api.onrender.com/api').replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(baseUrl)) return baseUrl

  try {
    const url = new URL(baseUrl)
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/api'
      return url.toString().replace(/\/+$/, '')
    }
  } catch {
    return baseUrl
  }

  return baseUrl
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_URL),
  timeout: 30000,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('de_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('de_token')
      delete api.defaults.headers.common.Authorization
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  profile: () => api.get('/auth/profile'),
  register: (data) => api.post('/auth/register', data),
  changePassword: (data) => api.post('/auth/change-password', data),
}

export const dashboardAPI = {
  getAdmin: () => api.get('/dashboard/admin'),
  getOwner: () => api.get('/dashboard/owner'),
  getClient: () => api.get('/dashboard/client'),
  getOperator: () => api.get('/dashboard/operator'),
  getStats: () => api.get('/dashboard/admin'),
}

export const alertAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
}

export const machinesAPI = {
  getAll: (params) => api.get('/machines', { params }),
  getById: (id) => api.get(`/machines/${id}`),
  create: (data) => api.post('/machines', data),
  update: (id, data) => api.put(`/machines/${id}`, data),
  delete: (id) => api.delete(`/machines/${id}`),
}

export const bookingsAPI = {
  getAll: (params) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  complete: (id, data) => api.put(`/bookings/${id}/complete`, data),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
}

export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
  getTransactions: (params) => api.get('/wallet/transactions', { params }),
  recharge: (data) => api.post('/wallet/recharge', data),
  getAllBalances: () => api.get('/wallet/all-balances'),
  getAll: () => api.get('/wallet/balance'),
}

export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
}

export const attendanceAPI = {
  punchIn: (data) => api.post('/attendance/punch-in', data),
  punchOut: (id, data) => api.put(`/attendance/${id}/punch-out`, data),
  getAll: (params) => api.get('/attendance', { params }),
}

export const machineAPI = machinesAPI
export const bookingAPI = bookingsAPI
export const userAPI = usersAPI

export default api