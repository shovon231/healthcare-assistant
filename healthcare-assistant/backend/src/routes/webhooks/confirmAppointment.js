// backend/src/routes/webhooks/confirmAppointment.js
const twilio = require("twilio");
const { STATES } = require("./constants");
const appointmentController = require("../../../controllers/appointmentController");

module.exports = {
  handleState: async (req, res, twiml) => {
    const input = (req.body.SpeechResult || req.body.Digits || "")
      .toString()
      .toLowerCase();
    const appointmentData = req.session.voiceSession.appointmentData;

    if (input.includes("1") || input.includes("yes")) {
      try {
        // Create the appointment
        await appointmentController.createAppointmentService({
          ...appointmentData,
          phone: req.body.From,
          source: "voice",
        });

        twiml.say(`Your appointment with ${appointmentData.doctor} has been confirmed. 
                   We'll send you a confirmation SMS. Thank you!`);
        twiml.hangup();
      } catch (error) {
        console.error("Appointment creation failed:", error);
        twiml.say(
          "Sorry, we couldn't book your appointment. Please try again later."
        );
        twiml.hangup();
      }
    } else {
      twiml.say("Your appointment has been cancelled. Thank you for calling.");
      twiml.hangup();
    }

    return res.type("text/xml").send(twiml.toString());
  },
};
