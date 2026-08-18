const studentService = require('../services/student.service');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const classId = req.query.class_id ? Number(req.query.class_id) : undefined;
    const result = await studentService.list({ page, limit, offset, search: req.query.search, classId });
    return success(res, 200, 'Daftar siswa berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const item = await studentService.getById(req.params.id);
    return success(res, 200, 'Detail siswa berhasil diambil', item);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const item = await studentService.create(req.body);
    return success(res, 201, 'Siswa berhasil dibuat', item);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await studentService.update(req.params.id, req.body);
    return success(res, 200, 'Siswa berhasil diupdate', item);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await studentService.remove(req.params.id);
    return success(res, 200, 'Siswa berhasil dihapus', null);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
