-- ============================================================
-- Migration 004 — Phase 14 (Face Verification)
--
-- Seed/upsert setting baru di `school_settings` supaya fitur face
-- verification bisa di-toggle dan threshold-nya diatur admin lewat
-- endpoint PUT /api/school-settings/:key yang sudah ada (Phase 8),
-- tanpa perlu redeploy.
-- ============================================================

INSERT INTO `school_settings` (`setting_key`, `setting_value`, `description`) VALUES
('face_verification_enabled', 'false', 'Aktif/nonaktifkan validasi verifikasi wajah saat siswa check-in/check-out'),
('face_match_threshold', '0.6', 'Ambang batas skor kemiripan wajah (cosine similarity, 0-1) — di atas ini dianggap cocok')
ON DUPLICATE KEY UPDATE
  `setting_value` = `setting_value`; -- no-op kalau key sudah ada — jangan timpa nilai yang sudah diatur admin
