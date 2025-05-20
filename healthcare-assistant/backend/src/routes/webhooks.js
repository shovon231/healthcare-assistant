const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const appointmentController = require("../controllers/appointmentController");
const {
  generateAIResponse,
  extractAppointmentDetails,
} = require("../services/external/aiService");
const { normalizePhoneNumber } = require("../utils/helpers");
const logger = require("../utils/logger");

// Constants
const MAX_CONVERSATION_HISTORY = 10;
const VOICE_TIMEOUT = 5;
const MAX_RETRIES = 2;

// Voice interaction states
const STATES = {
  GREETING: "greeting",
  CONFIRM_INTENT: "confirm_intent",
  COLLECT_DETAILS: "collect_details",
  CONFIRM_APPOINTMENT: "confirm_appointment",
};

/**
 * Twilio SMS Webhook Handler
 */
router.post("/twilio", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const messageBody = req.body.Body.trim();
  const senderPhone = normalizePhoneNumber(req.body.From);

  try {
    // Initialize session
    req.session.conversation = req.session.conversation || {
      history: [],
      context: {},
    };

    // Generate AI response
    const aiResponse = await generateAIResponse({
      message: messageBody,
      history: req.session.conversation.history,
      phone: senderPhone,
      mode: "text",
    });

    // Handle appointment booking
    let responseMessage = aiResponse;
    if (aiResponse.includes("[APPOINTMENT]")) {
      const details = extractAppointmentDetails(aiResponse, senderPhone);
      if (details) {
        await appointmentController.createAppointmentService(details);
        responseMessage = `✅ Appointment confirmed with Dr. ${details.doctor} on ${details.date} at ${details.time}`;
      }
    }

    // Update conversation history
    req.session.conversation.history = [
      ...req.session.conversation.history.slice(-MAX_CONVERSATION_HISTORY),
      { role: "user", content: messageBody },
      { role: "assistant", content: responseMessage },
    ];

    twiml.message(responseMessage);
  } catch (error) {
    logger.error("SMS Processing Error", {
      error: error.message,
      stack: error.stack,
      phone: senderPhone,
    });
    twiml.message(
      "We're experiencing technical difficulties. Please try again later."
    );
  }

  res.type("text/xml").send(twiml.toString());
});

/**
 * Enhanced Twilio Voice Webhook Handler
 */
router.post("/twilio-voice", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const callerPhone = normalizePhoneNumber(req.body.From);

  try {
    // Initialize or reset voice session
    if (
      !req.session.voiceSession ||
      req.session.voiceSession.state === STATES.GREETING
    ) {
      req.session.voiceSession = {
        history: [],
        state: STATES.GREETING,
        appointmentData: {},
        retries: 0,
      };
    }

    const { state } = req.session.voiceSession;
    const speechResult = req.body.SpeechResult || "";
    const digits = req.body.Digits || "";

    logger.info(`Voice interaction - State: ${state}`, {
      input: speechResult || digits || "[No input]",
      retries: req.session.voiceSession.retries,
      callerPhone,
    });

    // Process based on current state
    switch (state) {
      case STATES.GREETING:
        await handleGreetingState(twiml, req, res);
        return;

      case STATES.CONFIRM_INTENT:
        await handleConfirmIntentState(
          twiml,
          req,
          res,
          speechResult,
          digits,
          callerPhone
        );
        return;

      case STATES.COLLECT_DETAILS:
        await handleCollectDetailsState(
          twiml,
          req,
          res,
          speechResult,
          callerPhone
        );
        return;

      case STATES.CONFIRM_APPOINTMENT:
        await handleConfirmAppointmentState(
          twiml,
          req,
          res,
          speechResult,
          digits,
          callerPhone
        );
        return;

      default:
        await resetVoiceSession(twiml, req, res);
        return;
    }
  } catch (error) {
    logger.error("Voice handler error", {
      error: error.message,
      stack: error.stack,
      callerPhone,
    });

    const errorTwiml = new twilio.twiml.VoiceResponse();
    errorTwiml.say(
      "We're unable to process your request. Please call back later."
    );
    errorTwiml.hangup();
    res.type("text/xml").send(errorTwiml.toString());
  }
});

// State Handlers
async function handleGreetingState(twiml, req, res) {
  const response = new twilio.twiml.VoiceResponse();
  const gather = response.gather({
    input: "speech dtmf",
    action: "/api/v1/webhooks/twilio-voice",
    method: "POST",
    timeout: VOICE_TIMEOUT,
    speechTimeout: "auto",
    language: "en-US",
    hints: "appointment, book, schedule",
    numDigits: 1,
  });

  gather.say(
    {
      voice: "woman",
      language: "en-US",
    },
    "Thank you for calling Healthcare Assistant. Are you calling to book an appointment? Press 1 or say yes."
  );

  req.session.voiceSession.state = STATES.CONFIRM_INTENT;
  res.type("text/xml").send(response.toString());
}

async function handleConfirmIntentState(
  twiml,
  req,
  res,
  speechResult,
  digits,
  callerPhone
) {
  const response = new twilio.twiml.VoiceResponse();
  const input = speechResult || digits || "";

  if (!input) {
    handleRetryOrExit(
      response,
      req,
      "I didn't hear your response. Please say yes or no, or press 1."
    );
    res.type("text/xml").send(response.toString());
    return;
  }

  const positiveResponse = ["yes", "yeah", "yep", "book", "1"].some((word) =>
    input.toString().toLowerCase().includes(word)
  );

  if (positiveResponse) {
    // Update conversation history
    req.session.voiceSession.history = [
      ...req.session.voiceSession.history.slice(-MAX_CONVERSATION_HISTORY),
      { role: "user", content: "Yes, I want to book an appointment" },
      { role: "assistant", content: "Requesting appointment details" },
    ];

    const collectResponse = new twilio.twiml.VoiceResponse();
    const gather = collectResponse.gather({
      input: "speech",
      action: "/api/v1/webhooks/twilio-voice",
      method: "POST",
      timeout: VOICE_TIMEOUT,
      speechTimeout: "auto",
      language: "en-US",
    });

    gather.say(
      "Great! Please tell me the doctor's full name and your preferred date and time. For example, 'I want to see Dr. Smith on May 25th at 2 PM'."
    );

    // Update state
    req.session.voiceSession.state = STATES.COLLECT_DETAILS;
    req.session.voiceSession.retries = 0;

    res.type("text/xml").send(collectResponse.toString());
  } else {
    response.say("How else may I assist you today?");
    await resetVoiceSession(response, req, res);
  }
}

async function handleCollectDetailsState(
  twiml,
  req,
  res,
  speechResult,
  callerPhone
) {
  const response = new twilio.twiml.VoiceResponse();

  if (!speechResult) {
    handleRetryOrExit(
      response,
      req,
      "I didn't catch that. Please tell me the doctor's full name and your preferred date and time."
    );
    res.type("text/xml").send(response.toString());
    return;
  }

  try {
    logger.info("Processing appointment details", { speechResult });

    const aiResponse = await generateAIResponse({
      message: speechResult,
      history: req.session.voiceSession.history,
      phone: callerPhone,
      mode: "voice-appointment",
    });

    logger.info("AI Response", { aiResponse });

    const details = extractAppointmentDetails(aiResponse, callerPhone);

    if (details) {
      req.session.voiceSession.appointmentData = details;
      req.session.voiceSession.state = STATES.CONFIRM_APPOINTMENT;
      req.session.voiceSession.retries = 0;

      const confirmResponse = new twilio.twiml.VoiceResponse();
      const gather = confirmResponse.gather({
        input: "speech dtmf",
        action: "/api/v1/webhooks/twilio-voice",
        method: "POST",
        timeout: VOICE_TIMEOUT,
        speechTimeout: "auto",
        numDigits: 1,
      });

      gather.say(
        `I have: Doctor ${details.doctor}, on ${details.date} at ${details.time}. Is this correct? Press 1 or say yes to confirm.`
      );

      // Update conversation history
      req.session.voiceSession.history = [
        ...req.session.voiceSession.history.slice(-MAX_CONVERSATION_HISTORY),
        { role: "user", content: speechResult },
        { role: "assistant", content: aiResponse },
      ];

      res.type("text/xml").send(confirmResponse.toString());
    } else {
      response.say(
        "I couldn't get all the details. Please say the doctor's full name, date and time together. For example, 'Dr. Smith on May 25th at 2 PM'."
      );
      req.session.voiceSession.retries += 1;
      res.type("text/xml").send(response.toString());
    }
  } catch (error) {
    logger.error("Error in collect details state", {
      error: error.message,
      stack: error.stack,
      callerPhone,
    });

    response.say(
      "I need more details. Please tell me the doctor's full name, date and time."
    );
    await resetVoiceSession(response, req, res);
  }
}

async function handleConfirmAppointmentState(
  twiml,
  req,
  res,
  speechResult,
  digits,
  callerPhone
) {
  const response = new twilio.twiml.VoiceResponse();
  const input = speechResult || digits || "";

  if (!input) {
    handleRetryOrExit(response, req, "Please confirm yes or no, or press 1.");
    res.type("text/xml").send(response.toString());
    return;
  }

  try {
    const positiveResponse = ["yes", "yeah", "yep", "1"].some((word) =>
      input.toString().toLowerCase().includes(word)
    );

    if (positiveResponse) {
      // Create a copy of appointment data with valid source value
      const appointmentData = {
        ...req.session.voiceSession.appointmentData,
        source: "voice", // Using correct enum value
      };

      await appointmentController.createAppointmentService(appointmentData);

      response.say(
        "Your appointment is confirmed! A text confirmation will be sent shortly. Goodbye!"
      );
      response.hangup();
      req.session.voiceSession = null;
      res.type("text/xml").send(response.toString());
    } else {
      response.say("Let's try again. What date and time would you prefer?");
      req.session.voiceSession.state = STATES.COLLECT_DETAILS;
      req.session.voiceSession.retries += 1;
      res.type("text/xml").send(response.toString());
    }
  } catch (error) {
    logger.error("Error confirming appointment", {
      error: error.message,
      stack: error.stack,
      callerPhone,
    });

    response.say(
      "I couldn't confirm your appointment. Please try again later."
    );
    response.hangup();
    res.type("text/xml").send(response.toString());
  }
}

// Helper Functions
function handleRetryOrExit(twiml, req, message) {
  if (req.session.voiceSession.retries >= MAX_RETRIES) {
    twiml.say("We're having trouble connecting. Please call back later.");
    twiml.hangup();
    req.session.voiceSession = null;
  } else {
    twiml.say(message);
    req.session.voiceSession.retries += 1;
  }
}

async function resetVoiceSession(twiml, req, res) {
  twiml.say("Let's start over.");
  req.session.voiceSession = {
    history: [],
    state: STATES.GREETING,
    appointmentData: {},
    retries: 0,
  };
  res.type("text/xml").send(twiml.toString());
}

module.exports = router;
