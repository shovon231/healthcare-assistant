const twilio = require("twilio");
const winston = require("winston");

// ✅ Twilio Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// ✅ Configure Winston Logger
const logger = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/twilio-errors.log" }),
  ],
});

/**
 * 📢 Send Booking Confirmation SMS
 */
const sendBookingConfirmation = async (to, doctor, date, time) => {
  try {
    const message = `✅ Your appointment with Dr. ${doctor} is confirmed for ${date} at ${time}. Reply CANCEL to cancel or RESCHEDULE to change.`;
    const response = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to,
    });
    return response;
  } catch (error) {
    logger.error(`⚠️ Twilio SMS Error: ${error.message}`);
    throw error;
  }
};

/**
 * 🔔 Send Automatic Appointment Reminder (One Day Before)
 */
const sendAppointmentReminder = async (to, doctor, date, time) => {
  try {
    const message = `⏰ Reminder: You have an appointment with Dr. ${doctor} tomorrow at ${time} on ${date}. Reply RESCHEDULE to change.`;
    const response = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to,
    });
    return response;
  } catch (error) {
    logger.error(`⚠️ Twilio Reminder SMS Error: ${error.message}`);
    throw error;
  }
};

/**
 * ❌ Send Appointment Cancellation Notification
 */
const sendCancellationNotification = async (to, doctor, date, time) => {
  try {
    const message = `❌ Your appointment with Dr. ${doctor} scheduled for ${date} at ${time} has been cancelled. Reply BOOK to schedule a new one.`;
    const response = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to,
    });
    return response;
  } catch (error) {
    logger.error(`⚠️ Twilio Cancellation SMS Error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  sendBookingConfirmation,
  sendAppointmentReminder,
  sendCancellationNotification,
};
