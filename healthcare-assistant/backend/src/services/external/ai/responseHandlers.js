const { parse, format, isBefore, isWithinInterval } = require("date-fns");
const { CLINIC_CONFIG } = require("./data/clinicConfig");
const { normalizeDoctorName } = require("./utils/doctorUtils");
const logger = require("../../utils/logger");

/**
 * Processes raw AI response based on mode
 */
function processAIResponse(response, mode) {
  validateResponseStructure(response);
  const aiResponse = extractContentFromResponse(response);

  if (mode === "voice-appointment") {
    validateAppointmentResponse(aiResponse);
  }

  return aiResponse;
}

/**
 * Extracts appointment details from AI response
 */
async function extractAppointmentDetails(aiResponse, phone) {
  const jsonData = parseAndValidateAIResponse(aiResponse);
  const { doctorName, doctorData } = findAndValidateDoctor(jsonData.doctor);
  const appointmentDate = parseAndValidateDate(jsonData.date);
  const { parsedTime } = parseAndValidateTime(jsonData.time, appointmentDate);

  verifyDoctorAvailability(doctorName, doctorData, appointmentDate, parsedTime);

  return buildAppointmentDetails(doctorName, jsonData, phone, appointmentDate);
}

// ======================
// VALIDATION HELPERS
// ======================

function validateResponseStructure(response) {
  if (!response?.choices?.[0]?.message?.content) {
    throw new Error("Invalid AI response structure");
  }
}

function extractContentFromResponse(response) {
  const content = response.choices[0].message.content.trim();
  if (!content) throw new Error("Empty AI response content");
  return content;
}

function validateAppointmentResponse(content) {
  try {
    JSON.parse(content);
  } catch (e) {
    throw new Error("AI failed to return valid JSON for appointment");
  }
}

function parseAndValidateAIResponse(aiResponse) {
  let jsonData;

  try {
    jsonData =
      typeof aiResponse === "string" ? JSON.parse(aiResponse) : aiResponse;
  } catch (e) {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No valid JSON found in AI response");
    jsonData = JSON.parse(jsonMatch[0]);
  }

  validateRequiredFields(jsonData);
  return jsonData;
}

function validateRequiredFields(jsonData) {
  const requiredFields = ["doctor", "date", "time"];
  const missingFields = requiredFields.filter((field) => !jsonData[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }
}

// ======================
// DOCTOR VALIDATION
// ======================

function findAndValidateDoctor(inputDoctorName) {
  const normalizedDoctorName = normalizeDoctorName(inputDoctorName);
  const doctorEntry = findDoctorByName(normalizedDoctorName);

  if (!doctorEntry) {
    throw new Error(
      `Doctor not found. Available: ${Object.keys(CLINIC_CONFIG.doctors).join(
        ", "
      )}`
    );
  }

  return {
    doctorName: doctorEntry[0],
    doctorData: doctorEntry[1],
  };
}

function findDoctorByName(name) {
  return Object.entries(CLINIC_CONFIG.doctors).find(([doctorName]) => {
    const nameParts = doctorName.toLowerCase().split(" ");
    return nameParts.some(
      (part) =>
        name.toLowerCase().includes(part) ||
        name.toLowerCase().includes(doctorName.toLowerCase())
    );
  });
}

// ======================
// DATE/TIME VALIDATION
// ======================

function parseAndValidateDate(inputDate) {
  try {
    const appointmentDate = parse(inputDate, "MM/dd/yyyy", new Date());

    if (isNaN(appointmentDate.getTime())) {
      throw new Error("Invalid date format");
    }

    if (isBefore(appointmentDate, new Date())) {
      throw new Error("Date cannot be in the past");
    }

    return appointmentDate;
  } catch (error) {
    throw new Error(`Invalid date: ${inputDate}. Use MM/DD/YYYY format`);
  }
}

function parseAndValidateTime(inputTime, appointmentDate) {
  try {
    const parsedTime = parse(inputTime, "h:mm a", new Date());

    if (isNaN(parsedTime.getTime())) {
      throw new Error("Invalid time format");
    }

    return {
      parsedTime,
      timeNumber: parsedTime.getHours() + parsedTime.getMinutes() / 60,
    };
  } catch (error) {
    throw new Error(`Invalid time: ${inputTime}. Use HH:MM AM/PM format`);
  }
}

// ======================
// AVAILABILITY CHECKING
// ======================

function verifyDoctorAvailability(doctorName, doctorData, date, time) {
  const dayOfWeek = format(date, "EEEE");

  checkDoctorAvailability(doctorName, doctorData, dayOfWeek);
  checkWorkingHours(doctorName, doctorData, dayOfWeek, time);
}

function checkDoctorAvailability(doctorName, doctorData, dayOfWeek) {
  if (!doctorData.availability.includes(dayOfWeek)) {
    throw new Error(`Dr. ${doctorName} not available on ${dayOfWeek}s`);
  }
}

function checkWorkingHours(doctorName, doctorData, dayOfWeek, time) {
  const dayWorkingHours = doctorData.workingHours[dayOfWeek];

  if (!dayWorkingHours) {
    throw new Error(`No hours defined for Dr. ${doctorName} on ${dayOfWeek}`);
  }

  const startTime = parse(dayWorkingHours.start, "HH:mm", new Date());
  const endTime = parse(dayWorkingHours.end, "HH:mm", new Date());

  if (!isWithinInterval(time, { start: startTime, end: endTime })) {
    throw new Error(
      `Dr. ${doctorName}'s hours on ${dayOfWeek}: ${dayWorkingHours.start} to ${dayWorkingHours.end}`
    );
  }
}

// ======================
// RESPONSE BUILDING
// ======================

function buildAppointmentDetails(doctorName, jsonData, phone, date) {
  return {
    doctor: doctorName,
    date: format(date, "MM/dd/yyyy"),
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

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/\D/g, "");
}

module.exports = {
  processAIResponse,
  extractAppointmentDetails,
  // Exported for testing
  _private: {
    parseAndValidateAIResponse,
    findAndValidateDoctor,
    parseAndValidateDate,
    parseAndValidateTime,
    verifyDoctorAvailability,
    buildAppointmentDetails,
  },
};
