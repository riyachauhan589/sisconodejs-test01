"use strict";

const jwt = require("jsonwebtoken");
const { User } = require("../models");

const AuthUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        code: "TOKEN_MISSING",
        error: "Access token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "status"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        error: "User not found",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_INACTIVE",
        error: "Your account has been deactivated",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      error: "Invalid or expired access token",
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET);

    if (!decoded?.id) return next();

    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "status"],
    });

    if (user && user.status === "active") {
      req.user = user;
    }
  } catch (error) {
    // silently ignore invalid / expired token
  }

  next();
};

module.exports = {
  AuthUser,
  optionalAuth,
};
