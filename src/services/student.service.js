const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');

const BASE_SELECT = `
  SELECT s.id, s.user_id, s.class_id, s.nis, s.full_name, s.is_active,
         s.created_at, s.updated_at, u.email, c.name AS class_name
  FROM students s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN classes c ON c.id = s.class_id
`;

async function assertClassExists(classId) {
  if (classId === undefined || classId === null) return;
  const rows = await db.query('SELECT id FROM classes WHERE id = ? LIMIT 1', [classId]);
  if (rows.length === 0) {
    throw new AppError(422, 'class_id tidak valid — kelas tidak ditemukan');
  }
}

async function list({ page, limit, offset, search, classId }) {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(s.full_name LIKE ? OR s.nis LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (classId) {
    conditions.push('s.class_id = ?');
    params.push(classId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await db.query(
    `${BASE_SELECT} ${where} ORDER BY s.full_name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM students s JOIN users u ON u.id = s.user_id
     ${where}`,
    params
  );

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

async function getById(id) {
  const rows = await db.query(`${BASE_SELECT} WHERE s.id = ? LIMIT 1`, [id]);
  if (rows.length === 0) {
    throw new AppError(404, 'Siswa tidak ditemukan');
  }
  return rows[0];
}

async function create(data) {
  const existingEmail = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email]);
  if (existingEmail.length > 0) {
    throw new AppError(409, 'Email sudah dipakai');
  }

  const existingNis = await db.query('SELECT id FROM students WHERE nis = ? LIMIT 1', [data.nis]);
  if (existingNis.length > 0) {
    throw new AppError(409, 'NIS sudah dipakai');
  }

  await assertClassExists(data.class_id);

  const passwordHash = await bcrypt.hash(data.password, 10);

  const studentId = await db.withTransaction(async (conn) => {
    const [userResult] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, ?)',
      [data.email, passwordHash, 'student', data.is_active ?? true]
    );

    const [studentResult] = await conn.execute(
      'INSERT INTO students (user_id, class_id, nis, full_name, is_active) VALUES (?, ?, ?, ?, ?)',
      [userResult.insertId, data.class_id ?? null, data.nis, data.full_name, data.is_active ?? true]
    );

    return studentResult.insertId;
  });

  return getById(studentId);
}

async function update(id, data) {
  const student = await getById(id);

  if (data.email) {
    const existingEmail = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
      [data.email, student.user_id]
    );
    if (existingEmail.length > 0) {
      throw new AppError(409, 'Email sudah dipakai');
    }
  }

  if (data.nis) {
    const existingNis = await db.query(
      'SELECT id FROM students WHERE nis = ? AND id != ? LIMIT 1',
      [data.nis, id]
    );
    if (existingNis.length > 0) {
      throw new AppError(409, 'NIS sudah dipakai');
    }
  }

  if (data.class_id !== undefined) {
    await assertClassExists(data.class_id);
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
      userParams.push(student.user_id);
      await conn.execute(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userParams);
    }

    const studentFields = [];
    const studentParams = [];
    for (const key of ['class_id', 'nis', 'full_name', 'is_active']) {
      if (data[key] !== undefined) {
        studentFields.push(`${key} = ?`);
        studentParams.push(data[key]);
      }
    }
    if (studentFields.length > 0) {
      studentParams.push(id);
      await conn.execute(`UPDATE students SET ${studentFields.join(', ')} WHERE id = ?`, studentParams);
    }
  });

  return getById(id);
}

async function remove(id) {
  const student = await getById(id);

  const hasAttendance = await db.query(
    'SELECT id FROM student_attendance WHERE student_id = ? LIMIT 1',
    [id]
  );
  if (hasAttendance.length > 0) {
    throw new AppError(
      409,
      'Siswa sudah punya riwayat absensi — nonaktifkan (is_active=false) saja, jangan dihapus, supaya histori tidak hilang'
    );
  }

  // ON DELETE CASCADE: users -> students -> parent_students
  await db.query('DELETE FROM users WHERE id = ?', [student.user_id]);
}

module.exports = { list, getById, create, update, remove };
