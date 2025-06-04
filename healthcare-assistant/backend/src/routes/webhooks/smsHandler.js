const twilio = require("twilio");
const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const stateManager = require("../../utils/stateManager");
const aiService = require("../../services/external/ai/aiService");
const twilioService = require("../../services/external/twilioService");

module.exports = async (req, res, next) => {
  try {
    const { From: phoneNumber, Body: message } = req.body;

    // Check if this is part of an existing session
    let session;
    const activeSessions = Array.from(stateManager.sessions.values());
    session = activeSessions.find((s) => s.phoneNumber === phoneNumber);

    let response;
    if (session) {
      // Continue existing conversation
      switch (session.state) {
        case "collecting_details":
          response = await aiService.processUserInput(
            phoneNumber,
            message,
            session.context.currentStep,
            session.context
          );
          break;
        case "confirming_appointment":
          response = await aiService.processConfirmation(
            phoneNumber,
            message,
            session.context
          );
          break;
        default:
          response = await aiService.processFollowUp(
            phoneNumber,
            message,
            session.context
          );
      }

      // Update session
      stateManager.updateSession(session.id, {
        context: response.updatedContext,
        state: response.nextState,
      });

      // Send response via SMS
      await twilioService.sendSMS(phoneNumber, response.message);
    } else {
      // Start new conversation
      response = await aiService.generateGreeting(phoneNumber);

      // Create new session
      const newSession = stateManager.createSession(phoneNumber);
      stateManager.updateSession(newSession.id, {
        state: "collecting_details",
        context: {
          ...response.context,
          currentStep: "name",
        },
      });

      // Send greeting via SMS
      await twilioService.sendSMS(phoneNumber, response.message);
    }

    // Twilio expects an empty response for webhooks
    res.type("text/xml");
    res.status(200).send("<Response></Response>");
  } catch (err) {
    logger.error(`Error in SMS webhook: ${err.message}`);
    next(err);
  }
};
