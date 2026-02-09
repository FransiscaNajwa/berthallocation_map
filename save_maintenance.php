<?php
require_once 'cors_helper.php';
include 'db_config.php';

// Ambil data dari request
$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['type']) || !isset($data['startKd']) || !isset($data['endKd'])) {
    error_log("Data tidak lengkap: " . json_encode($data));
    echo json_encode(["status" => "error", "message" => "Data tidak lengkap"]);
    exit;
}

// Ambil data dari request
$id = $data['id'] ?? null;
$type = $data['type'] ?? null;
$startKd = intval($data['startKd'] ?? 0);
$endKd = intval($data['endKd'] ?? 0);
$startTime = $data['startTime'] ?? null;
$endTime = $data['endTime'] ?? null;
$keterangan = $data['keterangan'] ?? null;

error_log("Data diterima: " . json_encode($data));

// Tentukan apakah INSERT atau UPDATE
if ($id && $id !== '') {
    // UPDATE
    $sql = "UPDATE maintenance_schedules SET type = ?, startKd = ?, endKd = ?, startTime = ?, endTime = ?, keterangan = ? WHERE id = ?";
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        error_log("Prepare UPDATE failed: " . $conn->error);
        echo json_encode(["status" => "error", "message" => $conn->error]);
        exit;
    }
    
    $id = intval($id);
    $stmt->bind_param("siiissi", $type, $startKd, $endKd, $startTime, $endTime, $keterangan, $id);
    
    if ($stmt->execute()) {
        error_log("Data berhasil diupdate. ID: " . $id);
        echo json_encode(["status" => "success", "message" => "Maintenance berhasil diupdate"]);
        $stmt->close();
    } else {
        error_log("Error saat update data: " . $stmt->error);
        echo json_encode(["status" => "error", "message" => $stmt->error]);
        $stmt->close();
    }
} else {
    // INSERT
    $sql = "INSERT INTO maintenance_schedules (type, startKd, endKd, startTime, endTime, keterangan) VALUES (?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        error_log("Prepare INSERT failed: " . $conn->error);
        echo json_encode(["status" => "error", "message" => $conn->error]);
        exit;
    }
    
    $stmt->bind_param("siiiss", $type, $startKd, $endKd, $startTime, $endTime, $keterangan);
    
    if ($stmt->execute()) {
        error_log("Data berhasil disimpan ke maintenance_schedules. ID: " . $conn->insert_id);
        echo json_encode(["status" => "success", "message" => "Maintenance berhasil disimpan"]);
        $stmt->close();
    } else {
        error_log("Error saat INSERT data: " . $stmt->error);
        echo json_encode(["status" => "error", "message" => $stmt->error]);
        $stmt->close();
    }
}
?>