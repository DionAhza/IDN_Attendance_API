// ==========================================
// Face Verification Service — Phase 14
// ==========================================
// Verifikasi identitas siswa saat absen lewat kemiripan wajah, sebagai
// lapisan tambahan di atas GPS geofencing (Phase 14 juga) — supaya
// siswa tidak bisa "titip absen" ke teman walau device & lokasi sama.
//
// PENTING soal privasi/keamanan data biometrik:
// - Server TIDAK PERNAH menerima/menyimpan foto mentah wajah siswa.
//   Yang dikirim & disimpan hanyalah `encoding` — vector angka hasil
//   ekstraksi fitur wajah yang dilakukan di sisi KLIEN (browser/app),
//   memakai model face recognition (mis. face-api.js). Vector ini
//   tidak bisa direkonstruksi balik jadi foto.
// - Satu siswa hanya boleh punya SATU encoding aktif — enroll ulang
//   akan MENIMPA (upsert) encoding lama, bukan menambah baris baru.
//
// Alur:
// 1. enrollFace()  — siswa (atau admin atas nama siswa) mendaftarkan
//    encoding wajah pertama kali / update ulang.
// 2. verifyFace()  — dipanggil saat check-in/out, membandingkan
//    encoding baru dari kamera dengan encoding terdaftar, pakai
//    cosine similarity. Threshold diambil dari
//    school_settings.face_match_threshold (default 0.6).
// 3. overrideFace() — kalau verifyFace() gagal (skor di bawah
//    threshold, atau siswa belum enroll sama sekali) tapi
//    admin/guru tetap mau meloloskan absen (mis. wajah berubah karena
//    luka/masker/pencahayaan buruk), override dicatat ke
//    `face_override_logs` untuk audit trail — TIDAK ada override yang
//    terjadi tanpa jejak.
// ==========================================

const db = require('../config/database');
const { AppError } = require('../utils/response');
const schoolConfig = require('../config/school');

// ==========================================
// Perhitungan kemiripan — cosine similarity
// ==========================================

/**
 * Hitung cosine similarity antara dua vector encoding wajah.
 * Return nilai di rentang [-1, 1] — makin dekat ke 1, makin mirip.
 * (Untuk encoding wajah dari model umum, wajah yang sama biasanya
 * menghasilkan skor > 0.9, wajah berbeda biasanya < 0.5.)
 */
function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new AppError(422, 'Face encoding harus berupa array angka');
  }
  if (vectorA.length !== vectorB.length) {
    throw new AppError(
      422,
      `Dimensi face encoding tidak cocok (terdaftar: ${vectorB.length}, dikirim: ${vectorA.length})`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ==========================================
// Resolve student_id dari user_id JWT — sama seperti pola di
// studentAttendance.service.js, supaya siswa tidak bisa enroll/verify
// atas nama siswa lain lewat body request.
// ==========================================
async function getStudentByUserId(userId) {
  const rows = await db.query(
    'SELECT id, full_name, is_active FROM students WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Profil siswa tidak ditemukan untuk akun ini');
  }
  if (!rows[0].is_active) {
    throw new AppError(403, 'Akun siswa tidak aktif, hubungi admin');
  }
  return rows[0];
}

async function ensureStudentExists(studentId) {
  const rows = await db.query('SELECT id, full_name FROM students WHERE id = ? LIMIT 1', [studentId]);
  if (rows.length === 0) {
    throw new AppError(404, 'Siswa tidak ditemukan');
  }
  return rows[0];
}

// ==========================================
// Enroll — daftarkan / update encoding wajah siswa
// ==========================================

/**
 * Upsert encoding wajah untuk satu siswa. `actingAs` menentukan
 * siapa yang boleh enroll untuk siapa:
 * - role 'student': selalu enroll untuk DIRI SENDIRI (studentId dari JWT,
 *   parameter targetStudentId di body diabaikan).
 * - role 'admin': boleh enroll untuk siswa lain, WAJIB kirim targetStudentId.
 */
async function enrollFace({ userId, role, targetStudentId, encoding, model }) {
  let student;
  if (role === 'admin') {
    if (!targetStudentId) {
      throw new AppError(422, 'studentId wajib diisi saat admin melakukan enroll wajah untuk siswa');
    }
    student = await ensureStudentExists(targetStudentId);
  } else {
    student = await getStudentByUserId(userId);
  }

  const encodingJson = JSON.stringify(encoding);

  const existing = await db.query(
    'SELECT id FROM student_face_encodings WHERE student_id = ? LIMIT 1',
    [student.id]
  );

  if (existing.length > 0) {
    await db.query(
      `UPDATE student_face_encodings
       SET encoding = ?, encoding_model = ?, is_active = 1
       WHERE student_id = ?`,
      [encodingJson, model || null, student.id]
    );
  } else {
    await db.query(
      `INSERT INTO student_face_encodings (student_id, encoding, encoding_model, is_active)
       VALUES (?, ?, ?, 1)`,
      [student.id, encodingJson, model || null]
    );
  }

  return getEnrollmentStatus(student.id);
}

/**
 * Ambil status enrollment wajah siswa (tanpa mengembalikan vector
 * mentah ke response — vector encoding tidak perlu dan tidak boleh
 * diekspos balik ke klien selain untuk keperluan verifikasi internal).
 */
async function getEnrollmentStatus(studentId) {
  const rows = await db.query(
    `SELECT student_id, encoding_model, is_active, created_at, updated_at
     FROM student_face_encodings WHERE student_id = ? LIMIT 1`,
    [studentId]
  );

  if (rows.length === 0) {
    return { studentId, enrolled: false };
  }

  const row = rows[0];
  return {
    studentId,
    enrolled: !!row.is_active,
    model: row.encoding_model,
    enrolledAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMyEnrollmentStatus(userId) {
  const student = await getStudentByUserId(userId);
  return getEnrollmentStatus(student.id);
}

// ==========================================
// Verify — bandingkan encoding baru dengan yang terdaftar
// ==========================================

/**
 * Ambil raw encoding (parsed JSON array) milik satu siswa. Internal
 * only — dipakai oleh verifyFace(), TIDAK diekspos lewat controller.
 */
async function getRawEncoding(studentId) {
  const rows = await db.query(
    'SELECT encoding FROM student_face_encodings WHERE student_id = ? AND is_active = 1 LIMIT 1',
    [studentId]
  );
  if (rows.length === 0) return null;

  const raw = rows[0].encoding;
  // mysql2 biasanya sudah auto-parse kolom JSON jadi object/array,
  // tapi jaga-jaga kalau driver mengembalikan string mentah.
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/**
 * Verifikasi wajah siswa (dari JWT — self-service). Bandingkan
 * `encoding` yang dikirim dengan encoding terdaftar, pakai cosine
 * similarity, dan bandingkan ke threshold dari school_settings.
 *
 * Return:
 *   { matched: boolean, score: number|null, threshold: number, enrolled: boolean }
 *
 * `matched` selalu false kalau siswa belum enroll (enrolled: false) —
 * caller (controller/route absensi) yang memutuskan apakah tetap
 * menolak absen atau meminta admin melakukan override.
 */
async function verifyFace(userId, encoding) {
  const student = await getStudentByUserId(userId);
  const threshold = await schoolConfig.getNumberSetting('face_match_threshold', 0.6);

  const storedEncoding = await getRawEncoding(student.id);
  if (!storedEncoding) {
    return { matched: false, score: null, threshold, enrolled: false };
  }

  const score = cosineSimilarity(encoding, storedEncoding);
  const roundedScore = Math.round(score * 10000) / 10000;

  return {
    matched: roundedScore >= threshold,
    score: roundedScore,
    threshold,
    enrolled: true,
  };
}

// ==========================================
// Override — admin/guru meloloskan absen walau verifikasi gagal
// ==========================================

async function overrideFace({ overriddenByUserId, studentId, attendanceId, attendanceType, similarityScore, reason }) {
  await ensureStudentExists(studentId);

  await db.query(
    `INSERT INTO face_override_logs
       (student_id, attendance_id, attendance_type, overridden_by, similarity_score, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [studentId, attendanceId ?? null, attendanceType, overriddenByUserId, similarityScore ?? null, reason]
  );

  const rows = await db.query(
    `SELECT id, student_id, attendance_id, attendance_type, overridden_by, similarity_score, reason, created_at
     FROM face_override_logs WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
    [studentId]
  );
  return rows[0];
}

/**
 * Daftar log override untuk satu siswa — dipakai admin untuk audit
 * (mis. cek apakah ada siswa yang terus-menerus butuh override, tanda
 * kemungkinan penyalahgunaan).
 */
async function listOverrideLogs(studentId) {
  await ensureStudentExists(studentId);
  return db.query(
    `SELECT fol.id, fol.attendance_id, fol.attendance_type, fol.similarity_score, fol.reason, fol.created_at,
            u.email AS overridden_by_email
     FROM face_override_logs fol
     JOIN users u ON u.id = fol.overridden_by
     WHERE fol.student_id = ?
     ORDER BY fol.created_at DESC`,
    [studentId]
  );
}

module.exports = {
  enrollFace,
  getMyEnrollmentStatus,
  getEnrollmentStatus,
  verifyFace,
  overrideFace,
  listOverrideLogs,
  // Diekspor untuk unit test.
  cosineSimilarity,
};
