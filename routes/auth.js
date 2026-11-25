const express = require("express"); const router = express.Router();
const { register, login, createStaff } = require("../controllers/authController");
const { authenticateToken, authorize } = require("../middleware/auth");

router.post("/register", register); // public, borrower only
router.post("/login", login);
router.post("/create-staff", authenticateToken, authorize('admin'), createStaff); // ADMIN ONLY

module.exports = router;


