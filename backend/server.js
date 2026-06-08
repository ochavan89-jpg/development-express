const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const machineRoutes = require("./routes/machines");
const bookingRoutes = require("./routes/bookings");
const walletRoutes = require("./routes/wallet");
const userRoutes = require("./routes/users");
const attendanceRoutes = require("./routes/attendance");
const alertRoutes = require("./routes/alerts");

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
app.use("/api/machines", machineRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/alerts", alertRoutes);

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

app.listen(PORT, () => {
  console.log("=================================");
  console.log("🚀 DEVELOPMENT EXPRESS API SERVER");
  console.log(`🌐 Server running on port ${PORT}`);
  console.log("=================================");
});