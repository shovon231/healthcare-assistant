const logger = require("../../utils/logger");
const { AppError } = require("../../utils/errorHandler");
const cache = require("./cacheService");

const processPatientData = (patientData) => {
  try {
    // Clean and normalize patient data
    const processed = {
      ...patientData,
      name: patientData.name.trim(),
      phone: patientData.phone.replace(/\D/g, ""),
      email: patientData.email
        ? patientData.email.toLowerCase().trim()
        : undefined,
    };

    // Cache processed data
    cache.set(`patient_${processed.phone}`, processed);

    return processed;
  } catch (err) {
    logger.error(`Error processing patient data: ${err.message}`);
    throw new AppError("Failed to process patient data", 500);
  }
};

const processAppointmentData = (appointmentData) => {
  try {
    // Clean and normalize appointment data
    const processed = {
      ...appointmentData,
      reason: appointmentData.reason
        ? appointmentData.reason.trim()
        : undefined,
      notes: appointmentData.notes ? appointmentData.notes.trim() : undefined,
    };

    return processed;
  } catch (err) {
    logger.error(`Error processing appointment data: ${err.message}`);
    throw new AppError("Failed to process appointment data", 500);
  }
};

const anonymizeData = (data) => {
  try {
    if (!data) return data;

    // Simple anonymization - in production you'd use a more robust solution
    if (data.phone) {
      data.phone = data.phone.slice(0, 3) + "****" + data.phone.slice(-3);
    }
    if (data.email) {
      const [name, domain] = data.email.split("@");
      data.email = name.slice(0, 1) + "****@" + domain;
    }

    return data;
  } catch (err) {
    logger.error(`Error anonymizing data: ${err.message}`);
    return data; // Return original if anonymization fails
  }
};

module.exports = {
  processPatientData,
  processAppointmentData,
  anonymizeData,
};
