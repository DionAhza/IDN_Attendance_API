# Dokumentasi Lengkap REST API — IDN Attendance System

Dokumentasi ini mencakup seluruh endpoint, struktur request/response, autentikasi, otorisasi role, dan alur bisnis sistem backend **IDN Boarding School Attendance API**.

---

## 1. Panduan Umum & Format Standar

### 1.1. Base URL
- **Lokal**: `http://localhost:3000/api`
- **Production / Staging**: `https://<your-domain-or-vercel-app>/api`

### 1.2. Format Header
Kecuali untuk endpoint publik seperti `/api/auth/login` dan `/api/health`, semua endpoint mewajibkan header:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### 1.3. Struktur Response Standar
Setiap response API mengembalikan JSON dengan format konsisten:

#### A. Response Sukses Single Data (200 / 201)
```json
{
  "success": true,
  "message": "Pesan deskriptif sukses",
  "data": { ... }
}
```

#### B. Response Sukses List dengan Pagination (200)
```json
{
  "success": true,
  "message": "Data berhasil dimuat",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "total_pages": 5
  }
}
```

#### C. Response Error (4xx / 5xx)
```json
{
  "success": false,
  "message": "Pesan deskripsi kesalahan",
  "data": null,
  "errors": [ ... ] // (Opsional) Detail error validasi field dari Zod
}
```

### 1.4. HTTP Status Code
| Kode | Makna | Kondisi Penggunaan |
|---|---|---|
| `200 OK` | Berhasil | Request GET, PATCH, PUT, atau DELETE berhasil |
| `201 Created` | Berhasil dibuat | Request POST berhasil membuat entitas baru |
| `400 Bad Request` | Input tidak valid | Payload request gagal validasi skema Zod |
| `401 Unauthorized` | Autentikasi gagal | Token tidak ada, expired, atau signature tidak valid |
| `403 Forbidden` | Akses ditolak | Role pengguna tidak memiliki hak akses atau mencoba mengakses data yang bukan miliknya (Anti-IDOR) |
| `404 Not Found` | Tidak ditemukan | Endpoint atau record data yang diminta tidak ada |
| `409 Conflict` | Konflik data | Pelanggaran constraint (duplikat email/NIP/NIS, sudah check-in hari ini, jadwal bentrok) |
| `429 Too Many Requests` | Rate limit terlampaui | Melebihi batas request rate limiter (200 req / 15 menit) |
| `500 Internal Server Error` | Kesalahan server | Bug sistem atau kegagalan koneksi database tak terduga |

---

## 2. Autentikasi & Otorisasi

Sistem menggunakan **JSON Web Token (JWT)** dengan masa berlaku 7 hari. Terdapat 4 tingkatan role pengguna:
1. `admin`: Administrator sekolah / Staff TU.
2. `teacher`: Guru pengajar.
3. `student`: Santri / Siswa.
4. `parent`: Orang tua / Wali santri.

---

## 3. Daftar Endpoint API Lengkap

```
├── Health Check
│   └── GET    /api/health
├── Autentikasi (/api/auth)
│   ├── POST   /api/auth/login
│   └── GET    /api/auth/me
├── Master Data Admin
│   ├── Classes (/api/classes)
│   │   ├── GET    /api/classes
│   │   ├── GET    /api/classes/:id
│   │   ├── POST   /api/classes
│   │   ├── PATCH  /api/classes/:id
│   │   └── DELETE /api/classes/:id
│   ├── Subjects (/api/subjects)
│   │   ├── GET    /api/subjects
│   │   ├── GET    /api/subjects/:id
│   │   ├── POST   /api/subjects
│   │   ├── PATCH  /api/subjects/:id
│   │   └── DELETE /api/subjects/:id
│   ├── Teachers (/api/teachers)
│   │   ├── GET    /api/teachers
│   │   ├── GET    /api/teachers/:id
│   │   ├── POST   /api/teachers
│   │   ├── PATCH  /api/teachers/:id
│   │   └── DELETE /api/teachers/:id
│   ├── Students (/api/students)
│   │   ├── GET    /api/students
│   │   ├── GET    /api/students/:id
│   │   ├── POST   /api/students
│   │   ├── PATCH  /api/students/:id
│   │   └── DELETE /api/students/:id
│   ├── Parents & Relasi Anak (/api/parents)
│   │   ├── GET    /api/parents
│   │   ├── GET    /api/parents/:id
│   │   ├── POST   /api/parents
│   │   ├── PATCH  /api/parents/:id
│   │   ├── DELETE /api/parents/:id
│   │   ├── GET    /api/parents/:id/students
│   │   ├── POST   /api/parents/:id/students
│   │   └── DELETE /api/parents/:id/students/:studentId
│   ├── Schedules (/api/schedules)
│   │   ├── GET    /api/schedules
│   │   ├── GET    /api/schedules/:id
│   │   ├── POST   /api/schedules
│   │   ├── PATCH  /api/schedules/:id
│   │   └── DELETE /api/schedules/:id
│   └── School Settings (/api/school-settings)
│       ├── GET    /api/school-settings
│       ├── GET    /api/school-settings/:key
│       ├── PUT    /api/school-settings/:key
│       └── DELETE /api/school-settings/:key
├── Absensi Santri (/api/student-attendance)
│   ├── POST   /api/student-attendance/check-in
│   ├── POST   /api/student-attendance/check-out
│   ├── GET    /api/student-attendance/today
│   └── GET    /api/student-attendance/history
├── Absensi Guru (/api/teacher-attendance)
│   ├── GET    /api/teacher-attendance/today-schedules
│   ├── POST   /api/teacher-attendance/check-in
│   └── GET    /api/teacher-attendance/history
├── Self-Service Wali Santri (/api/parent)
│   ├── GET    /api/parent/children
│   ├── GET    /api/parent/children/:studentId/attendance/today
│   └── GET    /api/parent/children/:studentId/attendance/history
└── Biometrik Wajah (/api/face-verification)
    ├── POST   /api/face-verification/enroll
    ├── GET    /api/face-verification/status
    ├── GET    /api/face-verification/status/:studentId
    ├── POST   /api/face-verification/verify
    ├── POST   /api/face-verification/override
    └── GET    /api/face-verification/override/:studentId
```

---

## 4. Rincian Endpoint per Modul

### 4.1. Health Check
Memeriksa status liveness service API.

#### `GET /api/health`
- **Akses**: Publik
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "IDN Attendance API is running",
  "data": {
    "timestamp": "2026-08-19T10:00:00.000Z"
  }
}
```

---

### 4.2. Autentikasi (`/api/auth`)

#### `POST /api/auth/login`
- **Akses**: Publik
- **Request Body**:
```json
{
  "email": "admin@demo.idn.sch.id",
  "password": "Admin123!"
}
```
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "admin@demo.idn.sch.id",
      "role": "admin",
      "profile": {
        "id": 1,
        "full_name": "Administrator TU"
      }
    }
  }
}
```

#### `GET /api/auth/me`
- **Akses**: Terautentikasi (Semua role)
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Profil berhasil diambil",
  "data": {
    "id": 1,
    "email": "admin@demo.idn.sch.id",
    "role": "admin",
    "is_active": 1,
    "profile": {
      "id": 1,
      "full_name": "Administrator TU"
    }
  }
}
```

---

### 4.3. Master Data Kelas (`/api/classes`)
Semua endpoint modul ini hanya dapat diakses oleh role `admin`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/classes?page=1&limit=10&search=X` | List kelas terpaginasi |
| `GET` | `/api/classes/:id` | Detail kelas by ID |
| `POST` | `/api/classes` | Tambah kelas baru |
| `PATCH` | `/api/classes/:id` | Ubah data kelas |
| `DELETE` | `/api/classes/:id` | Hapus kelas (ditolak 409 jika masih ada siswa/jadwal) |

#### Contoh Payload POST / PATCH:
```json
{
  "name": "X RPL B",
  "level": "X",
  "is_active": 1
}
```

---

### 4.4. Master Data Mata Pelajaran (`/api/subjects`)
Semua endpoint modul ini hanya dapat diakses oleh role `admin`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/subjects?page=1&limit=10&search=Web` | List mapel terpaginasi |
| `GET` | `/api/subjects/:id` | Detail mapel by ID |
| `POST` | `/api/subjects` | Tambah mapel baru |
| `PATCH` | `/api/subjects/:id` | Ubah data mapel |
| `DELETE` | `/api/subjects/:id` | Hapus mapel (ditolak 409 jika masih dipakai jadwal) |

#### Contoh Payload POST / PATCH:
```json
{
  "name": "Pemrograman Mobile",
  "code": "PM-02",
  "is_active": 1
}
```

---

### 4.5. Master Data Guru (`/api/teachers`)
Semua endpoint modul ini hanya dapat diakses oleh role `admin`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/teachers?page=1&limit=10&search=Budi` | List guru terpaginasi |
| `GET` | `/api/teachers/:id` | Detail profil guru & akun by ID |
| `POST` | `/api/teachers` | Tambah guru baru (otomatis membuat akun `users` role `teacher`) |
| `PATCH` | `/api/teachers/:id` | Update profil guru (bisa update email/password akun) |
| `DELETE` | `/api/teachers/:id` | Hapus data guru beserta akun users-nya |

#### Contoh Payload POST `/api/teachers`:
```json
{
  "email": "guru.baru@demo.idn.sch.id",
  "password": "PasswordGuru123!",
  "nip": "198501012026002",
  "full_name": "Ust. Salman Al-Farisi, S.Pd",
  "phone": "081299990001",
  "is_active": 1
}
```

---

### 4.6. Master Data Siswa (`/api/students`)
Semua endpoint modul ini hanya dapat diakses oleh role `admin`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/students?page=1&limit=10&search=Fauzi&class_id=1` | List santri terpaginasi & filter kelas |
| `GET` | `/api/students/:id` | Detail santri beserta relasi kelas |
| `POST` | `/api/students` | Tambah santri (otomatis membuat akun `users` role `student`) |
| `PATCH` | `/api/students/:id` | Update profil santri (bisa update kelas/email/password) |
| `DELETE` | `/api/students/:id` | Hapus santri beserta akun users-nya |

#### Contoh Payload POST `/api/students`:
```json
{
  "email": "santri.baru@demo.idn.sch.id",
  "password": "PasswordSantri123!",
  "nis": "2026002",
  "full_name": "Muhammad Farhan",
  "class_id": 1,
  "is_active": 1
}
```

---

### 4.7. Master Data Wali Santri & Relasi Anak (`/api/parents`)
Semua endpoint modul ini hanya dapat diakses oleh role `admin`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/parents?page=1&limit=10&search=Slamet` | List wali santri terpaginasi |
| `GET` | `/api/parents/:id` | Detail wali santri by ID |
| `POST` | `/api/parents` | Tambah wali santri (otomatis membuat akun `users` role `parent`) |
| `PATCH` | `/api/parents/:id` | Update wali santri (bisa ubah nomor WhatsApp / reset password) |
| `DELETE` | `/api/parents/:id` | Hapus wali santri beserta relasi |
| `GET` | `/api/parents/:id/students` | Lihat daftar anak yang terhubung ke wali ini |
| `POST` | `/api/parents/:id/students` | Hubungkan anak ke wali (`parent_students`) |
| `DELETE` | `/api/parents/:id/students/:studentId` | Lepas relasi anak dari wali |

#### Contoh Payload POST `/api/parents`:
```json
{
  "email": "wali.santri@demo.idn.sch.id",
  "password": "PasswordWali123!",
  "full_name": "Ir. Bambang Trihatmojo",
  "phone": "081388887777"
}
```

#### Contoh Payload POST `/api/parents/:id/students` (Link Anak):
```json
{
  "student_id": 1,
  "relationship_type": "ayah"
}
```

---

### 4.8. Master Data Jadwal Mengajar (`/api/schedules`)
Semua endpoint modul ini hanya dapat diakses oleh role `admin`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/schedules?page=1&limit=10&teacher_id=1&class_id=1&day=monday` | List jadwal KBM |
| `GET` | `/api/schedules/:id` | Detail jadwal by ID |
| `POST` | `/api/schedules` | Tambah jadwal (otomatis validasi bentrok guru & kelas) |
| `PATCH` | `/api/schedules/:id` | Update jadwal (otomatis validasi bentrok waktu) |
| `DELETE` | `/api/schedules/:id` | Hapus jadwal |

#### Contoh Payload POST `/api/schedules`:
```json
{
  "teacher_id": 1,
  "class_id": 1,
  "subject_id": 1,
  "day": "monday",
  "start_time": "07:30:00",
  "end_time": "09:00:00",
  "is_active": 1
}
```

---

### 4.9. Pengaturan Sekolah / System Config (`/api/school-settings`)
Hanya dapat diakses oleh role `admin`.

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/school-settings` | List semua pengaturan sekolah |
| `GET` | `/api/school-settings/:key` | Ambil 1 nilai setting by key |
| `PUT` | `/api/school-settings/:key` | Upsert setting (buat baru / update jika sudah ada) |
| `DELETE` | `/api/school-settings/:key` | Hapus custom setting (core system keys ditolak 400) |

#### Contoh Payload PUT `/api/school-settings/school_start_time`:
```json
{
  "setting_value": "07:15:00",
  "description": "Batas jam masuk sekolah pagi"
}
```

---

### 4.10. Absensi Santri / Student Self-Service (`/api/student-attendance`)
Semua endpoint ini diproteksi untuk role `student`. `student_id` diambil dari token JWT (aman dari manipulasi ID siswa lain).

#### `POST /api/student-attendance/check-in`
- **Fungsi**: Santri melakukan absensi masuk harian.
- **Request Body (Opsional)**:
```json
{
  "latitude": -6.402484,
  "longitude": 106.794241,
  "accuracy": 15.5,
  "notes": "Hadir tepat waktu"
}
```
- **Business Logic**:
  1. Ditolak `409 Conflict` jika sudah check-in pada hari ini.
  2. Menghitung status `present` vs `late` otomatis berdasarkan `school_settings.school_start_time`.
  3. Menghitung jarak GPS ke titik sekolah menggunakan rumus Haversine. Jika `gps_validation_enabled = true` dan jarak melebihi `school_radius_meters`, request ditolak `400 Bad Request`.
  4. Memicu notifikasi otomatis ke seluruh wali santri yang terhubung (Email & WhatsApp Fonnte).
- **Response 201 Created**:
```json
{
  "success": true,
  "message": "Check-in berhasil",
  "data": {
    "id": 101,
    "student_id": 1,
    "date": "2026-08-19",
    "check_in": "2026-08-19T06:55:12.000Z",
    "check_in_status": "present",
    "check_in_distance_meters": 45.20
  }
}
```

#### `POST /api/student-attendance/check-out`
- **Fungsi**: Santri melakukan absensi pulang harian.
- **Request Body (Opsional)**: sama seperti check-in.
- **Business Logic**:
  1. Ditolak `409 Conflict` jika belum check-in hari ini atau sudah pernah check-out.
  2. Memicu notifikasi `STUDENT_CHECK_OUT` ke wali santri.
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Check-out berhasil",
  "data": {
    "id": 101,
    "check_out": "2026-08-19T16:00:25.000Z",
    "check_out_status": "present"
  }
}
```

#### `GET /api/student-attendance/today`
- **Fungsi**: Mengambil status absensi santri hari ini (apakah sudah check-in/out).
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Data absensi hari ini berhasil dimuat",
  "data": {
    "id": 101,
    "date": "2026-08-19",
    "check_in": "2026-08-19T06:55:12.000Z",
    "check_out": null,
    "check_in_status": "present"
  }
}
```

#### `GET /api/student-attendance/history?page=1&limit=10&date_from=2026-08-01&date_to=2026-08-19`
- **Fungsi**: Melihat riwayat absensi santri yang login secara terpaginasi.

---

### 4.11. Absensi Guru / Teacher Self-Service (`/api/teacher-attendance`)
Semua endpoint ini diproteksi untuk role `teacher`. `teacher_id` diambil dari token JWT. Absensi guru bersifat per-jadwal sesi KBM (`schedule_id`).

#### `GET /api/teacher-attendance/today-schedules`
- **Fungsi**: Mengambil seluruh jadwal mengajar guru **hari ini** beserta status absensinya (apakah sesi tersebut sudah diabsen atau belum).
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Jadwal hari ini berhasil dimuat",
  "data": [
    {
      "schedule_id": 5,
      "class_name": "X RPL A",
      "subject_name": "Pemrograman Web",
      "day": "wednesday",
      "start_time": "07:00:00",
      "end_time": "08:30:00",
      "attendance": null
    }
  ]
}
```

#### `POST /api/teacher-attendance/check-in`
- **Fungsi**: Guru melakukan absensi kehadiran pada sesi KBM tertentu.
- **Request Body**:
```json
{
  "schedule_id": 5,
  "latitude": -6.402484,
  "longitude": 106.794241,
  "notes": "Materi pengenalan MySQL"
}
```
- **Business Logic**:
  1. Validasi jadwal adalah milik guru yang sedang login (403 jika jadwal guru lain).
  2. Validasi jadwal sesuai dengan hari saat ini dan belum pernah diabsen hari ini (409).
  3. Status otomatis: `present` jika check-in sebelum `start_time + toleransi menit` (`school_settings.teacher_late_tolerance_minutes`, default 10 menit), jika lebih maka berstatus `late`.

#### `GET /api/teacher-attendance/history?page=1&limit=10&schedule_id=5`
- **Fungsi**: Melihat histori absensi mengajar guru secara terpaginasi.

---

### 4.12. Self-Service Wali Santri (`/api/parent`)
Diproteksi untuk role `parent`. Seluruh endpoint berstatus **READ-ONLY** dan memiliki proteksi **Anti-IDOR** (wali hanya dapat melihat data santri yang terhubung sah ke akunnya di `parent_students`).

#### `GET /api/parent/children`
- **Fungsi**: Mengambil daftar anak/santri yang terhubung ke wali santri yang login.
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Daftar anak berhasil dimuat",
  "data": [
    {
      "student_id": 1,
      "full_name": "Ahmad Fauzi",
      "nis": "2026001",
      "class_name": "X RPL A",
      "relationship_type": "ayah"
    }
  ]
}
```

#### `GET /api/parent/children/:studentId/attendance/today`
- **Fungsi**: Melihat absensi hari ini dari santri tertentu milik wali.

#### `GET /api/parent/children/:studentId/attendance/history?page=1&limit=10`
- **Fungsi**: Melihat rekap riwayat absensi santri tertentu secara terpaginasi.

---

### 4.13. Biometrik Verifikasi Wajah (`/api/face-verification`)

Modul pengenalan wajah santri untuk mencegah "titip absen".

#### `POST /api/face-verification/enroll`
- **Akses**: `student` (untuk dirinya sendiri) atau `admin` (mendaftarkan santri lain dengan menyertakan `studentId`).
- **Request Body**:
```json
{
  "studentId": 1,
  "encoding": [0.0451, -0.1284, 0.0892, ...],
  "model": "face-api-v1"
}
```

#### `GET /api/face-verification/status`
- **Akses**: `student` (cek apakah wajahnya sudah terdaftar).

#### `GET /api/face-verification/status/:studentId`
- **Akses**: `admin`, `teacher` (cek status enrollment santri tertentu).

#### `POST /api/face-verification/verify`
- **Akses**: `student`
- **Request Body**:
```json
{
  "encoding": [0.0451, -0.1284, 0.0892, ...]
}
```
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "Wajah cocok",
  "data": {
    "match": true,
    "similarity": 0.8924,
    "threshold": 0.6
  }
}
```

#### `POST /api/face-verification/override`
- **Akses**: `admin`, `teacher`
- **Fungsi**: Meloloskan absensi santri secara manual ketika verifikasi wajah gagal (misal kamera rusak, luka wajah). Wajib menyertakan alasan.
- **Request Body**:
```json
{
  "student_id": 1,
  "attendance_type": "check_in",
  "similarity_score": 0.42,
  "reason": "Kamera smartphone santri buram/retak"
}
```

#### `GET /api/face-verification/override/:studentId`
- **Akses**: `admin`, `teacher`
- **Fungsi**: Audit log histori override verifikasi wajah untuk santri tertentu.

---

## 5. Sistem Notifikasi Multi-Channel (Email & WhatsApp)

Backend IDN Attendance dilengkapi arsitektur notifikasi multi-channel yang berjalan secara **asinkron (fire-and-forget)**.

### 5.1. Alur & Karakteristik
1. **Non-blocking**: Kegagalan pengiriman notifikasi (misal SMTP timeout atau token WhatsApp habis) **tidak akan membatalkan** status kehadiran siswa. Siswa tetap menerima response HTTP 201 sukses.
2. **Channel yang Didukung**:
   - **Email**: Menggunakan SMTP (Gmail App Password / Mailgun / Brevo / SMTP hosting) via `nodemailer`.
   - **WhatsApp**: Menggunakan gateway Fonnte via HTTP API (`https://api.fonnte.com/send`).
3. **Konfigurasi Environment Variable (`.env`)**:
```env
# Multi-channel selector (default: email)
NOTIFICATION_CHANNELS=email,whatsapp

# Email (SMTP)
EMAIL_PROVIDER=smtp
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=notifikasi.sekolah@gmail.com
EMAIL_SMTP_PASS=xxxx-xxxx-xxxx-xxxx
EMAIL_FROM=IDN Boarding School <noreply@idn.sch.id>

# WhatsApp (Fonnte)
FONNTE_API_TOKEN=your_fonnte_device_token
FONNTE_SENDER_NAME=IDN Attendance Bot
```

### 5.2. Event & Template Notifikasi
- `STUDENT_CHECK_IN`: Dikirim saat siswa check-in pagi. Berisi nama santri, kelas, jam masuk, dan status kehadiran.
- `STUDENT_CHECK_OUT`: Dikirim saat siswa check-out sore. Berisi nama santri, kelas, dan jam kepulangan.
- `STUDENT_LATE`: Notifikasi peringatan khusus jika santri check-in melewati batas jam sekolah (`school_start_time`).
- `STUDENT_ABSENT`: Notifikasi santri tidak hadir tanpa keterangan.
