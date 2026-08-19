-- ============================================================
-- Seed akun demo untuk semua role — AMAN dijalankan di database
-- yang SUDAH ADA datanya (Railway/production/dev). Tidak ada
-- DROP TABLE. Pakai INSERT IGNORE (bergantung UNIQUE KEY tiap
-- tabel) supaya aman kalau script ini dijalankan berkali-kali.
--
-- Cara pakai: jalankan file ini di database Railway kamu yang
-- sekarang (yang sudah berisi admin@demo.idn.sch.id).
-- ============================================================

-- 1. Users baru: teacher, student, parent (admin diasumsikan sudah ada)
INSERT IGNORE INTO `users` (`email`, `password_hash`, `role`) VALUES
('teacher@demo.idn.sch.id', '$2b$10$4uJL0UiDBVnaFNWTRfsfK.ALxpcGh/V9kEtzL1nTSnUDUXKwK5/oq', 'teacher'),
('student@demo.idn.sch.id', '$2b$10$WkhkyawTkd/WuFtlzJBhRe1t9l//lWOVHajljaHUbH8F3s.vGGwU6', 'student'),
('parent@demo.idn.sch.id', '$2b$10$1naqJiqWqGoavcPhxHfihu2G0LM2SqL3MLcOOQNQm.CRbcL3ZNJ7y', 'parent');

-- 2. Pastikan ada minimal 1 kelas & 1 mapel untuk dipakai siswa/jadwal
--    (INSERT IGNORE — kalau kamu sudah punya kelas/mapel sendiri lewat
--    Admin CRUD, baris ini akan diabaikan karena UNIQUE KEY name/code).
INSERT IGNORE INTO `classes` (`name`, `level`) VALUES ('X RPL A', 'X');
INSERT IGNORE INTO `subjects` (`name`, `code`) VALUES ('Pemrograman Web', 'PW-01');

-- 3. Profil guru
INSERT IGNORE INTO `teachers` (`user_id`, `nip`, `full_name`, `phone`) VALUES
((SELECT id FROM `users` WHERE email = 'teacher@demo.idn.sch.id'), '198001012026001', 'Budi Santoso, S.Kom', '081200000001');

-- 4. Profil siswa, masuk kelas 'X RPL A'
INSERT IGNORE INTO `students` (`user_id`, `class_id`, `nis`, `full_name`) VALUES
((SELECT id FROM `users` WHERE email = 'student@demo.idn.sch.id'),
 (SELECT id FROM `classes` WHERE name = 'X RPL A'), '2026001', 'Ahmad Fauzi');

-- 5. Profil parent
INSERT IGNORE INTO `parents` (`user_id`, `full_name`, `phone`) VALUES
((SELECT id FROM `users` WHERE email = 'parent@demo.idn.sch.id'), 'Slamet Riyadi', '081200000099');

-- 6. Link parent <-> anak (wajib untuk test Phase 11)
INSERT IGNORE INTO `parent_students` (`parent_id`, `student_id`, `relationship_type`) VALUES
((SELECT id FROM `parents` WHERE user_id = (SELECT id FROM `users` WHERE email = 'parent@demo.idn.sch.id')),
 (SELECT id FROM `students` WHERE nis = '2026001'), 'ayah');

-- 7. Jadwal mengajar guru di atas, Senin-Jumat 07:00-08:30 — supaya
--    endpoint teacher-attendance bisa langsung dites hari apa pun.
--    Catatan: tidak pakai INSERT IGNORE (schedules tidak punya UNIQUE
--    key kombinasi ini), jadi jalankan blok INSERT ini SEKALI saja.
--    Kalau perlu run ulang, hapus dulu manual:
--    DELETE FROM schedules WHERE teacher_id = (SELECT id FROM teachers WHERE nip = '198001012026001');
INSERT INTO `schedules` (`teacher_id`, `class_id`, `subject_id`, `day`, `start_time`, `end_time`)
SELECT
  (SELECT id FROM `teachers` WHERE nip = '198001012026001'),
  (SELECT id FROM `classes` WHERE name = 'X RPL A'),
  (SELECT id FROM `subjects` WHERE code = 'PW-01'),
  d.day, '07:00:00', '08:30:00'
FROM (
  SELECT 'monday' AS day UNION ALL SELECT 'tuesday' UNION ALL SELECT 'wednesday'
  UNION ALL SELECT 'thursday' UNION ALL SELECT 'friday'
) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM `schedules` WHERE teacher_id = (SELECT id FROM `teachers` WHERE nip = '198001012026001')
);
