const { AppError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const stateManager = require("../../utils/stateManager");
const aiService = require("../../services/external/ai/aiService");
const Appointment = require("../../models/Appointment");

module.exports = async (req, res, next) => {
  try {
    const { From: phoneNumber, Body: userInput } = req.body;
    const { sessionId } = req.query;

    // Get session
    const session = stateManager.getSession(sessionId);
    if (!session || session.phoneNumber !== phoneNumber) {
      return next(new AppError("Invalid session", 400));
    }

    // Process confirmation with AI
    const confirmationResult = await aiService.processConfirmation(
      phoneNumber,
      userInput,
      session.context
    );

    if (confirmationResult.confirmed) {
      // Create appointment
      const appointment = new Appointment({
        patient: confirmationResult.context.patientId,
        doctor: confirmationResult.context.doctorId,
        date: confirmationResult.context.appointmentTime,
        reason: confirmationResult.context.reason,
        status: "pending",
        source: "assistant",
      });

      await appointment.save();

      // Update session
      stateManager.updateSession(sessionId, {
        state: "completed",
        context: {
          ...session.context,
          appointmentId: appointment._id,
        },
      });

      return res.status(200).json({
        success: true,
        message: confirmationResult.message,
        appointmentId: appointment._id,
        sessionId: session.id,
        requiresManualConfirmation:
          confirmationResult.requiresManualConfirmation,
      });
    }

    // If not confirmed, update session and continue
    stateManager.updateSession(sessionId, {
      context: confirmationResult.updatedContext,
      state: confirmationResult.nextState,
    });

    res.status(200).json({
      success: true,
      message: confirmationResult.message,
      nextStep: confirmationResult.nextStep,
      sessionId: session.id,
    });
  } catch (err) {
    logger.error(`Error in confirm intent webhook: ${err.message}`);
    next(err);
  }
};
