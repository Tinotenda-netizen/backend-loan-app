const express = require("express");
const router = express.Router();
const {authenticateToken, authorize} = require ("../middleware/auth");
const {getDashboard} = require("../controllers/dashboardController");
router.get("/", authenticateToken, authorize('admin','loan_officer'), getDashboard);

module.exports = router;