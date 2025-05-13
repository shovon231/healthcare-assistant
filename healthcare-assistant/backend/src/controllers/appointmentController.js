const Appointment = require("../models/Appointment");
const twilioService = require("../services/external/twilioService");
const winston = require("winston");
const { v4: uuidv4 } = require("uuid");

// ✅ Configure Winston Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "logs/appointments.log",
      level: "info",
    }),
  ],
});

// Utility Functions
const generateTemporaryPatientId = (phone) => {
  return `temp-${phone.replace(/\D/g, "")}-${uuidv4().slice(0, 8)}`;
};

const parseVoiceDateTime = (timeString) => {
  // Simple parsing - you may want to use a library like chrono-node for better parsing
  const now = new Date();
  const isTomorrow = timeString.toLowerCase().includes("tomorrow");

  if (isTomorrow) {
    now.setDate(now.getDate() + 1);
  }

  // Extract time (very basic example)
  const timeMatch = timeString.match(/(\d{1,2})(?::\d{2})?\s?(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const period = timeMatch[2] ? timeMatch[2].toLowerCase() : null;

    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;

    now.setHours(hours);
    now.setMinutes(0);
  }

  return {
    date: now.toISOString().split("T")[0],
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
};

// 🛎️ Service Function for Direct Calls
exports.createAppointmentService = async (appointmentData) => {
  try {
    let { patientId, doctor, date, time, phone } = appointmentData;

    // Handle voice commands that combine date and time
    if (!date && !time && appointmentData.voiceDateTime) {
      const parsed = parseVoiceDateTime(appointmentData.voiceDateTime);
      date = parsed.date;
      time = parsed.time;
    }

    // Generate temporary patient ID if not provided
    if (!patientId && phone) {
      patientId = generateTemporaryPatientId(phone);
    }

    if (!doctor || !date || !time || !phone) {
      throw new Error(
        "Missing required fields: doctor, date, time, and phone are required."
      );
    }

    const appointment = await Appointment.create({
      patientId,
      doctor,
      date,
      time,
      phone,
      status: "confirmed",
      source: appointmentData.source || "voice", // Track how appointment was created
    });

    await twilioService.sendBookingConfirmation(phone, doctor, date, time);

    logger.info(
      `✅ Appointment created for ${phone} with Dr. ${doctor} on ${date} at ${time}`
    );
    return appointment;
  } catch (error) {
    logger.error(`❌ Error in createAppointmentService: ${error.message}`);
    throw error;
  }
};

// 📅 Express Controller for HTTP Requests
exports.createAppointment = async (req, res) => {
  try {
    const appointment = await this.createAppointmentService(req.body);
    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    logger.error(`❌ Error in createAppointment: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 📜 Get All Appointments
exports.getAppointments = async (req, res) => {
  try {
    const { doctor, page = 1, limit = 10 } = req.query;
    const query = doctor ? { doctor } : {};

    const appointments = await Appointment.find(query)
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: await Appointment.countDocuments(query),
      },
    });
  } catch (error) {
    logger.error(`❌ Error retrieving appointments: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve appointments",
    });
  }
};

// 🔄 Update Appointment
exports.updateAppointment = async (req, res) => {
  try {
    const { date, time, phone, doctor } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    await twilioService.sendBookingConfirmation(phone, doctor, date, time);
    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    logger.error(`❌ Error updating appointment: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment",
    });
  }
};

// ❌ Cancel Appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    await twilioService.sendCancellationNotification(
      appointment.phone,
      appointment.doctor,
      appointment.date,
      appointment.time
    );

    res.status(200).json({
      success: true,
      message: "Appointment cancelled.",
    });
  } catch (error) {
    logger.error(`❌ Error deleting appointment: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
    });
  }
};

// 📞 Cancel Appointment by Phone (for Twilio webhook)
exports.cancelAppointmentByPhone = async (phoneNumber) => {
  try {
    const appointment = await Appointment.findOneAndDelete({
      phone: phoneNumber,
    });

    if (!appointment) {
      throw new Error("No appointment found for this phone number.");
    }

    await twilioService.sendCancellationNotification(
      appointment.phone,
      appointment.doctor,
      appointment.date,
      appointment.time
    );

    return `Your appointment with Dr. ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been cancelled.`;
  } catch (error) {
    logger.error(`❌ Error cancelling appointment by phone: ${error.message}`);
    throw error;
  }
};
