const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const app = express();

/* ===============================
   🔥 IMPORTANT — Render fix
================================ */
app.set("trust proxy", 1);

const { testConnection } = require("./config/db");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const machinesRoutes = require("./routes/machines");
const bookingsRoutes = require("./routes/bookings");
const walletRoutes = require("./routes/wallet");
const alertsRoutes = require("./routes/alerts");
const attendanceRoutes = require("./routes/attendance");
const usersRoutes = require("./routes/users");

/* ===============================
   Middlewares
================================ */
app.use(cors());
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
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

/* ===============================
   Health Route
================================ */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "🚀 DEVELOPMENT EXPRESS API RUNNING",
  });
});

/* ===============================
   API Routes
================================ */
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/machines", machinesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/users", usersRoutes);

/* ===============================
   Root Route
================================ */
app.get("/", (req, res) => {
  res.send("✅ Development Express Backend Live");
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

/* ===============================
   Server Start
================================ */
const PORT = process.env.PORT || 10000;

if (require.main === module) {
  testConnection();
  app.listen(PORT, () => {
    console.log("=================================");
    console.log("🚀 DEVELOPMENT EXPRESS API SERVER");
    console.log(`🌐 Server running on port ${PORT}`);
    console.log("=================================");
  });
}

module.exports = app;