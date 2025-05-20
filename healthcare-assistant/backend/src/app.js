const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const dotenv = require("dotenv");
const webhooks = require("./routes/webhooks");
const logger = require("./utils/logger");
dotenv.config();
const app = express();

// ✅ Enhanced Session Configuration for AI Conversations
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 3600000 }, // 1 hour
  })
);

// ✅ Security & Performance Enhancements
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// ✅ Body Parsing Configuration
app.use(bodyParser.urlencoded({ extended: true, limit: "10kb" }));
app.use(express.json({ limit: "10kb" }));

// 🔗 Register Webhook Routes with AI
app.use("/api/v1/webhooks", webhooks);

// 🏥 Health Check Endpoint
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

// 🚨 Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// 🚨 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = app;
