const {
  getAssessment,
  saveAssessment,
  getAssessmentById
} = require("../../controllers/admin/assessmentController");

const router = require("express").Router();


router.post("/save", saveAssessment);
router.get("/fetchallassignments", getAssessment);
router.get("/getassessmentbyid/:id", getAssessmentById);

module.exports = router;
