const pool = require("../db");

function isValidPhone(phone) {
 
  if (typeof phone !== 'string') return false;
  const cleaned = phone.replace(/\s/g, '');
  return /^(07\d{8}|\+2637\d{8}|2637\d{8})$/.test(cleaned);
}

function normalizePhone(phone) {
  let p = phone.replace(/\s/g, '');
  if (p.startsWith('+263')) return '0' + p.slice(4);
  if (p.startsWith('263')) return '0' + p.slice(3);
  return p;
}

async function createPhone(req, res) {
  const { phone_number, phone_type } = req.body;

  if (!phone_number || !isValidPhone(phone_number)) {
    return res.status(400).json({ error: "Valid phone number is required. Format: 0771234567 or +263771234567" });
  }
  if (phone_type && !['personal', 'work', 'home', 'next_of_kin', 'other'].includes(phone_type)) {
    return res.status(400).json({ error: "phone_type must be personal, work, home, next_of_kin or other" });
  }

  try {
    const normalized = normalizePhone(phone_number);
    const result = await pool.query(
      "INSERT INTO phone (phone_number, phone_type) VALUES ($1, $2) RETURNING *",
      [normalized, phone_type || 'personal']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "Phone number already exists" });
    res.status(500).json({ error: "Server error" });
  }
}

async function getPhones(req, res) {
  const result = await pool.query("SELECT * FROM phone ORDER BY phone_id");
  res.json(result.rows);
}

async function getPhoneById(req, res) {
  const { phone_id } = req.params;
  if (!/^\d+$/.test(phone_id)) return res.status(400).json({ error: "Invalid phone id" });
  const result = await pool.query("SELECT * FROM phone WHERE phone_id = $1", [phone_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Phone not found" });
  res.json(result.rows[0]);
}

async function updatePhone(req, res) {
  const { phone_id } = req.params;
  const { phone_number, phone_type } = req.body;
  if (!/^\d+$/.test(phone_id)) return res.status(400).json({ error: "Invalid phone id" });
  if (phone_number !== undefined && !isValidPhone(phone_number)) {
    return res.status(400).json({ error: "Valid phone number is required" });
  }
  if (phone_type !== undefined && !['personal','work','home','next_of_kin','other'].includes(phone_type)) {
    return res.status(400).json({ error: "Invalid phone_type" });
  }
  if (Object.keys(req.body).length === 0) return res.status(400).json({ error: "No fields to update" });

  try {
    const check = await pool.query("SELECT * FROM phone WHERE phone_id = $1", [phone_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Phone not found" });

    const fields = []; const values = []; let i = 1;
    if (phone_number !== undefined) { fields.push(`phone_number = $${i++}`); values.push(normalizePhone(phone_number)); }
    if (phone_type !== undefined) { fields.push(`phone_type = $${i++}`); values.push(phone_type); }
    values.push(phone_id);
    const result = await pool.query(`UPDATE phone SET ${fields.join(", ")} WHERE phone_id = $${i} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "Phone number already exists" });
    res.status(500).json({ error: "Server error" });
  }
}

async function deletePhone(req, res) {
  const { phone_id } = req.params;
  if (!/^\d+$/.test(phone_id)) return res.status(400).json({ error: "Invalid phone id" });
  try {
    const check = await pool.query("SELECT * FROM phone WHERE phone_id = $1", [phone_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Phone not found" });
    
    const inUse = await pool.query("SELECT borrower_id FROM borrower WHERE phone_id = $1 LIMIT 1", [phone_id]);
    if (inUse.rows.length > 0) {
      return res.status(400).json({ error: "Cannot delete phone. It is linked to a borrower" });
    }
    await pool.query("DELETE FROM phone WHERE phone_id = $1", [phone_id]);
    res.json({ message: "Phone deleted" });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(400).json({ error: "Cannot delete phone, it is still linked" });
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { createPhone, getPhones, getPhoneById, updatePhone, deletePhone };
