const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide the doctor's name"],
    trim: true,
  },
  specialty: {
    type: String,
    required: [true, "Please provide the doctor's specialty"],
    trim: true,
  },
  phone: {
    type: String,
  },
  email: {
    type: String,
    lowercase: true,
  },
  workingHours: {
    monday: { start: String, end: String },
    tuesday: { start: String, end: String },
    wednesday: { start: String, end: String },
    thursday: { start: String, end: String },
    friday: { start: String, end: String },
    saturday: { start: String, end: String },
    sunday: { start: String, end: String },
  },
  availableSlots: [
    {
      start: Date,
      end: Date,
      status: {
        type: String,
        enum: ["available", "booked", "blocked"],
        default: "available",
      },
    },
  ],
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
doctorSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Doctor = mongoose.model("Doctor", doctorSchema);

module.exports = Doctor;
