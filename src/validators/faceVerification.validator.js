const { z } = require('zod');

// Vector encoding wajah — array angka hasil ekstraksi model face
// recognition di sisi klien (mis. face-api.js: 128 dimensi). Rentang
// 10-512 dipilih supaya cukup longgar untuk berbagai model umum
// (face-api.js 128, ArcFace 512, dll) tapi tetap menolak input yang
// jelas bukan encoding (mis. array kosong atau 1 angka saja).
const encodingArraySchema = z
  .array(z.number())
  .min(10, 'Face encoding minimal berisi 10 dimensi')
  .max(512, 'Face encoding maksimal berisi 512 dimensi');

const enrollFaceSchema = z.object({
  // Hanya dipakai/wajib kalau requester adalah admin (enroll atas nama
  // siswa lain). Untuk role student, field ini diabaikan — studentId
  // SELALU diambil dari JWT (lihat catatan keamanan di
  // studentAttendance — siswa tidak boleh enroll atas nama siswa lain).
  studentId: z.number().int().positive().optional(),
  encoding: encodingArraySchema,
  model: z.string().max(50).optional(),
});

const verifyFaceSchema = z.object({
  encoding: encodingArraySchema,
});

const overrideFaceSchema = z.object({
  studentId: z.number().int().positive(),
  attendanceType: z.enum(['check_in', 'check_out']),
  attendanceId: z.number().int().positive().optional(),
  similarityScore: z.number().min(0).max(1).optional(),
  reason: z.string().min(5, 'Alasan override wajib diisi, minimal 5 karakter').max(255),
});

module.exports = { enrollFaceSchema, verifyFaceSchema, overrideFaceSchema };
