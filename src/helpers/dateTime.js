const moment = require("moment-timezone");

const getISTDateTime = () => {
  return moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
};

const getTodayDateOnly = () => {
  return moment().tz("Asia/Kolkata").startOf("day").format("YYYY-MM-DD");
};

module.exports = {
  getISTDateTime,
  getTodayDateOnly,
};
