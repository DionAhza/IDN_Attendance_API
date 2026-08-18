const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');

const BASE_SELECT = `
  SELECT sc.id, sc.teacher_id, sc.class_id, sc.subject_id, sc.day,
         sc.start_time, sc.end_time, sc.is_active, sc.created_at, sc.updated_at,
         t.full_name AS teacher_name, cl.name AS class_name, sub.name AS subject_name
  FROM schedules sc
  JOIN teachers t ON t.id = sc.teacher_id
  JOIN classes cl ON cl.id = sc.class_id
  JOIN subjects sub ON sub.id = sc.subject_id
`;

async function assertRefsExist({ teacher_id, class_id, subject_id }) {
  if (teacher_id !== undefined) {
    const rows = await db.query('SELECT id FROM teachers WHERE id = ? LIMIT 1', [teacher_id]);
    if (rows.length === 0) throw new AppError(422, 'teacher_id tidak valid — guru tidak ditemukan');
  }
  if (class_id !== undefined) {
    const rows = await db.query('SELECT id FROM classes WHERE id = ? LIMIT 1', [class_id]);
    if (rows.length === 0) throw new AppError(422, 'class_id tidak valid — kelas tidak ditemukan');
  }
  if (subject_id !== undefined) {
    const rows = await db.query('SELECT id FROM subjects WHERE id = ? LIMIT 1', [subject_id]);
    if (rows.length === 0) throw new AppError(422, 'subject_id tidak valid — mata pelajaran tidak ditemukan');
  }
}

/**
 * Cek bentrok jadwal: guru yang sama ATAU kelas yang sama tidak boleh
 * punya jadwal lain yang overlap waktu di hari yang sama.
 * Dua rentang waktu overlap jika: start_a < end_b AND start_b < end_a.
 */
async function assertNoConflict({ teacher_id, class_id, day, start_time, end_time }, excludeId = null) {
  const excludeClause = excludeId ? 'AND id != ?' : '';
  const excludeParam = excludeId ? [excludeId] : [];

  const teacherConflict = await db.query(
    `SELECT id FROM schedules
     WHERE teacher_id = ? AND day = ? AND is_active = 1
       AND start_time < ? AND end_time > ?
       ${excludeClause}
     LIMIT 1`,
    [teacher_id, day, end_time, start_time, ...excludeParam]
  );
  if (teacherConflict.length > 0) {
    throw new AppError(409, 'Guru sudah punya jadwal lain yang bentrok di hari & jam tersebut');
  }

  const classConflict = await db.query(
    `SELECT id FROM schedules
     WHERE class_id = ? AND day = ? AND is_active = 1
       AND start_time < ? AND end_time > ?
       ${excludeClause}
     LIMIT 1`,
    [class_id, day, end_time, start_time, ...excludeParam]
  );
  if (classConflict.length > 0) {
    throw new AppError(409, 'Kelas sudah punya jadwal lain yang bentrok di hari & jam tersebut');
  }
}

async function list({ page, limit, offset, teacherId, classId, day }) {
  const conditions = [];
  const params = [];

  if (teacherId) {
    conditions.push('sc.teacher_id = ?');
    params.push(teacherId);
  }
  if (classId) {
    conditions.push('sc.class_id = ?');
    params.push(classId);
  }
  if (day) {
    conditions.push('sc.day = ?');
    params.push(day);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.query(
    `${BASE_SELECT} ${where} ORDER BY FIELD(sc.day,'monday','tuesday','wednesday','thursday','friday','saturday','sunday'), sc.start_time ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await db.query(`SELECT COUNT(*) AS total FROM schedules sc ${where}`, params);

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

async function getById(id) {
  const rows = await db.query(`${BASE_SELECT} WHERE sc.id = ? LIMIT 1`, [id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Jadwal tidak ditemukan');
  }
  return rows[0];
}

async function create(data) {
  await assertRefsExist(data);
  await assertNoConflict(data);

  const result = await db.query(
    `INSERT INTO schedules (teacher_id, class_id, subject_id, day, start_time, end_time, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.teacher_id, data.class_id, data.subject_id, data.day, data.start_time, data.end_time, data.is_active ?? true]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  const current = await getById(id);
  await assertRefsExist(data);

  const merged = {
    teacher_id: data.teacher_id ?? current.teacher_id,
    class_id: data.class_id ?? current.class_id,
    day: data.day ?? current.day,
    start_time: data.start_time ?? current.start_time,
    end_time: data.end_time ?? current.end_time,
  };

  if (data.is_active !== false) {
    // Cuma perlu dicek bentrok kalau jadwal ini aktif (aktif vs aktif).
    await assertNoConflict(merged, id);
  }

  const fields = [];
  const params = [];
  for (const key of ['teacher_id', 'class_id', 'subject_id', 'day', 'start_time', 'end_time', 'is_active']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }

  if (fields.length > 0) {
    params.push(id);
    await db.query(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return getById(id);
}

async function remove(id) {
  await getById(id);

  const hasAttendance = await db.query(
    'SELECT id FROM teacher_attendance WHERE schedule_id = ? LIMIT 1',
    [id]
  );
  if (hasAttendance.length > 0) {
    throw new AppError(
      409,
      'Jadwal sudah punya riwayat absensi guru — nonaktifkan (is_active=false) saja, jangan dihapus'
    );
  }

  await db.query('DELETE FROM schedules WHERE id = ?', [id]);
}

module.exports = { list, getById, create, update, remove };
