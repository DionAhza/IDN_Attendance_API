const { z } = require('zod');

const createParentSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  full_name: z.string().min(1, 'Nama lengkap wajib diisi').max(150),
  phone: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
});

const updateParentSchema = z
  .object({
    email: z.string().email('Format email tidak valid').optional(),
    password: z.string().min(8, 'Password minimal 8 karakter').optional(),
    full_name: z.string().min(1).max(150).optional(),
    phone: z.string().max(20).optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal 1 field harus diisi untuk update',
  });

// Link parent ke student (INSERT ke parent_students).
const linkStudentSchema = z.object({
  student_id: z.number().int().positive('student_id wajib diisi dan harus angka positif'),
  relationship_type: z.string().max(30).optional().nullable(), // 'ayah' / 'ibu' / 'wali', dst
});

module.exports = { createParentSchema, updateParentSchema, linkStudentSchema };