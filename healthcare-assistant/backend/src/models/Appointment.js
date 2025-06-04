const mongoose = require("mongoose");
const { formatDate } = require("../utils/dateUtils");

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending",
  },
  source: {
    type: String,
    enum: ["web", "phone", "assistant", "walk-in"],
    default: "assistant",
  },
  notes: {
    type: String,
    trim: true,
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

// Pre-save hook to calculate endDate
appointmentSchema.pre("save", function (next) {
  if (this.isModified("date")) {
    this.endDate = new Date(this.date.getTime() + 30 * 60000); // 30 minutes duration
  }
  next();
});

// Virtual for formatted date
appointmentSchema.virtual("formattedDate").get(function () {
  return formatDate(this.date);
});

// Indexes
appointmentSchema.index({ patient: 1 });
appointmentSchema.index({ doctor: 1 });
appointmentSchema.index({ date: 1 });
appointmentSchema.index({ status: 1 });

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
