const express = require('express');
const studentController = require('../controllers/student.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createStudentSchema, updateStudentSchema } = require('../validators/student.validator');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', studentController.list);
router.get('/:id(\\d+)', studentController.getById);
router.post('/', validate(createStudentSchema), studentController.create);
router.patch('/:id(\\d+)', validate(updateStudentSchema), studentController.update);
router.delete('/:id(\\d+)', studentController.remove);

module.exports = router;
