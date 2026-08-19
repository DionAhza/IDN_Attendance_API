const { z } = require('zod');

// GPS opsional secara default — kolom lat/long/accuracy di schema sudah
// disiapkan sejak Phase 9. VALIDASI radius (tolak kalau di luar radius
// sekolah) aktif di service layer (studentAttendance.service.js) HANYA
// kalau school_settings.gps_validation_enabled = true — di situ
// latitude/longitude jadi wajib. Di level validator ini keduanya tetap
// dibiarkan optional supaya sekolah yang belum mengaktifkan GPS tidak
// perlu ubah apa pun di sisi klien.
//
// faceEncoding (Phase 14) — opsional, dikirim client saat check-in/out
// kalau mau langsung menyertakan hasil ekstraksi wajah dari kamera
// (dipakai bersamaan dengan endpoint /api/face-verification/verify
// untuk verifikasi terpisah). Disimpan/divalidasi sebagai array angka
// (vector encoding wajah), BUKAN foto mentah.
const checkInOutSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  faceEncoding: z
    .array(z.number())
    .min(10, 'Face encoding minimal berisi 10 dimensi')
    .max(512, 'Face encoding maksimal berisi 512 dimensi')
    .optional(),
});

const historyQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_from harus YYYY-MM-DD').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_to harus YYYY-MM-DD').optional(),
});

module.exports = { checkInOutSchema, historyQuerySchema };
