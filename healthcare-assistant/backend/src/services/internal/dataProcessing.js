const processPatientData = (patient) => {
  return {
    id: patient._id,
    name: patient.name.trim(),
    age: patient.age,
    email: patient.email.toLowerCase(),
    phone: patient.phone.replace(/\D/g, ""), // Remove non-numeric characters
    appointmentCount: patient.appointments.length,
  };
};

const processAppointmentData = (appointment) => {
  return {
    id: appointment._id,
    patientId: appointment.patientId,
    date: new Date(appointment.date).toISOString(),
    time: appointment.time,
    status: appointment.status,
  };
};

module.exports = { processPatientData, processAppointmentData };
