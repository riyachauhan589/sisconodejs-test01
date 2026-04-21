const { createTransaction } = require("../../controllers/user/transactionController")

const router = require("express").Router()

router.post("/create",createTransaction)

module.exports = router