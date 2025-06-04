const express = require("express");
const router = express.Router();
const greetingHandler = require("./greeting");
const collectDetailsHandler = require("./collectDetails");
const confirmIntentHandler = require("./confirmIntent");
const followUpHandler = require("./followUp");
const smsHandler = require("./smsHandler");
const voiceHandler = require("./voiceHandler");

// Webhook endpoints
router.post("/greeting", greetingHandler);
router.post("/collect-details", collectDetailsHandler);
router.post("/confirm-intent", confirmIntentHandler);
router.post("/follow-up", followUpHandler);
router.post("/sms", smsHandler);
router.post("/voice", voiceHandler);

module.exports = router;
