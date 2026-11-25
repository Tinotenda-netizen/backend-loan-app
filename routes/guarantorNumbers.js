const express = require("express"); const router = express.Router();
const { authenticateToken, authorize } = require("../middleware/auth");
const c = require("../controllers/guarantorNumbersController");
router.post("/", authenticateToken, authorize('admin', 'loan_officer'), c.createGuarantorNumber);
router.get("/guarantor/:guarantor_id", authenticateToken, authorize('admin', 'loan_officer'), c.getNumbersForGuarantor);
router.delete("/:guarantor_number_id", authenticateToken, authorize('admin'), c.deleteGuarantorNumber);


module.exports = router;
