const clinicConfig = require("./data/clinicConfig");

const generatePrompt = (context, currentStep) => {
  let prompt;

  switch (currentStep) {
    case "greeting":
      prompt = `You are a virtual assistant for ${clinicConfig.clinicName}, a ${
        clinicConfig.clinicType
      } clinic. 
      The patient's name is ${context.patientName || "not provided yet"}. 
      Greet the patient and ask how you can help them today.`;
      break;

    case "collect_name":
      prompt = `Ask the patient for their full name in a friendly way.`;
      break;

    case "collect_phone":
      prompt = `Ask the patient for their phone number to continue. Make it clear this is for appointment reminders and contact purposes.`;
      break;

    case "collect_reason":
      prompt = `Ask the patient for the reason of their visit. You can mention common reasons like "routine check-up", "follow-up visit", or "specific symptoms".`;
      break;

    case "collect_preferred_time":
      prompt = `Ask the patient when they would like to schedule their appointment. 
      Provide examples like "tomorrow morning", "next Monday at 2 PM", or "as soon as possible".`;
      break;

    case "confirm_appointment":
      prompt = `Summarize the appointment details and ask for confirmation:
      - Doctor: Dr. ${context.doctorName}
      - Date/Time: ${context.appointmentTimeFormatted}
      - Reason: ${context.reason}
      
      Ask if this appointment works for them.`;
      break;

    default:
      prompt = `The patient said: "${context.lastInput}". Respond appropriately based on the conversation history.`;
  }

  return prompt;
};

module.exports = {
  generatePrompt,
};
