// ==========================================
// Response formatter — supaya semua endpoint konsisten
// sesuai format di dokumen requirement (poin 17).
// ==========================================

function success(res, statusCode, message, data = null) {
  return res.status(statusCode).json({ success: true, message, data });
}

function error(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, message, data: null });
}

/**
 * Custom error class supaya controller cukup `throw new AppError(...)`
 * dan ditangkap otomatis oleh centralized error handler di app.js.
 */
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { success, error, AppError };
