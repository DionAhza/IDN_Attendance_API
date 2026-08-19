const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');
const { nowInSchoolTimezone } = require('../utils/time');
const schoolConfig = require('../config/school');
const { notify } = require('./notification.service');
const { calculateDistanceMeters } = require('../utils/geo');

/**
 * Ambil profil student dari user_id token JWT. Dipakai supaya
 * student_id SELALU berasal dari identitas login, tidak pernah dari
 * body request (lihat catatan keamanan Phase 1 poin 9) — siswa A tidak
 * boleh bisa absen atas nama siswa B.
 */
async function getStudentByUserId(userId) {
  const rows = await db.query(
    'SELECT id, class_id, full_name, is_active FROM students WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Profil siswa tidak ditemukan untuk akun ini');
  }
  const student = rows[0];
  if (!student.is_active) {
    throw new AppError(403, 'Akun siswa tidak aktif, hubungi admin');
  }
  return student;
}

function determineStatus(currentTime, startTime) {
  // Perbandingan string 'HH:MM:SS' aman selama formatnya konsisten
  // (zero-padded, panjang sama) — lebih murah daripada parse ke Date.
  return currentTime <= startTime ? 'present' : 'late';
}

/**
 * Validasi geofencing GPS (Phase 14) — dipanggil dari checkIn/checkOut
 * SEBELUM baris attendance ditulis.
 *
 * Kalau `gps_validation_enabled` = false, fungsi ini no-op dan
 * mengembalikan `null` (kolom distance_meters di DB tetap NULL, sama
 * seperti perilaku sebelum Phase 14 — tidak ada perubahan behavior
 * untuk sekolah yang belum mengaktifkan fitur ini).
 *
 * Kalau aktif:
 * - latitude/longitude WAJIB dikirim di payload, else 422.
 * - lokasi sekolah (school_latitude/school_longitude) WAJIB sudah
 *   dikonfigurasi admin di school_settings, else 500 (ini kesalahan
 *   konfigurasi server, bukan kesalahan siswa).
 * - jarak dihitung pakai Haversine; kalau melebihi radius toleransi,
 *   ditolak dengan 403 beserta jarak aktual supaya siswa/parent tahu
 *   seberapa jauh dari sekolah.
 *
 * Return jarak (meter, dibulatkan 2 desimal) untuk disimpan ke kolom
 * check_in_distance_meters / check_out_distance_meters.
 */
async function validateGeofence(payload = {}) {
  const gpsEnabled = await schoolConfig.getBooleanSetting('gps_validation_enabled', false);
  if (!gpsEnabled) {
    return null;
  }

  if (typeof payload.latitude !== 'number' || typeof payload.longitude !== 'number') {
    throw new AppError(422, 'Lokasi (latitude & longitude) wajib diisi karena validasi GPS sedang aktif');
  }

  const schoolLatitude = await schoolConfig.getNumberSetting('school_latitude', NaN);
  const schoolLongitude = await schoolConfig.getNumberSetting('school_longitude', NaN);
  const radiusMeters = await schoolConfig.getNumberSetting('school_radius_meters', 200);

  if (!Number.isFinite(schoolLatitude) || !Number.isFinite(schoolLongitude)) {
    throw new AppError(
      500,
      'Validasi GPS aktif tetapi lokasi sekolah (school_latitude/school_longitude) belum dikonfigurasi admin'
    );
  }

  const distanceMeters = calculateDistanceMeters(
    payload.latitude,
    payload.longitude,
    schoolLatitude,
    schoolLongitude
  );
  const roundedDistance = Math.round(distanceMeters * 100) / 100;

  if (distanceMeters > radiusMeters) {
    throw new AppError(
      403,
      `Lokasi di luar radius sekolah (jarak: ${roundedDistance} m, radius maksimal: ${radiusMeters} m)`
    );
  }

  return roundedDistance;
}

async function checkIn(userId, payload = {}) {
  const student = await getStudentByUserId(userId);
  const { date, time, datetime } = nowInSchoolTimezone();

  const existing = await db.query(
    'SELECT id, check_in FROM student_attendance WHERE student_id = ? AND date = ? LIMIT 1',
    [student.id, date]
  );
  if (existing.length > 0 && existing[0].check_in) {
    throw new AppError(409, 'Sudah absen masuk hari ini');
  }

  const startTime = await schoolConfig.getSetting('school_start_time', '07:00:00');
  const status = determineStatus(time, startTime);

  // Phase 14: validasi geofencing GPS — throw AppError (422/403/500)
  // kalau ditolak, SEBELUM baris attendance ditulis. Kalau GPS
  // validation nonaktif, distanceMeters = null (tidak ada perubahan
  // perilaku dari sebelum Phase 14).
  const distanceMeters = await validateGeofence(payload);

  if (existing.length > 0) {
    // Row sudah ada tapi check_in kosong (kasus jarang — mis. dibuat
    // manual oleh admin sebagai catatan izin/sakit sebelum siswa
    // check-in sendiri). Isi check_in-nya, jangan bikin baris baru.
    await db.query(
      `UPDATE student_attendance
       SET check_in = ?, check_in_status = ?, check_in_latitude = ?, check_in_longitude = ?,
           check_in_accuracy = ?, check_in_distance_meters = ?, check_in_method = 'manual',
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        datetime, status,
        payload.latitude ?? null, payload.longitude ?? null, payload.accuracy ?? null,
        distanceMeters,
        payload.notes ?? null,
        existing[0].id,
      ]
    );
  } else {
    try {
      await db.query(
        `INSERT INTO student_attendance
           (student_id, date, check_in, check_in_status, check_in_latitude, check_in_longitude,
            check_in_accuracy, check_in_distance_meters, check_in_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
        [
          student.id, date, datetime, status,
          payload.latitude ?? null, payload.longitude ?? null, payload.accuracy ?? null,
          distanceMeters,
          payload.notes ?? null,
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        // Race condition: dua request check-in nyaris bersamaan.
        // UNIQUE(student_id, date) di DB yang jadi garda terakhir.
        throw new AppError(409, 'Sudah absen masuk hari ini');
      }
      throw err;
    }
  }

  // Phase 12: Notifikasi ke parent — best-effort, tidak boleh gagalkan response.
  // Ambil data attendance yang baru saja dibuat untuk dapatkan attendanceId.
  const todayData = await getToday(userId);
  const notifPayload = {
    studentId: student.id,
    studentName: student.full_name,
    attendanceId: todayData.id,
    time: datetime,
    status,
  };
  // Kirim notifikasi CHECK_IN ke semua parent — fire-and-forget
  notify('STUDENT_CHECK_IN', notifPayload).catch(() => {});
  // Kalau terlambat, kirim notifikasi tambahan STUDENT_LATE (toggle terpisah)
  if (status === 'late') {
    notify('STUDENT_LATE', notifPayload).catch(() => {});
  }

  return todayData;
}

async function checkOut(userId, payload = {}) {
  const student = await getStudentByUserId(userId);
  const { date, datetime } = nowInSchoolTimezone();

  const rows = await db.query(
    'SELECT id, check_in, check_out FROM student_attendance WHERE student_id = ? AND date = ? LIMIT 1',
    [student.id, date]
  );
  if (rows.length === 0 || !rows[0].check_in) {
    throw new AppError(409, 'Belum absen masuk hari ini — absen masuk dulu sebelum absen pulang');
  }
  if (rows[0].check_out) {
    throw new AppError(409, 'Sudah absen pulang hari ini');
  }

  // Konsep "telat" tidak relevan untuk absen pulang (tidak ada jam
  // pulang wajib di scope MVP) — check_out_status selalu 'present'
  // selama siswa memang check-out. 'late'/'sick'/'permission'/'absent'
  // pada check_out_status disediakan untuk input manual admin, bukan
  // dipakai di alur self-service ini.
  const status = 'present';

  // Phase 14: validasi geofencing GPS, sama seperti checkIn — kalau
  // GPS validation nonaktif, distanceMeters = null.
  const distanceMeters = await validateGeofence(payload);

  const result = await db.query(
    `UPDATE student_attendance
     SET check_out = ?, check_out_status = ?, check_out_latitude = ?, check_out_longitude = ?,
         check_out_accuracy = ?, check_out_distance_meters = ?, check_out_method = 'manual',
         notes = COALESCE(?, notes)
     WHERE id = ? AND check_out IS NULL`,
    [
      datetime, status,
      payload.latitude ?? null, payload.longitude ?? null, payload.accuracy ?? null,
      distanceMeters,
      payload.notes ?? null,
      rows[0].id,
    ]
  );
  if (result.affectedRows === 0) {
    // Race condition: dua request check-out nyaris bersamaan.
    throw new AppError(409, 'Sudah absen pulang hari ini');
  }

  // Phase 12: Notifikasi check-out ke parent — best-effort, fire-and-forget
  const todayData = await getToday(userId);
  notify('STUDENT_CHECK_OUT', {
    studentId: student.id,
    studentName: student.full_name,
    attendanceId: todayData.id,
    time: datetime,
    status: 'present',
  }).catch(() => {});

  return todayData;
}

async function getToday(userId) {
  const student = await getStudentByUserId(userId);
  const { date } = nowInSchoolTimezone();

  const rows = await db.query(
    `SELECT id, student_id, date, check_in, check_out, check_in_status, check_out_status,
            check_in_method, check_out_method, notes
     FROM student_attendance WHERE student_id = ? AND date = ? LIMIT 1`,
    [student.id, date]
  );

  return rows[0] || { student_id: student.id, date, check_in: null, check_out: null };
}

async function getHistory(userId, { page, limit, offset, dateFrom, dateTo }) {
  const student = await getStudentByUserId(userId);

  const conditions = ['student_id = ?'];
  const params = [student.id];

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

  const totalRows = await db.query(
    `SELECT COUNT(*) AS total FROM student_attendance ${where}`,
    params
  );

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

module.exports = { checkIn, checkOut, getToday, getHistory, validateGeofence };
