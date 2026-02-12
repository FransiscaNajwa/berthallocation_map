<?php
require_once 'cors_helper.php';
include 'db_config.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(["status" => "error", "message" => "Invalid JSON payload"]);
    exit;
}

// Create table if not exists
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

if (!$conn->query($createTableSql)) {
    echo json_encode(["status" => "error", "message" => "Failed to create table: " . $conn->error]);
    exit;
}

function toDateTime($value) {
    if (!$value) return null;
    return str_replace('T', ' ', $value);
}

$payload = [
    'id' => is_numeric($input['id'] ?? null) ? (int)$input['id'] : null,
    'pelayaran' => $input['pelayaran'] ?? null,
    'namaKapal' => $input['namaKapal'] ?? null,
    'kodeKapal' => $input['kodeKapal'] ?? null,
    'voyage' => $input['voyage'] ?? null,
    'kodeWS' => $input['kodeWS'] ?? null,
    'panjangKapal' => is_numeric($input['panjangKapal'] ?? null) ? (int)$input['panjangKapal'] : null,
    'draftKapal' => is_numeric($input['draftKapal'] ?? null) ? (float)$input['draftKapal'] : null,
    'destinationPort' => $input['destinationPort'] ?? null,
    'nextPort' => $input['nextPort'] ?? null,
    'startKd' => is_numeric($input['startKd'] ?? null) ? (int)$input['startKd'] : null,
    'endKd' => is_numeric($input['endKd'] ?? null) ? (int)$input['endKd'] : null,
    'mean' => is_numeric($input['mean'] ?? null) ? (float)$input['mean'] : null,
    'statusKapal' => $input['statusKapal'] ?? null,
    'berthSide' => $input['berthSide'] ?? null,
    'bsh' => is_numeric($input['bsh'] ?? null) ? (int)$input['bsh'] : null,
    'etaTime' => toDateTime($input['etaTime'] ?? null),
    'etbTime' => toDateTime($input['etbTime'] ?? null),
    'etcTime' => toDateTime($input['etcTime'] ?? null),
    'etdTime' => toDateTime($input['etdTime'] ?? null),
    'dischargeValue' => is_numeric($input['discharge'] ?? null) ? (int)$input['discharge'] : null,
    'loadValue' => is_numeric($input['loading'] ?? null) ? (int)$input['loading'] : null,
    'qccNames' => $input['qccNames'] ?? null,
];

if (!empty($payload['id'])) {
    $stmt = $conn->prepare("UPDATE ship_realitation SET
        pelayaran = ?,
        namaKapal = ?,
        kodeKapal = ?,
        voyage = ?,
        kodeWS = ?,
        panjangKapal = ?,
        draftKapal = ?,
        destinationPort = ?,
        nextPort = ?,
        startKd = ?,
        endKd = ?,
        mean = ?,
        statusKapal = ?,
        berthSide = ?,
        bsh = ?,
        etaTime = ?,
        etbTime = ?,
        etcTime = ?,
        etdTime = ?,
        dischargeValue = ?,
        loadValue = ?,
        qccNames = ?
        WHERE id = ?");

    if (!$stmt) {
        echo json_encode(["status" => "error", "message" => "Prepare failed: " . $conn->error]);
        exit;
    }

    $stmt->bind_param(
        "sssssidssiidssissssiisi",
        $payload['pelayaran'],
        $payload['namaKapal'],
        $payload['kodeKapal'],
        $payload['voyage'],
        $payload['kodeWS'],
        $payload['panjangKapal'],
        $payload['draftKapal'],
        $payload['destinationPort'],
        $payload['nextPort'],
        $payload['startKd'],
        $payload['endKd'],
        $payload['mean'],
        $payload['statusKapal'],
        $payload['berthSide'],
        $payload['bsh'],
        $payload['etaTime'],
        $payload['etbTime'],
        $payload['etcTime'],
        $payload['etdTime'],
        $payload['dischargeValue'],
        $payload['loadValue'],
        $payload['qccNames'],
        $payload['id']
    );

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "id" => $payload['id']]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }

    $stmt->close();
} else {
    $stmt = $conn->prepare("INSERT INTO ship_realitation 
        (pelayaran, namaKapal, kodeKapal, voyage, kodeWS, panjangKapal, draftKapal, destinationPort, nextPort, startKd, endKd, mean, statusKapal, berthSide, bsh, etaTime, etbTime, etcTime, etdTime, dischargeValue, loadValue, qccNames)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    if (!$stmt) {
        echo json_encode(["status" => "error", "message" => "Prepare failed: " . $conn->error]);
        exit;
    }

    $stmt->bind_param(
        "sssssidssiidssissssiis",
        $payload['pelayaran'],
        $payload['namaKapal'],
        $payload['kodeKapal'],
        $payload['voyage'],
        $payload['kodeWS'],
        $payload['panjangKapal'],
        $payload['draftKapal'],
        $payload['destinationPort'],
        $payload['nextPort'],
        $payload['startKd'],
        $payload['endKd'],
        $payload['mean'],
        $payload['statusKapal'],
        $payload['berthSide'],
        $payload['bsh'],
        $payload['etaTime'],
        $payload['etbTime'],
        $payload['etcTime'],
        $payload['etdTime'],
        $payload['dischargeValue'],
        $payload['loadValue'],
        $payload['qccNames']
    );

    if ($stmt->execute()) {
        echo json_encode(["status" => "success", "id" => $stmt->insert_id]);
    } else {
        echo json_encode(["status" => "error", "message" => $stmt->error]);
    }

    $stmt->close();
}
?>