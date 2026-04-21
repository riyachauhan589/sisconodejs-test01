const express = require("express");
const router = express.Router();
const {   bookingReport, revenueReport , learnerActivityReport , packagePerformance ,expenseReport} = require("../../controllers/admin/reportsController");

router.get("/bookingreport",  bookingReport);
router.get("/revenuereport",  revenueReport);
router.get("/learneractivityreport", learnerActivityReport)
router.get("/packageperformance", packagePerformance)
router.get("/expensereport",expenseReport)


module.exports = router