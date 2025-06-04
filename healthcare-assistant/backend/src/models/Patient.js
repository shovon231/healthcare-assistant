const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide your name"],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, "Please provide your phone number"],
    unique: true,
    validate: {
      validator: function (v) {
        return /^\+?[\d\s-]{10,}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid phone number!`,
    },
  },
  email: {
    type: String,
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email"],
  },
  dateOfBirth: {
    type: Date,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
  },
  medicalHistory: {
    type: String,
    trim: true,
  },
  insurance: {
    provider: String,
    policyNumber: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
patientSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
