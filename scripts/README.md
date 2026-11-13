# Operasional SITOU

Bagian terkait

- [Observability dan operasional](#observability-dan-operasional)
- [Hardening production dan rollout file lifecycle](#hardening-production-dan-rollout-file-lifecycle)
- [Pemeliharaan Penyimpanan File](#pemeliharaan-penyimpanan-file)
- [Backup seluruh sistem SITOU](#backup-seluruh-sistem-sitou)
- [Unggah PDF SKB dan operasional OCR](#unggah-pdf-skb-dan-operasional-ocr)

Folder ini menyimpan alat yang masih digunakan untuk menjalankan dan memelihara sistem:

- `run-system-backup.mjs`: proses backup dari dashboard.
- `restore-system-backup.mjs` dan `verify-system-backup*.mjs`: pemulihan dan verifikasi backup.
- `apply-*.mjs`, `check-employee-foundation-db.mjs`, `verify-schema-bootstrap.mjs`: migration dan pemeriksaan struktur database.
- `file-cleanup-worker.mjs`, `cleanup-replaced-profile-files.mjs`, `scan-stored-files-malware.mjs`: pemeliharaan file privat.
- `expire-*.mjs`, `reconcile-subscriptions.mjs`: pemeliharaan status dan draft.
- `replay-inventory-stock.mjs`: pemeriksaan/perhitungan ulang stok terkontrol.
- `seed-superadmin.mjs`: penyiapan akun platform.
- `generate-local-icons.mjs`, `watch-local-icons.mjs`, `run-dev-with-icons.mjs`: bundel ikon Iconify lokal. Cukup ubah nama ikon di `app/components/icons/navigationIconSources.mjs`; `npm run dev` memperbarui hasil saat file disimpan dan build membuat ulang sebelum kompilasi. `npm run icons:check` hanya memeriksa.

Skrip test-* lama tidak digunakan aplikasi. Tes regresi terpilih tersedia di folder `tests/` dan dijalankan dengan `node --test`. Perintah operasional tersedia pada package.json; jalankan sesuai prosedur dan lingkungan target. Skrip database/restore dapat mengubah data dan tidak dijalankan otomatis sekadar dengan membuka folder ini.

Generator ikon membandingkan isi SVG setelah menormalkan akhir baris CRLF/LF,
sehingga checkout Windows tidak dianggap memiliki bundle usang hanya karena
perbedaan akhir baris. Nama atau data ikon yang benar-benar berubah tetap harus
dibuat ulang melalui `npm run icons:generate`.

- `prune-mobile-sessions.mjs` / `npm run auth:mobile-sessions:prune`: menghapus sesi mobile expired atau revoked lebih dari satu hari, tanpa menghapus audit. Default `.env.development`, override dengan `ENV_FILE`; jadwalkan harian hanya pada environment yang diotorisasi setelah migration 065. Tidak mencetak credential/token. Lihat `docs/mobile-api.md`.
- `verify-schema-bootstrap.mjs` juga membandingkan kolom/constraint `mobile_auth_sessions` dengan hasil upgrade lokal.

## Worker PDF SKB

`npm run holiday-pdf:check` memeriksa executable Tesseract/Poppler, bahasa ind/eng/osd, storage privat, schema dan scanner. `npm run worker:holiday-pdf` menjalankan antrean PostgreSQL dan cleanup unggahan tanpa referensi; `-- --once` memproses maksimal satu pekerjaan. ENV_FILE default mengikuti NODE_ENV. Web/worker memakai database serta UPLOAD_ROOT sama. Instalasi dan process manager: scripts/README.md.

Worker PDF juga mengerjakan pembersihan permanen PDF katalog melalui holiday_pdf_purge_jobs setelah migration 071–072. Mode --once memproses maksimal satu pembersihan dan satu OCR. Retry pembersihan 30 detik, lease row lock, referensi revisi lain tetap terlindungi. Lihat docs/work-schedules.md dan scripts/README.md.

## Observability dan operasional

### Observability dan operasional

- Gunakan structured logging dengan `request_id`, `organization_id`, `actor_user_id`, dan nama use case; jangan log payload sensitif.

- Ukur latency API p50/p95/p99, error rate, queue lag, koneksi DB, slow query, import duration, dan recalculation duration.

- Alert untuk partisi bulan depan belum ada, default partition bertambah, outbox macet, storage gagal, atau backup gagal.

- Health check tidak menjalankan query berat.

## Hardening production dan rollout file lifecycle

Panduan ini wajib diikuti untuk deployment perubahan migration 032. Aplikasi baru memblokir unduhan file aktif yang belum berstatus antivirus `clean`, sehingga migration dan pemindaian file lama harus selesai sebelum proses web baru dibuka untuk pengguna.

### 1. Backup dan preflight

Untuk rilis baru, menu Superadmin **Backup Sistem** menyediakan paket terenkripsi database dan seluruh `UPLOAD_ROOT` serta unduhan selama 24 jam. Persyaratan worker, ruang, verifikasi, dan latihan restore dijelaskan pada `scripts/README.md`. Contoh manual di bawah tetap berguna sebagai prosedur darurat ketika dashboard tidak tersedia.

1. Aktifkan mode pemeliharaan agar mutasi profil dan upload berhenti.
2. Backup PostgreSQL dan seluruh direktori `UPLOAD_ROOT`.
3. Pastikan aplikasi web dan worker memakai nilai `UPLOAD_ROOT` absolut yang sama pada storage persisten.
4. Jalankan rekonsiliasi storage dalam mode laporan. Pulihkan metadata aktif yang byte-nya hilang sebelum cleanup diaktifkan.
5. Verifikasi ruang disk untuk temporary multipart, database, dan backup.

Contoh backup perlu disesuaikan dengan nama database serta lokasi storage VPS:

```bash
pg_dump --format=custom --file=sitou-before-032.dump "$DATABASE_URL"
tar -C /srv/sitou-storage -czf sitou-uploads-before-032.tar.gz uploads
```

### 2. Dependency dan ClamAV

```bash
npm ci
sudo apt-get update
sudo apt-get install -y clamav clamav-daemon
sudo freshclam
sudo systemctl enable --now clamav-daemon
sudo systemctl status clamav-daemon
```

Pastikan user PM2 dapat mengakses socket ClamAV. Gunakan environment production berikut:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://sitou.pasarmanado.id
TRUST_PROXY=1
UPLOAD_ROOT=/srv/sitou-storage/uploads
CLAMAV_REQUIRED=1
CLAMAV_SOCKET=/var/run/clamav/clamd.ctl
CLAMAV_TIMEOUT_MS=15000
```

Jika ClamAV memakai TCP privat, gunakan `CLAMAV_HOST=127.0.0.1` dan `CLAMAV_PORT=3310`. Jangan membuka port tersebut ke internet. Upload bersifat fail closed: scanner mati, timeout, atau respons tidak sah membuat upload ditolak.

### 3. Migration dan pemindaian file lama

```bash
ENV_FILE=.env.production npm run db:check
ENV_FILE=.env.production npm run db:migrate -- database/migrations/20260922_032_production_security_hardening.sql
NODE_ENV=production ENV_FILE=.env.production npm run files:scan-malware
```

Perintah scan keluar dengan status gagal jika ada file terinfeksi, byte hilang, path tidak aman, atau scanner gagal. Jangan lanjutkan deployment sebelum jumlah `infected` dan `failed` nol. File terinfeksi harus dikarantina dan ditinjau, sedangkan byte aktif yang hilang harus dipulihkan dari backup atau direkonsiliasi melalui prosedur data yang disetujui.

Verifikasi database:

```sql
SELECT malware_scan_status, count(*)
FROM stored_files
WHERE lifecycle_status IN ('draft', 'active')
GROUP BY malware_scan_status
ORDER BY malware_scan_status;

SELECT status, count(*)
FROM file_purge_jobs
GROUP BY status
ORDER BY status;
```

### 4. Build dan proses PM2

```bash
npm run lint
node --test tests/*.test.mjs
npm run db:verify-bootstrap
npm run build
npm audit --omit=dev
pm2 reload ecosystem.config.js --update-env
pm2 save
pm2 status
```

Kedua proses `sitou` dan `sitou-file-cleanup-worker` harus berstatus `online`. Worker memproses purge setelah commit dan mengulang kegagalan dengan backoff. Jangan menjalankan cleanup fisik manual saat antrean worker aktif.

#### Dependency keamanan (5 Oktober 2026)

- Next.js dan `eslint-config-next` diselaraskan pada 16.3.8; Axios 1.20.0 dan Moment 2.31.0. Lockfile juga memperbarui DOMPurify ke 3.4.16 serta `brace-expansion` ke versi perbaikan pada masing-masing major (1.1.21, 2.1.7, 5.0.12).
- `package.json` dan `package-lock.json` harus diterapkan bersama, lalu gunakan `npm ci` agar versi dependency turunan sama dengan hasil pengujian. Tidak memerlukan migration database.
- Audit produksi (`npm audit --omit=dev`) setelah pembaruan menunjukkan nol temuan. Audit lengkap masih melaporkan lima paket high dalam satu rantai tooling: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
- Temuan terakhir berasal dari [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); saat pemeriksaan, `braces` belum memiliki versi perbaikan resmi. Jalankan lint hanya pada kode/pola file proyek yang dipercaya; jangan memberikan pola glob dari request pengguna kepada tooling ini. Ini batasan sementara, bukan temuan yang telah diperbaiki.
- Jangan memakai `npm audit fix --force` untuk menurunkan konfigurasi Next.js ke versi 14 atau menghapus pemeriksaan lint. Perbarui kembali ketika rantai tooling menyediakan perbaikan kompatibel, lalu jalankan audit, unit test, lint, dan build.
- Peringatan deprecated dari dependency turunan ExcelJS dapat tetap tampil saat `npm ci`; berbeda dari temuan audit. Perubahan major paket import/export harus diuji terhadap template dan workbook yang sudah dipakai organisasi.

#### Pembaruan keamanan dependensi (23 Oktober 2026)

- Versi langsung: Next.js dan `eslint-config-next` 16.4.2, Sharp 0.35.5. Versi turunan pada lockfile: DOMPurify 3.4.17 dan follow-redirects 1.16.1. Terapkan `package.json` dan `package-lock.json` bersama. Rilis ini tidak menambah migration atau mengubah data bisnis.
- Instalasi deployment memakai `npm ci`, lalu lint, test, build dan reload proses aplikasi. Proses lama harus dimulai ulang agar memakai build dan pustaka native baru; mengganti folder paket saja tidak memperbarui proses yang masih berjalan. Periksa versi aktif dengan `npm ls next eslint-config-next sharp dompurify follow-redirects`.
- Jalankan audit produksi dan audit lengkap secara terpisah. Rantai dev-only `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` masih memakai braces 3.0.3 karena belum ada perbaikan resmi yang kompatibel untuk GHSA-vfj7-8cjw-p6xm. Jangan menyatakan audit lengkap bersih, memakai downgrade versi 14, mengabaikan advisori melalui konfigurasi audit, atau mengganti pustaka glob tanpa verifikasi kompatibilitas.
- Sebelum deployment, simpan commit/build sebelumnya serta backup database/file privat sesuai prosedur backup yang berlaku. Setelah `git pull --ff-only`, jalankan `npm ci`, `npm run lint`, `node --test tests/*.test.mjs`, `npm run build`, dan `npm audit --omit=dev`; kemudian `pm2 reload ecosystem.config.js --update-env`. Periksa status seluruh proses yang dikonfigurasi, login, dashboard, file privat dan log. Jangan memakai isi folder node_modules Windows pada VPS Linux.
- Pemulihan aplikasi memakai commit sebelumnya, instalasi lockfile yang cocok, build ulang dan reload. Karena rilis dependensi ini tidak mengubah schema, jangan mengembalikan database produksi hanya untuk memulihkan build aplikasi. Perhatikan bahwa versi sebelumnya masih mempunyai kerentanan dan pemulihan tersebut hanya langkah darurat sementara.

### 5. Nginx

Konfigurasi Nginx dikelola pada server. Terapkan ketentuan berikut pada konfigurasi situs SITOU (contoh file nginx-sitou.conf.example tidak tersedia dalam checkout ini):

- HTTPS wajib dan HTTP dialihkan ke HTTPS.
- `client_max_body_size 120m`.
- upstream hanya `127.0.0.1:3003`.
- `Host`, `X-Forwarded-Proto`, `X-Forwarded-Host`, dan `X-Forwarded-For` ditimpa oleh Nginx.
- buffering request dinonaktifkan agar multipart mengalir ke temporary storage.
- port aplikasi tidak diekspos ke internet.

Uji konfigurasi dengan `sudo nginx -t` sebelum reload.

### 6. Smoke test

Setelah proses aktif, uji dengan akun dan organisasi development khusus:

1. Login, logout, rate limit, serta penolakan origin asing.
2. Edit pegawai: keep, replace, dan remove untuk pas foto, KTP, dan KK.
3. Profil lengkap: pendidikan dan sertifikasi, termasuk validasi gagal setelah file dipilih.
4. Kontrak, koreksi kontrak, penempatan, dan koreksi penempatan dengan PDF.
5. Tindakan disiplin draft dan aktif beserta surat PDF.
6. Cuti dengan satu hingga lima lampiran.
7. Import XLSX valid dan XLSX berbahaya/tidak valid.
8. Preview file berizin, scope lokasi HRD, dan penolakan lintas organisasi.
9. Thumbnail pas foto, KTP, serta KK pada desktop, tablet, dan mobile; uji pembukaan modal dengan mouse dan keyboard.

Pastikan kegagalan bisnis tidak meninggalkan file pada `.tmp/multipart`, dan file lama baru menjadi `purged` setelah job worker berhasil.

### 7. Pemantauan

Query ringkas:

```sql
SELECT status, count(*), min(next_attempt_at) AS next_attempt
FROM file_purge_jobs
GROUP BY status;

SELECT count(*) AS file_aktif_belum_bersih
FROM stored_files
WHERE lifecycle_status IN ('draft', 'active')
  AND malware_scan_status <> 'clean';

SELECT id, stored_file_id, attempts, last_error, next_attempt_at
FROM file_purge_jobs
WHERE status IN ('retry', 'failed')
ORDER BY COALESCE(completed_at, started_at, created_at) DESC
LIMIT 100;

SELECT action, sum(request_count) AS requests
FROM security_rate_limit_buckets
WHERE expires_at > now()
GROUP BY action
ORDER BY requests DESC;
```

Pantau juga log 401/403/413/429/500, kapasitas disk, file `.tmp` dan `.trash`, file aktif tanpa referensi, metadata tanpa byte, serta versi signature ClamAV. Menu Penyimpanan File tetap menjadi alat audit dan pemulihan terakhir.

### Development lokal: scanner opsional

Kepegawaian dan Inventaris memakai pipeline privat yang sama di lib/files/storage.js
serta scanUploadBuffer. Untuk pengembangan dengan npm run dev tanpa ClamAV lokal:

```dotenv
CLAMAV_REQUIRED=0
CLAMAV_ENABLED=0
CLAMAV_TIMEOUT_MS=15000
```

CLAMAV_SOCKET/HOST/PORT tidak diperlukan jika pemindaian tidak aktif. File tetap
diperiksa MIME dari byte, ukuran, dimensi gambar, hash, otorisasi, staging dan
rollback. Statusnya legacy_unscanned, bukan clean palsu; preview lokal mengikuti
kebijakan development. Jika ingin menguji ClamAV, aktifkan REQUIRED=1 atau ENABLED=1
serta endpoint yang sesuai OS.

Pada NODE_ENV=production (termasuk npm run build lalu npm start di komputer lokal),
scanner selalu wajib walaupun kedua flag bernilai 0. Scanner mati/timeout/ancaman
menolak upload; file non-clean tidak dapat dibuka. VPS tetap memakai konfigurasi
production/socket Linux yang valid. File development yang dipindah ke production
harus dipindai lewat files:scan-malware sebelum digunakan. Jalankan ulang server
setelah mengubah environment agar nilai baru pasti terbaca.

Inventaris sudah memakai PrivateFileUpload untuk foto barang (deferred sampai
Simpan barang), bukti pembelian, dokumen permintaan, dan foto serah terima (draft
privat). Semua merender FileUploadField dan ImagePreviewModal yang sama. Callback
onRemoveRequest asynchronous wajib ditunggu, dengan loading dan pesan gagal;
referensi UI baru dilepas setelah operasi pemilik berhasil.

## Pemeliharaan Penyimpanan File

Halaman Superadmin menampilkan seluruh organisasi saat pertama dibuka. Pilihan organisasi membatasi daftar; pemeriksaan baru tetap dijalankan untuk satu organisasi. Hasil gabungan dapat ditinjau lintas organisasi, sedangkan setiap tindakan tetap memakai organisasi asal file yang diverifikasi server.

Khusus Superadmin. Pilih satu organisasi, jalankan pemeriksaan, lalu pilih **Bersihkan**
untuk kandidat yang tidak digunakan. Setiap tabel, kartu, riwayat, preview, dan
konfirmasi menampilkan organisasi asal dari server.

### Klasifikasi

| Kondisi | Hasil / tindakan |
|---|---|
| Masih dirujuk profil, histori, versi dokumen atau data organisasi dan valid | Tidak tampil |
| Tanpa referensi, termasuk kontrak/cuti/penempatan | Siap dibersihkan → Bersihkan |
| File tanpa catatan, berumur minimal 24 jam | Siap dibersihkan → Bersihkan |
| Catatan tanpa referensi dan file hilang | Siap dibersihkan → Bersihkan catatan |
| File dirujuk tetapi hilang | Integritas & pemulihan → Unggah pemulihan |
| File dirujuk tetapi status terhapus | Integritas & pemulihan → Pulihkan status |
| Scanner gagal pada file dirujuk | Integritas & pemulihan → Periksa antivirus |
| Path, izin atau provider bermasalah | Petunjuk perbaikan server dan Validasi ulang |
| Terinfeksi | Karantina privat / Ancaman keamanan → Hapus permanen |
| Karantina biasa | Pulihkan atau Hapus permanen |

Kategori resmi dan employee_id bukan bukti bahwa file masih digunakan. Referensi
histori tetap dilindungi tanpa menyaring status akhir pegawai. Draft aktif dan
upload baru dilindungi. Inventaris filesystem mencocokkan semua lifecycle agar
arsip retained/purged/quarantined tidak dianggap file tanpa catatan. Selfie absensi dikelompokkan menurut penempatan dan tanggal kerja. Pemeliharaan mengikuti object key tersimpan dan referensi absensi pada kedua susunan folder. [Susunan selfie](../docs/mobile-api.md#susunan-folder-selfie-baru)

### Eksekusi dan keamanan

Scan tidak menghapus kandidat. Pembersihan manual terkonfirmasi menghapus permanen,
tanpa tambahan masa tunggu tujuh hari. Status scanner gagal/belum diperiksa tidak
menghalangi penghapusan file tanpa referensi. Preview/unduh tetap hanya untuk clean.
Pemeriksaan antivirus ulang menjalankan scanner pada file yang belum bersih.

Worker memeriksa referensi, organisasi, path, symlink, ukuran dan hash ulang.
Transaksi penghapusan menggunakan lock singkat pada tabel referensi dan stored_files
untuk mencegah pengaitan file bersamaan; lock timeout menyebabkan retry.
File dipindahkan sementara sebelum commit, dipulihkan jika rollback, lalu dihapus.
Ini mekanisme pemulihan transaksi, bukan karantina tujuh hari. Metadata menjadi
purged; catatan file dan audit tetap tersedia. Hanya ENOENT berarti file hilang.

Pemulihan wajib memakai file asli dengan ukuran, MIME, SHA-256 yang cocok dan ClamAV
clean. File terinfeksi tidak boleh dibuka, diunduh, atau dipulihkan. Karantina ancaman
tetap tujuh hari atau dihapus lebih awal dengan konfirmasi.

API tetap memakai endpoint runs/:id/cleanup, items/:itemId/content, recovery,
resolve, serta quarantine/:id/restore dan purge. Cleanup menerima kandidat dengan
atau tanpa catatan database. Respons publik tidak memuat object key/path/hash.
Aksi lama stage_cleanup/retain_official dipertahankan untuk kompatibilitas klien;
UI baru memakai kandidat hasil scan terbaru dan endpoint cleanup.

### Worker dan rollout VPS

Jalankan web dan worker dengan revisi yang sama:

```bash
pm2 startOrReload ecosystem.config.js
pm2 save
pm2 status
```

Pastikan sitou dan sitou-file-cleanup-worker online serta UPLOAD_ROOT menunjuk mount
persisten yang sama. Update ini tidak mengubah migration 036 atau schema database.
Jalankan scan baru setelah deployment; jangan memakai hasil lama sebagai bukti
bahwa file boleh dihapus. Worker tetap memeriksa kondisi terkini pada setiap aksi.

### Diagnosis koneksi

UI menampilkan kegagalan jaringan dalam Bahasa Indonesia, satu pesan koneksi dengan
Coba lagi, Muat ulang, dan pembatalan request saat organisasi/halaman berubah tetap tersedia. Data dimuat saat halaman dibuka, organisasi berganti, atau tab kembali aktif. Polling berurutan setiap 10 detik hanya berjalan saat ada pemeriksaan atau penghapusan berstatus menunggu/berjalan dan tab terlihat; polling berhenti saat selesai atau tab tersembunyi. Kegagalan jaringan pada pekerjaan aktif dicoba lagi tanpa request bertumpuk. Saat tidak ada pekerjaan aktif, pembaruan melalui fokus tab atau Muat ulang.
Respons API mempertahankan request ID ketika tersedia.

“Failed to fetch” di VPS belum dapat dipastikan hanya dari screenshot. Cocokkan waktu
dan endpoint request gagal pada Network/Console browser dengan:
`pm2 logs sitou --lines 100`, log reverse proxy, status worker, HTTPS/certificate,
dan kebijakan CSP. Jangan membagikan cookie, token, isi file, atau konfigurasi rahasia.
Pesan yang lebih jelas tidak membuktikan penyebab jaringan telah diperbaiki.

### Verifikasi

- prosedur verifikasi fitur: membuat database bootstrap
  serta direktori upload sementara; menguji dokumen resmi tanpa referensi, orphan,
  file hilang, race referensi, organisasi berbeda, dan retry tanpa data pengguna.

- prosedur verifikasi fitur

- prosedur verifikasi fitur: pemeriksaan akses Superadmin/HRD terhadap server lokal.

- Lint, build produksi, dan regresi upload pegawai tetap wajib.

Rujukan: [Verifikasi](../docs/rules/product.md#verifikasi-3).

## Backup seluruh sistem SITOU

Menu **Pemeliharaan Sistem → Backup Database** hanya untuk Superadmin. Satu paket `.sitou-backup` berisi dump PostgreSQL custom (`sitou_db_backup_YYYYMMDD_HHmmss_WITA.dump`), seluruh file yang tersedia di `UPLOAD_ROOT` sebagai `uploads/...`, dan `backup-file-issues.json`: foto, dokumen aktif/histori, draft, karantina, serta file tanpa metadata. Ini bukan ekspor per organisasi. Paket terenkripsi AES-256-GCM dengan kunci dari scrypt dan kata sandi Superadmin; kata sandi tidak disimpan di database atau argumen proses.

Paket baru menggunakan manifest format 3, dengan `databasePath` sebagai referensi dump bertanggal. Setelah paket utama valid, pekerjaan yang sama juga membuat ZIP AES-256 **Database** (`sitou_db_backup_YYYYMMDD_HHmmss_WITA.dump`) dan ZIP AES-256 **Semua file**. ZIP Semua file langsung berisi satu folder `uploads/`; cukup ekstrak sekali. Semua entri memakai AES-256, tetapi daftar path dapat terlihat sebelum kata sandi dimasukkan. Keduanya memuat `backup-pairing.json` dengan ID pekerjaan dan hash paket utama; laporan file bermasalah ikut disertakan. ZIP dapat dibuka di 7-Zip/WinRAR yang mendukung ZIP AES-256. ZIP ini tidak menggantikan paket utama untuk restore otomatis; jangan memasangkan ZIP dari pekerjaan berbeda. Unduhan ZIP hanya untuk Superadmin dan diaudit. Paket utama dan kedua ZIP tetap tersedia di server sampai Superadmin menghapusnya; ZIP yang gagal dapat dibuat ulang dari paket utama dengan memasukkan kembali kata sandi.

### Tampilan waktu pengguna

Diminta, Mulai, Selesai, dan Dihapus tetap bersumber dari waktu absolut server/database. Tampilan mengikuti pengaturan zona waktu browser pengguna, bukan jam perangkat sebagai sumber audit dan bukan lokasi fisik/GPS. Deteksi dilakukan setelah hydration dengan fallback UTC, serta diperbarui saat tab mendapat fokus/visibility berubah. Nama file dan path selalu mengikuti snapshot pekerjaan, tidak berubah ketika pengguna lain membuka atau mengunduh. API hanya menambahkan nama file aman `fileNames`, tanpa path penyimpanan privat. Detail menampilkan Waktu lokal Anda, Waktu pada nama backup, dan nama ZIP database/upload.

### Folder hasil dan kata sandi

Riwayat backup menampilkan maksimal 10 data per halaman pada desktop dan mobile.
Pagination juga menampilkan total seluruh riwayat dari hitungan server, termasuk
backup selesai, gagal, dan dihapus. Total bukan jumlah baris pada halaman aktif.
Navigasi Sebelumnya/Berikutnya memakai cursor server berdasarkan tanggal dan UUID,
tanpa menumpuk baris. Nomor urut berlanjut pada halaman berikutnya. Polling memperbarui
halaman yang sedang dibuka; Muat ulang kembali ke halaman pertama.

Setiap pekerjaan baru menyimpan tiga artefak terenkripsi dalam satu folder `backup_YYYY-MM-DD_HH-mm-ss_WITA_<UUID>` di bawah `BACKUP_ROOT`. Nama file adalah `sitou_full_backup_YYYYMMDD_HHmmss_WITA.sitou-backup`, `sitou_db_backup_YYYYMMDD_HHmmss_WITA.zip`, dan `sitou_uploads_backup_YYYYMMDD_HHmmss_WITA.zip`. Timestamp berasal dari `system_backup_jobs.created_at` dan snapshot `time_zone`. Backup baru memakai `BACKUP_TIME_ZONE` (default `Asia/Makassar`, label WITA), nama artefak stabil walaupun timezone Windows, browser, dan Ubuntu berbeda. Tabel/detail menampilkan waktu lokal pengguna dengan label WIB/WITA/WIT atau offset UTC; detail mencantumkan waktu pada nama backup dan nama ZIP asli untuk pencocokan. Database tetap menyimpan waktu absolut; UUID lengkap membedakan pekerjaan pada detik yang sama. Retry ZIP memakai folder asal. Snapshot/byte sementara berada di lokasi terpisah. Penghapusan melepas akses dan mencatat audit, menghapus hanya tiga artefak dikenal, lalu menghapus folder kosong; file asing tetap dipertahankan. Worker menindaklanjuti kegagalan cleanup tanpa menyentuh folder lama di luar pola baru.

Kata sandi pendek tetap diterima: tidak kosong/spasi saja, maksimal 128 karakter, tanpa baris baru, dan konfirmasi sama. Indikator Lemah/Sedang/Kuat memakai zxcvbn-ts lokal pada browser (common dan English), hanya dimuat saat modal dibuka. Indikator merupakan perkiraan dan tidak memblokir penyimpanan; kata sandi tidak dikirim ke layanan penilaian, log, analytics, atau storage browser. Paket lama tidak menjadi target kompatibilitas format 3 dan tidak dihapus otomatis.

### Persiapan Windows dan Ubuntu

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

### Konsistensi dan batasan

Worker mengunci seluruh tabel publik PostgreSQL dalam mode `SHARE` untuk menunggu penulisan yang sedang berjalan dan menahan DML baru. Saat terkunci, worker mengekspor snapshot database dan membuat hardlink tetap untuk seluruh file upload. Snapshot database diserahkan ke transaksi pembaca; kunci tulis lalu dilepas. `pg_dump --format=custom --snapshot=...` membaca snapshot yang sama tanpa menahan perubahan selama dump berlangsung. Jeda maksimal dua menit; jika gagal atau melewati batas, transaksi rollback dan tidak ada paket siap unduh. File yang catatannya masih ada tetapi hilang atau berbeda ukuran/hash menjadi temuan; paket tetap siap diunduh dengan status **perlu tindak lanjut**. Storage tidak terbaca, path tidak aman, dan file berubah ketika paket dibuat tetap menggagalkan backup.

Detail pekerjaan memperlihatkan tahap dan progres yang diukur. Saat total belum diketahui (termasuk `pg_dump`), bar bergerak tanpa persen; pengemasan dan ZIP menampilkan persen tahap ketika total sudah pasti. Jumlah/ukuran dan kategori aman boleh ditampilkan, tetapi nama file, object key, dan path privat tidak dikirim ke browser. Snapshot file memakai hardlink, bukan salinan byte penuh. Progres tidak ditulis selama kunci snapshot ditahan agar tidak membuat antrean koneksi sendiri.

Status **Menunggu** berarti worker belum mengonfirmasi mulai, bukan sedang memproses banyak file. Proses web menunggu konfirmasi mulai maksimal 30 detik; pekerjaan yatim tanpa tanda mulai ditandai gagal setelah 90 detik saat daftar/detail diperiksa. Heartbeat yang tidak bergerak selama 10 menit juga ditandai gagal. Jika backup VPS masih Menunggu, periksa `started_at`, `heartbeat_at`, `progress_stage`, `error_code`, dan proses PM2 `sitou-backup-expiry-worker`; jangan menyimpulkan penyebab dari jumlah file. Sesudah migration dan worker baru dipasang, buat pekerjaan backup baru. Pekerjaan lama yang sudah gagal tidak otomatis diulang.

Superadmin melihat temuan berdasarkan organisasi, pegawai, jenis file, dan prioritas pada detail pekerjaan. Temuan juga ada dalam paket terenkripsi dan muncul sebagai `backup-file-issues.json` setelah ekstraksi pada lingkungan terpisah. `npm run backup:diagnose-files` tetap tersedia sebagai pemeriksaan read-only pada host. Pulihkan file asli dari sumber tepercaya atau unggah pengganti melalui workflow terpisah yang diaudit; jangan menghapus referensi atau membuat file pengganti sembarang hanya untuk menghilangkan peringatan.

Paket mempertahankan struktur folder relatif, bukan lokasi absolut VPS. Folder kosong tidak memiliki konten untuk dicadangkan dan akan dibuat kembali saat aplikasi menulis file. File yang masih direferensikan tetapi berada di karantina divalidasi terhadap lokasi karantina yang aktif; file terinfeksi tetap terenkripsi dalam paket dan tidak menjadi dapat dipreview. Backend storage selain `local_private` belum dapat dicadangkan oleh fitur ini; jika ada file aktif di backend tersebut, backup gagal aman sampai integrasi storage disediakan. Jangan mengedit byte upload secara *in-place*; lifecycle SITOU menggunakan file UUID dan atomic rename agar snapshot hardlink stabil.

### Verifikasi dan latihan pemulihan

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

### Clean restore seluruh sistem

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

Pengujian lokal: prosedur verifikasi fitur memeriksa enkripsi, hash, dan path; prosedur verifikasi fitur membuat database sementara dan menguji dua organisasi, file karantina, file hilang, retensi manual, serta kesesuaian migration dengan schema bootstrap. Tes database memerlukan izin membuat/menghapus database sementara dan `pg_dump` PostgreSQL 18.

Jika proses worker terputus, heartbeat yang tidak berubah selama sepuluh menit membuat pekerjaan ditandai gagal; artefak sementara milik pekerjaan gagal dibersihkan setelah satu jam. Riwayat, temuan, dan audit tetap ada. Paket siap hanya dihapus melalui aksi **Hapus backup** Superadmin dengan konfirmasi; aksi ini memutus akses unduh lebih dulu, mengaudit pelaku/waktu, lalu menghapus paket utama dan kedua ZIP. Jika penghapusan fisik gagal karena file sedang dipakai atau gangguan disk, worker mencoba lagi. Penghapusan tidak mengubah database operasional maupun file di `UPLOAD_ROOT`.

Detail pekerjaan Superadmin menampilkan kode dan penjelasan kegagalan `pg_dump` yang disanitasi. Jika dump biasa berhasil tetapi backup gagal, catat `error_code` pekerjaan terbaru; jangan menyimpulkan masalah path atau versi dari pesan umum. Detail SQL, kata sandi, dan path privat tidak ditampilkan.

Rujukan: [Verifikasi](../docs/rules/product.md#verifikasi-3).

## Unggah PDF SKB dan operasional OCR

### Perilaku produk

Data Master → Katalog Hari Libur menyediakan dua cara pengisian: **Ambil otomatis** dan **Input manual + PDF**. Hanya Admin SITOU yang dapat mengunggah, mengoreksi, menyimpan draft dan menerbitkan katalog. PDF diproses lokal oleh worker SITOU; tidak dikirim ke penyedia API atau layanan AI/OCR eksternal. Tesseract membaca gambar, Poppler membaca/merender PDF, dan parser tabel SITOU memilih baris lampiran. Tanda tangan, logo, konsiderans, tanggal penetapan serta nomor keputusan tidak menjadi tanggal libur.

1. Buat katalog atau revisi draft untuk tahun yang sesuai.
2. Pilih **Input manual + PDF**, lalu pilih atau tarik satu PDF maksimal 10 MB/20 halaman pada area unggah Dokumen SKB. Komponen FileUploadField yang sama dengan unggah dokumen lainnya menampilkan nama, ukuran, lihat, ganti dan hapus pilihan file. Unggah dimulai setelah file dipilih; tidak perlu tombol unggah kedua. Untuk sumber API pilih Ambil otomatis → Ambil data terbaru.
3. Tunggu Memeriksa dokumen → Membaca halaman → Menyiapkan hasil. Proses memakai antrean; kembali ke draft tidak menghapus isian. Tutup modal tidak membatalkan pekerjaan di server. Unggah kembali dengan request key sama mengembalikan pekerjaan yang sama.
4. Isi nomor keputusan serta tanggal manual selama pembacaan berjalan. Hasil pembacaan tidak menimpa isian. Pilih **Tinjau hasil pembacaan** jika ingin memakai bantuan OCR. Periksa kelompok Libur nasional dan Cuti bersama. Setiap tanggal mempunyai halaman sumber. Penanda Perlu diperiksa berarti hasil OCR atau nama hari perlu dicocokkan, bukan sudah pasti salah.
5. Buka PDF sumber, isi nomor keputusan bila belum terbaca, dan gunakan Koreksi hasil pembacaan bila diperlukan. Rentang dan daftar tanggal telah dipecah menjadi tanggal individual. Bagian yang tidak dikenali membuat hasil Belum lengkap; lengkapi seluruh tabel secara manual sebelum mengonfirmasi kelengkapannya.
6. Cocokkan seluruh tanggal, nama, kategori dan tahun, kemudian centang konfirmasi. Perubahan isian membatalkan konfirmasi. OCR tidak menjamin seluruh dokumen selalu terbaca benar; jangan menerbitkan tanpa pemeriksaan lampiran.
7. **Gunakan hasil pembacaan** mengganti isian form setelah peninjauan, belum menyimpannya. Alternatifnya, kembali dan lengkapi seluruh tanggal secara manual berdasarkan PDF yang sama, lalu centang pemeriksaan dokumen. **Simpan draft** menautkan PDF asli dan tanggal yang diterima dalam transaksi database yang sama dengan audit/receipt. Kegagalan tidak menghapus isian/pratinjau. Setelah tersimpan, **Tinjau katalog → Terbitkan** memakai versi tersimpan dan konfirmasi existing.
8. Detail katalog menampilkan Dokumen SKB, nama/ukuran, tahun/revisi serta Lihat PDF/Unduh PDF. HRD berizin Kalender Libur dan Absensi aktif hanya dapat membaca PDF katalog terbit melalui organisasi yang sah. Draft/import khusus Admin SITOU.

Pergantian sumber API mempertahankan referensi PDF dan meminta peninjauan ulang. Penggantian PDF dilakukan melalui unggah/pemeriksaan eksplisit. Revisi terbit, PDF asal serta auditnya tidak ditimpa. Katalog dari tautan/API lama tetap terbaca tanpa PDF. Tautan pemerintah tidak wajib jika PDF sah telah ditautkan. Unggah tidak membuktikan keaslian penerbit atau validitas tanda tangan digital; Admin wajib memeriksa sumber keputusan.

Pilihan metode tidak menghapus isian manual. Tahun dikunci selama PDF dipilih agar tidak tertukar dengan tahun pekerjaan; hapus pilihan PDF terlebih dahulu jika perlu mengubah tahun pada katalog baru. **Batalkan pilihan PDF** saat antrean berjalan melepas pilihan lokal dan mempertahankan isian, bukan membatalkan pekerjaan server; unggahan tanpa referensi mengikuti kedaluwarsa existing. Penggantian yang dibatalkan mengembalikan PDF tersimpan sebelumnya. PDF yang sedang diproses, gagal, kedaluwarsa, atau berbeda tahun tidak dapat dipakai untuk menyimpan draft baru. Setiap perubahan isian membatalkan konfirmasi pemeriksaan.

Publikasi tidak mengubah kalender organisasi, snapshot jadwal, penetapan Pegawai atau saldo cuti. HRD tetap menambahkan tanggal melalui pemilih katalog dan menyimpan kalender secara eksplisit.

### Penyimpanan, API dan batas proses

Migration 070 memperluas `stored_files.ownership_scope`: file organisasi tetap wajib organization_id; pengecualian platform dengan organization_id NULL hanya kategori holiday_catalog_source, tanpa pemilik Pegawai/draft onboarding. Tidak membuat organisasi fiktif. Byte privat berada pada `platform/holiday_catalogs/{year}/{uuid}.pdf` di UPLOAD_ROOT. Path tidak dikirim ke browser.

`holiday_pdf_imports` menyimpan UUID pekerjaan, pelaku, request key, tahun, referensi file, attempts, lease token/heartbeat, parser version, hasil dengan halaman/bbox/teks asal, dan error aman. Status: queued/running/ready/incomplete/failed/expired. `holiday_catalogs.source_file_id`, `pdf_import_id`, dan `pdf_review` menautkan dokumen serta hasil asli/koreksi/konfirmasi ke revisi. Constraint/trigger katalog terbit existing tetap berlaku. File yang belum ditautkan memakai lifecycle active dan masa staging dikendalikan pekerjaan impor; tidak menyalahgunakan lifecycle draft onboarding.

- POST `/api/system/holiday-catalogs/pdf-imports`: multipart tepat satu file, year (2000–2200), requestKey UUIDv4; 202 berisi ID pekerjaan. MIME/signature nyata, 10 MB file, 11 MB total multipart, origin guard, 5 unggahan/menit/akun-IP, maksimal 2 pekerjaan aktif per Admin. Retry key sama/tahun/hash sama tidak membuat file ganda.
- GET `/api/system/holiday-catalogs/pdf-imports/:id`: khusus Admin; mengembalikan status/progres/hasil tanpa object_key. Poll berurutan 2 detik saat queued/running dan tab terlihat; kegagalan jaringan dicoba kembali 4 detik tanpa request menumpuk.
- GET `/api/system/holiday-catalogs/pdf-imports/:id/document`: preview Admin setelah struktur berhasil diperiksa dan hasil ready/incomplete.
- POST `/api/system/holiday-catalogs`: kontrak existing ditambah pdfImportId dan pdfReviewed. Server mengunci/verifikasi impor/file/tahun/status/antivirus dan menyimpan bukti hasil asli serta tanggal yang diterima. Payload lama tetap kompatibel. Tidak menerima path/source_file_id bebas. pdfReviewed harus true dan semua tanggal tetap melewati schema katalog existing.
- GET `/api/holiday-catalogs/:id/document?organizationId=ID&download=1`: referensi katalog; download opsional. Admin dapat membaca draft; HRD memerlukan katalog terbit, organisasi session, grant Kalender Libur, dan modul Absensi aktif. Hasil privat/no-store/nosniff/CSP sandbox, nama download tersanitasi serta audit preview/unduh. API konsumen katalog menyertakan metadata document yang aman.

Worker mengklaim antrean PostgreSQL menggunakan SKIP LOCKED, satu pekerjaan per proses, heartbeat 10 detik, pemulihan lease setelah 90 detik, maksimal 3 percobaan untuk gangguan sementara dengan jeda 30 detik. Proses maksimal 5 menit; tiap executable maksimal 60 detik. Pembacaan struktur berada pada subprocess Node maksimal heap 256 MB. Rendering maksimal 300 DPI/4000 sisi panjang/20 juta piksel, gambar maksimal 32 MB, teks maksimal 4 MiB dan output subproses maksimal 8 MiB. Tesseract dibatasi satu thread. Executable menggunakan argumen terpisah tanpa shell; isi PDF tidak dieksekusi atau dijadikan URL pengambilan. Worker menggunakan pengguna OS non-root dan tidak memerlukan jaringan eksternal untuk OCR.

PDF rusak/terenkripsi, terlalu banyak halaman, dimensi tidak aman, JavaScript/actions, XFA, embedded files dan jenis konten aktif yang tidak didukung ditolak. ClamAV mengikuti kebijakan existing; production wajib clean sebelum pemrosesan/akses. PDF hasil pindai memakai penghapusan garis tabel dan deteksi orientasi; dokumen buram atau layout di luar pengenalan harus dikoreksi, bukan ditebak. Tahun libur diambil dari judul lampiran, bukan tahun keputusan. Nomor keputusan ambigu dikosongkan untuk pengisian manual.

Worker membersihkan gambar sementara melalui finally. Unggahan tanpa referensi katalog setelah 24 jam ditandai expired, byte dihapus dan audit sistem dicatat; metadata pekerjaan tetap tersimpan. Dokumen yang dirujuk draft maupun revisi terbit terlindungi. Pemeliharaan storage organisasi tidak menghapus namespace platform. Pemeriksaan referensi bersama, backfill antivirus dan backup memahami file platform. Backup seluruh UPLOAD_ROOT mencakup PDF asli; temuan platform berlabel Platform SITOU tanpa organization_id fiktif. Restore penuh tetap memakai prosedur backup existing, tanpa restore dashboard.

### Development Windows: langkah lengkap

Panduan ini memakai PowerShell. Status komputer proyek ini pada 2 November 2026: Tesseract, Poppler, model ind/eng/osd dan path environment sudah tersedia; migration 070 sudah diterapkan. **Pada komputer ini cukup ikuti W6 dan W7. Jangan mengulang migration.** Komputer lain tetap perlu instalasi W1–W5.

#### W1. Periksa alat dan proyek

```powershell
Set-Location -LiteralPath 'D:\Project\App-Dev\Webdev\aplikasi-SITOU'
node --version
npm --version
winget --version
```

Fitur diuji dengan Node.js 24.x. PostgreSQL development harus aktif dan .env.development harus memiliki konfigurasi PG* serta login existing. Jika baru mengambil rilis atau lockfile berubah, hentikan proses development lalu jalankan npm ci. Tidak perlu npm ci setiap kali unggah PDF. Npm tidak memasang executable Tesseract/Poppler.

#### W2. Pasang OCR dan Poppler sekali

```powershell
winget install --id UB-Mannheim.TesseractOCR --exact --source winget
winget install --id oschwartz10612.Poppler --exact --source winget
```

Ikuti installer/UAC jika Windows meminta. Tutup dan buka kembali PowerShell sesudah instalasi agar PATH diperbarui. Jika winget tidak tersedia, gunakan installer Windows yang ditautkan [dokumentasi Tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html) serta ZIP [rilis Poppler Windows](https://github.com/oschwartz10612/poppler-windows/releases). Ekstrak ZIP ke folder tetap, misalnya C:\Tools\poppler. Executable dan DLL Poppler harus tetap bersama.

#### W3. Temukan path executable

Periksa Tesseract. Ganti path jika dipasang di lokasi lain:

```powershell
$sitouTesseractExe = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
Test-Path -LiteralPath $sitouTesseractExe
& $sitouTesseractExe --version
```

Test-Path harus True. Untuk mencari Poppler dari winget:

```powershell
$sitouPopplerRoots = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'),
    (Join-Path $env:ProgramFiles 'WinGet\Packages')
)
foreach ($sitouRoot in $sitouPopplerRoots) {
    if (Test-Path -LiteralPath $sitouRoot) {
        Get-ChildItem -LiteralPath $sitouRoot -Directory -Filter 'oschwartz10612.Poppler_*' |
            ForEach-Object {
                Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Filter 'pdfinfo.exe'
            } | Select-Object -ExpandProperty FullName
    }
}
```

Salin folder yang berisi pdfinfo.exe, bukan path file, ke variabel berikut. Contoh C:\Tools harus diganti jika hasil pencarian/lokasi ZIP berbeda:

```powershell
$sitouPopplerBin = 'C:\Tools\poppler\Library\bin'
foreach ($sitouExe in @('pdfinfo.exe', 'pdftotext.exe', 'pdftoppm.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $sitouPopplerBin $sitouExe))) {
        throw "Executable belum ditemukan: $sitouExe"
    }
}
& (Join-Path $sitouPopplerBin 'pdfinfo.exe') -v
& (Join-Path $sitouPopplerBin 'pdftotext.exe') -v
& (Join-Path $sitouPopplerBin 'pdftoppm.exe') -v
```

Gunakan binary sistem hasil pemasangan, bukan runtime Codex. Lokasi paket winget bisa berubah setelah upgrade; ulangi pencarian bila path lama tidak ditemukan. Path eksplisit membuat SITOU tidak bergantung urutan PATH Windows.

#### W4. Pasang model bahasa dan orientasi

ind untuk Indonesia, eng untuk Inggris, osd untuk deteksi orientasi. Simpan di folder model terpisah dari UPLOAD_ROOT agar tidak dianggap unggahan bisnis. Perintah ini mengunduh model yang belum ada dari repositori resmi Tesseract:

```powershell
$sitouTessdata = Join-Path $env:LOCALAPPDATA 'SITOU\OCR\tessdata'
New-Item -ItemType Directory -Path $sitouTessdata -Force | Out-Null
foreach ($sitouLanguage in @('ind', 'eng', 'osd')) {
    $sitouModelFile = Join-Path $sitouTessdata "$sitouLanguage.traineddata"
    if (-not (Test-Path -LiteralPath $sitouModelFile)) {
        Invoke-WebRequest -Uri "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/$sitouLanguage.traineddata" -OutFile $sitouModelFile
    }
}
$env:TESSDATA_PREFIX = $sitouTessdata
& $sitouTesseractExe --list-langs
```

Hasil harus memuat ind, eng, osd. Jangan menyimpan halaman HTML GitHub sebagai traineddata. Jika unduhan terputus/model gagal dimuat, unduh ulang hanya file model yang rusak. Variabel PowerShell hanya berlaku di terminal itu; W5 menyimpan path untuk proses SITOU.

#### W5. Konfigurasi .env.development

Dengan variabel W3–W4 yang benar, cetak baris yang siap disalin:

```powershell
$sitouOcrSettings = [ordered]@{
    TESSERACT_PATH = $sitouTesseractExe
    PDFINFO_PATH = (Join-Path $sitouPopplerBin 'pdfinfo.exe')
    PDFTOTEXT_PATH = (Join-Path $sitouPopplerBin 'pdftotext.exe')
    PDFTOPPM_PATH = (Join-Path $sitouPopplerBin 'pdftoppm.exe')
    TESSDATA_PREFIX = $sitouTessdata
}
foreach ($sitouSetting in $sitouOcrSettings.GetEnumerator()) {
    '{0}="{1}"' -f $sitouSetting.Key, $sitouSetting.Value.Replace('\', '/')
}
```

Tambahkan/perbarui lima key tersebut di .env.development memakai editor; hindari key ganda dan jangan menimpa seluruh file/database/login. File .env tidak mengembangkan variabel PowerShell: gunakan path literal hasil perintah, bukan $env:LOCALAPPDATA secara literal.

Contoh bentuk akhir, sesuaikan semua lokasi:

```dotenv
TESSERACT_PATH="C:/Program Files/Tesseract-OCR/tesseract.exe"
PDFINFO_PATH="C:/Tools/poppler/Library/bin/pdfinfo.exe"
PDFTOTEXT_PATH="C:/Tools/poppler/Library/bin/pdftotext.exe"
PDFTOPPM_PATH="C:/Tools/poppler/Library/bin/pdftoppm.exe"
TESSDATA_PREFIX="C:/Users/nama/AppData/Local/SITOU/OCR/tessdata"
UPLOAD_ROOT="D:/Project/App-Dev/Webdev/aplikasi-SITOU/uploads"
```

Pertahankan UPLOAD_ROOT existing jika berbeda. Jangan memindahkan upload pengguna hanya demi mengikuti contoh. Folder harus ada dan bisa dibaca/ditulis akun aplikasi. Model OCR disimpan di luar UPLOAD_ROOT. Web dan worker harus memakai PGHOST, PGDATABASE serta UPLOAD_ROOT sama. Environment proses mendahului dotenv; jangan meninggalkan PGDATABASE/UPLOAD_ROOT dari sesi uji lain. Restart kedua proses setelah mengubah environment.

#### W6. Periksa schema dan kesiapan

**Migration 070 sudah diterapkan pada komputer proyek ini, jangan jalankan ulang.** Untuk database lain, periksa status schema sesuai database/migrations/README.md. Hanya jika sampai 069 sudah ada dan 070 belum diterapkan, jalankan sekali:

```powershell
npm run db:migrate -- database/migrations/20261101_070_holiday_pdf_import.sql
```

Lalu, dari folder proyek:

```powershell
$env:NODE_ENV = 'development'
$env:ENV_FILE = '.env.development'
npm run holiday-pdf:check
```

Hasil harus menyebut keempat executable tersedia, bahasa ind/eng/osd, storage dan schema siap. Selesaikan error sebelum unggah. Development boleh melaporkan Scanner: legacy_unscanned sesuai kebijakan existing; ini bukan hasil antivirus bersih dan tidak diterima untuk production. Setelah perubahan schema, pemeriksaan tambahan adalah npm run db:verify-bootstrap.

#### W7. Jalankan web dan worker pada dua terminal

Terminal pertama untuk web:

```powershell
Set-Location -LiteralPath 'D:\Project\App-Dev\Webdev\aplikasi-SITOU'
npm run dev
```

Terminal kedua untuk worker:

```powershell
Set-Location -LiteralPath 'D:\Project\App-Dev\Webdev\aplikasi-SITOU'
$env:NODE_ENV = 'development'
$env:ENV_FILE = '.env.development'
npm run worker:holiday-pdf
```

Biarkan keduanya hidup. Worker bisa tidak mencetak output baru saat menunggu antrean. Jika hanya web aktif, file dapat masuk antrean tanpa dibaca. Menutup terminal atau Ctrl+C menghentikan worker. Setelah reboot Windows, buka kembali dua terminal; mode development ini tidak memasang service startup Windows. Startup PM2 Linux tidak berlaku langsung pada Windows.

Diagnosis sekali jalan: npm run worker:holiday-pdf -- --once memproses maksimal satu pekerjaan lalu keluar; bukan pengganti worker yang terus hidup.

#### W8. Uji dari UI

Buka http://localhost:3000 → login Admin SITOU → Data Master → Katalog Hari Libur → buat/buka draft → Unggah PDF SKB. Pilih PDF maksimal 10 MB/20 halaman. Pastikan progres bergerak, periksa kategori/halaman sumber, isi nomor keputusan bila perlu, centang peninjauan, simpan draft → tinjau → terbitkan secara eksplisit.

Contoh SKB 2026 diharapkan menghasilkan 17 tanggal nasional dan 8 cuti bersama, termasuk 24 Desember halaman lanjutan. Uji Lihat PDF/Unduh PDF. HRD berizin hanya membaca katalog terbit dengan Absensi aktif. Tanggal katalog tidak otomatis diterapkan ke seluruh Pegawai.

### VPS Ubuntu/Debian: langkah lengkap

Penerapan VPS terpisah dari implementasi lokal. Contoh berikut dijalankan setelah backup database + seluruh upload privat dan pengecekan konfigurasi server. Jangan menjalankan ulang migration yang sudah diterapkan. Ikuti `database/migrations/README.md` untuk status schema bila belum ada ledger migration.

Jalankan perintah dari folder rilis SITOU. Nama folder, akun layanan, database dan nama proses web harus mengikuti VPS sebenarnya. Gunakan sudo hanya untuk instalasi/pengaturan OS; web dan worker berjalan sebagai akun aplikasi non-root. Instalasi OCR/model cukup sekali per mesin, bukan setiap tahun atau setiap unggah. Penerapan VPS ini belum dijalankan dari development.

Sebelum memasang rilis: identifikasi proses web existing dengan `pm2 list` atau process manager server, pastikan backup siap, hentikan proses terdampak saat maintenance, perbarui kode lalu jalankan `npm ci`. Pertahankan `.env.production` dan `UPLOAD_ROOT` existing; jangan menggantinya dengan path Windows atau contoh panduan.

1. Pasang dependensi sekali sebagai administrator OS:
   ```bash
   sudo apt update
   sudo apt install -y tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng tesseract-ocr-osd poppler-utils
   ```
2. Pastikan ClamAV/clamav-daemon sudah aktif sesuai `scripts/README.md`. Jika belum tersedia:
   ```bash
   sudo apt install -y clamav clamav-daemon clamav-freshclam
   sudo systemctl enable --now clamav-freshclam
   sudo systemctl status clamav-freshclam --no-pager
   ```
   Tunggu database signature tersedia/pembaruan awal selesai, kemudian:
   ```bash
   sudo systemctl enable --now clamav-daemon
   sudo systemctl status clamav-daemon --no-pager
   ls -l /var/run/clamav/clamd.ctl
   ```
   FreshClam memperbarui signature; clamd memindai file untuk SITOU. Jika gagal mulai, periksa journal service dan signature. Jangan menjalankan updater manual bersamaan dengan service updater aktif atau menonaktifkan scanner untuk melewati error. Akun aplikasi harus bisa mengakses socket sesuai group/mode yang diatur administrator. Perubahan group memerlukan sesi/service baru. Alternatif TCP harus terikat ke 127.0.0.1 dengan CLAMAV_HOST/CLAMAV_PORT yang sesuai; jangan membuka port scanner ke internet.
3. Verifikasi instalasi:
   ```bash
   tesseract --version
   tesseract --list-langs
   pdfinfo -v
   pdftotext -v
   pdftoppm -v
   ```
   Daftar bahasa harus memuat ind, eng, osd. Tesseract sendiri gratis dengan lisensi Apache 2.0; CPU/RAM/storage tetap memakai kapasitas VPS.
4. Tarik rilis yang telah diuji, jalankan `npm ci`, dan atur `.env.production`:
   ```dotenv
   NODE_ENV=production
   UPLOAD_ROOT=/srv/sitou-storage/uploads
   TESSERACT_PATH=/usr/bin/tesseract
   PDFINFO_PATH=/usr/bin/pdfinfo
   PDFTOTEXT_PATH=/usr/bin/pdftotext
   PDFTOPPM_PATH=/usr/bin/pdftoppm
   CLAMAV_REQUIRED=1
   CLAMAV_SOCKET=/var/run/clamav/clamd.ctl
   ```
   Pertahankan PG*, APP_ORIGIN, AUTH_SESSION_SECRET dan konfigurasi existing. Folder harus persisten, non-public, dimiliki akun aplikasi non-root, dan termasuk backup. Jangan menggunakan chmod 777 atau menjalankan worker sebagai root untuk mengatasi izin. Model Linux berada pada direktori paket sistem; TESSDATA_PREFIX biasanya tidak diperlukan. Binary/model jangan berasal dari runtime Codex. Batasi jaringan keluar worker pada lapisan OS/container sesuai infrastruktur; proses OCR tidak memakai internet.
5. Reverse proxy perlu mengizinkan body 11 MiB agar PDF 10 MiB beserta multipart dapat lewat. Contoh Nginx pada server/location SITOU: `client_max_body_size 11m;`. Setelah mengubah konfigurasi:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```
   Reload hanya jika nginx -t sukses. Batas transport Next.js sudah 11 MiB pada next.config.mjs; batas file tetap 10 MiB. Tidak perlu menunggu OCR pada request web karena upload mengembalikan ID antrean.
6. Hentikan proses web/worker yang terdampak saat penerapan migration. Gunakan koneksi production yang sudah diverifikasi dan kredensial aman melalui environment/pgpass, bukan password di command line. Contoh psql setelah PGHOST/PGPORT/PGUSER/PGDATABASE disetel oleh operator:
   ```bash
   psql --set=ON_ERROR_STOP=1 --single-transaction --file=database/migrations/20261101_070_holiday_pdf_import.sql
   ```
   Jika PG* belum diekspor ke shell, psql tidak otomatis membaca .env.production. Gunakan koneksi eksplisit berikut dengan username/database yang sudah diverifikasi; nama di bawah hanya contoh. Password diminta interaktif:
   ```bash
   psql --host=127.0.0.1 --port=5432 --username=sitou_migrator --dbname=sitou_db --password --set=ON_ERROR_STOP=1 --single-transaction --file=database/migrations/20261101_070_holiday_pdf_import.sql
   ```
   Runner `npm run db:migrate` saat ini khusus development dan tidak membaca `.env.production`; jangan dipakai sebagai runner VPS. Bila migration gagal, periksa penyebab sebelum melanjutkan rilis. File 070 membutuhkan schema sampai 069.
7. Jalankan pemeriksaan pada akun layanan:
   ```bash
   NODE_ENV=production ENV_FILE=.env.production npm run holiday-pdf:check
   npm run build
   ```
   Hasil production harus menunjukkan Scanner: clean. legacy_unscanned hanya toleransi development. Web/worker wajib memakai rilis, database dan storage yang sama. Environment proses mendahului dotenv; periksa environment PM2 existing agar PGDATABASE/UPLOAD_ROOT/NODE_ENV tidak mengarah ke konfigurasi lain.
8. Daftarkan worker pada process manager server. Contoh jika menggunakan PM2, dari direktori rilis SITOU:

   ```bash
   NODE_ENV=production ENV_FILE=.env.production pm2 start scripts/holiday-pdf-worker.mjs --name sitou-holiday-pdf --time --max-memory-restart 512M
   pm2 save
   ```

   Perintah start hanya sekali jika nama worker belum ada. Gunakan PM2 milik akun aplikasi, bukan instance root. Jika PM2 belum tersedia, gunakan metode instalasi Node/process manager yang dikelola administrator VPS. Periksa proses dan log:

   ```bash
   pm2 describe sitou-holiday-pdf
   pm2 logs sitou-holiday-pdf --lines 100
   ```

   Saat memperbarui worker existing, jangan membuat proses duplikat:

   ```bash
   NODE_ENV=production ENV_FILE=.env.production pm2 restart sitou-holiday-pdf --update-env
   pm2 save
   ```

   Jika startup akun layanan belum diatur:

   ```bash
   pm2 startup
   ```

   Jalankan persis perintah sudo yang dicetak PM2 untuk akun dan lokasi Node yang benar, lalu jalankan `pm2 save`. Jika startup sudah dikelola operator, verifikasi konfigurasi existing agar tidak membuat service ganda. Setelah upgrade lokasi/versi Node, periksa ulang startup. Ini mekanisme Linux; bukan setup startup Windows development.

   Restart web menggunakan nama aplikasi existing, bukan nama yang ditebak dari panduan ini. Worker online tanpa output baru dapat berarti menunggu antrean. Worker diharapkan mempunyai CPU/RAM cukup; ukur beban dengan PDF contoh sebelum membuka unggah umum.

9. Uji unggah → status bergerak → hasil lengkap → koreksi/konfirmasi → simpan draft → terbitkan → lihat/unduh PDF Admin/HRD. Pastikan 403 untuk HRD draft, scope salah dan Absensi nonaktif.
10. Periksa log melalui `pm2 logs sitou-holiday-pdf --lines 100` dan pekerjaan gagal/heartbeat di database. Uji restart worker saat pekerjaan berjalan; antrean stale dipulihkan setelah lease habis. Lakukan uji reboot pada jadwal pemeliharaan dan uji pemulihan backup di lingkungan terpisah.

Docker: pasang paket Tesseract/Poppler/model pada image worker; web dan worker berbagi database serta volume UPLOAD_ROOT. Tambahkan scanner dan pembatasan resource/non-root pada konfigurasi container. Instalasi hanya di host tidak membuat executable tersedia di dalam container.

### Urutan singkat setelah setup selesai

- Windows setiap sesi development: jalankan web dan worker pada dua terminal. Setelah mengubah environment atau executable, restart keduanya. Setelah reboot, buka kembali dua terminal.
- VPS setiap update aplikasi: backup → perbarui kode/dependensi → migration yang belum ada → preflight → build → restart web/worker → smoke test. Simpan daftar proses PM2 jika berubah. OCR tidak perlu dipasang ulang setiap pergantian tahun.
- Setiap pembaruan kalender: unggah PDF dari UI → periksa hasil → simpan draft → tinjau → terbitkan. Tidak perlu menjalankan Tesseract manual untuk setiap PDF.

### Diagnosis

- Menunggu worker: pastikan proses worker hidup, cwd/environment/database/UPLOAD_ROOT sama dengan web. Jangan mengulang unggah terus-menerus; cek antrean.
- OCR_NOT_AVAILABLE/PDF_PROCESS_FAILED: jalankan holiday-pdf:check dengan pengguna layanan yang sama; cek executable, model dan izin storage.
- PowerShell tidak mengenali tesseract/pdfinfo: buka terminal baru atau gunakan path penuh dari W3. Pastikan .env menunjuk executable hasil instalasi sistem, bukan folder ZIP/runtime Codex.
- Model ind/eng/osd tidak ditemukan: periksa TESSDATA_PREFIX menunjuk folder yang langsung berisi ketiga traineddata. Jangan menambahkan subfolder tessdata dua kali. Jalankan --list-langs memakai executable dan environment yang sama dengan worker.
- Schema belum siap: periksa database tujuan dan status migration 069/070. Jangan menjalankan ulang migration hanya karena worker gagal koneksi atau PGDATABASE salah.
- Windows terminal ditutup: worker berhenti; buka kembali terminal W7. VPS worker offline: cek pm2 describe/logs dan startup akun layanan.
- PDF_PROCESS_TIMEOUT: periksa kualitas/ukuran dokumen dan beban server. Maksimal tiga percobaan untuk gangguan sementara; hasil lama tidak dikosongkan.
- Hasil belum lengkap: periksa lampiran, orientasi, format tabel dan semua baris; koreksi manual disediakan. Jangan menebak berdasarkan kalender tahun lain.
- FILE_UNAVAILABLE: periksa status antivirus, file privat dan referensi katalog. Jangan mengubah URL menjadi path publik.
- VERSION_CONFLICT: muat ulang draft terbaru dan tinjau ulang; tidak menimpa revisi orang lain.

Referensi: [instalasi Tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html), [model resmi tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast), [distribusi Poppler Windows](https://github.com/oschwartz10612/poppler-windows), [paket ClamAV](https://docs.clamav.net/manual/Installing/Packages.html), dan [startup PM2](https://pm2.keymetrics.io/docs/usage/startup/). Keaslian isi hari libur tetap dinilai berdasarkan dokumen SKB resmi, bukan confidence OCR atau nama file unggahan.

### Pembersihan PDF akibat penghapusan katalog

Sesudah migration 071 dan 072, worker:holiday-pdf juga memproses holiday_pdf_purge_jobs pada setiap putaran, termasuk --once. Tidak memerlukan program OS atau service tambahan. Jalankan web dan worker dari rilis serta database/storage yang sama; holiday-pdf:check kini memeriksa tabel antrean pembersihan juga. Jangan menghapus PDF berdasarkan nama/tahun. Dokumen yang masih direferensikan revisi lain tetap disimpan.

Antrean memakai row lock SKIP LOCKED sebagai lease; putusnya worker melepaskan lock. Kegagalan storage/metadata dicoba ulang setiap 30 detik dengan attempts dan last_error aman, tanpa mencetak path. Pantau SELECT attempts,last_error,next_attempt_at FROM holiday_pdf_purge_jobs; antrean kosong berarti tidak ada pembersihan tertunda. Jangan menghapus baris antrean manual untuk menyembunyikan masalah. Referensi pekerjaan dilindungi dari pembersihan storage generik dan expiry unggahan 24 jam. Backup/restore database serta UPLOAD_ROOT tetap melalui prosedur existing. Tidak ada deployment VPS pada perubahan lokal ini.

### Impor PDF SKB katalog

- Unggah PDF SKB mengikuti scripts/README.md: khusus Admin SITOU, OCR lokal melalui worker PostgreSQL, tidak mengeksekusi isi PDF atau mengirim dokumen ke layanan eksternal. Hasil wajib ditinjau sebelum simpan/publikasi. Tahun lampiran yang berbeda memblokir penggunaan sumber. File platform hanya kategori holiday_catalog_source; jangan melonggarkan isolasi file organisasi lain. Referensi revisi terbit immutable, file privat berizin/audit/no-store, HRD hanya katalog terbit dengan grant Kalender Libur dan Absensi aktif. UI memakai tahap dalam AppModal yang sama, komponen bersama, konfirmasi direset setelah koreksi; kegagalan mempertahankan isian. Backup/antivirus/pemeliharaan wajib melindungi referensi platform.
