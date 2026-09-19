const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const { testConnection } = require("./config/db");
const authRoutes = require("./routes/auth");
const machineRoutes = require("./routes/machines");
const bookingRoutes = require("./routes/bookings");
const walletRoutes = require("./routes/wallet");
const dashboardRoutes = require("./routes/dashboard");
const alertRoutes = require("./routes/alerts");
const userRoutes = require("./routes/users");
const attendanceRoutes = require("./routes/attendance");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.set("io", io);

/* ===============================
   🔥 IMPORTANT — Render fix
================================ */
app.set("trust proxy", 1);

/* ===============================
   Middlewares
================================ */
app.use(helmet());
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

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
app.use("/api/machines", machineRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);

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
  testConnection();

  server.listen(PORT, () => {
    console.log("=================================");
    console.log("🚀 DEVELOPMENT EXPRESS API SERVER");
    console.log(`🌐 Server running on port ${PORT}`);
    console.log("=================================");
  });
}

module.exports = { app, server, io };