const express = require('express');
const faceVerificationController = require('../controllers/faceVerification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  enrollFaceSchema,
  verifyFaceSchema,
  overrideFaceSchema,
} = require('../validators/faceVerification.validator');

const router = express.Router();

router.use(authenticate);

// Enroll — student mendaftarkan wajah sendiri, admin bisa enroll atas
// nama siswa lain (studentId wajib di body kalau role admin).
router.post(
  '/enroll',
  requireRole('student', 'admin'),
  validate(enrollFaceSchema),
  faceVerificationController.enroll
);

// Status enrollment — student cek milik sendiri, admin/teacher cek
// milik siswa tertentu lewat :studentId.
router.get('/status', requireRole('student'), faceVerificationController.myStatus);
router.get(
  '/status/:studentId',
  requireRole('admin', 'teacher'),
  faceVerificationController.statusByStudentId
);

// Verify — self-service student, dipanggil sebelum/bersamaan dengan
// check-in/check-out di sisi klien.
router.post(
  '/verify',
  requireRole('student'),
  validate(verifyFaceSchema),
  faceVerificationController.verify
);

// Override — hanya admin/guru yang boleh meloloskan absen walau
// verifikasi wajah gagal, WAJIB menyertakan alasan (lihat validator).
router.post(
  '/override',
  requireRole('admin', 'teacher'),
  validate(overrideFaceSchema),
  faceVerificationController.override
);
router.get(
  '/override/:studentId',
  requireRole('admin', 'teacher'),
  faceVerificationController.overrideHistory
);

module.exports = router;
