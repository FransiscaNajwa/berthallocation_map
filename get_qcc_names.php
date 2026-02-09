<?php
require_once 'cors_helper.php';
include 'db_config.php';

try {
    $qccQuery = $conn->query("SELECT id, name FROM qcc_names");
    $qccNames = $qccQuery->fetch_all(MYSQLI_ASSOC);
    echo json_encode($qccNames);
} catch (Exception $e) {
    error_log("Error fetching QCC names: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>