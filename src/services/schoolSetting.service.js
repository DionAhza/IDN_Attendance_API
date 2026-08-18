const db = require('../config/database');
const { AppError } = require('../utils/response');
const schoolConfig = require('../config/school');

// Key yang dipakai langsung oleh sistem (lihat schema.sql seed) — dijaga
// supaya tidak sengaja dihapus dari admin panel dan bikin fitur lain error.
const PROTECTED_KEYS = [
  'school_start_time',
  'gps_validation_enabled',
  'school_latitude',
  'school_longitude',
  'school_radius_meters',
  'notify_parent_on_check_in',
  'notify_parent_on_check_out',
  'notify_parent_on_late',
  'notify_parent_on_absent',
  'teacher_late_tolerance_minutes',
];

async function list() {
  return db.query(
    'SELECT id, setting_key, setting_value, description, updated_at FROM school_settings ORDER BY setting_key ASC'
  );
}

async function getByKey(key) {
  const rows = await db.query(
    'SELECT id, setting_key, setting_value, description, updated_at FROM school_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Setting tidak ditemukan');
  }
  return rows[0];
}

/**
 * Upsert by key: kalau key sudah ada -> update value/description,
 * kalau belum ada -> buat baru. Dipakai untuk PUT /school-settings/:key.
 */
async function upsert(key, data) {
  const existing = await db.query('SELECT id FROM school_settings WHERE setting_key = ? LIMIT 1', [key]);

  if (existing.length > 0) {
    const fields = ['setting_value = ?'];
    const params = [data.setting_value];
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }
    params.push(key);
    await db.query(`UPDATE school_settings SET ${fields.join(', ')} WHERE setting_key = ?`, params);
  } else {
    await db.query(
      'INSERT INTO school_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
      [key, data.setting_value, data.description ?? null]
    );
  }

  schoolConfig.invalidateCache();
  return getByKey(key);
}

async function remove(key) {
  await getByKey(key);

  if (PROTECTED_KEYS.includes(key)) {
    throw new AppError(
      409,
      'Key ini dipakai langsung oleh sistem dan tidak boleh dihapus — ubah nilainya saja lewat PUT'
    );
  }

  await db.query('DELETE FROM school_settings WHERE setting_key = ?', [key]);
  schoolConfig.invalidateCache();
}

module.exports = { list, getByKey, upsert, remove };
