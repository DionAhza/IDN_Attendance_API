const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');
const { nowInSchoolTimezone } = require('../utils/time');

/**
 * Ambil profil parent dari user_id token JWT — parent_id SELALU dari
 * identitas login, sama seperti pola student/teacher di Phase 9-10.
 */
async function getParentByUserId(userId) {
  const rows = await db.query('SELECT id, full_name FROM parents WHERE user_id = ? LIMIT 1', [userId]);
  if (rows.length === 0) {
    throw new AppError(404, 'Profil orang tua/wali tidak ditemukan untuk akun ini');
  }
  return rows[0];
}

/**
 * Pastikan studentId benar-benar anak dari parent yang sedang login
 * (lewat tabel relasi many-to-many `parent_students`). Ini garda utama
 * Phase 11 — parent A tidak boleh bisa lihat data absen anak orang
 * lain hanya dengan menebak/ganti studentId di URL (IDOR).
 */
async function verifyChildOwnership(parentId, studentId) {
  const rows = await db.query(
    'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ? LIMIT 1',
    [parentId, studentId]
  );
  if (rows.length === 0) {
    throw new AppError(403, 'Anak ini bukan terdaftar sebagai anak Anda');
  }
}

async function getChildren(userId) {
  const parent = await getParentByUserId(userId);

  return db.query(
    `SELECT s.id AS student_id, s.full_name, s.nis, s.is_active,
            c.name AS class_name, ps.relationship_type
     FROM parent_students ps
     JOIN students s ON s.id = ps.student_id
     LEFT JOIN classes c ON c.id = s.class_id
     WHERE ps.parent_id = ?
     ORDER BY s.full_name ASC`,
    [parent.id]
  );
}

async function getChildToday(userId, studentId) {
  const parent = await getParentByUserId(userId);
  await verifyChildOwnership(parent.id, studentId);
  const { date } = nowInSchoolTimezone();

  const rows = await db.query(
    `SELECT id, student_id, date, check_in, check_out, check_in_status, check_out_status, notes
     FROM student_attendance WHERE student_id = ? AND date = ? LIMIT 1`,
    [studentId, date]
  );

  return rows[0] || { student_id: Number(studentId), date, check_in: null, check_out: null };
}

async function getChildHistory(userId, studentId, { page, limit, offset, dateFrom, dateTo }) {
  const parent = await getParentByUserId(userId);
  await verifyChildOwnership(parent.id, studentId);

  const conditions = ['student_id = ?'];
  const params = [studentId];

  if (dateFrom) {
    conditions.push('date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('date <= ?');
    params.push(dateTo);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await db.query(
    `SELECT id, date, check_in, check_out, check_in_status, check_out_status, notes
     FROM student_attendance ${where}
     ORDER BY date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await db.query(`SELECT COUNT(*) AS total FROM student_attendance ${where}`, params);

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

module.exports = { getChildren, getChildToday, getChildHistory };
