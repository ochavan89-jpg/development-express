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
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || "*",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* ===============================
   Rate Limiter
================================ */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
  max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

app.use("/api", limiter);

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
   Health Route
================================ */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "🚀 DEVELOPMENT EXPRESS API RUNNING",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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

app.listen(PORT, () => {
  console.log("=================================");
  console.log("🚀 DEVELOPMENT EXPRESS API SERVER");
  console.log(`🌐 Server running on port ${PORT}`);
  console.log("=================================");
});