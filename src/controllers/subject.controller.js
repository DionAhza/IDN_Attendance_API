const subjectService = require('../services/subject.service');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await subjectService.list({ page, limit, offset, search: req.query.search });
    return success(res, 200, 'Daftar mata pelajaran berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const item = await subjectService.getById(req.params.id);
    return success(res, 200, 'Detail mata pelajaran berhasil diambil', item);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const item = await subjectService.create(req.body);
    return success(res, 201, 'Mata pelajaran berhasil dibuat', item);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await subjectService.update(req.params.id, req.body);
    return success(res, 200, 'Mata pelajaran berhasil diupdate', item);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await subjectService.remove(req.params.id);
    return success(res, 200, 'Mata pelajaran berhasil dihapus', null);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
