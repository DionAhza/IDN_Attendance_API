-- ============================================================
-- IDN Boarding School — Attendance System
-- database/schema.sql
--
-- Cara pakai:
--   1. Buat database MySQL kosong di Railway.
--   2. Import file ini secara utuh (mysql client / Railway console /
--      MySQL Workbench / phpMyAdmin — sesuai tool yang kamu pakai).
--   3. Jangan jalankan CREATE DATABASE di sini jika Railway sudah
--      menyediakan nama database sendiri — baris itu sengaja
--      dikomentari, lihat catatan di bawah.
--
-- Urutan tabel disusun berdasarkan dependency foreign key
-- (parent table dulu, baru child table).
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Railway biasanya sudah menyediakan nama database sendiri (lihat
-- variable MYSQLDATABASE). Baris di bawah ini SENGAJA dikomentari —
-- aktifkan hanya jika kamu memang mengelola sendiri nama databasenya.
-- CREATE DATABASE IF NOT EXISTS idn_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE idn_attendance;

-- ============================================================
-- 1. USERS — identitas & kredensial semua role
-- ============================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'teacher', 'student', 'parent') NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. CLASSES — master data kelas
-- ============================================================
DROP TABLE IF EXISTS `classes`;
CREATE TABLE `classes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `level` VARCHAR(20) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_classes_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. SUBJECTS — master data mata pelajaran
-- ============================================================
DROP TABLE IF EXISTS `subjects`;
CREATE TABLE `subjects` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(20) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subjects_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. TEACHERS — profil guru (1-to-1 dengan users)
-- ============================================================
DROP TABLE IF EXISTS `teachers`;
CREATE TABLE `teachers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `nip` VARCHAR(30) DEFAULT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teachers_user_id` (`user_id`),
  UNIQUE KEY `uq_teachers_nip` (`nip`),
  CONSTRAINT `fk_teachers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. STUDENTS — profil siswa (1-to-1 dengan users, belongs to a class)
-- ============================================================
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `class_id` INT UNSIGNED DEFAULT NULL,
  `nis` VARCHAR(30) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_students_user_id` (`user_id`),
  UNIQUE KEY `uq_students_nis` (`nis`),
  KEY `idx_students_class_id` (`class_id`),
  CONSTRAINT `fk_students_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_students_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. PARENTS — profil wali santri (1-to-1 dengan users)
-- ============================================================
DROP TABLE IF EXISTS `parents`;
CREATE TABLE `parents` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_parents_user_id` (`user_id`),
  CONSTRAINT `fk_parents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. PARENT_STUDENTS — relasi many-to-many parent <-> siswa
-- ============================================================
DROP TABLE IF EXISTS `parent_students`;
CREATE TABLE `parent_students` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id` INT UNSIGNED NOT NULL,
  `student_id` INT UNSIGNED NOT NULL,
  `relationship_type` VARCHAR(30) DEFAULT NULL COMMENT 'ayah/ibu/wali, dst',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_parent_student` (`parent_id`, `student_id`),
  KEY `idx_parent_students_student` (`student_id`),
  CONSTRAINT `fk_ps_parent` FOREIGN KEY (`parent_id`) REFERENCES `parents` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ps_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. SCHEDULES — jadwal mengajar (guru + kelas + mapel + waktu)
-- ============================================================
DROP TABLE IF EXISTS `schedules`;
CREATE TABLE `schedules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `teacher_id` INT UNSIGNED NOT NULL,
  `class_id` INT UNSIGNED NOT NULL,
  `subject_id` INT UNSIGNED NOT NULL,
  `day` ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_schedules_teacher` (`teacher_id`),
  KEY `idx_schedules_class` (`class_id`),
  KEY `idx_schedules_subject` (`subject_id`),
  KEY `idx_schedules_day` (`day`),
  CONSTRAINT `fk_schedules_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedules_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_schedules_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. STUDENT_ATTENDANCE — 1 baris per siswa per hari
-- ============================================================
DROP TABLE IF EXISTS `student_attendance`;
CREATE TABLE `student_attendance` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `date` DATE NOT NULL,
  `check_in` DATETIME DEFAULT NULL,
  `check_out` DATETIME DEFAULT NULL,
  `check_in_status` ENUM('present','late','sick','permission','absent') DEFAULT NULL,
  `check_out_status` ENUM('present','late','sick','permission','absent') DEFAULT NULL,
  `check_in_latitude` DECIMAL(10,7) DEFAULT NULL,
  `check_in_longitude` DECIMAL(10,7) DEFAULT NULL,
  `check_in_accuracy` DECIMAL(8,2) DEFAULT NULL,
  `check_out_latitude` DECIMAL(10,7) DEFAULT NULL,
  `check_out_longitude` DECIMAL(10,7) DEFAULT NULL,
  `check_out_accuracy` DECIMAL(8,2) DEFAULT NULL,
  `check_in_method` VARCHAR(30) DEFAULT NULL COMMENT 'manual/qr/dll',
  `check_out_method` VARCHAR(30) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_attendance_date` (`student_id`, `date`),
  KEY `idx_student_attendance_date` (`date`),
  CONSTRAINT `fk_student_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. TEACHER_ATTENDANCE — 1 baris per schedule per hari
-- ============================================================
DROP TABLE IF EXISTS `teacher_attendance`;
CREATE TABLE `teacher_attendance` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `schedule_id` INT UNSIGNED NOT NULL,
  `teacher_id` INT UNSIGNED NOT NULL,
  `date` DATE NOT NULL,
  `check_in` DATETIME DEFAULT NULL,
  `status` ENUM('present','late','absent') DEFAULT NULL,
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `note` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teacher_attendance_schedule_date` (`schedule_id`, `date`),
  KEY `idx_teacher_attendance_teacher` (`teacher_id`),
  KEY `idx_teacher_attendance_date` (`date`),
  CONSTRAINT `fk_teacher_attendance_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_teacher_attendance_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. SCHOOL_SETTINGS — konfigurasi sistem (key-value)
-- ============================================================
DROP TABLE IF EXISTS `school_settings`;
CREATE TABLE `school_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_school_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. NOTIFICATION_LOGS — log pengiriman notifikasi
-- ============================================================
DROP TABLE IF EXISTS `notification_logs`;
CREATE TABLE `notification_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recipient` VARCHAR(150) NOT NULL,
  `type` VARCHAR(50) NOT NULL COMMENT 'STUDENT_CHECK_IN, STUDENT_CHECK_OUT, STUDENT_LATE, STUDENT_ABSENT, dst',
  `subject` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('success','failed') NOT NULL,
  `provider` VARCHAR(50) DEFAULT NULL,
  `related_attendance_type` ENUM('student','teacher') DEFAULT NULL,
  `related_attendance_id` INT UNSIGNED DEFAULT NULL,
  `sent_at` DATETIME DEFAULT NULL,
  `error_message` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_logs_type` (`type`),
  KEY `idx_notification_logs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED DATA (DEMO DATA) — opsional, untuk development lokal.
-- Semua data di bawah ini FIKTIF, ditandai sesuai instruksi:
-- "Gunakan seed/demo data hanya jika diberi label: DEMO DATA"
-- HAPUS blok ini sebelum deploy ke production sekolah.
-- ============================================================

-- DEMO DATA: 1 admin
-- Email    : admin@demo.idn.sch.id
-- Password : Admin123!
-- Hash di bawah adalah hash bcrypt ASLI dari password di atas (cost 10),
-- boleh dipakai untuk testing lokal. GANTI/HAPUS sebelum production.
INSERT INTO `users` (`email`, `password_hash`, `role`) VALUES
('admin@demo.idn.sch.id', '$2b$10$aEnruLjSjECtv.mSrVPv1OgcxNkeKtZ5KiK/H6I9zZJb17WhJOkYq', 'admin');

-- DEMO DATA: 1 kelas, 1 mapel
INSERT INTO `classes` (`name`, `level`) VALUES ('X RPL A', 'X');
INSERT INTO `subjects` (`name`, `code`) VALUES ('Pemrograman Web', 'PW-01');

-- DEMO DATA: school_settings default
INSERT INTO `school_settings` (`setting_key`, `setting_value`, `description`) VALUES
('school_start_time', '07:00:00', 'Batas jam masuk sekolah — setelah jam ini status = late'),
('gps_validation_enabled', 'false', 'Aktif/nonaktifkan validasi radius GPS'),
('school_latitude', '', 'Latitude titik sekolah (diisi jika GPS aktif)'),
('school_longitude', '', 'Longitude titik sekolah (diisi jika GPS aktif)'),
('school_radius_meters', '200', 'Radius toleransi absensi dalam meter'),
('notify_parent_on_check_in', 'true', 'Kirim notifikasi saat siswa check-in'),
('notify_parent_on_check_out', 'true', 'Kirim notifikasi saat siswa check-out'),
('notify_parent_on_late', 'true', 'Kirim notifikasi tambahan jika siswa terlambat'),
('notify_parent_on_absent', 'true', 'Kirim notifikasi jika siswa tidak hadir');

-- ============================================================
-- END OF SCHEMA
-- ============================================================
