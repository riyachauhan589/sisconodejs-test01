const router = require("express").Router();

const adminAuth = require("../../middlewares/adminAuth");

const authRoutes = require("./authRoutes");
const packageRoutes = require("./packageRoutes");
const assessmentRoutes = require("./assessmentRoutes");
const bookingRoutes = require("./bookingRoutes");
const userRegisterRoutes = require("./userRegisterRoutes");

const availabilityRoutes = require('./availabilityRoutes')
const dashboardroutes = require('./dashboard')
const paymenstroutes = require("./paymnest&billingRoutes")
const reportRoutes = require("./reportsRoutes");
const refundRoutes = require("./refundRoutes")
const expensesRoutes = require("./expensesRoutes")
const {
  getAdminProfile ,updateAdminProfile} = require("../../controllers/admin/authController")
const settingsRoutes = require("./settingsRoutes")

const lessonsRoutes = require("./lessonsRoutes")

router.use("/lessons", adminAuth(), lessonsRoutes);
router.use("/auth", authRoutes);
router.use("/fetchadminprofile",adminAuth(),getAdminProfile)
router.use("/updateadminprofile",adminAuth(),updateAdminProfile)
router.use("/package", adminAuth(), packageRoutes);
router.use("/assessment", adminAuth(), assessmentRoutes);
router.use("/booking", adminAuth(), bookingRoutes);
router.use("/user", adminAuth(), userRegisterRoutes);
router.use("/availability", adminAuth(), availabilityRoutes);
router.use("/dashboard", adminAuth(), dashboardroutes);
router.use("/payment-billing",adminAuth() ,paymenstroutes)
router.use("/reports", adminAuth(), reportRoutes);
router.use("/refunds",adminAuth(), refundRoutes)
router.use("/expenses",adminAuth(),expensesRoutes)
router.use("/settings",adminAuth(),settingsRoutes)

module.exports = router;
