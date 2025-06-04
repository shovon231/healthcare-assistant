// src/services/appointmentService.js
const mongoose = require("mongoose");
const logger = require("@utils/logger");
const Doctor = require("@models/Doctor");
const Appointment = require("@models/Appointment");

module.exports = {
  /**
   * Check doctor availability
   * @param {string} doctorName - Name of the doctor (without "Dr." prefix)
   * @param {string} date - Appointment date in YYYY-MM-DD format
   * @param {string} time - Appointment time in HH:MM format (24-hour)
   * @returns {Promise<boolean>} - True if available, false if not
   */
  checkAvailability: async (doctorName, date, time) => {
    try {
      // 1. Find the doctor
      const doctor = await Doctor.findOne({
        name: { $regex: new RegExp(doctorName, "i") },
      }).select("_id workingHours");

      if (!doctor) {
        logger.warn(`Doctor not found: ${doctorName}`);
        return false;
      }

      // 2. Check if time is within working hours
      const appointmentTime = new Date(`${date}T${time}:00`);
      const dayOfWeek = appointmentTime.getDay(); // 0 (Sunday) to 6 (Saturday)
      const workingDay = doctor.workingHours.find((wh) => wh.day === dayOfWeek);

      if (!workingDay || !workingDay.isWorking) {
        logger.warn(`Doctor ${doctorName} not working on this day`);
        return false;
      }

      const timeParts = time.split(":");
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);

      if (
        hour < workingDay.startHour ||
        (hour === workingDay.endHour && minute > 0) ||
        hour > workingDay.endHour
      ) {
        logger.warn(`Time ${time} outside working hours`);
        return false;
      }

      // 3. Check for existing appointments
      const existingAppointment = await Appointment.findOne({
        doctor: doctor._id,
        date: new Date(date),
        timeSlot: time,
        status: { $in: ["confirmed", "pending"] },
      });

      if (existingAppointment) {
        logger.warn(`Time slot already booked: ${time}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error checking availability", { error });
      throw error;
    }
  },

  /**
   * Book an appointment
   * @param {Object} appointmentData - Appointment details
   * @param {string} phone - Patient phone number
   * @returns {Promise<Object>} - Created appointment
   */
  bookAppointment: async (appointmentData, phone) => {
    try {
      const doctor = await Doctor.findOne({
        name: { $regex: new RegExp(appointmentData.doctor, "i") },
      });

      if (!doctor) {
        throw new Error("Doctor not found");
      }

      const appointment = new Appointment({
        doctor: doctor._id,
        patientPhone: phone,
        date: new Date(appointmentData.date),
        timeSlot: appointmentData.time,
        type: "voice",
        status: "confirmed",
      });

      await appointment.save();

      // Add to doctor's appointments
      doctor.appointments.push(appointment._id);
      await doctor.save();

      logger.info(`Appointment booked for ${phone} with Dr. ${doctor.name}`);
      return appointment;
    } catch (error) {
      logger.error("Error booking appointment", { error });
      throw error;
    }
  },

  /**
   * Get available time slots for a doctor on a specific date
   * @param {string} doctorName
   * @param {string} date
   * @returns {Promise<Array<string>>} - Array of available times
   */
  getAvailableSlots: async (doctorName, date) => {
    try {
      const doctor = await Doctor.findOne({
        name: { $regex: new RegExp(doctorName, "i") },
      }).populate("appointments");

      if (!doctor) {
        throw new Error("Doctor not found");
      }

      const workingDay = doctor.workingHours.find(
        (wh) => wh.day === new Date(date).getDay()
      );

      if (!workingDay || !workingDay.isWorking) {
        return [];
      }

      // Generate all possible slots for the day
      const allSlots = [];
      for (let h = workingDay.startHour; h < workingDay.endHour; h++) {
        allSlots.push(`${h}:00`, `${h}:30`);
      }

      // Get booked slots
      const bookedAppointments = await Appointment.find({
        doctor: doctor._id,
        date: new Date(date),
        status: { $in: ["confirmed", "pending"] },
      });

      const bookedSlots = bookedAppointments.map((a) => a.timeSlot);

      // Filter available slots
      return allSlots.filter((slot) => !bookedSlots.includes(slot));
    } catch (error) {
      logger.error("Error getting available slots", { error });
      throw error;
    }
  },
};
