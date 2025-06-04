const OpenAI = require("openai");
const logger = require("../../../utils/logger");
const { AppError } = require("../../../utils/errorHandler");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const parseDateTime = async (text) => {
  try {
    const prompt = `Extract the date and time from the following text and return it in ISO 8601 format. If no specific time is mentioned, default to 10:00 AM. Today's date is ${new Date().toISOString()}.
    
    Text: "${text}"
    
    Return a JSON object with a "dateTime" field containing the ISO 8601 formatted date and time. If no date can be determined, return an empty string.
    
    Example: {"dateTime": "2023-12-25T14:00:00.000Z"}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that extracts dates and times from text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (err) {
    logger.error(`Error parsing date/time: ${err.message}`);
    throw new AppError("Failed to parse date and time", 500);
  }
};

const determineConfirmation = async (text) => {
  try {
    const prompt = `Determine if the following text is a confirmation (yes/affirmative) or not (no/negative). Return a JSON object with a "confirmed" boolean field.
    
    Text: "${text}"
    
    Example responses:
    {"confirmed": true}
    {"confirmed": false}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that determines if text is affirmative or negative.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (err) {
    logger.error(`Error determining confirmation: ${err.message}`);
    throw new AppError("Failed to determine confirmation", 500);
  }
};

const determineIntent = async (text) => {
  try {
    const prompt = `Determine the intent of the following text. Possible intents are: book_appointment, cancel_appointment, reschedule, general_question. Return a JSON object with an "intent" field.
    
    Text: "${text}"
    
    Example responses:
    {"intent": "book_appointment"}
    {"intent": "general_question"}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that determines user intent.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (err) {
    logger.error(`Error determining intent: ${err.message}`);
    throw new AppError("Failed to determine intent", 500);
  }
};

const answerGeneralQuestion = async (text) => {
  try {
    const prompt = `You are a friendly healthcare assistant. Answer the following question in a helpful and professional manner, keeping the response concise (1-2 sentences).
    
    Question: "${text}"`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful healthcare assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    return {
      answer: response.choices[0].message.content,
    };
  } catch (err) {
    logger.error(`Error answering general question: ${err.message}`);
    throw new AppError("Failed to answer question", 500);
  }
};

const generateResponse = async (context, currentStep) => {
  try {
    const prompt = promptGenerators.generatePrompt(context, currentStep);
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a friendly and professional healthcare assistant.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return responseHandler.processResponse(
      response.choices[0].message.content,
      context,
      currentStep
    );
  } catch (err) {
    logger.error(`Error generating AI response: ${err.message}`);
    throw new AppError("Failed to generate response", 500);
  }
};

module.exports = {
  parseDateTime,
  determineConfirmation,
  determineIntent,
  answerGeneralQuestion,
  generateResponse,
};
