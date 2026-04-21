const { purchasePackage, getPackages } = require("../../controllers/user/userPackageController")
const { AuthUser } = require("../../middlewares/userAuth")


const router = require("express").Router()

router.post("/", AuthUser, purchasePackage);
router.get("/get-packages", getPackages);


module.exports = router