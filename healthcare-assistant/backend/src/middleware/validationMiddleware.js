const { body, validationResult } = require("express-validator");

const validatePatient = [
  body("name").notEmpty().withMessage("Name is required"),
  body("age").isInt({ min: 0 }).withMessage("Age must be a valid number"),
  body("email").isEmail().withMessage("Invalid email format"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

const validateAppointment = [
  body("patientId").notEmpty().withMessage("Patient ID is required"),
  body("date").isISO8601().withMessage("Invalid date format"),
  body("time").notEmpty().withMessage("Time is required"),
  body("status")
    .isIn(["pending", "confirmed", "cancelled"])
    .withMessage("Invalid status"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

module.exports = { validatePatient, validateAppointment };
