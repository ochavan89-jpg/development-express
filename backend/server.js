const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const machineRoutes = require("./routes/machines");
const bookingRoutes = require("./routes/bookings");
const walletRoutes = require("./routes/wallet");
const userRoutes = require("./routes/users");
const attendanceRoutes = require("./routes/attendance");
const alertRoutes = require("./routes/alerts");

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "DEVELOPMENT EXPRESS API RUNNING",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/machines", machineRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/alerts", alertRoutes);

app.get("/", (req, res) => {
  res.send("Development Express Backend Live");
});

const PORT = process.env.PORT || 10000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("=================================");
    console.log("DEVELOPMENT EXPRESS API SERVER");
    console.log(`Server running on port ${PORT}`);
    console.log("=================================");
  });
}

module.exports = app;