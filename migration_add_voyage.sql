-- Migration: Tambahkan kolom voyage ke tabel ship_schedules
-- Jalankan query ini di phpMyAdmin atau MySQL client jika kolom voyage belum ada

ALTER TABLE ship_schedules ADD COLUMN voyage varchar(100) DEFAULT NULL AFTER code;
