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

// Route modul lain (students, schedules, attendance, dll) akan
// didaftarkan di sini mulai Phase 8.

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
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server',
    data: null,
  });
});

module.exports = app;
