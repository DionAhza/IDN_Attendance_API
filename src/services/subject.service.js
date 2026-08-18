const db = require('../config/database');
const { AppError } = require('../utils/response');
const { buildMeta } = require('../utils/pagination');

async function list({ page, limit, offset, search }) {
  const params = [];
  let where = '';

  if (search) {
    where = 'WHERE name LIKE ? OR code LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  const rows = await db.query(
    `SELECT id, name, code, is_active, created_at, updated_at
     FROM subjects ${where}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const totalRows = await db.query(
    `SELECT COUNT(*) AS total FROM subjects ${where}`,
    params
  );

  return { items: rows, meta: buildMeta({ page, limit, total: totalRows[0].total }) };
}

async function getById(id) {
  const rows = await db.query(
    'SELECT id, name, code, is_active, created_at, updated_at FROM subjects WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) {
    throw new AppError(404, 'Mata pelajaran tidak ditemukan');
  }
  return rows[0];
}

async function create(data) {
  if (data.code) {
    const existing = await db.query('SELECT id FROM subjects WHERE code = ? LIMIT 1', [data.code]);
    if (existing.length > 0) {
      throw new AppError(409, 'Kode mata pelajaran sudah dipakai');
    }
  }

  const result = await db.query(
    'INSERT INTO subjects (name, code, is_active) VALUES (?, ?, ?)',
    [data.name, data.code ?? null, data.is_active ?? true]
  );
  return getById(result.insertId);
}

async function update(id, data) {
  await getById(id);

  if (data.code) {
    const existing = await db.query(
      'SELECT id FROM subjects WHERE code = ? AND id != ? LIMIT 1',
      [data.code, id]
    );
    if (existing.length > 0) {
      throw new AppError(409, 'Kode mata pelajaran sudah dipakai');
    }
  }

  const fields = [];
  const params = [];
  for (const key of ['name', 'code', 'is_active']) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }

  if (fields.length > 0) {
    params.push(id);
    await db.query(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return getById(id);
}

async function remove(id) {
  await getById(id);

  const usedBySchedules = await db.query('SELECT id FROM schedules WHERE subject_id = ? LIMIT 1', [id]);
  if (usedBySchedules.length > 0) {
    throw new AppError(
      409,
      'Mata pelajaran masih dipakai oleh jadwal — nonaktifkan (is_active=false) saja, jangan dihapus'
    );
  }

  await db.query('DELETE FROM subjects WHERE id = ?', [id]);
}

module.exports = { list, getById, create, update, remove };
