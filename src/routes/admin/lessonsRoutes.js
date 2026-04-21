const {
  fetchLessons,
  getLessonById,
  updateLessonById,
  lessonsCounts
} = require("../../controllers/admin/lessons");
const express = require("express");
const router = express.Router();


router.get("/fetch-lessons", fetchLessons);
router.get("/get-lesson/:id", getLessonById);
router.put("/update-lesson/:id", updateLessonById);
router.get("/lessons-counts", lessonsCounts)

module.exports = router;