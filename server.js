require("dotenv").config();
const express = require("express");
const app = express();
const dashboardRoutes = require("./routes/dashboard");
const PORT = process.env.PORT || 3000;
app.use(express.json());

function logRequests(req, res, next) {
  console.log(`${req.method} ${req.path} at ${new Date().toISOString()}`);
  next();
}
app.use(logRequests);

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", require("./routes/auth"));
app.use("/api/borrower", require("./routes/borrowers"));
app.use("/api/guarantor", require("./routes/guarantors"));
app.use("/api/loan", require("./routes/loans"));
app.use("/api/repayment", require("./routes/repayments"));
app.use("/api/phone", require("./routes/phones"));
app.use("/api/phone", require("./routes/phones"));
app.use("/api/guarantor", require("./routes/guarantors"));
app.use("/api/guarantor-number", require("./routes/guarantorNumbers"));
app.use("/api/loan", require("./routes/loans"));
app.use("/api/repayment", require("./routes/repayments"));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on our end" });
});

app.listen(PORT, () => console.log("API running on port:3000"));
