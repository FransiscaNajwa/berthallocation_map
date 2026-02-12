<?php
require_once 'cors_helper.php';
include 'db_config.php';

error_log("Fetching data from database...");

$response = [];

try {
    // Ambil semua data dari tabel ship_schedules dengan SEMUA field names (original untuk BA MAP + baru untuk Realisasi)
    $ships = $conn->query("
        SELECT 
            id,
            company,
            shipName,
            code,
            wsCode,
            voyage,
            length,
            draft,
            destPort,
            nKd,
            minKd,
            mean,
            loadValue,
            dischargeValue,
            etaTime,
            startTime,
            etcTime,
            endTime,
            status,
            berthSide,
            bsh,
            qccName,
            created_at,
            shipping_company_id,
            startKd
        FROM ship_schedules 
        ORDER BY etaTime ASC
    ");
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

    // Ambil semua data dari tabel communication_logs
    $commLogs = $conn->query("SELECT * FROM communication_logs ORDER BY id ASC");
    if ($commLogs) {
        $response['communicationLogs'] = $commLogs->fetch_all(MYSQLI_ASSOC);
        error_log("Communication logs fetched: " . json_encode($response['communicationLogs']));
    } else {
        error_log("Communication logs query failed: " . $conn->error);
        $response['communicationLogs'] = [];
    }

    echo json_encode($response);
} catch (Exception $e) {
    error_log("Error fetching data: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>

