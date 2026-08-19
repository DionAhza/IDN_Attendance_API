-- ============================================================
-- Migration 002 — Phase 14 (Face Verification)
--
-- `student_face_encodings` menyimpan vector encoding wajah tiap siswa
-- (hasil ekstraksi model face recognition di sisi klien/edge, BUKAN
-- foto mentah — supaya data biometrik sensitif tidak tersimpan sebagai
-- gambar di server). Satu siswa hanya punya SATU encoding aktif
-- (UNIQUE student_id) — enroll ulang akan menimpa (upsert), bukan
-- menambah baris baru, supaya riwayat wajah lama tidak menumpuk.
-- ============================================================

CREATE TABLE IF NOT EXISTS `student_face_encodings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `encoding` JSON NOT NULL COMMENT 'Vector encoding wajah (array of float), hasil model face recognition',
  `encoding_model` VARCHAR(50) DEFAULT NULL COMMENT 'Nama/versi model yang menghasilkan encoding, mis. face-api-v1',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_face_encodings_student` (`student_id`),
  CONSTRAINT `fk_student_face_encodings_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
