const express = require('express');
const schoolSettingController = require('../controllers/schoolSetting.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { upsertSchoolSettingSchema } = require('../validators/schoolSetting.validator');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', schoolSettingController.list);
router.get('/:key', schoolSettingController.getByKey);
// PUT (bukan POST) karena semantiknya upsert-by-key, bukan create-with-generated-id.
router.put('/:key', validate(upsertSchoolSettingSchema), schoolSettingController.upsert);
router.delete('/:key', schoolSettingController.remove);

module.exports = router;
