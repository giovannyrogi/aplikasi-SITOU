# Backup seluruh sistem SITOU

Menu **Pemeliharaan Sistem → Backup Database** hanya untuk Superadmin. Satu paket `.sitou-backup` berisi dump PostgreSQL custom (`sitou_db_backup_YYYYMMDD_HHmmss_WITA.dump`), seluruh file yang tersedia di `UPLOAD_ROOT` sebagai `uploads/...`, dan `backup-file-issues.json`: foto, dokumen aktif/histori, draft, karantina, serta file tanpa metadata. Ini bukan ekspor per organisasi. Paket terenkripsi AES-256-GCM dengan kunci dari scrypt dan kata sandi Superadmin; kata sandi tidak disimpan di database atau argumen proses.

Paket baru menggunakan manifest format 3, dengan `databasePath` sebagai referensi dump bertanggal. Setelah paket utama valid, pekerjaan yang sama juga membuat ZIP AES-256 **Database** (`sitou_db_backup_YYYYMMDD_HHmmss_WITA.dump`) dan ZIP AES-256 **Semua file**. ZIP Semua file langsung berisi satu folder `uploads/`; cukup ekstrak sekali. Semua entri memakai AES-256, tetapi daftar path dapat terlihat sebelum kata sandi dimasukkan. Keduanya memuat `backup-pairing.json` dengan ID pekerjaan dan hash paket utama; laporan file bermasalah ikut disertakan. ZIP dapat dibuka di 7-Zip/WinRAR yang mendukung ZIP AES-256. ZIP ini tidak menggantikan paket utama untuk restore otomatis; jangan memasangkan ZIP dari pekerjaan berbeda. Unduhan ZIP hanya untuk Superadmin dan diaudit. Paket utama dan kedua ZIP tetap tersedia di server sampai Superadmin menghapusnya; ZIP yang gagal dapat dibuat ulang dari paket utama dengan memasukkan kembali kata sandi.

## Tampilan waktu pengguna

Diminta, Mulai, Selesai, dan Dihapus tetap bersumber dari waktu absolut server/database. Tampilan mengikuti pengaturan zona waktu browser pengguna, bukan jam perangkat sebagai sumber audit dan bukan lokasi fisik/GPS. Deteksi dilakukan setelah hydration dengan fallback UTC, serta diperbarui saat tab mendapat fokus/visibility berubah. Nama file dan path selalu mengikuti snapshot pekerjaan, tidak berubah ketika pengguna lain membuka atau mengunduh. API hanya menambahkan nama file aman `fileNames`, tanpa path penyimpanan privat. Detail menampilkan Waktu lokal Anda, Waktu pada nama backup, dan nama ZIP database/upload.

## Folder hasil dan kata sandi

Riwayat backup menampilkan maksimal 10 data per halaman pada desktop dan mobile.
Pagination juga menampilkan total seluruh riwayat dari hitungan server, termasuk
backup selesai, gagal, dan dihapus. Total bukan jumlah baris pada halaman aktif.
Navigasi Sebelumnya/Berikutnya memakai cursor server berdasarkan tanggal dan UUID,
tanpa menumpuk baris. Nomor urut berlanjut pada halaman berikutnya. Polling memperbarui
halaman yang sedang dibuka; Muat ulang kembali ke halaman pertama.

Setiap pekerjaan baru menyimpan tiga artefak terenkripsi dalam satu folder `backup_YYYY-MM-DD_HH-mm-ss_WITA_<UUID>` di bawah `BACKUP_ROOT`. Nama file adalah `sitou_full_backup_YYYYMMDD_HHmmss_WITA.sitou-backup`, `sitou_db_backup_YYYYMMDD_HHmmss_WITA.zip`, dan `sitou_uploads_backup_YYYYMMDD_HHmmss_WITA.zip`. Timestamp berasal dari `system_backup_jobs.created_at` dan snapshot `time_zone`. Backup baru memakai `BACKUP_TIME_ZONE` (default `Asia/Makassar`, label WITA), nama artefak stabil walaupun timezone Windows, browser, dan Ubuntu berbeda. Tabel/detail menampilkan waktu lokal pengguna dengan label WIB/WITA/WIT atau offset UTC; detail mencantumkan waktu pada nama backup dan nama ZIP asli untuk pencocokan. Database tetap menyimpan waktu absolut; UUID lengkap membedakan pekerjaan pada detik yang sama. Retry ZIP memakai folder asal. Snapshot/byte sementara berada di lokasi terpisah. Penghapusan melepas akses dan mencatat audit, menghapus hanya tiga artefak dikenal, lalu menghapus folder kosong; file asing tetap dipertahankan. Worker menindaklanjuti kegagalan cleanup tanpa menyentuh folder lama di luar pola baru.

Kata sandi pendek tetap diterima: tidak kosong/spasi saja, maksimal 128 karakter, tanpa baris baru, dan konfirmasi sama. Indikator Lemah/Sedang/Kuat memakai zxcvbn-ts lokal pada browser (common dan English), hanya dimuat saat modal dibuka. Indikator merupakan perkiraan dan tidak memblokir penyimpanan; kata sandi tidak dikirim ke layanan penilaian, log, analytics, atau storage browser. Paket lama tidak menjadi target kompatibilitas format 3 dan tidak dihapus otomatis.

## Persiapan Windows dan Ubuntu

Terapkan migration `044` sebelum deploy kode zona waktu backup. Migration menambahkan snapshot `time_zone` dengan UTC untuk pekerjaan lama; file lama tidak dipindahkan. Backup baru dapat dikonfigurasi melalui `BACKUP_TIME_ZONE=Asia/Makassar` untuk WITA. Zona IANA tidak valid ditolak sebelum pekerjaan dibuat. Perubahan konfigurasi hanya berlaku pada permintaan baru.

Pemeriksaan versi membaca nomor tepat setelah `pg_dump (PostgreSQL)` dan menerima
suffix paket Ubuntu/Debian. Versi yang tidak dikenali ditolak secara terpisah;
versi major klien yang lebih lama daripada server tetap menggagalkan backup.

- Instal PostgreSQL client dengan `pg_dump` dan `pg_restore` versi **tidak lebih tua** daripada PostgreSQL server pada lingkungan tersebut. Tambahkan binarinya ke `PATH`, atau atur `PG_DUMP_PATH` dan `PG_RESTORE_PATH` dengan path absolut.
- Kode ZIP menggunakan `@zip.js/zip.js` dalam proses Node dan tidak menjalankan alat ZIP eksternal atau meletakkan kata sandi pada command line. Pada Windows/Ubuntu, uji pembukaan ZIP AES-256 dengan aplikasi ekstraksi yang mendukungnya; Explorer bawaan Windows tidak dijadikan acuan kompatibilitas.
- Web dan worker harus menggunakan `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, serta `UPLOAD_ROOT` yang sama. `UPLOAD_ROOT` wajib privat dan persisten.
- `BACKUP_ROOT` opsional, default `<project>/.sitou-backups`; paket terenkripsi disimpan di sana sampai dihapus manual. Pada VPS, tetapkan direktori privat persisten di luar checkout aplikasi agar paket tidak hilang saat deploy. `BACKUP_SNAPSHOT_ROOT` opsional, default saudara dari `UPLOAD_ROOT`; harus berada pada volume yang sama agar hardlink dapat dibuat. Keduanya harus berada di luar `UPLOAD_ROOT` dan `public`, privat, dan hanya dapat diakses akun proses SITOU.
- Proses web harus diizinkan menjalankan Node child process serta membaca seluruh `UPLOAD_ROOT`. Terapkan migration backup hingga `043` sebelum deploy web dan worker. Proses PM2 bernama `sitou-backup-expiry-worker` dipertahankan untuk kompatibilitas deployment lama, tetapi pada versi ini **tidak lagi menghapus backup siap berdasarkan waktu**; tugasnya membersihkan sisa backup gagal/dihapus serta proses yang macet.
- Pastikan ruang bebas cukup untuk dump database, paket terenkripsi, dan overhead. Perkiraan pada form adalah indikasi, bukan batas tepat. Karena hasil tidak kedaluwarsa, pantau kapasitas `BACKUP_ROOT` dan simpan salinan terpisah di luar VPS. Kehilangan VPS dapat menghilangkan backup yang hanya disimpan di VPS.

Sebelum deployment perubahan backup ke VPS, buat backup manual PostgreSQL dan `UPLOAD_ROOT` dengan prosedur operasional lama. Terapkan migration yang belum ada secara berurutan hingga `043`, lalu deploy web dan worker yang sudah diperbarui bersama. Jika `042` sudah diterapkan, jalankan hanya `043`. Backup lama yang masih `ready` tetap dapat diunduh tanpa tenggat; backup yang sudah `expired` tidak dapat dipulihkan dari metadata. Jangan menerapkan migration pada produksi secara manual di luar prosedur deployment.

## Konsistensi dan batasan

Worker mengunci seluruh tabel publik PostgreSQL dalam mode `SHARE` untuk menunggu penulisan yang sedang berjalan dan menahan DML baru. Saat terkunci, worker mengekspor snapshot database dan membuat hardlink tetap untuk seluruh file upload. Snapshot database diserahkan ke transaksi pembaca; kunci tulis lalu dilepas. `pg_dump --format=custom --snapshot=...` membaca snapshot yang sama tanpa menahan perubahan selama dump berlangsung. Jeda maksimal dua menit; jika gagal atau melewati batas, transaksi rollback dan tidak ada paket siap unduh. File yang catatannya masih ada tetapi hilang atau berbeda ukuran/hash menjadi temuan; paket tetap siap diunduh dengan status **perlu tindak lanjut**. Storage tidak terbaca, path tidak aman, dan file berubah ketika paket dibuat tetap menggagalkan backup.

Detail pekerjaan memperlihatkan tahap dan progres yang diukur. Saat total belum diketahui (termasuk `pg_dump`), bar bergerak tanpa persen; pengemasan dan ZIP menampilkan persen tahap ketika total sudah pasti. Jumlah/ukuran dan kategori aman boleh ditampilkan, tetapi nama file, object key, dan path privat tidak dikirim ke browser. Snapshot file memakai hardlink, bukan salinan byte penuh. Progres tidak ditulis selama kunci snapshot ditahan agar tidak membuat antrean koneksi sendiri.

Status **Menunggu** berarti worker belum mengonfirmasi mulai, bukan sedang memproses banyak file. Proses web menunggu konfirmasi mulai maksimal 30 detik; pekerjaan yatim tanpa tanda mulai ditandai gagal setelah 90 detik saat daftar/detail diperiksa. Heartbeat yang tidak bergerak selama 10 menit juga ditandai gagal. Jika backup VPS masih Menunggu, periksa `started_at`, `heartbeat_at`, `progress_stage`, `error_code`, dan proses PM2 `sitou-backup-expiry-worker`; jangan menyimpulkan penyebab dari jumlah file. Sesudah migration dan worker baru dipasang, buat pekerjaan backup baru. Pekerjaan lama yang sudah gagal tidak otomatis diulang.

Superadmin melihat temuan berdasarkan organisasi, pegawai, jenis file, dan prioritas pada detail pekerjaan. Temuan juga ada dalam paket terenkripsi dan muncul sebagai `backup-file-issues.json` setelah ekstraksi pada lingkungan terpisah. `npm run backup:diagnose-files` tetap tersedia sebagai pemeriksaan read-only pada host. Pulihkan file asli dari sumber tepercaya atau unggah pengganti melalui workflow terpisah yang diaudit; jangan menghapus referensi atau membuat file pengganti sembarang hanya untuk menghilangkan peringatan.

Paket mempertahankan struktur folder relatif, bukan lokasi absolut VPS. Folder kosong tidak memiliki konten untuk dicadangkan dan akan dibuat kembali saat aplikasi menulis file. File yang masih direferensikan tetapi berada di karantina divalidasi terhadap lokasi karantina yang aktif; file terinfeksi tetap terenkripsi dalam paket dan tidak menjadi dapat dipreview. Backend storage selain `local_private` belum dapat dicadangkan oleh fitur ini; jika ada file aktif di backend tersebut, backup gagal aman sampai integrasi storage disediakan. Jangan mengedit byte upload secara *in-place*; lifecycle SITOU menggunakan file UUID dan atomic rename agar snapshot hardlink stabil.

## Verifikasi dan latihan pemulihan

Jika WinRAR menampilkan “Incorrect password”, periksa ZIP secara lokal tanpa
mengekstrak isi atau mengirim kata sandi: `npm run backup:verify-zip -- "PATH_FILE.zip"`.
Kata sandi diminta melalui terminal tanpa echo, bukan argumen proses. Alat memeriksa
seluruh entri AES dan integritasnya, tanpa menampilkan nama/path di dalam arsip.
Semua entri memakai DEFLATE dengan AES-256 dan ukuran sumber yang diketahui;
ZIP64 otomatis hanya diaktifkan ketika ukuran atau jumlah entri memerlukannya.
Pengaturan ini juga memastikan file kosong kompatibel dengan WinRAR/7-Zip.

Tombol **Verifikasi** di dashboard membandingkan SHA-256 file yang dipilih pada browser dengan paket server. Ini membuktikan unduhan lengkap, **belum** membuktikan dump bisa direstore. Untuk membuka dan memeriksa semua isi paket pada Windows/Ubuntu, gunakan Node dan PostgreSQL client yang sudah terpasang:

```text
node scripts/verify-system-backup.mjs /path/backup.sitou-backup --extract=/path/staging-terpisah
```

Kata sandi dikirim melalui stdin. Jangan menyertakannya pada command line atau log shell. Verifier memeriksa autentikasi enkripsi, hash/ukuran setiap file, path traversal, dan menjalankan `pg_restore --list` pada dump. Tanpa `--extract`, file sementara otomatis dibersihkan.

Untuk uji pemulihan berkala, gunakan server PostgreSQL dan direktori upload **terpisah dari produksi**:

1. Buat database kosong dan role PostgreSQL dengan hak yang sesuai. Paket `pg_dump` satu database tidak mencakup role global, konfigurasi PostgreSQL, sertifikat, atau secret `.env`.
2. Ekstrak paket ke staging privat, lalu jalankan `pg_restore --no-owner --no-acl --dbname=<database-staging> <folder-ekstraksi>/sitou_db_backup_YYYYMMDD_HHmmss_WITA.dump`.
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

Paket format 3 dengan revisi berbeda dari checkout, memerlukan pemeriksaan kompatibilitas manual dan flag `--accept-version-mismatch`. Flag ini tidak memperbaiki perbedaan schema. Password, konfigurasi layanan, role PostgreSQL global, dan secret `.env` tidak ikut dipulihkan. Restore berperingatan mempertahankan `backup-file-issues.json`; file yang hilang saat backup tidak dibuat ulang. Dua ZIP tambahan dapat digunakan untuk pemulihan manual: ekstrak ZIP Database lalu pilih `sitou_db_backup_YYYYMMDD_HHmmss_WITA.dump` dalam DBeaver (format Custom), dan ekstrak ZIP Semua file langsung ke folder `UPLOAD_ROOT` yang sesuai **hanya setelah** memeriksa ID pasangan serta menghentikan layanan.

Pengujian lokal: `node --test tests/system-backup.test.mjs` memeriksa enkripsi, hash, dan path; `npm run test:system-backup:db` membuat database sementara dan menguji dua organisasi, file karantina, file hilang, retensi manual, serta kesesuaian migration dengan schema bootstrap. Tes database memerlukan izin membuat/menghapus database sementara dan `pg_dump` PostgreSQL 18.

Jika proses worker terputus, heartbeat yang tidak berubah selama sepuluh menit membuat pekerjaan ditandai gagal; artefak sementara milik pekerjaan gagal dibersihkan setelah satu jam. Riwayat, temuan, dan audit tetap ada. Paket siap hanya dihapus melalui aksi **Hapus backup** Superadmin dengan konfirmasi; aksi ini memutus akses unduh lebih dulu, mengaudit pelaku/waktu, lalu menghapus paket utama dan kedua ZIP. Jika penghapusan fisik gagal karena file sedang dipakai atau gangguan disk, worker mencoba lagi. Penghapusan tidak mengubah database operasional maupun file di `UPLOAD_ROOT`.

Detail pekerjaan Superadmin menampilkan kode dan penjelasan kegagalan `pg_dump` yang disanitasi. Jika dump biasa berhasil tetapi backup gagal, catat `error_code` pekerjaan terbaru; jangan menyimpulkan masalah path atau versi dari pesan umum. Detail SQL, kata sandi, dan path privat tidak ditampilkan.
