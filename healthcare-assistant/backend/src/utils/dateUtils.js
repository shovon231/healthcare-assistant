const moment = require("moment-timezone");

const formatDate = (
  date,
  format = "YYYY-MM-DD HH:mm",
  timezone = "America/New_York"
) => {
  return moment(date).tz(timezone).format(format);
};

const isBusinessHours = (date, timezone = "America/New_York") => {
  const localTime = moment(date).tz(timezone);
  const hour = localTime.hour();
  const day = localTime.day();

  // Monday to Friday, 9 AM to 5 PM
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
};

const addMinutes = (date, minutes) => {
  return new Date(date.getTime() + minutes * 60000);
};

module.exports = {
  formatDate,
  isBusinessHours,
  addMinutes,
};
