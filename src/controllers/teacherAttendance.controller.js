const teacherAttendanceService = require('../services/teacherAttendance.service');
const { success, AppError } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { historyQuerySchema } = require('../validators/teacherAttendance.validator');

async function todaySchedules(req, res, next) {
  try {
    const result = await teacherAttendanceService.getTodaySchedules(req.user.id);
    return success(res, 200, 'Jadwal hari ini berhasil diambil', result);
  } catch (err) {
    next(err);
  }
}

async function checkIn(req, res, next) {
  try {
    const result = await teacherAttendanceService.checkIn(req.user.id, req.body);
    return success(res, 200, 'Absen mengajar berhasil dicatat', result);
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
    const result = await teacherAttendanceService.getHistory(req.user.id, {
      page,
      limit,
      offset,
      dateFrom: parsedQuery.data.date_from,
      dateTo: parsedQuery.data.date_to,
      scheduleId: parsedQuery.data.schedule_id,
    });
    return success(res, 200, 'Riwayat absensi berhasil diambil', result.items, result.meta);
  } catch (err) {
    next(err);
  }
}

module.exports = { todaySchedules, checkIn, history };
