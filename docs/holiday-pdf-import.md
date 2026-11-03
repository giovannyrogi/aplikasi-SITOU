# Unggah PDF SKB dan operasional OCR

## Perilaku produk

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

## Penyimpanan, API dan batas proses

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

## Development Windows: langkah lengkap

Panduan ini memakai PowerShell. Status komputer proyek ini pada 2 November 2026: Tesseract, Poppler, model ind/eng/osd dan path environment sudah tersedia; migration 070 sudah diterapkan. **Pada komputer ini cukup ikuti W6 dan W7. Jangan mengulang migration.** Komputer lain tetap perlu instalasi W1–W5.

### W1. Periksa alat dan proyek

```powershell
Set-Location -LiteralPath 'D:\Project\App-Dev\Webdev\aplikasi-SITOU'
node --version
npm --version
winget --version
```

Fitur diuji dengan Node.js 24.x. PostgreSQL development harus aktif dan .env.development harus memiliki konfigurasi PG* serta login existing. Jika baru mengambil rilis atau lockfile berubah, hentikan proses development lalu jalankan npm ci. Tidak perlu npm ci setiap kali unggah PDF. Npm tidak memasang executable Tesseract/Poppler.

### W2. Pasang OCR dan Poppler sekali

```powershell
winget install --id UB-Mannheim.TesseractOCR --exact --source winget
winget install --id oschwartz10612.Poppler --exact --source winget
```

Ikuti installer/UAC jika Windows meminta. Tutup dan buka kembali PowerShell sesudah instalasi agar PATH diperbarui. Jika winget tidak tersedia, gunakan installer Windows yang ditautkan [dokumentasi Tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html) serta ZIP [rilis Poppler Windows](https://github.com/oschwartz10612/poppler-windows/releases). Ekstrak ZIP ke folder tetap, misalnya C:\Tools\poppler. Executable dan DLL Poppler harus tetap bersama.

### W3. Temukan path executable

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

### W4. Pasang model bahasa dan orientasi

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

### W5. Konfigurasi .env.development

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

### W6. Periksa schema dan kesiapan

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

### W7. Jalankan web dan worker pada dua terminal

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

### W8. Uji dari UI

Buka http://localhost:3000 → login Admin SITOU → Data Master → Katalog Hari Libur → buat/buka draft → Unggah PDF SKB. Pilih PDF maksimal 10 MB/20 halaman. Pastikan progres bergerak, periksa kategori/halaman sumber, isi nomor keputusan bila perlu, centang peninjauan, simpan draft → tinjau → terbitkan secara eksplisit.

Contoh SKB 2026 diharapkan menghasilkan 17 tanggal nasional dan 8 cuti bersama, termasuk 24 Desember halaman lanjutan. Uji Lihat PDF/Unduh PDF. HRD berizin hanya membaca katalog terbit dengan Absensi aktif. Tanggal katalog tidak otomatis diterapkan ke seluruh Pegawai.

## VPS Ubuntu/Debian: langkah lengkap

Penerapan VPS terpisah dari implementasi lokal. Contoh berikut dijalankan setelah backup database + seluruh upload privat dan pengecekan konfigurasi server. Jangan menjalankan ulang migration yang sudah diterapkan. Ikuti `database/migrations/README.md` untuk status schema bila belum ada ledger migration.

Jalankan perintah dari folder rilis SITOU. Nama folder, akun layanan, database dan nama proses web harus mengikuti VPS sebenarnya. Gunakan sudo hanya untuk instalasi/pengaturan OS; web dan worker berjalan sebagai akun aplikasi non-root. Instalasi OCR/model cukup sekali per mesin, bukan setiap tahun atau setiap unggah. Penerapan VPS ini belum dijalankan dari development.

Sebelum memasang rilis: identifikasi proses web existing dengan `pm2 list` atau process manager server, pastikan backup siap, hentikan proses terdampak saat maintenance, perbarui kode lalu jalankan `npm ci`. Pertahankan `.env.production` dan `UPLOAD_ROOT` existing; jangan menggantinya dengan path Windows atau contoh panduan.

1. Pasang dependensi sekali sebagai administrator OS:
   ```bash
   sudo apt update
   sudo apt install -y tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng tesseract-ocr-osd poppler-utils
   ```
2. Pastikan ClamAV/clamav-daemon sudah aktif sesuai `docs/production-hardening.md`. Jika belum tersedia:
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

## Urutan singkat setelah setup selesai

- Windows setiap sesi development: jalankan web dan worker pada dua terminal. Setelah mengubah environment atau executable, restart keduanya. Setelah reboot, buka kembali dua terminal.
- VPS setiap update aplikasi: backup → perbarui kode/dependensi → migration yang belum ada → preflight → build → restart web/worker → smoke test. Simpan daftar proses PM2 jika berubah. OCR tidak perlu dipasang ulang setiap pergantian tahun.
- Setiap pembaruan kalender: unggah PDF dari UI → periksa hasil → simpan draft → tinjau → terbitkan. Tidak perlu menjalankan Tesseract manual untuk setiap PDF.

## Diagnosis

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

## Hasil verifikasi implementasi lokal

Verifikasi selesai 2 November 2026 pada Windows/PostgreSQL 18: migration 070 development dan upgrade sintetis mempertahankan data katalog; bootstrap kosong cocok dengan schema upgrade; lint dan production build lolos. Mesin Tesseract beserta model ind/eng/osd dan Poppler sistem tersedia. Development mengikuti kebijakan scanner legacy_unscanned; scanner production yang tidak tersedia diuji menolak proses (fail closed), bukan dianggap lolos pemindaian malware nyata.

PDF SKB contoh menghasilkan 17 tanggal nasional + 8 cuti bersama dengan nama sesuai lampiran, rentang 21–22 Maret dan daftar 20/23/24 Maret terpecah, serta 24 Desember pada halaman lanjutan terbaca. Nomor keputusan yang kurang jelas dikosongkan untuk diisi Admin. PDF teks, pindai berotasi dan campuran teks/pindai diuji; kalimat tambahan di luar tabel tidak ditambahkan sebagai tanggal. Uji struktur konten aktif, halaman berlebih, tanggal invalid, tahun berbeda, duplikasi, timeout, MIME/ukuran/rate, origin, versi, retry receipt, audit rollback, lease worker stale dan expiry staging berhasil.

Alur API upload → worker → simpan draft → terbitkan → dokumen privat berhasil. HRD ditolak mengunggah, membaca draft, memakai scope organisasi lain dan membaca saat Absensi nonaktif. File terbit tetap terlindungi dari cleanup. Backup terenkripsi mencakup PDF platform; ekstraksi memverifikasi hash byte asli dan pemulihan dump pada database sintetis kosong mempertahankan referensi katalog. Tidak melakukan restore, migration atau deployment VPS.

Render tinjau desktop dan mobile 320/375 px, upload/progres, checkbox peninjauan, kegagalan simpan yang mempertahankan isian, retry, serta konfirmasi keyboard Enter/Escape diperiksa. Footer mobile terukur 44 px/full width dengan gap 12 px, tanpa overflow horizontal. Pengujian ini bukan bukti seluruh layout PDF atau pembesaran teks/seluruh perangkat sudah tervalidasi; dokumen yang tidak dikenali tetap memerlukan koreksi eksplisit. Semua database, fixture, skrip, paket backup dan tab QA sementara dibersihkan setelah verifikasi.

## Pembersihan PDF akibat penghapusan katalog

Sesudah migration 071 dan 072, worker:holiday-pdf juga memproses holiday_pdf_purge_jobs pada setiap putaran, termasuk --once. Tidak memerlukan program OS atau service tambahan. Jalankan web dan worker dari rilis serta database/storage yang sama; holiday-pdf:check kini memeriksa tabel antrean pembersihan juga. Jangan menghapus PDF berdasarkan nama/tahun. Dokumen yang masih direferensikan revisi lain tetap disimpan.

Antrean memakai row lock SKIP LOCKED sebagai lease; putusnya worker melepaskan lock. Kegagalan storage/metadata dicoba ulang setiap 30 detik dengan attempts dan last_error aman, tanpa mencetak path. Pantau SELECT attempts,last_error,next_attempt_at FROM holiday_pdf_purge_jobs; antrean kosong berarti tidak ada pembersihan tertunda. Jangan menghapus baris antrean manual untuk menyembunyikan masalah. Referensi pekerjaan dilindungi dari pembersihan storage generik dan expiry unggahan 24 jam. Backup/restore database serta UPLOAD_ROOT tetap melalui prosedur existing. Tidak ada deployment VPS pada perubahan lokal ini.
