const { z } = require('zod');

// Create teacher = create user (role teacher) + profil teacher sekaligus.
const createTeacherSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  nip: z.string().max(30).optional().nullable(),
  full_name: z.string().min(1, 'Nama lengkap wajib diisi').max(150),
  phone: z.string().max(20).optional().nullable(),
  is_active: z.boolean().optional(),
});

// Update: email/password opsional (admin bisa reset kredensial guru dari
// sini juga), field profil boleh diupdate sebagian.
const updateTeacherSchema = z
  .object({
    email: z.string().email('Format email tidak valid').optional(),
    password: z.string().min(8, 'Password minimal 8 karakter').optional(),
    nip: z.string().max(30).optional().nullable(),
    full_name: z.string().min(1).max(150).optional(),
    phone: z.string().max(20).optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal 1 field harus diisi untuk update',
  });

module.exports = { createTeacherSchema, updateTeacherSchema };
