-- Table structure for master_ships
CREATE TABLE IF NOT EXISTS `master_ships` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `shipping_line` varchar(255) DEFAULT NULL COMMENT 'Pelayaran',
  `ship_name` varchar(255) NOT NULL COMMENT 'Nama Kapal',
  `ship_code` varchar(100) DEFAULT NULL COMMENT 'Kode Kapal',
  `voyage` varchar(100) DEFAULT NULL COMMENT 'Voyage',
  `year` varchar(10) DEFAULT NULL COMMENT 'Tahun',
  `window` varchar(100) DEFAULT NULL COMMENT 'Window',
  `length` decimal(10,2) DEFAULT NULL COMMENT 'Panjang Kapal (meter)',
  `draft` decimal(10,2) DEFAULT NULL COMMENT 'Draft Kapal (meter)',
  `destination_port` varchar(255) DEFAULT NULL COMMENT 'Destination Port',
  `next_port` varchar(255) DEFAULT NULL COMMENT 'Next Port',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ship_name` (`ship_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
