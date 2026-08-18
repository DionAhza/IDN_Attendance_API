const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');
const { nowInSchoolTimezone, todayDayName, addMinutesToTimeString } = require('../utils/time');
const schoolConfig = require('../config/school');

/**
 * Ambil profil teacher dari user_id token JWT — sama seperti pola
 * getStudentByUserId di Phase 9, supaya teacher_id SELALU berasal dari
 * identitas login, tidak pernah dari body. Guru A tidak boleh bisa
 * check-in atas nama guru B, dan tidak boleh check-in untuk jadwal
 * guru lain (dicek terpisah di checkIn()).
 */
async function getTeacherByUserId(userId) {
  const rows = await db.query(
    'SELECT id, full_name, is_active FROM teachers WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Profil guru tidak ditemukan untuk akun ini');
  }
  const teacher = rows[0];
  if (!teacher.is_active) {
    throw new AppError(403, 'Akun guru tidak aktif, hubungi admin');
  }
  return teacher;
}

const ATTENDANCE_SELECT = `
  SELECT ta.id, ta.schedule_id, ta.teacher_id, ta.date, ta.check_in, ta.status,
         ta.latitude, ta.longitude, ta.note, ta.created_at,
         sc.day, sc.start_time, sc.end_time,
         cl.name AS class_name, sub.name AS subject_name
  FROM teacher_attendance ta
  JOIN schedules sc ON sc.id = ta.schedule_id
  JOIN classes cl ON cl.id = sc.class_id
  JOIN subjects sub ON sub.id = sc.subject_id
`;

/**
 * Jadwal guru HARI INI (berdasarkan hari WIB sekarang), masing-masing
 * digabung dengan status absennya kalau sudah check-in — supaya app
 * client tinggal render "sudah/belum absen" per sesi tanpa query
 * terpisah.
 */
async function getTodaySchedules(userId) {
  const teacher = await getTeacherByUserId(userId);
  const { date } = nowInSchoolTimezone();
  const day = todayDayName();

  const schedules = await db.query(
    `SELECT sc.id AS schedule_id, sc.day, sc.start_time, sc.end_time,
            cl.name AS class_name, sub.name AS subject_name
     FROM schedules sc
     JOIN classes cl ON cl.id = sc.class_id
     JOIN subjects sub ON sub.id = sc.subject_id
     WHERE sc.teacher_id = ? AND sc.day = ? AND sc.is_active = 1
     ORDER BY sc.start_time ASC`,
    [teacher.id, day]
  );

  if (schedules.length === 0) {
    return [];
  }

  const attendanceRows = await db.query(
    `SELECT schedule_id, check_in, status FROM teacher_attendance
     WHERE teacher_id = ? AND date = ? AND schedule_id IN (?)`,
    [teacher.id, date, schedules.map((s) => s.schedule_id)]
  );
  const attendanceBySchedule = new Map(attendanceRows.map((a) => [a.schedule_id, a]));

  return schedules.map((s) => ({
    ...s,
    attendance: attendanceBySchedule.get(s.schedule_id) || null,
  }));
}

async function checkIn(userId, payload) {
  const teacher = await getTeacherByUserId(userId);
  const { date, time, datetime } = nowInSchoolTimezone();
  const day = todayDayName();

  const scheduleRows = await db.query(
    'SELECT id, teacher_id, day, start_time, is_active FROM schedules WHERE id = ? LIMIT 1',
    [payload.schedule_id]
  );
  if (scheduleRows.length === 0) {
    throw new AppError(404, 'Jadwal tidak ditemukan');
  }
  const schedule = scheduleRows[0];

  if (schedule.teacher_id !== teacher.id) {
    throw new AppError(403, 'Jadwal ini bukan milik Anda');
  }
  if (!schedule.is_active) {
    throw new AppError(409, 'Jadwal ini sudah nonaktif');
  }
  if (schedule.day !== day) {
    throw new AppError(409, `Jadwal ini untuk hari ${schedule.day}, tidak bisa diabsen hari ini`);
  }

  const existing = await db.query(
    'SELECT id FROM teacher_attendance WHERE schedule_id = ? AND date = ? LIMIT 1',
    [schedule.id, date]
  );
  if (existing.length > 0) {
    throw new AppError(409, 'Sudah absen untuk jadwal ini hari ini');
  }

  // Toleransi telat guru terpisah dari school_start_time siswa — jadwal
  // guru per-sesi, jadi ambang batasnya start_time jadwal + toleransi
  // (menit), bukan jam masuk sekolah global. Fallback 10 menit kalau
  // key belum diisi admin (lihat schoolSetting Phase 8).
  const toleranceMinutes = parseInt(
    await schoolConfig.getSetting('teacher_late_tolerance_minutes', '10'),
    10
  );
  const threshold = addMinutesToTimeString(schedule.start_time, toleranceMinutes);
  const status = time <= threshold ? 'present' : 'late';

  try {
    await db.query(
      `INSERT INTO teacher_attendance (schedule_id, teacher_id, date, check_in, status, latitude, longitude, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id, teacher.id, date, datetime, status,
        payload.latitude ?? null, payload.longitude ?? null, payload.notes ?? null,
      ]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Race condition: dua request check-in nyaris bersamaan.
      // UNIQUE(schedule_id, date) di DB yang jadi garda terakhir.
      throw new AppError(409, 'Sudah absen untuk jadwal ini hari ini');
    }
    throw err;
  }

  // TODO(Phase 12): notifikasi terkait guru (kalau ada kebutuhannya)
  // menyusul setelah provider email diputuskan, sama seperti Phase 9.

  const rows = await db.query(`${ATTENDANCE_SELECT} WHERE ta.schedule_id = ? AND ta.date = ? LIMIT 1`, [
    schedule.id,
    date,
  ]);
  return rows[0];
}

async function getHistory(userId, { page, limit, offset, dateFrom, dateTo, scheduleId }) {
  const teacher = await getTeacherByUserId(userId);

  const conditions = ['ta.teacher_id = ?'];
  const params = [teacher.id];

  if (dateFrom) {
    conditions.push('ta.date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('ta.date <= ?');
    params.push(dateTo);
  }
  if (scheduleId) {
    conditions.push('ta.schedule_id = ?');
    params.push(scheduleId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const rows = await db.query(
    `${ATTENDANCE_SELECT} ${where} ORDER BY ta.date DESC, ta.check_in DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await db.query(
    `SELECT COUNT(*) AS total FROM teacher_attendance ta ${where}`,
    params
  );

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

module.exports = { getTodaySchedules, checkIn, getHistory };
