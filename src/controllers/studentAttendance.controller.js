const studentAttendanceService = require('../services/studentAttendance.service');
const { success, AppError } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { historyQuerySchema } = require('../validators/studentAttendance.validator');

async function checkIn(req, res, next) {
  try {
    const result = await studentAttendanceService.checkIn(req.user.id, req.body);
    return success(res, 200, 'Absen masuk berhasil dicatat', result);
  } catch (err) {
    next(err);
  }
}

async function checkOut(req, res, next) {
  try {
    const result = await studentAttendanceService.checkOut(req.user.id, req.body);
    return success(res, 200, 'Absen pulang berhasil dicatat', result);
  } catch (err) {
    next(err);
  }
}

async function today(req, res, next) {
  try {
    const result = await studentAttendanceService.getToday(req.user.id);
    return success(res, 200, 'Absensi hari ini berhasil diambil', result);
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const parsedQuery = historyQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new AppError(422, parsedQuery.error.issues[0]?.message || 'Query tidak valid');
    }

    const { page, limit, offset } = parsePagination(req.query);
    const result = await studentAttendanceService.getHistory(req.user.id, {
      page,
      limit,
      offset,
      dateFrom: parsedQuery.data.date_from,
      dateTo: parsedQuery.data.date_to,
    });
    return success(res, 200, 'Riwayat absensi berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

module.exports = { checkIn, checkOut, today, history };
