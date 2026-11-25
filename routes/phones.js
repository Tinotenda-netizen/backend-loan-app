const express = require("express"); const router = express.Router();
const { authenticateToken, authorize } = require("../middleware/auth");
const c = require("../controllers/phonesController");
router.post("/", authenticateToken, authorize('admin', 'loan_officer'), c.createPhone);
router.get("/", authenticateToken, authorize ('admin', 'loan_officer'), c.getPhones);
router.get("/:phone_id", authenticateToken, authorize('admin', 'loan_officer'), c.getPhoneById);
router.put("/:phone_id", authenticateToken, authorize('admin', 'loan_officer'), c.updatePhone);
router.delete("/:phone_id", authenticateToken, authorize('admin'), c.deletePhone);


module.exports = router;
