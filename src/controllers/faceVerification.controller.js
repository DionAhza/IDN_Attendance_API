const faceVerificationService = require('../services/faceVerification.service');
const { success } = require('../utils/response');

/**
 * POST /api/face-verification/enroll
 * Role: student (enroll wajah sendiri) atau admin (enroll atas nama
 * siswa lain, wajib kirim studentId di body).
 */
async function enroll(req, res, next) {
  try {
    const result = await faceVerificationService.enrollFace({
      userId: req.user.id,
      role: req.user.role,
      targetStudentId: req.body.studentId,
      encoding: req.body.encoding,
      model: req.body.model,
    });
    return success(res, 200, 'Wajah berhasil didaftarkan', result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/face-verification/status
 * Role: student — cek status enrollment wajah sendiri.
 */
async function myStatus(req, res, next) {
  try {
    const result = await faceVerificationService.getMyEnrollmentStatus(req.user.id);
    return success(res, 200, 'Status enrollment wajah berhasil diambil', result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/face-verification/status/:studentId
 * Role: admin/teacher — cek status enrollment wajah siswa tertentu.
 */
async function statusByStudentId(req, res, next) {
  try {
    const studentId = Number(req.params.studentId);
    const result = await faceVerificationService.getEnrollmentStatus(studentId);
    return success(res, 200, 'Status enrollment wajah berhasil diambil', result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/face-verification/verify
 * Role: student — verifikasi wajah sendiri (dipanggil dari alur
 * check-in/check-out di sisi klien SEBELUM memanggil endpoint absensi,
 * atau sebagai pengecekan mandiri).
 */
async function verify(req, res, next) {
  try {
    const result = await faceVerificationService.verifyFace(req.user.id, req.body.encoding);
    return success(res, 200, 'Verifikasi wajah selesai diproses', result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/face-verification/override
 * Role: admin/teacher — loloskan absen siswa walau verifikasi wajah
 * gagal, WAJIB menyertakan alasan. Tercatat ke face_override_logs.
 */
async function override(req, res, next) {
  try {
    const result = await faceVerificationService.overrideFace({
      overriddenByUserId: req.user.id,
      studentId: req.body.studentId,
      attendanceId: req.body.attendanceId,
      attendanceType: req.body.attendanceType,
      similarityScore: req.body.similarityScore,
      reason: req.body.reason,
    });
    return success(res, 201, 'Override verifikasi wajah berhasil dicatat', result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/face-verification/override/:studentId
 * Role: admin/teacher — riwayat override untuk satu siswa (audit trail).
 */
async function overrideHistory(req, res, next) {
  try {
    const studentId = Number(req.params.studentId);
    const result = await faceVerificationService.listOverrideLogs(studentId);
    return success(res, 200, 'Riwayat override verifikasi wajah berhasil diambil', result);
  } catch (err) {
    next(err);
  }
}

module.exports = { enroll, myStatus, statusByStudentId, verify, override, overrideHistory };
