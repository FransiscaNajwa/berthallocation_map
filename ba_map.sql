-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 09, 2026 at 03:25 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ba_map`
--

-- --------------------------------------------------------

--
-- Table structure for table `communication_logs`
--

CREATE TABLE `communication_logs` (
  `id` int(11) NOT NULL,
  `dateTime` varchar(100) DEFAULT NULL,
  `petugas` varchar(100) DEFAULT NULL,
  `stakeholder` varchar(100) DEFAULT NULL,
  `pic` varchar(100) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `commChannel` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `maintenance_schedules`
--

CREATE TABLE `maintenance_schedules` (
  `id` int(11) NOT NULL,
  `type` enum('maintenance','no-vessel') DEFAULT 'maintenance',
  `startKd` int(11) DEFAULT NULL,
  `endKd` int(11) DEFAULT NULL,
  `startTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `keterangan` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `maintenance_schedules`
--

INSERT INTO `maintenance_schedules` (`id`, `type`, `startKd`, `endKd`, `startTime`, `endTime`, `keterangan`) VALUES
(7, 'maintenance', 350, 400, '2026-02-06 08:47:00', '2026-02-07 09:48:00', 'yy'),
(8, 'maintenance', 450, 500, '2026-02-06 11:38:00', '2026-02-07 14:41:00', 'thg'),
(10, 'maintenance', 350, 400, '0000-00-00 00:00:00', '2026-02-09 22:52:00', 'perbaikan feeder'),
(11, 'maintenance', 350, 400, '0000-00-00 00:00:00', '2026-02-09 09:03:00', 'rtyui');

-- --------------------------------------------------------

--
-- Table structure for table `qcc_names`
--

CREATE TABLE `qcc_names` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `qcc_names`
--

INSERT INTO `qcc_names` (`id`, `name`) VALUES
(1, 'QCC01'),
(2, 'QCC02'),
(3, 'QCC03'),
(4, 'QCC04');

-- --------------------------------------------------------

--
-- Table structure for table `rest_schedules`
--

CREATE TABLE `rest_schedules` (
  `id` int(11) NOT NULL,
  `startTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `keterangan` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rest_schedules`
--

INSERT INTO `rest_schedules` (`id`, `startTime`, `endTime`, `keterangan`) VALUES
(4, '2026-02-06 11:17:00', '2026-02-06 12:19:00', 'sg');

-- --------------------------------------------------------

--
-- Table structure for table `shipping_companies`
--

CREATE TABLE `shipping_companies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) NOT NULL,
  `flag_image` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `shipping_companies`
--

INSERT INTO `shipping_companies` (`id`, `name`, `code`, `flag_image`) VALUES
(1, 'SPIL', 'SPIL', NULL),
(2, 'CTP', 'CTP', NULL),
(3, 'MERATUS', 'MERATUS', NULL),
(4, 'TANTO', 'TANTO', NULL),
(5, 'PPNP', 'PPNP', NULL),
(6, 'ICON', 'ICON', NULL),
(7, 'TEMAS LINE', 'TEMAS', NULL),
(8, 'LAINNYA', 'LAINNYA', NULL),
(9, 'Test Company', '', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `ship_schedules`
--

CREATE TABLE `ship_schedules` (
  `id` int(11) NOT NULL,
  `company` varchar(100) DEFAULT NULL,
  `shipName` varchar(255) DEFAULT NULL,
  `code` varchar(100) DEFAULT NULL,
  `length` int(11) DEFAULT NULL,
  `draft` float DEFAULT NULL,
  `destPort` varchar(100) DEFAULT NULL,
  `nKd` int(11) DEFAULT NULL,
  `minKd` int(11) DEFAULT NULL,
  `mean` int(11) DEFAULT NULL,
  `loadValue` int(11) DEFAULT 0,
  `dischargeValue` int(11) DEFAULT 0,
  `etaTime` datetime DEFAULT NULL,
  `startTime` datetime DEFAULT NULL,
  `etcTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `berthSide` varchar(50) DEFAULT NULL,
  `bsh` int(11) DEFAULT NULL,
  `qccName` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `shipping_company_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ship_schedules`
--

INSERT INTO `ship_schedules` (`id`, `company`, `shipName`, `code`, `length`, `draft`, `destPort`, `nKd`, `minKd`, `mean`, `loadValue`, `dischargeValue`, `etaTime`, `startTime`, `etcTime`, `endTime`, `status`, `berthSide`, `bsh`, `qccName`, `created_at`, `shipping_company_id`) VALUES
(8, 'MERATUS', 'ghjj', 'srer', 100, 5.6, 'sub', 560, 450, NULL, 400, 500, '0000-00-00 00:00:00', '2026-02-07 12:51:00', '2026-02-08 13:52:00', '2026-02-09 15:54:00', 'VESSEL ALONGSIDE', 'P', 40, '0', '2026-02-06 03:49:53', 3);

-- --------------------------------------------------------

--
-- Table structure for table `stakeholders`
--

CREATE TABLE `stakeholders` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `type` enum('user','company') DEFAULT 'company'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stakeholders`
--

INSERT INTO `stakeholders` (`id`, `name`, `type`) VALUES
(1, 'PT Pelabuhan Indonesia', 'company'),
(2, 'PT Angkasa Pura', 'company'),
(3, 'John Doe', 'user'),
(4, 'Jane Smith', 'user');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `communication_logs`
--
ALTER TABLE `communication_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `maintenance_schedules`
--
ALTER TABLE `maintenance_schedules`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `qcc_names`
--
ALTER TABLE `qcc_names`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `rest_schedules`
--
ALTER TABLE `rest_schedules`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `shipping_companies`
--
ALTER TABLE `shipping_companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `ship_schedules`
--
ALTER TABLE `ship_schedules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ship_company` (`shipping_company_id`);

--
-- Indexes for table `stakeholders`
--
ALTER TABLE `stakeholders`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `communication_logs`
--
ALTER TABLE `communication_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `maintenance_schedules`
--
ALTER TABLE `maintenance_schedules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `qcc_names`
--
ALTER TABLE `qcc_names`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `rest_schedules`
--
ALTER TABLE `rest_schedules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `shipping_companies`
--
ALTER TABLE `shipping_companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `ship_schedules`
--
ALTER TABLE `ship_schedules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `stakeholders`
--
ALTER TABLE `stakeholders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `ship_schedules`
--
ALTER TABLE `ship_schedules`
  ADD CONSTRAINT `fk_ship_company` FOREIGN KEY (`shipping_company_id`) REFERENCES `shipping_companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
