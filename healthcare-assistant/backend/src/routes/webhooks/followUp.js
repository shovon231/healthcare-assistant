const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const stateManager = require("../../utils/stateManager");
const aiService = require("../../services/external/ai/aiService");

module.exports = async (req, res, next) => {
  try {
    const { From: phoneNumber, Body: userInput } = req.body;
    const { sessionId } = req.query;

    // Get session
    const session = stateManager.getSession(sessionId);
    if (!session || session.phoneNumber !== phoneNumber) {
      return next(new AppError("Invalid session", 400));
    }

    // Process follow-up with AI
    const followUpResult = await aiService.processFollowUp(
      phoneNumber,
      userInput,
      session.context
    );

    // Update session
    stateManager.updateSession(sessionId, {
      context: followUpResult.updatedContext,
      state: followUpResult.nextState,
    });

    res.status(200).json({
      success: true,
      message: followUpResult.message,
      nextStep: followUpResult.nextStep,
      sessionId: session.id,
    });
  } catch (err) {
    logger.error(`Error in follow-up webhook: ${err.message}`);
    next(err);
  }
};
