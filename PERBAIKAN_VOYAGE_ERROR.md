# 🔧 Perbaikan: Menambahkan Kolom Voyage ke Database

Jika Anda mendapatkan error HTTP 500 saat menambahkan jadwal kapal, kemungkinan besar database belum ter-update dengan kolom `voyage` di tabel `ship_schedules`.

## ✅ Solusi: Update Database

### Cara 1: Menggunakan phpMyAdmin
1. Buka **phpMyAdmin**: http://localhost/phpmyadmin
2. Login dengan username `root` (tanpa password)
3. Dari sidebar kiri, pilih database **`ba_map`**
4. Pilih tab **"SQL"**
5. Copy dan paste kode berikut:
   ```sql
   ALTER TABLE ship_schedules ADD COLUMN voyage varchar(100) DEFAULT NULL AFTER code;
   ```
6. Klik tombol **"Go"** (biru)
7. Tunggu hingga muncul pesan "success"

### Cara 2: Menggunakan MySQL Client (PowerShell/CMD)
```powershell
mysql -u root ba_map < migration_add_voyage.sql
```

### Cara 3: Menggunakan File SQL (Paling Aman)
1. Jika Anda baru pertama kali setup database, gunakan file `ba_map.sql` yang sudah ter-update
2. Hapus database `ba_map` yang lama
3. Import file `ba_map.sql` yang baru

## 📋 Verifikasi Kolom Sudah Ditambahkan

Setelah menjalankan query di atas, verifikasi dengan:

```sql
DESCRIBE ship_schedules;
```

Anda harus melihat kolom `voyage` di daftar kolom.

## 🎯 Setelah Update Selesai

1. Refresh halaman aplikasi
2. Coba tambah jadwal kapal lagi
3. Field **"Voyage"** sekarang harus tersedia di form

---

**Jika masih ada error:**
1. Buka browser DevTools (F12)
2. Klik tab **"Console"**
3. Coba tambah jadwal kapal
4. Lihat error message detail di console
5. Bagikan error message tersebut

Semoga berhasil! 🚀
