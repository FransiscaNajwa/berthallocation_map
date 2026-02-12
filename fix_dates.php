<?php
include 'db_config.php';

// Update ghjj with valid dates
$sql = "UPDATE ship_schedules SET 
    etaTime='2026-02-09 10:00:00', 
    endTime='2026-02-10 05:00:00', 
    startTime='2026-02-09 11:00:00', 
    etcTime='2026-02-10 03:00:00' 
    WHERE shipName='ghjj'";

if ($conn->query($sql)) {
    echo "✅ Update successful! Ship 'ghjj' dates updated.<br>";
    
    // Verify the update
    $result = $conn->query("SELECT shipName, etaTime, endTime FROM ship_schedules WHERE shipName='ghjj'");
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        echo "Updated record: " . json_encode($row) . "<br>";
    }
} else {
    echo "❌ Error: " . $conn->error;
}
?>
