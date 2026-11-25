const express = require("express"); const router = express.Router();
const { authenticateToken, authorize } = require("../middleware/auth");
const c = require("../controllers/repaymentsController");

router.post("/", authenticateToken, authorize('admin','loan_officer'), c.createRepayment);
router.get("/", authenticateToken, authorize('admin','loan_officer'), c.getAllRepayments);
router.get("/loan/:loan_id", authenticateToken, authorize('admin','loan_officer','borrower'), c.getRepaymentsForLoan);
router.delete("/:repayment_id", authenticateToken, authorize('admin'), c.deleteRepayment); // ADMIN ONLY - prevents officer deleting payment to steal money
module.exports = router;