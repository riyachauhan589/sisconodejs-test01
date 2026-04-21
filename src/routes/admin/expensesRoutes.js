const {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
} = require("../../controllers/admin/expensesController");

const router = require("express").Router();
const getUploader = require("../../middlewares/upload")

router.post("/addexpenses",getUploader("expenses"), addExpense);
router.get("/getallexpenses", getExpenses);
router.put("/updateexpenses/:id",getUploader("expenses"), updateExpense);
router.delete("/deleteexpenses/:id", deleteExpense);

module.exports = router;
