<?php
require_once 'cors_helper.php';
include 'db_config.php';

$response = [];

try {
    $data = json_decode(file_get_contents('php://input'), true);

    error_log('Input data: ' . json_encode($data));

    if (!isset($data['startTime'], $data['endTime'], $data['keterangan'])) {
        throw new Exception('Invalid input data');
    }

    $id = $data['id'] ?? null;
    $startTime = $data['startTime'];
    $endTime = $data['endTime'];
    $keterangan = $data['keterangan'];

    if ($id && $id !== '') {
        // UPDATE rest_schedules
        $sql = "UPDATE rest_schedules SET startTime = ?, endTime = ?, keterangan = ? WHERE id = ?";
        $stmt = $conn->prepare($sql);
        
        if (!$stmt) {
            error_log('Prepare UPDATE failed: ' . $conn->error);
            throw new Exception('Failed to prepare UPDATE statement: ' . $conn->error);
        }
        
        $id = intval($id);
        $stmt->bind_param("sssi", $startTime, $endTime, $keterangan, $id);
        
        if ($stmt->execute()) {
            error_log('UPDATE executed successfully for rest schedule ID: ' . $id);
            $response['status'] = 'success';
            $response['message'] = 'Break data updated successfully';
        } else {
            error_log('UPDATE failed: ' . $stmt->error);
            throw new Exception('Failed to update break data: ' . $stmt->error);
        }
        $stmt->close();
    } else {
        // INSERT rest_schedules
        $sql = "INSERT INTO rest_schedules (startTime, endTime, keterangan) VALUES (?, ?, ?)";
        $stmt = $conn->prepare($sql);
        
        if (!$stmt) {
            error_log('Prepare INSERT failed: ' . $conn->error);
            throw new Exception('Failed to prepare INSERT statement: ' . $conn->error);
        }
        
        $stmt->bind_param("sss", $startTime, $endTime, $keterangan);
        
        if ($stmt->execute()) {
            error_log('INSERT executed successfully. New rest schedule ID: ' . $conn->insert_id);
            $response['status'] = 'success';
            $response['message'] = 'Break data saved successfully';
        } else {
            error_log('INSERT failed: ' . $stmt->error);
            throw new Exception('Failed to save break data: ' . $stmt->error);
        }
        $stmt->close();
    }
} catch (Exception $e) {
    $response['status'] = 'error';
    $response['message'] = $e->getMessage();
}

echo json_encode($response);
?>