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
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/**
 * Test koneksi — dipakai di health check / debugging awal.
 */
async function testConnection() {
  await query('SELECT 1 AS ok');
  return true;
}

module.exports = { getPool, query, testConnection };
