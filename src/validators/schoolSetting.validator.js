const { z } = require('zod');

// Upsert by key — kalau key belum ada, dibuat baru; kalau sudah ada, di-update.
const upsertSchoolSettingSchema = z.object({
  setting_value: z.string().max(255, 'Nilai maksimal 255 karakter'),
  description: z.string().max(255).optional().nullable(),
});

module.exports = { upsertSchoolSettingSchema };
