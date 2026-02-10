<?php
require_once 'cors_helper.php';
include 'db_config.php';
error_reporting(E_ALL);
ini_set('display_errors', 0);

// PENTING: Baca php://input SEKALI saja dan store ke variable
$rawInput = file_get_contents('php://input');
error_log("Payload mentah: " . $rawInput);

// Decode JSON and handle errors
$data = json_decode($rawInput, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("JSON decode error: " . json_last_error_msg() . " | Raw input: " . $rawInput);
    echo json_encode(["status" => "error", "message" => "Invalid JSON payload: " . json_last_error_msg()]);
    exit;
}

// Validasi payload tidak kosong
if (!$data) {
    error_log("Payload JSON tidak valid atau kosong.");
    echo json_encode(["status" => "error", "message" => "Payload JSON tidak valid atau kosong."]);
    exit;
}

// Validasi koneksi database
if (!$conn) {
    error_log("Database connection error");
    echo json_encode(["status" => "error", "message" => "Database connection error"]);
    exit;
}

// Validasi required fields dengan cara yang lebih efisien
$requiredFields = ['shipName', 'company', 'code', 'voyage', 'length', 'draft', 'destPort', 'startKd', 
                   'nKd', 'minKd', 'loadValue', 'dischargeValue', 'etaTime', 'startTime', 
                   'etcTime', 'endTime', 'status', 'berthSide', 'bsh', 'qccName'];

foreach ($requiredFields as $field) {
    if (!isset($data[$field])) {
        error_log("Field '$field' tidak ditemukan dalam payload.");
        echo json_encode(["status" => "error", "message" => "Field '$field' tidak ditemukan."]);
        exit;
    }
}

// Extract values dari $data array ke variables
$shipName = $data['shipName'] ?? null;
$company = $data['company'] ?? null;
$code = $data['code'] ?? null;
$voyage = $data['voyage'] ?? null;
$wsCode = $data['wsCode'] ?? null;
$length = $data['length'] ?? null;
$draft = $data['draft'] ?? null;
$destPort = $data['destPort'] ?? null;
$startKd = $data['startKd'] ?? null;
$nKd = $data['nKd'] ?? null;
$minKd = $data['minKd'] ?? null;
$loadValue = $data['loadValue'] ?? 0;
$dischargeValue = $data['dischargeValue'] ?? 0;
$etaTime = $data['etaTime'] ?? null;
$startTime = $data['startTime'] ?? null;
$etcTime = $data['etcTime'] ?? null;
$endTime = $data['endTime'] ?? null;
$status = $data['status'] ?? null;
$berthSide = $data['berthSide'] ?? null;
$bsh = $data['bsh'] ?? null;
$qccName = $data['qccName'] ?? null;

// Validasi shipping_company_id berdasarkan nama perusahaan pelayaran
$shippingCompanyId = null;
if ($company !== null && $company !== '') {
    $lookupCompany = $conn->prepare("SELECT id FROM shipping_companies WHERE name = ? LIMIT 1");
    if (!$lookupCompany) {
        error_log("Prepare failed (lookup shipping company): " . $conn->error);
        echo json_encode(["status" => "error", "message" => $conn->error]);
        exit;
    }
    $lookupCompany->bind_param("s", $company);
    $lookupCompany->execute();
    $lookupCompany->bind_result($foundCompanyId);

    if ($lookupCompany->fetch()) {
        $shippingCompanyId = $foundCompanyId;
        error_log("Shipping company ditemukan: ID = " . $shippingCompanyId);
    } else {
        error_log("Shipping company tidak ditemukan: " . $company);
        echo json_encode(["status" => "error", "message" => "Perusahaan pelayaran tidak ditemukan. Pastikan tabel shipping_companies terisi."]);
        exit;
    }
    $lookupCompany->close();
}

// Fetch QCC names from the database (untuk log saja, tidak untuk validasi ketat)
$qccNames = [];
$qccQuery = $conn->query("SELECT name FROM qcc_names");
if ($qccQuery) {
    while ($row = $qccQuery->fetch_assoc()) {
        $qccNames[] = $row['name'];
    }
    error_log("Available QCC names: " . json_encode($qccNames));
} else {
    // Tabel qcc_names mungkin belum ada, tapi biarkan proses lanjut
    error_log("Table qcc_names tidak ditemukan atau error: " . $conn->error);
}

// Type casting untuk memastikan tipe data sesuai dengan bind_param
// Perhatikan: length adalah INT di database, bukan FLOAT
$length = $length !== null && $length !== '' ? intval($length) : 0;
$draft = $draft !== null && $draft !== '' ? floatval($draft) : 0;
$berthLocation = $berthLocation !== null && $berthLocation !== '' ? intval($berthLocation) : 0;
$nKd = $nKd !== null && $nKd !== '' ? intval($nKd) : 0;
$minKd = $minKd !== null && $minKd !== '' ? intval($minKd) : 0;
$loadValue = $loadValue !== null && $loadValue !== '' ? intval($loadValue) : 0;
$dischargeValue = $dischargeValue !== null && $dischargeValue !== '' ? intval($dischargeValue) : 0;
error_log("Type casting done. length=" . $length . "(int), draft=" . $draft . "(float)");

// Query untuk menyisipkan data (dengan startKd dan shipping_company_id)
$sql = "INSERT INTO ship_schedules (
            shipName, company, code, voyage, wsCode, length, draft, destPort, startKd, nKd, minKd,
            loadValue, dischargeValue, etaTime, startTime, etcTime, endTime, status,
            berthSide, bsh, qccName, shipping_company_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";;

$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log("Prepare failed: " . $conn->error);
    echo json_encode(["status" => "error", "message" => $conn->error]);
    exit;
}

// Pastikan bsh adalah integer atau null, konversi string ke int
if ($bsh === '' || $bsh === null || $bsh === 'null') {
    $bsh = 0;
} else {
    $bsh = intval($bsh);
}

$stmt->bind_param(
    "sssssidsiiiiissssssisi",
    $shipName,
    $company,
    $code,
    $voyage,
    $wsCode,
    $length,
    $draft,
    $destPort,
    $startKd,
    $nKd,
    $minKd,
    $loadValue,
    $dischargeValue,
    $etaTime,
    $startTime,
    $etcTime,
    $endTime,
    $status,
    $berthSide,
    $bsh,
    $qccName,
    $shippingCompanyId
);

if ($stmt->execute()) {
    error_log("Data berhasil disimpan ke database");
    echo json_encode(["status" => "success"]);
} else {
    error_log("Error saat menyimpan data: " . $stmt->error);
    echo json_encode(["status" => "error", "message" => $stmt->error]);
}
$stmt->close();
error_log("Data diterima: " . json_encode($data));
?>
