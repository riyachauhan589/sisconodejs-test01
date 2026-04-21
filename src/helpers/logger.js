const winston = require("winston");

const logLevel = process.env.NODE_ENV === "PRODUCTION" ? "info" : "debug";

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: () =>
        new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: true,
        }),
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level.toUpperCase()}: ${message}`;
    }),
  ),
  transports: [
    new winston.transports.Console(),
    // new winston.transports.File({ filename: 'logs/app.log' }),
  ],
});

module.exports = logger;
