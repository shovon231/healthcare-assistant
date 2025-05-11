const express = require("express");
const bodyParser = require("body-parser"); // Required for Twilio webhooks
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet"); // Security middleware
const dotenv = require("dotenv");
const webhooks = require("./src/routes/webhooks");

dotenv.config(); // Load environment variables

const app = express();

// ✅ Security & Performance Enhancements
app.use(helmet()); // Helps secure Express apps
app.use(cors()); // Enables cross-origin requests
app.use(morgan("dev")); // Logs requests to the console

// ✅ Fix for Twilio Webhook Handling
app.use(bodyParser.urlencoded({ extended: true })); // Parses Twilio webhooks properly
app.use(express.json()); // Parses incoming JSON payloads

// 🔗 Register Webhook Routes
app.use("/api/v1/webhooks", webhooks);

// 🚨 Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res
    .status(err.statusCode || 500)
    .json({ success: false, message: err.message || "Internal Server Error" });
});

// 🚨 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

module.exports = app;
