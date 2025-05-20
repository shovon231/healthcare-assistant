// backend/src/utils/logger.js
const winston = require("winston");
const { combine, timestamp, json, errors } = winston.format;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(errors({ stack: true }), timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 1048576, // 1MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "logs/errors.log",
      level: "error",
      maxsize: 1048576,
      maxFiles: 5,
    }),
  ],
});

// Add exception handling
process.on("unhandledRejection", (ex) => {
  logger.error("Unhandled Rejection:", ex);
});

process.on("uncaughtException", (ex) => {
  logger.error("Uncaught Exception:", ex);
  process.exit(1);
});

module.exports = logger;
