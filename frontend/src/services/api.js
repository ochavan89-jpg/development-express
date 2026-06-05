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
  getAll: () => api.get("/machines"),
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
  getAll: () => api.get("/wallet/balance"),
};

export default api;