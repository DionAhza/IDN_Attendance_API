const express = require('express');
const teacherAttendanceController = require('../controllers/teacherAttendance.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { checkInSchema } = require('../validators/teacherAttendance.validator');

const router = express.Router();

// Self-service khusus role teacher — teacher_id SELALU dari JWT
// (req.user.id -> lookup teachers.user_id), sama seperti pola student
// di Phase 9. Kepemilikan schedule_id juga dicek eksplisit di service
// (guru A tidak bisa check-in untuk jadwal guru B).
router.use(authenticate, requireRole('teacher'));

router.get('/today-schedules', teacherAttendanceController.todaySchedules);
router.post('/check-in', validate(checkInSchema), teacherAttendanceController.checkIn);
router.get('/history', teacherAttendanceController.history);

module.exports = router;
