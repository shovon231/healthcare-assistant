const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const stateManager = require("../../utils/stateManager");
const aiService = require("../../services/external/ai/aiService");
const twilioService = require("../../services/external/twilioService");
const voiceUtils = require("./voiceUtils");

module.exports = async (req, res, next) => {
  try {
    const { From: phoneNumber, SpeechResult: userSpeech } = req.body;
    const { sessionId } = req.query;

    // Get or create session
    let session;
    if (sessionId) {
      session = stateManager.getSession(sessionId);
    }

    if (!session) {
      session = stateManager.createSession(phoneNumber);
      const greetingResponse = await aiService.generateGreeting(phoneNumber);

      stateManager.updateSession(session.id, {
        state: "collecting_details",
        context: {
          ...greetingResponse.context,
          currentStep: "name",
        },
      });

      const twiml = voiceUtils.generateVoiceResponse(greetingResponse.message);
      res.type("text/xml");
      return res.status(200).send(twiml);
    }

    // Process user speech based on current state
    let processingResult;
    switch (session.state) {
      case "collecting_details":
        processingResult = await aiService.processUserInput(
          phoneNumber,
          userSpeech,
          session.context.currentStep,
          session.context
        );
        break;
      case "confirming_appointment":
        processingResult = await aiService.processConfirmation(
          phoneNumber,
          userSpeech,
          session.context
        );
        break;
      default:
        processingResult = await aiService.processFollowUp(
          phoneNumber,
          userSpeech,
          session.context
        );
    }

    // Update session
    stateManager.updateSession(session.id, {
      context: processingResult.updatedContext,
      state: processingResult.nextState,
    });

    // Generate TwiML response
    const twiml = voiceUtils.generateVoiceResponse(processingResult.message);
    res.type("text/xml");
    res.status(200).send(twiml);
  } catch (err) {
    logger.error(`Error in voice webhook: ${err.message}`);
    next(err);
  }
};
