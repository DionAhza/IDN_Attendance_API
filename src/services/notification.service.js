// ==========================================
// Notification Service — Phase 12 (email) + Phase 13 (multi-channel/WhatsApp)
// ==========================================
// Kirim notifikasi ke parent saat siswa check-in/check-out, lewat satu
// atau lebih CHANNEL (email, whatsapp). Channel baru bisa ditambah di
// masa depan (mis. push notification) tanpa mengubah pemanggil
// (studentAttendance.service.js) — mereka cukup panggil notify(type, payload)
// seperti biasa.
//
// Prinsip utama:
// 1. BEST-EFFORT / NON-BLOCKING — gagal kirim notifikasi (channel apa
//    pun) TIDAK BOLEH membuat request absensi siswa ikut gagal. Semua
//    error ditangkap di dalam service ini, dicatat ke `notification_logs`,
//    dan TIDAK dilempar ke caller.
// 2. Satu siswa bisa punya >1 parent (relasi many-to-many via
//    parent_students) — kirim ke SEMUA parent yang terhubung.
// 3. Toggle on/off per jenis notifikasi (STUDENT_CHECK_IN, dst) dibaca
//    dari school_settings — kalau false, skip tanpa kirim dan tanpa log,
//    berlaku untuk SEMUA channel sekaligus.
// 4. Channel mana yang aktif ditentukan oleh env `NOTIFICATION_CHANNELS`
//    (comma-separated, mis. "email,whatsapp"). Kalau kosong, default
//    hanya "email" (perilaku lama tetap jalan tanpa perlu ubah .env).
// 5. Tiap channel independen — kalau WhatsApp gagal (mis. token Fonnte
//    salah), email tetap dicoba dan sebaliknya. Tiap kombinasi
//    channel x parent di-log terpisah ke notification_logs supaya
//    gampang ditelusuri channel mana yang bermasalah.
// 6. Kalau provider channel tertentu belum dikonfigurasi (env kosong),
//    tetap log sebagai 'failed' dengan pesan jelas, bukan throw exception.
// ==========================================

const nodemailer = require('nodemailer');
const db = require('../config/database');
const schoolConfig = require('../config/school');
const { nowInSchoolTimezone } = require('../utils/time');

// ==========================================
// Mapping type notifikasi → key toggle di school_settings
// ==========================================
const TYPE_TO_TOGGLE = {
  STUDENT_CHECK_IN:  'notify_parent_on_check_in',
  STUDENT_CHECK_OUT: 'notify_parent_on_check_out',
  STUDENT_LATE:      'notify_parent_on_late',
  STUDENT_ABSENT:    'notify_parent_on_absent',
};

const DEFAULT_CHANNELS = ['email'];
const SUPPORTED_CHANNELS = ['email', 'whatsapp'];

// ==========================================
// Channel resolution — channel mana yang aktif secara global
// ==========================================

/**
 * Baca `NOTIFICATION_CHANNELS` dari env (mis. "email,whatsapp"),
 * saring hanya channel yang dikenal sistem, dan buang duplikat.
 * Kalau env kosong/tidak diisi, fallback ke DEFAULT_CHANNELS (email
 * saja) supaya deployment lama yang belum set env ini tetap jalan
 * persis seperti sebelum Phase 13.
 */
function getEnabledChannels() {
  const raw = (process.env.NOTIFICATION_CHANNELS || '').trim();
  if (!raw) return [...DEFAULT_CHANNELS];

  const channels = raw
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => SUPPORTED_CHANNELS.includes(c));

  return channels.length > 0 ? [...new Set(channels)] : [...DEFAULT_CHANNELS];
}

// ==========================================
// EMAIL — transporter Nodemailer, lazy-initialized & di-cache supaya
// tidak bikin koneksi SMTP baru tiap kali kirim email.
// ==========================================
let transporter = null;

/**
 * Buat atau ambil transporter Nodemailer. Lazy-init supaya tidak
 * crash saat module di-require kalau env belum diisi.
 * Return null kalau provider belum dikonfigurasi.
 */
function getTransporter() {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();

  if (!provider) return null;

  if (transporter) return transporter;

  if (provider === 'smtp') {
    const host = process.env.EMAIL_SMTP_HOST;
    const port = Number(process.env.EMAIL_SMTP_PORT) || 587;
    const user = process.env.EMAIL_SMTP_USER;
    const pass = process.env.EMAIL_SMTP_PASS;

    if (!host || !user || !pass) return null;

    transporter = nodemailer.createTransport({
      host,
      port,
      // Port 465 = SSL langsung, port lain pakai STARTTLS
      secure: port === 465,
      auth: { user, pass },
    });
    return transporter;
  }

  // Provider tidak dikenali — kembalikan null, akan di-log sebagai failed
  return null;
}

/**
 * Kirim satu email. Return { success: true } atau { success: false, error: string }.
 * TIDAK throw exception — semua error ditangkap di dalam.
 */
async function sendEmail(to, subject, html) {
  try {
    const transport = getTransporter();
    if (!transport) {
      return {
        success: false,
        error: 'Email provider belum dikonfigurasi — isi EMAIL_PROVIDER dan kredensial SMTP di .env',
      };
    }

    const from = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER || 'noreply@idn.sch.id';

    await transport.sendMail({ from, to, subject, html });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

// ==========================================
// WHATSAPP (Fonnte) — Phase 13
// ==========================================
// Fonnte (https://fonnte.com) adalah gateway WhatsApp API buatan
// Indonesia — dipilih karena harga terjangkau dan tidak butuh approval
// business number seperti WhatsApp Cloud API resmi Meta. Cukup satu
// device WhatsApp yang di-scan sekali di dashboard Fonnte, lalu kirim
// pesan lewat REST API dengan token device tersebut.
// ==========================================

const FONNTE_DEFAULT_API_URL = 'https://api.fonnte.com/send';

/**
 * Normalisasi nomor HP Indonesia ke format yang diharapkan Fonnte
 * (awalan 62, tanpa spasi/strip/tanda plus). Nomor lokal yang diawali
 * '0' diubah jadi '62', dan karakter non-digit dibuang.
 * Return null kalau setelah dibersihkan nomornya kosong/tidak valid.
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return null;

  const digitsOnly = String(rawPhone).replace(/\D/g, '');
  if (!digitsOnly) return null;

  if (digitsOnly.startsWith('0')) {
    return `62${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.startsWith('62')) {
    return digitsOnly;
  }
  // Nomor tanpa awalan 0/62 (mis. sudah 8xxxxxxxxxx) — anggap lokal, tambah 62.
  return `62${digitsOnly}`;
}

/**
 * Kirim satu pesan WhatsApp lewat Fonnte REST API.
 * Return { success: true } atau { success: false, error: string }.
 * TIDAK throw exception — semua error (network, HTTP, token kosong,
 * response gagal dari Fonnte) ditangkap dan dikembalikan sebagai object.
 */
async function sendWhatsapp(to, message) {
  try {
    const token = process.env.FONNTE_TOKEN;
    if (!token) {
      return {
        success: false,
        error: 'FONNTE_TOKEN belum dikonfigurasi — isi FONNTE_TOKEN di .env untuk aktifkan notifikasi WhatsApp',
      };
    }

    const target = normalizePhoneNumber(to);
    if (!target) {
      return { success: false, error: 'Nomor HP parent tidak valid/kosong' };
    }

    const apiUrl = process.env.FONNTE_API_URL || FONNTE_DEFAULT_API_URL;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ target, message }).toString(),
    });

    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    // Fonnte mengembalikan HTTP 200 bahkan untuk sebagian error, jadi
    // status keberhasilan sebenarnya dicek dari field `status` di body
    // (true/false), bukan cuma response.ok.
    if (!response.ok || !body || body.status === false) {
      const reason = (body && (body.reason || body.message)) || `HTTP ${response.status}`;
      return { success: false, error: `Fonnte menolak pesan: ${reason}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Buat pesan WhatsApp (plain text — WhatsApp tidak render HTML) untuk
 * satu jenis notifikasi. Isi informasinya sama dengan versi email,
 * cuma diformat ulang jadi teks biasa dengan emoji secukupnya.
 */
function composeWhatsappMessage(type, payload) {
  const { studentName, time, status } = payload;
  const jamStr = time ? time.split(' ')[1] || time : '-';
  const statusLabel = status === 'late' ? 'Terlambat ⚠️' : 'Tepat Waktu ✅';

  switch (type) {
    case 'STUDENT_CHECK_IN':
      return (
        `🏫 *Notifikasi Absensi IDN*\n\n` +
        `Assalamu'alaikum,\n` +
        `*${studentName}* telah melakukan *absen masuk* hari ini.\n\n` +
        `Waktu: ${jamStr} WIB\n` +
        `Status: ${statusLabel}\n\n` +
        `_Pesan ini dikirim otomatis oleh sistem absensi IDN Boarding School._`
      );

    case 'STUDENT_CHECK_OUT':
      return (
        `🏫 *Notifikasi Absensi IDN*\n\n` +
        `Assalamu'alaikum,\n` +
        `*${studentName}* telah melakukan *absen pulang* hari ini.\n\n` +
        `Waktu: ${jamStr} WIB\n\n` +
        `_Pesan ini dikirim otomatis oleh sistem absensi IDN Boarding School._`
      );

    case 'STUDENT_LATE':
      return (
        `⚠️ *Peringatan Keterlambatan*\n\n` +
        `Assalamu'alaikum,\n` +
        `*${studentName}* tercatat *terlambat* masuk hari ini.\n\n` +
        `Waktu Check-in: ${jamStr} WIB\n` +
        `Mohon perhatian dan bimbingannya agar anak dapat hadir tepat waktu.\n\n` +
        `_Pesan ini dikirim otomatis oleh sistem absensi IDN Boarding School._`
      );

    default:
      return `Notifikasi absensi untuk ${studentName} — ${type}, waktu ${jamStr} WIB.`;
  }
}

// ==========================================
// Compose email subject & body berdasarkan type
// ==========================================

/**
 * Buat subject dan body HTML email berdasarkan jenis notifikasi.
 * Body dibuat sederhana (inline HTML, tanpa template engine) karena
 * email transaksional sekolah tidak butuh desain rumit — yang penting
 * informasinya jelas dan cepat dibaca parent di HP.
 */
function composeEmail(type, payload) {
  const { studentName, time, status } = payload;

  // Format jam saja dari datetime (ambil bagian waktu 'HH:MM:SS')
  const jamStr = time ? time.split(' ')[1] || time : '-';

  // Label status dalam Bahasa Indonesia
  const statusLabel = status === 'late' ? '⚠️ Terlambat' : '✅ Tepat Waktu';

  switch (type) {
    case 'STUDENT_CHECK_IN':
      return {
        subject: `[IDN] ${studentName} sudah absen masuk`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🏫 Notifikasi Absensi IDN</h2>
            <p>Assalamu'alaikum,</p>
            <p>Kami informasikan bahwa <strong>${studentName}</strong> telah melakukan <strong>absen masuk</strong> hari ini.</p>
            <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;"><strong>Waktu</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${jamStr} WIB</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;"><strong>Status</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${statusLabel}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">Email ini dikirim otomatis oleh sistem absensi IDN Boarding School.</p>
          </div>
        `,
      };

    case 'STUDENT_CHECK_OUT':
      return {
        subject: `[IDN] ${studentName} sudah absen pulang`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🏫 Notifikasi Absensi IDN</h2>
            <p>Assalamu'alaikum,</p>
            <p>Kami informasikan bahwa <strong>${studentName}</strong> telah melakukan <strong>absen pulang</strong> hari ini.</p>
            <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;"><strong>Waktu</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${jamStr} WIB</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">Email ini dikirim otomatis oleh sistem absensi IDN Boarding School.</p>
          </div>
        `,
      };

    case 'STUDENT_LATE':
      return {
        subject: `[IDN] ⚠️ ${studentName} terlambat masuk`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #dc2626;">⚠️ Peringatan Keterlambatan</h2>
            <p>Assalamu'alaikum,</p>
            <p>Kami informasikan bahwa <strong>${studentName}</strong> tercatat <strong>terlambat</strong> masuk hari ini.</p>
            <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;"><strong>Waktu Check-in</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${jamStr} WIB</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb;"><strong>Status</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">⚠️ Terlambat</td></tr>
            </table>
            <p>Mohon perhatian dan bimbingannya agar anak dapat hadir tepat waktu.</p>
            <p style="color: #6b7280; font-size: 13px;">Email ini dikirim otomatis oleh sistem absensi IDN Boarding School.</p>
          </div>
        `,
      };

    default:
      return {
        subject: `[IDN] Notifikasi absensi ${studentName}`,
        html: `<p>Notifikasi absensi untuk ${studentName} — type: ${type}, waktu: ${jamStr} WIB.</p>`,
      };
  }
}

// ==========================================
// Resolve semua parent (email + phone) untuk satu siswa
// ==========================================

/**
 * Cari semua parent yang terhubung ke siswa ini, kembalikan array
 * { email, phone, parent_name }. Hanya parent dengan akun aktif
 * (users.is_active=1) yang dikembalikan — parent yang di-nonaktifkan
 * admin tidak dapat notifikasi apa pun.
 */
async function getParentContactsByStudentId(studentId) {
  return db.query(
    `SELECT u.email, p.phone, p.full_name AS parent_name
     FROM parent_students ps
     JOIN parents p ON p.id = ps.parent_id
     JOIN users u ON u.id = p.user_id AND u.is_active = 1
     WHERE ps.student_id = ?`,
    [studentId]
  );
}

// ==========================================
// Log ke tabel notification_logs
// ==========================================

/**
 * Insert 1 baris ke notification_logs. Best-effort — kalau insert log
 * gagal (mis. DB error), cuma console.error, tidak throw ke caller.
 */
async function logNotification({ recipient, type, subject, status, provider, attendanceType, attendanceId, errorMessage }) {
  try {
    const { datetime } = nowInSchoolTimezone();
    await db.query(
      `INSERT INTO notification_logs
         (recipient, type, subject, status, provider, related_attendance_type, related_attendance_id, sent_at, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recipient,
        type,
        subject || null,
        status,                          // 'success' atau 'failed'
        provider || 'smtp',
        attendanceType || 'student',
        attendanceId || null,
        status === 'success' ? datetime : null,
        errorMessage || null,
      ]
    );
  } catch (logErr) {
    // Gagal nulis log TIDAK boleh propagate ke caller — cukup console
    // supaya masih ada jejak di server log, walau tidak masuk DB.
    console.error('[NotificationService] Gagal menulis notification_logs:', logErr.message);
  }
}

// ==========================================
// Kirim satu notifikasi ke satu parent lewat satu channel — dipakai
// oleh notify() di dalam loop channel x parent.
// ==========================================
async function dispatchToChannel({ channel, type, parent, subject, html, text, attendanceId }) {
  if (channel === 'email') {
    if (!parent.email) {
      await logNotification({
        recipient: `parent:${parent.parent_name || 'unknown'} (no email)`,
        type,
        subject,
        status: 'failed',
        provider: (process.env.EMAIL_PROVIDER || 'belum-dikonfigurasi').toLowerCase(),
        attendanceType: 'student',
        attendanceId,
        errorMessage: 'Parent tidak memiliki email terdaftar',
      });
      return;
    }

    const result = await sendEmail(parent.email, subject, html);
    await logNotification({
      recipient: parent.email,
      type,
      subject,
      status: result.success ? 'success' : 'failed',
      provider: (process.env.EMAIL_PROVIDER || 'belum-dikonfigurasi').toLowerCase(),
      attendanceType: 'student',
      attendanceId,
      errorMessage: result.error || null,
    });
    return;
  }

  if (channel === 'whatsapp') {
    if (!parent.phone) {
      await logNotification({
        recipient: `parent:${parent.parent_name || 'unknown'} (no phone)`,
        type,
        subject: null,
        status: 'failed',
        provider: 'fonnte',
        attendanceType: 'student',
        attendanceId,
        errorMessage: 'Parent tidak memiliki nomor HP terdaftar',
      });
      return;
    }

    const result = await sendWhatsapp(parent.phone, text);
    await logNotification({
      recipient: normalizePhoneNumber(parent.phone) || parent.phone,
      type,
      subject: null,
      status: result.success ? 'success' : 'failed',
      provider: 'fonnte',
      attendanceType: 'student',
      attendanceId,
      errorMessage: result.error || null,
    });
  }
}

// ==========================================
// Fungsi utama: notify(type, payload)
// ==========================================

/**
 * Entry point notifikasi — dipanggil dari studentAttendance.service.js.
 * Mengirim ke SEMUA channel yang aktif (lihat getEnabledChannels()) dan
 * SEMUA parent yang terhubung ke siswa tersebut.
 *
 * @param {string} type - Jenis notifikasi: 'STUDENT_CHECK_IN', 'STUDENT_CHECK_OUT', 'STUDENT_LATE'
 * @param {object} payload - Data notifikasi:
 *   - studentId {number} — ID siswa (dari tabel students)
 *   - studentName {string} — Nama lengkap siswa
 *   - attendanceId {number} — ID baris student_attendance
 *   - time {string} — Waktu event (format 'YYYY-MM-DD HH:MM:SS' WIB)
 *   - status {string} — Status absensi ('present' / 'late')
 *
 * Fungsi ini TIDAK throw exception ke caller — semua error ditangkap
 * internal dan dicatat ke notification_logs.
 */
async function notify(type, payload) {
  try {
    // 1. Cek toggle — kalau false, skip tanpa log (sesuai spek: "cukup tidak diproses")
    const toggleKey = TYPE_TO_TOGGLE[type];
    if (toggleKey) {
      const isEnabled = await schoolConfig.getBooleanSetting(toggleKey, true);
      if (!isEnabled) {
        return; // Toggle off — skip silently
      }
    }

    const channels = getEnabledChannels();

    // 2. Resolve semua parent yang terhubung ke siswa ini
    const parents = await getParentContactsByStudentId(payload.studentId);
    if (parents.length === 0) {
      // Siswa tidak punya parent terhubung — log sebagai info, bukan error
      // (bisa terjadi kalau parent belum di-link di parent_students)
      await logNotification({
        recipient: `student_id:${payload.studentId}`,
        type,
        subject: null,
        status: 'failed',
        provider: channels.join('+'),
        attendanceType: 'student',
        attendanceId: payload.attendanceId,
        errorMessage: 'Siswa tidak memiliki parent yang terhubung di tabel parent_students',
      });
      return;
    }

    // 3. Compose isi pesan sekali per channel (isi sama untuk semua parent)
    const { subject, html } = composeEmail(type, payload);
    const text = composeWhatsappMessage(type, payload);

    // 4. Kirim ke SETIAP kombinasi channel x parent — masing-masing
    //    di-log terpisah supaya gampang ditelusuri kalau ada yang gagal.
    for (const channel of channels) {
      for (const parent of parents) {
        await dispatchToChannel({
          channel,
          type,
          parent,
          subject,
          html,
          text,
          attendanceId: payload.attendanceId,
        });
      }
    }
  } catch (err) {
    // Catch-all terakhir — kalau ada error yang lolos dari try-catch internal
    // (mis. DB error saat resolve parent), tetap jangan propagate ke caller.
    console.error('[NotificationService] Error tidak terduga:', err.message);
  }
}

module.exports = {
  notify,
  // Diekspor tambahan untuk keperluan unit test & reuse — bukan
  // dipanggil langsung oleh service lain di luar modul ini.
  getEnabledChannels,
  composeEmail,
  composeWhatsappMessage,
  normalizePhoneNumber,
};
