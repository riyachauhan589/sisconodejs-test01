const { createUser, getAllUsers, getUserById, updateUser, downloadInvoice } = require("../../controllers/admin/userRegister")

const router = require("express").Router()

router.post("/create-user", createUser)
router.get("/get-all-user", getAllUsers)
router.get("/get-user/:id", getUserById)
router.put("/update-user/:id", updateUser)
router.get("/get-invoice", downloadInvoice)
module.exports = router