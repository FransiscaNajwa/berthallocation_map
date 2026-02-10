<?php
require_once 'cors_helper.php';
include 'db_config.php';

error_log("Save Master Ship - START");

$data = json_decode(file_get_contents('php://input'), true);
error_log("Received data: " . json_encode($data));

if (!$data) {
    echo json_encode(["status" => "error", "message" => "Invalid data"]);
    exit;
}

try {
    // Convert empty strings to NULL for numeric fields
    $length = ($data['length'] !== null && $data['length'] !== '') ? floatval($data['length']) : null;
    $draft = ($data['draft'] !== null && $data['draft'] !== '') ? floatval($data['draft']) : null;
    
    error_log("Processing ID: " . ($data['id'] ?? 'NULL'));
    
    if (isset($data['id']) && $data['id'] !== null && $data['id'] !== '' && $data['id'] > 0) {
        // Update existing ship
        error_log("UPDATE MODE - ID: " . $data['id']);
        $stmt = $conn->prepare("UPDATE master_ships SET 
            shipping_line = ?, ship_name = ?, ship_code = ?, voyage = ?, 
            year = ?, window = ?, length = ?, draft = ?, 
            destination_port = ?, next_port = ?
            WHERE id = ?");
        
        $stmt->bind_param("ssssssddssi",
            $data['shipping_line'],
            $data['ship_name'],
            $data['ship_code'],
            $data['voyage'],
            $data['year'],
            $data['window'],
            $length,
            $draft,
            $data['destination_port'],
            $data['next_port'],
            $data['id']
        );
        
        if ($stmt->execute()) {
            error_log("Master ship updated successfully, ID: " . $data['id']);
            echo json_encode(["status" => "success", "message" => "Data kapal berhasil diupdate", "id" => $data['id']]);
        } else {
            error_log("Update error: " . $stmt->error);
            echo json_encode(["status" => "error", "message" => "Gagal update: " . $stmt->error]);
        }
    } else {
        // Insert new ship
        error_log("INSERT MODE - Adding new ship: " . $data['ship_name']);
        $stmt = $conn->prepare("INSERT INTO master_ships 
            (shipping_line, ship_name, ship_code, voyage, year, window, length, draft, destination_port, next_port) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $stmt->bind_param("ssssssddss",
            $data['shipping_line'],
            $data['ship_name'],
            $data['ship_code'],
            $data['voyage'],
            $data['year'],
            $data['window'],
            $length,
            $draft,
            $data['destination_port'],
            $data['next_port']
        );
        
        if ($stmt->execute()) {
            $insertId = $conn->insert_id;
            error_log("Master ship inserted successfully, ID: " . $insertId);
            echo json_encode(["status" => "success", "message" => "Data kapal berhasil disimpan", "id" => $insertId]);
        } else {
            error_log("Insert error: " . $stmt->error);
            echo json_encode(["status" => "error", "message" => "Gagal menyimpan: " . $stmt->error]);
        }
    }
    
    $stmt->close();
} catch (Exception $e) {
    error_log("Exception: " . $e->getMessage());
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
error_log("Save Master Ship - END");
?>
