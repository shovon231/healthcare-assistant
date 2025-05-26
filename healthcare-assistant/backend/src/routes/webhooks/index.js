const express = require("express");
const router = express.Router();
const smsHandler = require("./smsHandler");
const voiceHandler = require("./voiceHandlers/greeting");

// Twilio SMS Webhook Handler
router.post("/twilio", smsHandler.handleSmsWebhook);

// Twilio Voice Webhook Handler - Starts with greeting state
router.post("/twilio-voice", voiceHandler.handleState);

module.exports = router;
