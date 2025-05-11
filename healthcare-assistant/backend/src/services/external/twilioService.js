const twilio = require("twilio");
const winston = require("winston");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

// Configure Winston for logging errors
const logger = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/twilio-errors.log" }),
  ],
});

/**
 * Send SMS messages
 */
const sendSMS = async (to, message) => {
  try {
    const response = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    return response;
  } catch (error) {
    logger.error(`❌ Error sending SMS: ${error.message}`);
    throw error;
  }
};

/**
 * Make automated phone calls (Twilio Voice API)
 */
const makeCall = async (to, twimlUrl) => {
  try {
    const response = await twilioClient.calls.create({
      url: twimlUrl,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    return response;
  } catch (error) {
    logger.error(`❌ Error making call: ${error.message}`);
    throw error;
  }
};

/**
 * Send booking confirmation SMS
 */
const sendBookingConfirmation = async (to, date, time) => {
  const message = `✅ Your appointment is confirmed for ${date} at ${time}. Reply CANCEL to cancel or RESCHEDULE to change.`;
  return sendSMS(to, message);
};

/**
 * Send automatic appointment reminder SMS (one day before)
 */
const sendAppointmentReminder = async (to, date, time) => {
  const message = `⏰ Reminder: Your appointment is tomorrow at ${time} on ${date}. Reply RESCHEDULE to change.`;
  return sendSMS(to, message);
};

module.exports = {
  sendSMS,
  makeCall,
  sendBookingConfirmation,
  sendAppointmentReminder,
};
