// ==========================================
// School runtime config
// ==========================================
// Sumber kebenaran (source of truth) adalah tabel `school_settings` di
// database (lihat Phase 4 & Phase 33 di dokumen requirement). File ini
// cuma cache tipis di atasnya supaya endpoint absensi (Phase 9+) tidak
// query `school_settings` berulang-ulang di setiap request.
// ==========================================

const db = require('./database');

const CACHE_TTL_MS = 60 * 1000; // 1 menit — cukup responsif kalau admin ubah setting, tapi tidak membebani DB

let cache = null;
let cachedAt = 0;

async function getAllSettings() {
  const isFresh = cache !== null && Date.now() - cachedAt < CACHE_TTL_MS;
  if (isFresh) return cache;

  const rows = await db.query('SELECT setting_key, setting_value FROM school_settings');
  cache = {};
  for (const row of rows) {
    cache[row.setting_key] = row.setting_value;
  }
  cachedAt = Date.now();
  return cache;
}

/**
 * Ambil satu nilai setting by key. Semua nilai disimpan sebagai VARCHAR
 * di DB (lihat schema), jadi caller yang butuh boolean/number harus
 * konversi sendiri (lihat getBooleanSetting).
 */
async function getSetting(key, fallback = null) {
  const settings = await getAllSettings();
  return settings[key] !== undefined ? settings[key] : fallback;
}

async function getBooleanSetting(key, fallback = false) {
  const value = await getSetting(key, null);
  if (value === null) return fallback;
  return value === 'true' || value === '1';
}

/**
 * Dipanggil setelah admin create/update/delete school_settings (lihat
 * services/schoolSetting.service.js) supaya perubahan langsung kepakai,
 * tidak nunggu TTL habis.
 */
function invalidateCache() {
  cache = null;
}

module.exports = { getSetting, getBooleanSetting, getAllSettings, invalidateCache };
