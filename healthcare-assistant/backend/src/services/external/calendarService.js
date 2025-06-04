const axios = require("axios");
const logger = require("../../utils/logger");
const { AppError } = require("../../utils/errorHandler");
const { formatDate } = require("../../utils/dateUtils");

const createCalendarEvent = async (eventData) => {
  try {
    const response = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${process.env.CALENDAR_ID}/events`,
      eventData,
      {
        headers: {
          Authorization: `Bearer ${process.env.CALENDAR_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    logger.info(`Calendar event created: ${response.data.id}`);
    return response.data;
  } catch (err) {
    logger.error(`Error creating calendar event: ${err.message}`);
    throw new AppError("Failed to create calendar event", 500);
  }
};

const checkAvailability = async (doctorId, startTime, endTime) => {
  try {
    // In a real implementation, this would check the doctor's calendar
    // For now, we'll mock this with a simple check
    const now = new Date();
    const requestedStart = new Date(startTime);

    // Basic validation - can't book in the past
    if (requestedStart < now) {
      return false;
    }

    // Check if it's during business hours (9 AM to 5 PM)
    const hours = requestedStart.getHours();
    if (hours < 9 || hours >= 17) {
      return false;
    }

    // Check day of week (Monday to Friday)
    const day = requestedStart.getDay();
    if (day === 0 || day === 6) {
      return false;
    }

    // In a real app, you'd check against existing appointments
    return true;
  } catch (err) {
    logger.error(`Error checking availability: ${err.message}`);
    throw new AppError("Failed to check availability", 500);
  }
};

module.exports = {
  createCalendarEvent,
  checkAvailability,
};
