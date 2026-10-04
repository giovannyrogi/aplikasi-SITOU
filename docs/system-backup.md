# Backup seluruh sistem SITOU

Menu **Pemeliharaan Sistem → Backup Sistem** hanya untuk Superadmin. Satu paket `.sitou-backup` berisi dump PostgreSQL custom (`database.dump`) dan seluruh file di `UPLOAD_ROOT` sebagai `uploads/...`: foto, dokumen aktif/histori, draft, karantina, serta file tanpa metadata. Ini bukan ekspor per organisasi. Paket terenkripsi AES-256-GCM dengan kunci dari scrypt dan kata sandi Superadmin; kata sandi tidak disimpan di database atau argumen proses.

## Persiapan Windows dan Ubuntu

- Instal PostgreSQL client dengan `pg_dump` dan `pg_restore` versi **tidak lebih tua** daripada PostgreSQL server (saat ini PostgreSQL 18). Tambahkan binarinya ke `PATH`, atau atur `PG_DUMP_PATH` dan `PG_RESTORE_PATH` dengan path absolut.
- Web dan worker harus menggunakan `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, serta `UPLOAD_ROOT` yang sama. `UPLOAD_ROOT` wajib privat dan persisten.
- `BACKUP_ROOT` opsional, default `<project>/.sitou-backups`; hanya paket terenkripsi yang disimpan sementara di sana. Pada VPS, tetapkan direktori privat persisten di luar checkout aplikasi agar paket tidak hilang saat deploy. `BACKUP_SNAPSHOT_ROOT` opsional, default saudara dari `UPLOAD_ROOT`; harus berada pada volume yang sama agar hardlink dapat dibuat. Keduanya harus berada di luar `UPLOAD_ROOT` dan `public`, privat, dan hanya dapat diakses akun proses SITOU.
- Proses web harus diizinkan menjalankan Node child process serta membaca seluruh `UPLOAD_ROOT`. Jalankan migration `037` lebih dulu jika belum ada, lalu migration `038` dan `039`. Jalankan web dan `sitou-backup-expiry-worker` bersama. Jangan hanya memperbarui web tanpa worker kedaluwarsa.
- Pastikan ruang bebas cukup untuk dump database, paket terenkripsi, dan overhead. Perkiraan pada form adalah indikasi, bukan batas tepat. Paket sementara di server dihapus setelah 24 jam; salinan akhir ada di komputer Superadmin.

Sebelum deployment fitur backup ke VPS, buat backup manual PostgreSQL dan `UPLOAD_ROOT` dengan prosedur operasional lama. Terapkan migration `038` dan `039` sebelum membuka menu baru, lalu deploy web bersama worker kedaluwarsa dan jalankan satu backup percobaan. Jangan menerapkan migration pada produksi secara manual di luar prosedur deployment.

## Konsistensi dan batasan

Worker mengunci seluruh tabel publik PostgreSQL dalam mode `SHARE` untuk menunggu penulisan yang sedang berjalan dan menahan DML baru. Saat terkunci, worker mengekspor snapshot database dan membuat hardlink tetap untuk seluruh file upload. Snapshot database diserahkan ke transaksi pembaca; kunci tulis lalu dilepas. `pg_dump --format=custom --snapshot=...` membaca snapshot yang sama tanpa menahan perubahan selama dump berlangsung. Jeda maksimal dua menit; jika gagal atau melewati batas, transaksi rollback dan tidak ada paket siap unduh. Hash/ukuran file yang masih direferensikan database harus cocok dengan snapshot; ketidaksesuaian menggagalkan backup dan harus ditinjau pada menu Penyimpanan File.

Paket mempertahankan struktur folder relatif, bukan lokasi absolut VPS. Folder kosong tidak memiliki konten untuk dicadangkan dan akan dibuat kembali saat aplikasi menulis file. File yang masih direferensikan tetapi berada di karantina divalidasi terhadap lokasi karantina yang aktif; file terinfeksi tetap terenkripsi dalam paket dan tidak menjadi dapat dipreview. Backend storage selain `local_private` belum dapat dicadangkan oleh fitur ini; jika ada file aktif di backend tersebut, backup gagal aman sampai integrasi storage disediakan. Jangan mengedit byte upload secara *in-place*; lifecycle SITOU menggunakan file UUID dan atomic rename agar snapshot hardlink stabil.

## Verifikasi dan latihan pemulihan

Tombol **Verifikasi** di dashboard membandingkan SHA-256 file yang dipilih pada browser dengan paket server. Ini membuktikan unduhan lengkap, **belum** membuktikan dump bisa direstore. Untuk membuka dan memeriksa semua isi paket pada Windows/Ubuntu, gunakan Node dan PostgreSQL client yang sudah terpasang:

```text
node scripts/verify-system-backup.mjs /path/backup.sitou-backup --extract=/path/staging-terpisah
```

Kata sandi dikirim melalui stdin. Jangan menyertakannya pada command line atau log shell. Verifier memeriksa autentikasi enkripsi, hash/ukuran setiap file, path traversal, dan menjalankan `pg_restore --list` pada dump. Tanpa `--extract`, file sementara otomatis dibersihkan.

Untuk uji pemulihan berkala, gunakan server PostgreSQL dan direktori upload **terpisah dari produksi**:

1. Buat database kosong dan role PostgreSQL dengan hak yang sesuai. Paket `pg_dump` satu database tidak mencakup role global, konfigurasi PostgreSQL, sertifikat, atau secret `.env`.
2. Ekstrak paket ke staging privat, lalu jalankan `pg_restore --no-owner --no-acl --dbname=<database-staging> <folder-ekstraksi>/database.dump`.
3. Atur `UPLOAD_ROOT` staging ke `<folder-ekstraksi>/uploads`, sediakan secret/environment staging yang benar, lalu jalankan `npm run db:check` dan pemeriksaan beberapa foto/dokumen resmi dari lebih dari satu organisasi.
4. Catat waktu pemulihan dan hasilnya. Jangan menjalankan restore dari dashboard atau menimpa produksi tanpa maintenance window, backup produksi tambahan, dan prosedur terpisah yang disetujui.

Pengujian lokal: `node --test tests/system-backup.test.mjs` memeriksa enkripsi, hash, dan path; `npm run test:system-backup:db` membuat database sementara dan menguji dua organisasi, file karantina, file hilang, kedaluwarsa, serta kesesuaian migration dengan schema bootstrap. Tes database memerlukan izin membuat/menghapus database sementara dan `pg_dump` PostgreSQL 18.

Jika proses worker terputus, heartbeat yang tidak berubah selama sepuluh menit membuat pekerjaan ditandai gagal; artefak sementara milik pekerjaan gagal dibersihkan setelah satu jam. Riwayat dan audit tetap ada. Paket yang siap diunduh kedaluwarsa 24 jam setelah selesai. Monitor status gagal dan ruang disk, lalu jalankan ulang backup setelah penyebabnya diselesaikan.
