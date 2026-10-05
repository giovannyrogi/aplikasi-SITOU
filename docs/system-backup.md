# Backup seluruh sistem SITOU

Menu **Pemeliharaan Sistem → Backup & Restore** hanya untuk Superadmin. Satu paket `.sitou-backup` berisi dump PostgreSQL custom (`database.dump`), seluruh file yang tersedia di `UPLOAD_ROOT` sebagai `uploads/...`, dan `backup-file-issues.json`: foto, dokumen aktif/histori, draft, karantina, serta file tanpa metadata. Ini bukan ekspor per organisasi. Paket terenkripsi AES-256-GCM dengan kunci dari scrypt dan kata sandi Superadmin; kata sandi tidak disimpan di database atau argumen proses.

Setelah paket utama valid, pekerjaan yang sama juga membuat ZIP AES-256 **Database** (`database.dump`) dan ZIP AES-256 **Semua file**. ZIP Semua file berisi `uploads.zip` yang perlu diekstrak sekali lagi untuk memperoleh struktur `uploads/...`; lapisan luar mencegah path file privat terlihat pada header ZIP sebelum kata sandi dimasukkan. Keduanya memuat `backup-pairing.json` dengan ID pekerjaan dan hash paket utama; laporan file bermasalah ikut disertakan. ZIP dapat dibuka di 7-Zip/WinRAR yang mendukung ZIP AES-256. ZIP ini tidak menggantikan paket utama untuk restore otomatis; jangan memasangkan ZIP dari pekerjaan berbeda. Unduhan ZIP hanya untuk Superadmin dan diaudit. Paket utama dan kedua ZIP tetap tersedia di server sampai Superadmin menghapusnya; ZIP yang gagal dapat dibuat ulang dari paket utama dengan memasukkan kembali kata sandi.

## Persiapan Windows dan Ubuntu

- Instal PostgreSQL client dengan `pg_dump` dan `pg_restore` versi **tidak lebih tua** daripada PostgreSQL server (saat ini PostgreSQL 18). Tambahkan binarinya ke `PATH`, atau atur `PG_DUMP_PATH` dan `PG_RESTORE_PATH` dengan path absolut.
- Kode ZIP menggunakan `@zip.js/zip.js` dalam proses Node dan tidak menjalankan alat ZIP eksternal atau meletakkan kata sandi pada command line. Pada Windows/Ubuntu, uji pembukaan ZIP AES-256 dengan aplikasi ekstraksi yang mendukungnya; Explorer bawaan Windows tidak dijadikan acuan kompatibilitas.
- Web dan worker harus menggunakan `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, serta `UPLOAD_ROOT` yang sama. `UPLOAD_ROOT` wajib privat dan persisten.
- `BACKUP_ROOT` opsional, default `<project>/.sitou-backups`; paket terenkripsi disimpan di sana sampai dihapus manual. Pada VPS, tetapkan direktori privat persisten di luar checkout aplikasi agar paket tidak hilang saat deploy. `BACKUP_SNAPSHOT_ROOT` opsional, default saudara dari `UPLOAD_ROOT`; harus berada pada volume yang sama agar hardlink dapat dibuat. Keduanya harus berada di luar `UPLOAD_ROOT` dan `public`, privat, dan hanya dapat diakses akun proses SITOU.
- Proses web harus diizinkan menjalankan Node child process serta membaca seluruh `UPLOAD_ROOT`. Terapkan migration backup hingga `042` sebelum deploy web dan worker. Proses PM2 bernama `sitou-backup-expiry-worker` dipertahankan untuk kompatibilitas deployment lama, tetapi pada versi ini **tidak lagi menghapus backup siap berdasarkan waktu**; tugasnya membersihkan sisa backup gagal/dihapus serta proses yang macet.
- Pastikan ruang bebas cukup untuk dump database, paket terenkripsi, dan overhead. Perkiraan pada form adalah indikasi, bukan batas tepat. Karena hasil tidak kedaluwarsa, pantau kapasitas `BACKUP_ROOT` dan simpan salinan terpisah di luar VPS. Kehilangan VPS dapat menghilangkan backup yang hanya disimpan di VPS.

Sebelum deployment perubahan retensi ke VPS, buat backup manual PostgreSQL dan `UPLOAD_ROOT` dengan prosedur operasional lama. Terapkan migration `042`, lalu deploy web dan worker yang sudah diperbarui bersama. Backup lama yang masih `ready` tetap dapat diunduh tanpa tenggat; backup yang sudah `expired` tidak dapat dipulihkan dari metadata. Jangan menerapkan migration pada produksi secara manual di luar prosedur deployment.

## Konsistensi dan batasan

Worker mengunci seluruh tabel publik PostgreSQL dalam mode `SHARE` untuk menunggu penulisan yang sedang berjalan dan menahan DML baru. Saat terkunci, worker mengekspor snapshot database dan membuat hardlink tetap untuk seluruh file upload. Snapshot database diserahkan ke transaksi pembaca; kunci tulis lalu dilepas. `pg_dump --format=custom --snapshot=...` membaca snapshot yang sama tanpa menahan perubahan selama dump berlangsung. Jeda maksimal dua menit; jika gagal atau melewati batas, transaksi rollback dan tidak ada paket siap unduh. File yang catatannya masih ada tetapi hilang atau berbeda ukuran/hash menjadi temuan; paket tetap siap diunduh dengan status **perlu tindak lanjut**. Storage tidak terbaca, path tidak aman, dan file berubah ketika paket dibuat tetap menggagalkan backup.

Superadmin melihat temuan berdasarkan organisasi, pegawai, jenis file, dan prioritas pada detail pekerjaan. Temuan juga ada dalam paket terenkripsi dan muncul sebagai `backup-file-issues.json` setelah ekstraksi pada lingkungan terpisah. `npm run backup:diagnose-files` tetap tersedia sebagai pemeriksaan read-only pada host. Pulihkan file asli dari sumber tepercaya atau unggah pengganti melalui workflow terpisah yang diaudit; jangan menghapus referensi atau membuat file pengganti sembarang hanya untuk menghilangkan peringatan.

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

## Clean restore seluruh sistem

Alat restore tersedia di Windows dan Ubuntu. Jalankan dari checkout SITOU dengan `pg_restore` yang sesuai versi server, `PGADMIN_DATABASE` (default `postgres`), dan akses membuat serta mengganti nama database. Mulailah dengan pemeriksaan paket tanpa perubahan:

```text
npm run backup:restore -- --package=/path/sitou.sitou-backup --env=.env.production
```

Untuk pemulihan nyata, hentikan proses web **dan semua worker** terlebih dahulu, pastikan `UPLOAD_ROOT` di file env menunjuk folder tujuan yang benar, lalu jalankan:

```text
npm run backup:restore -- --package=/path/sitou.sitou-backup --env=.env.production --apply --confirm=NAMA_DATABASE
```

Kata sandi diminta melalui terminal tanpa echo. Alat memverifikasi paket, membuat database dan folder upload staging, menjalankan `pg_restore`, memeriksa jumlah organisasi, dan menolak cutover bila masih ada sesi database aktif. Setelah staging berhasil, database dan folder lama diganti dengan pasangan baru; keduanya tetap disimpan sementara dengan nama `sitou_before_*` dan `UPLOAD_ROOT.before-*` sebagai rollback. Jika cutover gagal, alat mencoba mengembalikan pasangan lama dan menyimpan jurnal pada folder `.sitou-restore-*` di samping `UPLOAD_ROOT`. Jika rollback otomatis juga gagal, **jangan hidupkan aplikasi** sebelum jurnal dan kedua pasangan diperiksa manual. Jangan hapus data rollback sebelum aplikasi, beberapa foto/dokumen, dan seluruh organisasi terverifikasi.

Paket lama yang belum memuat revisi kode, atau paket dengan revisi berbeda dari checkout, memerlukan pemeriksaan kompatibilitas manual dan flag `--accept-version-mismatch`. Flag ini tidak memperbaiki perbedaan schema. Password, konfigurasi layanan, role PostgreSQL global, dan secret `.env` tidak ikut dipulihkan. Restore berperingatan mempertahankan `backup-file-issues.json`; file yang hilang saat backup tidak dibuat ulang. Dua ZIP tambahan dapat digunakan untuk pemulihan manual: ekstrak ZIP Database lalu pilih `database.dump` dalam DBeaver (format Custom), dan ekstrak ZIP Semua file lalu `uploads.zip` di dalamnya ke folder `UPLOAD_ROOT` yang sesuai **hanya setelah** memeriksa ID pasangan serta menghentikan layanan.

Pengujian lokal: `node --test tests/system-backup.test.mjs` memeriksa enkripsi, hash, dan path; `npm run test:system-backup:db` membuat database sementara dan menguji dua organisasi, file karantina, file hilang, retensi manual, serta kesesuaian migration dengan schema bootstrap. Tes database memerlukan izin membuat/menghapus database sementara dan `pg_dump` PostgreSQL 18.

Jika proses worker terputus, heartbeat yang tidak berubah selama sepuluh menit membuat pekerjaan ditandai gagal; artefak sementara milik pekerjaan gagal dibersihkan setelah satu jam. Riwayat, temuan, dan audit tetap ada. Paket siap hanya dihapus melalui aksi **Hapus backup** Superadmin dengan konfirmasi; aksi ini memutus akses unduh lebih dulu, mengaudit pelaku/waktu, lalu menghapus paket utama dan kedua ZIP. Jika penghapusan fisik gagal karena file sedang dipakai atau gangguan disk, worker mencoba lagi. Penghapusan tidak mengubah database operasional maupun file di `UPLOAD_ROOT`.

Detail pekerjaan Superadmin menampilkan kode dan penjelasan kegagalan `pg_dump` yang disanitasi. Jika dump biasa berhasil tetapi backup gagal, catat `error_code` pekerjaan terbaru; jangan menyimpulkan masalah path atau versi dari pesan umum. Detail SQL, kata sandi, dan path privat tidak ditampilkan.
