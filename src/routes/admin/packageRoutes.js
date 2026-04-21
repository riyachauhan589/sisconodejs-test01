const {
  getPackages,
  createPackage,
  updatePackage,
  getPackageBookedLearners
} = require("../../controllers/admin/packageController");

const router = require("express").Router();

router.get("/", getPackages);
router.post("/", createPackage);
router.put("/updatepackage/:id", updatePackage);
router.get("/getpackageinfo/:package_id",getPackageBookedLearners)

module.exports = router;
