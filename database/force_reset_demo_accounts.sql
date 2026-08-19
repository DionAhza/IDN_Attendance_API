-- ============================================================
-- FORCE RESET akun demo (semua role) — aman dijalankan berkali-kali,
-- kapan pun, di database yang sudah ada isinya. Pakai
-- ON DUPLICATE KEY UPDATE, jadi:
--   - Kalau row belum ada -> dibuat
--   - Kalau row sudah ada (entah datanya benar atau korup/salah ketik
--     dari percobaan sebelumnya) -> dipaksa ditimpa ke nilai yang benar
-- Jalankan SELURUH file ini sekaligus (bukan per-blok).
-- ============================================================

-- 1. USERS — 4 akun demo, password di-force ke nilai yang benar
INSERT INTO `users` (`email`, `password_hash`, `role`, `is_active`) VALUES
('admin@demo.idn.sch.id',   '$2b$10$aEnruLjSjECtv.mSrVPv1OgcxNkeKtZ5KiK/H6I9zZJb17WhJOkYq', 'admin',   1),
('teacher@demo.idn.sch.id', '$2b$10$4uJL0UiDBVnaFNWTRfsfK.ALxpcGh/V9kEtzL1nTSnUDUXKwK5/oq', 'teacher', 1),
('student@demo.idn.sch.id', '$2b$10$WkhkyawTkd/WuFtlzJBhRe1t9l//lWOVHajljaHUbH8F3s.vGGwU6', 'student', 1),
('parent@demo.idn.sch.id',  '$2b$10$1naqJiqWqGoavcPhxHfihu2G0LM2SqL3MLcOOQNQm.CRbcL3ZNJ7y', 'parent',  1)
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `role` = VALUES(`role`),
  `is_active` = 1;

-- 2. Kelas & mapel dasar (tidak diubah kalau sudah ada, cukup dipastikan ada)
INSERT INTO `classes` (`name`, `level`) VALUES ('X RPL A', 'X')
  ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
INSERT INTO `subjects` (`name`, `code`) VALUES ('Pemrograman Web', 'PW-01')
  ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Profil guru
INSERT INTO `teachers` (`user_id`, `nip`, `full_name`, `phone`)
SELECT id, '198001012026001', 'Budi Santoso, S.Kom', '081200000001'
FROM `users` WHERE email = 'teacher@demo.idn.sch.id'
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `phone` = VALUES(`phone`);

-- 4. Profil siswa
INSERT INTO `students` (`user_id`, `class_id`, `nis`, `full_name`)
SELECT u.id, (SELECT id FROM `classes` WHERE name = 'X RPL A'), '2026001', 'Ahmad Fauzi'
FROM `users` u WHERE u.email = 'student@demo.idn.sch.id'
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `class_id` = VALUES(`class_id`);

-- 5. Profil parent — INI YANG PALING PENTING, kemungkinan sebelumnya
--    gagal/tidak jalan
INSERT INTO `parents` (`user_id`, `full_name`, `phone`)
SELECT id, 'Slamet Riyadi', '081200000099'
FROM `users` WHERE email = 'parent@demo.idn.sch.id'
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `phone` = VALUES(`phone`);

-- 6. Link parent <-> anak
INSERT INTO `parent_students` (`parent_id`, `student_id`, `relationship_type`)
SELECT p.id, s.id, 'ayah'
FROM `parents` p
JOIN `users` up ON up.id = p.user_id AND up.email = 'parent@demo.idn.sch.id'
JOIN `students` s ON s.nis = '2026001'
ON DUPLICATE KEY UPDATE `relationship_type` = VALUES(`relationship_type`);

-- 7. Jadwal mengajar guru, Senin-Jumat 07:00-08:30 (hanya dibuat kalau
--    guru ini belum punya jadwal sama sekali, supaya tidak dobel tiap
--    kali script ini dijalankan ulang)
INSERT INTO `schedules` (`teacher_id`, `class_id`, `subject_id`, `day`, `start_time`, `end_time`)
SELECT t.id, c.id, sub.id, d.day, '07:00:00', '08:30:00'
FROM `teachers` t
JOIN `classes` c ON c.name = 'X RPL A'
JOIN `subjects` sub ON sub.code = 'PW-01'
JOIN (
  SELECT 'monday' AS day UNION ALL SELECT 'tuesday' UNION ALL SELECT 'wednesday'
  UNION ALL SELECT 'thursday' UNION ALL SELECT 'friday'
) AS d ON 1=1
WHERE t.nip = '198001012026001'
  AND NOT EXISTS (SELECT 1 FROM `schedules` WHERE teacher_id = t.id);

-- ============================================================
-- VERIFIKASI — jalankan ini setelah blok di atas, harus muncul 4 baris
-- ============================================================
SELECT id, email, role, is_active, LEFT(password_hash, 10) AS hash_preview
FROM `users`
WHERE email IN (
  'admin@demo.idn.sch.id', 'teacher@demo.idn.sch.id',
  'student@demo.idn.sch.id', 'parent@demo.idn.sch.id'
);
