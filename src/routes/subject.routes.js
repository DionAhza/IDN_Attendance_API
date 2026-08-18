const express = require('express');
const subjectController = require('../controllers/subject.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createSubjectSchema, updateSubjectSchema } = require('../validators/subject.validator');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', subjectController.list);
router.get('/:id(\\d+)', subjectController.getById);
router.post('/', validate(createSubjectSchema), subjectController.create);
router.patch('/:id(\\d+)', validate(updateSubjectSchema), subjectController.update);
router.delete('/:id(\\d+)', subjectController.remove);

module.exports = router;
