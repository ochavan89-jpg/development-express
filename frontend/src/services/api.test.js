import assert from "node:assert/strict";
import test from "node:test";
import api, {
  alertAPI,
  attendanceAPI,
  authAPI,
  bookingAPI,
  dashboardAPI,
  machineAPI,
  machinesAPI,
  userAPI,
  usersAPI,
  walletAPI,
} from "./api.js";

test("exports the API methods used by pages", () => {
  [
    authAPI.login,
    authAPI.profile,
    dashboardAPI.getAdmin,
    alertAPI.getAll,
    machineAPI.getAll,
    machinesAPI.getAll,
    userAPI.getAll,
    usersAPI.getAll,
    walletAPI.getAllBalances,
    walletAPI.getTransactions,
    bookingAPI.getAll,
    attendanceAPI.getAll,
  ].forEach((method) => assert.equal(typeof method, "function"));
});

test("request interceptor sends the persisted auth token", async () => {
  globalThis.localStorage = {
    getItem: (key) => (key === "de_token" ? "stored-token" : null),
    removeItem: () => {},
  };

  const response = await api.get("/auth/profile", {
    adapter: async (config) => ({
      data: { authorization: config.headers.Authorization },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }),
  });

  assert.equal(response.data.authorization, "Bearer stored-token");
});
