# IDN Attendance API

REST API absensi untuk IDN Boarding School (siswa & guru), dikonsumsi oleh
React Web dan React + Capacitor.

Status: **Phase 1–9 selesai** — scaffold, schema database, koneksi DB,
Authentication, **Admin CRUD master data** (classes, subjects, teachers,
students, schedules, school_settings), dan **Student self-service attendance**
(check-in/check-out/today/history) sudah jalan. Teacher self-service
(Phase 10-11) menyusul berikutnya. Lihat
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

Catatan implementasi: notifikasi ke parent (`NotificationService`) **belum**
aktif — sudah ditandai `TODO(Phase 12)` di `studentAttendance.service.js`,
menyusul setelah provider email diputuskan. Validasi radius GPS juga belum
aktif (Phase 14); koordinat yang dikirim disimpan apa adanya untuk sekarang.

## Struktur folder

```
src/
  config/       -> koneksi DB (Phase 6), school settings (Phase 9)
  controllers/  -> mulai Phase 7
  services/     -> mulai Phase 9
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
- `jest`, `supertest`, `nodemon` — dev/testing

## Belum termasuk di scaffold ini (menyusul per phase)

- Koneksi database (Phase 6)
- Auth & middleware (Phase 7)
- Endpoint students/schedules/attendance (Phase 8–11)
- Notification service (Phase 12)
- QR Code (Phase 13)
- GPS/geofencing (Phase 14)
- `vercel.json` & panduan deploy (Phase 17)

## Catatan

File `.env` **tidak** boleh di-commit ke Git (sudah masuk `.gitignore`).
Isi `.env` kamu sendiri berdasarkan `.env.example` setelah masing-masing
phase terkait selesai (misal `DB_*` setelah Phase 6, `JWT_SECRET` setelah
Phase 7, dst).
