<?php
// Pengaturan Koneksi
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'ba_map');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

// Cek Koneksi
if ($conn->connect_error) {
    header('Content-Type: application/json');
    die(json_encode(["status" => "error", "message" => "Koneksi Database Gagal"]));
}
?>