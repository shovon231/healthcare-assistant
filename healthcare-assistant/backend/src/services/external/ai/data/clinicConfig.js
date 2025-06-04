module.exports = {
  clinicName: "City Health Clinic",
  clinicType: "multi-specialty",
  address: "123 Main St, Anytown, USA",
  phone: "+1 (555) 123-4567",
  workingHours: "Monday to Friday, 9:00 AM to 5:00 PM",
  autoConfirmAppointments: false, // Set to true for fully automated booking
  availableDoctors: [
    {
      id: "dr_smith",
      name: "Dr. Smith",
      specialty: "General Practice",
      availableDays: ["Monday", "Wednesday", "Friday"],
    },
    {
      id: "dr_jones",
      name: "Dr. Jones",
      specialty: "Pediatrics",
      availableDays: ["Tuesday", "Thursday"],
    },
  ],
  commonReasons: [
    "Annual check-up",
    "Follow-up visit",
    "Vaccination",
    "Blood test",
    "Prescription refill",
    "New health concern",
  ],
};
