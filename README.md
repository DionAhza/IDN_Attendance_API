# IDN Attendance API

REST API absensi untuk IDN Boarding School (siswa & guru), dikonsumsi oleh
React Web dan React + Capacitor.

Status: **Phase 1–14 selesai** — scaffold, schema database, koneksi DB,
Authentication, **Admin CRUD master data** (classes, subjects, teachers,
students, schedules, school_settings), **Student self-service attendance**
(check-in/check-out/today/history), **Teacher self-service attendance**
(today-schedules/check-in/history), **Parent self-service** (read-only:
daftar anak, absensi hari ini & riwayat per anak), **Notifikasi multi-channel
ke parent** (email + WhatsApp via Fonnte, otomatis saat siswa
check-in/check-out/terlambat), **GPS geofencing** (tolak absen di luar
radius sekolah), dan **Face verification** (verifikasi wajah wajib saat
check-in/out kalau diaktifkan, dengan mekanisme override admin/guru +
audit trail) sudah jalan. Lihat
`docs/PHASE1-analisis-arsitektur.md` untuk roadmap lengkap (catatan:
urutan phase 8+ di roadmap tersebut sudah direvisi — Admin CRUD
didahulukan sebelum self-service, lihat riwayat project) dan
`docs/TESTING.md` untuk cara test progress saat ini.

## Cara test progress saat ini

Lihat `docs/TESTING.md` untuk panduan lengkap (setup .env, import schema,
Postman collection). Ringkas:

```bash
npm install
cp .env.example .env    # isi DB_HOST dst dari Railway, dan JWT_SECRET
mysql -h <host> -P <port> -u <user> -p<pass> <db> < database/schema.sql
npm run dev
```

Lalu import `idn-attendance-api.postman_collection.json` ke Postman dan
jalankan request-nya satu per satu (Health Check → Login → Me).

## Import schema.sql ke Railway

1. Buat MySQL service baru di Railway (New Project → Database → MySQL).
2. Buka tab **Data** di service tersebut, atau connect via CLI:
   ```bash
   mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> <MYSQLDATABASE> < database/schema.sql
   ```
3. Verifikasi 12 tabel sudah terbentuk (`users`, `classes`, `subjects`,
   `teachers`, `students`, `parents`, `parent_students`, `schedules`,
   `student_attendance`, `teacher_attendance`, `school_settings`,
   `notification_logs`).
4. Blok **DEMO DATA** di bagian bawah `schema.sql` berisi 1 admin dengan
   password hash placeholder (`$2a$10$REPLACE_WITH_REAL_BCRYPT_HASH`) —
   **jangan dipakai apa adanya**. Generate hash bcrypt asli setelah Phase 7
   (auth) selesai, atau hapus blok DEMO DATA sebelum deploy production.

## Cara menjalankan (scaffold saat ini)

```bash
npm install
cp .env.example .env
npm run dev
```

Buka `http://localhost:3000/api/health` — harus muncul:

```json
{
  "success": true,
  "message": "IDN Attendance API is running",
  "data": { "timestamp": "..." }
}
```

Kalau ini sudah jalan, scaffold-nya sudah benar. Belum ada endpoint lain
yang aktif — itu wajar di tahap ini.

## Endpoint Admin CRUD (Phase 8)

Semua endpoint di bawah ini butuh header `Authorization: Bearer <token>`
dari admin (`POST /api/auth/login`), dan hanya bisa diakses role `admin`
(403 kalau role lain).

| Resource | Endpoint | Catatan |
|---|---|---|
| Classes | `GET/POST /api/classes`, `GET/PATCH/DELETE /api/classes/:id` | `DELETE` ditolak (409) kalau masih dipakai siswa/jadwal — nonaktifkan saja |
| Subjects | `GET/POST /api/subjects`, `GET/PATCH/DELETE /api/subjects/:id` | Sama seperti classes, ditolak kalau masih dipakai jadwal |
| Teachers | `GET/POST /api/teachers`, `GET/PATCH/DELETE /api/teachers/:id` | Create sekaligus bikin akun `users` (role teacher); update bisa reset email/password |
| Students | `GET/POST /api/students`, `GET/PATCH/DELETE /api/students/:id` | Sama seperti teachers; list bisa difilter `?class_id=` |
| Schedules | `GET/POST /api/schedules`, `GET/PATCH/DELETE /api/schedules/:id` | Otomatis dicek bentrok jadwal (guru & kelas) di hari/jam yang sama sebelum disimpan; list bisa difilter `?teacher_id=&class_id=&day=` |
| School Settings | `GET /api/school-settings`, `GET/PUT/DELETE /api/school-settings/:key` | `PUT` = upsert by key (bikin baru kalau belum ada); key inti sistem (jam masuk, GPS, dst) tidak bisa dihapus |

Endpoint list (`GET` koleksi) mendukung `?page=&limit=&search=` dan
mengembalikan `meta: { page, limit, total, total_pages }` di response,
terpisah dari `data`.

## Endpoint Student Self-Service (Phase 9)

Butuh token role `student` (401 tanpa token, 403 kalau role lain).
`student_id` **selalu** diambil dari token, tidak pernah dari body — siswa
tidak bisa absen atas nama siswa lain.

| Endpoint | Catatan |
|---|---|
| `POST /api/student-attendance/check-in` | Body opsional: `latitude`, `longitude`, `accuracy`, `notes`. Status `present`/`late` ditentukan otomatis dari `school_settings.school_start_time`. Ditolak (409) kalau sudah check-in hari ini |
| `POST /api/student-attendance/check-out` | Ditolak (409) kalau belum check-in hari ini, atau sudah check-out |
| `GET /api/student-attendance/today` | Data absensi hari ini (atau `check_in: null` kalau belum absen) |
| `GET /api/student-attendance/history?page=&limit=&date_from=&date_to=` | Riwayat absensi sendiri, terpaginasi |

Catatan implementasi: **notifikasi ke parent sudah aktif (Phase 12)** — setiap
check-in/check-out otomatis kirim email ke semua parent yang terhubung via
`parent_students` (best-effort, tidak menggagalkan response absensi). Toggle
on/off per jenis notifikasi bisa diatur via `school_settings` (lihat section
Phase 12 di bawah). Validasi radius GPS belum aktif (Phase 14); koordinat
yang dikirim disimpan apa adanya untuk sekarang.

## Endpoint Teacher Self-Service (Phase 10)

Butuh token role `teacher` (401 tanpa token, 403 kalau role lain).
`teacher_id` **selalu** diambil dari token, tidak pernah dari body.

Beda penting dari Student self-service: `teacher_attendance` itu
**per-jadwal per-hari** (unique key `schedule_id + date`), bukan per-guru-
per-hari — satu guru bisa punya beberapa sesi mengajar dalam sehari,
masing-masing diabsen terpisah. Tabelnya juga cuma punya `check_in` (tidak
ada `check_out`) — absen guru = "hadir di sesi ini", bukan "masuk/pulang
sekolah".

| Endpoint | Catatan |
|---|---|
| `GET /api/teacher-attendance/today-schedules` | Jadwal guru **hari ini** (berdasarkan hari WIB sekarang, `is_active=1`), masing-masing digabung status absennya (`attendance: null` kalau belum) |
| `POST /api/teacher-attendance/check-in` | Body wajib: `schedule_id`. Opsional: `latitude`, `longitude`, `notes`. Ditolak (403) kalau jadwal bukan milik guru ini, (409) kalau jadwal untuk hari lain/nonaktif/sudah diabsen hari ini. Status `present`/`late` dari `start_time` jadwal + toleransi menit (`school_settings.teacher_late_tolerance_minutes`, default 10) |
| `GET /api/teacher-attendance/history?page=&limit=&date_from=&date_to=&schedule_id=` | Riwayat absen sendiri, terpaginasi, bisa difilter per jadwal |

Catatan migrasi: key `teacher_late_tolerance_minutes` baru ditambahkan ke
`school_settings` seed. Kalau database sudah ada dari sebelum Phase 10 dan
belum di-reimport, endpoint tetap jalan dengan fallback default 10 menit di
kode — tapi supaya kelihatan & bisa diubah dari admin panel, insert manual:
```sql
INSERT INTO school_settings (setting_key, setting_value, description) VALUES
('teacher_late_tolerance_minutes', '10', 'Toleransi telat guru dalam menit dari start_time jadwal');
```

## Endpoint Parent Self-Service (Phase 11)

Butuh token role `parent`. **Read-only** — parent tidak absen sendiri.
`parent_id` selalu dari token; kepemilikan `studentId` di URL selalu
dicek lewat tabel `parent_students` (403 kalau bukan anaknya — anti-IDOR).

| Endpoint | Catatan |
|---|---|
| `GET /api/parent/children` | Daftar anak (nama, NIS, kelas, `relationship_type`) milik parent yang login |
| `GET /api/parent/children/:studentId/attendance/today` | Status absen hari ini anak tsb |
| `GET /api/parent/children/:studentId/attendance/history?page=&limit=&date_from=&date_to=` | Riwayat absen anak tsb, terpaginasi |

## Notifikasi Email ke Parent (Phase 12)

Setiap kali siswa check-in atau check-out, sistem otomatis mengirim email ke
**semua** parent yang terhubung ke siswa tersebut di tabel `parent_students`.

### Cara kerja

1. **Fire-and-forget** — pengiriman email tidak mempengaruhi response absensi.
   Kalau email gagal terkirim (provider down, kredensial salah, dll), siswa
   tetap mendapat response sukses. Error dicatat ke tabel `notification_logs`.
2. **Toggle per jenis** — admin bisa mematikan notifikasi tertentu via
   `school_settings`:
   - `notify_parent_on_check_in` — email saat check-in
   - `notify_parent_on_check_out` — email saat check-out
   - `notify_parent_on_late` — email tambahan kalau siswa terlambat
   - `notify_parent_on_absent` — (belum aktif, butuh cron job terpisah)
3. **Dua notifikasi saat terlambat** — kalau siswa check-in terlambat, sistem
   kirim `STUDENT_CHECK_IN` DAN `STUDENT_LATE` (masing-masing bisa di-toggle
   sendiri).

### Setup email (Gmail App Password)

1. Nyalakan **2-Step Verification** di akun Google.
2. Buka <https://myaccount.google.com/apppasswords> → buat App Password.
3. Isi `.env`:
   ```env
   EMAIL_PROVIDER=smtp
   EMAIL_SMTP_HOST=smtp.gmail.com
   EMAIL_SMTP_PORT=587
   EMAIL_SMTP_USER=your-email@gmail.com
   EMAIL_SMTP_PASS=your-16-char-app-password
   EMAIL_FROM=noreply@idn.sch.id
   ```
4. Kalau `EMAIL_SMTP_USER`/`EMAIL_SMTP_PASS` kosong, notifikasi tetap jalan
   tapi di-log sebagai `failed` tanpa crash.

### Monitoring

Cek tabel `notification_logs` untuk melihat riwayat pengiriman:
```sql
SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 20;
```

## Struktur folder

```
src/
  config/       -> koneksi DB (Phase 6), school settings (Phase 9)
  controllers/  -> mulai Phase 7
  services/     -> mulai Phase 9, notification Phase 12
  routes/       -> mulai Phase 7
  middleware/   -> auth & role middleware, Phase 7
  validators/   -> skema Zod, mulai Phase 8
  utils/        -> helper umum
  app.js        -> boot Express + middleware inti (sudah ada)
  server.js     -> entry point (sudah ada)
database/
  schema.sql    -> akan diisi Phase 4
docs/
  api.md        -> dokumentasi endpoint, diisi bertahap
tests/          -> Jest + Supertest, Phase 16
```

## Dependency yang sudah disiapkan (semua gratis/open-source)

- `express` — web framework
- `mysql2` — MySQL client (prepared statements)
- `jsonwebtoken` — JWT auth
- `bcryptjs` — hashing password (pure JS, aman untuk Vercel serverless —
  tidak butuh native compile seperti `bcrypt`)
- `zod` — validasi input
- `helmet`, `cors`, `express-rate-limit` — security dasar
- `dotenv` — environment variable
- `nodemailer` — kirim email via SMTP (Phase 12)
- `jest`, `supertest`, `nodemon` — dev/testing

## Belum termasuk (menyusul per phase)

- Rekap/laporan absensi untuk admin & guru (dashboard/export)
- Security review menyeluruh (Phase 15)
- `vercel.json` & panduan deploy (Phase 17)
- Cron job `STUDENT_ABSENT` (notifikasi siswa yang tidak hadir tanpa check-in sama sekali)

## Catatan

File `.env` **tidak** boleh di-commit ke Git (sudah masuk `.gitignore`).
Isi `.env` kamu sendiri berdasarkan `.env.example` setelah masing-masing
phase terkait selesai (misal `DB_*` setelah Phase 6, `JWT_SECRET` setelah
Phase 7, dst).
