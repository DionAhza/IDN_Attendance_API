const express = require('express');
const parentController = require('../controllers/parent.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

const router = express.Router();

// Self-service khusus role parent — READ-ONLY (parent tidak absen).
// parent_id SELALU dari JWT; kepemilikan atas studentId dicek eksplisit
// di service (parent.service.js#verifyChildOwnership) supaya parent A
// tidak bisa intip data anak orang lain lewat URL (IDOR).
router.use(authenticate, requireRole('parent'));

router.get('/children', parentController.children);
router.get('/children/:studentId(\\d+)/attendance/today', parentController.childToday);
router.get('/children/:studentId(\\d+)/attendance/history', parentController.childHistory);

module.exports = router;
