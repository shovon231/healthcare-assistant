const Appointment = require("../models/Appointment");
const twilioService = require("../services/external/twilioService");
const winston = require("winston");
const { v4: uuidv4 } = require("uuid");
const chrono = require("chrono-node");

// Configure Winston Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: "logs/appointments.log",
      level: "info",
    }),
  ],
});

// Utility Functions
const generateTemporaryPatientId = (phone) => {
  const cleanPhone = phone.replace(/\D/g, "");
  return `temp-${cleanPhone}-${uuidv4().slice(0, 8)}`;
};

const parseVoiceDateTime = (timeString) => {
  try {
    const parsedDate = chrono.parseDate(timeString);
    if (parsedDate) {
      return {
        date: parsedDate.toISOString().split("T")[0],
        time: parsedDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        datetime: parsedDate,
      };
    }
  } catch (error) {
    logger.warn(`⚠️ Falling back to simple date parsing: ${error.message}`);
  }

  // Fallback to simple parsing
  const now = new Date();
  const isTomorrow = timeString.toLowerCase().includes("tomorrow");

  if (isTomorrow) {
    now.setDate(now.getDate() + 1);
  }

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
    datetime: now,
  };
};

// Service Function with Enhanced Twilio Handling
const createAppointmentService = async (appointmentData) => {
  try {
    let { patientId, doctor, date, time, phone } = appointmentData;

    // Validate required fields
    if (!doctor || !phone) {
      throw new Error("Doctor name and phone number are required");
    }

    // Handle voice commands
    if ((!date || !time) && appointmentData.voiceDateTime) {
      const parsed = parseVoiceDateTime(appointmentData.voiceDateTime);
      date = parsed.date;
      time = parsed.time;
    }

    if (!date || !time) {
      throw new Error("Date and time are required");
    }

    // Generate temporary patient ID if not provided
    if (!patientId) {
      patientId = generateTemporaryPatientId(phone);
    }

    // Create the appointment
    const appointment = await Appointment.create({
      patientId,
      doctor: doctor.trim(),
      date,
      time,
      phone: phone.replace(/\D/g, ""),
      status: "confirmed",
      source: appointmentData.source || "voice",
    });

    // Send confirmation if Twilio is configured
    try {
      if (twilioService.isConfigured()) {
        await twilioService.sendBookingConfirmation(phone, doctor, date, time);
        logger.info(`📱 Sent SMS confirmation to ${phone}`);
      } else {
        logger.warn("Twilio not configured - skipping SMS notification");
      }
    } catch (twilioError) {
      logger.error(`⚠️ Twilio notification failed: ${twilioError.message}`);
      // Don't fail the appointment creation if Twilio fails
    }

    logger.info(`✅ Appointment created for ${phone} with Dr. ${doctor}`);
    return appointment;
  } catch (error) {
    logger.error(`❌ Error in createAppointmentService: ${error.message}`);
    throw error;
  }
};

// Express Controller for HTTP Requests
const createAppointment = async (req, res) => {
  try {
    const appointment = await createAppointmentService(req.body);
    res.status(201).json({
      success: true,
      data: appointment,
      message: "Appointment created successfully",
    });
  } catch (error) {
    logger.error(`❌ Error in createAppointment: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message.includes("required")
        ? error.message
        : "Failed to create appointment",
    });
  }
};

// Get All Appointments with Enhanced Filtering
const getAppointments = async (req, res) => {
  try {
    const { doctor, phone, date, status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (doctor) query.doctor = new RegExp(doctor, "i");
    if (phone) query.phone = phone.replace(/\D/g, "");
    if (date) query.date = date;
    if (status) query.status = status;

    const options = {
      skip: (page - 1) * limit,
      limit: parseInt(limit),
      sort: { date: 1, time: 1 },
    };

    const [appointments, total] = await Promise.all([
      Appointment.find(query, null, options),
      Appointment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
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

// Update Appointment with Validation
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    const appointment = await Appointment.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Send update confirmation if Twilio is configured
    try {
      if (
        twilioService.isConfigured() &&
        (updateData.date || updateData.time || updateData.doctor)
      ) {
        await twilioService.sendBookingConfirmation(
          appointment.phone,
          appointment.doctor,
          appointment.date,
          appointment.time
        );
        logger.info(`📱 Sent update notification to ${appointment.phone}`);
      }
    } catch (twilioError) {
      logger.error(
        `⚠️ Twilio update notification failed: ${twilioError.message}`
      );
    }

    res.status(200).json({
      success: true,
      data: appointment,
      message: "Appointment updated successfully",
    });
  } catch (error) {
    logger.error(`❌ Error updating appointment: ${error.message}`);
    res.status(500).json({
      success: false,
      message:
        error.name === "ValidationError"
          ? error.message
          : "Failed to update appointment",
    });
  }
};

// Cancel Appointment with Enhanced Checks
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Send cancellation notification if Twilio is configured
    try {
      if (twilioService.isConfigured()) {
        await twilioService.sendCancellationNotification(
          appointment.phone,
          appointment.doctor,
          appointment.date,
          appointment.time
        );
        logger.info(`📱 Sent cancellation to ${appointment.phone}`);
      }
    } catch (twilioError) {
      logger.error(
        `⚠️ Twilio cancellation notification failed: ${twilioError.message}`
      );
    }

    res.status(200).json({
      success: true,
      data: appointment,
      message: "Appointment cancelled successfully",
    });
  } catch (error) {
    logger.error(`❌ Error cancelling appointment: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to cancel appointment",
    });
  }
};

// Cancel Appointment by Phone with Improved Response
const cancelAppointmentByPhone = async (phoneNumber) => {
  try {
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    const appointment = await Appointment.findOneAndUpdate(
      { phone: cleanPhone, status: { $ne: "cancelled" } },
      { status: "cancelled" },
      { new: true }
    );

    if (!appointment) {
      throw new Error("No active appointment found for this phone number.");
    }

    // Send cancellation notification if Twilio is configured
    try {
      if (twilioService.isConfigured()) {
        await twilioService.sendCancellationNotification(
          appointment.phone,
          appointment.doctor,
          appointment.date,
          appointment.time
        );
        logger.info(`📱 Sent cancellation to ${appointment.phone}`);
      }
    } catch (twilioError) {
      logger.error(
        `⚠️ Twilio cancellation notification failed: ${twilioError.message}`
      );
    }

    return {
      success: true,
      message: `Your appointment with Dr. ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been cancelled.`,
      appointment,
    };
  } catch (error) {
    logger.error(`❌ Error cancelling appointment by phone: ${error.message}`);
    throw error;
  }
};

module.exports = {
  createAppointmentService,
  createAppointment,
  getAppointments,
  updateAppointment,
  deleteAppointment,
  cancelAppointmentByPhone,
};
