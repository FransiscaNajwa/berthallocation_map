<?php
require_once 'cors_helper.php';
include 'db_config.php';

error_log("Save Comm Log - START");

$data = json_decode(file_get_contents('php://input'), true);
error_log("Received data: " . json_encode($data));

if (!$data || !is_array($data)) {
    echo json_encode(["status" => "error", "message" => "Invalid data"]);
    exit;
}

try {
    // Insert atau update data (tidak menghapus semua data lama)
    $stmt = $conn->prepare("INSERT INTO communication_logs (dateTime, petugas, stakeholder, pic, remark, commChannel) 
                           VALUES (?, ?, ?, ?, ?, ?)");

    if (!$stmt) {
        error_log("Prepare failed: " . $conn->error);
        echo json_encode(["status" => "error", "message" => "Prepare failed: " . $conn->error]);
        exit;
    }

    $insertCount = 0;
    foreach ($data as $row) {
        // Skip empty rows
        if (empty($row['dateTime']) && empty($row['petugas']) && empty($row['stakeholder']) && 
            empty($row['pic']) && empty($row['remark'])) {
            continue;
        }

        $dateTime = $row['dateTime'] ?? '';
        $petugas = $row['petugas'] ?? '';
        $stakeholder = $row['stakeholder'] ?? '';
        $pic = $row['pic'] ?? '';
        $remark = $row['remark'] ?? '';
        $commChannel = $row['commChannel'] ?? 'WAG';

        $stmt->bind_param("ssssss", $dateTime, $petugas, $stakeholder, $pic, $remark, $commChannel);

        if (!$stmt->execute()) {
            error_log("Insert error: " . $stmt->error);
            echo json_encode(["status" => "error", "message" => "Insert error: " . $stmt->error]);
            exit;
        }
        $insertCount++;
    }

    $stmt->close();
    error_log("Successfully inserted " . $insertCount . " rows");
    echo json_encode(["status" => "success", "message" => "Communication log berhasil disimpan (" . $insertCount . " baris)"]);

} catch (Exception $e) {
    error_log("Exception: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
error_log("Save Comm Log - END");
?>
