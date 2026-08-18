const { z } = require('zod');

// Create student = create user (role student) + profil student sekaligus.
const createStudentSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  nis: z.string().min(1, 'NIS wajib diisi').max(30),
  full_name: z.string().min(1, 'Nama lengkap wajib diisi').max(150),
  class_id: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});

const updateStudentSchema = z
  .object({
    email: z.string().email('Format email tidak valid').optional(),
    password: z.string().min(8, 'Password minimal 8 karakter').optional(),
    nis: z.string().min(1).max(30).optional(),
    full_name: z.string().min(1).max(150).optional(),
    class_id: z.number().int().positive().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal 1 field harus diisi untuk update',
  });

module.exports = { createStudentSchema, updateStudentSchema };
