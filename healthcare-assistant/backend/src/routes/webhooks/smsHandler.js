const twilio = require("twilio");
const { MAX_CONVERSATION_HISTORY } = require("./constants");
const { generateAIResponse } = require("../../services/aiService");
const appointmentController = require("../../controllers/appointmentController");
const { normalizePhoneNumber } = require("../../utils/helpers");

module.exports = {
  handleSmsWebhook: async (req, res) => {
    const twiml = new twilio.twiml.MessagingResponse();
    const messageBody = req.body.Body.trim();
    const senderPhone = normalizePhoneNumber(req.body.From);

    try {
      req.session.conversation = req.session.conversation || {
        history: [],
        context: {},
      };

      const aiResponse = await generateAIResponse({
        message: messageBody,
        history: req.session.conversation.history,
        phone: senderPhone,
        mode: "text",
      });

      let responseMessage = aiResponse;
      if (aiResponse.includes("[APPOINTMENT]")) {
        const details = extractAppointmentDetails(aiResponse, senderPhone);
        if (details) {
          await appointmentController.createAppointmentService(details);
          responseMessage = `✅ Appointment confirmed with Dr. ${details.doctor} on ${details.date} at ${details.time}.`;
        }
      }

      req.session.conversation.history = [
        ...req.session.conversation.history.slice(-MAX_CONVERSATION_HISTORY),
        { role: "user", content: messageBody },
        { role: "assistant", content: responseMessage },
      ];

      twiml.message(responseMessage);
    } catch (error) {
      logger.error("SMS Processing Error", { error, phone: senderPhone });
      twiml.message(
        "We're experiencing technical difficulties. Please try again later."
      );
    }

    res.type("text/xml").send(twiml.toString());
  },
};
