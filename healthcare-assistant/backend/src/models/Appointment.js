const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: String, // Changed from ObjectId to String
      required: true,
    },
    doctor: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    source: {
      type: String,
      enum: ["web", "voice", "sms"],
      default: "web",
    },
  },
  { timestamps: true }
);

// Add index for frequently queried fields
AppointmentSchema.index({ phone: 1 });
AppointmentSchema.index({ doctor: 1 });
AppointmentSchema.index({ date: 1 });
AppointmentSchema.index({ status: 1 });

module.exports = mongoose.model("Appointment", AppointmentSchema);
