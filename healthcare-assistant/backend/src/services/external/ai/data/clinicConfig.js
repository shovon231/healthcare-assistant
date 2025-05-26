module.exports = {
  CLINIC_CONFIG: {
    name: "City Healthcare Center",
    address: "123 Medical Drive, Cityville, ST 12345",
    phone: "(555) 123-4567",
    operatingHours: {
      weekdays: { open: 8, close: 18 },
      saturday: { open: 9, close: 14 },
      sunday: { open: 0, close: 0 },
    },
    services: [
      "General Checkups",
      "Vaccinations",
      "Lab Tests",
      "Specialist Consultations",
      "Physical Therapy",
      "Women's Health",
    ],
    doctors: {
      "Dr. Smith": {
        specialty: "Cardiology",
        availability: ["Monday", "Wednesday", "Friday"],
        workingHours: {
          Monday: { start: "09:00", end: "17:00" },
          Wednesday: { start: "08:30", end: "16:30" },
          Friday: { start: "10:00", end: "18:00" },
        },
      },
      // ... other doctors
    },
    insurance: ["BlueCross", "Aetna", "Medicare", "Medicaid"],
  },
};
