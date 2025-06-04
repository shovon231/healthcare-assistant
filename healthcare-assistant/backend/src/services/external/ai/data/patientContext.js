// This file provides templates for patient context management

module.exports = {
  createNewContext: (phoneNumber) => ({
    phoneNumber,
    currentStep: "greeting",
    collectedData: {},
    conversationHistory: [],
  }),

  updateContextStep: (context, step) => ({
    ...context,
    currentStep: step,
  }),

  addCollectedData: (context, key, value) => ({
    ...context,
    collectedData: {
      ...context.collectedData,
      [key]: value,
    },
  }),

  addConversationTurn: (context, userInput, systemResponse) => ({
    ...context,
    conversationHistory: [
      ...context.conversationHistory,
      { userInput, systemResponse, timestamp: new Date().toISOString() },
    ],
  }),
};
