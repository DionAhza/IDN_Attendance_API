const scheduleService = require('../services/schedule.service');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const teacherId = req.query.teacher_id ? Number(req.query.teacher_id) : undefined;
    const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
    const day = req.query.day;
    const result = await scheduleService.list({ page, limit, offset, teacherId, classId, day });
    return success(res, 200, 'Daftar jadwal berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const item = await scheduleService.getById(req.params.id);
    return success(res, 200, 'Detail jadwal berhasil diambil', item);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const item = await scheduleService.create(req.body);
    return success(res, 201, 'Jadwal berhasil dibuat', item);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await scheduleService.update(req.params.id, req.body);
    return success(res, 200, 'Jadwal berhasil diupdate', item);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await scheduleService.remove(req.params.id);
    return success(res, 200, 'Jadwal berhasil dihapus', null);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
