const { z } = require('zod');

const historyQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_from harus YYYY-MM-DD').optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date_to harus YYYY-MM-DD').optional(),
});

module.exports = { historyQuerySchema };
