const classService = require('../services/class.service');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await classService.list({ page, limit, offset, search: req.query.search });
    return success(res, 200, 'Daftar kelas berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const item = await classService.getById(req.params.id);
    return success(res, 200, 'Detail kelas berhasil diambil', item);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const item = await classService.create(req.body);
    return success(res, 201, 'Kelas berhasil dibuat', item);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await classService.update(req.params.id, req.body);
    return success(res, 200, 'Kelas berhasil diupdate', item);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await classService.remove(req.params.id);
    return success(res, 200, 'Kelas berhasil dihapus', null);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
