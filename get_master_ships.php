<?php
require_once 'cors_helper.php';
include 'db_config.php';

error_log("Get Master Ships - START");

try {
    $result = $conn->query("SELECT * FROM master_ships ORDER BY ship_name ASC");

    if (!$result) {
        error_log("Query failed: " . $conn->error);
        echo json_encode(["status" => "error", "message" => "Query failed: " . $conn->error]);
        exit;
    }

    $ships = [];
    while ($row = $result->fetch_assoc()) {
        $ships[] = $row;
    }

    error_log("Found " . count($ships) . " master ships");
    
    echo json_encode([
        "status" => "success",
        "data" => $ships
    ]);

} catch (Exception $e) {
    error_log("Exception: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
error_log("Get Master Ships - END");
?>
