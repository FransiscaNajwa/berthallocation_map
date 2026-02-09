<?php
require_once 'cors_helper.php';
include 'db_config.php';

error_log("Get Comm Log - START");

try {
    // Check apakah table ada
    $tableCheck = $conn->query("SHOW TABLES LIKE 'communication_logs'");
    if (!$tableCheck || $tableCheck->num_rows === 0) {
        error_log("Table communication_logs tidak ada");
        echo json_encode(["status" => "error", "message" => "Table not found"]);
        exit;
    }

    $result = $conn->query("SELECT id, dateTime, petugas, stakeholder, pic, remark, commChannel FROM communication_logs ORDER BY id ASC");

    if (!$result) {
        error_log("Query failed: " . $conn->error);
        echo json_encode(["status" => "error", "message" => "Query failed: " . $conn->error]);
        exit;
    }

    $commLogs = [];
    while ($row = $result->fetch_assoc()) {
        $commLogs[] = $row;
    }

    error_log("Found " . count($commLogs) . " communication log entries");
    
    echo json_encode([
        "status" => "success",
        "data" => $commLogs
    ]);

} catch (Exception $e) {
    error_log("Exception: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
error_log("Get Comm Log - END");
?>
