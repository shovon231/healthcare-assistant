const { OpenAI } = require("openai");
require("dotenv").config();
const logger = require("../../utils/logger");

// Initialize OpenAI with configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID || null,
  timeout: 10000, // 10 second timeout
});

// Clinic configuration with enhanced doctor data
const CLINIC_CONFIG = {
  name: "City Healthcare Center",
  hours: "Monday-Friday: 8am-6pm, Saturday: 9am-2pm",
  services: [
    "General Checkups",
    "Vaccinations",
    "Lab Tests",
    "Specialist Consultations",
  ],
  doctors: {
    "Dr. Smith": {
      specialty: "Cardiology",
      availability: ["Monday", "Wednesday", "Friday"],
    },
    "Dr. Johnson": {
      specialty: "Pediatrics",
      availability: ["Tuesday", "Thursday", "Saturday"],
    },
    "Dr. Lee": {
      specialty: "General Medicine",
      availability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
  },
};

// Pre-format doctors list
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
 * Enhanced AI response generator with mode-specific handling
 */
const generateAIResponse = async ({
  message,
  history = [],
  phone,
  mode = "text",
}) => {
  try {
    // Prepare dynamic content
    const currentDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // System prompts with enhanced instructions
    const PROMPTS = {
      VOICE_APPOINTMENT: `You are an appointment booking assistant at City Healthcare Center. Extract the following details from the user's request in JSON format:
{
  "doctor": "Full name (must be one of: Dr. Smith, Dr. Johnson, Dr. Lee)",
  "date": "MM/DD/YYYY (must be today or later)",
  "time": "HH:MM AM/PM (during clinic hours: ${CLINIC_CONFIG.hours})",
  "reason": "Brief reason for visit",
  "patientPhone": "${normalizePhone(phone)}"
}

Important Rules:
1. The doctor must be one of: Dr. Smith, Dr. Johnson, or Dr. Lee
2. Date must be in MM/DD/YYYY format and must be today or in the future
3. Time must be during clinic hours
4. Today's date is ${currentDate}
5. If the user doesn't specify a doctor, choose the most appropriate one based on:
   - Dr. Smith for heart-related issues
   - Dr. Johnson for children's health
   - Dr. Lee for general health concerns

Available Doctors:
${formatDoctorsList()}

User Request: "${message}"`,

      GENERAL: `You are Clara, an AI healthcare assistant at ${
        CLINIC_CONFIG.name
      }.
Current Date: ${currentDate}
Clinic Hours: ${CLINIC_CONFIG.hours}
Available Doctors: ${formatDoctorsList()}
Services Offered: ${CLINIC_CONFIG.services.join(", ")}

Guidelines:
1. For appointments: Extract ALL details before confirming
2. Be concise in voice mode
3. Always verify doctor availability
4. Maintain professional tone

Conversation History:
${formatHistory(history)}

Patient Request: "${message}"`,
    };

    // Select prompt based on mode
    const prompt =
      mode === "voice-appointment"
        ? PROMPTS.VOICE_APPOINTMENT
        : PROMPTS.GENERAL;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        ...validHistoryEntries(history),
      ],
      temperature: mode === "voice" ? 0.3 : 0.7,
      max_tokens: mode === "voice" ? 150 : 300,
      response_format:
        mode === "voice-appointment" ? { type: "json_object" } : undefined,
    });

    // Process and return response
    const aiResponse = response.choices[0]?.message?.content?.trim();
    if (!aiResponse) throw new Error("Empty AI response");

    logAIResponse(phone, aiResponse, mode);
    return aiResponse;
  } catch (error) {
    logger.error("AI Service Error", {
      error: error.message,
      stack: error.stack,
      context: { phone, mode },
    });
    return generateFallbackResponse(mode);
  }
};

/**
 * Enhanced appointment details extractor with validation
 */
const extractAppointmentDetails = (aiResponse, phone) => {
  try {
    let jsonData;

    // Try to parse as pure JSON first
    try {
      jsonData = JSON.parse(aiResponse);
    } catch (e) {
      // Fallback to extracting JSON from text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonData = JSON.parse(jsonMatch[0]);
    }

    if (!jsonData) {
      throw new Error("No valid appointment data found in response");
    }

    // Validate required fields
    const requiredFields = ["doctor", "date", "time"];
    const missingFields = requiredFields.filter((field) => !jsonData[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
    }

    // Find matching doctor (more flexible matching)
    const doctorEntry = Object.entries(CLINIC_CONFIG.doctors).find(
      ([name, data]) => {
        // Check if the doctor name is mentioned in the response
        const nameParts = name.toLowerCase().split(" ");
        return nameParts.some(
          (part) =>
            jsonData.doctor.toLowerCase().includes(part) ||
            jsonData.doctor.toLowerCase().includes(name.toLowerCase())
        );
      }
    );

    if (!doctorEntry) {
      throw new Error(
        `Doctor not found in our system. Available doctors are: ${Object.keys(
          CLINIC_CONFIG.doctors
        ).join(", ")}`
      );
    }

    const [doctorName, doctorData] = doctorEntry;

    // Verify date format and ensure it's not in the past
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(jsonData.date)) {
      throw new Error("Invalid date format. Use MM/DD/YYYY");
    }

    const appointmentDate = new Date(jsonData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (appointmentDate < today) {
      throw new Error("Appointment date cannot be in the past");
    }

    return {
      doctor: doctorName,
      date: jsonData.date,
      time: jsonData.time,
      reason: jsonData.reason || "General consultation",
      phone: normalizePhone(phone),
      source: "voice", // Using correct enum value
      status: "pending-confirmation",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Appointment Extraction Error", {
      error: error.message,
      input: aiResponse,
      stack: error.stack,
    });
    return null;
  }
};

// Helper Functions
function formatHistory(history) {
  return Array.isArray(history)
    ? history.map((entry) => `${entry.role}: ${entry.content}`).join("\n")
    : "";
}

function validHistoryEntries(history) {
  return Array.isArray(history)
    ? history.filter((entry) => entry?.role && entry?.content)
    : [];
}

function logAIResponse(phone, response, mode) {
  logger.info(`AI Response [${mode.toUpperCase()}]`, {
    phone,
    responsePreview: response.substring(0, 100),
    responseLength: response.length,
  });
}

function normalizePhone(phone) {
  const normalized = phone?.toString().replace(/\D/g, "") || "";
  if (normalized.length < 10) throw new Error("Invalid phone number");
  return normalized;
}

function generateFallbackResponse(mode) {
  const responses = {
    voice:
      "I'm having trouble understanding. Please try again or call our front desk.",
    "voice-appointment":
      "I couldn't process your appointment request. Please provide the doctor's full name, date and time.",
    text: "We're experiencing technical difficulties. Please try again later.",
  };
  return responses[mode] || responses.text;
}

module.exports = {
  generateAIResponse,
  extractAppointmentDetails,
  CLINIC_CONFIG,
};
