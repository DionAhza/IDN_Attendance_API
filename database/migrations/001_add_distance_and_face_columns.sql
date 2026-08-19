-- ============================================================
-- Migration 001 — Phase 14 (GPS Geofencing + Face Verification)
--
-- Menambahkan kolom ke `student_attendance`:
--  - check_in_distance_meters / check_out_distance_meters:
--    jarak (meter) siswa dari titik sekolah saat check-in/out, hasil
--    perhitungan Haversine (src/utils/geo.js). NULL kalau validasi GPS
--    nonaktif (school_settings.gps_validation_enabled = false).
--  - check_in_face_verified / check_out_face_verified:
--    status verifikasi wajah. NULL = tidak diverifikasi (fitur
--    nonaktif / tidak dicek), 1 = wajah cocok, 0 = wajah tidak cocok
--    tapi tetap diloloskan lewat override manual admin/guru (lihat
--    tabel `face_override_logs` di migration 003).
--
-- Cara pakai: jalankan SETELAH schema.sql utama sudah di-import, HANYA
-- kalau database sudah berjalan lebih dulu (mis. sudah production).
-- Untuk instalasi baru dari nol, kolom-kolom ini sudah menyatu di
-- schema.sql — migration ini tidak perlu dijalankan lagi.
-- ============================================================

ALTER TABLE `student_attendance`
  ADD COLUMN `check_in_distance_meters` DECIMAL(8,2) DEFAULT NULL
    COMMENT 'Jarak (meter) dari titik sekolah saat check-in, hasil Haversine'
    AFTER `check_in_accuracy`,
  ADD COLUMN `check_out_distance_meters` DECIMAL(8,2) DEFAULT NULL
    COMMENT 'Jarak (meter) dari titik sekolah saat check-out, hasil Haversine'
    AFTER `check_out_accuracy`,
  ADD COLUMN `check_in_face_verified` TINYINT(1) DEFAULT NULL
    COMMENT 'NULL = tidak diverifikasi, 1 = wajah cocok, 0 = tidak cocok (lolos via override)'
    AFTER `check_in_method`,
  ADD COLUMN `check_out_face_verified` TINYINT(1) DEFAULT NULL
    COMMENT 'NULL = tidak diverifikasi, 1 = wajah cocok, 0 = tidak cocok (lolos via override)'
    AFTER `check_out_method`;
