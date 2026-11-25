function isValidName(name) {
    if (typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    return /^[A-Za-z]+$/.test(trimmed);
  }
  module.exports = { isValidName };