const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
};

const notFoundHandler = (req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

module.exports = { errorHandler, notFoundHandler };
