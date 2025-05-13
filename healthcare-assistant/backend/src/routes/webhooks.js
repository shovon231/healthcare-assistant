const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const appointmentController = require("../controllers/appointmentController");
const twilioService = require("../services/external/twilioService");
const winston = require("winston");

// ✅ Configure Winston Logger
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

// Utility function to validate phone numbers
const normalizePhoneNumber = (phone) => {
  return phone.replace(/\D/g, "");
};

// 📞 Twilio SMS Webhook
router.post("/twilio", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const messageBody = req.body.Body.trim().toLowerCase();
  const senderPhone = normalizePhoneNumber(req.body.From);

  logger.info(`📩 Received SMS from ${senderPhone}: ${messageBody}`);

  try {
    if (messageBody.includes("cancel")) {
      const cancellationResponse =
        await appointmentController.cancelAppointmentByPhone(senderPhone);
      twiml.message(cancellationResponse.message);
    } else if (messageBody.includes("reschedule")) {
      twiml.message(
        "Please reply with the new date and time for rescheduling (e.g. 'Next Tuesday at 2pm')."
      );
    } else {
      twiml.message(
        "Sorry, I didn't understand. Reply with:\n" +
          "- CANCEL to cancel your appointment\n" +
          "- RESCHEDULE to change your appointment\n" +
          "- Or describe when you'd like to book (e.g. 'Tuesday at 3pm with Dr. Smith')"
      );
    }
  } catch (error) {
    logger.error(`❌ SMS Processing Error: ${error.message}`);
    twiml.message(
      "We encountered an error processing your request. Please try again or call our office."
    );
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

// 📢 Twilio Voice - Initial Call Handler
router.post("/twilio-voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Clear previous session
  req.session.destroy(() => {
    logger.info("🧹 Cleared previous session data");
  });

  // Configure voice settings
  twiml.say(
    {
      voice: "woman",
      language: "en-US",
    },
    "Hello! Thank you for calling the Healthcare Assistant."
  );

  twiml.pause({ length: 1 });

  const gather = twiml.gather({
    input: "speech",
    action: "/api/v1/webhooks/twilio-voice-doctor",
    method: "POST",
    timeout: 5,
    speechTimeout: "auto",
    enhanced: true,
    language: "en-US",
  });

  gather.say(
    {
      voice: "woman",
      language: "en-US",
    },
    "Please say the name of the doctor you'd like to see. For example, 'Dr. Smith'."
  );

  // Handle no speech detected
  twiml.redirect(
    {
      method: "POST",
    },
    "/api/v1/webhooks/twilio-voice"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

// 🗣️ Twilio Voice - Doctor Name Handler
router.post("/twilio-voice-doctor", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const doctorName = req.body.SpeechResult;
  const phone = normalizePhoneNumber(req.body.From);

  logger.info(`🗣️ Doctor Name Captured: ${doctorName || "None"}`);

  if (!doctorName) {
    twiml.say("I didn't catch the doctor's name. Let's try again.");
    twiml.redirect("/api/v1/webhooks/twilio-voice");
    return res.send(twiml.toString());
  }

  // Store in session
  req.session.doctor = doctorName;
  req.session.phone = phone;
  logger.info(`📝 Stored doctor name: ${doctorName} for ${phone}`);

  // Prompt for date/time
  const gather = twiml.gather({
    input: "speech",
    action: "/api/v1/webhooks/twilio-voice-confirm",
    method: "POST",
    timeout: 10,
    speechTimeout: "auto",
    enhanced: true,
    language: "en-US",
  });

  gather.say(
    {
      voice: "woman",
      language: "en-US",
    },
    `Thank you. You said Dr. ${doctorName}. Please say the date and time you'd prefer. For example, 'next Tuesday at 2pm' or 'December 15th at 10:30am'.`
  );

  // Handle no input
  twiml.redirect("/api/v1/webhooks/twilio-voice-doctor");

  res.type("text/xml");
  res.send(twiml.toString());
});

router.post("/twilio-voice-confirm", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const appointmentTime = req.body.SpeechResult;
  const phone = normalizePhoneNumber(req.body.From);
  const doctor = req.session?.doctor || "Unknown Doctor";

  logger.info(`🗣️ Appointment Time Captured: ${appointmentTime || "None"}`);
  logger.info(`📝 Processing appointment for Dr. ${doctor} with ${phone}`);

  // Validate we have all required data
  if (!appointmentTime || !phone) {
    logger.error("Missing required data for appointment confirmation");
    twiml.say("We're missing some information. Let's start over.");
    twiml.redirect("/api/v1/webhooks/twilio-voice");
    return res.type("text/xml").send(twiml.toString());
  }

  try {
    // Create appointment
    const appointment = await appointmentController.createAppointmentService({
      doctor,
      voiceDateTime: appointmentTime,
      phone,
      source: "voice",
    });

    // Success response
    twiml.say(
      `Your appointment with Dr. ${doctor} has been confirmed for ${appointmentTime}.`
    );
    twiml.pause({ length: 1 });

    // Only mention SMS if Twilio is configured
    if (twilioService.isConfigured()) {
      twiml.say("You will receive a text message confirmation shortly.");
    }

    twiml.say("Thank you for using our service. Goodbye!");

    // Clear session
    if (req.session) {
      req.session.destroy();
    }

    res.type("text/xml");
    return res.send(twiml.toString());
  } catch (error) {
    logger.error(`❌ Voice Appointment Error: ${error.message}`);

    twiml.say("We encountered an error processing your appointment.");
    twiml.pause({ length: 1 });

    if (error.message.includes("No available slots")) {
      twiml.say("There are no available slots at that time.");
      twiml.redirect("/api/v1/webhooks/twilio-voice-doctor");
    } else {
      twiml.say("Please call our office directly for assistance. Goodbye.");
    }

    res.type("text/xml");
    return res.send(twiml.toString());
  }
});

module.exports = router;
