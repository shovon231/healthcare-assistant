const { google } = require("googleapis");

const calendar = google.calendar("v3");
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  process.env.GOOGLE_CALENDAR_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const createEvent = async (eventDetails) => {
  try {
    const response = await calendar.events.insert({
      auth: oauth2Client,
      calendarId: "primary",
      resource: eventDetails,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Google Calendar API Error:", error);
    throw error;
  }
};

module.exports = { createEvent };
