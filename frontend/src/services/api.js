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

const TOKEN_KEY = "de_token";
const LEGACY_TOKEN_KEY = "token";

// ===============================
// 🔐 Request Interceptor (token)
// ===============================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
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
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;
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
};

// ===============================
// ⚙️ Machines API
// ===============================
export const machinesAPI = {
  getAll: (params) => api.get("/machines", { params }),
};

// ===============================
// 👥 Users API
// ===============================
export const usersAPI = {
  getAll: () => api.get("/users"),
};

// ===============================
// 💰 Wallet API
// ===============================
export const walletAPI = {
  getBalance: () => api.get("/wallet/balance"),
  getAllBalances: () => api.get("/wallet/all-balances"),
  getTransactions: (params) => api.get("/wallet/transactions", { params }),
  recharge: (data) => api.post("/wallet/recharge", data),
  getAll: () => api.get("/wallet/all-balances"),
};

export default api;