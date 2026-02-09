<?php
require_once 'cors_helper.php';
require 'db_config.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $conn->connect_error]);
    exit;
}

$query = "SELECT id, name FROM shipping_companies ORDER BY name ASC";
$result = $conn->query($query);

if ($result->num_rows > 0) {
    $shippingCompanies = [];
    while ($row = $result->fetch_assoc()) {
        $shippingCompanies[] = $row;
    }
    echo json_encode(["status" => "success", "data" => $shippingCompanies]);
} else {
    echo json_encode(["status" => "error", "message" => "No shipping companies found."]);
}

$conn->close();
?>