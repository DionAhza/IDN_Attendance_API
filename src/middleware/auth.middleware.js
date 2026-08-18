const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

/**
 * Verifikasi JWT dari header Authorization: Bearer <token>.
 * Jika valid, isi req.user = { id, email, role }.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 401, 'Token tidak ditemukan');
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    return error(res, 401, 'Token tidak valid atau kadaluarsa');
  }
}

module.exports = { authenticate };
