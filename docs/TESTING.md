# Panduan Testing — Progress Saat Ini

Dokumen ini menjelaskan cara mengecek project sudah sampai mana dan
memastikan semuanya jalan sebelum lanjut ke phase berikutnya.

## Yang sudah bisa ditest sampai saat ini

- ✅ Server Express jalan (`/api/health`)
- ✅ Koneksi ke Railway MySQL
- ✅ Login (`POST /api/auth/login`) — dapat JWT
- ✅ Ambil profil sendiri (`GET /api/auth/me`) — butuh token
- ✅ Middleware auth menolak request tanpa/token salah (401)
- ✅ Admin CRUD: classes, subjects, teachers, students, schedules,
  school_settings (semua butuh token admin, role lain dapat 403)
- ✅ Schedules otomatis menolak (409) kalau jadwal baru bentrok waktu
  dengan jadwal guru/kelas yang sudah ada di hari yang sama
- ✅ Delete ditolak (409) untuk data master yang masih dipakai di tabel
  lain (mis. kelas yang masih ada siswanya) — by design, supaya histori
  tidak hilang; gunakan `is_active=false` untuk menonaktifkan
- ✅ Student self-service: check-in, check-out, today, history
  (`/api/student-attendance/*`) — butuh token role `student`, 403 untuk
  role lain
- ✅ Status present/late saat check-in dihitung otomatis dari
  `school_settings.school_start_time`, dalam timezone Asia/Jakarta
- ✅ Double check-in / check-out di hari yang sama ditolak (409), termasuk
  aman dari race condition (UNIQUE constraint di DB sebagai garda terakhir)
- ✅ Teacher self-service: today-schedules, check-in, history
  (`/api/teacher-attendance/*`) — butuh token role `teacher`
- ✅ Parent self-service: daftar anak, absensi hari ini & riwayat per anak
  (`/api/parent/*`) — butuh token role `parent`, cek kepemilikan anak
- ✅ Notifikasi email ke parent saat siswa check-in/check-out (Phase 12)
  — fire-and-forget, di-log ke `notification_logs`

Yang **belum** ada (jangan bingung kalau endpoint-nya belum ada):
rekap admin/teacher, QR, GPS validasi — menyusul di phase berikutnya.

## 1. Siapkan environment

```bash
cd idn-attendance-api
npm install
cp .env.example .env
```

Isi `.env`:

```env
DB_HOST=<dari Railway>
DB_PORT=<dari Railway>
DB_USER=<dari Railway>
DB_PASSWORD=<dari Railway>
DB_NAME=<dari Railway>
JWT_SECRET=isi-string-acak-panjang-bebas
JWT_EXPIRES_IN=7d
```

Generate `JWT_SECRET` cepat via terminal:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2. Import schema ke Railway (kalau belum)

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p<DB_PASSWORD> <DB_NAME> < database/schema.sql
```

Ini otomatis membuat 1 admin demo:
- Email: `admin@demo.idn.sch.id`
- Password: `Admin123!`

## 3. Jalankan server

```bash
npm run dev
```

Harus muncul: `IDN Attendance API berjalan di http://localhost:3000`

## 4. Test dengan Postman

1. Buka Postman → **Import** → pilih file
   `idn-attendance-api.postman_collection.json` (ada di root project).
2. Jalankan request satu-satu sesuai urutan berikut:

| # | Request | Expected |
|---|---|---|
| 1 | `Health Check` | `200`, `success: true` |
| 2 | `Auth - Login (admin demo)` | `200`, dapat `data.token` — otomatis tersimpan ke variable `{{token}}` |
| 3 | `Auth - Login (wrong password)` | `401`, `success: false` |
| 4 | `Auth - Me (pakai token)` | `200`, dapat data profil admin |
| 5 | `Auth - Me tanpa token` | `401`, `message: "Token tidak ditemukan"` |

Token dari request #2 otomatis disimpan (lihat tab **Scripts → Post-response**
di request itu), jadi request #4 tidak perlu copy-paste manual.

## 5. Test manual pakai curl (alternatif kalau tidak pakai Postman)

```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.idn.sch.id","password":"Admin123!"}'

# Simpan token dari response di atas, lalu:
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <TOKEN_DISINI>"
```

## Troubleshooting cepat

| Gejala | Kemungkinan penyebab |
|---|---|
| Server tidak start, error `ECONNREFUSED` saat login | `.env` DB_* salah, atau Railway MySQL belum aktif/tidak bisa diakses dari luar (cek Public Networking di Railway) |
| Login selalu `401` walau password benar | Schema belum di-import, atau baris DEMO DATA admin belum ke-insert — cek `SELECT * FROM users;` |
| `GET /api/auth/me` selalu `401` walau sudah login | Pastikan header `Authorization` formatnya `Bearer <token>` (ada spasi setelah `Bearer`) |
| Error `JWT_SECRET is not defined` / token gagal signed | `.env` belum diisi `JWT_SECRET`, atau server belum di-restart setelah edit `.env` |

Kalau ada error yang tidak masuk daftar di atas, kirim pesan errornya —
jangan langsung diubah arsitekturnya, kita analisis dulu penyebabnya.

## 6. Test Notifikasi Email ke Parent (Phase 12)

### Prerequisite

Pastikan `.env` sudah diisi section EMAIL:
```env
EMAIL_PROVIDER=smtp
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-16-char-app-password
EMAIL_FROM=noreply@idn.sch.id
```

Kalau belum punya App Password, buat dulu di
<https://myaccount.google.com/apppasswords> (butuh 2FA aktif).

### Test flow: check-in sebagai student → cek notification_logs

1. **Login sebagai student**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"student@demo.idn.sch.id","password":"Student123!"}'
   ```
   Simpan token dari response.

2. **Hapus absensi hari ini** (supaya bisa check-in ulang):
   ```sql
   DELETE FROM student_attendance
   WHERE student_id = (SELECT id FROM students WHERE nis = '2026001')
   AND date = CURDATE();
   ```

3. **Check-in**:
   ```bash
   curl -X POST http://localhost:3000/api/student-attendance/check-in \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Expected: `200`, response berisi data absensi hari ini.

4. **Cek notification_logs**:
   ```sql
   SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;
   ```
   Expected:
   - Minimal 1 baris `type = 'STUDENT_CHECK_IN'`
   - `recipient` = email parent (`parent@demo.idn.sch.id`)
   - `status` = `'success'` (kalau email berhasil) atau `'failed'` (kalau
     provider belum dikonfigurasi — lihat `error_message`)
   - Kalau check-in setelah `school_start_time` (terlambat), ada tambahan
     1 baris `type = 'STUDENT_LATE'`

5. **Check-out**:
   ```bash
   curl -X POST http://localhost:3000/api/student-attendance/check-out \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Cek `notification_logs` → ada baris baru `type = 'STUDENT_CHECK_OUT'`.

### Test toggle off

1. **Matikan notifikasi check-in** via admin:
   ```bash
   curl -X PUT http://localhost:3000/api/school-settings/notify_parent_on_check_in \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"setting_value": "false"}'
   ```

2. **Hapus absensi hari ini** (step 2 di atas), lalu check-in lagi.

3. **Cek notification_logs** → TIDAK ada baris baru `STUDENT_CHECK_IN`
   (toggle off = skip tanpa log).

4. **Nyalakan kembali** setelah test:
   ```bash
   curl -X PUT http://localhost:3000/api/school-settings/notify_parent_on_check_in \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"setting_value": "true"}'
   ```

### Test tanpa konfigurasi email

Kalau `EMAIL_SMTP_USER` / `EMAIL_SMTP_PASS` dikosongkan di `.env`:
- Check-in tetap berhasil (response 200)
- `notification_logs` berisi baris `status = 'failed'` dengan
  `error_message` = "Email provider belum dikonfigurasi..."
- Server **tidak** crash atau return error ke client
