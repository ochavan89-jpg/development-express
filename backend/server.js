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
app.use("/api/alerts", require("./routes/alerts"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/machines", require("./routes/machines"));
app.use("/api/users", require("./routes/users"));
app.use("/api/wallet", require("./routes/wallet"));

/* ===============================
   Root Route
================================ */
app.get("/", (req, res) => {
  res.send("✅ Development Express Backend Live");
});

app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
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