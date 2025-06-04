const twilio = require("twilio");

const generateVoiceResponse = (message) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Use <Say> for text-to-speech
  const say = twiml.say(
    {
      voice: "woman",
      language: "en-US",
    },
    message
  );

  // Add a short pause for better natural flow
  twiml.pause({ length: 1 });

  // If we're collecting input, add <Gather> for speech recognition
  if (!message.includes("Goodbye")) {
    const gather = twiml.gather({
      input: "speech",
      language: "en-US",
      timeout: 3,
      action: "/webhooks/voice",
    });
    gather.say("Please respond verbally");
  }

  return twiml.toString();
};

module.exports = {
  generateVoiceResponse,
};
