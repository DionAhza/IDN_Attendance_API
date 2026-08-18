const { error } = require('../utils/response');

/**
 * Middleware factory: batasi akses hanya untuk role tertentu.
 * Harus dipasang SETELAH authenticate (butuh req.user).
 * Pakai: router.get('/admin-only', authenticate, requireRole('admin'), ...)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 401, 'Belum login');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return error(res, 403, 'Anda tidak memiliki akses untuk aksi ini');
    }
    next();
  };
}

module.exports = { requireRole };
