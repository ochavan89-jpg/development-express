import axios from "axios";
import toast from "react-hot-toast";

const configuredBaseUrl =
  import.meta.env.VITE_API_URL ||
  "https://development-express-api.onrender.com/api";
const normalizedBaseUrl = configuredBaseUrl.replace(/\/+$/, "");
const API_BASE_URL = normalizedBaseUrl.endsWith("/api")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("de_token") || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("de_token");
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    } else {
      const msg = error.response?.data?.message || "Server error";
      if (error.response?.status !== 404) toast.error(msg);
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  profile: () => api.get("/auth/profile"),
  register: (data) => api.post("/auth/register", data),
  changePassword: (data) => api.post("/auth/change-password", data),
};

export const machineAPI = {
  getAll: (params) => api.get("/machines", { params }),
  getById: (id) => api.get(`/machines/${id}`),
  create: (data) => api.post("/machines", data),
  update: (id, data) => api.put(`/machines/${id}`, data),
  delete: (id) => api.delete(`/machines/${id}`),
};

export const machinesAPI = machineAPI;

export const bookingAPI = {
  getAll: (params) => api.get("/bookings", { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post("/bookings", data),
  complete: (id, data) => api.put(`/bookings/${id}/complete`, data),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
};

export const walletAPI = {
  getBalance: () => api.get("/wallet/balance"),
  getTransactions: (params) => api.get("/wallet/transactions", { params }),
  recharge: (data) => api.post("/wallet/recharge", data),
  getAllBalances: () => api.get("/wallet/all-balances"),
};

export const dashboardAPI = {
  getAdmin: () => api.get("/dashboard/admin"),
  getOwner: () => api.get("/dashboard/owner"),
  getClient: () => api.get("/dashboard/client"),
  getOperator: () => api.get("/dashboard/operator"),
};

export const alertAPI = {
  getAll: (params) => api.get("/alerts", { params }),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
};

export const userAPI = {
  getAll: (params) => api.get("/users", { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const usersAPI = userAPI;

export const attendanceAPI = {
  punchIn: (data) => api.post("/attendance/punch-in", data),
  punchOut: (id, data) => api.put(`/attendance/${id}/punch-out`, data),
  getAll: (params) => api.get("/attendance", { params }),
};

export default api;