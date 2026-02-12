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

// ========== VALIDASI DUPLIKASI KOMBINASI KAPAL + VOYAGE + WS CODE ==========
// Cek apakah kombinasi shipName + voyage + wsCode sudah ada
$checkDuplicateQuery = "SELECT id FROM ship_schedules 
                        WHERE shipName = ? AND voyage = ? AND wsCode = ?
                        LIMIT 1";
$duplicateStmt = $conn->prepare($checkDuplicateQuery);
if (!$duplicateStmt) {
    error_log("Prepare failed (check duplicate): " . $conn->error);
    echo json_encode(["status" => "error", "message" => "Database error"]);
    exit;
}
$duplicateStmt->bind_param("sss", $shipName, $voyage, $wsCode);
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

// ========== VALIDASI JADWAL BERTUMPUKAN ==========
// ATURAN VALIDASI (LENGKAP):
// ✅ BOLEH: Tanggal sama + Jam BEDA + KD meter SAMA → BOLEH (kapal di lokasi sama tapi waktu berbeda)
// ✅ BOLEH: Tanggal sama + Jam BEDA + KD meter BEDA → BOLEH
// ✅ BOLEH: Tanggal sama + Jam SAMA + KD meter BEDA (tidak overlap) → BOLEH (kapal di waktu sama tapi lokasi berbeda)
// ✅ BOLEH: Tanggal BEDA + apapun kondisinya → BOLEH
// ❌ TIDAK BOLEH: Tanggal SAMA + Jam SAMA/HAMPIR SAMA + KD meter BERTUMPUKAN → DITOLAK
//
// KESIMPULAN:
// Yang DITOLAK hanya jika KETIGA kondisi ini terpenuhi BERSAMAAN:
// 1. Tanggal sama (hari yang sama)
// 2. Jam sama atau hampir sama (selisih waktu < 1 jam)
// 3. KD meter bertumpukan/overlap (ada bagian KD yang sama)
//
// Contoh BOLEH:
// - Kapal A: KD 100-200, 12 Feb 10:00-14:00
// - Kapal B: KD 100-200, 12 Feb 16:00-20:00 ✅ (jam beda > 1 jam, meski KD sama)
//
// Contoh DITOLAK:
// - Kapal A: KD 100-200, 12 Feb 10:00-14:00
// - Kapal B: KD 150-250, 12 Feb 10:30-15:00 ❌ (tanggal sama + jam hampir sama + KD overlap 150-200)

// Cek apakah ada jadwal yang bertumpukan berdasarkan KD meter, tanggal, dan jam
// $endKd sudah dihitung di validasi batas KD meter di atas

// Konversi waktu ke timestamp untuk perbandingan
$newStartTimestamp = strtotime($startTime);
$newEndTimestamp = strtotime($endTime);

// Extract tanggal dari startTime (YYYY-MM-DD)
$newStartDate = date('Y-m-d', $newStartTimestamp);

// Query untuk mendapatkan jadwal yang mungkin bertumpukan
$checkOverlapQuery = "SELECT id, shipName, startKd, nKd, startTime, endTime 
                      FROM ship_schedules 
                      WHERE status != 'completed'";

$overlapResult = $conn->query($checkOverlapQuery);
if (!$overlapResult) {
    error_log("Error checking overlap: " . $conn->error);
    echo json_encode(["status" => "error", "message" => "Error checking schedule overlap"]);
    exit;
}

$hasOverlap = false;
$overlapDetails = [];
$TIME_TOLERANCE = 3600; // 1 jam dalam detik (untuk toleransi "hampir sama")

while ($row = $overlapResult->fetch_assoc()) {
    $existingStartKd = intval($row['startKd']);
    $existingNKd = intval($row['nKd']);
    $existingEndKd = $existingStartKd + $existingNKd;
    
    $existingStartTimestamp = strtotime($row['startTime']);
    $existingEndTimestamp = strtotime($row['endTime']);
    $existingStartDate = date('Y-m-d', $existingStartTimestamp);
    
    // Cek apakah KD meter bertumpukan (overlap)
    // KD bertumpukan jika: startKd baru < endKd existing DAN endKd baru > startKd existing
    $kdOverlap = !($endKd <= $existingStartKd || $startKd >= $existingEndKd);
    
    // Cek apakah waktu bertumpukan (overlap penuh)
    $timeOverlap = !($newEndTimestamp <= $existingStartTimestamp || $newStartTimestamp >= $existingEndTimestamp);
    
    // Cek apakah waktu "hampir sama" (dalam toleransi 1 jam)
    $startTimeDiff = abs($newStartTimestamp - $existingStartTimestamp);
    $timeAlmostSame = $startTimeDiff < $TIME_TOLERANCE;
    
    // Cek apakah tanggal sama
    $sameDateSameTime = ($newStartDate === $existingStartDate);
    
    // KONDISI TIDAK DIPERBOLEHKAN:
    // 1. Jam sama/hampir sama + Tanggal sama + KD meter sama/bertumpukan
    // 2. Jam sama/hampir sama + Tanggal sama + KD meter bertumpukan
    
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

if ($hasOverlap) {
    error_log("Schedule overlap detected: " . json_encode($overlapDetails));
    echo json_encode([
        "status" => "error", 
        "message" => "Jadwal kapal bertumpukan dengan jadwal yang sudah ada. Tidak dapat menambahkan jadwal.",
        "overlap_details" => $overlapDetails
    ]);
    exit;
}

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
