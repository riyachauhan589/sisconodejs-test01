const express = require("express");
const router = express.Router();

const {
  capturePayPalOrder,
  createPayPalOrder,
  fetchMyPayments,
  paypalWebhookHandler,
  createStripePaymentIntent,
  stripeWebhookHandler,
  fetchMyBookings,
  getPackagesDropdown,
  getAvailability,
  confirmStripePayment,
  myRefunds,
  createRequestForRefund,
  fetchPaymentDropdownWithPackagePrice,
  editMyBooking,
  bookLessonForPackage, getBookingDetails,
  getBookingDropdown,
  updateBookingSlot

} = require("../../controllers/user/paymentController");
const { AuthUser } = require("../../middlewares/userAuth");


router.post("/create-paypal-order", createPayPalOrder);
router.post("/capture-paypal-order/:order_id", capturePayPalOrder);

router.post("/create-stripe-payment-intent", createStripePaymentIntent);
router.post(
  "/confirm-stripe-payment/:payment_intent_id",
  confirmStripePayment
);


router.get("/my-payments", fetchMyPayments);
router.get("/my-bookings", fetchMyBookings);
router.get("/get-packages", getPackagesDropdown);
router.get("/get-availability", getAvailability);
router.get("/myrefunds", myRefunds)

router.post("/createrefundrequest", createRequestForRefund)
router.get("/fetchmypaymentdropdown", fetchPaymentDropdownWithPackagePrice)
router.put("/editbooking", editMyBooking)
router.get("/fetch-lessons", getBookingDetails)
router.post("/create-lesson-booking", bookLessonForPackage)
router.get("/get-booking-dropdown", getBookingDropdown)
router.put(
  "/bookings/:booking_id/slots/:slot_id",
  updateBookingSlot
);

module.exports = router;
