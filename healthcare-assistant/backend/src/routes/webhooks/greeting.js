const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const stateManager = require("../../utils/stateManager");
const aiService = require("../../services/external/ai/aiService");

module.exports = async (req, res, next) => {
  try {
    const { From: phoneNumber } = req.body;

    // Create a new session
    const session = stateManager.createSession(phoneNumber);

    // Get greeting response from AI service
    const greetingResponse = await aiService.generateGreeting(phoneNumber);

    // Update session state
    stateManager.updateSession(session.id, {
      state: "collecting_details",
      context: {
        ...greetingResponse.context,
        currentStep: "name",
      },
    });

    res.status(200).json({
      success: true,
      message: greetingResponse.message,
      sessionId: session.id,
      nextStep: "collect_name",
    });
  } catch (err) {
    logger.error(`Error in greeting webhook: ${err.message}`);
    next(err);
  }
};
