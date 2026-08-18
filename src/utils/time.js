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

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHOOL_TIMEZONE,
  weekday: 'long',
}); // 'Monday', 'Tuesday', dst — dicocokkan ke ENUM schedules.day (lowercase)

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

/**
 * Nama hari "sekarang" versi WIB, lowercase, cocok dengan ENUM
 * `schedules.day` ('monday'..'sunday'). Dipakai Phase 10 (teacher
 * self-service) untuk memfilter jadwal guru hari ini.
 */
function todayDayName() {
  return dayFormatter.format(new Date()).toLowerCase();
}

/**
 * Tambah N menit ke string waktu 'HH:MM:SS' -> 'HH:MM:SS' baru.
 * Dipakai untuk hitung ambang batas telat (start_time + toleransi).
 * Tidak menangani overflow lintas hari (tidak relevan untuk kasus
 * toleransi absen guru yang selalu dalam hitungan menit kecil).
 */
function addMinutesToTimeString(timeStr, minutesToAdd) {
  const [h, m, s] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutesToAdd;
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const newH = Math.floor(clamped / 60);
  const newM = clamped % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(newH)}:${pad(newM)}:${pad(s || 0)}`;
}

module.exports = { nowInSchoolTimezone, todayDayName, addMinutesToTimeString, SCHOOL_TIMEZONE };
