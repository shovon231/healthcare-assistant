const twilio = require("twilio");
const { STATES } = require("../constants");
const { getRandomGreeting, handleRetryOrExit } = require("../voiceUtils");
const confirmIntentHandler = require("./confirmIntent");

module.exports = {
  handleState: async (req, res) => {
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

      const gather = twiml.gather({
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
        { voice: "woman", language: "en-US" },
        `${getRandomGreeting()} Are you calling to book an appointment? 
        <break time="0.5s"/> 
        You can say 'yes' or press 1 to continue. 
        For emergencies, say 'emergency' immediately.`
      );

      req.session.voiceSession.state = STATES.CONFIRM_INTENT;
      res.type("text/xml").send(twiml.toString());
    } catch (error) {
      logger.error("Greeting state error", { error, callerPhone });
      handleRetryOrExit(
        twiml,
        req,
        "We're having technical difficulties. Please try again."
      );
      res.type("text/xml").send(twiml.toString());
    }
  },
};
