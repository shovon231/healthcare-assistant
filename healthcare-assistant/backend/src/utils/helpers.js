const generateRandomString = (length = 8) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input.replace(/<[^>]*>?/gm, ""); // Basic HTML sanitization
};

module.exports = {
  generateRandomString,
  sanitizeInput,
};
