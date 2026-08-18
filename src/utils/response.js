// ==========================================
// Response formatter — supaya semua endpoint konsisten
// sesuai format di dokumen requirement (poin 17).
// ==========================================

/**
 * `meta` opsional dipakai untuk endpoint list yang dipaginasi
 * (lihat utils/pagination.js) — kalau diisi, muncul sebagai
 * response.meta di samping response.data supaya format dasar
 * (success/message/data) tetap konsisten di semua endpoint.
 */
function success(res, statusCode, message, data = null, meta = undefined) {
  const body = { success: true, message, data };
  if (meta !== undefined) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
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
