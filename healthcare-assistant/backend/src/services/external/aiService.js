const { OpenAI } = require("openai");
require("dotenv").config();
const logger = require("../../utils/logger");
const {
  format,
  parse,
  isBefore,
  addDays,
  addHours,
  setHours,
  startOfWeek,
  isWithinInterval,
} = require("date-fns");

// Initialize OpenAI with enhanced configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID || null,
  timeout: 15000, // Increased timeout to 15 seconds
  maxRetries: 2,
});

// Enhanced clinic configuration with more detailed doctor data
const CLINIC_CONFIG = {
  name: "City Healthcare Center",
  address: "123 Medical Drive, Cityville, ST 12345",
  phone: "(555) 123-4567",
  operatingHours: {
    weekdays: { open: 8, close: 18 }, // 8am-6pm
    saturday: { open: 9, close: 14 }, // 9am-2pm
    sunday: { open: 0, close: 0 }, // Closed
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
    "Dr. Johnson": {
      specialty: "Pediatrics",
      availability: ["Tuesday", "Thursday", "Saturday"],
      workingHours: {
        Tuesday: { start: "08:00", end: "15:00" },
        Thursday: { start: "09:30", end: "17:30" },
        Saturday: { start: "09:00", end: "14:00" },
      },
    },
    "Dr. Lee": {
      specialty: "General Medicine",
      availability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      workingHours: {
        Monday: { start: "08:00", end: "18:00" },
        Tuesday: { start: "08:00", end: "18:00" },
        Wednesday: { start: "08:00", end: "18:00" },
        Thursday: { start: "08:00", end: "18:00" },
        Friday: { start: "08:00", end: "18:00" },
      },
    },
  },
  insurance: ["BlueCross", "Aetna", "Medicare", "Medicaid"],
};

// Mock patient context for demonstration
const PATIENT_CONTEXT = {
  "+15551234567": {
    name: "John Doe",
    lastAppointment: "05/15/2023",
    insurance: "BlueCross",
  },
};

// Enhanced common misunderstandings with more examples
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
 * Enhanced AI response generator with improved error handling and validation
 */
const generateAIResponse = async ({
  message,
  history = [],
  phone,
  mode = "text",
}) => {
  try {
    // Validate input parameters
    if (!message || typeof message !== "string") {
      throw new Error("Invalid message input");
    }

    // Prepare dynamic context
    const currentDate = format(new Date(), "EEEE, MMMM do, yyyy");
    const currentTime = format(new Date(), "h:mm a");

    // Process message for common misunderstandings
    const processedMessage = handleCommonMisunderstandings(message.trim());

    // Get patient context with enhanced validation
    const patientContext = getPatientContext(phone);
    const contextPrompt = buildContextPrompt(patientContext);

    // Generate appropriate system prompt based on mode
    const prompt = generateSystemPrompt(
      mode,
      currentDate,
      currentTime,
      contextPrompt,
      processedMessage,
      phone
    );

    // Call OpenAI API with retry logic
    const response = await callOpenAIWithRetry(prompt, history, mode);

    // Validate and process response
    const aiResponse = processAIResponse(response, mode);

    // Log successful response
    logAIResponse(phone, aiResponse, mode);

    return aiResponse;
  } catch (error) {
    logger.error("AI Service Error", {
      error: error.message,
      stack: error.stack,
      context: { phone, mode, message: message.substring(0, 50) },
    });
    return generateFallbackResponse(mode, error);
  }
};

/**
 * Enhanced appointment details extractor with comprehensive validation
 */
const extractAppointmentDetails = async (aiResponse, phone) => {
  try {
    // Parse and validate the AI response
    const jsonData = parseAndValidateAIResponse(aiResponse);

    // Find and validate the doctor
    const { doctorName, doctorData } = findAndValidateDoctor(jsonData.doctor);

    // Parse and validate the appointment date
    const appointmentDate = parseAndValidateDate(jsonData.date);

    // Parse and validate the appointment time
    const { parsedTime, timeNumber } = parseAndValidateTime(
      jsonData.time,
      appointmentDate
    );

    // Verify doctor availability for the specific time
    verifyDoctorAvailability(
      doctorName,
      doctorData,
      appointmentDate,
      parsedTime
    );

    // Build and return the appointment details
    return buildAppointmentDetails(
      doctorName,
      jsonData,
      phone,
      appointmentDate
    );
  } catch (error) {
    logger.error("Appointment Extraction Error", {
      error: error.message,
      input:
        typeof aiResponse === "string"
          ? aiResponse.substring(0, 200)
          : aiResponse,
      stack: error.stack,
    });
    throw error; // Re-throw for calling function to handle
  }
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Handle common misunderstandings in user input
 */
function handleCommonMisunderstandings(input) {
  let processed = input;

  // Handle doctor name misunderstandings
  for (const [wrongName, correctName] of Object.entries(
    COMMON_MISUNDERSTANDINGS.doctorNames
  )) {
    if (processed.includes(wrongName)) {
      processed = processed.replace(wrongName, correctName);
    }
  }

  // Handle time phrase misunderstandings
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
 * Enhanced doctor name normalization and validation
 */
function normalizeDoctorName(inputName) {
  if (!inputName) throw new Error("Doctor name is required");

  // Remove any duplicate "Dr." prefixes
  let normalized = inputName.replace(/^(Dr\.?\s*)+/i, "").trim();

  // Capitalize properly
  normalized = normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

  // Add single "Dr." prefix
  return `Dr. ${normalized}`;
}

/**
 * Parse and validate AI response
 */
function parseAndValidateAIResponse(aiResponse) {
  let jsonData;

  try {
    // First try to parse as pure JSON
    jsonData =
      typeof aiResponse === "string" ? JSON.parse(aiResponse) : aiResponse;
  } catch (e) {
    // Fallback to extracting JSON from text
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON data found in AI response");
    jsonData = JSON.parse(jsonMatch[0]);
  }

  // Validate required fields
  const requiredFields = ["doctor", "date", "time"];
  const missingFields = requiredFields.filter((field) => !jsonData[field]);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  return jsonData;
}

/**
 * Find and validate doctor information
 */
function findAndValidateDoctor(inputDoctorName) {
  const normalizedDoctorName = normalizeDoctorName(inputDoctorName);

  // Find matching doctor with flexible matching
  const doctorEntry = Object.entries(CLINIC_CONFIG.doctors).find(([name]) => {
    const nameParts = name.toLowerCase().split(" ");
    return nameParts.some(
      (part) =>
        normalizedDoctorName.toLowerCase().includes(part) ||
        normalizedDoctorName.toLowerCase().includes(name.toLowerCase())
    );
  });

  if (!doctorEntry) {
    throw new Error(
      `Doctor "${normalizedDoctorName}" not found. Available doctors: ${Object.keys(
        CLINIC_CONFIG.doctors
      ).join(", ")}`
    );
  }

  return {
    doctorName: doctorEntry[0],
    doctorData: doctorEntry[1],
  };
}

/**
 * Parse and validate appointment date
 */
function parseAndValidateDate(inputDate) {
  try {
    const appointmentDate = parse(inputDate, "MM/dd/yyyy", new Date());
    if (isNaN(appointmentDate.getTime())) {
      throw new Error("Invalid date format");
    }

    // Check if date is in the past
    if (isBefore(appointmentDate, new Date())) {
      throw new Error("Appointment date cannot be in the past");
    }

    return appointmentDate;
  } catch (error) {
    throw new Error(`Invalid date: ${inputDate}. Please use MM/DD/YYYY format`);
  }
}

/**
 * Parse and validate appointment time
 */
function parseAndValidateTime(inputTime, appointmentDate) {
  try {
    // Parse the time string
    const parsedTime = parse(inputTime, "h:mm a", new Date());
    if (isNaN(parsedTime.getTime())) {
      throw new Error("Invalid time format");
    }

    // Convert to 24-hour number for comparison
    const timeNumber = parsedTime.getHours() + parsedTime.getMinutes() / 60;

    return { parsedTime, timeNumber };
  } catch (error) {
    throw new Error(
      `Invalid time: ${inputTime}. Please use HH:MM AM/PM format`
    );
  }
}

/**
 * Verify doctor availability for specific date and time
 */
function verifyDoctorAvailability(
  doctorName,
  doctorData,
  appointmentDate,
  parsedTime
) {
  const dayOfWeek = format(appointmentDate, "EEEE");

  // Check if doctor works on this day
  if (!doctorData.availability.includes(dayOfWeek)) {
    throw new Error(`Dr. ${doctorName} is not available on ${dayOfWeek}s`);
  }

  // Check if time is within doctor's working hours
  const dayWorkingHours = doctorData.workingHours[dayOfWeek];
  if (!dayWorkingHours) {
    throw new Error(
      `Dr. ${doctorName} has no working hours defined for ${dayOfWeek}`
    );
  }

  const startTime = parse(dayWorkingHours.start, "HH:mm", new Date());
  const endTime = parse(dayWorkingHours.end, "HH:mm", new Date());

  if (!isWithinInterval(parsedTime, { start: startTime, end: endTime })) {
    throw new Error(
      `Dr. ${doctorName}'s hours on ${dayOfWeek} are ${dayWorkingHours.start} to ${dayWorkingHours.end}`
    );
  }
}

/**
 * Build final appointment details object
 */
function buildAppointmentDetails(doctorName, jsonData, phone, appointmentDate) {
  return {
    doctor: doctorName,
    date: format(appointmentDate, "MM/dd/yyyy"),
    time: format(parse(jsonData.time, "h:mm a", new Date()), "h:mm a"),
    reason: jsonData.reason || "General consultation",
    phone: normalizePhone(phone),
    source: "voice",
    status: "pending-confirmation",
    timestamp: new Date().toISOString(),
    metadata: {
      extractedFrom: jsonData,
      processedAt: new Date().toISOString(),
    },
  };
}

/**
 * Enhanced OpenAI API call with retry logic
 */
async function callOpenAIWithRetry(prompt, history, mode, retries = 2) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        ...validHistoryEntries(history),
      ],
      temperature: mode.startsWith("voice") ? 0.3 : 0.7,
      max_tokens: mode.startsWith("voice") ? 150 : 300,
      response_format:
        mode === "voice-appointment" ? { type: "json_object" } : undefined,
    });

    return response;
  } catch (error) {
    if (retries > 0 && error.status !== 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (3 - retries)));
      return callOpenAIWithRetry(prompt, history, mode, retries - 1);
    }
    throw error;
  }
}

/**
 * Generate system prompt based on mode
 */
function generateSystemPrompt(
  mode,
  currentDate,
  currentTime,
  contextPrompt,
  message,
  phone
) {
  const basePrompt = {
    "voice-appointment": `You are Clara, an appointment booking assistant at ${
      CLINIC_CONFIG.name
    }. 
Current Date: ${currentDate}, Time: ${currentTime}
${contextPrompt}

Extract appointment details in JSON format with these REQUIRED fields:
{
  "doctor": "Full name (must be one of: ${Object.keys(
    CLINIC_CONFIG.doctors
  ).join(", ")})",
  "date": "MM/DD/YYYY (must be today or later)",
  "time": "HH:MM AM/PM (during clinic hours)",
  "reason": "Brief reason for visit",
  "patientPhone": "${normalizePhone(phone)}"
}

RULES:
1. DOCTOR MUST be one of our doctors
2. DATE must be valid and not in the past
3. TIME must be during clinic hours
4. If unsure, ask for clarification
5. For "next available", calculate actual next slot

User Request: "${message}"`,

    "voice-general": `You are Clara, an AI healthcare assistant at ${
      CLINIC_CONFIG.name
    }.
Current Date: ${currentDate}
${contextPrompt}

Respond concisely to general inquiries about:
- Clinic hours: ${formatOperatingHours()}
- Services: ${CLINIC_CONFIG.services.join(", ")}
- Doctors: ${formatDoctorsList()}
- Insurance: ${CLINIC_CONFIG.insurance.join(", ")}

For appointments, direct to booking flow.

User Question: "${message}"`,

    text: `You are Clara, an AI healthcare assistant at ${CLINIC_CONFIG.name}.
Current Date: ${currentDate}
${contextPrompt}

Guidelines:
- Respond professionally but conversationally
- Use simple language and occasional emojis (✅, ⚕️)
- For appointments, confirm details before showing [APPOINTMENT] tag
- Keep responses under 300 characters

User Message: "${message}"`,
  };

  return basePrompt[mode] || basePrompt.text;
}

/**
 * Build context prompt for patient
 */
function buildContextPrompt(patientContext) {
  if (!patientContext) return "New patient";

  return `Returning patient: ${patientContext.name}
Last visit: ${patientContext.lastVisit}
Insurance: ${patientContext.insurance}`;
}

/**
 * Enhanced patient context builder
 */
function getPatientContext(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  // In a real implementation, this would come from a database
  const patientData = PATIENT_CONTEXT[normalized];
  if (!patientData) return null;

  return {
    ...patientData,
    isReturning: true,
    lastVisit: patientData.lastAppointment
      ? format(
          parse(patientData.lastAppointment, "MM/dd/yyyy", new Date()),
          "MMMM do, yyyy"
        )
      : "Never",
  };
}

/**
 * Format operating hours for display
 */
function formatOperatingHours() {
  const { weekdays, saturday, sunday } = CLINIC_CONFIG.operatingHours;
  return `Weekdays: ${weekdays.open}am-${weekdays.close}pm, Saturday: ${saturday.open}am-${saturday.close}pm, Sunday: Closed`;
}

/**
 * Format doctors list for display
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
 * Process AI response with validation
 */
function processAIResponse(response, mode) {
  const aiResponse = response.choices[0]?.message?.content?.trim();
  if (!aiResponse) throw new Error("Empty AI response");

  // Additional validation for appointment mode
  if (mode === "voice-appointment") {
    try {
      JSON.parse(aiResponse); // Verify it's valid JSON
    } catch (e) {
      throw new Error("AI failed to return valid JSON for appointment");
    }
  }

  return aiResponse;
}

/**
 * Validate history entries
 */
function validHistoryEntries(history) {
  if (!Array.isArray(history)) return [];

  return history.filter(
    (entry) => entry && typeof entry === "object" && entry.role && entry.content
  );
}

/**
 * Normalize phone number format
 */
function normalizePhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/\D/g, "");
}

/**
 * Log AI response
 */
function logAIResponse(phone, response, mode) {
  logger.info("AI Response Generated", {
    phone: normalizePhone(phone),
    mode,
    response:
      mode === "voice-appointment"
        ? "Appointment data"
        : response.substring(0, 100),
  });
}

/**
 * Get next available appointment slot
 */
function getNextAvailableSlot() {
  const now = new Date();
  let checkDate = new Date(now);

  // Check next 14 days
  for (let i = 0; i < 14; i++) {
    checkDate = addDays(checkDate, 1);
    const dayOfWeek = format(checkDate, "EEEE");

    // Find first available doctor for this day
    const availableDoctor = Object.entries(CLINIC_CONFIG.doctors).find(
      ([name, data]) => {
        return data.availability.includes(dayOfWeek);
      }
    );

    if (availableDoctor) {
      const doctor = availableDoctor[0];
      const workingHours = availableDoctor[1].workingHours[dayOfWeek];
      return format(parse(workingHours.start, "HH:mm", checkDate), "h:mm a");
    }
  }

  return "No available slots in next 2 weeks";
}

/**
 * Enhanced fallback response generator
 */
function generateFallbackResponse(mode, error) {
  const responses = {
    "voice-appointment": `I'm having trouble processing your appointment request. ${
      error.message || "Please try again with the doctor's name, date and time."
    }`,
    "voice-general":
      "I'm having trouble understanding. Please call our front desk at " +
      CLINIC_CONFIG.phone,
    text:
      "We're experiencing technical difficulties. Please try again later or call us at " +
      CLINIC_CONFIG.phone,
  };

  return responses[mode] || responses.text;
}

// Export the enhanced service
module.exports = {
  generateAIResponse,
  extractAppointmentDetails,
  CLINIC_CONFIG,
  normalizeDoctorName, // Exported for testing
};
