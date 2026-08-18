const { z } = require('zod');

const createSubjectSchema = z.object({
  name: z.string().min(1, 'Nama mata pelajaran wajib diisi').max(100),
  code: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
});

const updateSubjectSchema = createSubjectSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal 1 field harus diisi untuk update' }
);

module.exports = { createSubjectSchema, updateSubjectSchema };
