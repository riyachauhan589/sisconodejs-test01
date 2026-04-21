const rateLimit = require("express-rate-limit");

const rateLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 300, // limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      status: 429,
      error: "Too many requests. Please wait and try again.",
    });
  },
});

module.exports = rateLimiter;
