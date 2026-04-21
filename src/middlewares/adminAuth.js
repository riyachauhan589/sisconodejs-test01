const jwt = require("jsonwebtoken");
const { Admin } = require("../models"); 

const adminAuth = (requiredPermission = null) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_MISSING",
        error: "Token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET);

      const admin = await Admin.findByPk(decoded.id);

      if (!admin || admin.status !== "active") {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_INACTIVE",
          error: "Your account is inactive or not authorized.",
        });
      }

      req.admin = admin;

      next();
    } catch (err) {
      console.error("JWT verification error:", err);
      return res.status(403).json({
        success: false,
        code: "INVALID_TOKEN",
        error: "Invalid or expired token",
      });
    }
  };
};

module.exports = adminAuth;
