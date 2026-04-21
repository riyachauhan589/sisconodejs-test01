
const { 
  loginUser, 
  refreshAccessToken, 
  registerUser, 
  forgotPassword, 
  verifyOtp, 
  resetPassword,
  fetchme ,
  contactSupport,
  sendOtp,
  verifyEmailOtp
} = require("../../controllers/user/userController");
const { AuthUser } = require("../../middlewares/userAuth");

const router = require("express").Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.post("/refresh-token",refreshAccessToken)
router.get("/me", fetchme);
router.post("/contact-support", contactSupport);
router.post("/send-otp", sendOtp);
router.post("/verify-email-otp", verifyEmailOtp);


module.exports = router;
