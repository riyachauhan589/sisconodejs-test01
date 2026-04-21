const {fetchallRefundrequests, updaterefundrequests  , 
    getRefundById , refundPayPalPayment , refundStripePayment ,AdmincreateRefund,getUsersForRefundDropdown, getPaymentsByUserForRefundDropdown,
    searchUsersForRefund} = require("../../controllers/admin/refundController")

const router = require("express").Router();

router.get("/fetchallrefundsrequest", fetchallRefundrequests);
router.get("/getrefundbyid/:refund_id", getRefundById);
router.put("/updaterefundstatus", updaterefundrequests);
router.post("/striperefund/:refund_id", refundStripePayment);
router.post("/paypalrefund/:refund_id", refundPayPalPayment);
router.post("/admincreaterefund",AdmincreateRefund)
// router.get("/getusersdropdown", getUsersForRefundDropdown)
router.get("/getusersdropdown", searchUsersForRefund);
router.get("/fetchuserpayment/:user_id", getPaymentsByUserForRefundDropdown)


module.exports = router