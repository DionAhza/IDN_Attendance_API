const parentAdminService = require('../services/parentAdmin.service');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await parentAdminService.list({ page, limit, offset, search: req.query.search });
    return success(res, 200, 'Daftar parent berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    return success(res, 200, 'Detail parent berhasil diambil', await parentAdminService.getById(req.params.id));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    return success(res, 201, 'Parent berhasil dibuat', await parentAdminService.create(req.body));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    return success(res, 200, 'Parent berhasil diupdate', await parentAdminService.update(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await parentAdminService.remove(req.params.id);
    return success(res, 200, 'Parent berhasil dihapus', null);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };