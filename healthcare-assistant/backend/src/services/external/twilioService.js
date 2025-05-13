const twilio = require("twilio");
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/twilio.log" }),
  ],
});

// Check if Twilio is properly configured
function isConfigured() {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_PHONE_NUMBER
  );
}

// Send booking confirmation
async function sendBookingConfirmation(phone, doctor, date, time) {
  if (!isConfigured()) {
    throw new Error("Twilio credentials not configured");
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const response = await client.messages.create({
      body: `Your appointment with ${doctor} is confirmed for ${date} at ${time}.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+${phone.replace(/\D/g, "")}`,
    });

    logger.info(`📱 Sent confirmation to ${phone} (SID: ${response.sid})`);
    return response;
  } catch (error) {
    logger.error(`❌ Twilio SMS Error: ${error.message}`);
    throw error;
  }
}

// Send cancellation notification
async function sendCancellationNotification(phone, doctor, date, time) {
  if (!isConfigured()) {
    logger.warn("Twilio not configured - skipping cancellation SMS");
    return null;
  }

  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const response = await client.messages.create({
      body: `Your appointment with ${doctor} on ${date} at ${time} has been cancelled.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+${phone.replace(/\D/g, "")}`,
    });

    logger.info(`📱 Sent cancellation to ${phone} (SID: ${response.sid})`);
    return response;
  } catch (error) {
    logger.error(`❌ Twilio Cancellation Error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  isConfigured,
  sendBookingConfirmation,
  sendCancellationNotification,
};
