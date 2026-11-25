const express = require("express"); const router = express.Router();
const { authenticateToken, authorize, onlyOwnBorrower } = require("../middleware/auth");
const c = require("../controllers/loansController");

router.post("/", authenticateToken, authorize('admin','loan_officer'), c.createLoan);
router.get("/", authenticateToken, authorize('admin','loan_officer'), c.getLoans);
router.get("/:loan_id", authenticateToken, authorize('admin','loan_officer','borrower'), c.getLoanById);
router.patch("/:loan_id/approve", authenticateToken, authorize('admin'), c.approveLoan); // ADMIN ONLY - officer cannot approve own loan
router.patch("/:loan_id/disburse", authenticateToken, authorize('admin'), c.disburseLoan); // ADMIN ONLY
router.patch("/:loan_id/status", authenticateToken, authorize('admin'), c.updateLoanStatus);
router.delete("/:loan_id", authenticateToken, authorize('admin'), c.deleteLoan);
router.get("/overdue/list", authenticateToken, authorize('admin','loan_officer'), c.getOverdueLoans);
router.get("/borrower/:borrower_id/statement", authenticateToken, authorize('admin','loan_officer','borrower'), onlyOwnBorrower, c.getBorrowerStatement);
module.exports = router;
