const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID || null,
  timeout: 15000,
  maxRetries: 2,
});

async function callWithRetry(prompt, history, mode, retries = 2) {
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
      return callWithRetry(prompt, history, mode, retries - 1);
    }
    throw error;
  }
}

function validHistoryEntries(history) {
  if (!Array.isArray(history)) return [];
  return history.filter(
    (entry) => entry && typeof entry === "object" && entry.role && entry.content
  );
}

module.exports = {
  callWithRetry,
  validHistoryEntries,
};
