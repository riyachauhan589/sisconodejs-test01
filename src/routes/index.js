const router = require("express").Router();

const userRoutes = require("./user/index");
const adminRoutes = require("./admin/index");

router.use("/user", userRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
