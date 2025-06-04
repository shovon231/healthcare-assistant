const Doctor = require("../../../models/Doctor");
const { formatDate } = require("../../../../utils/dateUtils");
const logger = require("../../../../utils/logger");

const getAvailableDoctors = async (specialty, date) => {
  try {
    const query = {};
    if (specialty) {
      query.specialty = new RegExp(specialty, "i");
    }

    const doctors = await Doctor.find(query);

    // Filter by availability on the requested date
    const availableDoctors = [];
    const dayOfWeek = new Date(date).getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[dayOfWeek];

    for (const doctor of doctors) {
      if (doctor.workingHours[dayName] && doctor.workingHours[dayName].start) {
        availableDoctors.push(doctor);
      }
    }

    return availableDoctors;
  } catch (err) {
    logger.error(`Error getting available doctors: ${err.message}`);
    throw err;
  }
};

const getDoctorAvailableSlots = async (doctorId, date) => {
  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    // Get day of week
    const dayOfWeek = new Date(date).getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[dayOfWeek];

    // Check if doctor works this day
    if (!doctor.workingHours[dayName] || !doctor.workingHours[dayName].start) {
      return [];
    }

    // Get existing appointments for this doctor on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    const appointments = await Appointment.find({
      doctor: doctorId,
      date: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ["pending", "confirmed"] },
    }).sort("date");

    // Generate available slots
    const slots = [];
    const [startHour, startMinute] = doctor.workingHours[dayName].start
      .split(":")
      .map(Number);
    const [endHour, endMinute] = doctor.workingHours[dayName].end
      .split(":")
      .map(Number);

    const slotDate = new Date(date);
    slotDate.setHours(startHour, startMinute, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(endHour, endMinute, 0, 0);

    while (slotDate < endDate) {
      const slotEnd = new Date(slotDate);
      slotEnd.setMinutes(slotDate.getMinutes() + 30);

      // Check if this slot is booked
      const isBooked = appointments.some((appt) => {
        return appt.date < slotEnd && new Date(appt.endDate) > slotDate;
      });

      if (!isBooked) {
        slots.push({
          start: new Date(slotDate),
          end: new Date(slotEnd),
          formattedTime: formatDate(slotDate, "h:mm A"),
        });
      }

      slotDate.setMinutes(slotDate.getMinutes() + 30);
    }

    return slots;
  } catch (err) {
    logger.error(`Error getting doctor available slots: ${err.message}`);
    throw err;
  }
};

module.exports = {
  getAvailableDoctors,
  getDoctorAvailableSlots,
};
