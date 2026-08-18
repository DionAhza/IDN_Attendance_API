const { z } = require('zod');

const createClassSchema = z.object({
  name: z.string().min(1, 'Nama kelas wajib diisi').max(50),
  level: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
});

// Semua field opsional saat update, tapi minimal 1 field harus dikirim.
const updateClassSchema = createClassSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal 1 field harus diisi untuk update' }
);

module.exports = { createClassSchema, updateClassSchema };
