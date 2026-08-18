const express = require('express');
const scheduleController = require('../controllers/schedule.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createScheduleSchema, updateScheduleSchema } = require('../validators/schedule.validator');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', scheduleController.list);
router.get('/:id(\\d+)', scheduleController.getById);
router.post('/', validate(createScheduleSchema), scheduleController.create);
router.patch('/:id(\\d+)', validate(updateScheduleSchema), scheduleController.update);
router.delete('/:id(\\d+)', scheduleController.remove);

module.exports = router;
