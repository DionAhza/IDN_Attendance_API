// ==========================================
// Helper waktu — sekolah beroperasi di WIB (Asia/Jakarta), sedangkan
// server (Vercel serverless) kemungkinan besar jalan di UTC. Semua
// perhitungan "hari ini" dan "jam berapa sekarang" untuk keperluan
// absensi HARUS lewat helper ini, supaya tidak salah zona waktu.
// ==========================================

const SCHOOL_TIMEZONE = 'Asia/Jakarta';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}); // locale en-CA -> format YYYY-MM-DD

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}); // format HH:MM:SS

/**
 * Ambil tanggal & jam "sekarang" versi WIB, siap dipakai untuk kolom
 * DATE/TIME/DATETIME MySQL (DATETIME tidak melakukan konversi timezone
 * sendiri, jadi string yang kita kirim harus sudah dalam WIB).
 */
function nowInSchoolTimezone() {
  const now = new Date();
  const date = dateFormatter.format(now); // '2026-08-18'
  const time = timeFormatter.format(now); // '14:05:30'
  return { date, time, datetime: `${date} ${time}` };
}

module.exports = { nowInSchoolTimezone, SCHOOL_TIMEZONE };
