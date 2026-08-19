const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');

const BASE_SELECT = `
  SELECT p.id, p.user_id, p.full_name, p.phone, p.created_at, p.updated_at,
         u.email, u.is_active,
         (SELECT COUNT(*) FROM parent_students ps WHERE ps.parent_id = p.id) AS children_count
  FROM parents p
  JOIN users u ON u.id = p.user_id
`;

async function list({ page, limit, offset, search }) {
  const params = [];
  let where = '';
  if (search) {
    where = 'WHERE p.full_name LIKE ? OR p.phone LIKE ? OR u.email LIKE ?';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const rows = await db.query(
    `${BASE_SELECT} ${where} ORDER BY p.full_name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const totalRows = await db.query(
    `SELECT COUNT(*) AS total FROM parents p JOIN users u ON u.id = p.user_id ${where}`,
    params
  );
  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

async function getById(id) {
  const rows = await db.query(`${BASE_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
  if (rows.length === 0) throw new AppError(404, 'Parent tidak ditemukan');
  return rows[0];
}

async function create(data) {
  const existingEmail = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email]);
  if (existingEmail.length > 0) throw new AppError(409, 'Email sudah dipakai');

  const passwordHash = await bcrypt.hash(data.password, 10);
  const parentId = await db.withTransaction(async (conn) => {
    const [userResult] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, ?)',
      [data.email, passwordHash, 'parent', data.is_active ?? true]
    );
    const [parentResult] = await conn.execute(
      'INSERT INTO parents (user_id, full_name, phone) VALUES (?, ?, ?)',
      [userResult.insertId, data.full_name, data.phone ?? null]
    );
    return parentResult.insertId;
  });
  return getById(parentId);
}

async function update(id, data) {
  const parent = await getById(id);
  if (data.email) {
    const existingEmail = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
      [data.email, parent.user_id]
    );
    if (existingEmail.length > 0) throw new AppError(409, 'Email sudah dipakai');
  }

  await db.withTransaction(async (conn) => {
    const userFields = [];
    const userParams = [];
    if (data.email !== undefined) { userFields.push('email = ?'); userParams.push(data.email); }
    if (data.password !== undefined) {
      userFields.push('password_hash = ?');
      userParams.push(await bcrypt.hash(data.password, 10));
    }
    if (data.is_active !== undefined) { userFields.push('is_active = ?'); userParams.push(data.is_active); }
    if (userFields.length > 0) {
      userParams.push(parent.user_id);
      await conn.execute(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userParams);
    }

    const parentFields = [];
    const parentParams = [];
    for (const key of ['full_name', 'phone']) {
      if (data[key] !== undefined) { parentFields.push(`${key} = ?`); parentParams.push(data[key]); }
    }
    if (parentFields.length > 0) {
      parentParams.push(id);
      await conn.execute(`UPDATE parents SET ${parentFields.join(', ')} WHERE id = ?`, parentParams);
    }
  });
  return getById(id);
}

async function remove(id) {
  const parent = await getById(id);
  await db.query('DELETE FROM users WHERE id = ?', [parent.user_id]);
}

// ==========================================
// Link/unlink parent <-> student (tabel parent_students)
// ==========================================

/**
 * Hubungkan parent ke satu student (dipakai supaya notifikasi
 * check-in/check-out siswa tersebut ikut terkirim ke parent ini).
 * UNIQUE(parent_id, student_id) di DB jadi garda terakhir kalau ada
 * race condition / double-submit dari client.
 */
async function linkStudent(parentId, { student_id, relationship_type }) {
  await getById(parentId); // 404 kalau parent tidak ada

  const studentRows = await db.query('SELECT id, full_name FROM students WHERE id = ? LIMIT 1', [student_id]);
  if (studentRows.length === 0) throw new AppError(404, 'Student tidak ditemukan');

  const existing = await db.query(
    'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ? LIMIT 1',
    [parentId, student_id]
  );
  if (existing.length > 0) throw new AppError(409, 'Parent ini sudah terhubung ke student tersebut');

  await db.query(
    'INSERT INTO parent_students (parent_id, student_id, relationship_type) VALUES (?, ?, ?)',
    [parentId, student_id, relationship_type ?? null]
  );

  return listChildren(parentId);
}

/**
 * Putuskan relasi parent <-> student tertentu (bukan hapus parent
 * atau student-nya, cuma baris relasinya di parent_students).
 */
async function unlinkStudent(parentId, studentId) {
  const result = await db.query(
    'DELETE FROM parent_students WHERE parent_id = ? AND student_id = ?',
    [parentId, studentId]
  );
  if (result.affectedRows === 0) throw new AppError(404, 'Relasi parent-student ini tidak ditemukan');
}

/**
 * List semua anak yang terhubung ke parent ini — dipakai untuk
 * verifikasi setelah link/unlink, dan endpoint GET /:id/students.
 */
async function listChildren(parentId) {
  await getById(parentId); // 404 kalau parent tidak ada
  return db.query(
    `SELECT s.id AS student_id, s.full_name, s.nis, ps.relationship_type, ps.created_at AS linked_at
     FROM parent_students ps
     JOIN students s ON s.id = ps.student_id
     WHERE ps.parent_id = ?
     ORDER BY ps.created_at DESC`,
    [parentId]
  );
}

module.exports = { list, getById, create, update, remove, linkStudent, unlinkStudent, listChildren };