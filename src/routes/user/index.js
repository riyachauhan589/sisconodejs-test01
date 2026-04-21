const router = require("express").Router();
const { AuthUser } = require("../../middlewares/userAuth");
const authRoutes = require("./authRoutes")
const userPackageRoute = require("./userPackageRoute")
const contactRoutes = require("./contactRoutes")

const paymentRoutes = require("./paymentRoutes")
const {fetchme , updateProfile}  = require("../../controllers/user/userController")

// const profileRoutes = require("./userProfile");

router.use("/auth", authRoutes);
router.use("/contact", contactRoutes)
router.use("/profile", AuthUser, fetchme);
router.put("/updateprofile", AuthUser, updateProfile);
router.use("/user-package", userPackageRoute);
router.use("/payments",AuthUser, paymentRoutes);

// router.use("/profile", AuthUser, profileRoutes);

module.exports = router;
