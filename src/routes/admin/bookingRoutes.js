const { getAllBookingsForAdmin, createBooking, updateBooking,
     getBookingById, getUsersDropdown, getPackagesDropdown , refundPayPalPayment ,
   refundStripePayment, 
   getAvailability} = require("../../controllers/admin/bookingController");

const router = require("express").Router();

router.post('/createbooking', createBooking);
router.get('/fetchallbookings', getAllBookingsForAdmin);
router.get('/users-dropdown', getUsersDropdown);
router.get('/packages-dropdown', getPackagesDropdown);
router.put('/updatebooking/:id', updateBooking);
router.get('/getbooking/:id', getBookingById);
router.post("/refundstripe/:payment_intent_id",refundStripePayment);
router.post("/refundpaypal/:order_id",refundPayPalPayment);
router.get("/get-availability-slots", getAvailability);

module.exports = router;