const express = require('express');
const studentAttendanceController = require('../controllers/studentAttendance.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { checkInOutSchema } = require('../validators/studentAttendance.validator');

const router = express.Router();

// Self-service khusus role student — student_id SELALU dari JWT
// (req.user.id -> lookup students.user_id), tidak pernah dari body,
// supaya siswa tidak bisa absen atas nama siswa lain (lihat Phase 1
// poin 9 - catatan keamanan).
router.use(authenticate, requireRole('student'));

router.post('/check-in', validate(checkInOutSchema), studentAttendanceController.checkIn);
router.post('/check-out', validate(checkInOutSchema), studentAttendanceController.checkOut);
router.get('/today', studentAttendanceController.today);
router.get('/history', studentAttendanceController.history);

module.exports = router;
