const pool = require("../db");

const VALID_STATUSES = ['pending', 'active', 'paid', 'overdue', 'defaulted', 'rejected'];
const VALID_PURPOSES = ['business', 'school_fees', 'medical', 'rent', 'personal', 'agriculture', 'other'];

// Helper: generate schedule
function generateSchedule({ loan_id, amount_given, interest_rate, duration_months, loan_date }) {
  const totalInterest = Number(amount_given) * (Number(interest_rate) / 100);
  const totalPayable = Number(amount_given) + totalInterest;
  const monthly = totalPayable / duration_months;
  const principalPerMonth = Number(amount_given) / duration_months;
  const interestPerMonth = totalInterest / duration_months;

  const rows = [];
  const start = new Date(loan_date);
  for (let i = 1; i <= duration_months; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    rows.push({
      loan_id,
      installment_number: i,
      due_date: due.toISOString().split('T')[0],
      amount_due: monthly.toFixed(2),
      principal_due: principalPerMonth.toFixed(2),
      interest_due: interestPerMonth.toFixed(2),
    });
  }
  return { rows, totalPayable, monthly };
}

// 1. CREATE - stays pending, no schedule yet
async function createLoan(req, res) {
  const { borrower_id, guarantor_id, amount_given, interest_rate, duration_months, purpose, loan_date } = req.body;

  if (!borrower_id || !/^\d+$/.test(String(borrower_id))) return res.status(400).json({ error: "Valid borrower_id is required" });
  if (guarantor_id && !/^\d+$/.test(String(guarantor_id))) return res.status(400).json({ error: "Invalid guarantor_id" });
  if (amount_given === undefined || isNaN(amount_given) || Number(amount_given) <= 0) return res.status(400).json({ error: "amount_given must be a number greater than 0" });
  if (Number(amount_given) > 100000) return res.status(400).json({ error: "Loan amount too large. Max 100,000" });
  if (interest_rate === undefined || isNaN(interest_rate) || Number(interest_rate) < 0 || Number(interest_rate) > 100) return res.status(400).json({ error: "interest_rate must be between 0 and 100" });
  if (!duration_months || !Number.isInteger(Number(duration_months)) || Number(duration_months) < 1 || Number(duration_months) > 60) return res.status(400).json({ error: "duration_months must be an integer between 1 and 60" });
  if (purpose && !VALID_PURPOSES.includes(purpose)) return res.status(400).json({ error: `purpose must be one of: ${VALID_PURPOSES.join(", ")}` });
  if (loan_date && isNaN(Date.parse(loan_date))) return res.status(400).json({ error: "Invalid loan_date" });

  try {
    const borrower = await pool.query("SELECT * FROM borrower WHERE borrower_id = $1 AND (is_deleted = false OR is_deleted IS NULL)", [borrower_id]);
    if (borrower.rows.length === 0) return res.status(404).json({ error: "Borrower not found" });
    if (guarantor_id) {
      const g = await pool.query("SELECT * FROM guarantor WHERE guarantor_id = $1", [guarantor_id]);
      if (g.rows.length === 0) return res.status(404).json({ error: "Guarantor not found" });
    }
    // Block if borrower has overdue/defaulted
    const bad = await pool.query("SELECT loan_id FROM loan WHERE borrower_id=$1 AND status IN ('overdue','defaulted')", [borrower_id]);
    if (bad.rows.length > 0) return res.status(400).json({ error: "Borrower has overdue/defaulted loan. Cannot apply for new loan." });

    const active = await pool.query("SELECT loan_id FROM loan WHERE borrower_id = $1 AND status IN ('pending','active','overdue','defaulted')", [borrower_id]);
    if (active.rows.length > 0) return res.status(400).json({ error: "Borrower already has an active/pending loan. Pay it off first." });

    const totalInterest = Number(amount_given) * (Number(interest_rate) / 100);
    const totalPayable = Number(amount_given) + totalInterest;

    const result = await pool.query(
      "INSERT INTO loan (borrower_id, guarantor_id, amount_given, interest_rate, duration_months, purpose, loan_date, total_payable, remaining_balance, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING *",
      [borrower_id, guarantor_id || null, amount_given, interest_rate, duration_months, purpose || 'personal', loan_date || new Date(), totalPayable, totalPayable]
    );
    await pool.query("INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1,'CREATE_LOAN','loan',$2,$3)", [req.user.user_id, result.rows[0].loan_id, JSON.stringify({ amount_given })]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

// 2. GET ALL - this is your OLD one, kept
async function getLoans(req, res) {
  const { status, borrower_id } = req.query;
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  if (borrower_id && !/^\d+$/.test(borrower_id)) return res.status(400).json({ error: "Invalid borrower_id" });

  let query = "SELECT l.*, b.borrower_name, b.borrower_surname FROM loan l LEFT JOIN borrower b ON l.borrower_id = b.borrower_id";
  const values = [];
  const conditions = [];
  if (status) { conditions.push(`l.status = $${values.length + 1}`); values.push(status); }
  if (borrower_id) { conditions.push(`l.borrower_id = $${values.length + 1}`); values.push(borrower_id); }
  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY l.loan_id DESC";

  const result = await pool.query(query, values);
  res.json(result.rows);
}

// 3. GET ONE - your OLD one, kept
async function getLoanById(req, res) {
  const { loan_id } = req.params;
  if (!/^\d+$/.test(loan_id)) return res.status(400).json({ error: "Invalid loan id" });
  const result = await pool.query("SELECT * FROM loan WHERE loan_id = $1", [loan_id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
  res.json(result.rows[0]);
}

// 4. APPROVE / REJECT - NEW
async function approveLoan(req, res) {
  const { loan_id } = req.params;
  const { action } = req.body;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

  try {
    const r = await pool.query("SELECT * FROM loan WHERE loan_id=$1", [loan_id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
    const loan = r.rows[0];
    if (loan.status !== 'pending') return res.status(400).json({ error: `Only pending loans can be approved. Current: ${loan.status}` });

    if (action === 'reject') {
      await pool.query("UPDATE loan SET status='rejected' WHERE loan_id=$1", [loan_id]);
      await pool.query("INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1,'REJECT_LOAN','loan',$2)", [req.user.user_id, loan_id]);
      return res.json({ message: "Loan rejected" });
    }

    const { rows, totalPayable, monthly } = generateSchedule(loan);
    for (const row of rows) {
      await pool.query(
        "INSERT INTO loan_schedule (loan_id, installment_number, due_date, amount_due, principal_due, interest_due) VALUES ($1,$2,$3,$4,$5,$6)",
        [row.loan_id, row.installment_number, row.due_date, row.amount_due, row.principal_due, row.interest_due]
      );
    }
    await pool.query(
      "UPDATE loan SET status='active', approved_by=$1, approved_at=NOW(), monthly_installment=$2, total_payable=$3, remaining_balance=$3 WHERE loan_id=$4",
      [req.user.user_id, monthly.toFixed(2), totalPayable, loan_id]
    );
    await pool.query("INSERT INTO audit_log (user_id, action, entity_type, entity_id, details) VALUES ($1,'APPROVE_LOAN','loan',$2,$3)", [req.user.user_id, loan_id, JSON.stringify({ monthly })]);

    const schedule = await pool.query("SELECT * FROM loan_schedule WHERE loan_id=$1 ORDER BY installment_number", [loan_id]);
    res.json({ message: "Loan approved, schedule generated", monthly_installment: monthly.toFixed(2), schedule: schedule.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: "Server error" }); }
}

// 5. DISBURSE - NEW
async function disburseLoan(req, res) {
  const { loan_id } = req.params;
  const { disbursement_method, disbursement_ref } = req.body;
  if (!['cash', 'ecocash', 'onemoney', 'bank_transfer'].includes(disbursement_method)) return res.status(400).json({ error: "Method must be cash, ecocash, onemoney or bank_transfer" });
  try {
    const r = await pool.query("SELECT * FROM loan WHERE loan_id=$1", [loan_id]);
    if (r.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
    if (r.rows[0].status !== 'active') return res.status(400).json({ error: "Only approved (active) loans can be disbursed" });
    await pool.query("UPDATE loan SET disbursed_at=NOW(), disbursement_method=$1, disbursement_ref=$2 WHERE loan_id=$3", [disbursement_method, disbursement_ref || null, loan_id]);
    res.json({ message: "Loan disbursed" });
  } catch (e) { console.error(e); res.status(500).json({ error: "Server error" }); }
}

// 6. UPDATE STATUS - your OLD one, kept (for manual overdue/defaulted)
async function updateLoanStatus(req, res) {
  const { loan_id } = req.params;
  const { status } = req.body;
  if (!/^\d+$/.test(loan_id)) return res.status(400).json({ error: "Invalid loan id" });
  if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  try {
    const check = await pool.query("SELECT * FROM loan WHERE loan_id = $1", [loan_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
    const current = check.rows[0].status;
    if (current === 'paid' && status !== 'paid') return res.status(400).json({ error: "Paid loan cannot be changed" });
    if (current === 'rejected' && status !== 'rejected') return res.status(400).json({ error: "Rejected loan cannot be changed" });
    const result = await pool.query("UPDATE loan SET status = $1 WHERE loan_id = $2 RETURNING *", [status, loan_id]);
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "Server error" }); }
}

// 7. DELETE - your OLD one, kept
async function deleteLoan(req, res) {
  const { loan_id } = req.params;
  if (!/^\d+$/.test(loan_id)) return res.status(400).json({ error: "Invalid loan id" });
  try {
    const check = await pool.query("SELECT * FROM loan WHERE loan_id = $1", [loan_id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Loan not found" });
    if (check.rows[0].status !== 'pending') return res.status(400).json({ error: "Only pending loans can be deleted" });
    await pool.query("DELETE FROM loan WHERE loan_id = $1", [loan_id]);
    res.json({ message: "Loan deleted" });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(400).json({ error: "Cannot delete loan, it has repayments" });
    res.status(500).json({ error: "Server error" });
  }
}

// 8. OVERDUE LIST - NEW
async function getOverdueLoans(req, res) {
  await pool.query(`
    UPDATE loan_schedule SET penalty = ROUND(amount_due * 0.05, 2), status = 'overdue'
    WHERE status IN ('pending','partial')
    AND due_date < CURRENT_DATE - INTERVAL '3 days'
    AND penalty = 0
  `);
  await pool.query(`
    UPDATE loan SET status='overdue' WHERE loan_id IN (
      SELECT DISTINCT loan_id FROM loan_schedule WHERE status='overdue'
    ) AND status='active'
  `);
  const result = await pool.query(`
    SELECT l.loan_id, b.borrower_name, b.borrower_surname, l.amount_given, l.remaining_balance,
           s.installment_number, s.due_date, s.amount_due, s.amount_paid, s.penalty,
           (CURRENT_DATE - s.due_date) as days_overdue
    FROM loan_schedule s
    JOIN loan l ON s.loan_id = l.loan_id
    JOIN borrower b ON l.borrower_id = b.borrower_id
    WHERE s.status='overdue' OR (s.status IN ('pending','partial') AND s.due_date < CURRENT_DATE)
    ORDER BY s.due_date ASC
  `);
  res.json(result.rows);
}

// 9. BORROWER STATEMENT - NEW
async function getBorrowerStatement(req, res) {
  const { borrower_id } = req.params;
  const borrower = await pool.query("SELECT * FROM borrower WHERE borrower_id=$1", [borrower_id]);
  if (borrower.rows.length === 0) return res.status(404).json({ error: "Borrower not found" });
  const loans = await pool.query("SELECT * FROM loan WHERE borrower_id=$1 ORDER BY loan_id DESC", [borrower_id]);
  const repayments = await pool.query("SELECT r.* FROM repayment r JOIN loan l ON r.loan_id=l.loan_id WHERE l.borrower_id=$1 ORDER BY r.payment_date DESC", [borrower_id]);
  const schedule = await pool.query("SELECT s.* FROM loan_schedule s JOIN loan l ON s.loan_id=l.loan_id WHERE l.borrower_id=$1 ORDER BY s.due_date", [borrower_id]);
  const totalBorrowed = loans.rows.reduce((sum, l) => sum + Number(l.amount_given), 0);
  const totalPayable = loans.rows.reduce((sum, l) => sum + Number(l.total_payable || 0), 0);
  const totalPaid = repayments.rows.reduce((sum, r) => sum + Number(r.amount_paid), 0);
  res.json({
    borrower: borrower.rows[0],
    summary: { total_loans: loans.rows.length, total_borrowed: totalBorrowed, total_payable: totalPayable, total_paid: totalPaid, total_owed: totalPayable - totalPaid },
    loans: loans.rows,
    schedule: schedule.rows,
    repayments: repayments.rows
  });
}

module.exports = { createLoan, getLoans, getLoanById, approveLoan, disburseLoan, updateLoanStatus, deleteLoan, getOverdueLoans, getBorrowerStatement };
