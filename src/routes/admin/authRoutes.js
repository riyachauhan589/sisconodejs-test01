const {
  adminLogin,
  refreshAdminToken,
  sendOtpToAdminEmail,verifyAdminOtp ,resetAdminPassword
} = require("../../controllers/admin/authController");

const router = require("express").Router();

router.post("/login", adminLogin);
router.post("/refresh-token", refreshAdminToken);
router.post("/reset-password",resetAdminPassword)
router.post("/sendotp",sendOtpToAdminEmail)
router.post("/verifyotp",verifyAdminOtp)

module.exports = router;
