<?php
require_once 'cors_helper.php';
include 'db_config.php';

error_log("Fetching data from database...");

$response = [];

try {
    // Ambil semua data dari tabel ship_schedules tanpa join ke berths
    $ships = $conn->query("SELECT * FROM ship_schedules ORDER BY etaTime ASC");
    $response['shipSchedules'] = $ships->fetch_all(MYSQLI_ASSOC);

    error_log("Ship schedules fetched: " . json_encode($response['shipSchedules']));

    // Ambil semua data dari tabel maintenance_schedules
    $maintenance = $conn->query("SELECT * FROM maintenance_schedules ORDER BY startTime ASC");
    $response['maintenanceSchedules'] = $maintenance->fetch_all(MYSQLI_ASSOC);

    error_log("Maintenance schedules fetched: " . json_encode($response['maintenanceSchedules']));

    // Ambil semua data dari tabel rest_schedules
    $rest = $conn->query("SELECT * FROM rest_schedules ORDER BY startTime ASC");
    $response['restSchedules'] = $rest->fetch_all(MYSQLI_ASSOC);

    error_log("Rest schedules fetched: " . json_encode($response['restSchedules']));

    echo json_encode($response);
} catch (Exception $e) {
    error_log("Error fetching data: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
