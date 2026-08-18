const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { AppError } = require('../utils/response');

/**
 * Login: validasi email+password, return JWT + info user dasar.
 * Password TIDAK PERNAH ikut dikembalikan di response manapun.
 */
async function login(email, password) {
  const rows = await db.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (rows.length === 0) {
    throw new AppError(401, 'Email atau password salah');
  }

  const user = rows[0];

  if (!user.is_active) {
    throw new AppError(403, 'Akun tidak aktif, hubungi admin');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError(401, 'Email atau password salah');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

/**
 * Ambil profil lengkap user berdasarkan id + role dari token.
 * Dipakai untuk GET /api/auth/me.
 */
async function getProfile(userId, role) {
  const baseRows = await db.query(
    'SELECT id, email, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (baseRows.length === 0) {
    throw new AppError(404, 'User tidak ditemukan');
  }

  const base = baseRows[0];
  let profile = null;

  if (role === 'student') {
    const rows = await db.query(
      'SELECT id, class_id, nis, full_name FROM students WHERE user_id = ? LIMIT 1',
      [userId]
    );
    profile = rows[0] || null;
  } else if (role === 'teacher') {
    const rows = await db.query(
      'SELECT id, nip, full_name, phone FROM teachers WHERE user_id = ? LIMIT 1',
      [userId]
    );
    profile = rows[0] || null;
  } else if (role === 'parent') {
    const rows = await db.query(
      'SELECT id, full_name, phone FROM parents WHERE user_id = ? LIMIT 1',
      [userId]
    );
    profile = rows[0] || null;
  }
  // role === 'admin' -> tidak punya tabel profil terpisah, cukup data users

  return { ...base, profile };
}

module.exports = { login, getProfile };
