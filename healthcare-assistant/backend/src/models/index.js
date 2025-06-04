const mongoose = require("mongoose");
const Appointment = require("./Appointment");
const Patient = require("./Patient");
const Doctor = require("./Doctor");

module.exports = {
  mongoose,
  Appointment,
  Patient,
  Doctor,
};
