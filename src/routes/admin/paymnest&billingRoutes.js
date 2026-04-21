const express = require("express");
const router = express.Router();


const {  payments,
    getPaymentById  , paymentStats} = require("../../controllers/admin/payment&billingController")


router.get("/payments", payments);
router.get("/payment/:id", getPaymentById);
router.get("/payment-stats", paymentStats);
module.exports = router;