# API, isolasi organisasi dan keamanan

Bagian terkait

- [Role, fitur dan hak akses](#role-fitur-dan-hak-akses)
- [File privat dan pemindaian](#file-privat-dan-pemindaian)
- [Hak akses menu HRIS](#hak-akses-menu-hris)

Mulai dari aturan ini untuk sesi, isolasi organisasi, validasi API, dan privasi. Untuk rincian kebijakan, buka [role dan hak akses](#role-fitur-dan-hak-akses) serta [file privat dan pemindaian](#file-privat-dan-pemindaian) sesuai cakupan perubahan.

## Aturan multi-organisasi wajib

1. Setiap tabel bisnis organisasi memiliki `organization_id` langsung.

2. Setiap query bisnis wajib memfilter `organization_id` dari session server, bukan dari body yang dipercaya begitu saja.

3. Foreign key lintas tabel organisasi memakai pasangan `(organization_id, id)` bila tersedia.

4. Jangan menerima `organization_id` klien tanpa mencocokkannya dengan membership aktif.

5. Superadmin platform boleh lintas organisasi hanya pada use case yang eksplisit dan diaudit.

6. Job, export, import, cache key, nama objek file, dan log juga harus membawa identitas organisasi.

7. Test wajib membuktikan user organisasi A tidak dapat membaca atau mengubah organisasi B.

Contoh pola service:

```ts
await db.transaction(async (tx) => {
  const actor = await requireOrganizationPermission(
    tx,
    session,
    organizationId,
    "employees.update",
  );
  await employeeRepository.update(tx, { organizationId, employeeId, input, actorId: actor.userId });
});
```

## API

- Gunakan path langsung `/api/...` tanpa prefix versi. Endpoint autentikasi berada di `/api/auth/...`; endpoint modul berada langsung pada kelompoknya seperti `/api/employees` atau `/api/attendance/...`.

- Respons error publik memakai kode stabil dan Bahasa Indonesia; jangan bocorkan SQL/stack trace.

- Pesan error wajib spesifik, dapat ditindaklanjuti, dan menunjuk field atau aturan bisnis yang bermasalah. Respons validasi wajib menyertakan `fieldErrors`; frontend wajib menempelkannya ke field terkait dan dilarang membuang detail tersebut menjadi pesan generik.

- Error internal tetap memakai pesan aman tanpa SQL/stack trace dan wajib menyertakan `requestId` sebagai ID referensi yang ditampilkan kepada pengguna untuk pencocokan log server. Gunakan helper penanganan error terpusat untuk respons non-JSON, session berakhir, dan kegagalan jaringan.

- Mutation mendukung request ID dan idempotency pada operasi yang mungkin retry.

- Gunakan optimistic concurrency atau version check pada form edit penting.

- Tanggal tanpa waktu memakai ISO `YYYY-MM-DD`; waktu absolut memakai ISO 8601 UTC.

- Cursor pagination harus opaque.

- Semua endpoint mempunyai authorization test, validation test, dan uji isolasi organisasi.

Endpoint awal yang disarankan:

- `GET/POST /api/employees`

- `GET/PATCH /api/employees/:id`

- `POST /api/employees/:id/assignments`

- `GET /api/employees/:id/history`

- `POST /api/attendance/imports`

- `POST /api/attendance/imports/:id/validate`

- `POST /api/attendance/imports/:id/commit`

- `GET /api/attendance/daily`

- `POST /api/attendance/events` untuk web/mobile kelak

- `POST /api/leave-requests`

- `POST /api/leave-requests/:id/decision`

- `GET /api/discipline/indicators`

- `POST /api/discipline/cases`

- `POST /api/discipline/cases/:id/actions`

- `GET /api/dashboard/leader`

## Keamanan dan privasi

- Password memakai `bcryptjs` dengan cost factor minimal 12. Password baru minimal 6 karakter, maksimal 72 byte sesuai batas bcrypt, serta wajib memiliki huruf besar, huruf kecil, angka, dan simbol. Password polos tidak boleh ditulis ke repository atau log.

- Form reset password wajib memiliki field konfirmasi password. Frontend dan schema backend harus memvalidasi kesamaan password sebelum hashing; confirmPassword hanya data validasi request dan tidak pernah disimpan atau ditulis ke log.

- Session server-side memakai cookie HttpOnly, Secure, SameSite yang tepat.

- Rate limit login, reset password, upload, export, dan attendance endpoint.

- NIK, BPJS, rekening, koordinat, dokumen, dan kasus disiplin dimasking di list/log.

- Nomor WhatsApp/kontak seluler Indonesia wajib memakai komponen `IndonesiaPhoneInput` dan aturan terpusat `lib/validation/indonesianPhone.js`. UI menampilkan prefix tetap `+62`, pengguna mengisi mulai digit `8` tanpa awalan `0`, dan database menyimpan format E.164 `+628...`; dilarang membuat regex/normalisasi nomor sendiri di fitur lain.

- Seluruh input NIK wajib memakai reusable `IndonesianNationalIdInput` dan aturan terpusat `lib/validation/indonesianNationalId.js`. Input hanya menerima maksimal 16 digit, menampilkan counter selama belum lengkap, berubah menjadi ikon centang saat tepat 16 digit, dan wajib divalidasi kembali oleh schema backend; dilarang membuat regex atau input NIK terpisah pada fitur lain.

- Jangan masukkan rahasia atau data pribadi ke analytics, fixture publik, screenshot, seed, atau error tracker.

- Audit login, perubahan role, pegawai, rolling, koreksi absensi, izin, dokumen sensitif, dan sanksi.

- Validasi MIME dari byte; jangan percaya ekstensi.

- Gunakan antivirus/malware scan bila tersedia.

- Backup terenkripsi dan uji restore berkala.

- Terapkan retention dan prosedur penghapusan yang disetujui.

- Frontend tidak boleh menerima data sensitif yang tidak berhak hanya untuk disembunyikan dengan CSS.

## Kontrol bersama untuk integrasi native

Kontrol berikut berlaku pada batas klien/API. Aturan khusus OS/perangkat dikelola di dokumentasi Flutter.

### Validasi input dan aturan bisnis

- Validasi Flutter membantu pengguna, tetapi backend wajib memvalidasi ulang seluruh input dari body/query/path/header/file. Tentukan schema tipe, panjang, rentang, format, nilai yang diizinkan, jumlah item dan batas payload; tangani JSON rusak, null, field hilang, field tambahan, serta angka nonfinite bila relevan.
- Gunakan allowlist field yang boleh diubah untuk mencegah mass assignment. Klien tidak boleh menentukan actor, role, pemilik file, organisasi, saldo, status persetujuan atau hasil validasi yang menjadi kewenangan server.
- Validasi hubungan data, status saat ini, transisi status, tanggal, scope lokasi, saldo dan aturan bisnis berdasarkan data server terbaru dalam transaksi bila diperlukan. Jangan hanya memeriksa format atau mempercayai state UI lama.
- Gunakan query berparameter. SQL dinamis seperti kolom pengurutan harus berasal dari allowlist. Jangan menggabungkan input ke SQL, shell command atau path filesystem. Teks tak tepercaya tidak dirender sebagai HTML aktif; bila fitur membutuhkan HTML/WebView, batasi konten dan navigasinya serta gunakan sanitasi/encoding sesuai konteks.
- URL dari pengguna tidak boleh langsung diambil backend. Bila fitur mengambil resource eksternal, validasi skema/host/redirect dan cegah akses jaringan privat/metadata server untuk mengurangi risiko SSRF.

### Otorisasi, sesi dan penyalahgunaan API

- Periksa izin per endpoint, aksi, objek dan field di server, termasuk akses foto/download/export. Mengetahui ID/URL atau menyembunyikan tombol bukan hak akses; tolak akses yang tidak terbukti berizin.
- Uji manipulasi ID Pegawai/organisasi/file, peningkatan role, akses langsung endpoint admin dan data respons berlebih. Respons hanya mengandung field yang boleh diterima pemanggil.
- Terapkan batas percobaan login dan rate limit operasi sensitif berdasarkan risiko, dengan cakupan akun/sumber yang sesuai; endpoint login web dan mobile tidak boleh menjadi jalan bergantian untuk melewati kebijakan percobaan bersama. Hindari kebijakan penguncian yang mudah dipakai untuk memblokir akun orang lain.
- Sesi harus memverifikasi integritas, expiry dan status/versi kredensial/izin yang berlaku. Rancang serta uji pencabutan/logout, perubahan password, akun dinonaktifkan dan perubahan akses. Jika memakai refresh token, tentukan expiry, rotasi, deteksi reuse dan pencabutan; jangan sekadar memperpanjang token tanpa batas.
- Jangan memasukkan token ke URL/log atau menganggap API key/client secret yang ditanam di APK sebagai bukti identitas aplikasi. Biometrik lokal, deteksi root/jailbreak, obfuscation dan attestation hanya pertahanan tambahan bila dibutuhkan; tidak menggantikan otorisasi server atau menjamin aplikasi tak dapat dimodifikasi.

### Upload, jaringan dan pembatasan resource

- Selain ukuran dan MIME dari byte, batasi jumlah file, dimensi/piksel gambar, waktu proses, pagination dan batch sesuai risiko. Jangan mempercayai Content-Type, ekstensi, nama/path file atau ukuran yang dilaporkan klien. Hindari memuat payload tak terbatas ke memori.
- File memakai nama/key buatan server, storage privat, akses berizin dan pemindaian sesuai kebijakan web. Cegah path traversal, file executable/konten berbahaya serta pengambilan file milik pihak lain. Bersihkan file sementara/yatim dengan aman dan jangan menghapus file aktif akibat request gagal.
- Produksi wajib HTTPS dengan validasi sertifikat/hostname normal. Dilarang bypass TLS, menerima semua sertifikat atau mengirim credential melalui HTTP. Pengecualian development harus terisolasi dan tidak masuk build rilis.
- Tetapkan timeout, batas retry/backoff dan batas concurrency/kuota yang relevan di klien maupun server. Tangani rate limit tanpa retry terus-menerus. Jangan menganggap rate limit aplikasi sebagai perlindungan penuh terhadap seluruh serangan DoS.

### Request bersamaan, replay dan manipulasi alur

- Mutation yang dapat diulang harus memiliki idempotency server yang terikat aktor/organisasi/operasi dan payload, dengan kebijakan konflik serta masa simpan yang jelas. Key sama dengan payload berbeda tidak boleh diterima diam-diam. Cegah duplikasi dengan transaksi/constraint/locking atau version check yang tepat, bukan tombol disabled saja.
- Uji request paralel, retry setelah timeout ketika server mungkin sudah menyimpan, replay payload lama, urutan langkah dilewati dan perubahan data di tengah proses. Contoh relevan: dua absen identik, dua permintaan cuti yang saldonya bertabrakan dan pembatalan setelah status berubah.
- Kejadian absensi memeriksa waktu, jadwal, titik, akurasi dan kepemilikan file di server. Foto kamera, EXIF, flag mock location atau jam perangkat tidak menjadi bukti tunggal keaslian.

## Role, fitur dan hak akses

Sumber aturan aktif untuk bidang ini. Gunakan [indeks](../README.md) untuk memilih section dan kontrak terkait. Path teknis tanpa tautan relatif terhadap root repositori.

### Role dan permission

#### Superadmin

- Mengelola organisasi, lokasi awal, akun admin/HRD, masa aktif, dan konfigurasi platform.
- Tidak otomatis menjadi HRD organisasi; gunakan aksi lintas organisasi yang eksplisit.

#### HRD

- CRUD data pegawai dan master organisasi sesuai submenu Lihat Saja/Kelola setelah konfigurasi hak HRIS diaktifkan; organisasi lama tetap mengikuti [rollout HRIS](#hak-akses-submenu-hris).
- Data Master HRD memakai halaman/API yang sama dengan Superadmin, tetapi `organization_id` selalu dikunci dari session. HRD dapat mengelola lokasi, jenis unit organisasi, Divisi & Unit, jabatan, serta jenis kepegawaian organisasinya; identitas organisasi, masa akses, dan Admin/HRD pertama tetap khusus Superadmin.
- Mengelola kontrak, penempatan, shift, absensi, izin, dokumen, kasus, dan sanksi.
- Menjadi satu-satunya approver cuti/izin.
- Mengunggah dokumen sanksi dan mengubah status tindakan.
- Setelah konfigurasi HRIS aktif, admin HRD penuh mengelola akun HRD, Pimpinan, dan Pegawai serta delegasi HRIS. HRD terdelegasi hanya mengelola akun Pegawai sesuai dua kewenangan pada [delegasi akun Pegawai](#penyatuan-fitur-dan-delegasi-akun-pegawai). Tautan profil pegawai opsional untuk HRD/Pimpinan dan wajib untuk Pegawai; dilarang memberi role Superadmin atau menonaktifkan diri. Superadmin boleh mencabut admin penuh tanpa pengganti dan mengubah role/status HRD aktif terakhir. Pengakhiran hubungan kerja melalui workflow terpisah tetap meminta pencabutan admin penuh terlebih dahulu.
- Cakupan HRD selalu eksplisit melalui `location_scope_mode=all|selected`; ketiadaan baris scope tidak boleh ditafsirkan sebagai akses penuh ketika mode `selected`.

#### Pimpinan

- Read-only untuk seluruh profil, penempatan, kontrak, dokumen sensitif, dan histori sanksi pada organisasinya tanpa batas lokasi. Preview/download sensitif wajib diaudit.
- Tidak dapat mengubah profil HRD, memutus izin, atau menerbitkan sanksi melalui sistem.
- Dokumen dan data sangat sensitif memerlukan permission khusus.

#### Pegawai

- Tahap sekarang dapat dibuat tanpa akun aktif.
- Tahap mobile/web lanjutan: melihat data sendiri, absensi, mengajukan izin/cuti, dan mengunggah lampiran.
- Tidak pernah boleh memilih `employee_id` milik orang lain.
- Permission self-service wajib memakai kode dan endpoint `*_self` yang memetakan pegawai dari session. Dilarang memberikan permission HRIS generik organisasi kepada Pegawai sebelum endpoint self-service tersedia. Akses operasional Inventaris hanya diperoleh melalui paket organisasi dan scope gudang eksplisit, terpisah dari self-service.

Semua aksi diperiksa di backend. Menyembunyikan tombol di frontend bukan kontrol keamanan.

### Hak akses submenu HRIS

- Role dasar tetap satu. HRIS administratif hanya role HRD; Pegawai tidak mendapat permission HRIS organisasi. Inventaris/self-service tetap terpisah.
- Superadmin dapat menetapkan/mengalihkan paling banyak satu admin HRD penuh aktif per organisasi; organisasi boleh sementara tidak memilikinya. Admin ini selalu seluruh lokasi dan satu-satunya pemberi HRIS selain Superadmin. HRD lain dapat mengelola akun Pegawai dan fitur non-HRIS hanya jika diberi kewenangan eksplisit pada [delegasi akun Pegawai](#penyatuan-fitur-dan-delegasi-akun-pegawai). HRD terbatas mengikuti submenu Lihat Saja/Kelola; cakupan lokasi tetap per akun. HRD pertama tidak otomatis menjadi admin penuh.
- Katalog tertutup HRIS_MENUS menentukan hak yang tersedia. Fitur baru termasuk payroll tidak mendapat akses otomatis dari role/admin penuh. Laporan/Dashboard hanya baca; Data Pegawai termasuk identitas/rekening/dokumen dan harus dijelaskan pada form. Cuti serta akun di detail tetap berizin terpisah.
- Guard wajib pada halaman/API/file, bukan tombol saja. Context path/method selalu ditimpa Proxy; grant dibaca dari database terbaru. File kategori memisahkan identitas, foto referensi, surat sanksi dan lampiran izin.
- Migration 053 mengubah hak efektif HRD lama yang belum diatur menjadi grant eksplisit seluruh menu HRIS serta kewenangan Akun & Akses yang setara; akun yang sudah diatur tidak boleh ditimpa. Setelah migration, tidak ada fallback akses legacy: setiap akun selain admin penuh hanya mengikuti grant dan flag database. Omission mempertahankan grant, array kosong mencabut. Akun HRD baru atau baru beralih ke role HRD tanpa pilihan mulai tanpa menu. Transaksi akun/grant/admin memakai version, lock organisasi dan audit.
- Admin penuh wajib dialihkan sebelum dinonaktifkan, diturunkan role/cakupan, atau diproses akhir hubungan kerja, kecuali pencabutan status admin penuh atau perubahan role yang secara eksplisit diizinkan pada butir berikut. Pengakhiran hubungan kerja tetap memerlukan pengalihan/pencabutan terlebih dahulu. Jangan mengubah perhitungan/alur inti HRIS lain tanpa keputusan baru.
- Superadmin boleh mematikan switch Admin HRD penuh atau mengubah role admin penuh menjadi Pegawai/Pimpinan tanpa pengganti. Dalam transaksi yang sama, kosongkan seluruh hak menu dan kewenangan akun HRIS milik akun lama; Inventaris dan histori tetap. `primary_membership_id=NULL` berarti belum ada admin penuh, bukan HRIS nonaktif. Penetapan admin baru ketika admin lama tetap HRD mempertahankan hak HRIS tersimpan admin lama. Perubahan admin wajib memakai versi kebijakan dan audit.
- Pembagian submenu menggunakan satu bagian Akses fitur bersama Inventaris. Tabel menampilkan satu chip fitur dan +N fitur lainnya; rincian melalui Aksi → Lihat hak akses. Dilarang menumpuk submenu, grant gudang, atau tautan rincian pada kolom Akses fitur.
- Rancangan, rollout dan kontrak API: docs/rules/api-security.md. Uji regresi akses, scope, session aktif, file privat, transfer dan guard pada database terpisah.

### Penyatuan fitur dan delegasi akun Pegawai

- Satu blok per fitur HRIS/Inventaris di OrganizationAccountForm. Pilihan HRIS hanya untuk actor Superadmin/admin HRD penuh dan target HRD. Role Pegawai tidak menerima administrasi HRIS. Identitas role/admin tetap terpisah dari izin operasional.
- Dua kewenangan eksplisit: Kelola akun Pegawai (CRUD/status/profil/reset password tanpa perubahan fitur) dan Kelola akun Pegawai & akses fitur (ditambah delegasi non-HRIS). Delegator tidak wajib menggunakan Inventaris; tetap mengikuti modul aktif, organisasi dan cakupan lokasi/gudang. Tidak dapat mengelola HRD/Pimpinan/diri, memberi HRIS, atau menaikkan kewenangannya sendiri.
- Daftar dan pencarian Akun Organisasi hanya menampilkan akun selain akun yang sedang login; filter ini diterapkan di query data dan total, bukan hanya UI. Detail, edit, serta reset password akun sendiri melalui endpoint Akun Organisasi ditolak di service. Akun sendiri dikelola melalui Profil; Superadmin lain tetap dapat mengelola akun tersebut sesuai kewenangannya.
- Omission mempertahankan kewenangan/grant, none/array kosong mencabut eksplisit. Backend menerima grant identik pada koreksi akun tanpa hak delegasi; perubahan grant tetap ditolak. Pencabutan berlaku pada request berikutnya dan audit/version/rollback tetap wajib.
- Setiap fitur, izin, submenu dan cakupan wajib mempunyai uraian terpusat tentang kemampuan/batas. Tampilkan 1–2 kalimat sederhana dekat field aktif, minimal 8px dari control, justify dan line-height konsisten. Jangan hanya memakai tooltip/dropdown; jangan menjanjikan kemampuan yang belum ada. Jelaskan prasyarat kosong vs gagal dimuat sesuai izin.
- Ringkasan menghitung fitur sekali, bukan jumlah izin/gudang: satu chip +N fitur lainnya tanpa interaksi. Aksi Lihat hak akses membuka AppModal di level halaman agar pergantian tabel/kartu tidak menutupnya. Ikon semantik, chip selebar isi, gap 12–16px antarbaris dan 24px antarsection, status berlabel serta loading/error/kosong wajib tersedia.
- Migration 052 default flag nonaktif dan tidak mengubah rollout organisasi lama. Rekonsiliasi snapshot/menu/API membaca akses server terkini. Proses inti HRIS dan admin tunggal tidak berubah.

#### Presentasi menu dan informasi hak akses

- Hak Akun Organisasi tampil dalam kelompok Akun & Akses di editor HRIS, dengan checkbox aktivasi. Saat aktif pilih Kelola akun Pegawai atau Kelola akun Pegawai & akses fitur; saat dinonaktifkan simpan none. Pengaktifan kembali default Kelola akun Pegawai, bukan delegasi fitur. Kontrak dan authority backend tetap.
- Menu tanpa CRUD seperti Laporan tidak memakai dropdown tingkat akses. Tampilkan label Hanya baca; checkbox memberikan/mencabut grant read. Dashboard adalah halaman dasar tanpa kontrol grant. Gunakan divider antarbaris dan uraian batas izin singkat.
- Login tetap /dashboard. Konten data mengikuti izin domain/submenu, bukan grant dashboard lama. HRD tanpa hak data melihat kartu terkunci dengan placeholder sintetis tanpa data; API mengirim DTO kosong tanpa dataset terlarang. Pegawai melihat ringkasan profil milik akun sendiri melalui endpoint self-service. Navigasi menu berizin tetap tersedia.

#### Identitas modal transaksi

- Setelah jenis transaksi dipilih dan diterapkan pada form, judul/icon AppModal mengikuti katalog jenis transaksi. Status melanjutkan draft berada pada deskripsi, bukan menggantikan identitas jenis transaksi. Loading draft memakai judul jelas sampai data tersedia.
- Aksi rincian penyaluran memakai RelatedRecordAction; desktop di samping pilihan sumber, mobile tepat setelah pilihan sumber, dengan konteks singkat dan tombol semantik 44px. Preview tidak mengubah isian, draft, stok, atau dirty-state.

### Aktivasi Fitur Absensi organisasi

- Fitur Absensi memakai organization_modules code attendance dan diaktifkan hanya oleh Superadmin melalui Organisasi → Fitur organisasi. Tidak ada auto-aktivasi atau grant otomatis, termasuk organisasi existing. Cakupan saat ini Jadwal Kerja, Kalender Libur, Jadwal Pegawai dan pengaturan titik absensi. Cuti/izin terpisah. Fitur Deteksi wajah merupakan sakelar turunan Absensi di Fitur organisasi. Hanya Admin SITOU yang dapat mengubahnya. Pengaturan per organisasi ini nonaktif secara bawaan dan hanya berlaku selama Absensi aktif.
- Aktivasi dan izin akun berbeda. Menu Absensi memakai grant HRIS baca/kelola serta scope existing. Admin HRD penuh tidak melewati aktivasi. Penonaktifan menutup menu/API tanpa menghapus jadwal, kalender, penetapan, histori atau grant. Pengaktifan kembali mengikuti grant yang masih berlaku.
- Seluruh service jadwal, penetapan onboarding dan endpoint absensi mendatang wajib memakai gerbang server requireAttendanceModule selain permission/objek/organisasi sesi. Mutation mengunci organisasi sebelum pemeriksaan modul dan sebelum lock target lain. Jangan mempercayai snapshot/flag mobile sebagai authorization. Login dan kontrak mobile existing tidak ikut dinonaktifkan.
- API modul bentuk lama tetap khusus Inventaris. Batch baru hanya kode allowlist, strict, atomik, audit dan version check. UI wajib membedakan loading/gagal/status nonaktif dan mempertahankan isian saat gagal. Kontrak serta migration katalog 068: docs/work-schedules.md dan database/migrations/README.md.

### Presentasi Data Master dan daftar Organisasi

Ikuti [aturan tampilan Organisasi](../ui-ux-guidelines.md#daftar-organisasi-dan-kelompok-navigasi) untuk kelompok menu, kolom, kartu mobile, dan ikon aksi. Akses platform tetap diperiksa menurut aturan role di atas.

### Sebutan Admin SITOU dan pilihan izin fitur

- Seluruh teks yang dibaca pengguna, label role, pesan API, notifikasi dan bantuan memakai **Admin SITOU**, bukan Superadmin. Kode role `superadmin`, konstanta, permission, error code dan pemeriksaan otorisasi tetap dipertahankan.
- Pilihan izin Absensi pada form akun HRD tetap terlihat ketika fitur nonaktif, tetapi checkbox dan tingkat aksesnya dinonaktifkan. Tampilkan pesan merah yang menyebut Fitur Absensi belum aktif dan meminta pengguna menghubungi Admin SITOU. Pilih semua hanya mengubah menu yang dapat dipilih dan tidak boleh menghapus atau menambah izin menu terkunci. Izin lama tetap tersimpan. Aktivasi tidak otomatis memberi izin baru. Menu Absensi baru, termasuk mobile mendatang, wajib terdaftar pada katalog gerbang fitur bersama serta diperiksa di server.

## File privat dan pemindaian

### File privat

- Pemeliharaan penyimpanan melindungi file berdasarkan referensi nyata, termasuk histori, versi dokumen, logo organisasi, dan draft aktif. Kategori dokumen resmi atau kepemilikan `employee_id` saja bukan alasan mempertahankan file tanpa referensi. Superadmin boleh membersihkan file tersebut secara permanen setelah konfirmasi dan pemeriksaan ulang; histori bisnis dan audit tidak dihapus.

- Halaman Pemeliharaan Penyimpanan memuat data saat dibuka, organisasi berganti, tab kembali aktif, atau pengguna meminta Muat ulang. Polling berurutan 10 detik hanya saat ada proses `queued`/`running` dan tab terlihat; hentikan saat idle/tersembunyi, coba ulang kegagalan jaringan proses aktif tanpa menumpuk request.

- File tanpa catatan berumur kurang dari 24 jam tidak menjadi kandidat. Pembersihan manual kandidat tanpa referensi tidak memerlukan hasil antivirus bersih atau masa tunggu tujuh hari; preview/unduh tetap wajib bersih. File terinfeksi tetap mengikuti karantina keamanan.

- Semua temuan, kartu, riwayat, dan modal pemeliharaan wajib menampilkan organisasi asal dari data server. Organisasi yang belum terverifikasi memblokir penghapusan. Gunakan keterangan singkat seperti “Tidak digunakan”, “File tanpa catatan”, atau “File tidak ditemukan”, serta tombol tindakan yang sesuai masalah.

- Development boleh memakai direktori privat di luar public web root.

- Produksi direkomendasikan object storage privat.

- Backup sistem manual oleh Superadmin wajib mencakup PostgreSQL dan seluruh file yang tersedia di `UPLOAD_ROOT` lintas organisasi dalam satu paket terenkripsi. Kata sandi tidak disimpan; paket siap tetap berada di server sampai Superadmin menghapusnya secara eksplisit, unduhan dan penghapusan diaudit, dan restore produksi tidak tersedia dari dashboard. Penghapusan hanya menghapus artefak backup, bukan database aktif, `UPLOAD_ROOT`, histori, temuan, atau audit. File yang dirujuk tetapi hilang atau berbeda dicatat sebagai temuan dengan identitas organisasi serta pemilik yang terverifikasi dan menghasilkan status `ready_with_warnings`; kegagalan snapshot, path tidak aman, atau penyimpanan tidak dapat dibaca tetap menggagalkan backup. Uji pemulihan dilakukan di lingkungan terpisah. Lihat `scripts/README.md`.

- Setiap backup baru mengelompokkan tiga artefak terenkripsi dalam satu folder bertanggal dari `created_at`, snapshot IANA `time_zone` (default backup baru WITA/Asia/Makassar), dan UUID lengkap. Waktu riwayat/detail dikonversi ke zona browser pengguna; nama artefak tetap memakai snapshot dan detail menampilkan kedua waktu serta nama ZIP. Jam browser tidak menjadi sumber pencatatan audit. ZIP upload satu lapis langsung berisi `uploads/`, semua entri AES-256; daftar path dapat terlihat sebelum kata sandi. Dump Custom bertanggal direferensikan manifest format 3. Kata sandi pendek tetap diperbolehkan dengan indikator lokal Lemah/Sedang/Kuat yang tidak memblokir penyimpanan. Seluruh akses/cleanup memakai helper path terpusat, menolak symlink, dan hanya menghapus artefak dikenal serta folder kosong.

- ZIP database dan ZIP seluruh upload hanya boleh dibuat dari snapshot paket utama yang sama, wajib terenkripsi AES-256, diaudit saat diunduh, dan dihapus manual bersama paket utama. Restore penuh harus memakai `.sitou-backup` melalui alat server Windows/Ubuntu setelah aplikasi serta worker dihentikan; jangan menjadikan dua ZIP terpisah sebagai input restore otomatis atau menimpa produksi melalui dashboard.

- Database menyimpan `object_key`, nama asli, MIME, ukuran, hash, kategori, dan pemilik organisasi.

- API file melakukan authorization setiap preview/download dan mengaudit dokumen sensitif.

- Jangan membangun URL `/uploads/...` yang bisa ditebak.

- Nama objek gunakan UUID; jangan gunakan nama asli atau NIK.

- Upload logo juga masuk `stored_files`, lalu direferensikan oleh `organization_branding` atau lokasi.

- Dokumen histori resmi seperti kontrak, SK penempatan, dan surat sanksi memakai soft delete/retention dan tidak boleh dihapus fisik melalui form profil. Lampiran profil yang dapat diganti seperti pas foto, identitas, pendidikan, dan sertifikasi wajib menghapus byte fisik setelah penghapusan referensi database berhasil.

- Development memakai `UPLOAD_ROOT` atau default `<project>/uploads`; production wajib memakai mounted persistent storage yang dibackup, bukan filesystem ephemeral.

- Struktur pegawai wajib `org_{organizationId}/pegawai/employee_{employeeId}/{kategori}/{tahun}/{uuid}.{ext}`. Kategori meliputi `pas_foto`, `identitas/ktp`, `identitas/kk`, `identitas/npwp`, `kontrak`, `pendidikan`, `sertifikasi`, `sanksi/sp1|sp2|sp3|lainnya`, dan `dokumen_lain`.

- Nama fisik wajib memuat UUID. Nama pegawai, NIK, nomor rekening, nomor surat, dan data pribadi lain dilarang berada dalam object key, path, atau log. Pengecualian khusus selfie absensi baru mengizinkan awalan nama depan yang disanitasi pada nama fisik di storage privat. Nama lengkap, NIP dan NIK tetap dilarang. Path atau nama fisik selfie tidak boleh dikirim ke klien atau ditulis di log.

- Selfie absensi baru memakai org_<id>/absensi/<tahun>/<lokasi>-<id>/<unit>-<id>/<bulan>/<hari>/<nama-depan>-<masuk|pulang>-<HHmmss>-<uuid>.<ext>. Gunakan penempatan utama efektif pada tanggal kerja dan jam kejadian dalam zona organisasi. Semua segmen berasal dari data server dan nama label dinormalisasi serta dibatasi. UUID dan publikasi atomik tanpa timpa melindungi file yang sudah ada.

- Browser hanya menerima ID metadata dan mengakses `/api/uploads/:fileId`; endpoint catch-all berdasarkan path dilarang.

- Response file memakai `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, CSP ketat, nama download tersanitasi, authorization organisasi/scope, dan audit untuk preview/download sensitif.

- Gambar menerima JPEG/PNG/WebP maksimal 5 MB. Dokumen menerima PDF maksimal 10 MB; DOCX hanya untuk kategori yang membutuhkannya dan tidak dipreview inline. MIME harus dideteksi dari byte.

- Dropzone gambar wajib menampilkan pratinjau dan metadata file setelah upload berhasil. File lama berbasis `fileId` harus memiliki lifecycle lihat, ganti, dan hapus yang sama dengan file baru; aksi hapus wajib membersihkan state UI serta melepas referensi profil terkait secara transaksional agar ID file usang tidak muncul kembali.

- Pada form komposit yang memiliki tombol simpan utama seperti `Profil lengkap pegawai`, pemilihan file hanya boleh membuat pratinjau lokal. Byte file, metadata `stored_files`, dan referensi domain baru disimpan ketika tombol simpan utama berhasil; kegagalan validasi atau transaksi wajib membersihkan file sementara dan tidak boleh meninggalkan metadata/file baru setengah jadi.

- Pas foto, KTP, Kartu Keluarga, NPWP, BPJS, ijazah, dan sertifikat adalah bukti visual: upload baru hanya menerima JPEG/PNG/WebP. Kontrak, SK penempatan, dan surat sanksi adalah dokumen resmi: upload baru hanya menerima PDF. File lama dengan tipe sebelumnya tetap dapat dibuka secara berizin, tetapi tidak boleh menggantikan validasi tipe baru.

- Tulis upload ke file sementara, hash SHA-256, lalu atomic move. Bersihkan byte bila transaksi metadata gagal. Penghapusan lampiran profil memakai karantina atomik: pulihkan file bila transaksi database gagal dan hapus byte karantina setelah commit berhasil. Bukti histori resmi tetap memakai soft delete dan retention.

#### Pemindaian file development dan production

- Kepegawaian dan Inventaris wajib memakai pipeline storage/pemindaian yang sama. npm run dev dapat tanpa ClamAV dengan CLAMAV_REQUIRED=0 dan CLAMAV_ENABLED=0; validasi MIME byte/ukuran/dimensi/hash, organisasi/scope, staging dan rollback tetap berlaku. Status file legacy_unscanned, bukan clean palsu.

- NODE_ENV=production selalu wajib scan, termasuk npm start lokal, walaupun flag bernilai 0. Scanner tidak tersedia, timeout, atau ancaman menggagalkan upload. File belum clean diblokir pada preview/unduh production; jalankan pemindaian sebelum memakai file development di VPS.

- Upload Inventaris memakai PrivateFileUpload/FileUploadField dan ImagePreviewModal yang sudah ada. Foto barang disimpan bersama Simpan barang; lampiran transaksi mengikuti draft privat. Callback penghapusan async wajib ditunggu dan dilindungi loading/error; jangan membuat upload/dropzone paralel atau mencabut referensi UI sebelum hasil pemilik diketahui.

- Metadata tampilan upload dibaca melalui helper bersama `readUploadMetadata`: mendukung `mime_type`/`mimeType`, `size_bytes`/`sizeBytes`, serta file lokal. DTO upload dan pembukaan kembali draft wajib menyertakan MIME nyata dan ukuran agar preview konsisten; nama/ekstensi bukan dasar penentuan MIME. Uji gambar langsung setelah upload, draft dibuka kembali, PDF, dan penghapusan.

## Hak akses menu HRIS

### Model

Satu membership tetap memiliki satu role dasar. Administrasi HRIS hanya diberikan
kepada role HRD; Pegawai tetap memakai self-service dan akses Inventaris terpisah.
Superadmin dapat menetapkan paling banyak satu admin HRD penuh aktif per organisasi
melalui modal Tambah/Edit akun organisasi. Penetapan selalu eksplisit, termasuk
untuk akun HRD pertama. Organisasi boleh sementara tanpa admin penuh.

Admin penuh membaca/mengelola seluruh menu HRIS yang terdaftar, seluruh lokasi,
serta akun HRD, Pimpinan, dan Pegawai. Hanya Superadmin boleh menetapkan atau mencabut admin.
Admin penuh membagikan submenu dan tingkat Lihat Saja/Kelola kepada HRD lain pada
modal akun yang sama. Cakupan lokasi tetap satu per akun HRD, mengikuti aturan
lama. Inventaris dan fitur mendatang tidak otomatis diperoleh dari admin penuh.

### Menu dan sensitivitas

Katalog `HRIS_MENUS` berasal dari menuCatalog.mjs dan mempertahankan kode Dashboard
lama untuk kompatibilitas, tanpa menjadikannya grant data. Tiga belas submenu
HRIS yang dapat diberikan: Lokasi, Jenis Unit
Organisasi, Divisi & Unit, Jabatan, Jenis Kepegawaian; Data Pegawai, Cuti & Izin;
Kontrak Akan Berakhir, Proyeksi Pensiun, Sanksi Pegawai, Rekap Cuti & Izin; Aturan Cuti & Izin,
Pengaturan Sanksi, Kebijakan Pensiun. Dashboard adalah halaman dasar; laporan hanya Lihat Saja;
submenu lain dapat Lihat Saja atau Kelola. Akun Organisasi dapat didelegasikan
terbatas ke akun Pegawai sesuai migration 052 di bawah.

Data Pegawai mencakup profil, identitas/KTP/KK, rekening, kontrak, penempatan,
pendidikan, dokumen dan disiplin sesuai proses yang sudah ada. Form menjelaskan
dampak ini. Cuti & Izin dan Akun pada detail Pegawai tetap mengikuti kewenangan
terpisah. Lampiran izin tidak memberikan hak membuka identitas privat. Foto
referensi dan surat sanksi hanya dibaca pada konteks berizin. Payroll belum ada
dan kelak harus mempunyai permission/katalog tersendiri.

Lihat Saja tidak menampilkan aksi perubahan dan backend menolak mutation/import
atau ekspor profil penuh. Ekspor laporan tetap bagian izin baca laporan tersebut.
Dashboard selalu menjadi halaman login; tanpa hak statistik hanya header tampil.

### Penyimpanan, API, dan rollout

Migration `051` menambah:

- `organization_hris_access_policies`: admin penuh opsional, status konfigurasi, versi.
- `hris_menu_definitions`: katalog sistem bersama, tanpa organization_id.
- `user_hris_menu_grants`: level per submenu dan membership organisasi.
- `user_hris_access_settings`: penanda peninjauan eksplisit, termasuk grant kosong.

Grant dan penanda memakai composite FK membership organisasi. Kolom bisnis lama
tidak diubah. Schema bootstrap mencerminkan migration; database berjalan memakai
migration, bukan menjalankan ulang schema.

Endpoint akun menerima `isHrisAdmin`, `hrisPolicyVersion`, dan
`hrisMenuAccess: [{key,level}]`. Omission grant mempertahankan nilai lama saat
update; array kosong mencabut eksplisit. Penetapan admin memakai versi kebijakan,
sedangkan edit akun tetap memakai version akun. DTO akun menambah `hrisAccess`;
reference-options menambah kemampuan penetapan/status/versi; `/api/access/me`
memuat snapshot `hris` terbaru. Response tetap private/no-store.

Migration 053 membekukan hak efektif HRD lama yang belum pernah diatur menjadi
semua 14 grant menu HRIS dan kedua kewenangan Akun & Akses. Grant/flag akun yang
sudah diatur tidak ditimpa. Setelah itu tidak ada fallback akses lama: akun biasa
hanya mengikuti pilihan yang tersimpan. Akun HRD baru atau baru beralih ke HRD
tanpa pilihan mulai tanpa menu. Superadmin dapat mengurangi hak akun lama lewat
dashboard, tanpa menunggu penetapan admin penuh. Admin penuh tetap mendapat semua
hak HRIS selama ditetapkan.

Backend membaca membership/policy/grant terbaru setiap request. Proxy menimpa
header konteks path/method; session/browser bukan sumber izin. Sidebar, halaman,
API dan file kategori menerapkan guard yang konsisten. Account mutation mengecek
ulang kewenangan di transaksi dengan lock organisasi, version dan audit
`hris.admin.assign` / `hris.admin.revoke` / `hris.menu.update`. Pengalihan langsung
ke admin baru tidak menghapus grant akun lama jika tetap HRD; akun itu kembali
mengikuti grant tersimpan dan cakupannya.

Superadmin boleh mencabut admin penuh dengan switch, atau mengubah role/statusnya,
tanpa menyiapkan pengganti. Pencabutan mengosongkan grant menu dan kewenangan Akun
Organisasi akun lama dalam transaksi yang sama; hak Inventaris dan histori tetap.
Kebijakan tetap enabled dengan primary_membership_id NULL, artinya belum ada admin
penuh. Superadmin boleh menetapkan akun yang sama atau HRD lain kemudian. Perubahan
role/status HRD aktif terakhir oleh Superadmin juga diizinkan, tetapi penonaktifan
diri sendiri tetap dilarang. Workflow pengakhiran hubungan kerja masih meminta
pencabutan admin penuh lebih dulu. Versi kebijakan diperiksa saat menetapkan atau
mencabut admin; perubahan diaudit dan berlaku pada request berikutnya.

### UI dan pengujian

Form memakai satu bagian Akses fitur dengan blok HRIS dan Inventaris. HRIS memakai
kelompok menu yang dapat dilipat, checkbox submenu dan tingkat akses. Ringkasan
tabel hanya satu chip fitur +N fitur lainnya; rincian melalui Aksi → Lihat hak akses,
tanpa menumpuk seluruh grant di tabel. Gunakan layout responsif, teks sederhana,
justify untuk bantuan, spacing dan komponen SITOU yang sudah ada.

Daftar dan pencarian Akun Organisasi tidak menampilkan akun yang sedang login,
termasuk pada total/paginasi. Endpoint Akun Organisasi juga menolak detail,
perubahan, dan reset password akun sendiri meskipun ID dikirim langsung. Pengguna
melihat informasi serta mengubah password sendiri di Profil; role dan hak akses
akunnya hanya dapat diubah oleh pengelola lain yang berwenang.

prosedur verifikasi fitur memeriksa resolver/schema. Runner
prosedur verifikasi fitur mencakup bootstrap/upgrade 051–052, regresi Inventaris,
delegasi HRD, read/manage, URL langsung, spoof header, isolasi organisasi,
rollback/version, pencabutan session aktif, transfer admin, guard lifecycle,
serta UI 320–1920px di database terpisah.

Deploy migration 051–052 sebelum web baru. Smoke test dengan akun uji: Superadmin
menetapkan admin, admin memberikan submenu kepada HRD lain, verifikasi login/menu,
aksi baca/perubahan, lalu cabut hak saat sesi masih aktif. Jangan memberi akses
nyata otomatis selama pengujian.

### Delegasi akun Pegawai — migration 052

Tambahan pada user_hris_access_settings: can_manage_employee_accounts dan
can_delegate_employee_features, default false, dengan CHECK delegasi memerlukan
pengelolaan akun. HRIS_ACCOUNT_ACCESS API opsional memakai hrisAccountAccess:
none/manage/manage_and_delegate. Omission mempertahankan; perubahan diaudit sebagai
hris.account_access.update. DTO hrisAccess memuat accountAccess dan flags; snapshot
serta reference-options memuat canManageAccounts, canDelegateNonHris, canGrantHris,
dan canManageAllAccountRoles. Target non-HRD tidak memperoleh kewenangan ini.

Superadmin/admin penuh memberi dua pilihan: Kelola akun Pegawai (CRUD, status,
profil, reset password tanpa perubahan fitur), atau Kelola akun Pegawai & akses
fitur (ditambah pemberian/pencabutan non-HRIS). HRD terdelegasi hanya target Pegawai
dalam cakupannya, tidak HRD/Pimpinan/diri. Izin delegasi tidak mensyaratkan pemakaian
Inventaris. Modul harus aktif; HRD selected tidak memberikan master/all atau gudang
luar lokasi. HRIS tetap khusus pemberi Superadmin/admin penuh dan target HRD.
Pengelola tanpa delegasi dapat mempertahankan grant identik pada koreksi akun;
perubahan grant termasuk pencabutan ditolak. Kewenangan diperiksa ulang dalam
transaksi dan pencabutan berlaku pada session aktif. Hak lama dikonversi oleh migration 053.

FeatureAccessFields hanya mengatur presentasi; featureModules tidak dikirim ke API.
Setiap pilihan memiliki uraian terpusat di accessDescriptions.mjs/featureLabels.mjs:
kemampuan, batas dan cakupan, 1–2 kalimat dekat field dengan jarak aman. Rincian
mengelompokkan HRIS per menu dan Inventaris per izin/scope, ikon semantik, chip
selebar isi, status aktif/nonaktif, identitas akun dan state loading/error/kosong.
AccountAccessDetails berada di level halaman agar tidak tertutup saat breakpoint
berubah. Halaman operasional Inventaris masih header; jangan menjanjikan posting
stok, approval, atau payroll yang belum tersedia.

Pada edit akun, omission mempertahankan grant/flag yang sudah tersimpan; array
menu kosong atau `hrisAccountAccess=none` mencabut secara eksplisit. Pembuatan
akun dengan kewenangan Akun Organisasi saja tidak menambah menu HRIS lain.

#### Pengelompokan Akun & Akses dan menu hanya baca

Akun Organisasi berada dalam kelompok Akun & Akses pada HRIS, dengan checkbox dan
dua mode aktif. Off menghasilkan hrisAccountAccess=none; on kembali default manage.
Tidak ada penambahan kode menu/grant atau migration: capability akun tetap terpisah
dari hrisMenuAccess. Dashboard/laporan tidak menampilkan dropdown satu pilihan;
chip Hanya baca menjelaskan tipe menu. Divider memisahkan submenu dan
AccessExplanation memperjelas informasi menu serta batas izin.
Login tetap /dashboard; data mengikuti izin domain/submenu. HRD tanpa hak data
melihat kartu terkunci dengan placeholder sintetis tanpa nilai atau identitas;
menu berizin tetap dapat dinavigasi dan API mengirim DTO kosong.

### Dashboard dasar dan editor akses responsif

Dashboard selalu tersedia sebagai halaman awal, tanpa pilihan grant pada editor.
Grant dashboard historis tetap diterima untuk kompatibilitas, tetapi tidak memberi
hak statistik atau dikonversi menjadi akses lain. MENU_DEFINITIONS/MENU_LEAVES
pada lib/access/menuCatalog.mjs menjadi katalog bersama sidebar, editor, evaluator
dan schema; menu baru wajib memiliki jenis izin, scope, delegasi dan penjelasan.
Validasi katalog otomatis menolak definisi yang belum lengkap.

Form submenu ditata vertikal: nama/checkbox, kontrol tingkat bila ada, lalu batas
izin singkat. Tidak ada section Informasi menu. Track minmax(0,1fr), min-width:0,
control maksimal 100% dan pilihan popup yang dapat wrap mencegah overflow tanpa
memotong halaman. HRIS/Inventaris memakai Collapse fitur dengan ringkasan, tombol
buka/tutup kanan; fitur baru dibuka, edit membuka HRIS atau fitur pertama. Cabut
akses berada di bawah setelah divider, merah solid. Lipatan adalah state UI saja;
nilai tetap tersimpan, tidak menandai dirty, dan error membuka section terkait.

Backend Dashboard membaca izin efektif dari sumber server. Data Pegawai membuka
komposisi/penempatan/perkembangan/kelengkapan/ulang tahun; kontrak terbuka bagi
Data Pegawai atau laporan kontrak, pensiun bagi Data Pegawai atau laporan pensiun,
disiplin bagi Data Pegawai atau laporan sanksi. Cuti hanya hak Cuti & Izin. HRD
dengan hak master/akun/Inventaris saja atau tanpa hak data tetap melihat susunan
kartu organisasi dalam kondisi terkunci; Pegawai tetap hanya melihat header.
Tidak menambahkan statistik Inventaris pada tahap ini.

DTO /api/dashboard/summary menambah sections; field employeeSummary,
birthdaySummary, retirementSummary dan recentDiscipline hanya dikirim bila berizin.
metrics/charts parsial; section tanpa izin tidak diwakili nol palsu. UI HRD
memakai katalog metadata publik untuk judul kartu terkunci, bukan data yang
disembunyikan dengan CSS. Snapshot
/api/access/me menambah dashboardDefault dan dashboardSections. Query yang tidak
diperlukan dilewati, aktivitas/prioritas difilter sebelum LIMIT, link tujuan tanpa
izin dihilangkan. Cache mencakup organisasi, role, scope, rentang, kebijakan dan
fingerprint izin/capability. Rumus/rentang/timezone/lifecycle HRIS tetap.

Uji permission kombinasi, session aktif/cache dua akun, Dashboard dasar,
Superadmin/Pimpinan/Pegawai, form panjang 320–1920px, zoom 200%, keyboard,
penyimpanan section terlipat dan query plan memakai database terpisah. Migration
053 hanya mengubah data grant akun lama, bukan struktur tabel.

Menu baru dengan kode grant baru tetap harus menambah seed hris_menu_definitions
melalui migration serta schema bootstrap. Katalog UI bersama tidak menggantikan
permission backend, registrasi API, audit, atau composite FK organisasi. Dataset
Dashboard ditambahkan bersama permission sumbernya, tidak terbuka otomatis.

## Tampilan dashboard saat izin berubah

Kartu HRD yang belum diizinkan menampilkan siluet sintetis sesuai jenis konten (metrik, grafik area, batang horizontal/bertumpuk, daftar, ulang tahun, komposisi, atau pensiun). Siluet tidak berasal dari data terlindungi. Ringkasan Kepegawaian tidak memakai interval sendiri: data dimuat saat halaman dibuka, saat Muat ulang dipilih, atau ketika bagian/cakupan akses berubah. Respons gagal membersihkan data lama dari tampilan.

### Perubahan hak saat halaman masih terbuka

ProtectedShell memeriksa snapshot izin server setiap 20 detik ketika tab organisasi terlihat, saat tab kembali fokus, dan setelah API mengembalikan `403`. Keputusan didasarkan pada izin baca/tulis efektif halaman, bukan menu yang kebetulan terlihat. Turun dari Kelola ke Lihat menutup form aktif dengan membangun ulang halaman, menampilkan `AccessChangedModal` selama lima detik, dan tetap di halaman baca-saja. Jika hanya sebagian izin tulis Inventaris dicabut, pesannya menyatakan bahwa hanya sebagian tindakan tidak tersedia. Pencabutan hak Lihat segera melepas isi halaman dari DOM, menampilkan modal yang sama dengan tujuan Dashboard, lalu mengalihkan setelah lima detik atau saat tombol ditekan. Perubahan hak tanpa pengalihan diberi pemberitahuan singkat; perubahan cakupan menyebut pemuatan ulang halaman. Peringatan isian yang mungkin belum tersimpan tidak tampil di Dashboard dan tidak menganggap form pasti terbuka. Saat modal pencabutan tampil, toast umum tidak ditumpuk di atasnya. Perubahan yang belum tersimpan tidak disimpan otomatis. Backend tetap memeriksa setiap operasi; permintaan yang sudah lolos pemeriksaan sebelum pencabutan merupakan batas race yang harus dijaga oleh transaksi pada use case kritis.

Snapshot `/api/access/me` memuat `writePermissions` Inventaris dan `scopeRevision` untuk mendeteksi perubahan cakupan; keduanya tidak memberikan izin baru. `readApiResponse` dan form Data Master yang membaca respons sendiri meminta pemeriksaan ulang izin ketika menerima `403`. Kegagalan jaringan tidak ditafsirkan sebagai pencabutan izin. Pengalihan karena sesi login berakhir tetap menuju Login dan menggunakan varian standar panel hitungan mundur yang sama.

Catatan pemeliharaan: tes akses terpilih berada di `tests/` dan dapat dijalankan dengan `node --test`. Lint, build, dan pemeriksaan dua sesi browser tetap diperlukan untuk perubahan alur akses.

Ringkasan ulang tahun juga tampil bagi Superadmin pada Semua organisasi: hanya
organisasi aktif, tanggal kalender dari timezone tiap organisasi, dan nama organisasi
pada daftar gabungan. Memilih satu organisasi menggunakan query organisasi yang
sama dengan HRD. Izin Data Pegawai dan cakupan lokasi HRD tetap berlaku.

Aktivitas terbaru organisasi dibatasi pelaku HRD dengan membership organisasi
yang berlaku saat kejadian. Login memerlukan snapshot audit role_code=hrd,
bukan role saat ini saja. Aktivitas Pegawai/Pimpinan/Superadmin tidak masuk
feed organisasi; filter izin dan scope tetap berlaku sebelum LIMIT lima data.
Audit login dan histori bisnis tidak diubah atau dihapus.

### Jadwal kerja — 066 dan 067

work-shifts (Data Master → Jadwal Kerja), work-calendars (Pengaturan Organisasi → Kalender Libur), work-schedules (Kepegawaian → Jadwal Pegawai) memakai baca/kelola tersendiri; kode grant dan URL lama dipertahankan. /api/work-schedule-templates dan /api/work-schedule-groups mengikuti work-shifts baca/kelola, termasuk transaksi penyimpanan gabungan. Kelompok pilihan shift bukan submenu atau grant baru. Tidak memberi hak otomatis saat migration 067. GET /api/work-schedules/calendar dan preview memerlukan baca work-schedules; generator/penetapan/exception/cancel memerlukan kelola. Hak Data Pegawai tidak memberikan penetapan jadwal. Admin penuh mengikuti katalog HRIS; delegasi perlu grant eksplisit. Scope lokasi membatasi setiap target Pegawai, termasuk kalender. Opsi memuat ringkasan hari/jam/libur minimum untuk pilihan penetapan, bukan akses pengelolaan master. Route dan layanan memeriksa hak terkini. Lihat work-schedules.md.

#### Foto pada Jadwal Pegawai

Grant baca/kelola work-schedules dapat membaca kategori employee_photo/profile_photo melalui canUseHrisFile untuk avatar Jadwal Pegawai. Endpoint upload tetap memeriksa sesi, permission private_files.read_sensitive existing, organisasi serta scope Pegawai dan ketersediaan file, lalu mengaudit preview/download dengan no-store. Grant ini tidak membuka identitas, pendidikan, kontrak atau mutation file. Metadata daftar hanya ID foto dan organisasi pada Pegawai yang lolos scope jadwal. Tidak menambah grant role atau membuka storage publik.

### Fitur Absensi organisasi — 068

Superadmin mengaktifkan Fitur Absensi melalui Organisasi → Fitur organisasi sebelum Jadwal Kerja, Kalender Libur dan Jadwal Pegawai dapat digunakan. Aktivasi attendance tidak memberi grant. Tiga menu tetap memakai hak HRIS baca/kelola existing beserta scope Pegawai/lokasi, termasuk penetapan saat pendaftaran. Admin HRD penuh mengikuti aktivasi yang sama. Cuti dan izin tidak termasuk gerbang ini.

readHrisState/readHrisStates mempertahankan assigned dan menyaring grants efektif ketika attendance nonaktif, serta memuat attendanceEnabled. hrisLevel menolak ketiga menu sebelum bypass Admin HRD penuh. requireScheduleAccess memeriksa status organisasi/modul pada database untuk seluruh service, termasuk pemanggil internal. Penonaktifan tidak menghapus histori atau grant. Foto yang hanya diizinkan melalui jadwal ikut kehilangan akses tersebut. Akun berizin foto melalui menu lain tetap mengikuti hak yang sah.

Editor akun memakai `assigned`, bukan grant efektif, agar menyimpan akun tidak menghapus hak Absensi lama. Saat modul belum aktif, checkbox dan tingkat akses Jadwal Kerja, Kalender Libur serta Jadwal Pegawai dinonaktifkan dengan pesan “Fitur Absensi belum aktif. Hubungi Admin SITOU.” Pilih semua hanya mengubah menu yang tersedia dan mempertahankan hak yang terkunci. Backend menolak grant Absensi baru atau perubahan tingkatnya saat modul nonaktif, termasuk payload lama setelah penonaktifan. Hak lama yang sama tetap boleh disimpan. Aktivasi fitur tetap melalui Superadmin dan tidak memberikan grant otomatis.

Perubahan modul masuk hash scopeRevision dan accessEntitlementsChanged. Snapshot lama bukan bukti izin, setiap request membaca hak terbaru. Mutation aktivasi dan jadwal memakai lock organisasi lebih dahulu untuk mencegah race penonaktifan. Form akses akun menjelaskan bila fitur belum aktif. Tidak ada paket Inventaris, scope gudang atau role baru untuk Absensi. Kontrak batch dan rollout: [Jadwal kerja](../work-schedules.md). Endpoint absensi mobile mendatang wajib memakai aktivasi dan permission self-service server yang sama.

#### Kelompok sidebar Organisasi

Organisasi ditampilkan di kelompok Kepegawaian pada Data Master melalui metadata sidebarGroup=hris. Ini hanya presentasi. access.kind=platform, assignable=false, role Superadmin dan guard API existing tetap berlaku. Organisasi tidak masuk katalog grant HRIS. Jadwal Kerja berada pada kelompok Kepegawaian yang sama tetapi tetap mengikuti aktivasi Absensi dan grant HRIS existing. sidebarGroups dijalankan setelah filter izin, menggabungkan label sama dengan urutan kemunculan kelompok pertama dan urutan item di dalamnya. Perubahan ini tidak memberi akses tambahan kepada HRD/Pegawai dan tidak mengubah Platform pada Pemeliharaan Sistem.
