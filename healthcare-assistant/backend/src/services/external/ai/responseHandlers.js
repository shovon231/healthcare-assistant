const { STATES, STEPS } = require("../../../routes/webhooks/constants");

const processResponse = (aiResponse, context, currentStep) => {
  let nextStep = currentStep;
  let nextState = context.state || STATES.GREETING;

  // Determine next step based on current step and AI response
  switch (currentStep) {
    case STEPS.NAME:
      nextStep = STEPS.PHONE;
      break;
    case STEPS.PHONE:
      nextStep = STEPS.REASON;
      break;
    case STEPS.REASON:
      nextStep = STEPS.PREFERRED_DATE;
      break;
    case STEPS.PREFERRED_DATE:
      nextStep = STEPS.CONFIRMATION;
      nextState = STATES.CONFIRMING_APPOINTMENT;
      break;
    case STEPS.CONFIRMATION:
      nextState = STATES.COMPLETED;
      break;
  }

  return {
    message: aiResponse,
    nextStep,
    nextState,
    context,
  };
};

module.exports = {
  processResponse,
};
