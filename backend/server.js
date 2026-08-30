const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

/* ===============================
   🔥 IMPORTANT — Render fix
================================ */
app.set("trust proxy", 1);

/* ===============================
   Middlewares
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   Rate Limiter
================================ */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const machinesRoutes = require("./routes/machines");
const bookingsRoutes = require("./routes/bookings");
const walletRoutes = require("./routes/wallet");
const usersRoutes = require("./routes/users");
const attendanceRoutes = require("./routes/attendance");
const alertsRoutes = require("./routes/alerts");

/* ===============================
   Health Route
================================ */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "🚀 DEVELOPMENT EXPRESS API RUNNING",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/machines", machinesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/alerts", alertsRoutes);

/* ===============================
   Root Route
================================ */
app.get("/", (req, res) => {
  res.send("✅ Development Express Backend Live");
});

/* ===============================
   Server Start
================================ */
const PORT = process.env.PORT || 10000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("=================================");
    console.log("🚀 DEVELOPMENT EXPRESS API SERVER");
    console.log(`🌐 Server running on port ${PORT}`);
    console.log("=================================");
  });
}

module.exports = app;