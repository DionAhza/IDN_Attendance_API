const { z } = require('zod');

// Sama seperti Phase 9 (student): GPS opsional, disimpan apa adanya untuk
// sekarang (informational) — validasi radius baru aktif di Phase 14.
// Beda dengan student: schedule_id WAJIB, karena teacher_attendance
// per-jadwal (satu guru bisa check-in beberapa kali sehari, satu per
// sesi mengajar), bukan sekali per hari.
const checkInSchema = z.object({
  schedule_id: z.number().int().positive({ message: 'schedule_id wajib diisi' }),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(1000).optional(),
});

const historyQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_from harus YYYY-MM-DD').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_to harus YYYY-MM-DD').optional(),
  schedule_id: z.string().regex(/^\d+$/, 'schedule_id harus angka').optional(),
});

module.exports = { checkInSchema, historyQuerySchema };
