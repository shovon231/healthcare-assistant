const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const winston = require("winston");

// ✅ Configure Winston for logging webhooks
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "logs/webhooks.log",
      level: "info",
    }),
  ],
});

// 📞 **Twilio SMS Webhook**
router.post("/twilio", (req, res) => {
  if (!req.body)
    return res.status(400).send("Bad Request: No payload received");

  logger.info("📞 Received Twilio SMS webhook:", req.body);
  res.status(200).send("Twilio webhook received");
});

// 📢 **Twilio Voice Webhook**
router.post("/twilio-voice", (req, res) => {
  if (!req.body)
    return res.status(400).send("Bad Request: No payload received");

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    "Hello! You have reached the healthcare assistant. How can I help you today?"
  );

  logger.info("📢 Twilio Voice Call received:", req.body);

  res.type("text/xml");
  res.send(twiml.toString());
});

// 💳 **Stripe Webhook**
router.post("/stripe", (req, res) => {
  if (!req.body)
    return res.status(400).send("Bad Request: No payload received");

  logger.info("💳 Received Stripe webhook:", req.body);
  res.status(200).send("Stripe webhook received");
});

// 📅 **Google Calendar Webhook**
router.post("/google-calendar", (req, res) => {
  if (!req.body)
    return res.status(400).send("Bad Request: No payload received");

  logger.info("📅 Received Google Calendar webhook:", req.body);
  res.status(200).send("Google Calendar webhook received");
});

module.exports = router;
