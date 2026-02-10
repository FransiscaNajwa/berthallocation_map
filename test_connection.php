<?php
header('Content-Type: application/json');

// Test 1: Cek koneksi database
$tests = [];

// Konfigurasi database
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'ba_map');

// Test koneksi
$conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($conn->connect_error) {
    $tests['database'] = [
        'status' => 'GAGAL',
        'message' => 'Koneksi database gagal: ' . $conn->connect_error,
        'detail' => 'Pastikan MySQL/MariaDB sudah berjalan dan database "ba_map" sudah dibuat'
    ];
} else {
    $tests['database'] = [
        'status' => 'BERHASIL',
        'message' => 'Koneksi database berhasil!'
    ];
    
    // Test: Cek tabel ship_schedules
    $tableCheck = $conn->query("SHOW TABLES LIKE 'ship_schedules'");
    if ($tableCheck && $tableCheck->num_rows > 0) {
        $tests['table_ship_schedules'] = [
            'status' => 'BERHASIL',
            'message' => 'Tabel ship_schedules ditemukan'
        ];
        
        // Hitung jumlah data
        $count = $conn->query("SELECT COUNT(*) as total FROM ship_schedules");
        $row = $count->fetch_assoc();
        $tests['table_ship_schedules']['jumlah_data'] = $row['total'];
    } else {
        $tests['table_ship_schedules'] = [
            'status' => 'GAGAL',
            'message' => 'Tabel ship_schedules tidak ditemukan',
            'detail' => 'Jalankan file ba_map.sql untuk membuat tabel'
        ];
    }
    
    // Test: Cek tabel shipping_companies
    $companyCheck = $conn->query("SHOW TABLES LIKE 'shipping_companies'");
    if ($companyCheck && $companyCheck->num_rows > 0) {
        $count = $conn->query("SELECT COUNT(*) as total FROM shipping_companies");
        $row = $count->fetch_assoc();
        $tests['table_shipping_companies'] = [
            'status' => 'BERHASIL',
            'message' => 'Tabel shipping_companies ditemukan',
            'jumlah_data' => $row['total']
        ];
    } else {
        $tests['table_shipping_companies'] = [
            'status' => 'GAGAL',
            'message' => 'Tabel shipping_companies tidak ditemukan'
        ];
    }
    
    $conn->close();
}

// Test 2: Cek PHP
$tests['php'] = [
    'status' => 'BERHASIL',
    'message' => 'PHP berjalan dengan baik',
    'version' => phpversion()
];

// Test 3: Cek ekstensi MySQLi
$tests['mysqli_extension'] = [
    'status' => extension_loaded('mysqli') ? 'BERHASIL' : 'GAGAL',
    'message' => extension_loaded('mysqli') ? 'Ekstensi MySQLi aktif' : 'Ekstensi MySQLi tidak aktif'
];

// Output hasil test
echo json_encode([
    'timestamp' => date('Y-m-d H:i:s'),
    'tests' => $tests
], JSON_PRETTY_PRINT);
?>
