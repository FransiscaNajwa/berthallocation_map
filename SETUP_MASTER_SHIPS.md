# Instruksi Setup Master Data Kapal

## 1. Jalankan SQL untuk membuat tabel master_ships

Buka phpMyAdmin, pilih database `ba_map`, kemudian jalankan SQL berikut:

```sql
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
```

Atau import file `master_ships.sql` yang sudah dibuat.

## 2. Cara Menggunakan Fitur Master Data Kapal

### Menambahkan Data Kapal ke Master:
1. Klik tombol **"Master Kapal"** (hijau) di header
2. Klik **"Tambah Kapal Baru"**
3. Isi data kapal:
   - Nama Kapal (wajib)
   - Pelayaran
   - Kode Kapal
   - Voyage
   - Tahun
   - Window
   - Panjang Kapal (meter)
   - Draft Kapal (meter)
   - Destination Port
   - Next Port
4. Klik **"Simpan"**

### Menggunakan Master Data saat Tambah Jadwal:
1. Klik **"+ Kapal"** untuk tambah jadwal
2. Di field **"Nama Kapal"**, ketik atau pilih nama kapal dari suggestion
3. Data akan **otomatis terisi**:
   - Pelayaran
   - Kode Kapal
   - Panjang Kapal
   - Draft Kapal
   - Destination Port / Next Port

### Edit/Hapus Master Data:
- Buka modal Master Kapal
- Klik **"Edit"** untuk mengubah data
- Klik **"Hapus"** untuk menghapus data

## 3. Keuntungan Fitur Ini:
✅ Tidak perlu input data kapal berulang-ulang
✅ Data kapal konsisten dan terstandarisasi
✅ Lebih cepat saat membuat jadwal kapal baru
✅ Mengurangi kesalahan input data

## File yang Ditambahkan/Diubah:
- `master_ships.sql` - SQL untuk create table
- `save_master_ship.php` - Save/update master ship
- `get_master_ships.php` - Get all master ships
- `delete_data.php` - Updated untuk support delete master ship
- `index.html` - Tambah modal master ships & autocomplete
- `script.js` - Tambah fungsi manage master ships & auto-fill
