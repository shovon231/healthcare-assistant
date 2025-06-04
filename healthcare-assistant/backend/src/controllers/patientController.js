const Patient = require("../models/Patient");
const { AppError } = require("../utils/errorHandler");
const logger = require("../utils/logger");
const { validatePhoneNumber } = require("../utils/phoneUtils");

const createPatient = async (req, res, next) => {
  try {
    const { name, phone, email, dateOfBirth } = req.body;

    // Validate phone number
    if (!validatePhoneNumber(phone)) {
      return next(new AppError("Invalid phone number", 400));
    }

    // Check if patient already exists
    const existingPatient = await Patient.findOne({ phone });
    if (existingPatient) {
      return res.status(200).json({
        success: true,
        data: existingPatient,
        message: "Patient already exists",
      });
    }

    const patient = await Patient.create({
      name,
      phone,
      email,
      dateOfBirth,
    });

    res.status(201).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    logger.error(`Error creating patient: ${err.message}`);
    next(err);
  }
};

const getPatientByPhone = async (req, res, next) => {
  try {
    const { phone } = req.params;

    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return next(new AppError("Patient not found", 404));
    }

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    logger.error(`Error getting patient by phone: ${err.message}`);
    next(err);
  }
};

const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove immutable fields
    delete updates.phone;
    delete updates.createdAt;

    const patient = await Patient.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!patient) {
      return next(new AppError("Patient not found", 404));
    }

    res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (err) {
    logger.error(`Error updating patient: ${err.message}`);
    next(err);
  }
};

module.exports = {
  createPatient,
  getPatientByPhone,
  updatePatient,
};
