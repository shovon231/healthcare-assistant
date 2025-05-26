const {
  format,
  parse,
  addHours,
  setHours,
  addDays,
  startOfWeek,
} = require("date-fns");
const { CLINIC_CONFIG } = require("../data/clinicConfig");

/**
 * Common doctor name misunderstandings and corrections
 */
const COMMON_MISUNDERSTANDINGS = {
  doctorNames: {
    "Dr. Smth": "Dr. Smith",
    "Dr. John": "Dr. Johnson",
    "Dr. Li": "Dr. Lee",
    "Dr. Brown": "Dr. Johnson",
    "Dr. Wilson": "Dr. Smith",
    "Dr. Smit": "Dr. Smith",
    "Dr. Johns": "Dr. Johnson",
  },
  timePhrases: {
    "this afternoon": () => format(addHours(new Date(), 2), "h:mm a"),
    "tomorrow morning": () => format(setHours(new Date(), 9), "h:mm a"),
    "next week": () => format(addDays(startOfWeek(new Date()), "MM/dd/yyyy")),
    "as soon as possible": () => getNextAvailableSlot(),
    "first available": () => getNextAvailableSlot(),
  },
};

/**
 * Normalizes doctor names to standard format
 * @param {string} inputName - Raw doctor name input
 * @returns {string} Normalized name (e.g. "Dr. Smith")
 * @throws {Error} If input is invalid
 */
function normalizeDoctorName(inputName) {
  if (!inputName || typeof inputName !== "string") {
    throw new Error("Doctor name must be a non-empty string");
  }

  // Remove duplicate prefixes and trim
  let normalized = inputName.replace(/^(Dr\.?\s*)+/i, "").trim();

  // Capitalize properly
  normalized = normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

  return `Dr. ${normalized}`;
}

/**
 * Handles common user input misunderstandings
 * @param {string} input - Raw user input
 * @returns {string} Corrected input
 */
function handleCommonMisunderstandings(input) {
  let processed = input;

  // Correct doctor names
  for (const [wrongName, correctName] of Object.entries(
    COMMON_MISUNDERSTANDINGS.doctorNames
  )) {
    if (processed.includes(wrongName)) {
      processed = processed.replace(wrongName, correctName);
    }
  }

  // Resolve time phrases
  for (const [phrase, resolver] of Object.entries(
    COMMON_MISUNDERSTANDINGS.timePhrases
  )) {
    if (processed.includes(phrase)) {
      processed = processed.replace(phrase, resolver());
    }
  }

  return processed;
}

/**
 * Formats operating hours for display
 * @returns {string} Human-readable hours string
 */
function formatOperatingHours() {
  const { weekdays, saturday, sunday } = CLINIC_CONFIG.operatingHours;
  return (
    `Weekdays: ${weekdays.open}am-${weekdays.close}pm, ` +
    `Saturday: ${saturday.open}am-${saturday.close}pm, ` +
    `Sunday: ${sunday.open === 0 ? "Closed" : "Open"}`
  );
}

/**
 * Formats doctors list for display
 * @returns {string} Formatted list of doctors
 */
function formatDoctorsList() {
  return Object.entries(CLINIC_CONFIG.doctors)
    .map(
      ([name, data]) =>
        `${name} (${data.specialty}) - Available: ${data.availability.join(
          ", "
        )}`
    )
    .join("\n");
}

/**
 * Gets next available appointment slot
 * @returns {string} Formatted time string
 */
function getNextAvailableSlot() {
  const now = new Date();
  let checkDate = new Date(now);

  for (let i = 0; i < 14; i++) {
    checkDate = addDays(checkDate, 1);
    const dayOfWeek = format(checkDate, "EEEE");

    const availableDoctor = Object.entries(CLINIC_CONFIG.doctors).find(
      ([_, data]) => data.availability.includes(dayOfWeek)
    );

    if (availableDoctor) {
      const workingHours = availableDoctor[1].workingHours[dayOfWeek];
      return format(parse(workingHours.start, "HH:mm", checkDate), "h:mm a");
    }
  }

  return "No available slots in next 2 weeks";
}

module.exports = {
  normalizeDoctorName,
  handleCommonMisunderstandings,
  formatOperatingHours,
  formatDoctorsList,
  getNextAvailableSlot,
  COMMON_MISUNDERSTANDINGS,
};
