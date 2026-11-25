const { response } = require("express");
const pool =  require("../db");

async function getDashboard(req, res) {
    try {
        const borrowers = await pool.query(
            "SELECT COUNT(*) AS count FROM borrower "
        );
        const loans = await pool.query("SELECT COUNT(*) AS count FROM loan");
        const repaid = await pool.query("SELECT COALESCE(SUM(amount_paid), 0) AS total FROM repayment ");
        //const loanAmount = await pool.query("SELECT COALESCE(SUM(amount_given), 0) AS total FROM loan");
        res.status(200).json({
            totalBorrowers:parseInt(borrowers.rows[0].count),
            totalLoans: parseInt(loans.rows[0].count),
            //totalLoanAmount: parseFloat(loanAmount.row[0].total),
            totalRepaid: parseFloat(repaid.rows[0].total)
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({error: "Server error"});
    }
}

module.exports = {getDashboard};