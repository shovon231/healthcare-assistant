const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const appointmentController = require("../controllers/appointmentController");
const twilioService = require("../services/external/twilioService");

// 🏥 Patient Routes
router.post("/patients", patientController.createPatient);
router.get("/patients", patientController.getPatients);
router.put("/patients/:id", patientController.updatePatient);
router.delete("/patients/:id", patientController.deletePatient);

// 📅 Appointment Routes
router.post("/appointments", appointmentController.createAppointment);
router.get("/appointments", appointmentController.getAppointments);
router.put("/appointments/:id", appointmentController.updateAppointment);
router.delete("/appointments/:id", appointmentController.deleteAppointment);

// ✉️ Send Appointment Reminder via Twilio SMS
router.post("/appointments/:id/reminder", async (req, res) => {
  try {
    const { phone, date, time } = req.body;
    await twilioService.sendAppointmentReminder(phone, date, time);
    res
      .status(200)
      .json({ success: true, message: "Reminder sent successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ❌ Cancel Appointment via SMS (Webhook)
router.post("/appointments/cancel-via-sms", async (req, res) => {
  try {
    const { phone, appointmentId } = req.body;
    await appointmentController.cancelAppointment({
      params: { id: appointmentId },
    });
    res
      .status(200)
      .json({ success: true, message: "Appointment canceled via SMS!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔄 Reschedule Appointment via SMS (Webhook)
router.post("/appointments/reschedule-via-sms", async (req, res) => {
  try {
    const { phone, appointmentId, newDate, newTime } = req.body;
    await appointmentController.updateAppointment({
      params: { id: appointmentId },
      body: { date: newDate, time: newTime },
    });
    res
      .status(200)
      .json({ success: true, message: "Appointment rescheduled via SMS!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🚨 Error Handling: 404 Route Not Found
router.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

module.exports = router;
