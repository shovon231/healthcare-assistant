const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const routes = require("./src/routes/api");

const app = express();

// Middleware Setup
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded requests
app.use(cors()); // Enable CORS for cross-origin requests
app.use(morgan("dev")); // Log requests in development mode
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Compress responses

// API Routes
app.use("/api/v1", routes);

// Health Check Route
app.get("/", (req, res) => {
  res.json({ message: "Healthcare Assistant API is running 🚀" });
});

module.exports = app;
