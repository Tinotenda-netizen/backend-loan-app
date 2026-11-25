const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "Another_top_secret";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied, no token provided" });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "invalid or expired token" });
    req.user = decoded; // { user_id, email, user_role, borrower_id }
    next();
  });
}

// NEW: Role check
// Usage: authorize('admin') or authorize('admin','loan_officer')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!allowedRoles.includes(req.user.user_role)) {
      return res.status(403).json({ error: `Access denied. Requires: ${allowedRoles.join(" or ")}. You are: ${req.user.user_role}` });
    }
    next();
  };
}

// NEW: Borrower can only see self
function onlyOwnBorrower(req, res, next) {
  if (req.user.user_role === 'borrower') {
    const requestedId = req.params.borrower_id;
    if (String(req.user.borrower_id) !== String(requestedId)) {
      return res.status(403).json({ error: "You can only view your own statement" });
    }
  }
  next();
}

module.exports = { authenticateToken, authorize, onlyOwnBorrower, JWT_SECRET };
