const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const winston = require("winston");
const dotenv = require("dotenv");
const app = require("./src/app");
const logger = require("./src/utils/logger");
// Load environment variables
dotenv.config();

// Configure Winston Logger
// const logger = winston.createLogger({
//   level: "info",
//   format: winston.format.json(),
//   transports: [
//     new winston.transports.Console(),
//     new winston.transports.File({
//       filename: "logs/server.log",
//       level: "error",
//     }),
//   ],
// });

// Define MongoDB Connection URI
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/healthcare-assistant";
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => logger.info("✅ Connected to MongoDB"))
  .catch((err) => {
    logger.error(`❌ MongoDB connection error: ${err.message}`);
    process.exit(1); // Exit process if unable to connect
  });

// Create HTTP Server
const server = http.createServer(app);

// Handle Errors & Unhandled Rejections
process.on("uncaughtException", (err) => {
  logger.error(`❌ Uncaught Exception: ${err.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`⚠️ Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.removeAllListeners("warning");
// Start Server
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
});
