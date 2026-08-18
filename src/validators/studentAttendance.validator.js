const { z } = require('zod');

// GPS opsional untuk Phase 9 — kolom lat/long/accuracy di schema sudah
// disiapkan, tapi VALIDASI radius (tolak kalau di luar radius sekolah)
// baru aktif di Phase 14. Untuk sekarang: kalau dikirim, disimpan apa
// adanya (informational), tidak dipakai untuk menolak request.
const checkInOutSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

const historyQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_from harus YYYY-MM-DD').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_to harus YYYY-MM-DD').optional(),
});

module.exports = { checkInOutSchema, historyQuerySchema };
