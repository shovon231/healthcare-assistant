const openaiClient = require("./openaiClient");
const { generateSystemPrompt } = require("./promptGenerators");
const {
  processAIResponse,
  extractAppointmentDetails,
} = require("./responseHandlers");
const { getPatientContext } = require("./data/patientContext");
const { handleCommonMisunderstandings } = require("./utils/doctorUtils");
const logger = require("../../utils/logger");

class AIService {
  constructor() {
    this.openai = openaiClient;
  }

  async generateAIResponse({ message, history = [], phone, mode = "text" }) {
    try {
      if (!message || typeof message !== "string") {
        throw new Error("Invalid message input");
      }

      const processedMessage = handleCommonMisunderstandings(message.trim());
      const patientContext = getPatientContext(phone);
      const prompt = generateSystemPrompt(
        mode,
        patientContext,
        processedMessage,
        phone
      );

      const response = await this.openai.callWithRetry(prompt, history, mode);
      const aiResponse = processAIResponse(response, mode);

      logger.info("AI Response Generated", {
        phone,
        mode,
        response:
          mode === "voice-appointment"
            ? "Appointment data"
            : aiResponse.substring(0, 100),
      });

      return aiResponse;
    } catch (error) {
      logger.error("AI Service Error", {
        error: error.message,
        stack: error.stack,
        context: { phone, mode, message: message.substring(0, 50) },
      });
      return this.generateFallbackResponse(mode, error);
    }
  }

  generateFallbackResponse(mode, error) {
    const responses = {
      "voice-appointment": `I'm having trouble processing your appointment request. ${
        error.message ||
        "Please try again with the doctor's name, date and time."
      }`,
      "voice-general":
        "I'm having trouble understanding. Please call our front desk.",
      text: "We're experiencing technical difficulties. Please try again later or call us.",
    };
    return responses[mode] || responses.text;
  }
}

module.exports = new AIService();
module.exports.AIService = AIService; // For testing
