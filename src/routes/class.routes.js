const express = require('express');
const classController = require('../controllers/class.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createClassSchema, updateClassSchema } = require('../validators/class.validator');

const router = express.Router();

// Semua endpoint master data classes khusus admin (Phase 8).
router.use(authenticate, requireRole('admin'));

router.get('/', classController.list);
router.get('/:id(\\d+)', classController.getById);
router.post('/', validate(createClassSchema), classController.create);
router.patch('/:id(\\d+)', validate(updateClassSchema), classController.update);
router.delete('/:id(\\d+)', classController.remove);

module.exports = router;
