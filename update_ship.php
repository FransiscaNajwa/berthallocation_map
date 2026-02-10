<?php
require_once 'cors_helper.php';
include 'db_config.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['id'])) {
    echo json_encode(["status" => "error", "message" => "ID tidak ditemukan"]);
    exit;
}

$id = $data['id'];

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

// Lookup shipping_company_id berdasarkan nama perusahaan (seperti di save_ship.php)
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

// Type casting untuk memastikan tipe data sesuai dengan bind_param
// Perhatikan: length adalah INT di database, bukan FLOAT
$length = $length !== null && $length !== '' ? intval($length) : 0;
$draft = $draft !== null && $draft !== '' ? floatval($draft) : 0;
$startKd = $startKd !== null && $startKd !== '' ? intval($startKd) : 0;
$nKd = $nKd !== null && $nKd !== '' ? intval($nKd) : 0;
$minKd = $minKd !== null && $minKd !== '' ? intval($minKd) : 0;
$loadValue = $loadValue !== null && $loadValue !== '' ? intval($loadValue) : 0;
$dischargeValue = $dischargeValue !== null && $dischargeValue !== '' ? intval($dischargeValue) : 0;
error_log("Type casting done. length=" . $length . "(int), draft=" . $draft . "(float), startKd=" . $startKd);

// Simpan nilai sebelum bind_param
if ($bsh === '' || $bsh === null || $bsh === 'null') {
    $bsh = 0;
} else {
    $bsh = intval($bsh);
}

$sql = "UPDATE ship_schedules SET
            shipName = ?, company = ?, code = ?, voyage = ?, wsCode = ?, length = ?, draft = ?, destPort = ?,
            startKd = ?, nKd = ?, minKd = ?, loadValue = ?, dischargeValue = ?,
            etaTime = ?, startTime = ?, etcTime = ?, endTime = ?, status = ?,
            berthSide = ?, bsh = ?, qccName = ?, shipping_company_id = ?
        WHERE id = ?";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log("Prepare failed: " . $conn->error);
    echo json_encode(["status" => "error", "message" => $conn->error]);
    exit;
}

error_log("Binding parameters. Type string: ssssidsiiiiissssssisii");
$stmt->bind_param(
    "sssssidsiiiiissssssisii",
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
    $shippingCompanyId,
    $id
);

if ($stmt->execute()) {
    error_log("Update successful for ID: " . $id);
    echo json_encode(["status" => "success"]);
} else {
    error_log("Update failed for ID: " . $id . " Error: " . $stmt->error);
    echo json_encode(["status" => "error", "message" => $stmt->error]);
}
$stmt->close();
?>
