const { Admin, sequelize , User } = require("../../models");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { getISTDateTime } = require("../../helpers/dateTime");
const sendEmail = require("../../../config/mailer");
const crypto = require("crypto");
const { sendForgotOtpTemp } = require("../../utils/mailTemplates");

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const admin = await Admin.findOne({ where: { email } });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // ✅ ACCESS TOKEN PAYLOAD (NO ROLE)
    const accessPayload = {
      id: admin.id,
      email: admin.email,
      mobile: admin.mobile,
    };

    // ✅ REFRESH TOKEN PAYLOAD (MINIMAL)
    const refreshPayload = {
      id: admin.id,
    };

    const accessToken = jwt.sign(
      accessPayload,
      process.env.ACCESS_TOKEN_JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    const refreshToken = jwt.sign(
      refreshPayload,
      process.env.REFRESH_TOKEN_JWT_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN },
    );

    // ✅ SAVE REFRESH TOKEN
    await admin.update({ refresh_token: refreshToken });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        mobile: admin.mobile,
        image: admin.image,
        fcm_token: admin.fcm_token,
        fcm_type: admin.fcm_type,
      },
    });
  } catch (error) {
    next(error);
  }
};

const refreshAdminToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_JWT_SECRET,
    );

    const admin = await Admin.findByPk(decoded.id);

    if (!admin || admin.refresh_token !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const newAccessPayload = {
      id: admin.id,
      email: admin.email,
      mobile: admin.mobile,
    };

    const newAccessToken = jwt.sign(
      newAccessPayload,
      process.env.ACCESS_TOKEN_JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Refresh token expired or invalid",
    });
  }
};

const sendOtpToAdminEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const admin = await Admin.findOne({ where: { email } });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const now = new Date();

    await admin.update({
      otp,
      otp_created_at: now,
    });

    await sendEmail(
      email,
      "🔐 Reset Password - Your OTP Code",
      sendForgotOtpTemp(otp)
    );

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
      otp:admin.otp
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const verifyAdminOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    const admin = await Admin.findOne({ where: { email } });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found.",
      });
    }

    if (!admin.otp || parseInt(admin.otp) !== parseInt(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    const diffMinutes =
      (new Date() - new Date(admin.otp_created_at)) / (1000 * 60);

    if (diffMinutes > 10) {
      return res.status(410).json({
        success: false,
        message: "OTP expired.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    await admin.update({
      otp: null,
      otp_created_at: null,
      reset_token: resetToken,
      reset_token_created_at: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
      reset_token: resetToken,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const resetAdminPassword = async (req, res) => {
  try {
    const { email, reset_token, new_password } = req.body;

    if (!email || !reset_token || !new_password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const admin = await Admin.findOne({ where: { email } });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found.",
      });
    }

    if (admin.reset_token !== reset_token) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset token.",
      });
    }

    const diffMinutes =
      (new Date() - new Date(admin.reset_token_created_at)) / (1000 * 60);

    if (diffMinutes > 15) {
      return res.status(410).json({
        success: false,
        message: "Reset token expired.",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await admin.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_created_at: null,
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id;

    const admin = await Admin.findByPk(adminId, {
      attributes: [
        "id",
        "name",
        "email",
        "mobile",
        "image",
        "status",
        "created_at",
      ],
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: admin,
    });
  } catch (error) {
    console.error("Get Admin Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { name, email, mobile, status } = req.body;

    const admin = await Admin.findByPk(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (email && email !== admin.email) {
      const emailExists = await Admin.findOne({ where: { email } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }

    await admin.update({
      name: name ?? admin.name,
      email: email ?? admin.email,
      mobile: mobile ?? admin.mobile,
      status: status ?? admin.status,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        mobile: admin.mobile,
        status: admin.status,
        updated_at: admin.updated_at,
      },
    });
  } catch (error) {
    console.error("Update Admin Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



module.exports = {
  adminLogin,
  sendOtpToAdminEmail,
  verifyAdminOtp,
  resetAdminPassword,
  refreshAdminToken,
  getAdminProfile,
  updateAdminProfile
};
