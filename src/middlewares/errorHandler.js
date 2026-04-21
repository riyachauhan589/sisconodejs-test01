const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.name || "Error"}: ${err.message}`);

  const statusCode = err.status || 500;
  const response = {
    success: false,
    message: err.message || "Internal Server Error",
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
