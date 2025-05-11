const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    age: { type: Number, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, required: true },
    appointments: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", PatientSchema);
