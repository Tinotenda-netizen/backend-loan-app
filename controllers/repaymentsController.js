const pool = require("../db");

const VALID_METHODS = ['cash', 'ecocash', 'onemoney', 'bank_transfer', 'innbucks', 'other'];

async function createRepayment(req, res) {
  const { loan_id, amount_paid, payment_method, payment_date, reference } = req.body;

  if (!loan_id || !/^\d+$/.test(String(loan_id))) return res.status(400).json({ error: "Valid loan_id is required" });
  if (amount_paid === undefined || isNaN(amount_paid) || Number(amount_paid) <= 0) return res.status(400).json({ error: "amount_paid must be greater than 0" });
  if (payment_method && !VALID_METHODS.includes(payment_method)) return res.status(400).json({ error: `payment_method must be one of: ${VALID_METHODS.join(", ")}` });
  if (payment_date && isNaN(Date.parse(payment_date))) return res.status(400).json({ error: "Invalid payment_date" });
  if (payment_date && new Date(payment_date) > new Date()) return res.status(400).json({ error: "payment_date cannot be in the future" });

  try {
    const loanRes = await pool.query("SELECT * FROM loan WHERE loan_id = $1", [loan_id]);
    if (loanRes.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
    const loan = loanRes.rows[0];
    if (loan.status === 'paid') return res.status(400).json({ error: "Loan is already fully paid" });
    if (loan.status === 'rejected') return res.status(400).json({ error: "Cannot pay a rejected loan" });

    // Calculate remaining
    const paidRes = await pool.query("SELECT COALESCE(SUM(amount_paid),0) as total_paid FROM repayment WHERE loan_id = $1", [loan_id]);
    const totalPaid = Number(paidRes.rows[0].total_paid);
    const totalPayable = Number(loan.total_payable || loan.amount_given);
    const remaining = totalPayable - totalPaid;

    if (Number(amount_paid) > remaining) {
      return res.status(400).json({ error: `Payment exceeds remaining balance. Remaining: ${remaining.toFixed(2)}` });
    }

    const result = await pool.query(
      "INSERT INTO repayment (loan_id, amount_paid, payment_method, payment_date, reference) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [loan_id, amount_paid, payment_method || 'cash', payment_date || new Date(), reference || null]
    );

    // Auto-update loan status if fully paid
    const newTotalPaid = totalPaid + Number(amount_paid);
    if (newTotalPaid >= totalPayable) {
      await pool.query("UPDATE loan SET status = 'paid' WHERE loan_id = $1", [loan_id]);
    } else if (loan.status === 'pending') {
      await pool.query("UPDATE loan SET status = 'active' WHERE loan_id = $1", [loan_id]);
    }

    res.status(201).json({ repayment: result.rows[0], remaining_balance: totalPayable - newTotalPaid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

async function getRepaymentsForLoan(req, res) {
  const { loan_id } = req.params;
  if (!/^\d+$/.test(loan_id)) return res.status(400).json({ error: "Invalid loan id" });
  const loan = await pool.query("SELECT * FROM loan WHERE loan_id = $1", [loan_id]);
  if (loan.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
  const result = await pool.query("SELECT * FROM repayment WHERE loan_id = $1 ORDER BY payment_date DESC, repayment_id DESC", [loan_id]);
  res.json(result.rows);
}

async function getAllRepayments(req, res) {
  const result = await pool.query("SELECT r.*, l.borrower_id FROM repayment r JOIN loan l ON r.loan_id = l.loan_id ORDER BY r.repayment_id DESC");
  res.json(result.rows);
}

async function deleteRepayment(req, res) {
  const { repayment_id } = req.params;
  if (!/^\d+$/.test(repayment_id)) return res.status(400).json({ error: "Invalid repayment id" });
  try {
    const check = await pool.query("SELECT * FROM repayment WHERE repayment_id = $1", [repayment_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Repayment not found" });
    const loan_id = check.rows[0].loan_id;
    await pool.query("DELETE FROM repayment WHERE repayment_id = $1", [repayment_id]);
    const loan = await pool.query("SELECT * FROM loan WHERE loan_id = $1", [loan_id]);
    if (loan.rows[0] && loan.rows[0].status === 'paid') {
      const paidRes = await pool.query("SELECT COALESCE(SUM(amount_paid),0) as total FROM repayment WHERE loan_id = $1", [loan_id]);
      if (Number(paidRes.rows[0].total) < Number(loan.rows[0].total_payable)) {
        await pool.query("UPDATE loan SET status = 'active' WHERE loan_id = $1", [loan_id]);
      }
    }
    res.json({ message: "Repayment deleted" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
}

module.exports = { createRepayment, getRepaymentsForLoan, getAllRepayments, deleteRepayment };