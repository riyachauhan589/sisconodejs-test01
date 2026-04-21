const router = require("express").Router();

const { dashboardStats } = require("../../controllers/admin/dashboardController");

router.get("/stats", dashboardStats);

module.exports = router;