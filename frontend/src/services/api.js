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
    const token = localStorage.getItem("token");
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
      localStorage.removeItem("token");
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
};

// ===============================
// 📊 Dashboard API
// ===============================
export const dashboardAPI = {
  getStats: () => api.get("/dashboard"),
};

// ===============================
// 🚨 Alerts API
// ===============================
export const alertAPI = {
  getAll: () => api.get("/alerts"),
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
  getAll: () => api.get("/wallet"),
};

export default api;