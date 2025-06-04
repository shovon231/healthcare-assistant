const twilio = require("twilio");

const formatPhoneNumber = (phoneNumber) => {
  // Basic formatting - you might want to use a library like libphonenumber for more robust handling
  return phoneNumber.replace(/\D/g, ""); // Remove all non-digit characters
};

const validatePhoneNumber = (phoneNumber) => {
  // Simple validation - consider using a more robust solution for production
  const cleaned = formatPhoneNumber(phoneNumber);
  return cleaned.length >= 10;
};

module.exports = {
  formatPhoneNumber,
  validatePhoneNumber,
};
