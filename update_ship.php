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

// ========== VALIDASI DUPLIKASI KOMBINASI KAPAL + VOYAGE + WS CODE ==========
// Cek apakah kombinasi shipName + voyage + wsCode sudah ada (exclude ID yang sedang diedit)
$checkDuplicateQuery = "SELECT id FROM ship_schedules 
                        WHERE shipName = ? AND voyage = ? AND wsCode = ? AND id != ?
                        LIMIT 1";
$duplicateStmt = $conn->prepare($checkDuplicateQuery);
if (!$duplicateStmt) {
    error_log("Prepare failed (check duplicate): " . $conn->error);
    echo json_encode(["status" => "error", "message" => "Database error"]);
    exit;
}
$duplicateStmt->bind_param("sssi", $shipName, $voyage, $wsCode, $id);
$duplicateStmt->execute();
$duplicateStmt->store_result();

if ($duplicateStmt->num_rows > 0) {
    error_log("Duplicate ship schedule: " . $shipName . " - Voyage: " . $voyage . " - WS: " . $wsCode);
    echo json_encode([
        "status" => "error",
        "message" => "Kapal \"" . $shipName . "\" dengan Voyage \"" . $voyage . "\" dan WS Code \"" . $wsCode . "\" sudah terdaftar!"
    ]);
    $duplicateStmt->close();
    exit;
}
$duplicateStmt->close();

// ========== VALIDASI BATAS KD METER ==========
// Batas maksimal KD meter di dermaga adalah 650m
$MAX_KD = 650;
$endKd = $startKd + $nKd;

if ($startKd < 0) {
    error_log("StartKd tidak valid: " . $startKd);
    echo json_encode(["status" => "error", "message" => "Start KD tidak boleh kurang dari 0"]);
    exit;
}

if ($nKd <= 0) {
    error_log("nKd tidak valid: " . $nKd);
    echo json_encode(["status" => "error", "message" => "Panjang kapal (N-KD) harus lebih dari 0"]);
    exit;
}

if ($endKd > $MAX_KD) {
    error_log("EndKd melebihi batas: startKd=" . $startKd . ", nKd=" . $nKd . ", endKd=" . $endKd);
    echo json_encode([
        "status" => "error", 
        "message" => "KD meter melebihi batas maksimal dermaga!\n\nStart KD: " . $startKd . "m\nPanjang Kapal (N-KD): " . $nKd . "m\nEnd KD: " . $endKd . "m\n\nBatas maksimal: " . $MAX_KD . "m\n\nSilakan kurangi Start KD atau panjang kapal."
    ]);
    exit;
}

// ========== VALIDASI JADWAL BERTUMPUKAN (UNTUK UPDATE) ==========
// ATURAN VALIDASI (SAMA SEPERTI CREATE):
// ✅ BOLEH: Tanggal sama + Jam BEDA + KD meter SAMA → BOLEH
// ✅ BOLEH: Tanggal sama + Jam SAMA + KD meter BEDA → BOLEH
// ❌ TIDAK BOLEH: Tanggal SAMA + Jam SAMA/HAMPIR SAMA + KD meter BERTUMPUKAN → DITOLAK
//
// PENTING: Saat update, kita IGNORE record yang sedang di-edit (berdasarkan ID)

// $endKd sudah dihitung di validasi batas KD meter di atas
$newStartTimestamp = strtotime($startTime);
$newEndTimestamp = strtotime($endTime);
$newStartDate = date('Y-m-d', $newStartTimestamp);

// Query untuk mendapatkan jadwal yang mungkin bertumpukan (KECUALI record yang sedang di-edit)
$checkOverlapQuery = "SELECT id, shipName, startKd, nKd, startTime, endTime 
                      FROM ship_schedules 
                      WHERE status != 'completed' 
                      AND id != ?";

$overlapStmt = $conn->prepare($checkOverlapQuery);
if (!$overlapStmt) {
    error_log("Error preparing overlap check: " . $conn->error);
    echo json_encode(["status" => "error", "message" => "Error checking schedule overlap"]);
    exit;
}

$overlapStmt->bind_param("i", $id);
$overlapStmt->execute();
$overlapResult = $overlapStmt->get_result();

$hasOverlap = false;
$overlapDetails = [];
$TIME_TOLERANCE = 3600; // 1 jam dalam detik

while ($row = $overlapResult->fetch_assoc()) {
    $existingStartKd = intval($row['startKd']);
    $existingNKd = intval($row['nKd']);
    $existingEndKd = $existingStartKd + $existingNKd;
    
    $existingStartTimestamp = strtotime($row['startTime']);
    $existingEndTimestamp = strtotime($row['endTime']);
    $existingStartDate = date('Y-m-d', $existingStartTimestamp);
    
    // Cek apakah KD meter bertumpukan
    $kdOverlap = !($endKd <= $existingStartKd || $startKd >= $existingEndKd);
    
    // Cek apakah waktu bertumpukan
    $timeOverlap = !($newEndTimestamp <= $existingStartTimestamp || $newStartTimestamp >= $existingEndTimestamp);
    
    // Cek apakah waktu hampir sama
    $startTimeDiff = abs($newStartTimestamp - $existingStartTimestamp);
    $timeAlmostSame = $startTimeDiff < $TIME_TOLERANCE;
    
    // Cek apakah tanggal sama
    $sameDateSameTime = ($newStartDate === $existingStartDate);
    
    // TIDAK DIPERBOLEHKAN: Tanggal sama + Jam sama/hampir sama + KD meter bertumpukan
    if ($sameDateSameTime && $kdOverlap && ($timeOverlap || $timeAlmostSame)) {
        $hasOverlap = true;
        
        $reasonParts = [];
        $reasonParts[] = "Tanggal sama: " . $newStartDate;
        
        if ($timeOverlap) {
            $reasonParts[] = "Waktu bertumpukan: " . 
                date('H:i', $newStartTimestamp) . "-" . date('H:i', $newEndTimestamp) . 
                " vs " . 
                date('H:i', $existingStartTimestamp) . "-" . date('H:i', $existingEndTimestamp);
        } else if ($timeAlmostSame) {
            $reasonParts[] = "Waktu hampir sama (selisih < 1 jam): " . 
                date('H:i', $newStartTimestamp) . " vs " . date('H:i', $existingStartTimestamp);
        }
        
        $reasonParts[] = "KD meter bertumpukan: KD " . $startKd . "-" . $endKd . 
                        " vs KD " . $existingStartKd . "-" . $existingEndKd;
        
        // Tambahkan warning jika data existing juga melebihi batas 650m
        if ($existingEndKd > $MAX_KD) {
            $reasonParts[] = "⚠️ PERHATIAN: Data existing juga melebihi batas " . $MAX_KD . "m (perlu diperbaiki)";
        }
        
        $overlapDetails[] = [
            'id' => $row['id'],
            'shipName' => $row['shipName'],
            'startKd' => $existingStartKd,
            'endKd' => $existingEndKd,
            'startTime' => $row['startTime'],
            'endTime' => $row['endTime'],
            'reason' => implode(', ', $reasonParts),
            'exceedsLimit' => $existingEndKd > $MAX_KD  // Flag untuk data yang melebihi batas
        ];
    }
}

$overlapStmt->close();

if ($hasOverlap) {
    error_log("Schedule overlap detected during update: " . json_encode($overlapDetails));
    echo json_encode([
        "status" => "error", 
        "message" => "Jadwal kapal bertumpukan dengan jadwal yang sudah ada. Tidak dapat mengupdate jadwal.",
        "overlap_details" => $overlapDetails
    ]);
    exit;
}

// Jika tidak ada overlap, lanjutkan dengan UPDATE
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
