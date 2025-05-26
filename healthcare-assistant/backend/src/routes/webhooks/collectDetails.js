// src/routes/webhooks/voiceHandlers/collectDetails.js
const { handleRetryOrExit, getRandomResponse } = require("../voiceUtils");
const appointmentService = require("../../../services/appointmentService");

module.exports = {
  handleState: async (req, res, twiml, callerPhone) => {
    const speechResult = req.body.SpeechResult || "";

    if (!speechResult) {
      return handleRetryOrExit(
        twiml,
        req,
        "I didn't catch that. Please tell me the doctor's name and preferred time."
      );
    }

    try {
      // 1. Process with AI service
      const aiResponse = await generateAIResponse({
        message: speechResult,
        phone: callerPhone,
        mode: "voice-appointment",
      });

      // 2. Extract and validate details
      const details = extractAppointmentDetails(aiResponse);

      // 3. Check doctor availability
      const isAvailable = await appointmentService.checkAvailability(
        details.doctor.replace(/^Dr\.\s*/i, ""), // Remove duplicate Dr. prefix
        details.date,
        details.time
      );

      if (!isAvailable) {
        throw new Error(`Dr. ${details.doctor} is not available at that time`);
      }

      // 4. Proceed to confirmation
      req.session.voiceSession.appointmentData = details;
      req.session.voiceSession.state = STATES.CONFIRM_APPOINTMENT;

      const confirmTwiml = new twilio.twiml.VoiceResponse();
      const gather = confirmTwiml.gather({
        input: "speech dtmf",
        timeout: VOICE_TIMEOUT,
        numDigits: 1,
      });

      gather.say(
        `Confirming appointment with Dr. ${details.doctor} on ${details.date} at ${details.time}. Press 1 to confirm.`
      );

      return res.type("text/xml").send(confirmTwiml.toString());
    } catch (error) {
      logger.error("Appointment collection failed", { error });

      const retryTwiml = new twilio.twiml.VoiceResponse();
      const gather = retryTwiml.gather({
        input: "speech",
        timeout: VOICE_TIMEOUT,
      });

      if (error.message.includes("not available")) {
        gather.say(`${error.message}. Please suggest a different time.`);
      } else {
        gather.say(
          "I couldn't process that. Please say the doctor's name and your preferred time again."
        );
      }

      req.session.voiceSession.retries += 1;
      return res.type("text/xml").send(retryTwiml.toString());
    }
  },
};
