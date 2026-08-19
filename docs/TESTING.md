# Panduan Testing Lengkap — IDN Attendance API

Dokumen ini mencakup cara test **semua fitur yang sudah diimplementasikan**
(Phase 1–14): auth, admin CRUD, self-service student/teacher/parent,
notifikasi email + WhatsApp, GPS geofencing, dan face verification.

Semua contoh pakai `curl`. Kalau lebih suka Postman, import
`idn-attendance-api.postman_collection.json` (ada di root project) dan
ikuti urutan section yang sama — variable `{{token}}` di collection akan
terisi otomatis setelah request login.

---

## 0. Ringkasan Endpoint

| Modul | Base path | Role yang boleh akses |
|---|---|---|
| Health check | `GET /api/health` | publik |
| Auth | `/api/auth/*` | publik (login) / semua role (me) |
| Admin CRUD | `/api/classes`, `/api/subjects`, `/api/teachers`, `/api/students`, `/api/schedules`, `/api/school-settings` | admin |
| Student self-service | `/api/student-attendance/*` | student |
| Teacher self-service | `/api/teacher-attendance/*` | teacher |
| Parent self-service (read-only) | `/api/parent/*` | parent |
| Face verification | `/api/face-verification/*` | student (enroll/verify punya sendiri), admin/teacher (kelola siswa lain, override) |

Semua response memakai format konsisten:
```json
{ "success": true|false, "message": "...", "data": ..., "meta": { ... } }
```
`meta` hanya muncul di endpoint list yang dipaginasi.

---

## 1. Setup Awal

```bash
cd idn-attendance-api
npm install
cp .env.example .env
```

Isi minimal di `.env` supaya server bisa start:

```env
DB_HOST=<dari Railway>
DB_PORT=<dari Railway>
DB_USER=<dari Railway>
DB_PASSWORD=<dari Railway>
DB_NAME=<dari Railway>
JWT_SECRET=isi-string-acak-panjang-bebas
JWT_EXPIRES_IN=7d
```

Generate `JWT_SECRET` cepat:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> ⚠️ **Jangan pakai token/kredensial contoh apa pun yang pernah terlihat di
> repo/chat sebagai kredensial asli** — kalau ada token yang pernah
> ter-commit, anggap sudah bocor dan buat token baru di dashboard provider
> terkait (mis. Fonnte), lalu isi hanya di `.env` lokal (tidak di-commit).

## 2. Import Schema ke Database

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p<DB_PASSWORD> <DB_NAME> < database/schema.sql
```

Ini akan membuat 12 tabel + **DEMO DATA** (akun demo untuk keempat role,
1 kelas, 1 mapel, 1 jadwal guru untuk semua hari kerja, dan
`school_settings` default). Verifikasi:

```sql
SHOW TABLES;
-- Harus ada 12 tabel: users, classes, subjects, teachers, students,
-- parents, parent_students, schedules, student_attendance,
-- teacher_attendance, school_settings, notification_logs,
-- student_face_encodings, face_override_logs
```

**Akun demo** (password sama untuk semua, lihat schema.sql):

| Role | Email | Password |
|---|---|---|
| admin | `admin@demo.idn.sch.id` | `Admin123!` |
| teacher | `teacher@demo.idn.sch.id` | `Teacher123!` |
| student | `student@demo.idn.sch.id` | `Student123!` |
| parent | `parent@demo.idn.sch.id` | `Parent123!` |

Siswa demo (NIS `2026001`, nama Ahmad Fauzi) sudah terhubung ke parent
demo, dan guru demo sudah punya jadwal mengajar kelas `X RPL A` setiap
Senin–Jumat jam 07:00–08:30 — jadi endpoint teacher-attendance & parent
bisa langsung dites tanpa setup tambahan.

> ⚠️ Blok **DEMO DATA** ditandai jelas di `schema.sql` — **hapus atau
> ganti password sebelum deploy ke production sekolah sungguhan**.

## 3. Jalankan Server

```bash
npm run dev
```

Harus muncul: `IDN Attendance API berjalan di http://localhost:3000`

```bash
curl http://localhost:3000/api/health
```
Expected: `200`, `{"success":true,"message":"IDN Attendance API is running",...}`

## 4. Jalankan Unit Test

```bash
npm test
```
Expected: semua test lulus (saat ini 35 test — cosine similarity, geo
Haversine, notification service).

---

## 5. Testing: Authentication

```bash
# Login admin — simpan token dari response untuk step-step berikutnya
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.idn.sch.id","password":"Admin123!"}'
```
Expected: `200`, `data.token` berisi JWT, `data.user.role = "admin"`.

```bash
export ADMIN_TOKEN="<token dari response di atas>"
```

| # | Test | Cara | Expected |
|---|---|---|---|
| 1 | Login salah password | body `password: "salah"` | `401`, `success:false` |
| 2 | Login email tidak terdaftar | body email asal | `401` |
| 3 | `GET /api/auth/me` dengan token | header `Authorization: Bearer $ADMIN_TOKEN` | `200`, profil admin |
| 4 | `GET /api/auth/me` tanpa token | tanpa header | `401`, `"Token tidak ditemukan"` |
| 5 | `GET /api/auth/me` token asal-asalan | `Authorization: Bearer xxx` | `401`, `"Token tidak valid atau kadaluarsa"` |

```bash
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $ADMIN_TOKEN"
```

Login juga sebagai 3 role lain dan simpan token-nya untuk section
berikutnya:
```bash
export TEACHER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@demo.idn.sch.id","password":"Teacher123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

export STUDENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@demo.idn.sch.id","password":"Student123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

export PARENT_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"parent@demo.idn.sch.id","password":"Parent123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
```

---

## 6. Testing: Admin CRUD Master Data

Pola sama untuk `classes`, `subjects`, `teachers`, `students`,
`schedules`, `school-settings` — semua butuh `Authorization: Bearer
$ADMIN_TOKEN`, role lain dapat `403`.

### 6.1 Cek proteksi role (lakukan untuk salah satu, cukup mewakili semua)
```bash
curl http://localhost:3000/api/classes -H "Authorization: Bearer $STUDENT_TOKEN"
```
Expected: `403`, `"Anda tidak memiliki akses untuk aksi ini"`.

### 6.2 Classes
```bash
# List (dipaginasi)
curl "http://localhost:3000/api/classes?page=1&limit=10" -H "Authorization: Bearer $ADMIN_TOKEN"

# Create
curl -X POST http://localhost:3000/api/classes \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"XI RPL B","level":"XI"}'
# -> 200, data kelas baru dengan id

# Create nama duplikat -> 409
curl -X POST http://localhost:3000/api/classes \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"XI RPL B"}'
# -> 409 "Data sudah ada (duplikat)"

# Get by id, Update (PATCH), Delete — ganti :id sesuai hasil create
curl http://localhost:3000/api/classes/2 -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X PATCH http://localhost:3000/api/classes/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"level":"XI-Baru"}'
curl -X DELETE http://localhost:3000/api/classes/2 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 6.3 Subjects
Sama seperti classes, field: `name`, `code` (unique).

### 6.4 Teachers & Students
Create sekaligus membuat baris di `users` (role terkait) + tabel profil,
dalam satu transaksi:
```bash
curl -X POST http://localhost:3000/api/teachers \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"guru2@demo.idn.sch.id","password":"Guru12345!","full_name":"Siti Aminah","nip":"199001012026002"}'

curl -X POST http://localhost:3000/api/students \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"siswa2@demo.idn.sch.id","password":"Siswa12345!","nis":"2026002","full_name":"Budi Santoso","class_id":1}'
```
Test tambahan:
- Email/NIS duplikat → `409`.
- `class_id` tidak ada → `422 "class_id tidak valid"`.
- `DELETE` siswa yang **sudah punya riwayat absensi** → `409` (pakai
  `is_active=false` lewat PATCH, bukan delete) — coba setelah siswa
  demo check-in (lihat section 7).

### 6.5 Schedules
```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"teacher_id":1,"class_id":1,"subject_id":1,"day":"monday","start_time":"09:00","end_time":"10:00"}'
```
Test bentrok jadwal (guru/kelas sama, jam overlap di hari sama) → `409`:
```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"teacher_id":1,"class_id":1,"subject_id":1,"day":"monday","start_time":"07:00","end_time":"08:00"}'
# -> 409 "Guru sudah punya jadwal lain yang bentrok..."
```
Test `end_time <= start_time` → `422` (validasi Zod, sebelum ke DB).

### 6.6 School Settings
```bash
curl http://localhost:3000/api/school-settings -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X PUT http://localhost:3000/api/school-settings/school_start_time \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"setting_value":"07:00:00"}'

# Coba hapus key yang di-protect sistem -> 409
curl -X DELETE http://localhost:3000/api/school-settings/gps_validation_enabled \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# -> 409 "Key ini dipakai langsung oleh sistem dan tidak boleh dihapus..."
```
Key yang dilindungi (tidak bisa di-`DELETE`, hanya bisa diubah nilainya):
`school_start_time`, `gps_validation_enabled`, `school_latitude`,
`school_longitude`, `school_radius_meters`, `notify_parent_on_check_in`,
`notify_parent_on_check_out`, `notify_parent_on_late`,
`notify_parent_on_absent`, `teacher_late_tolerance_minutes`,
`face_verification_enabled`, `face_match_threshold`.

---

## 7. Testing: Student Self-Service Attendance

Semua endpoint butuh `Authorization: Bearer $STUDENT_TOKEN`.

```bash
# Belum absen -> check_in null
curl http://localhost:3000/api/student-attendance/today -H "Authorization: Bearer $STUDENT_TOKEN"

# Check-in
curl -X POST http://localhost:3000/api/student-attendance/check-in \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" \
  -d '{}'
# -> 200, status "present" kalau sebelum school_start_time, "late" kalau setelahnya

# Check-in lagi di hari yang sama -> 409
curl -X POST http://localhost:3000/api/student-attendance/check-in \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" -d '{}'
# -> 409 "Sudah absen masuk hari ini"

# Check-out sebelum check-in (pakai siswa lain yang belum check-in) -> 409
# Check-out normal
curl -X POST http://localhost:3000/api/student-attendance/check-out \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" -d '{}'

# History
curl "http://localhost:3000/api/student-attendance/history?page=1&limit=5" \
  -H "Authorization: Bearer $STUDENT_TOKEN"

# History dengan filter tanggal
curl "http://localhost:3000/api/student-attendance/history?date_from=2026-08-01&date_to=2026-08-31" \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

**Reset untuk ulang test** (hapus absensi hari ini di DB):
```sql
DELETE FROM student_attendance
WHERE student_id = (SELECT id FROM students WHERE nis = '2026001') AND date = CURDATE();
```

**Test status telat**: ubah `school_start_time` ke waktu yang sudah
lewat (mis. jam 1 dini hari), reset absensi, lalu check-in lagi →
`check_in_status` harus `"late"`.

---

## 8. Testing: Teacher Self-Service Attendance

Butuh `Authorization: Bearer $TEACHER_TOKEN`. Karena guru demo punya
jadwal Senin–Jumat 07:00–08:30, test ini **hanya jalan penuh di hari
kerja** (Sabtu/Minggu, `today-schedules` akan kosong — itu perilaku
yang benar, bukan bug).

```bash
# Jadwal hari ini + status absen tiap sesi
curl http://localhost:3000/api/teacher-attendance/today-schedules \
  -H "Authorization: Bearer $TEACHER_TOKEN"
# catat schedule_id dari response untuk check-in di bawah

curl -X POST http://localhost:3000/api/teacher-attendance/check-in \
  -H "Authorization: Bearer $TEACHER_TOKEN" -H "Content-Type: application/json" \
  -d '{"schedule_id": 1}'

# Check-in ulang jadwal yang sama, hari yang sama -> 409
curl -X POST http://localhost:3000/api/teacher-attendance/check-in \
  -H "Authorization: Bearer $TEACHER_TOKEN" -H "Content-Type: application/json" \
  -d '{"schedule_id": 1}'

# Check-in pakai schedule_id milik guru lain -> 403 "Jadwal ini bukan milik Anda"

curl "http://localhost:3000/api/teacher-attendance/history?page=1" \
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

**Reset**: `DELETE FROM teacher_attendance WHERE schedule_id = 1 AND date = CURDATE();`

**Test toleransi telat**: ubah setting `teacher_late_tolerance_minutes`,
reset, check-in setelah `start_time + toleransi` → status `"late"`.

---

## 9. Testing: Parent Self-Service (Read-Only)

Butuh `Authorization: Bearer $PARENT_TOKEN`.

```bash
# Daftar anak
curl http://localhost:3000/api/parent/children -H "Authorization: Bearer $PARENT_TOKEN"
# catat student_id (harus 1, NIS 2026001, sudah di-link di demo data)

curl http://localhost:3000/api/parent/children/1/attendance/today \
  -H "Authorization: Bearer $PARENT_TOKEN"

curl "http://localhost:3000/api/parent/children/1/attendance/history?page=1" \
  -H "Authorization: Bearer $PARENT_TOKEN"
```

**Test IDOR (paling penting)** — parent tidak boleh bisa lihat anak
yang bukan miliknya walau tebak ID:
```bash
curl http://localhost:3000/api/parent/children/999/attendance/today \
  -H "Authorization: Bearer $PARENT_TOKEN"
# -> 403 "Anak ini bukan terdaftar sebagai anak Anda" (bukan data anak lain, bukan 404)
```

---

## 10. Testing: Notifikasi (Email + WhatsApp)

### 10.1 Setup Email (SMTP Gmail)
Isi di `.env`:
```env
EMAIL_PROVIDER=smtp
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-16-char-app-password
EMAIL_FROM=noreply@idn.sch.id
```
App Password: <https://myaccount.google.com/apppasswords> (butuh 2FA aktif).

### 10.2 Setup WhatsApp (Fonnte) — opsional
```env
NOTIFICATION_CHANNELS=email,whatsapp
FONNTE_TOKEN=<token device dari dashboard fonnte.com — JANGAN commit ke Git>
```
Nomor tujuan diambil dari `parents.phone` (format Indonesia, boleh
diawali `0` atau `62`, dirapikan otomatis).

> Kalau field `NOTIFICATION_CHANNELS` diisi manual, pastikan nama
> channel-nya **persis** `whatsapp` (bukan singkatan) — nama yang tidak
> dikenali akan disaring diam-diam dan channel itu tidak akan aktif.

### 10.3 Test alur: check-in → cek notification_logs

1. Restart server setelah ubah `.env`.
2. Reset absensi hari ini (lihat section 7), lalu check-in sebagai student.
3. Cek log:
   ```sql
   SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;
   ```
   Expected:
   - Baris `type='STUDENT_CHECK_IN'`, `provider='smtp'` (dan/atau
     `provider='fonnte'` kalau WhatsApp aktif), `status='success'` atau
     `'failed'` (lihat `error_message` kalau gagal).
   - Kalau check-in setelah `school_start_time` → ada tambahan baris
     `type='STUDENT_LATE'`.
4. Check-out → baris baru `type='STUDENT_CHECK_OUT'`.

### 10.4 Test toggle notifikasi

```bash
curl -X PUT http://localhost:3000/api/school-settings/notify_parent_on_check_in \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"setting_value": "false"}'
```
Reset absensi, check-in lagi → **tidak ada** baris baru
`STUDENT_CHECK_IN` di `notification_logs` (toggle off = skip tanpa log).
Jangan lupa nyalakan kembali (`"setting_value": "true"`) setelah test.

### 10.5 Test tanpa konfigurasi provider

Kosongkan `EMAIL_SMTP_USER`/`EMAIL_SMTP_PASS` (dan/atau `FONNTE_TOKEN`):
- Check-in **tetap berhasil** (`200`) — notifikasi best-effort, tidak
  boleh menggagalkan absensi.
- `notification_logs` berisi baris `status='failed'` dengan
  `error_message` menjelaskan provider belum dikonfigurasi.
- Server **tidak** crash.

---

## 11. Testing: GPS Geofencing

### 11.1 Aktifkan & konfigurasi
```bash
curl -X PUT http://localhost:3000/api/school-settings/gps_validation_enabled \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"setting_value":"true"}'

curl -X PUT http://localhost:3000/api/school-settings/school_latitude \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"setting_value":"-6.200000"}'

curl -X PUT http://localhost:3000/api/school-settings/school_longitude \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"setting_value":"106.816666"}'

curl -X PUT http://localhost:3000/api/school-settings/school_radius_meters \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"setting_value":"200"}'
```
(cache setting TTL 1 menit tapi langsung di-invalidate tiap upsert, jadi
tidak perlu tunggu.)

### 11.2 Test kasus
Reset absensi hari ini sebelum tiap percobaan.

| # | latitude/longitude dikirim | Expected |
|---|---|---|
| 1 | Tidak dikirim sama sekali (`{}`) | `422` — "Lokasi (latitude & longitude) wajib diisi karena validasi GPS sedang aktif" |
| 2 | Sama persis dengan titik sekolah | `200`, `check_in_distance_meters` ≈ `0` |
| 3 | Titik jauh (mis. lat `-6.9` — beda kota) | `403` — "Lokasi di luar radius sekolah (jarak: ... m, ...)" |
| 4 | Titik dalam radius (geser sedikit, < 200m) | `200`, berhasil |

Contoh request titik dalam radius sekolah (sama persis):
```bash
curl -X POST http://localhost:3000/api/student-attendance/check-in \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"latitude": -6.200000, "longitude": 106.816666, "accuracy": 10}'
```
Contoh titik di luar radius:
```bash
curl -X POST http://localhost:3000/api/student-attendance/check-in \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"latitude": -6.900000, "longitude": 107.600000}'
```

### 11.3 Test lokasi sekolah belum dikonfigurasi
Set `gps_validation_enabled=true` tapi `school_latitude`/`school_longitude`
dikosongkan → `500` (kesalahan konfigurasi server, bukan kesalahan siswa) —
"Validasi GPS aktif tetapi lokasi sekolah ... belum dikonfigurasi admin".

### 11.4 Matikan kembali setelah test
```bash
curl -X PUT http://localhost:3000/api/school-settings/gps_validation_enabled \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"setting_value":"false"}'
```

---

## 12. Testing: Face Verification

> Vector encoding di bawah HANYA contoh angka untuk keperluan test API
> (server tidak tahu/tidak peduli itu benar-benar wajah atau bukan — yang
> divalidasi cuma bentuk array & panjang dimensi 10–512). Di aplikasi
> nyata, encoding ini dihasilkan model face recognition di sisi klien
> (mis. face-api.js), bukan ditulis manual.
>
> **Catatan perbaikan**: sebelumnya endpoint verify wajah berdiri sendiri
> dan TIDAK pernah dipanggil dari alur check-in/check-out, jadi
> `face_verification_enabled=true` tidak benar-benar mencegah siapa pun
> check-in tanpa verifikasi wajah. Ini sudah diperbaiki — sekarang
> `studentAttendance.service.js` menegakkan verifikasi wajah
> server-side (persis seperti pola GPS geofencing), termasuk alur
> override admin/guru. Section ini menguji perilaku yang sudah diperbaiki.

Simpan 2 vector 10-dimensi untuk test — "wajah A" (siswa) dan "wajah B"
(orang lain / percobaan gagal):
```bash
export FACE_A='[0.10,0.22,0.35,0.41,0.18,0.29,0.33,0.12,0.27,0.19]'
export FACE_A_SIMILAR='[0.11,0.21,0.36,0.40,0.19,0.28,0.34,0.13,0.26,0.20]'  # mirip A -> harus matched
export FACE_B='[0.90,0.05,0.88,0.02,0.91,0.03,0.87,0.01,0.92,0.04]'          # beda jauh -> harus gagal
```

### 12.1 Enroll wajah (siswa mendaftarkan wajah sendiri)
```bash
curl -X POST http://localhost:3000/api/face-verification/enroll \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"encoding\": $FACE_A, \"model\": \"face-api-v1\"}"
# -> 200, { enrolled: true, model: "face-api-v1", ... }
```
Test admin enroll atas nama siswa lain (wajib `studentId`):
```bash
curl -X POST http://localhost:3000/api/face-verification/enroll \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"studentId\": 1, \"encoding\": $FACE_A}"
```
Test enroll dengan encoding < 10 dimensi → `422` (validasi Zod).

### 12.2 Cek status enrollment
```bash
curl http://localhost:3000/api/face-verification/status -H "Authorization: Bearer $STUDENT_TOKEN"
curl http://localhost:3000/api/face-verification/status/1 -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 12.3 Verify mandiri (endpoint terpisah, tidak menulis absensi)
```bash
curl -X POST http://localhost:3000/api/face-verification/verify \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"encoding\": $FACE_A_SIMILAR}"
# -> matched: true, score tinggi

curl -X POST http://localhost:3000/api/face-verification/verify \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"encoding\": $FACE_B}"
# -> matched: false, score rendah
```

### 12.4 Aktifkan enforcement di check-in/check-out
```bash
curl -X PUT http://localhost:3000/api/school-settings/face_verification_enabled \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"setting_value":"true"}'
```
(Kalau perlu, sesuaikan juga `face_match_threshold`, default `0.6`.)

**Reset absensi hari ini sebelum tiap percobaan di bawah** (lihat section 7).

| # | Skenario | Request | Expected |
|---|---|---|---|
| 1 | Tidak kirim `faceEncoding` sama sekali, tidak ada override menggantung | `check-in` body `{}` | `422` — "faceEncoding wajib dikirim karena verifikasi wajah sedang aktif ..." |
| 2 | Wajah cocok | `check-in` body `{"faceEncoding": $FACE_A_SIMILAR}` | `200`, absen tercatat, `check_in_face_verified = 1` (cek lewat `GET /today`) |
| 3 | Wajah tidak cocok, belum ada override | `check-in` body `{"faceEncoding": $FACE_B}` | `403` — "Verifikasi wajah gagal (skor: ..., minimal: ...) — minta admin/guru melakukan override ..." |
| 4 | Siswa belum enroll sama sekali | siswa lain yang belum enroll, `check-in` dengan encoding apa pun | `403` — "Wajah belum terdaftar ..." |

```bash
# Skenario 2
curl -X POST http://localhost:3000/api/student-attendance/check-in \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" \
  -d "{\"faceEncoding\": $FACE_A_SIMILAR}"

curl http://localhost:3000/api/student-attendance/today -H "Authorization: Bearer $STUDENT_TOKEN"
# -> pastikan check_in_face_verified = 1
```

### 12.5 Override oleh admin/guru (saat verifikasi gagal tapi tetap diloloskan)

Reset absensi hari ini dulu. Alur: admin/guru catat override **sebelum**
siswa check-in (`attendanceId` belum ada) — override ini otomatis
berlaku untuk 1 percobaan check-in/out siswa tsb dalam 10 menit ke depan,
lalu otomatis ter-link ke baris attendance yang terbentuk:

```bash
curl -X POST http://localhost:3000/api/face-verification/override \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"studentId": 1, "attendanceType": "check_in", "similarityScore": 0.3, "reason": "Wajah tertutup masker, sudah dicek manual oleh guru piket"}'
# -> 201, tercatat di face_override_logs (attendance_id masih null)

# Siswa check-in TANPA perlu kirim faceEncoding yang cocok — override lolos otomatis
curl -X POST http://localhost:3000/api/student-attendance/check-in \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H "Content-Type: application/json" -d '{}'
# -> 200, absen tercatat dengan check_in_face_verified = 0 (artinya: lolos via override, bukan cocok)
```

Verifikasi audit trail — override log di atas sekarang ter-link ke
`attendance_id` yang baru dibuat:
```bash
curl http://localhost:3000/api/face-verification/override/1 -H "Authorization: Bearer $ADMIN_TOKEN"
# -> attendance_id pada log terisi (bukan null lagi)
```

Test tambahan:
- `reason` kosong/kurang dari 5 karakter → `422`.
- Role student memanggil endpoint override → `403` (hanya admin/teacher).
- Override lebih dari 10 menit sebelum siswa check-in → dianggap
  kadaluarsa, siswa tetap butuh `faceEncoding` yang cocok atau override
  baru.

### 12.6 Matikan kembali setelah test
```bash
curl -X PUT http://localhost:3000/api/school-settings/face_verification_enabled \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"setting_value":"false"}'
```

---

## Troubleshooting Cepat

| Gejala | Kemungkinan penyebab |
|---|---|
| Server tidak start, `ECONNREFUSED` saat login | `.env` DB_* salah, atau MySQL (Railway) belum aktif / Public Networking belum di-enable |
| Login selalu `401` walau password benar | Schema belum di-import, atau baris DEMO DATA belum ke-insert — cek `SELECT * FROM users;` |
| `GET /api/auth/me` selalu `401` | Header harus persis `Authorization: Bearer <token>` (ada spasi setelah `Bearer`) |
| Error `JWT_SECRET is not defined` | `.env` belum diisi `JWT_SECRET`, atau server belum di-restart setelah edit `.env` |
| GPS validation selalu `500` walau sudah di-set | Setting `school_latitude`/`school_longitude` mungkin ke-set jadi string kosong `""` bukan angka — cek `SELECT * FROM school_settings WHERE setting_key LIKE 'school_%';` |
| Face verification selalu `403 "Wajah belum terdaftar"` | Siswa belum pernah enroll (`POST /api/face-verification/enroll`), atau enroll dilakukan pakai token siswa lain |
| WhatsApp tidak pernah terkirim walau token sudah diisi | Cek `NOTIFICATION_CHANNELS` — nama channel harus persis `whatsapp`, bukan singkatan/typo; cek juga `parents.phone` sudah diisi |
| Notifikasi tidak terkirim tapi check-in tetap sukses | Ini **perilaku yang benar** (best-effort) — cek `notification_logs.error_message` untuk detail kegagalan |

Kalau ada error yang tidak masuk daftar di atas, kirim pesan errornya
lengkap (termasuk request & response) sebelum mengubah kode apa pun.
