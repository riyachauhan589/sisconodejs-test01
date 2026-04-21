const multerErrorHandler = (err, req, res, next) => {
  if (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Image size should not exceed",
        status: 413,
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "Image upload failed.",
      status: 400,
    });
  }

  next();
};

module.exports = multerErrorHandler;
