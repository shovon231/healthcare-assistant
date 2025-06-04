const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  validate,
  appointmentValidationRules,
  patientValidationRules,
} = require("../middleware/validationMiddleware");
const {
  createAppointment,
  getAvailableSlots,
  confirmAppointment,
  handleVoiceAppointment,
} = require("../controllers/appointmentController");
const {
  createPatient,
  getPatientByPhone,
  updatePatient,
} = require("../controllers/patientController");

// Patient routes
router.post("/patients", validate(patientValidationRules()), createPatient);
router.get("/patients/phone/:phone", getPatientByPhone);
router.put("/patients/:id", protect, updatePatient);

// Appointment routes
router.post(
  "/appointments",
  protect,
  validate(appointmentValidationRules()),
  createAppointment
);
router.get("/appointments/slots", protect, getAvailableSlots);
router.put("/appointments/:appointmentId/confirm", protect, confirmAppointment);

// AI Assistant routes
router.post("/assistant/appointments", handleVoiceAppointment);

module.exports = router;
