// backend/src/utils/helpers.js
const normalizePhoneNumber = (phone) => {
  if (!phone) return "";
  return phone.toString().replace(/\D/g, "");
};

const validatePhoneNumber = (phone) => {
  const normalized = normalizePhoneNumber(phone);
  return normalized.length >= 10 && normalized.length <= 15;
};

module.exports = {
  normalizePhoneNumber,
  validatePhoneNumber,
};
