const express = require("express"); const router = express.Router();
const { authenticateToken, authorize, onlyOwnBorrower } = require("../middleware/auth");
const c = require("../controllers/borrowersController");

// Officer + Admin can create/edit, Admin only can delete
router.post("/", authenticateToken, authorize('admin','loan_officer'), c.createBorrower);
router.get("/", authenticateToken, authorize('admin','loan_officer'), c.getBorrowers);
router.get("/:borrower_id", authenticateToken, authorize('admin','loan_officer','borrower'), onlyOwnBorrower, c.getBorrowerById);
router.put("/:borrower_id", authenticateToken, authorize('admin','loan_officer'), c.updateBorrower);
router.delete("/:borrower_id", authenticateToken, authorize('admin'), c.deleteBorrower);
module.exports = router;