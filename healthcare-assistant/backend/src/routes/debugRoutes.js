// backend/src/routes/debugRoutes.js
const express = require("express");
const router = express.Router();

// Test route
router.post("/test-voice", (req, res) => {
  console.log("✅ Debug route hit!");
  res
    .type("text/xml")
    .send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Debug route working!</Say></Response>'
    );
});

module.exports = router;
