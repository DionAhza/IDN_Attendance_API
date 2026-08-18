const { z } = require('zod');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Terima format "HH:MM" atau "HH:MM:SS".
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const timeSchema = z.string().regex(timeRegex, 'Format waktu harus HH:MM (24 jam)');

const createScheduleSchema = z
  .object({
    teacher_id: z.number().int().positive('teacher_id wajib diisi'),
    class_id: z.number().int().positive('class_id wajib diisi'),
    subject_id: z.number().int().positive('subject_id wajib diisi'),
    day: z.enum(DAYS, { errorMap: () => ({ message: `day harus salah satu dari: ${DAYS.join(', ')}` }) }),
    start_time: timeSchema,
    end_time: timeSchema,
    is_active: z.boolean().optional(),
  })
  .refine((data) => data.end_time > data.start_time, {
    message: 'end_time harus lebih besar dari start_time',
    path: ['end_time'],
  });

const updateScheduleSchema = z
  .object({
    teacher_id: z.number().int().positive().optional(),
    class_id: z.number().int().positive().optional(),
    subject_id: z.number().int().positive().optional(),
    day: z.enum(DAYS).optional(),
    start_time: timeSchema.optional(),
    end_time: timeSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal 1 field harus diisi untuk update',
  })
  .refine(
    (data) => !(data.start_time && data.end_time) || data.end_time > data.start_time,
    { message: 'end_time harus lebih besar dari start_time', path: ['end_time'] }
  );

module.exports = { createScheduleSchema, updateScheduleSchema, DAYS };
