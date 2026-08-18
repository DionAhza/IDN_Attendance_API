const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');

const BASE_SELECT = `
  SELECT t.id, t.user_id, t.nip, t.full_name, t.phone, t.is_active,
         t.created_at, t.updated_at, u.email
  FROM teachers t
  JOIN users u ON u.id = t.user_id
`;

async function list({ page, limit, offset, search }) {
  const params = [];
  let where = '';

  if (search) {
    where = 'WHERE t.full_name LIKE ? OR t.nip LIKE ? OR u.email LIKE ?';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const rows = await db.query(
    `${BASE_SELECT} ${where} ORDER BY t.full_name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await db.query(
    `SELECT COUNT(*) AS total FROM teachers t JOIN users u ON u.id = t.user_id ${where}`,
    params
  );

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

async function getById(id) {
  const rows = await db.query(`${BASE_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Guru tidak ditemukan');
  }
  return rows[0];
}

async function create(data) {
  const existingEmail = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email]);
  if (existingEmail.length > 0) {
    throw new AppError(409, 'Email sudah dipakai');
  }

  if (data.nip) {
    const existingNip = await db.query('SELECT id FROM teachers WHERE nip = ? LIMIT 1', [data.nip]);
    if (existingNip.length > 0) {
      throw new AppError(409, 'NIP sudah dipakai');
    }
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const teacherId = await db.withTransaction(async (conn) => {
    const [userResult] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, ?)',
      [data.email, passwordHash, 'teacher', data.is_active ?? true]
    );

    const [teacherResult] = await conn.execute(
      'INSERT INTO teachers (user_id, nip, full_name, phone, is_active) VALUES (?, ?, ?, ?, ?)',
      [userResult.insertId, data.nip ?? null, data.full_name, data.phone ?? null, data.is_active ?? true]
    );

    return teacherResult.insertId;
  });

  return getById(teacherId);
}

async function update(id, data) {
  const teacher = await getById(id);

  if (data.email) {
    const existingEmail = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
      [data.email, teacher.user_id]
    );
    if (existingEmail.length > 0) {
      throw new AppError(409, 'Email sudah dipakai');
    }
  }

  if (data.nip) {
    const existingNip = await db.query(
      'SELECT id FROM teachers WHERE nip = ? AND id != ? LIMIT 1',
      [data.nip, id]
    );
    if (existingNip.length > 0) {
      throw new AppError(409, 'NIP sudah dipakai');
    }
  }

  await db.withTransaction(async (conn) => {
    const userFields = [];
    const userParams = [];
    if (data.email !== undefined) {
      userFields.push('email = ?');
      userParams.push(data.email);
    }
    if (data.password !== undefined) {
      userFields.push('password_hash = ?');
      userParams.push(await bcrypt.hash(data.password, 10));
    }
    if (data.is_active !== undefined) {
      userFields.push('is_active = ?');
      userParams.push(data.is_active);
    }
    if (userFields.length > 0) {
      userParams.push(teacher.user_id);
      await conn.execute(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userParams);
    }

    const teacherFields = [];
    const teacherParams = [];
    for (const key of ['nip', 'full_name', 'phone', 'is_active']) {
      if (data[key] !== undefined) {
        teacherFields.push(`${key} = ?`);
        teacherParams.push(data[key]);
      }
    }
    if (teacherFields.length > 0) {
      teacherParams.push(id);
      await conn.execute(`UPDATE teachers SET ${teacherFields.join(', ')} WHERE id = ?`, teacherParams);
    }
  });

  return getById(id);
}

async function remove(id) {
  const teacher = await getById(id);

  const usedBySchedules = await db.query('SELECT id FROM schedules WHERE teacher_id = ? LIMIT 1', [id]);
  if (usedBySchedules.length > 0) {
    throw new AppError(
      409,
      'Guru masih dipakai di jadwal — nonaktifkan (is_active=false) saja, jangan dihapus'
    );
  }

  const hasAttendance = await db.query(
    'SELECT id FROM teacher_attendance WHERE teacher_id = ? LIMIT 1',
    [id]
  );
  if (hasAttendance.length > 0) {
    throw new AppError(
      409,
      'Guru sudah punya riwayat absensi — nonaktifkan (is_active=false) saja, jangan dihapus, supaya histori tidak hilang'
    );
  }

  // Hapus user sekalian menghapus row teacher (ON DELETE CASCADE).
  await db.query('DELETE FROM users WHERE id = ?', [teacher.user_id]);
}

module.exports = { list, getById, create, update, remove };
