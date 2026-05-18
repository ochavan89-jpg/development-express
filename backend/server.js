const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
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
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

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
app.use("/api/auth", require("./routes/auth"));
app.use("/api/machines", require("./routes/machines"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/wallet", require("./routes/wallet"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/users", require("./routes/users"));
app.use("/api/attendance", require("./routes/attendance"));

/* ===============================
   Root Route
================================ */
app.get("/", (req, res) => {
  res.send("✅ Development Express Backend Live");
});

app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

/* ===============================
   Server Start
================================ */
const PORT = process.env.PORT || 10000;

const server = app.listen(PORT, () => {
  console.log("=================================");
  console.log("🚀 DEVELOPMENT EXPRESS API SERVER");
  console.log(`🌐 Server running on port ${PORT}`);
  console.log("=================================");
});

module.exports = { app, server };