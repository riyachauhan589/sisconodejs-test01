"use strict";

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { User, Contact } = require("../../models");
const { Op } = require("sequelize");
const sendEmail = require("../../../config/mailer");
const { forgotPassTemp } = require("../../utils/mailTemplates");
const { registrationSuccessTemplate, otpEmailTemplate } = require("../../utils/mailTemplates");
const { stat } = require("fs");


const registerUser = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      phone,
      address,
      license_number,
      date_of_birth,
    } = req.body;

    if (
      !first_name ||
      !email ||
      !password ||
      !phone ||
      !license_number ||
      !date_of_birth
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const existingUser = await User.findOne({ where: { email } });

    if (!existingUser) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    if (existingUser.password) {
      return res.status(409).json({
        success: false,
        message: "User already registered",
      });
    }

    if (!existingUser.is_email_verified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ SAFER UID generation (prevents duplicates)
    const uid = `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await existingUser.update({
      uid,
      first_name,
      last_name,
      mobile: phone,
      password: hashedPassword,
      address,
      license_number,
      registration_date: new Date(),
      date_of_birth,
      status: "active",
    });

    const payload = { id: existingUser.id, email: existingUser.email };

    const accessToken = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
    );

    await sendEmail(
      existingUser.email,
      "Welcome to True Way Driving School 🎉",
      registrationSuccessTemplate(existingUser)
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        id: existingUser.id,
        name: existingUser.first_name,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "user not found or inactive",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const payload = { id: user.id, email: user.email };

    const accessToken = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
    );

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        userId: user.id,
        name: user.first_name,
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      where: { email, status: "active" },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token in DB
    await user.update({
      reset_token: resetToken,
      reset_token_created_at: resetTokenExpiry,
    });

    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;

    // Send email
    await sendEmail(
      email,
      "Password Reset Request",
      forgotPassTemp(user.name, resetLink)
    );

    return res.status(200).json({
      success: true,
      message: "Password reset link sent to registered email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({
      where: { email },
      attributes: [
        "id",
        "otp",
        "otp_created_at",
        "status",
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    // OTP mismatch
    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // OTP expiry check (10 minutes)
    const diffMinutes =
      (new Date() - new Date(user.otp_created_at)) / (1000 * 60);

    if (diffMinutes > 10) {
      return res.status(410).json({
        success: false,
        message: "OTP expired",
      });
    }

    // Generate reset token (secure)
    const resetToken = require("crypto")
      .randomBytes(32)
      .toString("hex");

    await user.update({
      otp: null,
      otp_created_at: null,
      reset_token: resetToken,
      reset_token_created_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      reset_token: resetToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, reset_token, new_password } = req.body;

    if (!email || !reset_token || !new_password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const user = await User.findOne({
      where: { email, reset_token },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Reset token expiry (15 minutes)
    const diffMinutes =
      (new Date() - new Date(user.reset_token_created_at)) / (1000 * 60);

    if (diffMinutes > 15) {
      return res.status(410).json({
        success: false,
        message: "Reset token expired",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_created_at: null,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN_JWT_SECRET
      );
    } catch (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }


    const user = await User.findByPk(decoded.id);

    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
      });
    }


    const payload = {
      id: user.id,
      email: user.email,
    };

    const newAccessToken = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const decodedAccess = jwt.decode(newAccessToken);

    return res.status(200).json({
      success: true,
      access_token: newAccessToken,
      accessTokenExpiry: decodedAccess.exp * 1000,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, mobile, address, email, date_of_birth,
      license_number } = req.body;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    await user.update({
      first_name: first_name || user.first_name,
      last_name: last_name || user.last_name,
      mobile: mobile || user.mobile,
      address: address || user.address,
      date_of_birth: date_of_birth || user.date_of_birth,
      license_number: license_number || user.license_number,
      email: email || user.email,
    });
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        mobile: user.mobile,
        address: user.address,
        date_of_birth: user.date_of_birth,
        license_number: user.license_number,
        permit_number: user.permit_number
      },
    });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const fetchme = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      attributes: ["id", "first_name", "last_name", "email", "mobile", "address", "registration_date", "status", "license_number", "date_of_birth"],
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: user,
    });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const contactSupport = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      message,
      phone_number,
      interest,
    } = req.body;

    if (!first_name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const contact = await Contact.create({
      first_name,
      last_name,
      email,
      phone_number,
      interest,
      message,
    });

    const adminEmail = process.env.SUPPORT_EMAIL || process.env.MAIL_FROM_ADDRESS;

    const html = `
      <h3>New Contact Request</h3>
      <p><strong>Name:</strong> ${first_name} ${last_name || ""}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone_number || "-"}</p>
      <p><strong>Interest:</strong> ${interest || "-"}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `;

    await sendEmail(
      adminEmail,
      "New Contact Support Request",
      html
    );

    return res.status(201).json({
      success: true,
      message: "Contact request submitted successfully",
      data: contact,
    });

  } catch (error) {
    console.error("Contact support error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const existingUser = await User.findOne({ where: { email } });

    if (existingUser && existingUser.password) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    await User.upsert({
      email,
      otp,
      otp_created_at: new Date(),   // ✅ FIXED
      is_email_verified: false,
      status: "inactive",
    });

    await sendEmail(
      email,
      "Email Verification OTP",
      otpEmailTemplate(otp)
    );

    return res.json({
      success: true,
      message: "OTP sent to email",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP required",
      });
    }

    const record = await User.findOne({ where: { email } });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    if (record.otp != otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // ✅ Proper expiry check (10 minutes)
    const expiryTime =
      new Date(record.otp_created_at).getTime() + 10 * 60 * 1000;

    if (Date.now() > expiryTime) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    await record.update({
      is_email_verified: true,
      otp: null,
      otp_created_at: null,
    });

    return res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  refreshAccessToken,
  updateProfile,
  fetchme,
  contactSupport,
  sendOtp,
  verifyEmailOtp
};
