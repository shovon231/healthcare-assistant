const twilio = require("twilio");
const { STATES } = require("../constants");
const { handleRetryOrExit } = require("../voiceUtils");
const collectDetailsHandler = require("./collectDetails");
const followUpHandler = require("./followUp");

module.exports = {
  handleState: async (req, res, twiml, callerPhone) => {
    const input = (req.body.SpeechResult || req.body.Digits || "")
      .toString()
      .toLowerCase();

    if (!input) {
      handleRetryOrExit(
        twiml,
        req,
        "I didn't hear your response. Please say yes or no, or press 1."
      );
      return res.type("text/xml").send(twiml.toString());
    }

    // Emergency detection
    if (input.includes("emergency") || input.includes("urgent")) {
      req.session.voiceSession.state = STATES.EMERGENCY;
      return emergencyHandler.handleState(req, res, twiml, callerPhone);
    }

    const positiveResponse = ["yes", "yeah", "yep", "book", "1"].some((word) =>
      input.includes(word)
    );

    if (positiveResponse) {
      req.session.voiceSession.history = [
        ...req.session.voiceSession.history.slice(-MAX_CONVERSATION_HISTORY),
        { role: "user", content: "Yes, I want to book an appointment" },
        { role: "assistant", content: "Requesting appointment details" },
      ];

      req.session.voiceSession.state = STATES.COLLECT_DETAILS;
      return collectDetailsHandler.handleState(req, res, twiml, callerPhone);
    } else {
      req.session.voiceSession.state = STATES.FOLLOW_UP;
      return followUpHandler.handleState(req, res, twiml, callerPhone);
    }
  },
};
