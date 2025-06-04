const axios = require("axios");
const logger = require("../../utils/logger");
const { AppError } = require("../../utils/errorHandler");

// This service would integrate with an OSI (Open Systems Integration) layer
// in a real healthcare system for EHR/EMR integration

const getPatientRecord = async (patientId) => {
  try {
    // In a real implementation, this would call the OSI layer
    // For now, we'll return mock data
    return {
      patientId,
      name: "John Doe",
      dob: "1980-01-01",
      lastVisit: "2023-06-15",
      allergies: ["Penicillin"],
      medications: ["Lisinopril 10mg daily"],
    };
  } catch (err) {
    logger.error(`Error getting patient record: ${err.message}`);
    throw new AppError("Failed to get patient record", 500);
  }
};

const createAppointmentRecord = async (appointmentData) => {
  try {
    // In a real implementation, this would create a record in the EMR
    logger.info(
      `Appointment record created in EMR: ${JSON.stringify(appointmentData)}`
    );
    return { success: true, emrId: `emr-${Date.now()}` };
  } catch (err) {
    logger.error(`Error creating appointment record: ${err.message}`);
    throw new AppError("Failed to create appointment record", 500);
  }
};

module.exports = {
  getPatientRecord,
  createAppointmentRecord,
};
