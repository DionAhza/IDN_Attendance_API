const express = require('express');
const teacherController = require('../controllers/teacher.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createTeacherSchema, updateTeacherSchema } = require('../validators/teacher.validator');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', teacherController.list);
router.get('/:id(\\d+)', teacherController.getById);
router.post('/', validate(createTeacherSchema), teacherController.create);
router.patch('/:id(\\d+)', validate(updateTeacherSchema), teacherController.update);
router.delete('/:id(\\d+)', teacherController.remove);

module.exports = router;
