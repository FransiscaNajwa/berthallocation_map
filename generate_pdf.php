<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'db_config.php';

// Validasi input
if (!isset($_GET['type']) || !isset($_GET['startDate']) || !isset($_GET['endDate'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required parameters: type, startDate, endDate']);
    exit;
}

$type = $_GET['type'];
$startDate = $_GET['startDate'];
$endDate = $_GET['endDate'];

// Validasi tanggal format
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid date format. Use YYYY-MM-DD']);
    exit;
}

try {
    // Validasi tanggal logic
    $start = new DateTime($startDate);
    $end = new DateTime($endDate);
    
    if ($start > $end) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Start date must be before end date']);
        exit;
    }
    
    // Ambil data dari database
    $query = "SELECT * FROM ship_schedules WHERE DATE(startTime) >= ? AND DATE(startTime) <= ? ORDER BY startTime ASC";
    $stmt = $conn->prepare($query);
    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    
    $stmt->bind_param('ss', $startDate, $endDate);
    
    if (!$stmt->execute()) {
        throw new Exception("Execute failed: " . $stmt->error);
    }
    
    $result = $stmt->get_result();
    $schedules = [];
    while ($row = $result->fetch_assoc()) {
        $schedules[] = $row;
    }
    $stmt->close();
    
    // Get master ships untuk data kapal
    $queryMaster = "SELECT * FROM master_ships";
    $resultMaster = $conn->query($queryMaster);
    
    if (!$resultMaster) {
        throw new Exception("Query failed: " . $conn->error);
    }
    
    $masterShips = [];
    while ($row = $resultMaster->fetch_assoc()) {
        $masterShips[] = $row;
    }
    
    $masterShipsMap = [];
    foreach ($masterShips as $ship) {
        // Build map menggunakan berbagai kolom key yang mungkin
        if (isset($ship['code'])) {
            $masterShipsMap[$ship['code']] = $ship;
        }
        if (isset($ship['ship_code'])) {
            $masterShipsMap[$ship['ship_code']] = $ship;
        }
    }
    
    // Generate HTML untuk PDF
    $html = generatePDFHTML($schedules, $masterShipsMap, $startDate, $endDate, $type, $masterShips);
    
    echo json_encode([
        'success' => true,
        'html' => $html,
        'filename' => 'Berth-Allocation-' . $type . '-' . $startDate . '.pdf'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error: ' . $e->getMessage()]);
}

function generatePDFHTML($schedules, $masterShipsMap, $startDateStr, $endDateStr, $type, $masterShips) {
    // Parse tanggal
    $startDate = new DateTime($startDateStr);
    $endDate = new DateTime($endDateStr);
    
    // Hitung range tanggal untuk bulan
    $currentDate = clone $startDate;
    $weeks = [];
    
    while ($currentDate <= $endDate) {
        $weekEnd = clone $currentDate;
        $weekEnd->add(new DateInterval('P6D')); // +6 hari untuk total 7 hari
        
        if ($weekEnd > $endDate) {
            $weekEnd = clone $endDate;
        }
        
        $weeks[] = [
            'start' => $currentDate->format('Y-m-d'),
            'end' => $weekEnd->format('Y-m-d'),
            'display' => $currentDate->format('d M Y') . ' - ' . $weekEnd->format('d M Y')
        ];
        
        $currentDate->add(new DateInterval('P7D')); // +7 hari
    }
    
    $html = '<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.3; color: #333; }
        .page { page-break-after: always; padding: 15px; border: 1px solid #ddd; margin-bottom: 15px; }
        .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .header h1 { font-size: 16px; margin-bottom: 3px; }
        .header h2 { font-size: 12px; color: #666; margin-bottom: 2px; }
        .header p { font-size: 10px; color: #888; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; }
        th, td { border: 1px solid #999; padding: 4px; text-align: left; }
        th { background-color: #e8e8e8; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .empty-state { text-align: center; padding: 30px; color: #888; font-size: 11px; }
    </style>
</head>
<body>';
    
    foreach ($weeks as $weekInfo) {
        $weekStart = new DateTime($weekInfo['start']);
        $weekEnd = new DateTime($weekInfo['end']);
        $weekEnd->setTime(23, 59, 59); // Set ke akhir hari
        
        // Filter schedules untuk minggu ini
        $weekSchedules = array_filter($schedules, function($schedule) use ($weekStart, $weekEnd) {
            $scheduleDate = new DateTime($schedule['startTime']);
            return $scheduleDate >= $weekStart && $scheduleDate <= $weekEnd;
        });
        
        $html .= '<div class="page">
            <div class="header">
                <h1>Berth Allocation Map</h1>
                <h2>TPK Nilam</h2>
                <p>' . htmlspecialchars($weekInfo['display']) . '</p>
            </div>';
        
        if (count($weekSchedules) > 0) {
            $html .= '<table>
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Kode Kapal</th>
                        <th>Nama Kapal</th>
                        <th>Panjang</th>
                        <th>Draft</th>
                        <th>ETB</th>
                        <th>ETC</th>
                        <th>ETD</th>
                        <th>Kode WS</th>
                        <th>Voyage</th>
                    </tr>
                </thead>
                <tbody>';
            
            foreach ($weekSchedules as $schedule) {
                // Lookup master ship berdasarkan shipName
                $masterShip = [];
                foreach ($masterShips as $ms) {
                    if ($ms['ship_name'] === $schedule['shipName']) {
                        $masterShip = $ms;
                        break;
                    }
                }
                
                $startTime = new DateTime($schedule['startTime']);
                
                $html .= '<tr>
                    <td>' . htmlspecialchars($startTime->format('d/m/Y')) . '</td>
                    <td>' . htmlspecialchars($schedule['shipName'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($masterShip['ship_name'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($masterShip['length'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($masterShip['draft'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($schedule['startTime'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($schedule['etcTime'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($schedule['endTime'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($schedule['code'] ?? '-') . '</td>
                    <td>' . htmlspecialchars($schedule['voyage'] ?? '-') . '</td>
                </tr>';
            }
            
            $html .= '</tbody></table>';
        } else {
            $html .= '<div class="empty-state">Tidak ada data jadwal kapal untuk periode ini</div>';
        }
        
        $html .= '</div>';
    }
    
    $html .= '</body></html>';
    
    return $html;
}
?>

