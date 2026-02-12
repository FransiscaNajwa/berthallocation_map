<?php
require_once 'cors_helper.php';
include 'db_config.php';

$response = [];

try {
    $createTableSql = "CREATE TABLE IF NOT EXISTS ship_realitation (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pelayaran VARCHAR(100) DEFAULT NULL,
        namaKapal VARCHAR(255) DEFAULT NULL,
        kodeKapal VARCHAR(100) DEFAULT NULL,
        voyage VARCHAR(100) DEFAULT NULL,
        kodeWS VARCHAR(100) DEFAULT NULL,
        panjangKapal INT DEFAULT NULL,
        draftKapal FLOAT DEFAULT NULL,
        destinationPort VARCHAR(255) DEFAULT NULL,
        nextPort VARCHAR(255) DEFAULT NULL,
        startKd INT DEFAULT NULL,
        endKd INT DEFAULT NULL,
        mean FLOAT DEFAULT NULL,
        statusKapal VARCHAR(100) DEFAULT NULL,
        berthSide VARCHAR(50) DEFAULT NULL,
        bsh INT DEFAULT NULL,
        etaTime DATETIME DEFAULT NULL,
        etbTime DATETIME DEFAULT NULL,
        etcTime DATETIME DEFAULT NULL,
        etdTime DATETIME DEFAULT NULL,
        dischargeValue INT DEFAULT NULL,
        loadValue INT DEFAULT NULL,
        qccNames TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";

    $conn->query($createTableSql);
    $result = $conn->query("SELECT * FROM ship_realitation ORDER BY created_at DESC");
    if ($result) {
        $response['realisasi'] = $result->fetch_all(MYSQLI_ASSOC);
    } else {
        $response['realisasi'] = [];
    }
    echo json_encode($response);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>