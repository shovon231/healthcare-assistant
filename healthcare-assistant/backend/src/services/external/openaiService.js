const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const generateResponse = async (prompt) => {
  try {
    const response = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: parseFloat(process.env.OPENAI_TEMP) || 0.7,
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("❌ OpenAI API Error:", error);
    throw error;
  }
};

module.exports = { generateResponse };
