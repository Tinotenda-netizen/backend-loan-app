const pool = require("../db");
const { isValidName } = require("../utils/validate");

async function createBorrower(req, res) {
  const { phone_id, borrower_name, borrower_second_name, borrower_surname, national_id, employer, address } = req.body;

  if (!isValidName(borrower_name)) {
    return res.status(400).json({ error: "Borrower name must contain only letters, hyphen or apostrophe" });
  }
  // FIXED: your old code was `if(borrower_second_name || !isValidName...)` which failed when empty
  if (borrower_second_name && !isValidName(borrower_second_name)) {
    return res.status(400).json({ error: "Second name must contain only letters, hyphen or apostrophe" });
  }
  if (!isValidName(borrower_surname)) {
    return res.status(400).json({ error: "Surname must contain only letters, hyphen or apostrophe" });
  }
  if (!phone_id || !national_id) {
    return res.status(400).json({ error: "Borrower phone and national id is required" }); // FIXED: missing return
  }
  try {
    const result = await pool.query(
      "INSERT INTO borrower (phone_id, borrower_name, borrower_second_name, borrower_surname, national_id, employer, address) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [phone_id, borrower_name, borrower_second_name, borrower_surname, national_id, employer, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "National id or phone already exists" });
    res.status(500).json({ error: "Server error" });
  }
}

async function getBorrowers(req, res) {
  try{
  const result = await pool.query("SELECT * FROM borrower WHERE is_deleted = false OR is_deleted IS NULL ORDER BY borrower_id");
  res.status(200).json(result.rows);
} catch(err){
  console.error(err);
  res.status(500).json({error:"Server error"})
}
}

async function getBorrowerById(req, res) {
  const { borrower_id } = req.params;
  if (!/^\d+$/.test(borrower_id)) { 
    return res.status(400).json({ error: "Invalid borrower id" });
  }
  try {
  const result = await pool.query("SELECT * FROM borrower WHERE borrower_id = $1", [borrower_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Borrower not found" });
  res.status(200).json(result.rows[0]);
} catch (err) {
  console.error(err);
  res.status(500).json({error:"Server error"})

}}

async function updateBorrower(req, res) {
  const { borrower_id } = req.params;
  const { phone_id, borrower_name, borrower_second_name, borrower_surname, national_id, employer, address } = req.body;

  if (borrower_name !== undefined && !isValidName(borrower_name)) {
    return res.status(400).json({ error: "Name must contain only letters, hyphen or apostrophe" });
  }
  if (borrower_second_name !== undefined && borrower_second_name !== "" && borrower_second_name !== null && !isValidName(borrower_second_name)) {
    return res.status(400).json({ error: "Second name must contain only letters, hyphen or apostrophe" });
  }
  if (borrower_surname !== undefined && !isValidName(borrower_surname)) {
    return res.status(400).json({ error: "Surname must contain only letters, hyphen or apostrophe" });
  }
  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }
  try {
    const check = await pool.query("SELECT * FROM borrower WHERE borrower_id = $1", [borrower_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Borrower not found" }); // FIXED: was 400

    const fields = []; const values = []; let i = 1;
    if (borrower_name !== undefined) { fields.push(`borrower_name = $${i++}`); values.push(borrower_name.trim()); }
    if (borrower_second_name !== undefined) { fields.push(`borrower_second_name = $${i++}`); values.push(borrower_second_name ? borrower_second_name.trim() : null); }
    if (borrower_surname !== undefined) { fields.push(`borrower_surname = $${i++}`); values.push(borrower_surname.trim()); }
    if (phone_id !== undefined) { fields.push(`phone_id = $${i++}`); values.push(phone_id); }
    if (national_id !== undefined) { fields.push(`national_id = $${i++}`); values.push(national_id); }
    if (employer !== undefined) { fields.push(`employer = $${i++}`); values.push(employer); }
    if (address !== undefined) { fields.push(`address = $${i++}`); values.push(address); }

    values.push(borrower_id);
    const result = await pool.query(`UPDATE borrower SET ${fields.join(", ")} WHERE borrower_id = $${i} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "National id or phone already exists for another borrower" });
    res.status(500).json({ error: "Server error" });
  }
}

async function deleteBorrower(req, res) {
  const { borrower_id } = req.params;
  if (!/^\d+$/.test(borrower_id)) { 
    return res.status(400).json({ error: "Invalid borrower id" });
  }
  try {
    const check = await pool.query("SELECT * FROM borrower WHERE borrower_id = $1", [borrower_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Borrower not found" });

    const activeLoans = await pool.query(
      "SELECT loan_id, amount_given, status FROM loan WHERE borrower_id = $1 AND status IN ('pending', 'active', 'overdue', 'defaulted')",
      [borrower_id]
    );
    if (activeLoans.rows.length > 0) {
      return res.status(400).json({ error: "Can not delete borrower with active loans", active_loans: activeLoans.rows.length, loans: activeLoans.rows });
    }
    await pool.query("UPDATE borrower SET is_deleted = true WHERE borrower_id = $1", [borrower_id]);
    res.status(200).json({ message: "Borrower successfully deleted" });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(400).json({ error: "Cannot delete borrower. They still have loans or payments linked to them" });
    res.status(500).json({ error: "Server error" });
  }
}
module.exports = { createBorrower, getBorrowers, getBorrowerById, updateBorrower, deleteBorrower };