const { STATES } = require("./constants");
const logger = require("../../utils/logger");

module.exports = {
  handleRetryOrExit: (twiml, req, message) => {
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
  },

  resetVoiceSession: (twiml, req, res) => {
    twiml.say("Let's start over.");
    req.session.voiceSession = {
      history: [],
      state: STATES.GREETING,
      appointmentData: {},
      retries: 0,
    };
    res.type("text/xml").send(twiml.toString());
  },

  getRandomGreeting: () => {
    const greetings = [
      "Thank you for calling City Healthcare Center, this is Clara speaking.",
      "Hello and welcome to City Healthcare, I'm Clara. How can I help you today?",
      "Good day! You've reached City Healthcare Center, Clara speaking.",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  },

  getRandomConfirmation: (details) => {
    const confirmations = [
      `I have that as Dr. ${details.doctor} on ${details.date} at ${details.time}. Is this correct?`,
      `Let me confirm: Dr. ${details.doctor} on ${details.date} at ${details.time}. Does that work for you?`,
      `So that's with Dr. ${details.doctor} on ${details.date} at ${details.time}. Can I book this for you?`,
    ];
    return confirmations[Math.floor(Math.random() * confirmations.length)];
  },
};
