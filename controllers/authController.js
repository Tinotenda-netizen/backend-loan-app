const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { isValidName } = require("../utils/validate");
const { JWT_SECRET } = require("../middleware/auth");

async function register(req, res) {
  const { full_name, email, phone, password, user_role, borrower_id } = req.body;

  if (!isValidName(full_name)) return res.status(400).json({ error: "Name must contain only letters" });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Valid email required" });
  if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 chars" });

  // NEW: Role validation
  // Only admin can create admin/officer accounts. Public register can only create borrower.
  const requestedRole = user_role || 'borrower';
  if (!['admin','loan_officer','borrower'].includes(requestedRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  // If someone tries to create admin/officer without being admin, block it
  // req.user will be undefined for public register, so we check token if present
  // Simplest rule: public endpoint only allows borrower. Admin creates staff via /api/auth/create-staff
  if (requestedRole !== 'borrower') {
    return res.status(403).json({ error: "Use admin to create staff accounts. Public register is for borrowers only." });
  }

  if (requestedRole === 'borrower' && borrower_id) {
    const b = await pool.query("SELECT * FROM borrower WHERE borrower_id=$1", [borrower_id]);
    if (b.rows.length === 0) return res.status(404).json({ error: "Borrower record not found. Ask officer to create your borrower profile first." });
  }

  try {
    const existing = await pool.query("SELECT user_id FROM users WHERE email=$1", [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (full_name, email, phone, password_hash, user_role, borrower_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING user_id, full_name, email, phone, user_role, borrower_id, created_at",
      [full_name.trim(), email.toLowerCase().trim(), phone, hash, requestedRole, borrower_id || null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ user_id: user.user_id, email: user.email, user_role: user.user_role, borrower_id: user.borrower_id }, JWT_SECRET, { expiresIn: "24h" });
    res.status(201).json({ message: "User registered", user, token });
  } catch(e){ console.error(e); res.status(500).json({ error:"Server error" }); }
}

// NEW: Admin-only staff creation
async function createStaff(req, res) {
  const { full_name, email, phone, password, user_role } = req.body;
  if (!['admin','loan_officer'].includes(user_role)) return res.status(400).json({ error: "Staff role must be admin or loan_officer" });
  if (!isValidName(full_name)) return res.status(400).json({ error: "Invalid name" });
  if (!password || password.length < 8) return res.status(400).json({ error: "Password min 8 chars" });
  try {
    const existing = await pool.query("SELECT user_id FROM users WHERE email=$1", [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Email already exists" });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (full_name, email, phone, password_hash, user_role) VALUES ($1,$2,$3,$4,$5) RETURNING user_id, full_name, email, user_role",
      [full_name.trim(), email.toLowerCase().trim(), phone, hash, user_role]
    );
    res.status(201).json({ message: `${user_role} created`, user: result.rows[0] });
  } catch(e){ console.error(e); res.status(500).json({ error:"Server error" }); }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email.toLowerCase().trim()]);
    if (result.rows.length===0) return res.status(401).json({ error:"Invalid email or password" });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error:"Invalid email or password" });
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, user_role: user.user_role, borrower_id: user.borrower_id },
      JWT_SECRET, { expiresIn:"24h" }
    );
    res.json({ message:"Login successful", user:{ user_id:user.user_id, full_name:user.full_name, email:user.email, role:user.user_role, borrower_id:user.borrower_id }, token });
  } catch(e){ console.error(e); res.status(500).json({ error:"Server error" }); }
}

module.exports = { register, login, createStaff };
