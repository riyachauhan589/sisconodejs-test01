const { createContact } = require("../../controllers/user/contactController")

const router = require("express").Router()


router.post("/create-contact", createContact)

module.exports = router