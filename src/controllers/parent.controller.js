const parentService = require('../services/parent.service');
const { success, AppError } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { historyQuerySchema } = require('../validators/parent.validator');

async function children(req, res, next) {
  try {
    const result = await parentService.getChildren(req.user.id);
    return success(res, 200, 'Daftar anak berhasil diambil', result);
  } catch (err) {
    next(err);
  }
}

async function childToday(req, res, next) {
  try {
    const result = await parentService.getChildToday(req.user.id, req.params.studentId);
    return success(res, 200, 'Absensi hari ini berhasil diambil', result);
  } catch (err) {
    next(err);
  }
}

async function childHistory(req, res, next) {
  try {
    const parsedQuery = historyQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new AppError(422, parsedQuery.error.issues[0]?.message || 'Query tidak valid');
    }

    const { page, limit, offset } = parsePagination(req.query);
    const result = await parentService.getChildHistory(req.user.id, req.params.studentId, {
      page,
      limit,
      offset,
      dateFrom: parsedQuery.data.date_from,
      dateTo: parsedQuery.data.date_to,
    });
    return success(res, 200, 'Riwayat absensi anak berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

module.exports = { children, childToday, childHistory };
