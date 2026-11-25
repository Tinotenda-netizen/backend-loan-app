const pool = require("../db");
const { isValidName } = require("../utils/validate");

function isValidNationalId(id) {
  if (typeof id !== 'string') return false;
  // Zim format: 12-345678-A-12
  return /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/.test(id.trim());
}

async function createGuarantor(req, res) {
  const { guarantor_name, guarantor_second_name, guarantor_surname, national_id, relationship, employer, address } = req.body;

  if (!isValidName(guarantor_name)) return res.status(400).json({ error: "Guarantor name must contain only letters, hyphen or apostrophe" });
  if (guarantor_second_name && !isValidName(guarantor_second_name)) return res.status(400).json({ error: "Second name must contain only letters, hyphen or apostrophe" });
  if (!isValidName(guarantor_surname)) return res.status(400).json({ error: "Surname must contain only letters, hyphen or apostrophe" });
  if (!national_id || !isValidNationalId(national_id)) return res.status(400).json({ error: "Valid national ID is required. Format: 12-345678-A-12" });
  if (relationship && relationship.length > 50) return res.status(400).json({ error: "Relationship too long" });

  try {
    const result = await pool.query(
      "INSERT INTO guarantor (guarantor_name, guarantor_second_name, guarantor_surname, national_id, relationship, employer, address) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [guarantor_name.trim(), guarantor_second_name ? guarantor_second_name.trim() : null, guarantor_surname.trim(), national_id.trim(), relationship || null, employer || null, address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "National ID already exists for another guarantor" });
    res.status(500).json({ error: "Server error" });
  }
}

async function getGuarantors(req, res) {
  const result = await pool.query("SELECT * FROM guarantor ORDER BY guarantor_id");
  res.json(result.rows);
}

async function getGuarantorById(req, res) {
  const { guarantor_id } = req.params;
  if (!/^\d+$/.test(guarantor_id)) return res.status(400).json({ error: "Invalid guarantor id" });
  const result = await pool.query("SELECT * FROM guarantor WHERE guarantor_id = $1", [guarantor_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Guarantor not found" });
  res.json(result.rows[0]);
}

async function updateGuarantor(req, res) {
  const { guarantor_id } = req.params;
  const { guarantor_name, guarantor_second_name, guarantor_surname, national_id, relationship, employer, address } = req.body;
  if (!/^\d+$/.test(guarantor_id)) return res.status(400).json({ error: "Invalid guarantor id" });
  if (guarantor_name !== undefined && !isValidName(guarantor_name)) return res.status(400).json({ error: "Name must contain only letters" });
  if (guarantor_second_name !== undefined && guarantor_second_name && !isValidName(guarantor_second_name)) return res.status(400).json({ error: "Second name must contain only letters" });
  if (guarantor_surname !== undefined && !isValidName(guarantor_surname)) return res.status(400).json({ error: "Surname must contain only letters" });
  if (national_id !== undefined && !isValidNationalId(national_id)) return res.status(400).json({ error: "Valid national ID required. Format: 12-345678-A-12" });
  if (Object.keys(req.body).length === 0) return res.status(400).json({ error: "No fields to update" });

  try {
    const check = await pool.query("SELECT * FROM guarantor WHERE guarantor_id = $1", [guarantor_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Guarantor not found" });
    const fields = []; const values = []; let i = 1;
    if (guarantor_name !== undefined) { fields.push(`guarantor_name = $${i++}`); values.push(guarantor_name.trim()); }
    if (guarantor_second_name !== undefined) { fields.push(`guarantor_second_name = $${i++}`); values.push(guarantor_second_name ? guarantor_second_name.trim() : null); }
    if (guarantor_surname !== undefined) { fields.push(`guarantor_surname = $${i++}`); values.push(guarantor_surname.trim()); }
    if (national_id !== undefined) { fields.push(`national_id = $${i++}`); values.push(national_id.trim()); }
    if (relationship !== undefined) { fields.push(`relationship = $${i++}`); values.push(relationship); }
    if (employer !== undefined) { fields.push(`employer = $${i++}`); values.push(employer); }
    if (address !== undefined) { fields.push(`address = $${i++}`); values.push(address); }
    values.push(guarantor_id);
    const result = await pool.query(`UPDATE guarantor SET ${fields.join(", ")} WHERE guarantor_id = $${i} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "National ID already exists" });
    res.status(500).json({ error: "Server error" });
  }
}

async function deleteGuarantor(req, res) {
  const { guarantor_id } = req.params;
  if (!/^\d+$/.test(guarantor_id)) return res.status(400).json({ error: "Invalid guarantor id" });
  try {
    const check = await pool.query("SELECT * FROM guarantor WHERE guarantor_id = $1", [guarantor_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Guarantor not found" });
    // Prevent delete if guarantor is linked to an active loan
    const linked = await pool.query("SELECT loan_id FROM loan WHERE guarantor_id = $1 AND status IN ('pending','active','overdue','defaulted') LIMIT 1", [guarantor_id]);
    if (linked.rows.length > 0) return res.status(400).json({ error: "Cannot delete guarantor with active loans" });
    await pool.query("DELETE FROM guarantor WHERE guarantor_id = $1", [guarantor_id]);
    res.json({ message: "Guarantor deleted" });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(400).json({ error: "Cannot delete guarantor, still linked to loans" });
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { createGuarantor, getGuarantors, getGuarantorById, updateGuarantor, deleteGuarantor };
