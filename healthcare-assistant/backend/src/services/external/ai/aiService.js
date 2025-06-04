const openaiClient = require("./openaiClient");
const promptGenerators = require("./promptGenerators");
const responseHandler = require("./responseHandlers");
const Patient = require("../../../models/Patient");
const Doctor = require("../../../models/Doctor");
const Appointment = require("../../../models/Appointment");
const { formatDate } = require("../../../utils/dateUtils");
const { validatePhoneNumber } = require("../../../utils/phoneUtils");
const logger = require("../../../utils/logger");
const {
  STATES,
  STEPS,
  INTENTS,
} = require("../../../routes/webhooks/constants");
const clinicConfig = require("./data/clinicConfig");

const generateGreeting = async (phoneNumber) => {
  try {
    // Check if patient exists
    const patient = await Patient.findOne({ phone: phoneNumber });

    let context = {};
    let message;

    if (patient) {
      context.patientId = patient._id;
      context.patientName = patient.name;
      message = `Hello ${patient.name}, welcome back to ${clinicConfig.clinicName}. How can I help you today?`;
    } else {
      message = `Welcome to ${clinicConfig.clinicName}. I'm your virtual assistant. May I have your name please?`;
    }

    return {
      message,
      context,
    };
  } catch (err) {
    logger.error(`Error generating greeting: ${err.message}`);
    throw err;
  }
};

const processUserInput = async (
  phoneNumber,
  userInput,
  currentStep,
  currentContext
) => {
  try {
    let updatedContext = { ...currentContext };
    let nextStep = currentStep;
    let message = "";
    let nextState = STATES.COLLECTING_DETAILS;

    switch (currentStep) {
      case STEPS.NAME:
        updatedContext.patientName = userInput;
        message = `Nice to meet you, ${userInput}. What's the best phone number to reach you?`;
        nextStep = STEPS.PHONE;
        break;

      case STEPS.PHONE:
        if (!validatePhoneNumber(userInput)) {
          message =
            "That doesn't look like a valid phone number. Please try again.";
          break;
        }

        updatedContext.phoneNumber = userInput;

        // Check if patient exists
        const patient = await Patient.findOne({ phone: userInput });
        if (patient) {
          updatedContext.patientId = patient._id;
          updatedContext.patientName = patient.name;
        }

        message = "What is the reason for your visit today?";
        nextStep = STEPS.REASON;
        break;

      case STEPS.REASON:
        updatedContext.reason = userInput;
        message =
          'When would you like to schedule your appointment? You can say things like "tomorrow morning" or "next Monday at 2 PM".';
        nextStep = STEPS.PREFERRED_DATE;
        break;

      case STEPS.PREFERRED_DATE:
        // Use AI to parse the date/time input
        const dateParseResult = await openaiClient.parseDateTime(userInput);

        if (!dateParseResult.dateTime) {
          message =
            'I couldn\'t understand that date and time. Could you please try again? For example, you can say "next Tuesday at 2 PM".';
          break;
        }

        updatedContext.preferredDateTime = dateParseResult.dateTime;

        // Find available doctors and slots
        const availableDoctors = await Doctor.find({});
        if (availableDoctors.length === 0) {
          message =
            "Sorry, there are no doctors available. Please try again later.";
          nextState = STATES.FOLLOW_UP;
          break;
        }

        // For simplicity, pick the first doctor (in a real app, you'd match specialty, etc.)
        updatedContext.doctorId = availableDoctors[0]._id;
        updatedContext.doctorName = availableDoctors[0].name;

        // Find available slots near the preferred time
        const slots = await Appointment.findAvailableSlots(
          updatedContext.doctorId,
          new Date(dateParseResult.dateTime)
        );

        if (slots.length === 0) {
          message = `Sorry, Dr. ${availableDoctors[0].name} isn't available at that time. Would you like to try a different time?`;
          break;
        }

        // Pick the closest available slot
        updatedContext.appointmentTime = slots[0].start;
        updatedContext.appointmentTimeFormatted = formatDate(
          slots[0].start,
          "dddd, MMMM Do [at] h:mm A"
        );

        message = `I have an opening with Dr. ${availableDoctors[0].name} on ${updatedContext.appointmentTimeFormatted}. The reason is for ${updatedContext.reason}. Does this work for you?`;
        nextStep = STEPS.CONFIRMATION;
        nextState = STATES.CONFIRMING_APPOINTMENT;
        break;

      default:
        message = "I didn't understand that. Could you please repeat?";
    }

    return {
      message,
      updatedContext,
      nextStep,
      nextState,
    };
  } catch (err) {
    logger.error(`Error processing user input: ${err.message}`);
    throw err;
  }
};

const processConfirmation = async (phoneNumber, userInput, currentContext) => {
  try {
    // Use AI to determine if the response is affirmative
    const confirmationResult = await openaiClient.determineConfirmation(
      userInput
    );

    if (confirmationResult.confirmed) {
      // Create or update patient record
      let patient;
      if (currentContext.patientId) {
        patient = await Patient.findById(currentContext.patientId);
      } else {
        patient = new Patient({
          name: currentContext.patientName,
          phone: currentContext.phoneNumber,
        });
        await patient.save();
        currentContext.patientId = patient._id;
      }

      // Create appointment
      const appointment = new Appointment({
        patient: currentContext.patientId,
        doctor: currentContext.doctorId,
        date: currentContext.appointmentTime,
        reason: currentContext.reason,
        status: clinicConfig.autoConfirmAppointments ? "confirmed" : "pending",
        source: "assistant",
      });

      await appointment.save();

      let message;
      if (clinicConfig.autoConfirmAppointments) {
        message = `Your appointment with Dr. ${currentContext.doctorName} on ${currentContext.appointmentTimeFormatted} has been confirmed. We'll send you a reminder. Thank you!`;
      } else {
        message = `Your appointment request with Dr. ${currentContext.doctorName} on ${currentContext.appointmentTimeFormatted} has been received. Our staff will review it and confirm shortly. Thank you!`;
      }

      return {
        message,
        confirmed: true,
        requiresManualConfirmation: !clinicConfig.autoConfirmAppointments,
        updatedContext: currentContext,
        nextState: STATES.COMPLETED,
      };
    } else {
      // Handle negative response
      return {
        message: "I understand. Would you like to try a different time?",
        confirmed: false,
        updatedContext: currentContext,
        nextStep: STEPS.PREFERRED_DATE,
        nextState: STATES.COLLECTING_DETAILS,
      };
    }
  } catch (err) {
    logger.error(`Error processing confirmation: ${err.message}`);
    throw err;
  }
};

const processFollowUp = async (phoneNumber, userInput, currentContext) => {
  try {
    // Use AI to determine intent
    const intentResult = await openaiClient.determineIntent(userInput);

    let message = "";
    let nextState = currentContext.state;
    let updatedContext = { ...currentContext };

    switch (intentResult.intent) {
      case INTENTS.BOOK_APPOINTMENT:
        message =
          "Let me help you book a new appointment. What is the reason for your visit?";
        nextState = STATES.COLLECTING_DETAILS;
        updatedContext.currentStep = STEPS.REASON;
        break;

      case INTENTS.CANCEL_APPOINTMENT:
        message =
          "I can help you cancel an appointment. Please provide your appointment ID or the date and time of your appointment.";
        nextState = STATES.FOLLOW_UP;
        break;

      case INTENTS.RESCHEDULE:
        message =
          "I can help you reschedule an appointment. Please provide your current appointment details.";
        nextState = STATES.FOLLOW_UP;
        break;

      case INTENTS.GENERAL_QUESTION:
        // Use AI to generate a response to general questions
        const aiResponse = await openaiClient.answerGeneralQuestion(userInput);
        message = aiResponse.answer;
        break;

      default:
        message =
          'I didn\'t understand that. Could you please rephrase or say "book appointment", "cancel appointment", or "reschedule"?';
    }

    return {
      message,
      updatedContext,
      nextState,
    };
  } catch (err) {
    logger.error(`Error processing follow-up: ${err.message}`);
    throw err;
  }
};

const processVoiceInteraction = async (
  phoneNumber,
  intent,
  context,
  session
) => {
  try {
    let result;

    switch (intent) {
      case "greeting":
        result = await generateGreeting(phoneNumber);
        break;
      case "collect_details":
        result = await processUserInput(
          phoneNumber,
          context.userInput,
          context.currentStep,
          session.context
        );
        break;
      case "confirm_intent":
        result = await processConfirmation(
          phoneNumber,
          context.userInput,
          session.context
        );
        break;
      case "follow_up":
        result = await processFollowUp(
          phoneNumber,
          context.userInput,
          session.context
        );
        break;
      default:
        result = {
          message: "I didn't understand that. Could you please repeat?",
          updatedContext: session.context,
          nextState: session.state,
        };
    }

    return {
      ...result,
      sessionId: session.id,
    };
  } catch (err) {
    logger.error(`Error processing voice interaction: ${err.message}`);
    throw err;
  }
};

module.exports = {
  generateGreeting,
  processUserInput,
  processConfirmation,
  processFollowUp,
  processVoiceInteraction,
};
