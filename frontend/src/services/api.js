import axios from "axios";

// ===============================
// 🔥 Base URL (Render production)
// ===============================
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://development-express-api.onrender.com/api";

// ===============================
// 🚀 Axios Instance
// ===============================
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// ===============================
// 🔐 Request Interceptor (token)
// ===============================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("de_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ===============================
// ⚠️ Response Interceptor (auto logout)
// ===============================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("de_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ===============================
// 🔐 Auth API
// ===============================
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  profile: () => api.get("/auth/profile"),
  register: (data) => api.post("/auth/register", data),
  changePassword: (data) => api.post("/auth/change-password", data),
};

// ===============================
// 📊 Dashboard API
// ===============================
export const dashboardAPI = {
  getAdmin: () => api.get("/dashboard/admin"),
  getOwner: () => api.get("/dashboard/owner"),
  getClient: () => api.get("/dashboard/client"),
  getOperator: () => api.get("/dashboard/operator"),
  getStats: () => api.get("/dashboard/admin"),
};

// ===============================
// 🚨 Alerts API
// ===============================
export const alertAPI = {
  getAll: (params) => api.get("/alerts", { params }),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
};

// ===============================
// ⚙️ Machines API
// ===============================
export const machinesAPI = {
  getAll: (params) => api.get("/machines", { params }),
  getById: (id) => api.get(`/machines/${id}`),
  create: (data) => api.post("/machines", data),
  update: (id, data) => api.put(`/machines/${id}`, data),
  delete: (id) => api.delete(`/machines/${id}`),
};

export const machineAPI = machinesAPI;

// ===============================
// 👥 Users API
// ===============================
export const usersAPI = {
  getAll: (params) => api.get("/users", { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const userAPI = usersAPI;

// ===============================
// 💰 Wallet API
// ===============================
export const walletAPI = {
  getBalance: () => api.get("/wallet/balance"),
  getTransactions: (params) => api.get("/wallet/transactions", { params }),
  recharge: (data) => api.post("/wallet/recharge", data),
  getAllBalances: () => api.get("/wallet/all-balances"),
};

export const bookingAPI = {
  getAll: (params) => api.get("/bookings", { params }),
  create: (data) => api.post("/bookings", data),
  complete: (id, data) => api.put(`/bookings/${id}/complete`, data),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
};

export const attendanceAPI = {
  getAll: (params) => api.get("/attendance", { params }),
  punchIn: (data) => api.post("/attendance/punch-in", data),
  punchOut: (id, data) => api.put(`/attendance/${id}/punch-out`, data),
};

export default api;