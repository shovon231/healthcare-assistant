const { format } = require("date-fns");
const { CLINIC_CONFIG } = require("./data/clinicConfig");
const { normalizePhone } = require("./utils/phoneUtils");
const {
  formatOperatingHours,
  formatDoctorsList,
} = require("./utils/doctorUtils");

function generateSystemPrompt(mode, patientContext, message, phone) {
  const currentDate = format(new Date(), "EEEE, MMMM do, yyyy");
  const currentTime = format(new Date(), "h:mm a");
  const contextPrompt = buildContextPrompt(patientContext);

  const promptTemplates = {
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

  return promptTemplates[mode] || promptTemplates.text;
}

function buildContextPrompt(patientContext) {
  if (!patientContext) return "New patient";
  return `Returning patient: ${patientContext.name}
Last visit: ${patientContext.lastVisit}
Insurance: ${patientContext.insurance}`;
}

module.exports = {
  generateSystemPrompt,
  buildContextPrompt,
};
