const formatDate = (date) => {
  return new Date(date).toISOString().split("T")[0]; // Returns YYYY-MM-DD format
};

const formatDateTime = (date) => {
  return new Date(date).toISOString(); // Returns full ISO format
};

const isPastDate = (date) => {
  return new Date(date) < new Date();
};

module.exports = { formatDate, formatDateTime, isPastDate };
