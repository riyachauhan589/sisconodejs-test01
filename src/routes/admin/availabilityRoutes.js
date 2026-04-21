const { createAvailability, getAvailability, blockTimeSlot, bulkCopyAvailability , updateAvailabilitySlot ,getAvailabilityDropDown} 
= require("../../controllers/admin/availabilityController")


const router = require("express").Router()

router.post("/create-availability", createAvailability)
router.get("/get-availability", getAvailability)
router.post("/block-time", blockTimeSlot)
router.put("/updateavailability",updateAvailabilitySlot)
router.get("/getavailabilitydropdown",getAvailabilityDropDown)

module.exports = router