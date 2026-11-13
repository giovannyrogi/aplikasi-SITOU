# Kontrak API SITOU Mobile

Bagian terkait

- [Autentikasi SITOU Mobile](#autentikasi-sitou-mobile)
- [API baca beranda SITOU Mobile](#api-baca-beranda-sitou-mobile)
- [Absensi mobile SITOU](#absensi-mobile-sitou)

Kontrak backend untuk Flutter. Panduan aplikasi dan perangkat tetap di checkout SITOU Mobile.

## Autentikasi SITOU Mobile

### Kontrak lokal — 27 Oktober 2026

Flutter menggunakan backend Next.js dan PostgreSQL SITOU yang sama. Login web, cookie `sitou_session`, validasi origin, pesan dan permission web tetap dipertahankan. Verifikasi bcrypt, dummy hash, bucket kegagalan dan audit login digunakan bersama melalui `lib/auth/credentialService.js` dan `userRepository.js`; kebijakan mobile berada di `lib/auth/mobile/`.

| Metode/path | Request | Hasil |
| --- | --- | --- |
| POST `/api/auth/mobile/login` | JSON `{username,password}` | `data: {token,tokenType:"Bearer",expiresAt,user}` |
| GET `/api/auth/mobile/me` | `Authorization: Bearer <token>` | `data: {user,expiresAt}` |
| POST `/api/auth/mobile/logout` | Bearer sesi yang hendak dicabut | `data: null`; idempotent, token hilang/palsu tetap sukses |

Envelope mengikuti SITOU: `success`, `message`, `code`, `requestId`, `data` pada sukses; error memakai `fieldErrors` bila relevan. Semua respons `Cache-Control: no-store`, tanpa cookie. Timestamp expiry ISO 8601 UTC. Login tidak di-retry otomatis; logout berulang aman. Jangan mengirim token melalui URL, analytics, log atau laporan QA. `/me` mengabaikan ID organisasi/Pegawai yang diberikan klien dan selalu memakai identitas sesi. Endpoint web existing belum menerima bearer mobile.

Login hanya menerima dua field tersebut, JSON maksimum 8 KiB, username 1–100 karakter mengikuti format existing, password tidak dipangkas dan maksimum 72 byte UTF-8 bcrypt. Malformed JSON, tipe/field tambahan dan panjang invalid ditolak 400; Content-Type salah 415; payload terlalu besar 413. Origin browser asing tetap ditolak; request native tanpa Origin diterima sesuai helper existing.

### Pesan dan kelayakan

Username tidak ditemukan: HTTP 401 `USERNAME_NOT_FOUND`, `fieldErrors.username`, “Nama pengguna tidak ditemukan.” Password salah: HTTP 401 `PASSWORD_MISMATCH`, `fieldErrors.password`, “Kata sandi tidak sesuai.” Field kosong: “Isi nama pengguna.” / “Isi kata sandi.” Dummy bcrypt tetap dikerjakan pada username yang tidak ditemukan. Pengungkapan keberadaan username merupakan keputusan produk yang disetujui; pantau log terstruktur `[auth.mobile.rejected]` (code/requestId/IP tanpa username/password/token) serta bucket keamanan. Web tetap memakai pesan kredensial gabungan existing.

Lima kegagalan kredensial per jendela 15 menit memakai bucket existing yang sama pada pasangan sumber/username web dan mobile. Percobaan berikutnya 429 `RATE_LIMITED`, pesan “Terlalu banyak percobaan. Coba lagi nanti.” dan `Retry-After` detik. Tidak menambah kebijakan penguncian akun global.

Setelah password benar, urutan penolakan mobile adalah organisasi/masa akses, profil, status akhir/draft, akun, kemudian membership. Status organisasi didahulukan. Pensiun tetap menghasilkan pesan pensiun meski workflow menonaktifkan akun. Superadmin/platform tanpa profil organisasi berizin tidak diberi akses pribadi.

| Kode HTTP 403 | Pesan |
| --- | --- |
| ORGANIZATION_INACTIVE | Organisasi dinonaktifkan. |
| ORGANIZATION_NOT_STARTED | Masa akses organisasi belum dimulai. |
| SUBSCRIPTION_SUSPENDED | Masa akses organisasi ditangguhkan. |
| SUBSCRIPTION_CANCELLED | Masa akses organisasi dibatalkan. |
| ORGANIZATION_EXPIRED | Masa akses organisasi berakhir. |
| SUBSCRIPTION_UNAVAILABLE | Masa akses organisasi belum tersedia. |
| EMPLOYEE_NOT_LINKED | Akun belum terhubung ke profil Pegawai. |
| EMPLOYEE_PROFILE_UNAVAILABLE | Profil Pegawai tidak tersedia. |
| EMPLOYEE_DRAFT | Profil Pegawai belum aktif. |
| EMPLOYEE_RETIRED | Tidak dapat masuk. Status Pegawai sudah pensiun. |
| EMPLOYEE_TERMINATED | Tidak dapat masuk. Hubungan kerja sudah berakhir. |
| EMPLOYEE_DECEASED | Tidak dapat masuk. Status Pegawai tercatat meninggal. |
| ACCOUNT_INACTIVE | Akun dinonaktifkan. |
| ROLE_INACTIVE | Hak akses akun tidak aktif. |
| EMPLOYEE_STATUS_INACTIVE | Status Pegawai tidak aktif. |

HRD, Pimpinan dan Pegawai dengan membership berlaku pada organisasi profil mendapat Homepage yang sama. Profil aktif/masa percobaan mendapat `accessMode:self_service`; ditangguhkan mendapat `read_only`. Penempatan, lokasi/divisi nonaktif tidak memblokir login mobile; fitur operasional mendatang wajib memeriksa kelayakannya. Grace organisasi mengikuti layanan web existing dan tetap diizinkan. Role admin tidak diubah dan tidak otomatis memberi akses API administrasi kepada aplikasi mobile.

### Sesi dan fitur berikutnya

API baca beranda kini tersedia lokal melalui GET `/api/mobile/home` dan `/api/mobile/profile-photo`, tanpa mengubah envelope login/me/logout. Lihat `docs/mobile-api.md` untuk DTO minimum, permission per bagian, akses foto privat, zona waktu dan urutan deployment. Endpoint web existing tetap tidak menerima bearer mobile; hanya adapter mobile tersebut yang ditambahkan. Tidak ada endpoint pencatatan absensi/cuti baru.

Migration `20261027_065_mobile_auth_sessions.sql` menambah `mobile_auth_sessions`. Token acak 256 bit dengan prefix `sm1_`; hanya SHA-256 token tersimpan di database. Expiry mutlak dibaca dari `AUTH_MOBILE_SESSION_TTL_MINUTES` pada environment backend, tanpa refresh. Snapshot mengikat user, organisasi, profil, membership dan `credential_version`; FK komposit mencegah referensi profil/membership lintas organisasi. Hasil API hanya identitas minimum, bukan data profil sensitif atau password hash.

Setiap request terproteksi memanggil `requireMobileUser(request)`, membaca ulang status dan versi kredensial. Sesi hilang/palsu/expired/revoked -> 401 `UNAUTHENTICATED`, “Sesi berakhir. Silakan masuk kembali.” Perubahan password atau relasi/membership membuat snapshot tidak cocok dan mencabut sesi; penonaktifan, pensiun atau akses dicabut ditolak pada pemakaian berikutnya. Logout mencabut satu sesi. Sesi perangkat lain independen sampai status/versi berubah.

Mutation mendatang **wajib** memakai `requireMobileUser(request,{write:true})` dan pemeriksaan permission/objek khusus fitur. `read_only` ditolak 403 `MOBILE_READ_ONLY` (“Akun hanya memiliki akses baca.”). Guard ini bukan pengganti transaksi, idempotency atau izin objek. Belum ada endpoint absensi/cuti mobile dalam pekerjaan ini.

Flutter menyimpan sesi melalui secure storage platform; password tidak disimpan. Startup/resume memeriksa `/me`, sesi tidak valid dibersihkan, kegagalan jaringan sementara mempertahankan token. Request terproteksi fitur berikutnya wajib menangani penolakan sesi melalui controller dan guard yang sama. Native HTTP hanya loopback development; rilis wajib HTTPS dengan validasi sertifikat normal.

### Operasional dan penerapan

Upgrade database existing melalui migration 065, **bukan** menjalankan bootstrap `sitou_schema_v3.sql`. Snapshot tersebut sudah memuat struktur akhir untuk database kosong. `npm run db:verify-bootstrap` membandingkan kolom/constraint mobile upgrade dan bootstrap. Backup dan review migration pada staging sebelum penerapan produksi; penambahan tabel tidak memigrasikan akun/password atau mengubah alur web.

Pembersihan berkala: `npm run auth:mobile-sessions:prune` (environment default `.env.development`; pilih file dengan `ENV_FILE`). Menghapus sesi expired dan sesi revoked lebih dari satu hari, mempertahankan audit. Jadwalkan harian melalui mekanisme operasional VPS setelah deployment diotorisasi. Tidak membuat cron otomatis pada pekerjaan ini.

Untuk lokal: jalankan Next.js port 3000, `adb reverse tcp:3000 tcp:3000`, lalu Flutter debug memakai `http://127.0.0.1:3000`. Kredensial akun nyata diketik langsung di aplikasi. QA status memakai fixture sintetis terisolasi yang dibersihkan. Deployment VPS/restart/migration produksi belum dilakukan; saat rollout diperlukan migration 065, kode backend terbaru dan konfigurasi base URL HTTPS mobile. Endpoint ini tidak memerlukan secret baru di APK.

Risiko: username enumeration sengaja diterima dengan kontrol kegagalan bersama dan audit. Tidak ada klaim kebal DoS atau sertifikasi MASVS. Upload/lokasi/idempotency transaksi bisnis tidak berlaku pada login; wajib dinilai saat fiturnya dibangun. iOS, konfigurasi signing produksi, identifier distribusi dan rollout VPS memerlukan verifikasi tersendiri.

### Konfigurasi durasi sesi backend

`lib/auth/mobile/config.mjs` membaca `AUTH_MOBILE_SESSION_TTL_MINUTES` saat login, bukan dari environment Flutter. Next.js memuat environment sesuai mode server: `.env.development` untuk development dan `.env.production` untuk production, dengan prioritas override environment/berkas lokal sesuai loader Next.js. Gunakan `AUTH_MOBILE_SESSION_TTL_MINUTES=10080` untuk tujuh hari (bukan 10000 menit).

Nilai wajib bilangan bulat desimal 1–10080 menit. Nilai kosong/hilang, nol, negatif, pecahan, nonnumerik atau lebih dari 10080 ditolak sebelum verifikasi kredensial/penerbitan sesi. Tidak ada fallback diam-diam. HTTP mengembalikan gangguan generik 500 tanpa membuka detail konfigurasi; log server memuat kode `AUTH_CONFIGURATION_ERROR`. Login web tetap memakai `AUTH_SESSION_TTL_MINUTES` dan tidak bergantung pada variabel mobile ini.

Expiry sesi baru dihitung menggunakan parameter SQL menit dan disimpan sebagai timestamp absolut. Sesi yang sudah terbit tetap mengikuti `expires_at` awal; mengurangi TTL bukan pencabutan sesi existing. `/me`, logout, versi kredensial, hash token dan kontrak respons tidak berubah. Batas database maksimal tujuh hari tetap berlaku sehingga tidak diperlukan migration baru.

Sesudah mengubah environment, muat ulang/restart backend development bila nilai belum termuat. Untuk rollout VPS nanti, konfigurasi variabel ini pada environment production **sebelum** proses backend baru dijalankan/restart. Production tanpa konfigurasi tersebut menolak login mobile; login web tetap independen. Pekerjaan ini tidak mengubah `.env.production` atau VPS. Flutter tidak perlu dibangun ulang untuk perubahan TTL.

### Autentikasi native SITOU Mobile

- API baca beranda `/api/mobile/home` dan foto pribadi `/api/mobile/profile-photo` mengikuti `docs/mobile-api.md`: bearer melalui requireMobileUser, permission self-service existing dan identitas dari sesi saja, tanpa selector atau akses admin tersirat. Storage foto tetap privat/audited/no-store. Tidak ada statistik absensi atau mutation bisnis pada endpoint ini; data contoh homepage Flutter bukan rekap backend. Kontrak login/web dan schema tidak berubah.

- Kontrak `/api/auth/mobile/login`, `/me`, `/logout` dan kebijakan mobile wajib mengikuti `docs/mobile-api.md`; login/cookie/origin/pesan serta permission web existing tetap dipertahankan.
- Shared `verifyLoginCredentials()` mempertahankan bcrypt/dummy hash, bucket kegagalan dan audit; jangan menduplikasi pemeriksaan password atau memisahkan bucket agar web/mobile dapat dilewati bergantian.
- Khusus mobile, produk menyetujui username tidak ditemukan dan password salah dibedakan melalui 401 `USERNAME_NOT_FOUND`/`PASSWORD_MISMATCH` dengan fieldErrors spesifik dan singkat. Jangan menerapkan pesan gabungan web pada mobile atau mengubah pesan web tanpa instruksi baru. Pantau audit/rate limit karena keputusan ini mengungkap keberadaan username.
- Role HRD/Pimpinan/Pegawai tidak berubah. Mobile wajib profil Pegawai organisasi sesuai dan kelayakan organisasi/status/membership; pensiun tetap ditolak dengan pesan pensiun meski akun sudah dinonaktifkan. Status hanya dijelaskan setelah password benar dan masalah organisasi didahulukan. Ditangguhkan hanya baca.
- Endpoint mobile baru wajib `requireMobileUser()`; mutation memakai `{write:true}` ditambah permission/objek/organisasi dan validasi bisnis. Cookie web bukan bearer mobile dan bearer mobile tidak otomatis membuka API admin web.
- Tabel sesi hanya menyimpan hash token, expiry mutlak dari `AUTH_MOBILE_SESSION_TTL_MINUTES` backend (wajib integer 1–10080 menit, maksimal tujuh hari) tanpa refresh, snapshot versi kredensial serta FK organisasi/profil/membership. Selalu periksa kelayakan terkini, revocation dan expiry; jangan memasukkan token ke log/URL.
- Perubahan schema melalui migration baru dan sinkronisasi snapshot/peta/kontrak/operasional. Jalankan verifikasi upgrade serta bootstrap kosong. Penerapan lokal tidak mengizinkan deployment VPS otomatis.

## API baca beranda SITOU Mobile

Beranda Flutter memakai sesi bearer existing. Login/me/logout, cookie web, origin, role serta permission administrasi tidak berubah. Tidak ada tabel atau migration baru. `lib/auth/mobile/home.js` adalah adapter baca berizin untuk sumber data dan storage existing.

### Kontrak

GET `/api/mobile/home` menerima Authorization Bearer, tanpa query/body selector. Respons envelope SITOU menyertakan requestId dan `data:{profile:{name,hasPhoto},organization:{name,timezone},placement,serverTime}`. `placement` string nama lokasi penempatan utama yang berlaku atau null; tidak menunjukkan validasi GPS. `serverTime` ISO 8601 UTC; timezone IANA berasal dari organisasi. Tidak mengirim NIK, kontak, password, object key, token atau daftar data administratif.

Setiap request memanggil requireMobileUser dan `employees.read_self`. Identitas actor selalu dipetakan dari sesi, bukan ID klien; readEmployeeDashboard membaca profil user dan penempatan utama sesuai tanggal zona organisasi. Penempatan hanya dikirim dengan `assignments.read_self`. hasPhoto hanya aktif jika ada referensi foto dan `profile_self.read`. Tidak membaca statistik cuti/sanksi/kontrak untuk DTO beranda. Zona invalid/tidak tersedia ditolak 503 TIMEZONE_UNAVAILABLE; tidak memilih zona perangkat atau fallback baru.

GET `/api/mobile/profile-photo` menerima bearer dan tidak menerima fileId/employeeId/organizationId atau query lain. Wajib `employees.read_self` dan `profile_self.read`; getSelfProfilePhoto memastikan employee.user_id, organisasi, pemilik file, referensi pas foto, category employee_photo dan lifecycle aktif tanpa draft/deleted/purged. getStoredFile dan assertStoredFileAvailable mempertahankan kebijakan pemindaian serta storage privat existing. Hanya JPEG/PNG/WebP maksimal 5 MiB, preview diaudit melalui private_file.preview. Respons memakai Content-Type, Content-Length, nama tersanitasi, CSP sandbox, nosniff, private/no-store. File tetap privat, tidak tersedia melalui path publik.

Kedua GET memakai validasi origin existing. Tanpa sesi/invalid/revoked/expired ditolak 401; kelayakan akun/organisasi memakai 403 kontrak mobile. SELF_FORBIDDEN 403 tidak berarti sesi dicabut. Query selector ditolak 400 VALIDATION_ERROR dengan fieldErrors; foto kosong/tidak dimiliki/tidak aktif 404; gangguan internal aman 500 dengan requestId. Tidak ada mutation bisnis atau retry otomatis; GET dapat dicoba ulang manual. Audit preview merupakan efek baca yang disengaja, bukan pencatatan absensi. Metode selain GET tidak ditambahkan.

### Integrasi dan penerapan

Flutter memisahkan profil asli dari HomeExampleData: shift, status absensi, ringkasan 19/1/0 dan pengumuman contoh diotorisasi pemilik untuk desain, bukan hasil query database. Tombol belum tersedia hanya menampilkan Segera tersedia; tidak memanggil endpoint pencatatan. API ini tidak memberikan data absensi atau saldo cuti dan tidak boleh diklaim menyelesaikan integrasi bisnis tersebut.

Deploy kode backend baru sebelum distribusi APK homepage; schema tetap existing (termasuk sesi mobile migration 065). APK lama tetap memakai kontrak auth unchanged. APK baru menangani endpoint belum tersedia sebagai kegagalan muat/coba lagi. Gunakan base URL HTTPS domain pada rilis, tanpa adb reverse. Tidak ada penerapan VPS otomatis. Rilis operasional menunggu penggantian data contoh, QA perangkat/platform serta regresi sesi dan permission.

## Absensi mobile SITOU

Flutter memakai bearer mobile dan identitas Pegawai dari sesi. Hak profil dan penempatan sendiri, status akun, organisasi, modul Absensi, serta akses tulis untuk preflight/kirim diperiksa di server. Katalog jadwal dan titik tetap dikelola dari dashboard.

Keterangan pulang yang melewati jadwal pada mobile memakai **Pulang lewat jam kerja** diikuti selisih waktu dari server, misalnya **30 menit** atau **1 jam 15 menit**. Formatter presentasi bersama dipakai pada tinjauan dan hasil absensi. Kategori/timestamp/angka penilaian serta pesan mentah API tetap kompatibel; perubahan bahasa ini tidak mengubah perhitungan atau persetujuan lembur.

### Urutan masuk dan pulang lintas hari

Backend memprioritaskan sesi masuk yang masih terbuka. Contoh: masuk 11 November pukul 23.55 untuk jam 22.00–01.00 tetap dipulangkan pada tanggal kerja 11 November setelah tengah malam. Masuk pada jadwal 12 November belum tersedia sebelum pulang tersebut disimpan. Penguncian berlaku untuk jadwal reguler, tambahan, dan absen saat libur. GET, preflight dan transaksi kirim memakai aturan yang sama; request masuk lama yang sudah terbuka di perangkat tetap ditolak bila sesi lain belum selesai. Lock Pegawai pada transaksi event mencegah dua pengiriman paralel melewati pemeriksaan.

Flutter memprioritaskan sesi terbuka pada kartu Beranda serta memakai daftar tindakan yang sama untuk tombol dan pemilih jam. Identitas tetap pasangan `workDate` dan `sessionNo`; nomor sama pada dua tanggal bukan sesi yang sama. Nama tampilan menghapus akhiran internal `— sesi N`, dan rentang jam tidak menambahkan `(+1 hari)`. Timestamp UTC, tanggal kerja, urutan sesi dan perhitungan lintas hari tetap dipertahankan. Catatan lama yang sudah ditandai lupa pulang tidak diperbaiki otomatis oleh perubahan ini.

Perubahan tidak memerlukan migration. Terapkan backend baru dan bangun/pasang ulang aplikasi Flutter untuk memperoleh penguncian tombol serta label baru. Backend baru juga menolak masuk yang tidak sah dari APK lama; tidak mengubah event atau histori yang sudah tersimpan.

- GET `/api/mobile/attendance` mengembalikan `timezone`, `today`, `status`, sesi berisi tanggal kerja, urutan, jam UTC, absen aktual, tindakan, serta status lupa keluar. Titik berisi ID, nama, koordinat, radius dan batas akurasi. Pegawai ditangguhkan hanya mendapat status baca.
- POST `/api/mobile/attendance/preflight` menerima JSON `action`, `workDate`, `sessionNo`, `pointId`, `latitude`, `longitude`, `accuracy`. Respons berisi `proof` bertanda tangan dengan masa lima menit, jarak, status, pesan, `offerNote`, dan `requiresNote`. Bukti ini hanya berlaku pada sesi dan titik yang diperiksa.
- POST `/api/mobile/attendance/events` menerima multipart dengan satu bagian teks `data` (JSON preflight ditambah `proof`, UUID `clientEventId`, dan `note` maksimal 500 karakter, wajib bila posisi akhir di luar radius) serta satu `photo` maksimal 5 MiB. Backend memvalidasi ulang dan mengembalikan hasil dengan jam UTC, tanggal kerja, sesi, titik, dan zona waktu. Respons sukses juga berisi `note` string atau null dari catatan event yang tersimpan. Nilai telah dipangkas pada validasi input dan dibatasi 500 karakter. `pointName` berasal dari titik absensi yang dipakai, bukan profil/penempatan Pegawai. `occurredAt` dan `timezone` menentukan tanggal/jam kejadian; `workDate` tetap tanggal kerja sesi. UUID sama dan payload/foto sama mengembalikan hasil asli. Replay event lama melengkapi `note` dari `attendance_events.attendance_note` tanpa mengubah event atau receipt tersimpan. UUID dengan isi berbeda ditolak.
- Posisi di luar radius memakai titik yang berizin dan GPS yang memenuhi batas akurasi. Preflight mengembalikan `requiresNote: true`. Saat kirim, server menghitung ulang jarak dan menolak catatan kosong dengan HTTP 422 `OUTSIDE_NOTE_REQUIRED`. Event yang diterima menyimpan `geofence_status = outside` dan catatannya, dengan `validation_status = valid` sehingga urutan masuk/keluar tetap berjalan. Alur ini tidak memiliki tahap persetujuan. Klien lama menerima kontrak tambahan secara kompatibel, tetapi dapat gagal kirim di luar radius bila belum menyediakan isian catatan. Rilis aplikasi bersama perubahan API.
- Sesi tanpa aturan masuk khusus dibuka sejak awal tanggal kerja untuk sesi pertama. Sesi berikutnya dibuka setelah batas sesi sebelumnya bila tidak memiliki jendela khusus. Absen keluar mengacu ke sesi masuk terakhir yang belum ditutup. Memulai sesi lain meninggalkan sesi lama tanpa jam keluar. Shift malam mengikuti tanggal mulai. Waktu event online mengikuti server.
- Foto privat memakai kategori `attendance_photo`. Metadata dan event berada dalam transaksi. Gunakan ClamAV sesuai konfigurasi deployment dan aturan upload existing. Akses file mengikuti file ID berizin. Respons absensi tidak memuat URL, nama fisik atau path foto.

Pengaturan **Data Master → Organisasi → Peta absensi** hanya dapat disimpan Superadmin. `attendanceMapProvider` opsional pada API organisasi, dengan pilihan `openstreetmap` atau `google`. Default organisasi baru dan existing adalah OpenStreetMap. PATCH yang tidak mengirim pilihan mempertahankan nilai tersimpan. GET absensi mengirim `mapProvider` dari organisasi sesi. Tidak ada API key, URL tile, atau kredensial di API ini. Migration 078 wajib sebelum merilis kode baru.

Migration 077 menambahkan `schedule_session_id` dan `attendance_note` pada event, constraint komposit sesi, serta hash payload di receipt. Event lama masih bisa memiliki relasi sesi kosong. Sebelum merilis backend, terapkan migration dan restart aplikasi bersama rilisnya. Endpoint login, cookie web dan endpoint dashboard tetap memakai kontrak existing. Jangan terapkan skema bootstrap ke database existing.

### Susunan folder selfie baru

Contoh object key relatif terhadap UPLOAD_ROOT:

```text
org_1/absensi/2026/kantor-pusat-12/unit-operasional-5/11/10/budi-pulang-002523-<uuid>.png
```

- Tahun, bulan dan hari berasal dari tanggal kerja sesi. Foto pulang setelah tengah malam tetap berada bersama foto masuk pada tanggal kerja yang sama. Jam HHmmss berasal dari waktu server dalam zona organisasi.
- Lokasi dan divisi/unit memakai nama penempatan utama efektif pada tanggal kerja, terikat organisasi dan pegawai sesi. Akhiran ID menjaga nama hasil normalisasi tetap terpisah. Titik absen aktual tetap tercatat secara terpisah. Bila penempatan tidak tersedia pada tanggal kerja, folder memakai tanpa-penempatan dan tanpa-unit tanpa memperluas hak absen.
- Nama file memakai awalan nama depan, jenis absen, jam, dan UUID penuh buatan server. Server menormalisasi label ke huruf ASCII, angka dan tanda hubung, membatasi panjang dan memakai pegawai jika nama depan tidak dapat dibentuk dengan aman. Angka dikeluarkan dari nama depan. Ekstensi mengikuti MIME yang terdeteksi dari byte. Nama lengkap, NIP, NIK dan nama file klien tidak dipakai pada path.
- POST events memeriksa ulang izin, jadwal, titik, receipt dan bukti GPS sebelum menentukan folder. File ditulis sementara di folder tujuan dan dipublikasikan atomik tanpa timpa lewat hard link pada filesystem lokal. Gunakan volume UPLOAD_ROOT yang mendukung hard link. Kegagalan transaksi membersihkan file baru. Replay mengembalikan hasil sebelumnya tanpa menulis file lagi.
- Database memakai stored_files.object_key dan attendance_events.photo_file_id yang sudah ada. Pemeliharaan dan backup membaca object key tersimpan. File dari format terdahulu tetap dapat dibaca dari metadata bila ada. Struktur ini berlaku saat backend baru berjalan dan tidak membutuhkan migrasi database atau perubahan APK.

### Bukti terstruktur dan rekap (migration 079)

Event baru menyimpan assessment_version=1. timing_category membedakan on_time, early_check_in, late_check_in, early_check_out, late_check_out dan flexible_check_in. schedule_reference_at serta schedule_offset_seconds merekam acuan dan selisih bertanda; early_arrival_minutes, late_minutes, early_leave_minutes dan late_departure_minutes menjadi angka laporan. Menit dibulatkan ke bawah. Bila melewati toleransi, seluruh selisih dihitung mengikuti perilaku absensi existing; toleransi tidak dikurangi dari selisih. Selisih detik tetap tersedia untuk kejadian kurang dari satu menit. Check-in fleksibel tidak dinilai terlambat dari jam awal; acuan pulangnya adalah masuk aktual + target kerja + istirahat yang dikurangi.

Posisi Pegawai tetap latitude/longitude/accuracy_m. Bukti titik dibekukan pada point_location_id_snapshot, point_name_snapshot, point_latitude_snapshot, point_longitude_snapshot dan max_accuracy_m_snapshot; allowed_radius_m dan distance_from_point_m tetap menyimpan radius/jarak kejadian. organization_timezone_snapshot membekukan zona waktu. Perubahan master tidak mengubah bukti lama. Tidak menampilkan koordinat atau foto pada log.

Preflight menambahkan timing; hasil kirim menambahkan timing dan pointSnapshot (name, locationId, latitude, longitude, radiusMeters, maxAccuracyMeters). Semua angka berasal dari server, bukan input penilaian klien. Envelope/auth dan field existing tetap berlaku. Receipt lama boleh tidak berisi objek baru; jangan mengarang bukti atau menghitung ulang respons historis berdasarkan master terbaru.

lib/attendance-points/timing.mjs menjadi perhitungan bersama. summaries.mjs memperbarui attendance_daily_summaries dalam transaksi event/receipt/file yang sama. Lock organisasi lalu Pegawai menggunakan FOR NO KEY UPDATE, kompatibel dengan pemeriksaan FK metadata foto; snapshot/rekap dikunci sebelum upsert. Kegagalan rekap membatalkan event dan receipt. Lock serta pemeriksaan urutan melindungi request paralel; UUID tetap terikat hash payload.

Rekap menyimpan scheduled_minutes, worked_minutes, early_arrival_minutes, late_minutes, early_leave_minutes, late_departure_minutes, jumlah sesi terencana/lengkap/terbuka, missing_check_in_count, missing_check_out_count, unassessed_event_count dan outside_event_count. calculation_details versi 1 mencatat sumber event per sesi, detik kerja, sesi menunggu dan durationComplete. Durasi hanya menjumlahkan pasangan masuk/pulang valid, mengurangi istirahat per sesi dan mengecualikan jeda antarsesi. Sesi belum mulai bukan ketidakhadiran. Masuk sesi baru memperbarui sesi sebelumnya yang belum pulang tanpa membuat jam pulang.

overtime_candidate_minutes hanya kandidat dari pulang melewati acuan, bukan persetujuan lembur. Datang awal tetap metrik terpisah. approved_overtime_minutes, override manual serta keputusan leave/permission/sick/official_duty/off/holiday tidak ditimpa. Status incomplete/needs_review harus terlihat sebagai data belum final pada laporan mendatang; jangan membaca pesan UI sebagai kategori.

Batas tahap ini: rekap event-backed, belum rekonsiliasi hari tanpa event dengan cuti/izin/kalender atau proses koreksi HRD. Event lama tidak diubah; bukti baru tetap NULL. Rekap lama dapat memakai snapshot sesi untuk perkiraan waktu/durasi, tetapi wajib needs_review dan unassessed_event_count > 0. Bukti titik lama tidak bisa direkonstruksi dari titik sekarang.

#### Operasional dan urutan rilis

Terapkan 079 setelah 077/078 menggunakan runner migration existing, lalu restart backend dan rilis mobile. Bootstrap hanya untuk database baru. Tidak ada deployment VPS otomatis.

Pembentukan ulang dibatasi satu organisasi, 31 hari dan 100 Pegawai; --employees opsional berisi ID dipisahkan koma. Tanpa --apply seluruh perubahan di-rollback. Commit per Pegawai, sehingga kegagalan batch setelah sebagian commit dapat dilanjutkan dengan perintah idempotent yang sama. Kredensial dibaca di backend melalui ENV_FILE, default .env.development; untuk server tetapkan ENV_FILE=.env.production secara eksplisit. Jangan menyalin environment ke Flutter.

Contoh dari folder backend (PowerShell/Windows gunakan node langsung):
```powershell
node scripts/rebuild-attendance-summaries.mjs --organization=1 --from=2026-11-05 --until=2026-11-05
node scripts/rebuild-attendance-summaries.mjs --organization=1 --from=2026-11-05 --until=2026-11-05 --apply
```
ID/tanggal contoh harus disesuaikan. Perintah hanya merekap snapshot berisi event dan mempertahankan keputusan HRD; bukan mengesahkan histori yang belum lengkap.
### Absen pada hari libur (migration 080)

Klien yang mendukung alur ini mengirim header `X-SITOU-Attendance-Version: 2` pada ketiga endpoint absensi. Klien lama tetap menerima sesi terjadwal dengan kontrak sebelumnya. Header hanya menyatakan kemampuan klien. Kelayakan tetap diperiksa dari sesi, modul, hak akses, penetapan dan revisi efektif di server.

- GET mengembalikan `holidayName` dan `allowHolidayAttendance` untuk hari berjalan. Sesi absen saat libur mengembalikan `holidayWork: true`, `holidayName` dan jam rencana null. Server menerbitkan aksi sesuai urutan absen. Shift malam yang belum ditutup tetap menggunakan tanggal kerja awal dan diselesaikan sebelum memulai absen tanpa jadwal pada hari libur.
- Preflight dan hasil simpan memisahkan `outsideRadius` dari `requiresNote`. Absen masuk dan pulang pada hari libur memerlukan alasan 1–500 karakter setelah trim. Kiriman kosong ditolak dengan `HOLIDAY_NOTE_REQUIRED`. Bukti foto, validasi titik/GPS, nonce permintaan, dan idempotensi tetap mengikuti alur yang sama.
- Event `holiday_work` memiliki `timing.version: 2` dan `category: not_applicable`. Acuan dan metrik penilaian waktu bernilai null. Rekap menyimpan tanggal dan status libur, penanda bekerja saat libur, serta durasi aktual setelah pasangan lengkap. Persetujuan lembur dan kompensasi tidak dibuat oleh alur ini.

Urutan rilis adalah migration 080 setelah 079, backend, lalu klien Flutter yang mendukung header baru.

### Bukti GPS dekat batas radius

Setelah sampel lolos batas akurasi, preflight dan hasil simpan mengembalikan nearRadiusBoundary berupa boolean. Server menandai jika nilai mutlak selisih jarak terhadap radius kurang dari atau sama dengan angka akurasi. Jarak dan akurasi dipakai sebelum pembulatan. Hasil simpan dihitung ulang dengan konfigurasi yang berlaku saat event disimpan dan menjadi bagian dari attendance_events.validation_details.result. Input tetap memakai allowlist yang sama. Penanda tidak mengubah geofence_status, aturan catatan, ataupun keputusan validasi event. Tinjau penanda bersama posisi, jarak dan akurasi, tanpa menyimpulkan manipulasi GPS hanya dari penanda tersebut.

Replay mengembalikan penanda event asli. Event lama tanpa penanda berarti belum dinilai dan tetap tidak diubah. Kolom JSONB existing sudah sesuai untuk bukti per event, sehingga tidak diperlukan tabel, kolom, index atau migration baru. Tampilan dan filter laporan ditunda. Pengaturan radius serta batas akurasi setiap lokasi dipertahankan.

### Absen di luar jadwal

Setelah semua sesi terjadwal pada hari kerja berakhir, backend menawarkan sesi tambahan apabila tidak ada sesi yang harus ditutup. Jadwal khusus diselesaikan oleh resolver existing dan mendapat prioritas yang sama dengan sesi terjadwal lainnya. Jika jadwal khusus berakhir lebih malam, sesi tambahan baru tersedia setelah jam akhirnya. Hari libur tetap memakai kebijakan absen saat libur. Hari tanpa jadwal tidak memperoleh sesi tambahan otomatis.

Sesi tambahan berisi waktu aktual dari server dan alasan wajib saat masuk dan pulang. Nomor 17–32 dicadangkan untuk pasangan sesi tambahan pada tanggal kerja, terpisah dari sesi terjadwal 1–16. Mulai sesi tambahan berikutnya setelah sesi sebelumnya ditutup. Absen pulang dapat dicatat setelah tengah malam memakai tanggal kerja asal selama sesi masih terbuka.

Klien versi 3 mengirim X-SITOU-Attendance-Version: 3 pada endpoint baca, preflight, dan events. Versi 2 tetap mendukung hari libur. Sesi tambahan hanya ditawarkan untuk versi 3. DTO sesi, preflight dan hasil memakai outsideSchedule. Lokasi di luar radius tetap memakai outsideRadius sehingga kedua penanda dapat muncul bersama. Pengiriman tanpa alasan ditolak dengan OUTSIDE_SCHEDULE_NOTE_REQUIRED. Backend memeriksa ulang sesi dan akses di bawah lock yang sama dengan absensi lain. Replay identik tetap mengembalikan event asli.

Migration 081 menambah outside_schedule_session_no pada attendance_events dan mengizinkan work_context=outside_schedule dengan penilaian versi 2, kategori not_applicable, dan tautan ke jadwal harian existing. Sesi tambahan tidak membuat shift fiktif. Rekap memasangkan nomor sesi dalam satu jadwal harian, menjumlahkan durasi aktual, dan menyimpan outsideScheduleSessions serta outsideScheduleWorkedMinutes dalam calculation_details. Hari dengan sesi tambahan ditandai needs_review. Durasi tambahan tidak mengisi kandidat atau persetujuan lembur. Absensi terjadwal yang terlewat tetap tercatat.

Urutan rilis adalah migration 081 setelah 080, backend, lalu APK dengan header versi 3. Sebelum memasang APK baru pada server lama yang memerlukan akses hari libur, naikkan versi backend agar versi 3 dikenali.

### Pemeriksaan selfie per organisasi

Header `X-SITOU-Attendance-Version: 4` mendukung pemeriksaan selfie. GET dan preflight mengembalikan `selfiePolicy: { enabled, version }`. Tanpa baris organisasi, nilainya nonaktif dengan versi 0. Kiriman v4 menyertakan `selfiePolicyVersion` dari preflight. Versi ini terikat ke bukti lokasi dan diperiksa terhadap pengaturan terbaru saat mencatat event. Bila berubah, API mengembalikan `SELFIE_POLICY_CHANGED` (409) dan aplikasi mengarahkan kembali ke peta. Retry yang sudah tercatat mengembalikan hasil tersimpan setelah pemeriksaan kepemilikan dan payload.

Jika pemeriksaan aktif, permintaan baru dari versi lama mendapat `APP_UPDATE_REQUIRED` (409). Saat nonaktif, alur versi lama tetap tersedia sesuai dukungan sesi masing-masing. Hanya Admin SITOU yang mengubah pengaturan melalui fitur organisasi. Penilaian visual berjalan di Flutter dan header versi adalah kontrak kompatibilitas aplikasi, bukan bukti integritas perangkat atau identitas Pegawai. Server tetap memvalidasi foto, sesi, dan lokasi seperti sebelumnya.

### Absensi self-service mobile

- Jadwal khusus dan sesi terjadwal selalu didahulukan. Setelah seluruh sesi tanggal kerja berakhir dan tidak ada sesi terbuka, klien absensi versi 3 dapat mencatat sesi tambahan terpisah. Alasan, GPS, titik berizin dan selfie tetap wajib. Pasangkan masuk/pulang dengan nomor sesi tambahan dan tandai untuk tinjauan. Simpan di luar jadwal terpisah dari terlambat, hari libur, dan lembur disetujui. Lihat docs/mobile-api.md.

- API self-service memakai bearer mobile dan identitas Pegawai dari sesi, gerbang modul Absensi serta hak profil dan penempatan sendiri. Preflight memeriksa titik sebelum selfie. Mutasi memvalidasi ulang, mengunci organisasi dan Pegawai, serta mencatat event append-only per sesi dan receipt idempotensi. Foto privat melalui storage existing. Di luar radius titik berizin, server menerima absensi hanya dengan alasan terisi dan menyimpan geofence `outside`. Akurasi GPS, jadwal, izin titik, serta selfie tetap wajib. Lihat `docs/mobile-api.md`.

### Penyedia peta absensi

- Peta absensi per organisasi diatur Superadmin melalui form Organisasi. Simpan pilihan allowlist dan audit; API mobile mengirim penyedia organisasi sesi tanpa kredensial. Peta tidak mengubah validasi GPS atau absensi.

### Data untuk laporan absensi

- Gunakan metrik kategori/menit, snapshot sesi/titik/zona waktu serta versi perhitungan dari server. Jangan membaca teks UI sebagai status atau mengganti histori dengan master terbaru. Event lama tanpa bukti tetap tidak diketahui.
- Rekap event dan receipt berada dalam satu transaksi; pertahankan override HRD, keputusan cuti/izin serta approved_overtime_minutes. Kandidat pulang lewat jam kerja bukan persetujuan lembur.
- Durasi hanya dari pasangan masuk/pulang lengkap per sesi, kurangi istirahat dan keluarkan jeda. Sesi terbuka tidak memiliki durasi final. Hari tanpa event memerlukan rekonsiliasi izin/kalender sebelum disimpulkan absen. Ikuti docs/mobile-api.md.
