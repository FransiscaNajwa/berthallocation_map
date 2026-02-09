<?php
/**
 * HTTP Response Helper dengan CORS Support
 * Include file ini di awal setiap endpoint PHP
 */

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Set error reporting untuk debugging (disable di production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Jangan display error ke client
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_errors.log');

/**
 * Function untuk JSON response
 */
function jsonResponse($status = 'success', $message = '', $data = null) {
    $response = [
        'status' => $status,
        'message' => $message
    ];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Function untuk error response
 */
function jsonError($message = 'An error occurred', $httpCode = 400) {
    http_response_code($httpCode);
    jsonResponse('error', $message);
}

/**
 * Function untuk success response
 */
function jsonSuccess($message = 'Success', $data = null) {
    jsonResponse('success', $message, $data);
}

?>
