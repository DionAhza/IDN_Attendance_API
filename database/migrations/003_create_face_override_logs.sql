-- ============================================================
-- Migration 003 — Phase 14 (Face Verification)
--
-- `face_override_logs` mencatat setiap kali verifikasi wajah GAGAL
-- (skor kemiripan di bawah threshold, atau siswa belum enroll sama
-- sekali) tapi admin/guru tetap meloloskan absensi secara manual —
-- penting untuk audit trail supaya override tidak disalahgunakan
-- (mis. terus-menerus meloloskan siswa yang "titip absen").
-- ============================================================

CREATE TABLE IF NOT EXISTS `face_override_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `attendance_id` INT UNSIGNED DEFAULT NULL
    COMMENT 'FK longgar ke student_attendance.id — boleh NULL kalau override terjadi sebelum baris attendance dibuat',
  `attendance_type` ENUM('check_in','check_out') NOT NULL,
  `overridden_by` INT UNSIGNED NOT NULL COMMENT 'users.id admin/guru yang melakukan override',
  `similarity_score` DECIMAL(5,4) DEFAULT NULL COMMENT 'Skor kemiripan wajah saat gagal (0-1), NULL kalau siswa belum enroll',
  `reason` VARCHAR(255) NOT NULL COMMENT 'Alasan override, wajib diisi manusia (bukan default kosong)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_face_override_logs_student` (`student_id`),
  KEY `idx_face_override_logs_attendance` (`attendance_id`),
  CONSTRAINT `fk_face_override_logs_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_face_override_logs_user` FOREIGN KEY (`overridden_by`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
