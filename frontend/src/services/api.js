import axios from "axios";

// ===============================
// 🔥 Base URL (Render production)
// ===============================
const TOKEN_KEY = "de_token";
const rawApiBaseUrl =
  import.meta.env.VITE_API_URL ||
  "https://development-express-api.onrender.com/api";
const trimmedApiBaseUrl = rawApiBaseUrl.replace(/\/+$/, "");
const API_BASE_URL = trimmedApiBaseUrl.endsWith("/api")
  ? trimmedApiBaseUrl
  : `${trimmedApiBaseUrl}/api`;

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
    const token = localStorage.getItem(TOKEN_KEY);
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
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("token");
      delete api.defaults.headers.common.Authorization;
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// ===============================
// 🔐 Auth API
// ===============================
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  profile: () => api.get("/auth/profile"),
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
  getAll: () => api.get("/machines"),
  getById: (id) => api.get(`/machines/${id}`),
  create: (data) => api.post("/machines", data),
  update: (id, data) => api.put(`/machines/${id}`, data),
  delete: (id) => api.delete(`/machines/${id}`),
};

// ===============================
// 👥 Users API
// ===============================
export const usersAPI = {
  getAll: () => api.get("/users"),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// ===============================
// 💰 Wallet API
// ===============================
export const walletAPI = {
  getBalance: () => api.get("/wallet/balance"),
  getAllBalances: () => api.get("/wallet/all-balances"),
  getTransactions: (params) => api.get("/wallet/transactions", { params }),
  recharge: (data) => api.post("/wallet/recharge", data),
};

export default api;