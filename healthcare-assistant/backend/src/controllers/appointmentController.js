const Appointment = require("../models/Appointment");
const twilioService = require("../services/external/twilioService");
const winston = require("winston");

// Configure Winston logger (async logging)
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  ],
});

// 📅 **Create Appointment**
exports.createAppointment = async (req, res) => {
  try {
    const { patientId, date, time, phone } = req.body;

    if (!patientId || !date || !time || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    const appointment = await Appointment.create(req.body);

    // Send Booking Confirmation SMS (Try-Catch for stability)
    try {
      await twilioService.sendBookingConfirmation(phone, date, time);
    } catch (error) {
      logger.error(`⚠️ Twilio SMS Error: ${error.message}`);
    }

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    logger.error(`❌ Error creating appointment: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📜 **Get All Appointments (with Pagination & Validation)**
exports.getAppointments = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    // Convert to integers & prevent negatives
    page = Math.max(parseInt(page), 1);
    limit = Math.max(parseInt(limit), 1);

    const appointments = await Appointment.find()
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    logger.error(`❌ Error retrieving appointments: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔄 **Update Appointment**
exports.updateAppointment = async (req, res) => {
  try {
    const { date, time, phone } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found." });
    }

    // Send Update Notification SMS (Try-Catch for Twilio stability)
    try {
      await twilioService.sendBookingConfirmation(phone, date, time);
    } catch (error) {
      logger.error(`⚠️ Twilio Update SMS Error: ${error.message}`);
    }

    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    logger.error(`❌ Error updating appointment: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ❌ **Cancel Appointment (Improved Validation & SMS Notification)**
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found." });
    }

    // Validate phone number before sending cancellation SMS
    if (appointment.phone) {
      try {
        await twilioService.sendCancellationNotification(
          appointment.phone,
          appointment.date,
          appointment.time
        );
      } catch (error) {
        logger.error(`⚠️ Twilio Cancellation SMS Error: ${error.message}`);
      }
    }

    res.status(200).json({ success: true, message: "Appointment cancelled." });
  } catch (error) {
    logger.error(`❌ Error deleting appointment: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};
