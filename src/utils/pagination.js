// ==========================================
// Pagination helper — dipakai semua endpoint list (Phase 8+)
// Konsisten: ?page=1&limit=20&search=...
// ==========================================

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse query params `page`/`limit` dari request jadi angka yang aman
 * (selalu >= 1, limit dibatasi MAX_LIMIT supaya tidak disalahgunakan
 * untuk narik seluruh tabel sekaligus).
 */
function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Bentuk object `meta` yang konsisten untuk disisipkan ke response.data.
 */
function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    total_pages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

module.exports = { parsePagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
