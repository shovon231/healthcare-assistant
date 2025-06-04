require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");

// Import routes and utilities
const apiRoutes = require("./src/routes/api");
const webhookRoutes = require("./src/routes/webhooks");
const errorHandler = require("./src/utils/errorHandler");
const logger = require("./src/utils/logger");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Routes
app.use("/api", apiRoutes);
app.use("/webhooks", webhookRoutes);

app.use("/api/v1/webhooks", webhookRoutes); // Changed from "/webhooks"

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Error handling middleware - MUST be last!
app.use((err, req, res, next) => {
  errorHandler(err, req, res, next);
});

module.exports = app;
