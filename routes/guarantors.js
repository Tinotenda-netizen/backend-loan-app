const express = require("express"); 
const router = express.Router();
const { authenticateToken, authorize} = require("../middleware/auth");
const c = require("../controllers/guarantorsController");
router.post("/", authenticateToken, authorize('admin', 'loan_officer'), c.createGuarantor);
router.get("/", authenticateToken, authorize('admin', 'loan_officer'), c.getGuarantors);
router.get("/:guarantor_id", authenticateToken, authorize('admin', 'loan_officer'), c.getGuarantorById);
router.put("/:guarantor_id", authenticateToken, authorize('admin', 'loan_officer'), c.updateGuarantor);
router.delete("/:guarantor_id", authenticateToken, authorize('admin', 'loan_officer'), c.deleteGuarantor);


module.exports = router;