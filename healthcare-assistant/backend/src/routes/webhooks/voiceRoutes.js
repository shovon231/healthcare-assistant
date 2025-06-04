// backend/src/routes/webhooks/voiceRoutes.js
const express = require("express");
const router = express.Router();
const { handleVoiceWebhook } = require("./voiceHandler");

// Handle ALL possible voice endpoints
router.post("/twilio-voice", handleVoiceWebhook);
router.post("/voice", handleVoiceWebhook);
router.post("/", handleVoiceWebhook); 

module.exports = router;
