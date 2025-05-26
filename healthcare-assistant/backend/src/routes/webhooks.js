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
  EMERGENCY: "emergency",
  FOLLOW_UP: "follow_up",
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
        responseMessage = `✅ Appointment confirmed with Dr. ${details.doctor} on ${details.date} at ${details.time}. We'll send a reminder 24 hours before.`;
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
      "We're experiencing technical difficulties. Please try again later or call our front desk at (555) 123-4567."
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
        lastResponse: null,
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

    // Emergency detection
    if (
      (speechResult || "").toLowerCase().includes("emergency") ||
      (speechResult || "").toLowerCase().includes("urgent")
    ) {
      req.session.voiceSession.state = STATES.EMERGENCY;
    }

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

      case STATES.EMERGENCY:
        await handleEmergencyState(twiml, req, res);
        return;

      case STATES.FOLLOW_UP:
        await handleFollowUpState(twiml, req, res, speechResult, callerPhone);
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
      "We're unable to process your request right now. Please call back later or dial our front desk directly at (555) 123-4567."
    );
    errorTwiml.hangup();
    res.type("text/xml").send(errorTwiml.toString());
  }
});

// State Handlers
async function handleGreetingState(twiml, req, res) {
  const response = new twilio.twiml.VoiceResponse();

  const greetings = [
    "Thank you for calling City Healthcare Center, this is Clara speaking.",
    "Hello and welcome to City Healthcare, I'm Clara. How can I help you today?",
    "Good day! You've reached City Healthcare Center, Clara speaking.",
  ];

  const randomGreeting =
    greetings[Math.floor(Math.random() * greetings.length)];

  const gather = response.gather({
    input: "speech dtmf",
    action: "/api/v1/webhooks/twilio-voice",
    method: "POST",
    timeout: VOICE_TIMEOUT,
    speechTimeout: "auto",
    language: "en-US",
    hints: "appointment, book, schedule, emergency, question",
    numDigits: 1,
  });

  gather.say(
    {
      voice: "woman",
      language: "en-US",
    },
    `${randomGreeting} Are you calling to book an appointment? 
    <break time="0.5s"/> 
    You can say 'yes' or press 1 to continue. 
    For emergencies, say 'emergency' immediately.`
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
  const input = (speechResult || digits || "").toString().toLowerCase();

  if (!input) {
    handleRetryOrExit(
      response,
      req,
      "I didn't hear your response. Please say yes or no, or press 1."
    );
    res.type("text/xml").send(response.toString());
    return;
  }

  // Emergency detection
  if (input.includes("emergency") || input.includes("urgent")) {
    req.session.voiceSession.state = STATES.EMERGENCY;
    await handleEmergencyState(response, req, res);
    return;
  }

  const positiveResponse = ["yes", "yeah", "yep", "book", "1"].some((word) =>
    input.includes(word)
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
      `Great! Please tell me the doctor's full name and your preferred date and time. 
      For example, 'I want to see Dr. Smith on May 25th at 2 PM'. 
      Or you can say 'next available' for the doctor's soonest opening.`
    );

    // Update state
    req.session.voiceSession.state = STATES.COLLECT_DETAILS;
    req.session.voiceSession.retries = 0;

    res.type("text/xml").send(collectResponse.toString());
  } else {
    // Handle other inquiries
    req.session.voiceSession.state = STATES.FOLLOW_UP;
    const followUpResponse = new twilio.twiml.VoiceResponse();
    const gather = followUpResponse.gather({
      input: "speech",
      action: "/api/v1/webhooks/twilio-voice",
      method: "POST",
      timeout: VOICE_TIMEOUT,
      speechTimeout: "auto",
    });

    gather.say(
      "How else may I assist you today? You can ask about our hours, services, or doctors."
    );

    res.type("text/xml").send(followUpResponse.toString());
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
      "I didn't catch that. Please tell me the doctor's full name and your preferred date and time, or say 'next available'."
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

      const confirmations = [
        `I have that as Dr. ${details.doctor} on ${details.date} at ${details.time}. Is this correct?`,
        `Let me confirm: Dr. ${details.doctor} on ${details.date} at ${details.time}. Does that work for you?`,
        `So that's with Dr. ${details.doctor} on ${details.date} at ${details.time}. Can I book this for you?`,
      ];

      const randomConfirmation =
        confirmations[Math.floor(Math.random() * confirmations.length)];

      gather.say(randomConfirmation);
      gather.say("Press 1 or say yes to confirm.");

      // Update conversation history
      req.session.voiceSession.history = [
        ...req.session.voiceSession.history.slice(-MAX_CONVERSATION_HISTORY),
        { role: "user", content: speechResult },
        { role: "assistant", content: aiResponse },
      ];

      res.type("text/xml").send(confirmResponse.toString());
    } else {
      // Determine what's missing
      const missing = [];
      if (!speechResult.includes("doctor"))
        missing.push("Which doctor would you like to see?");
      if (!speechResult.includes("date"))
        missing.push("What date works best for you?");
      if (!speechResult.includes("time"))
        missing.push("What time of day would you prefer?");

      const followUpResponse = new twilio.twiml.VoiceResponse();
      const gather = followUpResponse.gather({
        input: "speech",
        action: "/api/v1/webhooks/twilio-voice",
        method: "POST",
        timeout: VOICE_TIMEOUT,
        speechTimeout: "auto",
      });

      if (missing.length === 1) {
        gather.say(`I just need one more thing. ${missing[0]}`);
      } else if (missing.length > 1) {
        gather.say(`I need a few more details to book your appointment. ${missing.join(
          " "
        )} 
          Please tell me one at a time.`);
      } else {
        gather.say(
          "I couldn't get all the details. Please say the doctor's full name, date and time together. For example, 'Dr. Smith on May 25th at 2 PM'."
        );
      }

      req.session.voiceSession.retries += 1;
      res.type("text/xml").send(followUpResponse.toString());
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
  const input = (speechResult || digits || "").toString().toLowerCase();

  if (!input) {
    handleRetryOrExit(response, req, "Please confirm yes or no, or press 1.");
    res.type("text/xml").send(response.toString());
    return;
  }

  try {
    const positiveResponse = ["yes", "yeah", "yep", "1"].some((word) =>
      input.includes(word)
    );

    if (positiveResponse) {
      // Create appointment
      const appointmentData = {
        ...req.session.voiceSession.appointmentData,
        source: "voice",
      };

      await appointmentController.createAppointmentService(appointmentData);

      const confirmations = [
        "Your appointment is confirmed! A text confirmation will be sent shortly. Thank you and goodbye!",
        "All set! You'll receive a text confirmation soon. Have a wonderful day!",
        "I've booked your appointment. You'll get a confirmation text with all the details. Goodbye!",
      ];

      const randomConfirmation =
        confirmations[Math.floor(Math.random() * confirmations.length)];

      response.say(randomConfirmation);
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
      "I couldn't confirm your appointment. Please try again later or call our front desk at (555) 123-4567."
    );
    response.hangup();
    res.type("text/xml").send(response.toString());
  }
}

async function handleEmergencyState(twiml, req, res) {
  const response = new twilio.twiml.VoiceResponse();

  response.say(
    `I'm connecting you to our emergency line immediately. 
    Please stay on the line. 
    If this is a life-threatening emergency, please hang up and dial 911.`
  );

  // Dial your emergency contact number
  response.dial("+15551234567");

  // Log the emergency
  logger.warn("Emergency call transferred", {
    callerPhone: normalizePhoneNumber(req.body.From),
    timestamp: new Date().toISOString(),
  });

  res.type("text/xml").send(response.toString());
}

async function handleFollowUpState(twiml, req, res, speechResult, callerPhone) {
  const response = new twilio.twiml.VoiceResponse();

  try {
    if (!speechResult) {
      handleRetryOrExit(
        response,
        req,
        "I didn't catch that. How else may I assist you today?"
      );
      res.type("text/xml").send(response.toString());
      return;
    }

    // Generate AI response for general inquiries
    const aiResponse = await generateAIResponse({
      message: speechResult,
      history: req.session.voiceSession.history,
      phone: callerPhone,
      mode: "voice-general",
    });

    const gather = response.gather({
      input: "speech dtmf",
      action: "/api/v1/webhooks/twilio-voice",
      method: "POST",
      timeout: VOICE_TIMEOUT,
      speechTimeout: "auto",
      numDigits: 1,
    });

    gather.say(aiResponse);
    gather.say(
      "Is there anything else I can help with? Press 1 or say yes to continue."
    );

    // Update conversation history
    req.session.voiceSession.history = [
      ...req.session.voiceSession.history.slice(-MAX_CONVERSATION_HISTORY),
      { role: "user", content: speechResult },
      { role: "assistant", content: aiResponse },
    ];

    res.type("text/xml").send(response.toString());
  } catch (error) {
    logger.error("Error in follow-up state", {
      error: error.message,
      stack: error.stack,
      callerPhone,
    });

    response.say(
      "I'm having trouble answering that. Would you like to speak to a receptionist?"
    );

    const gather = response.gather({
      input: "dtmf",
      action: "/api/v1/webhooks/twilio-voice",
      method: "POST",
      numDigits: 1,
    });

    res.type("text/xml").send(response.toString());
  }
}

// Helper Functions
function handleRetryOrExit(twiml, req, message) {
  if (req.session.voiceSession.retries >= MAX_RETRIES) {
    const responses = [
      "We're having trouble connecting. Please call back later.",
      "I'm having difficulty understanding. Please call our front desk at (555) 123-4567.",
      "Let me transfer you to a receptionist who can help.",
    ];

    const randomResponse =
      responses[Math.floor(Math.random() * responses.length)];

    twiml.say(randomResponse);

    if (randomResponse.includes("transfer")) {
      twiml.dial("+15551234567");
    } else {
      twiml.hangup();
    }

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
