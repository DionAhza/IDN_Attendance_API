const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');

async function list({ page, limit, offset, search }) {
  const params = [];
  let where = '';

  if (search) {
    where = 'WHERE name LIKE ?';
    params.push(`%${search}%`);
  }

  const rows = await db.query(
    `SELECT id, name, level, is_active, created_at, updated_at
     FROM classes ${where}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await db.query(
    `SELECT COUNT(*) AS total FROM classes ${where}`,
    params
  );

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

async function getById(id) {
  const rows = await db.query(
    'SELECT id, name, level, is_active, created_at, updated_at FROM classes WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Kelas tidak ditemukan');
  }
  return rows[0];
}

async function create(data) {
  const existing = await db.query('SELECT id FROM classes WHERE name = ? LIMIT 1', [data.name]);
  if (existing.length > 0) {
    throw new AppError(409, 'Nama kelas sudah dipakai');
  }

  const result = await db.query(
    'INSERT INTO classes (name, level, is_active) VALUES (?, ?, ?)',
    [data.name, data.level ?? null, data.is_active ?? true]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  await getById(id); // pastikan ada, lempar 404 kalau tidak

  if (data.name) {
    const existing = await db.query(
      'SELECT id FROM classes WHERE name = ? AND id != ? LIMIT 1',
      [data.name, id]
    );
    if (existing.length > 0) {
      throw new AppError(409, 'Nama kelas sudah dipakai');
    }
  }

  const fields = [];
  const params = [];
  for (const key of ['name', 'level', 'is_active']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }

  if (fields.length > 0) {
    params.push(id);
    await db.query(`UPDATE classes SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return getById(id);
}

async function remove(id) {
  await getById(id);

  // Kelas yang masih dipakai siswa/jadwal tidak boleh dihapus keras —
  // arahkan admin untuk menonaktifkan (is_active = false) saja.
  const usedByStudents = await db.query('SELECT id FROM students WHERE class_id = ? LIMIT 1', [id]);
  const usedBySchedules = await db.query('SELECT id FROM schedules WHERE class_id = ? LIMIT 1', [id]);
  if (usedByStudents.length > 0 || usedBySchedules.length > 0) {
    throw new AppError(
      409,
      'Kelas masih dipakai oleh siswa/jadwal — nonaktifkan (is_active=false) saja, jangan dihapus'
    );
  }

  await db.query('DELETE FROM classes WHERE id = ?', [id]);
}

module.exports = { list, getById, create, update, remove };
