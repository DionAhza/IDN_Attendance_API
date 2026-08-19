const express = require('express');
const parentAdminController = require('../controllers/parentAdmin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  createParentSchema,
  updateParentSchema,
  linkStudentSchema,
} = require('../validators/parentAdmin.validator');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', parentAdminController.list);
router.get('/:id(\\d+)', parentAdminController.getById);
router.post('/', validate(createParentSchema), parentAdminController.create);
router.patch('/:id(\\d+)', validate(updateParentSchema), parentAdminController.update);
router.delete('/:id(\\d+)', parentAdminController.remove);

// Link/unlink parent <-> student (tabel parent_students) — dipakai
// supaya notifikasi check-in/check-out siswa terkirim ke parent ini.
router.get('/:id(\\d+)/students', parentAdminController.listChildren);
router.post('/:id(\\d+)/students', validate(linkStudentSchema), parentAdminController.linkStudent);
router.delete('/:id(\\d+)/students/:studentId(\\d+)', parentAdminController.unlinkStudent);

module.exports = router;