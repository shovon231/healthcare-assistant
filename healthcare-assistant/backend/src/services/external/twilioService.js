const twilio = require("twilio");
const logger = require("../../utils/logger");
const { AppError } = require("../../utils/errorHandler");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendSMS = async (to, body) => {
  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    logger.info(`SMS sent to ${to}: ${message.sid}`);
    return message;
  } catch (err) {
    logger.error(`Error sending SMS: ${err.message}`);
    throw new AppError("Failed to send SMS", 500);
  }
};

const initiateVoiceCall = async (to, url) => {
  try {
    const call = await client.calls.create({
      url,
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
    });

    logger.info(`Voice call initiated to ${to}: ${call.sid}`);
    return call;
  } catch (err) {
    logger.error(`Error initiating voice call: ${err.message}`);
    throw new AppError("Failed to initiate voice call", 500);
  }
};

module.exports = {
  sendSMS,
  initiateVoiceCall,
};
