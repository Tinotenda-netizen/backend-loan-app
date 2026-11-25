const pool = require("../db");

function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\s/g, '');
  return /^(07\d{8}|\+2637\d{8}|2637\d{8})$/.test(cleaned);
}

async function createGuarantorNumber(req, res) {
  const { guarantor_id, phone_number } = req.body;
  if (!guarantor_id || !/^\d+$/.test(String(guarantor_id))) return res.status(400).json({ error: "Valid guarantor_id is required" });
  if (!phone_number || !isValidPhone(phone_number)) return res.status(400).json({ error: "Valid phone number required. Format: 0771234567" });

  try {
    const g = await pool.query("SELECT * FROM guarantor WHERE guarantor_id = $1", [guarantor_id]);
    if (g.rows.length === 0) return res.status(404).json({ error: "Guarantor not found" });
    const result = await pool.query(
      "INSERT INTO guarantor_number (guarantor_id, phone_number) VALUES ($1, $2) RETURNING *",
      [guarantor_id, phone_number.replace(/\s/g, '')]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "This phone number already exists for this guarantor" });
    if (err.code === '23503') return res.status(404).json({ error: "Guarantor not found" });
    res.status(500).json({ error: "Server error" });
  }
}

async function getNumbersForGuarantor(req, res) {
  const { guarantor_id } = req.params;
  if (!/^\d+$/.test(guarantor_id)) return res.status(400).json({ error: "Invalid guarantor id" });
  const result = await pool.query("SELECT * FROM guarantor_number WHERE guarantor_id = $1 ORDER BY guarantor_number_id", [guarantor_id]);
  res.json(result.rows);
}

async function deleteGuarantorNumber(req, res) {
  const { guarantor_number_id } = req.params;
  if (!/^\d+$/.test(guarantor_number_id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const check = await pool.query("SELECT * FROM guarantor_number WHERE guarantor_number_id = $1", [guarantor_number_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Phone number not found" });
    await pool.query("DELETE FROM guarantor_number WHERE guarantor_number_id = $1", [guarantor_number_id]);
    res.json({ message: "Phone number deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { createGuarantorNumber, getNumbersForGuarantor, deleteGuarantorNumber };