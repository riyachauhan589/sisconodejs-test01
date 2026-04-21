const { createSetting, fetchSettings, updateSetting} = require("../../controllers/admin/adminsettings")

const router = require("express").Router();


router.post("/create-setting",createSetting)
router.get("/fetch-setting",fetchSettings)
router.put("/update-setting/:id",updateSetting)

module.exports = router
