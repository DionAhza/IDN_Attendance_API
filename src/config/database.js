const mysql = require('mysql2/promise');

// ==========================================
// Koneksi MySQL — strategi untuk Vercel serverless
// ==========================================
// Pool dibuat di module-level (bukan di dalam handler), supaya
// di-reuse antar-invocation selama container masih "hangat".
// connectionLimit sengaja KECIL karena tiap serverless function
// instance punya pool sendiri-sendiri — kalau besar, gampang
// kehabisan max_connections di sisi MySQL saat traffic naik.
// ==========================================

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      maxIdle: 3,
      idleTimeout: 60000,
      queueLimit: 0,
      // Railway MySQL biasanya butuh SSL tergantung plan — jika koneksi
      // gagal dengan error terkait SSL, aktifkan baris di bawah:
      // ssl: { rejectUnauthorized: true },
    });
  }
  return pool;
}

/**
 * Jalankan query dengan prepared statement (parameterized).
 * JANGAN pernah membangun query dengan string concatenation —
 * selalu lewat fungsi ini supaya aman dari SQL injection.
 */
async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

/**
 * Test koneksi — dipakai di health check / debugging awal.
 */
async function testConnection() {
  await query('SELECT 1 AS ok');
  return true;
}

/**
 * Jalankan beberapa query dalam satu transaksi.
 * Dipakai saat sebuah operasi butuh insert/update di lebih dari satu
 * tabel yang harus sukses/gagal bersamaan (mis. create teacher =
 * insert ke `users` + insert ke `teachers`).
 *
 * Pakai:
 *   await withTransaction(async (conn) => {
 *     await conn.execute('INSERT INTO users ...', [...]);
 *     await conn.execute('INSERT INTO teachers ...', [...]);
 *   });
 *
 * callback menerima `conn` (bukan pool) — di dalam callback selalu
 * pakai conn.execute(...), JANGAN pakai query()/getPool() lagi,
 * supaya semua query jalan di koneksi & transaksi yang sama.
 */
async function withTransaction(callback) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getPool, query, testConnection, withTransaction };
