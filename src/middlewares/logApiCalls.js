const logger = require("../helpers/logger");

const logApiCalls = (req, res, next) => {
  // next();

  if (req.originalUrl.startsWith("/uploads")) {
    return next();
  }

  logger.info(`API Called: ${req?.method} ${req?.originalUrl}`);
  next();
};

module.exports = logApiCalls;
