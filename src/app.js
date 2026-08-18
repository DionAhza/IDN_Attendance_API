const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ==========================================
// Core middleware
// ==========================================
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting dasar — akan ditinjau ulang di Phase 15 (Security)
// sesuai kebutuhan endpoint per-role.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200,
});
app.use(limiter);

// ==========================================
// Health check
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'IDN Attendance API is running',
    data: { timestamp: new Date().toISOString() },
  });
});

// ==========================================
// Routes
// ==========================================
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Admin CRUD master data (Phase 8) — semua endpoint di bawah ini
// diproteksi authenticate + requireRole('admin') di masing-masing
// file routes-nya sendiri.
const classRoutes = require('./routes/class.routes');
const subjectRoutes = require('./routes/subject.routes');
const teacherRoutes = require('./routes/teacher.routes');
const studentRoutes = require('./routes/student.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const schoolSettingRoutes = require('./routes/schoolSetting.routes');

app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/school-settings', schoolSettingRoutes);

// Self-service siswa (Phase 9) — check-in/out, riwayat absensi sendiri.
const studentAttendanceRoutes = require('./routes/studentAttendance.routes');
app.use('/api/student-attendance', studentAttendanceRoutes);

// Route modul self-service lain (teacher, parent, dll) akan
// didaftarkan di sini mulai Phase 10.

// ==========================================
// 404 handler
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
    data: null,
  });
});

// ==========================================
// Centralized error handler
// Akan dilengkapi di Phase 7/15 (custom error classes, logging, dll).
// ==========================================
app.use((err, req, res, next) => {
  console.error(err);

  // Jaga-jaga race condition (dua request create bersamaan lolos dari
  // pre-check uniqueness manual di service layer) — MySQL duplicate key
  // tetap diterjemahkan ke 409 yang rapi, bukan 500 mentah.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Data sudah ada (duplikat)',
      data: null,
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server',
    data: null,
  });
});

module.exports = app;
