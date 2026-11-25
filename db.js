// File: db.js
const { Pool } = require("pg");
require("dotenv").config();
 
const pool = process.env.DATABASE_URL
  ?new Pool({
    connectionString: process.env.DATABASE_URL,
    SSL: { rejectUnauthorized: false}
  })
  :new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432,
});
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phone (
          phone_id SERIAL PRIMARY KEY,
          phone_number VARCHAR(10) NOT NULL,
          number_2 VARCHAR(10),
          phone_type VARCHAR(25),
          CONSTRAINT unique_phone UNIQUE (phone_number)
      );
      CREATE TABLE IF NOT EXISTS borrower (
          borrower_id SERIAL PRIMARY KEY,
          phone_id INTEGER NOT NULL,
          borrower_name VARCHAR(100) NOT NULL,
          national_id VARCHAR(13) NOT NULL,
          employer VARCHAR(100) NOT NULL,
          address VARCHAR(100) NOT NULL,
          borrower_surname VARCHAR(100),
          borrower_second_name VARCHAR(100),
          is_deleted BOOLEAN DEFAULT false,
          CONSTRAINT borrower_national_id_key UNIQUE (national_id),
          CONSTRAINT borrower_phone_id_fkey FOREIGN KEY (phone_id) REFERENCES phone (phone_id),
          CONSTRAINT name_check CHECK (length(TRIM(BOTH FROM borrower_name)) >= 2)
      );
      CREATE TABLE IF NOT EXISTS guarantor (
          guarantor_id SERIAL PRIMARY KEY,
          guarantor_name VARCHAR(100) NOT NULL,
          national_id VARCHAR(15) NOT NULL,
          employer VARCHAR(100) NOT NULL,
          address VARCHAR(100) NOT NULL,
          guarantor_second_name VARCHAR(50),
          guarantor_surname VARCHAR(50) NOT NULL,
          relationship VARCHAR(50) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS guarantor_number (
          guarantor_number_id SERIAL PRIMARY KEY,
          phone_number VARCHAR(10) NOT NULL,
          num_2 VARCHAR(10),
          guarantor_id INTEGER NOT NULL REFERENCES guarantor(guarantor_id)
      );
      CREATE TABLE IF NOT EXISTS users (
          user_id SERIAL PRIMARY KEY,
          phone VARCHAR(10) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL,
          user_role VARCHAR(50) NOT NULL,
          password_hash VARCHAR(500) NOT NULL,
          created_at TIMESTAMP DEFAULT now(),
          borrower_id INTEGER REFERENCES borrower(borrower_id),
          CONSTRAINT users_email_key UNIQUE (email),
          CONSTRAINT users_role_check CHECK (user_role IN ('admin','loan_officer','borrower'))
      );
      CREATE TABLE IF NOT EXISTS loan (
          loan_id SERIAL PRIMARY KEY,
          borrower_id INTEGER NOT NULL REFERENCES borrower(borrower_id),
          amount_given NUMERIC(10,2),
          date_given DATE NOT NULL DEFAULT CURRENT_DATE,
          due_date DATE,
          amount_due NUMERIC(10,2),
          money_form VARCHAR(20),
          status VARCHAR(20) NOT NULL DEFAULT 'Active',
          approved_by INTEGER REFERENCES users(user_id),
          approved_at TIMESTAMP,
          disbursed_at TIMESTAMP,
          disbursement_method VARCHAR(30),
          disbursement_ref VARCHAR(50),
          monthly_installment NUMERIC(12,2),
          remaining_balance NUMERIC(12,2),
          guarantor_id INTEGER REFERENCES guarantor(guarantor_id),
          interest_rate NUMERIC(10,2),
          duration_months INTEGER,
          purpose VARCHAR(20),
          loan_date DATE,
          total_payable NUMERIC(10,2),
          CONSTRAINT amount_check CHECK (amount_given >= 50 AND amount_given <= 1000),
          CONSTRAINT loan_amount_given_check CHECK (amount_given > 0),
          CONSTRAINT loan_money_form_check CHECK (money_form IN ('Cash','Ecocash','Bank Transfer')),
          CONSTRAINT returned_amount CHECK (amount_due > 0)
      );
      CREATE TABLE IF NOT EXISTS loan_schedule (
          schedule_id SERIAL PRIMARY KEY,
          loan_id INTEGER REFERENCES loan(loan_id) ON DELETE CASCADE,
          installment_number INTEGER NOT NULL,
          due_date DATE NOT NULL,
          amount_due NUMERIC(12,2) NOT NULL,
          principal_due NUMERIC(12,2) NOT NULL,
          interest_due NUMERIC(12,2) NOT NULL,
          penalty NUMERIC(12,2) DEFAULT 0,
          amount_paid NUMERIC(12,2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'pending',
          paid_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS repayment (
          repayment_id SERIAL PRIMARY KEY,
          loan_id INTEGER NOT NULL REFERENCES loan(loan_id),
          amount_paid NUMERIC(10,2) NOT NULL,
          payment_date DATE NOT NULL,
          payment_method VARCHAR(25),
          reference VARCHAR(25)
      );
      CREATE TABLE IF NOT EXISTS receipt (
          receipt_id SERIAL PRIMARY KEY,
          repayment_id INTEGER REFERENCES repayment(repayment_id),
          receipt_number VARCHAR(20) NOT NULL UNIQUE,
          borrower_id INTEGER REFERENCES borrower(borrower_id),
          loan_id INTEGER REFERENCES loan(loan_id),
          amount NUMERIC(12,2) NOT NULL,
          issued_at TIMESTAMP DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS audit_log (
          log_id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(user_id),
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(30),
          entity_id INTEGER,
          details JSONB,
          created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✅ Tables created / already exist");
  } catch (err) {
    console.error("❌ Table creation failed:", err.message);
  }
};
createTables();

 
module.exports = pool;
