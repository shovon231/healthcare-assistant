const express = require("express");
const router = express.Router();

router.post("/twilio", (req, res) => {
  console.log("📞 Received Twilio webhook:", req.body);
  res.status(200).send("Twilio webhook received");
});

router.post("/stripe", (req, res) => {
  console.log("💳 Received Stripe webhook:", req.body);
  res.status(200).send("Stripe webhook received");
});

router.post("/google-calendar", (req, res) => {
  console.log("📅 Received Google Calendar webhook:", req.body);
  res.status(200).send("Google Calendar webhook received");
});

module.exports = router;
