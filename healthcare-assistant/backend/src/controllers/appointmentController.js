const Appointment = require("../models/Appointment");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const { AppError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { formatDate } = require("../utils/dateUtils");
const stateManager = require("../utils/stateManager");
const aiService = require("../services/external/ai/aiService");

const createAppointment = async (req, res, next) => {
  try {
    const { patientId, doctorId, date, reason } = req.body;

    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return next(new AppError("Patient not found", 404));
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return next(new AppError("Doctor not found", 404));
    }

    // Check if slot is available
    const conflictingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: { $lte: new Date(date) },
      endDate: { $gt: new Date(date) },
      status: { $in: ["pending", "confirmed"] },
    });

    if (conflictingAppointment) {
      return next(new AppError("Time slot is not available", 400));
    }

    const appointment = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      date,
      reason,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    logger.error(`Error creating appointment: ${err.message}`);
    next(err);
  }
};

const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return next(new AppError("Doctor ID and date are required", 400));
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return next(new AppError("Doctor not found", 404));
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);

    // Get existing appointments for the day
    const appointments = await Appointment.find({
      doctor: doctorId,
      date: { $gte: startDate, $lt: endDate },
      status: { $in: ["pending", "confirmed"] },
    }).sort("date");

    // Generate available slots (simplified - in production you'd use the doctor's working hours)
    const slots = [];
    const startTime = new Date(startDate);
    startTime.setHours(9, 0, 0, 0); // 9 AM
    const endTime = new Date(startDate);
    endTime.setHours(17, 0, 0, 0); // 5 PM

    let currentTime = new Date(startTime);
    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime);
      slotEnd.setMinutes(currentTime.getMinutes() + 30);

      // Check if this slot is booked
      const isBooked = appointments.some((appt) => {
        return appt.date < slotEnd && new Date(appt.endDate) > currentTime;
      });

      if (!isBooked) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(slotEnd),
          formattedTime: formatDate(currentTime, "h:mm A"),
        });
      }

      currentTime.setMinutes(currentTime.getMinutes() + 30);
    }

    res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (err) {
    logger.error(`Error getting available slots: ${err.message}`);
    next(err);
  }
};

const confirmAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { sessionId } = req.body;

    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status: "confirmed" },
      { new: true, runValidators: true }
    ).populate("patient doctor");

    if (!appointment) {
      return next(new AppError("Appointment not found", 404));
    }

    // If this was from a voice session, clean up
    if (sessionId) {
      stateManager.deleteSession(sessionId);
    }

    // Here you would typically send a confirmation to the patient
    // via SMS, email, etc. (implementation would use Twilio, etc.)

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    logger.error(`Error confirming appointment: ${err.message}`);
    next(err);
  }
};

const handleVoiceAppointment = async (req, res, next) => {
  try {
    const { phoneNumber, intent, context } = req.body;

    // Get or create session
    let session;
    if (context.sessionId) {
      session = stateManager.getSession(context.sessionId);
    }

    if (!session) {
      session = stateManager.createSession(phoneNumber);
    }

    // Process with AI service
    const aiResponse = await aiService.processVoiceInteraction(
      phoneNumber,
      intent,
      context,
      session
    );

    // Update session
    stateManager.updateSession(session.id, {
      state: aiResponse.nextState,
      context: aiResponse.updatedContext,
    });

    res.status(200).json({
      success: true,
      data: aiResponse,
      sessionId: session.id,
    });
  } catch (err) {
    logger.error(`Error handling voice appointment: ${err.message}`);
    next(err);
  }
};

module.exports = {
  createAppointment,
  getAvailableSlots,
  confirmAppointment,
  handleVoiceAppointment,
};
