# AGENTS.md - SITOU

Dokumen ini adalah aturan kerja utama untuk developer dan Codex pada proyek **SITOU - Sistem Informasi Teknologi dan Organisasi Unit**. Berlaku untuk seluruh folder proyek, kecuali ada `AGENTS.md` yang lebih spesifik di subfolder. Jika implementasi berbeda dari dokumen ini, perubahan harus dicatat melalui migration, test, dan pembaruan dokumentasi.

## 1. Tujuan produk saat ini

Bangun dashboard HRIS multi-organisasi yang stabil untuk:

- Superadmin membuat organisasi, lokasi awal, akun HRD, dan cakupan akses.
- HRD mengelola seluruh profil, kontrak, penempatan, rolling, izin, absensi, dokumen, dan tindakan disiplin.
- Pimpinan memantau data dan histori pegawai tanpa mengubah administrasi HRD.
- Pegawai disiapkan sebagai role self-service untuk aplikasi web/mobile lanjutan.
- Absensi tahap awal masuk melalui import Excel/CSV dan koreksi HRD; mobile attendance dikembangkan setelah dashboard stabil.

Jangan membangun payroll, pengenalan wajah, atau keputusan sanksi otomatis kecuali ada permintaan dan aturan baru yang disetujui.

## 2. Stack dan struktur yang diharapkan

- Web/API: Next.js versi stabil dengan App Router dan TypeScript strict.
- Database: PostgreSQL 18.
- Validasi: schema bersama untuk request API, form, import, dan environment.
- File: penyimpanan privat melalui service abstraction; database hanya menyimpan metadata `stored_files`.
- Background job: antrean untuk import, rekap, indikator, export, notifikasi, dan outbox.
- Mobile: memakai API versi yang sama; tidak mengakses PostgreSQL secara langsung.

Pisahkan lapisan berikut:

1. `domain`: aturan bisnis murni dan tipe.
2. `application`: use case/transaksi.
3. `infrastructure`: database, storage, queue, email, dan integrasi.
4. `interfaces`: route handler, server action, worker, dan UI.

Route handler tidak boleh berisi query dan aturan bisnis panjang. Gunakan service/use case.

## 3. Sumber kebenaran data

- Skema referensi: `sitou_schema_v3.sql`.
- Panduan baca cepat database: `docs/database-schema.md`. Buka dokumen ini lebih dulu untuk memahami tabel, kolom penting, relasi, dan aturan data; buka `sitou_schema_v3.sql` hanya ketika perlu detail constraint, index, view SQL, atau membuat migration.
- Perubahan database hanya melalui migration baru; jangan mengedit database produksi manual.
- Setiap migration baru yang mengubah schema wajib pada perubahan yang sama direfleksikan ke `sitou_schema_v3.sql`. File tersebut harus selalu merepresentasikan schema akhir setelah seluruh migration diterapkan dan menjadi sumber bootstrap untuk membuat database SITOU baru dari kondisi kosong.
- Pembaruan `sitou_schema_v3.sql` tidak menggantikan migration dan tidak boleh dipakai untuk memperbarui database yang sudah berjalan. Database development, staging, dan production yang sudah ada tetap disinkronkan dengan menjalankan migration yang belum tercatat.
- Istilah domain resmi adalah **organisasi**. UI, pesan API, dokumentasi, komentar, test, dan penamaan abstraksi domain dilarang menyebut organisasi sebagai "tenant" atau "perusahaan". Nilai teknis schema yang sudah menjadi kontrak, seperti `organization_id` dan enum `company`, tetap dipertahankan, tetapi label yang dibaca pengguna wajib memakai "organisasi".
- Istilah pengguna resmi adalah **Pegawai** dan **NIP (Nomor Induk Pegawai)**. UI, notifikasi, validasi, template import, dokumentasi, dan test dilarang memakai label "Karyawan" atau "Nomor Pegawai"; identifier teknis lama seperti role code `employee`, kolom `employee_no`, dan alias kompatibilitas tidak diubah tanpa migration kontrak khusus.
- Event absensi mentah bersifat append-only.
- `attendance_daily_summaries` adalah hasil olahan dan boleh dihitung ulang.
- Lokasi/divisi/jabatan aktif berasal dari `employee_assignments`, bukan kolom duplikat pada `employees`.
- Riwayat kontrak dan penempatan tidak boleh ditimpa atau dihapus fisik. Salah input kontrak dikoreksi melalui aksi edit yang diaudit atau dibatalkan secara logis dengan alasan; dokumen setiap record histori tetap dapat dilihat melalui file ID berizin. Tampilan histori lifecycle wajib menampilkan pelaku dan waktu pencatatan, koreksi terakhir, serta pembatalan dari kolom domain atau `audit_logs`; data audit tidak boleh disimpulkan dari actor yang sedang login.
- Ringkasan hubungan kerja pegawai berstatus final wajib tetap menampilkan kontrak terakhir dari histori, status akhir, dan akses ke detail alasan, tanggal efektif, pelaku, serta waktu pencatatan. Jangan mengosongkan informasi hanya karena kontrak aktif telah ditutup.
- Akhir hubungan kerja hanya boleh diproses melalui workflow terkonfirmasi yang atomik dengan status `terminated`, `retired`, atau `deceased`. Tanggal efektif wajib berada di antara tanggal bergabung dan hari ini; tanggal masa depan dilarang sampai scheduler khusus tersedia.
- Pengakhiran hubungan kerja menutup penempatan dan kontrak aktif, menonaktifkan akun tertaut, serta menyimpan status, tanggal, alasan, pelaku, waktu, dan audit tanpa menghapus profil maupun histori. Pegawai berstatus final tidak boleh diubah kembali melalui form profil, kontrak, penempatan, atau profil lengkap biasa.
- File bersifat privat; `object_key` tidak pernah dikirim mentah ke browser.

## 4. Aturan multi-organisasi wajib

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

## 5. Role dan permission

### Superadmin

- Mengelola organisasi, lokasi awal, akun admin/HRD, masa aktif, dan konfigurasi platform.
- Tidak otomatis menjadi HRD organisasi; gunakan aksi lintas organisasi yang eksplisit.

### HRD

- CRUD data pegawai dan master organisasi sesuai submenu Lihat Saja/Kelola setelah konfigurasi hak HRIS diaktifkan; organisasi lama tetap mengikuti rollout pada bagian 27.
- Data Master HRD memakai halaman/API yang sama dengan Superadmin, tetapi `organization_id` selalu dikunci dari session. HRD dapat mengelola lokasi, jenis unit organisasi, Divisi & Unit, jabatan, serta jenis kepegawaian organisasinya; identitas organisasi, masa akses, dan Admin/HRD pertama tetap khusus Superadmin.
- Mengelola kontrak, penempatan, shift, absensi, izin, dokumen, kasus, dan sanksi.
- Menjadi satu-satunya approver cuti/izin.
- Mengunggah dokumen sanksi dan mengubah status tindakan.
- Setelah konfigurasi HRIS aktif, admin HRD penuh mengelola akun HRD, Pimpinan, dan Pegawai serta delegasi HRIS. HRD terdelegasi hanya mengelola akun Pegawai sesuai dua kewenangan pada bagian 28. Tautan profil pegawai opsional untuk HRD/Pimpinan dan wajib untuk Pegawai; dilarang memberi role Superadmin atau menonaktifkan diri. Superadmin boleh mencabut admin penuh tanpa pengganti dan mengubah role/status HRD aktif terakhir. Pengakhiran hubungan kerja melalui workflow terpisah tetap meminta pencabutan admin penuh terlebih dahulu.
- Cakupan HRD selalu eksplisit melalui `location_scope_mode=all|selected`; ketiadaan baris scope tidak boleh ditafsirkan sebagai akses penuh ketika mode `selected`.

### Pimpinan

- Read-only untuk seluruh profil, penempatan, kontrak, dokumen sensitif, dan histori sanksi pada organisasinya tanpa batas lokasi. Preview/download sensitif wajib diaudit.
- Tidak dapat mengubah profil HRD, memutus izin, atau menerbitkan sanksi melalui sistem.
- Dokumen dan data sangat sensitif memerlukan permission khusus.

### Pegawai

- Tahap sekarang dapat dibuat tanpa akun aktif.
- Tahap mobile/web lanjutan: melihat data sendiri, absensi, mengajukan izin/cuti, dan mengunggah lampiran.
- Tidak pernah boleh memilih `employee_id` milik orang lain.
- Permission self-service wajib memakai kode dan endpoint `*_self` yang memetakan pegawai dari session. Dilarang memberikan permission HRIS generik organisasi kepada Pegawai sebelum endpoint self-service tersedia. Akses operasional Inventaris hanya diperoleh melalui paket organisasi dan scope gudang eksplisit, terpisah dari self-service.

Semua aksi diperiksa di backend. Menyembunyikan tombol di frontend bukan kontrol keamanan.

## 6. Struktur organisasi, cabang, dan divisi

- `organizations`: identitas organisasi.
- `locations`: kantor pusat, cabang, unit pasar, site, gudang.
- `organization_unit_types`: master klasifikasi struktur yang fleksibel dan terisolasi per organisasi.
- `organization_units`: struktur organisasi bertingkat yang wajib mereferensikan `organization_unit_types` melalui `unit_type_id`.
- `organization_unit_locations`: menghubungkan banyak divisi ke satu cabang dan satu divisi ke beberapa lokasi.
- `employee_assignments`: lokasi + unit + jabatan + atasan pada suatu periode.

Aturan jenis unit organisasi:

1. `organization_unit_types` adalah satu-satunya sumber kebenaran jenis unit; dilarang menambahkan kembali enum, CHECK daftar tetap, atau kolom teks `organization_units.unit_type`.
2. Setiap jenis unit wajib memiliki `organization_id`, kode uppercase unik, nama unik case-insensitive, urutan tampil, dan status aktif.
3. `organization_units.unit_type_id` wajib memakai composite foreign key `(organization_id, unit_type_id)` agar tidak dapat mengambil jenis milik organisasi lain.
4. Jenis yang sudah digunakan tidak boleh dihapus; nonaktifkan agar histori tetap dapat dibaca dan cegah pemilihannya pada unit baru.
5. Jenis unit hanya mengklasifikasikan struktur. Hierarki tetap ditentukan oleh `parent_unit_id`, sedangkan lokasi operasional ditentukan oleh `organization_unit_locations`.
6. Setiap relasi Divisi & Unit-lokasi wajib menerima `active_from` eksplisit berdasarkan kondisi organisasi sebenarnya; dilarang mengisinya otomatis dari tanggal server. Beberapa lokasi boleh memakai tanggal bersama dengan override per lokasi. Koreksi atau pelepasan wajib beralasan, diaudit, dan tidak boleh membuat histori penempatan menjadi invalid.

Rolling/mutasi harus dilakukan dalam satu transaksi:

1. Lock penempatan utama aktif pegawai.
2. Tutup `effective_until` lama satu hari sebelum tanggal efektif baru.
3. Insert baris penempatan baru.
4. Validasi unit memang tersedia pada lokasi atau minta override berizin.
5. Tulis audit log dan outbox.

Dilarang mengubah lokasi/divisi pada baris lama untuk merepresentasikan mutasi.

## 7. Shift dan jadwal

Gunakan empat jenis shift:

- `fixed`: jam masuk/pulang pasti, misalnya 09.00-17.00.
- `flexible`: jendela masuk dan durasi kerja minimum; keterlambatan hanya dinilai bila kebijakan mendefinisikannya.
- `field`: tenaga lapangan; utamakan durasi/kehadiran dan lokasi yang diizinkan.
- `off`: libur.

Aturan pola dapat ditempel pada pegawai, divisi, atau lokasi. Prioritas resolusi:

1. Target pegawai.
2. Target divisi/unit aktif.
3. Target lokasi aktif.
4. Jika tidak ada aturan, jadwal berstatus perlu ditinjau; jangan menebak shift.

Generator membuat `employee_daily_schedules` sebagai snapshot. Perubahan master shift tidak boleh mengubah rekap historis. Override jadwal harus menyimpan alasan dan audit.

Untuk shift fixed:

- Terlambat = clock-in pertama setelah `scheduled_start_at + late_tolerance_minutes`.
- Pulang awal = clock-out terakhir sebelum `scheduled_end_at - early_leave_tolerance_minutes`.
- Pulang melewati jadwal hanya menghasilkan `overtime_candidate_minutes`.
- `approved_overtime_minutes` hanya terisi jika kebijakan otomatis mengizinkan atau HRD menyetujui. Pulang telat tidak selalu berarti lembur.

Untuk shift lintas tengah malam, kaitkan event ke `work_date` jadwal, bukan sekadar tanggal kalender event.

## 8. Absensi tahap dashboard

Jangan memaksa HRD memasukkan ratusan pegawai satu per satu. Implementasikan urutan berikut:

1. Download template Excel/CSV dengan NIP, tanggal, jam masuk, jam pulang, status, dan catatan.
2. Upload ke file privat dan buat `attendance_import_batches`.
3. Parse ke `attendance_import_rows` tanpa langsung menulis event final.
4. Tampilkan preview dan error per baris: NIP tidak ada, duplikat, tanggal invalid, di luar organisasi, atau urutan jam salah.
5. Commit seluruh baris valid dalam transaksi/batch yang idempotent.
6. Buat event `source='import'`, hitung ulang rekap terkait, dan tulis audit.

Sediakan input manual hanya untuk koreksi kasus kecil. Setiap koreksi menyimpan alasan, actor, dan audit.

Web kiosk/PWA capture boleh ditambahkan sebagai jembatan, tetapi harus memanggil endpoint attendance yang sama dengan mobile masa depan. Jangan membuat database kedua.

## 9. Kontrak mobile attendance

Mobile mengirim UUID `client_event_id` yang tetap sama saat retry. Server:

1. Autentikasi user dan petakan ke pegawai.
2. Buat/ambil `attendance_event_receipts` berdasarkan `(organization_id, client_event_id)`.
3. Jika receipt sudah `stored`, kembalikan hasil lama tanpa insert baru.
4. Ambil jadwal dan titik yang berlaku pada waktu kejadian.
5. Validasi waktu, koordinat, akurasi, radius, foto, perangkat, dan batas replay.
6. Simpan foto privat lebih dahulu secara aman, lalu event dan status receipt dalam transaksi terkoordinasi.
7. Jalankan rekap dan indikator secara asinkron/idempotent.

Event offline diperbolehkan sesuai kebijakan organisasi. Simpan `occurred_at`, `received_at`, timezone, serta flag offline. Jangan memakai jam perangkat tanpa pemeriksaan deviasi.

## 10. Geofence, foto, dan validasi background

- `attendance_points` menyimpan koordinat, radius, batas akurasi, dan kebutuhan foto.
- `attendance_point_assignments` dapat menarget pegawai, divisi, atau lokasi dengan periode berlaku.
- Event menyimpan snapshot `distance_from_point_m` dan `allowed_radius_m`; perubahan radius tidak mengubah histori.
- Backend menghitung jarak dan tidak mempercayai boolean `inside_geofence` dari klien.
- Koordinat dan foto dianggap data sensitif dengan retention yang jelas.
- Foto wajib memiliki pemeriksaan MIME nyata, ukuran, dimensi, hash, dan malware scan bila tersedia.
- Validasi background/liveness adalah hasil verifikasi, bukan bukti absolut. Status meragukan masuk `needs_review`.
- Jangan menyimpan biometric embedding mentah tanpa keputusan hukum, keamanan, dan retention terpisah.

## 11. Rekap absensi

`attendance_events` adalah bukti mentah. `attendance_daily_summaries` menyimpan:

- hadir, terlambat, tidak hadir, cuti, izin, sakit, dinas, libur, tidak lengkap, perlu tinjau;
- jam masuk pertama dan pulang terakhir;
- menit kerja, terlambat, pulang awal, kandidat lembur, dan lembur disetujui;
- versi kalkulasi dan waktu hitung.

Rekap harus mempertimbangkan jadwal, event valid, izin disetujui, hari libur, dan koreksi HRD. Perubahan aturan memicu recalculation terkontrol, bukan update event mentah.

Dashboard dan laporan rutin membaca rekap, bukan menghitung jutaan event setiap request.

## 12. Cuti dan izin

- Identitas pada Rekap Cuti & Izin memakai ID pas foto profil aktif yang sama dengan Kepegawaian, melalui endpoint file privat dan ImagePreviewModal. Grant laporan boleh membaca pas foto pada organisasi/scope pegawai yang sama, tanpa membuka dokumen identitas, lampiran pribadi, atau mutation file. Saldo desktop memakai kolom terpisah Hak/Terpakai/Sisa; mobile memakai LeaveBalanceFields dengan label serta satuan yang sama. Jangan menyembunyikan Hak/Terpakai sebagai metadata kecil atau mengubah perhitungan ledger demi tampilan.

- Halaman Rekap Cuti & Izin berfokus pada filter dan tabel, tanpa kartu ringkasan atau grafik yang sudah tersedia di Dashboard. Filter Cari pegawai berada sebelum Tahun. Dataset agregat boleh tetap digunakan untuk Excel tiga sheet.

- Laporan **Rekap Cuti & Izin** (`leave-summary-report`) memiliki grant read-only terpisah dari menu operasional. Kartu, grafik jenis/bulan, baris pegawai–jenis, rincian, dan Excel memakai cohort berizin yang sama: penempatan utama saat ini, tanggal mulai pada tahun organisasi, status approved/cancelled terpisah, tanpa draft atau alasan/lampiran pribadi. Durasi penuh sesuai persetujuan; hari/jam tidak dijumlahkan. Saldo dari ledger entitlement tahun pilihan, posisi terkini; hak termasuk carryover/koreksi, pemakaian bersih setelah restoration, tanpa entitlement jangan mengarang saldo. Rincian melalui modal report-only. Batas Excel 5.000 baris, audit, no-store, dan cursor terikat scope wajib. Aturan rinci: `docs/leave-summary-report.md`.

- Export pada daftar Cuti & Izin memakai `GET /api/leave-requests/export`, permission `leave_requests.read`, filter dan scope lokasi yang sama dengan daftar. Excel memuat seluruh hasil maksimal 5.000 data tanpa pemotongan diam-diam; NIP berupa teks, durasi angka bulat beserta satuan. Alasan pribadi, data medis, dan lampiran tidak diekspor. Unduhan diaudit dan private/no-store. PDF memakai notifikasi Coming soon melalui TableExportMenu. Lihat `docs/leave-export.md`.

- Approval final hanya oleh role HRD aktif.
- Tahap sekarang HRD dapat mencatat izin langsung dengan `submission_source='hrd_entry'`.
- Tahap mobile Pegawai dapat submit; keputusan tetap HRD.
- Pimpinan hanya melihat sesuai permission.
- Jenis sakit dapat mewajibkan `required_attachment_category='medical_letter'`.
- Request tidak boleh menjadi approved jika lampiran wajib belum ada dan valid.
- Overlap izin, saldo, tanggal kontrak, hari libur, dan status pegawai harus divalidasi server.
- Keputusan, pembatalan, dan perubahan lampiran diaudit.
- `employees.employment_status` tidak boleh memakai nilai `leave`; cuti dan izin sementara hanya berasal dari `leave_requests` yang disetujui. Form profil, import, dashboard, dan login wajib mengikuti pemisahan ini.
- Saldo cuti berasal dari penjumlahan `leave_balance_transactions`. Dilarang menimpa angka saldo langsung atau menghapus transaksi ledger.
- Pencatatan approved tidak dapat diedit. Koreksi dilakukan melalui pembatalan beralasan yang mengembalikan saldo tepat satu kali, lalu membuat pencatatan baru bila diperlukan.

## 13. Disiplin berdasarkan Peraturan Perusahaan

Rujukan yang sudah diverifikasi: Pasal 52-58 pada dokumen Kode Etik, Tata Tertib, Jenis Pelanggaran dan Sanksi.

Aturan utama:

- Pelanggaran ringan mencakup mangkir 1 hari, terlambat/pulang awal tanpa izin, dan tidak melakukan absensi.
- Ringan: teguran lisan; SP1 bila tidak membaik; SP2 bila mengulang setelah SP1; SP3 bila mengulang setelah SP2.
- Sedang mencakup mangkir 3 hari kerja berturut-turut dan pengulangan pelanggaran ringan dalam masa SP.
- Sedang: SP1, lalu SP2, lalu SP3; organisasi dapat langsung memberi SP2/SP3 dengan pertimbangan kesalahan dan dampak.
- Berat mencakup mangkir 5 hari kerja berturut-turut atau lebih, atau 9 hari kerja dalam 1 bulan, serta daftar pelanggaran berat lain dalam Pasal 58.
- Berat dapat berujung SP3, skorsing, penurunan jabatan, dan/atau PHK sesuai proses resmi.
- SP1, SP2, dan SP3 masing-masing berlaku 3 bulan sejak diterbitkan dan gugur bila tidak ada pelanggaran dalam masa berlaku.
- Pegawai dapat diberi kesempatan menjelaskan/membela diri sebelum sanksi berat, kecuali tertangkap tangan.
- Satu kasus disiplin hanya boleh memiliki satu tindakan resmi. Pelanggaran atau pengulangan berikutnya dicatat sebagai kasus baru; tindakan yang memiliki surat wajib menyediakan satu aksi unduh dokumen berizin.
- Tindakan berstatus `draft`, termasuk metadata dan suratnya, hanya boleh dikembalikan kepada HRD dan Superadmin. Pimpinan hanya menerima tindakan yang sudah menjadi histori resmi seperti aktif, berakhir, dicabut, atau diajukan banding; penyaringan wajib dilakukan di query/service dan endpoint file, bukan hanya di UI.
- Daftar kasus pada detail pegawai memakai kartu ringkas untuk pemindaian dan `AppModal` untuk uraian, pembelaan, tindakan, eskalasi, audit penerbit, serta surat. Kartu tindakan yang dicabut wajib menampilkan status, pelaku, waktu, dan ringkasan alasan maksimal dua baris; alasan utuh tetap berada di modal detail. Jangan memadatkan seluruh informasi sensitif di kartu atau membuat halaman/modal shell lain.
- Tindakan tertulis aktif wajib memiliki nomor surat dan satu PDF berizin. Teguran lisan tidak mewajibkan nomor maupun dokumen surat. Pimpinan hanya dapat membaca detail dan mengunduh surat sesuai permission; kontrol perubahan tetap khusus HRD/Superadmin.

Sistem hanya membentuk `discipline_indicators`. HRD harus:

1. Meninjau bukti.
2. Membuka `discipline_cases` bila layak.
3. Mencatat klasifikasi dan penjelasan pegawai.
4. Mengunggah surat untuk tindakan tertulis.
5. Menerbitkan `disciplinary_actions`.

Dilarang membuat job yang otomatis mengubah indikator menjadi SP/PHK. Direct SP2/SP3 wajib menyimpan `direct_escalation=true` dan alasan. Dokumen dan uraian kasus hanya boleh terlihat oleh role berwenang.

Lifecycle tindakan disiplin wajib mempertahankan histori: status `draft` masih dapat diedit dan boleh belum memiliki surat lengkap; perubahan ke `active` memvalidasi ulang nomor serta PDF tindakan tertulis. Tindakan `active` dilarang ditimpa atau dihapus dan hanya dapat menjadi `revoked` melalui aksi pencabutan beralasan yang menyimpan waktu, pelaku, audit, serta seluruh data dan dokumen keputusan asal.

## 14. File privat

- Pemeliharaan penyimpanan melindungi file berdasarkan referensi nyata, termasuk histori, versi dokumen, logo organisasi, dan draft aktif. Kategori dokumen resmi atau kepemilikan `employee_id` saja bukan alasan mempertahankan file tanpa referensi. Superadmin boleh membersihkan file tersebut secara permanen setelah konfirmasi dan pemeriksaan ulang; histori bisnis dan audit tidak dihapus.
- Halaman Pemeliharaan Penyimpanan memuat data saat dibuka, organisasi berganti, tab kembali aktif, atau pengguna meminta Muat ulang. Polling berurutan 10 detik hanya saat ada proses `queued`/`running` dan tab terlihat; hentikan saat idle/tersembunyi, coba ulang kegagalan jaringan proses aktif tanpa menumpuk request.
- File tanpa catatan berumur kurang dari 24 jam tidak menjadi kandidat. Pembersihan manual kandidat tanpa referensi tidak memerlukan hasil antivirus bersih atau masa tunggu tujuh hari; preview/unduh tetap wajib bersih. File terinfeksi tetap mengikuti karantina keamanan.
- Semua temuan, kartu, riwayat, dan modal pemeliharaan wajib menampilkan organisasi asal dari data server. Organisasi yang belum terverifikasi memblokir penghapusan. Gunakan keterangan singkat seperti “Tidak digunakan”, “File tanpa catatan”, atau “File tidak ditemukan”, serta tombol tindakan yang sesuai masalah.

- Development boleh memakai direktori privat di luar public web root.
- Produksi direkomendasikan object storage privat.
- Backup sistem manual oleh Superadmin wajib mencakup PostgreSQL dan seluruh file yang tersedia di `UPLOAD_ROOT` lintas organisasi dalam satu paket terenkripsi. Kata sandi tidak disimpan; paket siap tetap berada di server sampai Superadmin menghapusnya secara eksplisit, unduhan dan penghapusan diaudit, dan restore produksi tidak tersedia dari dashboard. Penghapusan hanya menghapus artefak backup, bukan database aktif, `UPLOAD_ROOT`, histori, temuan, atau audit. File yang dirujuk tetapi hilang atau berbeda dicatat sebagai temuan dengan identitas organisasi serta pemilik yang terverifikasi dan menghasilkan status `ready_with_warnings`; kegagalan snapshot, path tidak aman, atau penyimpanan tidak dapat dibaca tetap menggagalkan backup. Uji pemulihan dilakukan di lingkungan terpisah. Lihat `docs/system-backup.md`.
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
- Nama fisik wajib UUID. Nama pegawai, NIK, nomor rekening, nomor surat, dan data pribadi lain dilarang berada dalam object key, path, atau log.
- Browser hanya menerima ID metadata dan mengakses `/api/uploads/:fileId`; endpoint catch-all berdasarkan path dilarang.
- Response file memakai `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, CSP ketat, nama download tersanitasi, authorization organisasi/scope, dan audit untuk preview/download sensitif.
- Gambar menerima JPEG/PNG/WebP maksimal 5 MB. Dokumen menerima PDF maksimal 10 MB; DOCX hanya untuk kategori yang membutuhkannya dan tidak dipreview inline. MIME harus dideteksi dari byte.
- Dropzone gambar wajib menampilkan pratinjau dan metadata file setelah upload berhasil. File lama berbasis `fileId` harus memiliki lifecycle lihat, ganti, dan hapus yang sama dengan file baru; aksi hapus wajib membersihkan state UI serta melepas referensi profil terkait secara transaksional agar ID file usang tidak muncul kembali.
- Pada form komposit yang memiliki tombol simpan utama seperti `Profil lengkap pegawai`, pemilihan file hanya boleh membuat pratinjau lokal. Byte file, metadata `stored_files`, dan referensi domain baru disimpan ketika tombol simpan utama berhasil; kegagalan validasi atau transaksi wajib membersihkan file sementara dan tidak boleh meninggalkan metadata/file baru setengah jadi.
- Pas foto, KTP, Kartu Keluarga, NPWP, BPJS, ijazah, dan sertifikat adalah bukti visual: upload baru hanya menerima JPEG/PNG/WebP. Kontrak, SK penempatan, dan surat sanksi adalah dokumen resmi: upload baru hanya menerima PDF. File lama dengan tipe sebelumnya tetap dapat dibuka secara berizin, tetapi tidak boleh menggantikan validasi tipe baru.
- Tulis upload ke file sementara, hash SHA-256, lalu atomic move. Bersihkan byte bila transaksi metadata gagal. Penghapusan lampiran profil memakai karantina atomik: pulihkan file bila transaksi database gagal dan hapus byte karantina setelah commit berhasil. Bukti histori resmi tetap memakai soft delete dan retention.

### Import pegawai multi-sheet

- Import pegawai wajib memakai template multi-sheet terpusat yang sama untuk generator, parser, validasi, dokumentasi, dan laporan error; dilarang mendefinisikan header terpisah di route atau UI.
- Import hanya menerima `.xlsx` maksimal 10 MB. Foto, dokumen, kasus disiplin, dan tindakan sanksi tidak boleh dimasukkan; seluruh file dilengkapi manual melalui detail pegawai setelah profil tersedia.
- UI wajib menjelaskan data yang diproses, hubungan antar-sheet, batas file, preview, dampak commit parsial, dan langkah upload dokumen manual setelah import.
- `employee_no` adalah penghubung lintas-sheet. Referensi histori harus unik dalam workbook dan tidak boleh memakai ID database yang ditebak klien.
- Import hanya membuat pegawai baru. NIK wajib 16 digit. NIP dan NIK dinormalisasi serta diperiksa terhadap seluruh record termasuk soft-deleted; jangan mengubah import menjadi upsert tanpa keputusan produk dan audit baru.
- Validasi dilakukan sebelum commit dan error ditampilkan per pegawai, sheet, serta nomor baris. Satu error membuat seluruh kelompok pegawai invalid.
- Commit wajib atomik per pegawai, idempotent, dan dapat menghasilkan `partially_committed`; kegagalan satu pegawai tidak menggagalkan kelompok valid lain.
- Container OOXML wajib diperiksa sebelum parsing: tolak macro, external link, embedded object, enkripsi, formula, struktur tidak valid, dan perluasan data berlebihan.
- Commit melakukan lock dan pemeriksaan identitas ulang; unique constraint database tetap menjadi pertahanan terakhir terhadap race condition.
- Akun login, password, dokumen, kasus disiplin, tindakan sanksi, absensi, payroll, dan indikator otomatis tidak termasuk import pegawai kecuali ada perubahan produk eksplisit.

## 15. Query dan indexing

### Laporan kontrak dan proyeksi pensiun

- Dashboard, daftar laporan, dan ekspor wajib memakai service/filter laporan bersama serta tanggal acuan dari timezone organisasi. Usia pensiun wajib membaca `organization_retirement_policies`, tidak memakai konstanta global. Organisasi lama mendapat kebijakan awal 58 tahun dari migration 027; organisasi baru wajib mengaturnya. Perubahan wajib beralasan, terkonfirmasi, menggunakan version check dan audit append-only; hanya HRD/Superadmin dengan permission khusus dapat menyimpan. Pimpinan membaca. Kebijakan belum tersedia wajib ditampilkan jelas, bukan dianggap nol pegawai. Cache/cursor mengikuti versi kebijakan. Tanggal 29 Februari menjadi 28 Februari pada tahun nonkabisat. Laporan tidak otomatis mengakhiri hubungan kerja.
- Default pensiun adalah 12 bulan ke depan dan kontrak 30 hari ke depan, inklusif. Kelompok sudah lewat tidak dibatasi periode masa depan. Tahun ini/rentang sendiri dapat mencakup tanggal lewat dan mendatang; tanggal lahir bermasalah tidak difilter tanggal proyeksi.
- Hanya pegawai aktif, masa percobaan, atau ditangguhkan yang tidak dihapus logis masuk laporan. Kontrak tanpa tanggal akhir, draft, dibatalkan, terminated, atau histori yang sudah digantikan tidak boleh dianggap tunggakan perpanjangan.
- Laporan dan ekspor wajib memeriksa permission, organisasi, dan cakupan lokasi yang sama. HRD bercakupan lokasi tidak mendapat akses tambahan pada pegawai tanpa penempatan. Superadmin memilih satu organisasi secara eksplisit.
- Excel memuat seluruh hasil filter, maksimal 5.000 baris; kelebihan batas harus ditolak tanpa pemotongan diam-diam. NIP/nomor kontrak berupa teks literal, tanpa NIK/dokumen privat; ekspor diaudit dan memakai no-store.
- Definisi dan prosedur uji terdapat pada `lib/reports/README.md`. Perhitungan adalah data turunan, bukan kolom baru.

Aturan wajib:

- Hindari `SELECT *` pada API.
- Semua list memakai keyset pagination bila data besar; offset hanya untuk master kecil.
- Filter **Ditambahkan oleh** pada daftar pegawai wajib berasal dari audit append-only `employee.create`, dibatasi organisasi dan scope lokasi actor. Dilarang menambah kolom pembuat yang dapat ditimpa pada profil pegawai hanya demi kebutuhan filter.
- Filter organisasi dan rentang tanggal harus berada di query SQL.
- Hindari N+1; gunakan join/batch query.
- Dashboard membaca view/rekap dan cache singkat bila tidak harus real-time.
- Export besar dijalankan background job dan menghasilkan file privat.
- Jangan menambah index untuk setiap kolom. Tambah index berdasarkan query nyata.
- Sebelum merge query penting, uji `EXPLAIN (ANALYZE, BUFFERS)` dengan data representatif.
- Pantau `pg_stat_statements`, koneksi, lock, autovacuum, dead tuples, cache hit, dan pertumbuhan index.

Index utama sudah disiapkan untuk:

- pencarian nama pegawai dengan trigram;
- daftar pegawai aktif per organisasi;
- penempatan aktif dan histori;
- kontrak akan berakhir;
- event per pegawai/waktu dan event perlu tinjau;
- rekap per tanggal/status, ranking terlambat, dan histori pegawai;
- izin menunggu dan histori izin;
- indikator/kasus/tindakan disiplin;
- audit dan outbox.

Gunakan connection pool. Banyak instance/serverless memerlukan pool eksternal seperti PgBouncer. Transaksi harus singkat; jangan melakukan upload atau network call di dalam transaksi database.

## 16. Partitioning dan retention

- `attendance_events` dipartisi bulanan berdasarkan `event_date`.
- Scheduler membuat partisi bulan berjalan dan minimal dua bulan ke depan memakai `ensure_attendance_month_partition()`.
- Default partition hanya pengaman; monitor dan pindahkan isinya ke partisi yang benar.
- Jangan membuat satu partisi per organisasi atau per hari.
- Rekap harian tidak perlu dipartisi sebelum volume dan query plan membuktikan kebutuhan.
- Kebijakan retention foto absensi dapat lebih pendek daripada rekap, tetapi harus disetujui organisasi.

## 17. API

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

## 18. Keamanan dan privasi

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

## 19. Migration dan transaksi

- Satu migration untuk satu perubahan logis.
- Setiap perubahan yang menghasilkan migration wajib menyertakan pembaruan `sitou_schema_v3.sql` dan, bila struktur atau aturan data berubah, `docs/database-schema.md` dalam commit yang sama. Migration, snapshot schema, dan dokumentasi tidak boleh dibiarkan berbeda versi.
- Karena pengembangan dilakukan dari beberapa device dan environment, sebelum mulai bekerja atau menjalankan aplikasi wajib periksa status migration database lokal terhadap migration di repository, lalu jalankan hanya migration yang belum diterapkan. Dilarang mengandalkan asumsi bahwa schema PC, laptop, dan VPS sudah sama.
- Sebelum migration dianggap selesai, verifikasi dua jalur: upgrade database yang sudah berisi data melalui seluruh migration baru, serta bootstrap database kosong menggunakan `sitou_schema_v3.sql`. Hasil struktur akhirnya harus ekuivalen.
- Migration harus dapat dijalankan pada database kosong dan database berisi data.
- Perubahan destruktif memakai pola expand-migrate-contract.
- Backfill besar berjalan batch dan dapat dilanjutkan.
- Pembuatan index besar di produksi pertimbangkan `CREATE INDEX CONCURRENTLY` pada migration nontransactional.
- Jangan mengganti migration yang sudah dirilis; buat migration koreksi.
- Setiap use case multi-tabel memakai transaksi.
- Lock record aktif saat rolling, approval, commit import, dan penerbitan tindakan untuk mencegah race condition.

## 20. Testing wajib

Minimal sebelum pekerjaan dianggap selesai:

- Unit test aturan shift fixed, flexible, field, lintas tengah malam, toleransi, pulang awal, dan kandidat lembur.
- Unit test mangkir 1, 3 berturut-turut, 5 berturut-turut, dan 9 dalam sebulan menghasilkan indikator yang tepat tetapi tidak membuat sanksi.
- Integration test rolling menutup penempatan lama dan menyimpan histori.
- Integration test tidak ada dua penempatan utama aktif.
- Integration test import: preview, error per baris, duplicate retry, dan commit idempotent.
- Integration test mobile event retry tidak menggandakan event.
- Integration test HRD-only decision; Pimpinan dan Pegawai ditolak.
- Test izin sakit tidak dapat approved tanpa surat dokter ketika diwajibkan.
- Test lintas organisasi untuk setiap repository/use case utama.
- Test file privat tidak bisa diakses dengan object key langsung.
- Test query plan untuk dashboard pada dataset representatif.

Gunakan data sintetis. Jangan memakai data pegawai asli pada test atau development bersama.

## 21. UI/UX

- Dropdown pilihan pada form, filter, dan pagination wajib memakai `AsyncSelect` atau adapter domain yang menyusun komponen tersebut. Pilihan harus dapat diketik/dicari berdasarkan label; jangan menambahkan `Select` tanpa pencarian. Pencarian server boleh memakai `onSearch` dan `filterOption={false}`. Menu aksi seperti Export tetap memakai komponen menu, bukan dropdown pilihan data.
- Saat logout dimulai, hentikan polling akses dan timer sesi, batalkan request akses yang masih berjalan, serta abaikan respons terlambat. Modal sesi berakhir/perubahan akses tidak boleh muncul selama logout. Jika logout gagal, pulihkan pemeriksaan sesi dan polling; kedaluwarsa sungguhan tetap mengikuti alur keamanan.

- Seluruh label/pesan yang dibaca pengguna untuk akses modul memakai istilah **Fitur**, **Akses fitur**, dan **Fitur dan izin**, bukan Paket. Aktivasi organisasi memakai **Fitur organisasi** dan label **Fitur Inventaris**; pilihan izin memakai **Fitur Inventaris — Lihat Saja/Pengelola Gudang/Pengelola Master Inventaris**. Identifier teknis seperti `packageCode`, `packageAccess`, tabel paket, serta kode permission tetap menjadi kontrak internal/API. Istilah paket backup tetap berlaku untuk arsip backup, karena merupakan domain berbeda.
- Daftar organisasi Superadmin menampilkan **Fitur aktif** dari konfigurasi server, termasuk pada kartu mobile. Belum ada aktivasi ditampilkan sebagai **Belum ada fitur tambahan**; jangan menebak dari role akun atau menyamakan aktivasi fitur dengan izin semua pengguna. Form akses fitur menjelaskan tempat membuat gudang: Data Master → Gudang.

- Teks penjelasan/informasi memakai Bahasa Indonesia yang sederhana, singkat, dan langsung menjelaskan fungsi atau dampak aksi. Utamakan 1–3 kalimat; hindari pengulangan, istilah teknis yang tidak diperlukan, dan paragraf bertele-tele. Detail lanjutan ditempatkan pada dokumentasi atau konteks yang relevan.
- Paragraf penjelasan/informasi memakai alignment justify dengan baris terakhir mengikuti perilaku paragraf normal. Gunakan `FontStyle explanation` atau komponen deskripsi terpusat; jangan menerapkan justify pada judul, label field, angka, metadata, atau tabel. Penjelasan yang sengaja didesain center, seperti pesan utama modal hapus backup, tetap center melalui override eksplisit. Uji pada mobile agar kata, jarak, dan lebar paragraf tetap mudah dibaca.

- Seluruh antarmuka Bahasa Indonesia dan dapat dipahami pengguna nonteknis.
- Gunakan nama kegiatan yang dikenal pengguna dalam judul, penjelasan, dan pesan kosong. Untuk daftar cuti/izin, gunakan “cuti dan izin” atau “riwayat cuti dan izin”, bukan “pencatatan”. Contoh: “Lihat lima cuti dan izin terbaru Anda.” Sesuaikan istilah dengan proses sebenarnya; jangan menyebut seluruh data sebagai “pengajuan” jika juga mencakup cuti/izin yang dimasukkan HRD. Istilah “pencatatan” tetap dapat dipakai ketika memang menjelaskan waktu, pelaku, atau proses audit.
- Label, judul, tombol, bantuan, dan pesan validasi wajib menyebut isi atau tindakan dengan bahasa kerja yang langsung dipahami pengguna, sesuai fungsi kontrolnya. Hindari istilah struktur data atau label abstrak seperti "Nama jenis", "Jenis aktif", dan kode teknis ketika pengguna sebenarnya diminta memberi nama pilihan atau menentukan apakah pilihan tersebut tersedia. Gunakan pola yang konsisten, misalnya "Nama cuti atau izin", "Kelompok", "Kurangi jatah pegawai", dan "Tersedia untuk digunakan". Istilah teknis tetap boleh dipakai pada schema, kode program, dan dokumentasi pengembang, tetapi tidak ditampilkan sebagai beban input pengguna.
- Untuk teks yang dibaca pengguna, sebut objek konkretnya: "cuti atau izin" untuk permintaan cuti/izin, "transaksi" untuk perubahan stok, dan "disimpan pada" untuk waktu penyimpanan. Jangan memakai "pencatatan" sebagai nama generik objek/aksi. "Catatan" tetap tepat bila field benar-benar berisi keterangan bebas. Jatah tahunan dari aturan harus dibedakan dari saldo resmi yang sudah masuk ledger.
- Locale tanggal dan waktu wajib dipasang terpusat melalui `app/components/approvider/AppProviders.jsx`. Seluruh DatePicker/Calendar AntD memakai locale `id_ID` dan Day.js locale `id`, sedangkan MUI date picker memakai adapter locale `id`; dilarang mengatur nama bulan, hari, placeholder, atau tombol kalender per halaman secara manual.
- Seluruh field tanggal, bulan, dan tahun pada form wajib memakai date picker dengan mode yang sesuai dari library UI yang sudah terpasang, bukan `Input` teks atau input angka manual. Gunakan date picker standar untuk tanggal, month picker untuk bulan, dan year picker untuk tahun. Nilai form menggunakan objek tanggal adapter dan hanya dinormalisasi ke format kontrak API pada batas request.
- Sebelum membuat komponen UI baru, periksa `app/components` dan gunakan komponen reusable yang sudah ada untuk fungsi/kebutuhan yang sama. Perluas API komponen yang ada bila masih dalam tanggung jawab yang sama; jangan membuat duplikat hanya karena dipakai pada halaman berbeda.
- Seluruh typography MUI wajib menggunakan reusable component `app/components/font-style/FontStyle.jsx`, bukan mengimpor `Typography` langsung pada halaman atau komponen fitur. Gunakan font weight normal `500`, medium `600`, dan bold maksimal `700`; dilarang memakai bobot di atas `700`.
- Keluarga font UI wajib bersumber dari `app/theme/typography.js`: pemuatan file lokal, APP_FONT_FAMILY, dan APP_FONT_WEIGHTS. CSS global, Material UI, Ant Design, serta grafik mengikuti konfigurasi yang sama. Jangan menulis nama font atau font stack langsung pada komponen fitur. FontStyle mengikuti theme, kontrol form native mengikuti font halaman. Panduan penggantian dan verifikasi: `docs/typography.md`.
- Implementasi UI/UX wajib mengikuti best practice React/Next.js: komponen terfokus, state minimal, aksesibilitas dasar, semantic HTML, serta styling responsif yang tidak mengandalkan ukuran layar tunggal.
- Saat memakai atau mengubah komponen library UI seperti AntD/MUI, periksa kontrak versi yang benar-benar terpasang pada type definition atau dokumentasi lokal. Dilarang menambahkan prop/API deprecated; khusus AntD 6 gunakan `Alert.title` bukan `Alert.message`, `Steps.titlePlacement` bukan `Steps.labelPlacement`, `Tabs.destroyOnHidden` bukan `destroyInactiveTabPane`, `Timeline.items.content` bukan `items.children`, dan `Space.Compact` untuk prefix/suffix field, bukan `Input.addonBefore`/`addonAfter` yang deprecated. AntD `List` juga tidak boleh dipakai karena telah deprecated; susun daftar dengan semantic HTML/reusable data view yang sesuai kebutuhan.
- Sebelum perubahan UI dianggap selesai, periksa console browser dan cari penggunaan API deprecated pada seluruh area terkait agar warning yang sama tidak berpindah ke halaman lain.
- Validasi gagal dan tampilan Notification dilarang me-reset, me-remount, atau memuat ulang nilai form yang sedang diisi. Efek inisialisasi modal/wizard wajib memakai dependency stabil dan hanya dijalankan ketika sesi form, organisasi, atau record yang diedit benar-benar berubah.
- Metadata `key` dari render prop `Form.List` tidak boleh disebarkan ke beberapa elemen JSX. Pasang `key` hanya secara langsung pada wrapper baris dan berikan `name` field turunan secara eksplisit agar tidak menghasilkan duplicate key atau hydration warning React.
- Dropdown kategori pada data berulang yang bersifat satu-per-pegawai, seperti jenis identitas administratif dan platform akun sosial, wajib menonaktifkan pilihan yang sudah dipakai baris lain serta divalidasi ulang di backend. Nilai awal baris baru wajib berasal dari pilihan pertama yang masih tersedia, bukan nilai hardcoded; kategori yang secara bisnis boleh berulang tidak boleh ikut dikunci.
- SITOU menggunakan satu tema light yang konsisten. Jangan menambahkan dark mode, theme switcher, atau penyimpanan preferensi tema kecuali ada keputusan produk baru.
- Warna brand, status, feedback, state interaktif, dan permukaan UI wajib bersumber dari token terpusat di app/components/themeprovider/ThemeProvider.jsx. Dilarang menulis nilai hex, rgb/rgba, gradient, atau shadow berwarna langsung di halaman/komponen fitur bila token semantik yang sesuai dapat disediakan atau sudah tersedia.
- Gunakan theme.brand untuk identitas SITOU, theme.status untuk success/warning/info/danger/neutral, palette MUI untuk state komponen, dan theme.ui untuk kebutuhan visual reusable atau halaman khusus. Token AntD harus mengambil sumber warna yang sama agar MUI dan AntD konsisten.
- Warna brand dipakai secara selektif untuk identitas, aksi utama, state aktif, atau penekanan yang memang perlu; jangan mewarnai semua angka, ikon, dan panel hanya agar tampak ber-brand. Data utama seperti jumlah stok tetap memakai warna teks netral agar mudah dibaca. Warna lain tetap boleh dipakai sesuai makna status/aksi. Ikon dekoratif berlatar warna memakai reusable `AppIconTile` dengan intensitas latar yang konsisten antar-tone; jangan merakit ulang kotak latarnya di setiap fitur. Pada ringkasan stok awal, ikon **Stok awal** memakai biru dengan latar biru pastel, sedangkan ikon **Stok saat ini** memakai merah brand dengan latar merah pastel; kedua angka stok tetap netral.
- Tombol aksi wajib memakai warna semantik yang tegas dari theme sesuai dampaknya: aksi utama memakai merah brand SITOU; hapus, batalkan proses, dan tindakan destruktif memakai danger merah; lihat, informasi, atau periksa ulang memakai info biru; unduh memakai token aksi sesuai jenisnya; pulihkan atau konfirmasi berhasil memakai success hijau; karantina dan tindakan yang memerlukan kewaspadaan memakai warning amber. Tombol sekunder netral dan tombol `Batal` yang hanya menutup dialog tanpa mengubah data tetap boleh netral. Dilarang memakai tint pucat pada tombol aksi utama atau destruktif; state disabled dikecualikan.
- Warna aksi unduhan dan backup memakai `theme.action` / `ACTION_TONES`: detail biru, paket lengkap teal, ZIP database biru, ZIP seluruh file ungu, verifikasi hijau, dan hapus merah danger. Unduhan tidak memakai merah; merah brand tetap boleh untuk pembuatan data. Tombol AntD memakai `data-action-tone` dengan nilai `detail|download|database|files|verify|danger` agar hover dan fokus konsisten. Label/ikon tetap wajib; jangan mengandalkan warna saja.
- Informasi dan peringatan panjang memakai teks rata kiri-kanan dengan baris terakhir rata kiri, pembungkusan aman, ikon di awal, serta jarak yang cukup pada mobile.
- Ikon aksi wajib sesuai objek dan tindakan: database memakai ikon database, kumpulan file memakai folder/file, paket lengkap memakai unduhan/arsip, detail memakai mata, verifikasi memakai perisai/centang, dan hapus memakai tempat sampah. Jangan memakai ikon unduh generik yang sama untuk database dan kumpulan file. Ikon tetap disertai label atau tooltip serta aria-label yang jelas.
- Jarak aman wajib memakai skala 8/12/16/24/32px: minimal 12px antar tombol, 16px antar field atau fakta berbeda, dan 24px antar section serta antara informasi dan kelompok aksi. Pasangan label-nilai boleh 8px. Kartu mobile memakai padding minimal 16px, metadata berlabel, pemisah sebelum aksi, dan tombol lebar penuh bila aksi bertumpuk. Jangan merapatkan komponen untuk menghindari scroll; pastikan fokus keyboard tidak terpotong dan target sentuh minimal 44px. Header serta isi kolom Aksi harus rata tengah terhadap lebar sel yang sama, termasuk kelompok tombol.
- Ikon dan teks di dalam tombol wajib disusun `inline-flex`, rata tengah secara horizontal dan vertikal, mempunyai baseline visual yang sejajar, serta jarak yang konsisten. Ikon tidak boleh membuat teks bergeser ke atas atau bawah; verifikasi juga pada state loading, disabled, tombol lebar penuh, dan viewport mobile.
- Desktop: sidebar; mobile: drawer/bottom navigation dan tabel kompleks menjadi card list.
- Shell halaman terproteksi wajib memakai `app/components/navbar/LeftNavBar.jsx` sebagai sidebar permanen pada desktop (`lg` ke atas), `app/components/navbar/MobileLeftNavBar.jsx` sebagai drawer pada tablet/mobile (`lg` ke bawah), dan `app/components/navbar/TopMenu.jsx` sebagai topbar bersama. Keduanya wajib memakai sumber menu dan renderer sidebar yang sama agar hak akses, status aktif, dan tampilan tidak berbeda antar-device.
- Tombol notifikasi di `TopMenu` tetap ditampilkan sebagai placeholder sampai modul notifikasi SITOU dikembangkan, tetapi dilarang menambahkan polling, request API, badge jumlah, popover data, atau event notifikasi lama. SITOU tidak memakai tombol pengganti tema light/dark.
- Tombol akun TopMenu memakai avatar privat, nama depan dan belakang dari identitas lengkap (abaikan nama tengah), serta jabatan dari penempatan utama; fallback akun tanpa profil memakai username dan role. Pop-up tetap Profil/Keluar. Sidebar menampilkan organisasi dan lokasi penempatan sendiri; kartu masa akses di bawah sidebar/drawer menampilkan tanggal/status/sisa hari server dan Perpanjang akses dengan notifikasi Coming soon. Jangan mengubah lifecycle logout atau guard navigasi. Route /profile tetap memakai identitas terpusat.
- Responsive wajib diuji untuk desktop lebar, laptop, tablet, mobile besar, dan mobile kecil. Gunakan breakpoint yang stabil, hindari ukuran tetap yang membuat form/tabel terpotong, dan pastikan setiap halaman nyaman pada lebar 320px sampai desktop wide.
- Untuk setiap UI baru atau perubahan layout, verifikasi minimal pada viewport mobile 320/375px, tablet 768px, laptop 1024/1366px, dan desktop lebar. Pastikan tidak ada overflow horizontal, overlap, teks terpotong, atau tindakan utama yang sulit dijangkau.
- Asset logo resmi navbar memakai `public/logo-sitou-v2-transparent.png` dan teks HTML **SITOU** berwarna brand. Navbar desktop maupun mobile tidak menampilkan kepanjangan SITOU atau teks “by Perumda Pasar Manado”; aset raster lama dengan kepanjangan terdahulu tidak digunakan pada UI.
- Halaman login adalah entry awal aplikasi. Jangan menampilkan pilihan demo role; setelah login, server/client mengarahkan user berdasarkan role aktif.
- Form login SITOU hanya meminta username dan password. `users` khusus menyimpan kredensial dan metadata keamanan; nama, email, serta WhatsApp dilarang diduplikasi ke tabel atau form akun. Identitas organisasi berasal dari profil pegawai, identitas Superadmin berasal dari `platform_user_profiles`, dan akun tanpa profil memakai username sebagai fallback. Tautan lupa password tetap dipertahankan sampai OTP WhatsApp terverifikasi dikembangkan.
- Login, perpindahan menu/halaman, pengambilan data halaman, dan seluruh proses CRUD wajib memakai reusable Backdrop.jsx melalui LoadingBackdropProvider. Backdrop dibuka tepat sebelum proses dimulai dan ditutup hanya setelah promise proses selesai; dilarang menambahkan delay atau durasi minimum buatan.
- Navigasi wajib memakai lifecycle navigasi provider: loading dimulai sebelum router push/replace dan baru dilepas setelah route tujuan terpasang. Bila halaman tujuan mengambil data, proses pengambilan data memiliki token loading sendiri sehingga backdrop tetap tampil sampai data selesai dimuat.
- Proses paralel wajib memakai token/counter provider agar satu proses yang selesai tidak menutup backdrop milik proses lain. Gunakan loading lokal seperti skeleton, spinner tombol, atau loading select hanya untuk proses nonblocking yang terbatas pada komponen tersebut.
- Status berhasil atau gagal pada login, navigasi yang memerlukan feedback, dan CRUD wajib memakai reusable `app/components/Notifications/Notification.jsx`. Periksa komponen loading dan notifikasi yang ada sebelum membuat komponen baru.
- Status tidak hanya disampaikan dengan warna; tambahkan label/ikon.
- List umum memasking data sensitif.
- Pimpinan melihat ringkasan dan histori, bukan tombol edit.
- Form panjang memakai stepper, draft server yang aman, dan peringatan perubahan belum disimpan.
- Seluruh area pemilihan/upload Excel, PDF, gambar, dan dokumen wajib menyusun reusable `app/components/forms/FileUploadField.jsx`; jangan membuat dropzone atau daftar file terpilih sendiri pada halaman fitur.
- Wizard tambah pegawai memakai draft server privat selama tujuh hari. Maksimal satu draft aktif per actor dan organisasi; draft hanya ditulis saat pengguna menekan Lanjut, Kembali, Simpan draft & tutup, atau finalisasi, memakai optimistic concurrency, dan tidak boleh menyimpan NIK/payload ke log. Perubahan field dilarang mengirim request autosave per ketikan. Close harus menunggu penyimpanan terakhir berhasil.
- Schema checkpoint draft wajib menerima nilai parsial dari step yang belum diselesaikan dan tetap menolak key asing atau payload berlebihan. Kelengkapan field wajib divalidasi pada navigasi step dan diulang dengan schema final saat submit; kegagalan API wajib dipetakan kembali ke field/step terkait tanpa menghapus isian pengguna.
- Pada onboarding pegawai, upload KTP dan pas foto bersifat opsional serta ditempatkan berdekatan dengan field NIK. KTP dicatat sebagai `employee_documents.document_type='ktp'`, sedangkan pas foto direferensikan oleh `employees.profile_photo_file_id`. Kelola Profil Lengkap menyediakan pas foto sebagai pilihan pada dropdown Identitas administratif; pilihan ini hanya menampilkan upload gambar dan tidak dicatat sebagai nomor identitas. Saat jenis identitas diubah, seluruh nilai dan file khusus jenis sebelumnya wajib direset agar tidak terbawa ke jenis baru. Kontrak aktif wajib memiliki nomor kontrak dan PDF privat kategori `contract`. Penempatan baru melalui lifecycle resmi tetap meminta nomor SK dan PDF privat kategori `assignment_decree`; onboarding dan koreksi salah input boleh menyimpan keduanya sebagai data opsional. Pelepasan referensi dokumen pada koreksi harus eksplisit dan diaudit, sedangkan file histori tetap mengikuti retention; browser hanya menerima file ID.
- Kelola Profil Lengkap harus memuat dan menampilkan data profil yang telah tersimpan untuk diedit, sementara section tanpa data tetap kosong. Checkbox yang berkaitan dengan satu input ditempatkan berurutan tepat di bawah input tersebut; pilihan tingkat keahlian memakai dropdown istilah Bahasa Indonesia yang baku.
- File draft memakai staging `org_{organizationId}/pegawai/drafts/draft_{draftId}/...`, hanya dapat diakses pembuat draft, lalu dialihkan ke kepemilikan pegawai saat finalisasi.
- Petunjuk import yang tampil di workbook, modal, dan dokumentasi wajib memakai satu definisi terpusat. Setiap sheet harus diberi label Wajib, Wajib bersyarat, atau Opsional beserta fungsi, kapan diisi, dan aturan penting dengan Bahasa Indonesia yang mudah dipahami.
- Sediakan loading, skeleton, empty, no-result, validation error, server error, permission denied, session expired, dan confirmation dialog.
- Tindakan disiplin ditampilkan profesional tanpa mempermalukan pegawai.

## 22. Observability dan operasional

- Gunakan structured logging dengan `request_id`, `organization_id`, `actor_user_id`, dan nama use case; jangan log payload sensitif.
- Ukur latency API p50/p95/p99, error rate, queue lag, koneksi DB, slow query, import duration, dan recalculation duration.
- Alert untuk partisi bulan depan belum ada, default partition bertambah, outbox macet, storage gagal, atau backup gagal.
- Health check tidak menjalankan query berat.

## 23. Definition of Done

Pekerjaan selesai hanya jika:

1. Kebutuhan dan permission jelas.
2. Migration/schema, code, dan dokumentasi konsisten.
3. Isolasi organisasi diterapkan.
4. Validasi frontend dan backend tersedia.
5. Audit dan error handling sesuai risiko.
6. Test relevan lulus.
7. Query baru memiliki index/query plan yang masuk akal.
8. Tidak ada rahasia atau data pribadi dalam repo/log.
9. UI responsive dan state penting diuji.
10. Perubahan tidak merusak kontrak mobile/API tanpa versioning.
11. Laporan akhir menjelaskan rincian penambahan, perubahan, koreksi, serta hasil pemeriksaan sesuai aturan berikut.

### Laporan akhir setelah perubahan

- Setiap selesai mengerjakan perubahan, wajib berikan penjelasan yang cukup rinci agar pemilik proyek memahami hasilnya tanpa membaca kode atau update proses sebelumnya. Jangan hanya memberi daftar singkat seperti “sudah diperbaiki” atau menyebut nama fitur tanpa menjelaskan perubahannya.
- Jelaskan bagian/menu yang dikerjakan, apa yang ditambahkan, diubah, dihapus, atau dikoreksi, serta alasan dan dampaknya pada penggunaan aplikasi. Untuk perbaikan bug, jelaskan penyebab yang sudah terverifikasi dan bagaimana perbaikan mengatasi masalah tersebut; bedakan temuan pasti dari dugaan.
- Uraikan perubahan alur, tampilan, validasi, hak akses, cakupan data, API, database/migration, atau komponen reusable yang memang terdampak. Kelompokkan berdasarkan fitur agar mudah diikuti; tidak perlu menjelaskan kategori yang tidak berkaitan dengan pekerjaan.
- Sebutkan pemeriksaan yang benar-benar dijalankan, skenario penting yang diuji, dan hasilnya. Jika ada pengujian yang belum dijalankan atau gagal, jelaskan secara jujur; jangan menyatakan seluruh pengujian berhasil tanpa bukti.
- Jelaskan batasan, pekerjaan yang belum selesai, dan langkah yang masih diperlukan pengguna jika memang ada, termasuk status penerapan migration atau kebutuhan restart. Jika membuat file pengujian sementara, laporkan status pembersihannya secara sesuai fakta.
- Gunakan Bahasa Indonesia yang sederhana, jelas, dan konkret. Detail harus sebanding dengan cakupan perubahan: gunakan judul dan poin yang terstruktur untuk pekerjaan besar, hindari pengulangan, istilah teknis tanpa penjelasan, serta daftar file/kode panjang yang tidak membantu pengguna memahami hasil.

## 24. Larangan untuk Codex/developer

- Jangan menghapus histori pegawai untuk “merapikan” data.
- Jangan menambahkan kolom `current_division`/`current_location` sebagai sumber kebenaran kedua.
- Jangan menghubungkan tabel lintas organisasi hanya dengan ID tanpa memeriksa organisasi.
- Jangan menjadikan setiap checkout lewat jam sebagai lembur otomatis.
- Jangan membuat sanksi otomatis dari indikator.
- Jangan mengizinkan pimpinan menyetujui izin bila aturan produk masih HRD-only.
- Jangan menyimpan foto/dokumen sebagai URL publik atau base64 di tabel transaksi.
- Jangan memanggil database langsung dari mobile.
- Jangan menjalankan export besar pada request web sinkron.
- Jangan menonaktifkan constraint/index demi melewati bug tanpa analisis dan migration resmi.

## 25. Fondasi reusable dan standar visual SITOU

- Section filter operasional wajib memakai `OperationalFilterSection`: maksimal empat field per baris pada desktop (>=1200px), tiga pada tablet lebar (900-1199px), dua pada 600-899px, dan satu pada mobile (<600px). Field berikutnya mengalir ke baris baru; dilarang memadatkan lima atau lebih field dalam satu baris desktop. Gunakan padding dan jarak komponen terpusat, bukan override halaman.

- Katalog komponen berada di `app/components/README.md` dan wajib diperbarui setiap reusable component dibuat, dipindah, atau diubah kontraknya.
- Seluruh logo SITOU wajib memakai `app/components/branding/AppLogo.jsx`. Path aset hanya diubah melalui `APP_LOGO_ASSETS`; dilarang menulis path file logo langsung pada halaman atau komponen lain.
- Sebelum membuat komponen baru, cari fungsi yang sama di `app/components`. Jika sudah ada, perluas komponen tersebut dalam tanggung jawab yang sama; dilarang membuat duplikat.
- Reusable component diberi nama berdasarkan fungsi umum dan disimpan berdasarkan tanggung jawab, bukan berdasarkan nama menu pertama yang menggunakannya.
- Hanya ada satu modal shell umum, yaitu `app/components/modals/AppModal.jsx`. Modal khusus, preview, dan confirmation wajib menyusun `AppModal`.
- Komponen hanya boleh dihapus setelah seluruh import, pemanggilan dinamis, route, dan dokumentasi diperiksa.
- Form CRUD memakai dirty-state warning, validasi dekat field, mencegah submit ganda, dan menjelaskan dampak aksi berisiko.
- Form panjang yang memakai tab, step, atau collapse wajib menampilkan `Notification` pada setiap kegagalan validasi/simpan, menandai section bermasalah dengan state error yang jelas, membuka section tersebut, lalu menggulir dan memfokuskan field error pertama. Error tidak boleh hanya terlihat pada field yang sedang tertutup atau gagal diam-diam; penanda section harus hilang setelah isian terkait valid.
- Gunakan `PageHeader`, `DataToolbar`, `ResponsiveDataView`, `CompactInfoChip`, `RowActionMenu`, `ConfirmDialog`, select reusable, `Notification`, dan `LoadingBackdrop` sebelum membuat implementasi fitur sendiri. `CompactInfoChip` adalah satu-satunya chip untuk metadata dan status; dilarang membuat badge/chip reusable kedua dengan fungsi yang sama.
- Panel informasi yang menetap pada halaman, form, dan modal wajib memakai `app/components/data-display/AppNotice.jsx`, termasuk penjelasan izin. Gunakan `tone="info"` (biru), `warning` (kuning), `success` (hijau), atau `danger` (merah) sesuai makna; judul dan langkah berikutnya harus jelas. Isi paragraf `AppNotice` mengikuti aturan justify secara default; jika pesan utama memang perlu rata tengah, gunakan override `descriptionAlign="center"` secara eksplisit. Jangan menerapkan justify pada judul atau tombol. Jangan membuat kotak informasi ad hoc atau mencampur `Alert` Ant Design/MUI untuk fungsi ini. `Notification` tetap khusus pesan sementara dan validasi. Fitur yang nonaktif harus menyebut organisasi terdampak, pihak yang dapat mengaktifkan, dan lokasi pengaturannya bila tersedia.
- Breadcrumb halaman wajib bersumber dari konfigurasi menu melalui `AppBreadcrumbs`. Parent tanpa path tampil sebagai konteks nonklik, sedangkan route turunan mengikuti menu terdekat yang paling spesifik.
- Area daftar operasional wajib memeriksa dan memakai reusable `DataPanel` sebelum membuat wrapper baru. Toolbar embedded, tabel/card list, dan pagination berada dalam satu paper tanpa nested panel.
- Setiap pembuatan atau perubahan UI/UX wajib diperiksa kerapian alignment, baseline, hierarchy, lebar control, spacing, dan konsistensi antarhalaman yang memakai alur serta komponen sama. Breadcrumb, judul, deskripsi, toolbar, tabel, dan aksi tidak boleh tampak bergeser, berdempetan, terlalu melebar, atau berbeda struktur tanpa alasan produk yang jelas.
- Halaman detail wajib mempunyai hierarchy identitas, status, navigasi, section informasi, dan aksi yang jelas. Kelompokkan informasi berdasarkan kebutuhan pengguna, bukan mengikuti urutan kolom database atau menampilkan kumpulan label-nilai datar tanpa struktur.
- Navigasi tab detail wajib memeriksa dan memakai `navigation/DetailTabs` sebelum membuat shell baru. Active state harus jelas, target sentuh minimal 44px, dapat dioperasikan dengan keyboard, dapat dipertahankan melalui URL bila relevan, dan tidak menyebabkan horizontal page overflow pada mobile.
- Ringkasan halaman detail wajib menyajikan setiap fakta satu kali; dilarang mengulang nomor, status, identitas, atau metadata yang sama pada beberapa section. Gabungkan profil dan identitas yang berasal dari sumber data yang sama, tampilkan bukti visual penting dekat konteksnya, dan pindahkan informasi administratif khusus ke tab tersendiri bila membuat ringkasan sulit dipindai.
- Ringkasan pegawai wajib memprioritaskan data inti saat pembuatan pegawai, kontak, penempatan aktif, hubungan kerja, keluarga, kontak darurat, dan akun sosial. Pas foto serta KTP ditampilkan sebagai visual privat yang dapat diperbesar, sedangkan BPJS ditempatkan pada tab Jaminan agar hierarchy informasi tetap jelas.
- Aksi utama detail ditempatkan konsisten di kanan header section pada desktop dan menjadi mudah dijangkau atau lebar penuh pada mobile. Aksi tidak boleh bercampur di antara nilai data atau menggeser hierarchy informasi.
- Enum dan status backend yang dibaca pengguna wajib diterjemahkan ke Bahasa Indonesia. Data kosong memakai kalimat kontekstual seperti `Belum ditempatkan` atau `Belum diunggah`, bukan kode mentah atau tanda hubung yang ambigu.
- Tab Dokumen pada detail pegawai hanya menjadi checklist kelengkapan tanpa upload, nama file, atau aksi file. Status tersedia wajib berasal dari record domain yang masih mereferensikan metadata file aktif; file yatim atau metadata yang sudah dilepas tidak boleh membuat dokumen terlihat tersedia. Pengelolaan dan satu-satunya aksi buka dokumen berada pada konteks domainnya: identitas di Profil Lengkap, kontrak di tab Kontrak, SK di tab Penempatan, serta ijazah/sertifikat di tab Pendidikan.
- Header detail pegawai hanya memakai pas foto pegawai atau avatar inisial sebagai fallback; logo aplikasi dilarang dipakai sebagai pengganti pas foto.
- Sidebar desktop harus tetap setinggi viewport dan memiliki scroll navigasi internal sendiri ketika menu atau konten halaman memanjang.
- Perubahan halaman detail wajib diuji untuk kemudahan pemindaian informasi, alignment, jarak aman, nama/teks panjang, data kosong, seluruh role, keyboard, zoom, dan viewport 320-1920px. Section harus informatif tanpa nested card berlebihan.
- Setiap fungsi exported, resolver, transformasi data, lifecycle async, serta baris penting atau non-obvious wajib memiliki komentar singkat tentang tujuan atau alasan implementasinya. Komentar dilarang sekadar mengulang sintaks yang sudah jelas.
- AntD Table digunakan pada tablet/desktop. Mobile memakai card list dari data yang sama beserta loading, empty/error, dan pagination yang dapat dijangkau.
- Seluruh daftar/tabel yang berpaginasi wajib memakai `app/components/data-display/DataPagination.jsx` pada desktop dan mobile, termasuk laporan dan ledger cursor. Footer konsisten menampilkan total hasil filter, Sebelumnya/Berikutnya, dan pilihan 10/20/50 baris per halaman bila ukuran halaman didukung API; daftar berukuran tetap tidak menampilkan pemilih yang tidak berfungsi. Jangan mengandalkan pagination bawaan AntD atau membuat footer duplikat pada fitur baru.
- `AppModal` harus mendukung ukuran `sm`, `md`, `lg`, `xl` atau custom width, header/footer tetap, konten scrollable, focus management, Escape/backdrop policy, form submit, dan hampir full-screen pada mobile.
- `ImagePreviewModal` hanya menerima URL endpoint privat, blob, atau file lokal; jangan pernah mengirim `object_key` ke browser.
- Seluruh aksi melihat gambar, termasuk pas foto, KTP, Kartu Keluarga, BPJS, NPWP, ijazah, sertifikasi, serta gambar fitur berikutnya, wajib memakai reusable `app/components/modals/ImagePreviewModal.jsx`. Dilarang membuka gambar langsung melalui tab browser, `window.open`, modal baru, atau preview shell khusus fitur; dokumen non-gambar tetap mengikuti viewer/unduh berizin sesuai jenis file.
- Identitas dan status administratif organisasi disimpan pada `organizations`; masa akses tidak boleh disimpan kembali sebagai kolom tanggal pada tabel tersebut.
- Histori masa akses organisasi bersumber dari `organization_subscriptions` dengan `starts_on`, `ends_on`, `grace_ends_on`, dan status lifecycle. Perpanjangan selalu membuat record baru, tidak boleh menimpa histori, dan periode efektif tidak boleh overlap.
- Session organisasi selalu divalidasi ulang terhadap `users.is_active`, role aktif, `organizations.is_active`, dan status langganan efektif `active` atau `grace`. Login Admin/HRD tidak diblokir oleh lokasi scope selama organisasi dan langganan aktif; scope hanya membatasi data yang dapat dikelola. Pimpinan yang memiliki `user_location_scopes` wajib masih mempunyai lokasi efektif. Pegawai wajib memiliki profil `employees` aktif, penempatan utama efektif, lokasi administratif/operasional aktif, dan `organization_units` aktif. Status langganan tetap dihitung dari tanggal dan timezone organisasi walaupun job rekonsiliasi terlambat.
- Penolakan login wajib memakai kode stabil dan pesan spesifik: masalah akun/profil/penempatan/lokasi/divisi mengarahkan pengguna ke Admin organisasi, sedangkan organisasi nonaktif atau masa berlaku tidak efektif mengarahkan pengguna ke Admin SITOU.
- Umur operasional lokasi memakai `operational_from` dan `operational_until`; nama `active_from`/`active_until` tidak digunakan pada `locations`.
- Peringatan maksimal 30 hari dan masa tenggang tampil di shell dengan tombol `Perpanjang`.
- UI harus modern, sederhana, elegan, profesional, user friendly, dan mudah dipahami pengguna nonteknis. Kreativitas diterapkan melalui hierarchy, komposisi, iconography, spacing, microinteraction, dan state, bukan dekorasi berlebihan.
- Ikon navigasi dan aksi akun di topbar (notifikasi, Profil, Keluar) wajib memakai Iconify offline melalui `AppIcon` (`@iconify/react/dist/offline`) dengan ID semantik dan data SVG lokal yang dibundel dari `navigationIconSources.mjs`; jangan memakai nama ikon Iconify yang diunduh dari API saat runtime, URL eksternal, atau font ikon CDN. Untuk mengganti ikon, ubah hanya nama Iconify di sebelah kanan ID semantik pada file tersebut. `npm run dev` membuat data SVG lokal saat mulai dan memperbaruinya otomatis ketika sumber diubah; `npm run build` membuat ulang sebelum kompilasi; `npm run icons:check` memeriksa kesesuaian tanpa mengubah file untuk CI/review. Nama ikon salah wajib gagal dengan pesan jelas tanpa menimpa data lama. Seluruh ikon sudah tersedia sejak HTML awal dan tetap tampil ketika klien tidak terhubung ke internet. Seluruh ikon menu dan aksi akun topbar memakai Solar bold-duotone (two-tone terisi) yang sesuai objek/menu. Ikon Dashboard utama boleh beranimasi skala halus secara terus-menerus sebagai pengecualian, berhenti saat hover/fokus, dan wajib menjadi statis untuk `prefers-reduced-motion`; ikon menu lain tidak beranimasi. Ikon lama di luar navigasi dan aksi akun topbar boleh dipertahankan sampai dimigrasikan; jangan menambah ikon navigasi atau aksi akun topbar AntD/MUI baru.
- Merah SITOU hanya menjadi aksen, primary action, active state, dan status penting. Permukaan utama memakai putih/abu netral dan teks gelap dari theme/token.
- Kontras teks normal minimal 4.5:1; teks besar, ikon penting, border interaktif, dan focus indicator minimal 3:1. Status selalu memakai label/ikon selain warna.
- Gunakan spacing scale `4, 8, 12, 16, 24, 32px`: ikon-teks 8-12px, antar-control 8-12px, antar-field 16-20px, panel/modal 16px mobile dan 20-24px desktop, halaman 16/24/32px, serta antar-section 24-32px.
- Target sentuh minimal 44x44px. Radius maksimal 8px kecuali avatar, status pill, dan elemen lingkaran. Shadow harus lembut dan tidak mendominasi.
- Teks harus terbaca, tidak bertumpuk dengan background/ikon, dan memakai wrap, ellipsis, atau tooltip sesuai konteks. Komponen tidak boleh berdempetan, overlap, keluar container, atau membuat horizontal page overflow.
- Kartu mobile wajib memakai track grid yang dapat menyusut (`minmax(0, 1fr)`) dan `min-width: 0` pada item flex/grid. Nama dan metadata panjang harus tetap terbaca tanpa mendorong tombol aksi keluar kartu. Uji batas elemen di dalam kartu dengan teks panjang termasuk tanpa spasi; sekadar menyembunyikan overflow halaman bukan perbaikan.
- UI wajib diuji pada viewport 320, 375, 768, 1024, 1366, dan 1920px, browser zoom, keyboard navigation, focus order, overflow, overlap, kontras, serta safe area/keyboard mobile.
- Dilarang memakai orb, bokeh, gradient dekoratif, nested card, shadow tebal, radius berlebihan, palette satu nada, padding ekstrem, atau dekorasi yang mengurangi keterbacaan.
- Dashboard visual wajib memakai komponen reusable pada `app/components/dashboard` dan adapter ApexCharts terpusat. Dilarang mendefinisikan ulang konfigurasi theme, format tooltip Indonesia, responsive breakpoint, atau reduced motion pada setiap halaman.
- Grafik dashboard harus menjawab kebutuhan monitoring atau pengambilan keputusan, bukan menjadi dekorasi. Setiap grafik wajib memiliki judul, konteks, legend bila multi-seri, tooltip Bahasa Indonesia, tinggi stabil, serta state loading, kosong, dan error.
- Wadah scroll internal pada kartu, panel grafik, dan daftar ringkas wajib menyembunyikan scrollbar melalui CSS lokal (`scrollbar-width: none` dan `::-webkit-scrollbar`), tanpa menonaktifkan scroll mouse, trackpad, sentuhan, atau keyboard. Pertahankan batas tinggi, nama aksesibel, serta indikator fokus untuk wadah yang menerima fokus. Jangan memakai `overflow: hidden` untuk memotong data atau menyembunyikan scrollbar halaman utama secara global. Terapkan aturan pada komponen reusable agar seluruh pemakainya konsisten.
- Dashboard tidak memakai filter tanggal global. Enam indikator organisasi menampilkan kondisi saat ini dan tidak menjadi tautan; semua memakai hover halus yang menghormati reduced motion. Tren pegawai dan kontrak memakai 12 bulan kalender termasuk bulan berjalan hingga hari ini, sesuai timezone organisasi. Kontrak segera berakhir tetap 30 hari ke depan; proyeksi pensiun tetap 12 bulan ke depan.
- Dashboard tidak boleh terasa polos ataupun berlebihan. Kekayaan visual dibangun dari hierarchy, komposisi grid, iconography, status tint, microtrend, dan spacing; hindari gradient dekoratif, animasi terus-menerus selain pengecualian ikon Dashboard utama di sidebar, data label yang ramai, dan kartu bertingkat.
- Dataset dashboard wajib difilter berdasarkan role, organisasi, dan cakupan lokasi di backend. Data draft atau sensitif yang tidak berhak dilihat role dilarang dikirim ke browser hanya untuk disembunyikan di UI.
- Query agregasi dashboard wajib dikelompokkan tanpa N+1, memakai parameter SQL, cache singkat bila sesuai, dan diuji pada dataset representatif sebelum optimasi melalui index atau materialized view.
- Komposisi jenis kelamin, status pegawai, masa kerja, jenis kepegawaian, lokasi, dan unit adalah snapshot kondisi saat ini tanpa filter tanggal. Kasus disiplin resmi dan aktivitas terbaru maksimal lima item tanpa batas rentang tanggal; prioritas maksimal lima item terpenting. Seluruh data tetap mengikuti role, organisasi, serta cakupan lokasi actor di backend.
- Grafik dinamika pegawai tidak boleh mengulang snapshot status aktif. Gunakan arus pegawai baru dan pegawai keluar per periode, sedangkan kondisi aktif, masa percobaan, dan cuti tetap berada pada visual Status Pegawai.
- Dataset Dashboard dengan kewenangan yang sama ditampilkan konsisten untuk HRD dan Pimpinan. HRD terbatas hanya menerima domain/submenu yang diberikan; organisasi, cakupan lokasi, draft dan data sensitif tetap diperiksa di backend.
- Adapter ApexCharts wajib menormalkan kategori kosong dan nilai nonnumerik sebelum render. Label `NaN`, `undefined`, atau sumbu kategori kosong dilarang tampil kepada pengguna.
- Item prioritas disiplin wajib menavigasi ke detail pegawai pada tab Disiplin melalui LoadingBackdrop dan mempertahankan scope organisasi Superadmin. Chip prioritas ditempatkan dekat nama data dengan jarak aman, sedangkan aksi detail memakai ikon mata, tooltip, dan aria-label yang jelas. Data tindakan draft tetap tidak boleh dikirim kepada Pimpinan.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 26. Inventaris, paket akses, dan cakupan gudang

- Role dasar per membership organisasi tetap berlaku. Paket adalah kumpulan permission fitur, bukan role baru atau paket langganan. Inventaris tidak memberikan akses HRD, platform, atau self-service milik orang lain.
- Aktivasi modul organisasi terpisah dari grant akun; default nonaktif dan tanpa paket otomatis. Modul nonaktif memblokir operasi tanpa menghapus grant/gudang; pengaktifan kembali memulihkan grant yang masih berlaku.
- Permission dan scope diperiksa dari grant yang sama. Dilarang membuat union semua permission dikalikan semua gudang. Scope selected kosong selalu ditolak; all harus eksplisit dan mencakup gudang baru. Penempatan pegawai tidak otomatis memberi atau mengubah scope paket.
- Superadmin mengaktifkan modul dan memberi paket pada akun organisasi secara eksplisit serta diaudit. HRD yang memiliki permission delegasi tetap mengelola akun Pegawai sesuai service akun saat ini, hanya pada organisasi/profil/lokasi yang berizin; selected HRD tidak dapat memberi all atau scope di luar lokasi. Paket sendiri tidak memberi permission delegasi.
- HRD tidak boleh meningkatkan akses sendiri atau mengubah grant lama di luar kewenangannya. Grant yang tidak diubah dapat dipertahankan ketika field akun lain dikoreksi. Akun/profil/membership dan paket disimpan atomik dengan version check; perubahan/pencabutan diaudit dan berlaku pada request berikutnya.
- Sidebar, page, API, daftar, laporan, export, dan file harus memakai pemeriksaan permission/scope server yang sama. Token/browser hanya identitas atau tampilan, bukan sumber hak akses. Jangan melemahkan izin HRIS lama untuk membuka Inventaris.
- Data Master memuat Barang Persediaan, Kategori Barang, Satuan Barang, dan Gudang sebagai halaman terpisah berizin Inventaris. Inventaris hanya memuat Stok Barang dan Transaksi Barang; Laporan memuat Distribusi Barang sesuai permission fitur. Parent tampil bila ada submenu berizin; Pegawai tidak memperoleh akses master/laporan HRIS. Kartu Stok kelak berada di detail barang per gudang pada Stok Barang; pencatatan masuk/keluar memakai use case bersama.
- Tahap 1–2 menyediakan akses, gudang, katalog Barang/Kategori/Satuan, foto privat opsional, dan batas minimum barang-gudang. Halaman stok/transaksi/distribusi disediakan sesuai tahap masing-masing. Dashboard Pegawai mengikuti ketentuan ringkasan pribadi di bawah. Jangan membangun ledger, stok awal, transaksi, request/approval, atau aset pada tahap penataan navigasi ini.
- Katalog barang/kategori/satuan dan metadata gudang digunakan bersama organisasi. Hanya Superadmin atau Pengelola Master Inventaris boleh menambah/edit/nonaktifkan master dan membuat gudang. Pengelola Gudang (all maupun selected) tidak membuka halaman master atau mengubah metadata master. Pengaturan barang/minimum serta operasional stok memakai permission dan scope grant gudang asalnya. Batas minimum bukan saldo stok.
- Foto barang memakai stored_files kategori inventory_item_photo dan folder privat org_{organizationId}/inventaris/foto_barang/{tahun}/{UUID}.{ext}; MIME nyata JPEG/PNG/WebP maksimal 5 MB, scan/hash serta pipeline temp/atomic move yang sama. Simpan hanya saat form barang berhasil, bersihkan byte baru pada rollback, dan antrekan purge foto yang diganti/dilepas secara transaksional. Registry pemeliharaan/backup wajib melindungi foto barang yang masih dirujuk, termasuk barang nonaktif. API foto memeriksa akses Inventaris serta referensi nyata tanpa memberikan permission HRIS generik.
- Master persediaan canonical memakai /master-data/inventory-items|inventory-categories|inventory-units|inventory-warehouses; Distribusi Barang memakai /reports/inventory-distribution. Route lama /inventory/catalog dan /inventory/master-data diarahkan menurut tab, default Barang Persediaan; /inventory/reports diarahkan ke Distribusi Barang. Pertahankan organisasi valid dan pemeriksaan server. Tombol tambah di PageHeader, pemilih organisasi Superadmin di toolbar filter; wajib satu organisasi sebelum membaca/membuat. Gunakan ikon semantik lokal, reusable tabel/kartu/modal, pagination+total. Referensi tidak dihapus fisik; perubahan diaudit dan memakai version. Aturan pecahan/satuan dasar terkunci setelah dipakai.
- Gudang memiliki organisasi/lokasi, kode uppercase unik, status dan versi. Gudang berreferensi tidak dihapus fisik; lokasi terkunci setelah direferensikan paket. Gudang nonaktif tetap dapat dibaca/dipulihkan oleh pengelola berizin tetapi tidak dipilih untuk grant baru atau transaksi stok nanti.
- Kartu stok nantinya menunjukkan masuk/keluar/saldo satu barang-gudang. Distribusi Barang merangkum penyaluran lintas transaksi dan tidak membuktikan sisa stok penerima. Permintaan tetap manual; request, approval, dan pemenuhan kelak memiliki permission terpisah tanpa posting stok dua kali.

### Arahan prasyarat fitur

- Field/alur yang membutuhkan data lain wajib menjelaskan apa yang diperlukan, menu tempat membuatnya, dan langkah singkat sesuai hak akses pengguna. Gunakan 1–2 kalimat sederhana, dekat field, dengan `FontStyle explanation`; jangan hanya mengandalkan dropdown kosong.
- Tampilkan arahan setelah referensi berhasil dimuat. Bedakan data belum tersedia, nonaktif, hasil pencarian kosong, keterbatasan cakupan, dan kegagalan pemuatan. Jangan menyimpulkan seluruh organisasi kosong dari daftar scope pengguna.
- Tautan prasyarat hanya bagi pengguna berizin, mempertahankan organisasi dan memakai lifecycle loading serta dirty-state warning. Pengguna tanpa izin diarahkan meminta pihak berwenang; field wajib tetap divalidasi. Tidak membuat form bertingkat untuk prasyarat.

### Satuan tanpa kode input dan chip master persediaan

Satuan Barang tidak meminta atau menampilkan kode. API menerima kode opsional untuk
kompatibilitas klien lama; create tanpa kode membuat kode internal UUID di server,
edit tanpa kode mempertahankan nilai lama. Tidak ada perubahan schema atau backfill.
Nama satuan wajib dan unik per organisasi; konflik ditampilkan pada field nama.
Kode barang/kategori/gudang tampil sebagai CompactInfoChip tone info di bawah nama
pada kolom identitas yang sama dan pada kartu mobile. Kategori, satuan, aturan
pecahan, dan status memakai chip semantik yang sudah tersedia; nama dan uraian
bebas tetap teks agar penanda penting tidak tenggelam dalam terlalu banyak chip.

### Tingkat akses Inventaris

- Label akses fitur: Lihat Saja, Pengelola Gudang, Pengelola Master Inventaris. Kode inventory_reader/inventory_manager dipertahankan; kode baru inventory_master. Cakupan selected ditampilkan Pilih Gudang; master selalu organisasi (scope_mode=all, warehouseIds kosong) dan bukan akses operasional seluruh gudang.
- Lihat Saja membuka Stok Barang, Transaksi Barang, dan Distribusi Barang secara baca sesuai scope. Jangan menampilkan master Inventaris; URL langsung master wajib ditolak di server. Metadata baca katalog/gudang tetap dapat digunakan API operasional/file berizin tanpa membuka halaman master.
- Pengelola Gudang (inventory_manager) hanya operasional pada gudang all/selected. Pengelola Master Inventaris (inventory_master) hanya master bersama organisasi; tidak otomatis mempunyai akses stok/transaksi/distribusi atau pengaturan minimum. Satu akun boleh menerima ketiganya, tetap satu role dasar. Menonaktifkan data mempertahankan histori/referensi, bukan menghapus fisik.
- Form pemberian fitur wajib menjelaskan kemampuan pilihan tepat di bawah field serta batas membuat gudang di field cakupan. Role Pegawai/HRD tidak membatasi kemampuan Inventaris yang sah dan tidak memberikan izin otomatis.
- Transaksi Barang memakai `AppModal` empat tahap dengan draft privat yang terpisah dari draft Pegawai. Saat Catat transaksi dibuka, muat draft aktif terakhir milik petugas pada organisasi tersebut; jangan tampilkan area daftar draft. Pengguna dapat melanjutkan atau membuang draft aktif dan mulai ulang dari modal. Ikuti pola checkpoint form Pegawai (Lanjut, Kembali, Simpan draft & tutup, finalisasi), tanpa autosave per ketikan; tutup hanya setelah simpan berhasil. Saat pengguna memilih jenis transaksi lain, jangan langsung mengubah isian; setelah menekan Lanjut, minta konfirmasi jika sudah ada isian, lalu kosongkan isian jenis sebelumnya dan bersihkan lampiran lama pada checkpoint. Semua pilihan dropdown di wizard harus dapat dicari dengan ketikan memakai komponen pilihan bersama. Tombol footer modal dan konfirmasi tersusun satu tombol per baris, lebar penuh, dan berjarak aman pada ponsel. Draft tidak boleh dikirim sebagai bagian API ledger. Ledger terposting memakai `DataPanel` dan `DataPagination` cursor, satu Tanggal transaksi per baris, kolom Status terpisah dari jenis transaksi, ikon jenis yang ringkas, tombol detail ikon berlabel aksesibel, serta baris responsif pada ponsel. Footer menampilkan total hasil filter dan ukuran halaman yang benar dari server. Detail dan lampiran wajib memakai `AppModal`, `AppNotice`, `PrivateFileUpload`, `ImagePreviewModal` untuk gambar, serta `LoadingBackdrop` dan `Notification` sesuai aksi. Gambar pada detail terlihat langsung dalam ukuran memadai dan dapat diperbesar; PDF tampil sebagai item dokumen dengan aksi buka berizin. Jaga jarak aman minimal 24px antara area unggah dan footer modal maupun antara dua area unggah yang berurutan.
- Pilihan jenis transaksi pada wizard dan ledger memakai sumber label/ikon/warna yang sama. Pencarian riwayat berada di `OperationalFilterSection`, bukan toolbar tabel tersendiri; dropdown filternya harus bisa dicari dengan ketikan. Kolom Tanggal transaksi tetap satu baris pada desktop, dan Status berada setelah Dicatat oleh serta sebelum Aksi.

### Jarak informasi pada field

- Teks bantuan `Form.Item extra` memakai spacing terpusat: minimal 8px dari control,
  line-height 1.6, serta 4px padding bawah sebelum margin antar-field. PrerequisiteHint
  memakai gap 8px antara penjelasan dan tautan; target sentuh tetap minimal 44px.
- Panel penjelasan izin `AccessExplanation` di bawah dropdown memakai jarak visual
  minimal 16px dari control pada HRIS maupun Inventaris. Atur melalui komponen
  reusable, bukan margin khusus per submenu; bantuan teks biasa tetap mengikuti 8px.
- Jangan menempelkan teks bantuan ke border input/dropdown atau memberi margin negatif.
  Pertahankan jarak antar-field dan uji informasi panjang pada desktop/mobile.
  Gunakan token/style reusable; jangan menambah override spacing per halaman.

### Delegasi dan kompatibilitas master Inventaris

- Hak master tidak diberikan otomatis kepada akun lama. Migration 050 memindahkan hak metadata/master dari inventory_manager ke inventory_master; grant lama tetap operasional dengan scope asalnya. Berikan fitur master secara eksplisit bila diperlukan.
- Superadmin atau HRD dengan cakupan seluruh lokasi boleh mendelegasikan master kepada akun yang dapat dikelolanya. HRD lokasi terpilih tidak boleh memberi/mengubah/mencabut master organisasi; grant lama yang tidak berubah dapat dipertahankan pada edit field lain.
- Scope master tidak meminta gudang, valid walau gudang belum tersedia. Akses master tidak menjadi referensi scope operasional gudang dan tidak mengunci lokasi gudang sendirian. Kunci dari referensi operasional/histori tetap utuh.

## 27. Hak akses submenu HRIS

- Role dasar tetap satu. HRIS administratif hanya role HRD; Pegawai tidak mendapat permission HRIS organisasi. Inventaris/self-service tetap terpisah.
- Superadmin dapat menetapkan/mengalihkan paling banyak satu admin HRD penuh aktif per organisasi; organisasi boleh sementara tidak memilikinya. Admin ini selalu seluruh lokasi dan satu-satunya pemberi HRIS selain Superadmin. HRD lain dapat mengelola akun Pegawai dan fitur non-HRIS hanya jika diberi kewenangan eksplisit pada bagian 28. HRD terbatas mengikuti submenu Lihat Saja/Kelola; cakupan lokasi tetap per akun. HRD pertama tidak otomatis menjadi admin penuh.
- Katalog tertutup HRIS_MENUS menentukan hak yang tersedia. Fitur baru termasuk payroll tidak mendapat akses otomatis dari role/admin penuh. Laporan/Dashboard hanya baca; Data Pegawai termasuk identitas/rekening/dokumen dan harus dijelaskan pada form. Cuti serta akun di detail tetap berizin terpisah.
- Guard wajib pada halaman/API/file, bukan tombol saja. Context path/method selalu ditimpa Proxy; grant dibaca dari database terbaru. File kategori memisahkan identitas, foto referensi, surat sanksi dan lampiran izin.
- Migration 053 mengubah hak efektif HRD lama yang belum diatur menjadi grant eksplisit seluruh menu HRIS serta kewenangan Akun & Akses yang setara; akun yang sudah diatur tidak boleh ditimpa. Setelah migration, tidak ada fallback akses legacy: setiap akun selain admin penuh hanya mengikuti grant dan flag database. Omission mempertahankan grant, array kosong mencabut. Akun HRD baru atau baru beralih ke role HRD tanpa pilihan mulai tanpa menu. Transaksi akun/grant/admin memakai version, lock organisasi dan audit.
- Admin penuh wajib dialihkan oleh Superadmin sebelum dinonaktifkan, diturunkan role/cakupan, atau diproses akhir hubungan kerja. Guard ini disetujui pengguna; jangan mengubah perhitungan/alur inti HRIS lain tanpa keputusan baru.
- Superadmin boleh mematikan switch Admin HRD penuh atau mengubah role admin penuh menjadi Pegawai/Pimpinan tanpa pengganti. Dalam transaksi yang sama, kosongkan seluruh hak menu dan kewenangan akun HRIS milik akun lama; Inventaris dan histori tetap. `primary_membership_id=NULL` berarti belum ada admin penuh, bukan HRIS nonaktif. Penetapan admin baru ketika admin lama tetap HRD mempertahankan hak HRIS tersimpan admin lama. Perubahan admin wajib memakai versi kebijakan dan audit.
- Pembagian submenu menggunakan satu bagian Akses fitur bersama Inventaris. Tabel menampilkan satu chip fitur dan +N fitur lainnya; rincian melalui Aksi → Lihat hak akses. Dilarang menumpuk submenu, grant gudang, atau tautan rincian pada kolom Akses fitur.
- Rancangan, rollout dan kontrak API: docs/hris-access-design.md. Uji regresi akses, scope, session aktif, file privat, transfer dan guard pada database terpisah.

## 28. Penyatuan fitur dan delegasi akun Pegawai

- Satu blok per fitur HRIS/Inventaris di OrganizationAccountForm. Pilihan HRIS hanya untuk actor Superadmin/admin HRD penuh dan target HRD. Role Pegawai tidak menerima administrasi HRIS. Identitas role/admin tetap terpisah dari izin operasional.
- Dua kewenangan eksplisit: Kelola akun Pegawai (CRUD/status/profil/reset password tanpa perubahan fitur) dan Kelola akun Pegawai & akses fitur (ditambah delegasi non-HRIS). Delegator tidak wajib menggunakan Inventaris; tetap mengikuti modul aktif, organisasi dan cakupan lokasi/gudang. Tidak dapat mengelola HRD/Pimpinan/diri, memberi HRIS, atau menaikkan kewenangannya sendiri.
- Daftar dan pencarian Akun Organisasi hanya menampilkan akun selain akun yang sedang login; filter ini diterapkan di query data dan total, bukan hanya UI. Detail, edit, serta reset password akun sendiri melalui endpoint Akun Organisasi ditolak di service. Akun sendiri dikelola melalui Profil; Superadmin lain tetap dapat mengelola akun tersebut sesuai kewenangannya.
- Omission mempertahankan kewenangan/grant, none/array kosong mencabut eksplisit. Backend menerima grant identik pada koreksi akun tanpa hak delegasi; perubahan grant tetap ditolak. Pencabutan berlaku pada request berikutnya dan audit/version/rollback tetap wajib.
- Setiap fitur, izin, submenu dan cakupan wajib mempunyai uraian terpusat tentang kemampuan/batas. Tampilkan 1–2 kalimat sederhana dekat field aktif, minimal 8px dari control, justify dan line-height konsisten. Jangan hanya memakai tooltip/dropdown; jangan menjanjikan kemampuan yang belum ada. Jelaskan prasyarat kosong vs gagal dimuat sesuai izin.
- Ringkasan menghitung fitur sekali, bukan jumlah izin/gudang: satu chip +N fitur lainnya tanpa interaksi. Aksi Lihat hak akses membuka AppModal di level halaman agar pergantian tabel/kartu tidak menutupnya. Ikon semantik, chip selebar isi, gap 12–16px antarbaris dan 24px antarsection, status berlabel serta loading/error/kosong wajib tersedia.
- Migration 052 default flag nonaktif dan tidak mengubah rollout organisasi lama. Rekonsiliasi snapshot/menu/API membaca akses server terkini. Proses inti HRIS dan admin tunggal tidak berubah.

### Presentasi menu dan informasi hak akses

- Hak Akun Organisasi tampil dalam kelompok Akun & Akses di editor HRIS, dengan checkbox aktivasi. Saat aktif pilih Kelola akun Pegawai atau Kelola akun Pegawai & akses fitur; saat dinonaktifkan simpan none. Pengaktifan kembali default Kelola akun Pegawai, bukan delegasi fitur. Kontrak dan authority backend tetap.
- Menu tanpa CRUD seperti Laporan tidak memakai dropdown tingkat akses. Tampilkan label Hanya baca; checkbox memberikan/mencabut grant read. Dashboard adalah halaman dasar tanpa kontrol grant. Gunakan divider antarbaris dan uraian batas izin singkat.
- Login tetap /dashboard. Konten data mengikuti izin domain/submenu, bukan grant dashboard lama. HRD tanpa hak data melihat kartu terkunci dengan placeholder sintetis tanpa data; API mengirim DTO kosong tanpa dataset terlarang. Pegawai melihat ringkasan profil milik akun sendiri melalui endpoint self-service. Navigasi menu berizin tetap tersedia.

### Dashboard dasar dan katalog menu bersama

- Dashboard selalu halaman awal autentikasi, bukan grant statistik. Hapus pilihan Dashboard dari editor/rincian; kode lama kompatibel tetapi tidak memberi data. Isi data Dashboard wajib sesuai hak domain/submenu, organisasi dan scope server. HRD tanpa hak data melihat kartu terkunci tanpa data asli; Pegawai melihat ringkasan profil sendiri.
- Data Pegawai memberi ringkasan Pegawai/penempatan/kelengkapan/perkembangan/komposisi/ulang tahun. Ringkasan kontrak/pensiun/disiplin boleh untuk Data Pegawai atau laporan terkait; cuti memerlukan Cuti & Izin. Prioritas/aktivitas/link juga mengikuti izin. Statistik Inventaris tersedia melalui tab terpisah sesuai izin sumber dan scope gudang.
- Query hanya untuk section berizin; payload dilarang membawa section tak berizin atau nol palsu. Cache wajib memuat fingerprint izin efektif dan scope, termasuk saat pencabutan session aktif.
- menuCatalog.mjs menjadi katalog deklaratif sidebar/editor/evaluator; setiap menu baru wajib melengkapi jenis izin, scope, delegasi, penjelasan dan pengujian registrasi. Tidak memberi hak otomatis kepada akun terbatas.
- Form akses vertikal: nama menu → dropdown jika perlu → batas izin singkat. Tidak memakai section Informasi menu. Track minmax(0,1fr), min-width:0, popup wrap dan max-width:100% wajib diuji dengan pilihan terpanjang dan zoom 200%.
- Section fitur dapat dilipat independen, header kanan untuk buka/tutup; cabut akses di bawah setelah divider, tombol merah solid. Melipat tidak mencabut, tidak menghapus nilai/dirty, dan error membuka section sebelum fokus. Fitur baru terbuka; edit membuka HRIS atau fitur pertama.

### Pemindaian file development dan production

- Kepegawaian dan Inventaris wajib memakai pipeline storage/pemindaian yang sama. npm run dev dapat tanpa ClamAV dengan CLAMAV_REQUIRED=0 dan CLAMAV_ENABLED=0; validasi MIME byte/ukuran/dimensi/hash, organisasi/scope, staging dan rollback tetap berlaku. Status file legacy_unscanned, bukan clean palsu.
- NODE_ENV=production selalu wajib scan, termasuk npm start lokal, walaupun flag bernilai 0. Scanner tidak tersedia, timeout, atau ancaman menggagalkan upload. File belum clean diblokir pada preview/unduh production; jalankan pemindaian sebelum memakai file development di VPS.
- Upload Inventaris memakai PrivateFileUpload/FileUploadField dan ImagePreviewModal yang sudah ada. Foto barang disimpan bersama Simpan barang; lampiran transaksi mengikuti draft privat. Callback penghapusan async wajib ditunggu dan dilindungi loading/error; jangan membuat upload/dropzone paralel atau mencabut referensi UI sebelum hasil pemilik diketahui.
- Metadata tampilan upload dibaca melalui helper bersama `readUploadMetadata`: mendukung `mime_type`/`mimeType`, `size_bytes`/`sizeBytes`, serta file lokal. DTO upload dan pembukaan kembali draft wajib menyertakan MIME nyata dan ukuran agar preview konsisten; nama/ekstensi bukan dasar penentuan MIME. Uji gambar langsung setelah upload, draft dibuka kembali, PDF, dan penghapusan.

### Pemulihan loading navigasi

- Bedakan token proses simpan/upload/autentikasi dari token navigasi. Pembatalan stream RSC, Back/Forward, atau perpindahan yang tidak selesai tidak boleh meninggalkan overlay navigasi permanen.
- Loading navigasi memiliki deadline terpusat 30 detik dan pemberitahuan pemulihan; timer lama dibatalkan saat selesai/diganti. Hanya token navigasi dilepas, bukan proses upload/simpan aktif. Jangan menekan console error framework secara global untuk menutupi masalah.

### Stok Barang dan Kartu Stok

- Tahap Stok Barang menggantikan placeholder stok pada tahap awal. Distribusi Barang membaca laporan penyaluran resmi sesuai docs/inventory-distribution.md; request/approval/aset belum dikembangkan. Tidak membuat ledger atau saldo kedua.
- Stok dibaca per pasangan barang–gudang dari proyeksi replay bersama serta inventory_stock_balances; stok awal manual terpisah dari keberadaan riwayat. Belum ada riwayat resmi berarti Belum ada transaksi, bukan nol. Setelah riwayat dimulai, saldo nol berarti Habis; saldo positif di bawah minimum berarti Di bawah minimum; nilai lainnya Cukup. Batas minimum bukan saldo.
- Kartu Stok berada pada detail barang–gudang, memakai inventory_stock_projection dan referensi inventory_stock_movements, dengan tanggal efektif dan urutan replay yang sama dengan validasi transaksi. Hitung running balance sebelum filter tanggal/pagination; pembatalan tetap transaksi pembalik. Draft tidak masuk kartu stok. Tautan rincian diperiksa dengan permission transaksi asal gudang.
- Daftar/Kartu Stok memakai permission inventory.stock.read, scope gudang server terbaru, DTO privat, pagination cursor terikat filter/scope, total server, dan komponen tabel/kartu/modal/filter yang sudah ada. Barang/gudang nonaktif tetap tersedia melalui filter untuk pemeriksaan histori, tanpa operasi stok baru.
- Pengaturan minimum hanya dengan inventory.item_warehouses.update pada gudang yang sama, memakai use case/version/audit yang tersedia. Pembuatan transaksi hanya melalui menu Transaksi Barang; Stok Barang fokus pada pemantauan, Kartu Stok, minimum, dan koreksi stok awal, tanpa tombol Tambah transaksi pada header.
- Thumbnail barang menggunakan InventoryItemPhoto dan ImagePreviewModal, mendukung keyboard dan target 44px. Pada wizard jumlah/stok awal terkunci sebelum barang valid dipilih. Memperbesar foto tidak mengubah isian/dirty state.

### Bahasa dan ringkasan transaksi Inventaris

- Gunakan Tambah transaksi untuk membuka form baru, Simpan transaksi untuk finalisasi, dan Simpan draft & tutup untuk draft. Hindari istilah Catat transaksi pada alur pengguna. Status resmi ditampilkan Tersimpan; identifier teknis posted/recorded_at tetap dipertahankan.
- Pilihan transaksi asal menampilkan nomor dokumen bila ada, tanggal, gudang, dan ringkasan barang/jumlah. UUID atau potongannya bukan nomor referensi dan tidak boleh menjadi label pilihan pengguna. Pemilihan barang keluar asal memerlukan gudang terlebih dahulu.
- Nomor referensi berada pada grid dua kolom desktop (sejajar dengan Pegawai penerima pada barang keluar), satu kolom mobile. Tombol hapus baris barang sejajar tengah control pilihan/jumlah, bukan sejajar label.
- Detail transaksi menampilkan foto barang melalui InventoryItemPhoto/ImagePreviewModal. Lampiran dokumen tampil sebelum foto serah terima. Foto tidak menampilkan nama file; petunjuk memperbesar berada di tengah bawah gambar.
- InventoryQuantityChip menampilkan jumlah/stok penting secara utuh dengan font terbaca dan wrap mobile, bukan ellipsis yang menyembunyikan angka. Label membedakan Jumlah masuk/keluar, stok sebelum, stok setelah tanggal transaksi, dan stok gudang saat ini.
- Pada tahap Barang, Barang Masuk/Keluar/Stok opname menampilkan Stok gudang saat ini dan satuan dari saldo server untuk gudang terpilih. Jumlah yang sedang diisi belum termasuk saldo tersebut; perubahan setelah transaksi berada pada tahap Periksa. Stok awal yang belum tersedia tidak boleh diberi angka nol palsu.
- Tahap Periksa wajib memakai perkiraan server melalui POST /api/inventory/transactions/preview. Validasi jumlah/tanggal/pecahan/sumber dan cakupan memakai helper yang sama dengan penyimpanan. Simulasi tidak menulis saldo, ledger, draft, file atau audit transaksi. Data bertanggal sebelumnya menampilkan kedua saldo yang relevan; finalisasi tetap memvalidasi ulang stok terbaru, version dan transaksi atomik. Draft yang dibuka pada tahap Periksa memuat ulang perkiraan, bukan memakai angka lama dari browser.

### Pengembalian ke gudang

- Field transaksi penyaluran sebelumnya memakai lebar satu kolom desktop dan penuh pada mobile. Pengembalian tidak menyediakan input nomor referensi baru; nomor memo asal dapat dibaca pada rincian penyaluran. Label jumlah pada daftar tetap cukup Jumlah (satuan). Tahap Periksa membedakan Tanggal penyaluran sebelumnya dan Tanggal pengembalian ke gudang; tanggal transaksi pengembalian adalah tanggal barang kembali, bukan tanggal sumber atau waktu input.
- Riwayat transaksi memakai lebar kolom desktop yang memadai dan scroll horizontal lokal. Tanggal/nama jenis transaksi pada baris data memakai bobot normal; nama transaksi, gudang dan ringkasan barang tidak wrap pada desktop. Mobile tetap wrap dengan track yang menyusut. Jangan menyembunyikan overflow halaman secara global untuk mempertahankan tampilan dense.
- Ledger utama menampilkan satu baris per transaksi asal; dokumen pembalik pembatalan tetap append-only di database, pergerakan stok, audit, dan Kartu Stok tetapi tidak menjadi baris kedua di ledger utama. Transaksi asal menampilkan status Dibatalkan; modal detailnya menampilkan alasan, pelaku, waktu pembatalan, dan rincian asal. Pagination, filter, total, dan urutan terbaru mengikuti baris yang terlihat; pembatalan memperbarui posisi urutan transaksi asal. Baris ledger membedakan jumlah barang yang dicatat dari perubahan stok dengan tanda dan warna semantik. Untuk transaksi yang dibatalkan, angka perubahan asal tetap terbaca tanpa garis coret, disertai keterangan sederhana bahwa stok sudah dikembalikan. Istilah teknis seperti "dibalik" dan "dampak akhir" tidak dipakai dalam teks UI.

- Pengembalian adalah penerimaan fisik barang dari penyaluran sebelumnya. Label Transaksi penyaluran sebelumnya menggantikan Barang keluar asal; aksi RelatedRecordAction dengan tombol Lihat detail transaksi yang menonjol membuka AppModal berisi tanggal, tujuan lokasi/unit, penerima, serta barang/jumlah penyaluran tanpa mengubah isian.
- Tanggal barang diterima kembali wajib, default hari ini dari database/zona organisasi. Tidak mengambil tanggal penyaluran sebagai tanggal kembali. Tanggal sebelumnya tetap memerlukan alasan input terlambat; batas 30 hari, larangan masa depan, serta larangan tanggal sebelum penyaluran dipertahankan.
- Semua barang dari penyaluran tampil otomatis pada tahap Barang, tanpa tambah/ganti/hapus produk. Jumlah awal berisi sisa maksimal yang masih dapat dikembalikan dari server; pengguna dapat mengurangi atau mengisi 0 untuk barang yang tidak kembali. Tampilkan jumlah disalurkan, sudah kembali, dan maksimal tersisa dari server. Barang nonaktif/seluruhnya kembali tetap terlihat dengan input terkunci dan petunjuk.
- Draft menyimpan semua baris; preview/finalisasi hanya mengirim jumlah positif. Jangan mengasumsikan semua barang dikembalikan atau mengubah saldo dengan baris 0. Pemulihan draft mempertahankan jumlah lama dan mengambil ulang batas terbaru.
- Batas pengembalian selalu dihitung server per baris sumber. Lock transaksi penyaluran sebelum query agregasi dengan snapshot baru untuk menghindari pengembalian serentak berlebih. Pembatalan pengembalian yang sah mengembalikan batas tersebut; histori dan audit tetap utuh.
- Daftar transaksi sumber memiliki pencarian dan pagination dropdown agar penyaluran lama tidak terpotong pada halaman pertama. Endpoint return-options memeriksa organisasi, scope gudang, modul/session aktif, dan permission transaksi; tidak membuka hak HRIS atau master.

### Stok awal, koreksi dan replay Inventaris (057)

- Stok awal hanya sebelum riwayat resmi barang–gudang dimulai. Penerimaan pertama boleh tanpa stok awal, dimulai dari nol tanpa dokumen stok awal palsu. Riwayat yang sudah dibatalkan tetap menghalangi stok awal baru. Eligibility berasal dari backend dan diperiksa ulang preview/commit.
- Koreksi tanggal/jumlah stok awal append-only, wajib alasan minimal 10 karakter, preview/version/fingerprint/konfirmasi/audit. Gabungan koreksi+penerimaan wajib atomik; isian draft tidak diubah otomatis. Tanggal stok awal pada/sebelum operasi pertama; tidak menebak jumlah sebenarnya.
- Koreksi hanya Superadmin atau paket Koreksi Stok Awal eksplisit disertai Pengelola Gudang pada gudang yang sama. Pemberi paket hanya Superadmin/admin HRD penuh; scope koreksi tidak lebih luas dari manager. Grant tidak otomatis untuk akun lama atau master.
- Replay BigInt tiga desimal bersama untuk preview/post/cancel/correction dan proyeksi stok/kartu/minimum. Hasil fisik stok opname tetap, delta dan reversal memakai efek replay. Tolak negatif historis dan retro pada hari stocktake yang sama. Dokumen/ledger asal immutable.
- Pesan error wajib satu penyebab pasti, dengan barang/gudang/tanggal/angka faktual dan fieldErrors. Jangan memakai diagnosis dengan beberapa kemungkinan. Status commit tidak pasti diverifikasi melalui UUID sebelum retry, bukan notifikasi gagal yang diasumsikan.
- Saldo legacy tidak berubah diam-diam. Dry-run, laporan selisih, persetujuan, fingerprint dan aktivasi atomik diaudit wajib sesuai docs/inventory-opening-corrections.md. Migration mencerminkan bootstrap dan diuji pada database terpisah.
- Aksi Kartu Stok/Atur minimum/Koreksi memakai AppIcon semantik terdaftar, tema info/secondary/warning, tooltip/aria/44px. Jangan memakai fallback tanda tanya.

### Filter daftar Pegawai

- Golongan darah pada daftar dan export memakai BLOOD_TYPE_OPTIONS yang sama dengan form (A/B/AB/O); tidak menambah klasifikasi baru atau mengubah data lama.
- Tanpa penempatan berada dalam Kelengkapan data dan memakai employeeWithoutAssignmentSql yang sama dengan Dashboard: status aktif/masa percobaan, tanpa penempatan utama yang berlaku hari ini. Penempatan tambahan, masa depan, dan yang sudah berakhir tidak memenuhi penempatan utama saat ini. Scope HRD terpilih tetap membatasi akses; filter ini tidak memberikan akses ke Pegawai di luar scope. Filter daftar, total, pagination, dan export harus konsisten.

### Field administratif Transaksi Barang

- transactionFieldPolicy.mjs adalah sumber bersama form/backend untuk kewajiban alasan terlambat dan metadata nomor dokumen. Stok awal tidak meminta alasan keterlambatan, meskipun tanggal acuannya sebelum hari ini. Barang masuk, keluar, pengembalian dan stok opname bertanggal sebelumnya tetap wajib alasan minimal 10 karakter. Batas 30 hari, larangan masa depan dan audit tidak berubah.
- Input nomor dokumen hanya untuk Barang masuk (Nomor dokumen penerimaan, opsional) serta Barang keluar (Nomor memo/permintaan, opsional). Stok awal, pengembalian, stok opname tidak menawarkan input nomor referensi baru. Kontrak referenceNo dipertahankan; nilai draft/dokumen lama tidak dihapus karena field disembunyikan, ditampilkan sebagai informasi tersimpan. Nomor penyaluran asal tidak disalin menjadi nomor pengembalian baru.
- Ringkasan tidak menampilkan placeholder nomor referensi kosong. Pembatalan dan koreksi stok awal tetap wajib alasan tindakan, termasuk jika dilakukan hari ini. Catatan transaksi tetap opsional. Tidak ada penomoran otomatis baru pada tahap ini.

### Identitas modal transaksi

- Setelah jenis transaksi dipilih dan diterapkan pada form, judul/icon AppModal mengikuti katalog jenis transaksi. Status melanjutkan draft berada pada deskripsi, bukan menggantikan identitas jenis transaksi. Loading draft memakai judul jelas sampai data tersedia.
- Aksi rincian penyaluran memakai RelatedRecordAction; desktop di samping pilihan sumber, mobile tepat setelah pilihan sumber, dengan konteks singkat dan tombol semantik 44px. Preview tidak mengubah isian, draft, stok, atau dirty-state.

### Laporan Distribusi Barang

- Laporan membaca dokumen Barang keluar yang tersimpan, tidak menulis stok, tidak menginput distribusi lagi. Cohort berdasarkan tanggal penyaluran; pengembalian/reversal dibatasi tanggal akhir laporan. Nilai asal immutable; penyaluran efektif nol setelah pembatalan pada/sebelum akhir periode. Penyaluran bersih bukan stok atau pemakaian unit.
- Scope inventory.reports.read mengikuti paket yang memuat permission tersebut; master all tidak memperluas reader selected. Detail dan lampiran tetap memerlukan izin transaksi/file. Modal bersama dari laporan tidak menawarkan pembatalan dan menjelaskan perbedaan cutoff laporan dengan status dokumen terkini.
- Rincian/rekap/satuan/filter/keyset/total/Excel memakai service dan snapshot baca yang sama. Ekspor maksimal 5.000 baris, literal, diaudit, no-store, tanpa pemotongan. Jangan menjumlahkan kuantitas lintas satuan atau menampilkan error sebagai statistik nol.
- Tujuan berasal dari transaksi asal, bukan penempatan Pegawai terkini. Default periode awal bulan–hari ini zona organisasi. Perubahan aturan historis harus diuji terhadap return dan pembatalan sebelum/sesudah cutoff. Rancangan/API/uji: docs/inventory-distribution.md.

- Bahasa Inventaris memakai Stok awal/Koreksi stok awal pada UI, validasi dan katalog izin; identifier kontrak opening/balance tetap. Stok Barang default menampilkan yang sudah memiliki transaksi, menyediakan Semua barang/Belum ada transaksi, dan tidak menampilkan stok nol palsu. Tabel ringkas memakai nama/kode barang serta nama gudang. Ringkasan satu barang rata kiri; jumlah transaksi berada dalam Perubahan stok gudang. Label distribusi sederhana tanpa mengubah perhitungan historis.
- Identitas pelaku Inventaris memakai nama pertama dan terakhir dari profil tertaut, fallback username. Avatar memakai komponen bersama dan preview privat berizin, terkait pelaku dokumen sebenarnya; akses Inventaris tidak membuka seluruh profil/dokumen HRIS. Backend, ekspor, rincian, pembatalan dan Kartu Stok memakai aturan identitas yang sama. Uji foto lintas organisasi/scope, target palsu, keyboard serta fallback.

Jabatan di bawah nama pelaku Inventaris berasal dari penempatan utama yang berlaku hari ini menurut timezone organisasi. `ActorIdentity` menerima `position` opsional; profil tanpa jabatan tidak menampilkan keterangan pengganti. Riwayat transaksi menempatkan Disimpan oleh sebelum Status.

### Dashboard Pegawai dan Inventaris

- Menu Dashboard tetap tujuan login. Jika satu ringkasan tersedia, Dashboard adalah tautan langsung tanpa submenu; jika lebih dari satu, Dashboard hanya membuka submenu Ringkasan Kepegawaian, Ringkasan Pribadi, dan/atau Inventaris menurut hak akses. Ringkasan Kepegawaian memerlukan sekurangnya satu izin baca bagian kepegawaian dan merangkum data pegawai organisasi; Ringkasan Pribadi memerlukan profil tertaut dan permission `*_self` bagi Pegawai, HRD, atau Pimpinan. Inventaris memerlukan izin fitur. URL masing-masing `/dashboard/staff`, `/dashboard/personal`, `/dashboard/inventory`; `/dashboard` memilih tujuan berizin, termasuk kompatibilitas `?tab=inventory` lama.
- Ringkasan Kepegawaian tidak memuat data secara berkala: ambil saat halaman dibuka, saat tombol Muat ulang dipilih, atau ketika snapshot akses menunjukkan bagian ringkasan atau cakupan akses berubah. `ProtectedShell` memeriksa `/api/access/me` setiap 20 detik hanya pada tab organisasi yang terlihat, serta saat navigasi/fokus dan event perubahan akses. `scopeRevision` adalah penanda perubahan lokasi HRD dan paket/cakupan gudang Inventaris, bukan bukti izin. Saat penanda berubah, segera buang seluruh konten, modal, dan isian yang belum disimpan dari cakupan lama lalu muat ulang halaman berizin; jika seluruh akses dicabut, sembunyikan konten dan alihkan. Pemberitahuan perubahan akses wajib singkat dan tidak boleh menyatakan ada form atau isian belum disimpan tanpa konteks yang sesuai. Backend tetap memeriksa izin dan cakupan pada setiap request.
- Ringkasan Pribadi menerima profil, penempatan utama, kepegawaian, kontrak, saldo/cuti/izin dan ringkasan sanksi resmi sendiri melalui `/api/dashboard/employee_self`. Target selalu dari sesi, permission `*_self` diperiksa per bagian. Migration 059 memberi izin pribadi cuti dan sanksi kepada Pegawai; migration 062 memberi izin baca pribadi kepada HRD/Pimpinan tanpa membuka administrasi, persetujuan, atau mutation. Rincian kasus resmi, cuti/izin nondraft, dan file sendiri wajib selalu dikunci ke profil sesi juga saat role memiliki izin HRIS yang lebih luas. Saldo dari ledger tahun organisasi, hari/jam per jenis; draft dikecualikan. Sanksi aktif memperhatikan periode, bukan status tersimpan saja. Belum ada pengajuan baru mandiri; rincian dibuka langsung dari daftar pribadi.
- `/api/dashboard/inventory` memisahkan scope stok, transaksi dan laporan. Query dan DTO hanya bagian berizin; respons private/no-store tanpa cache bersama. Superadmin memilih organisasi eksplisit. Gudang aktif dan lokasi operasional mengikuti tanggal organisasi.
- Kondisi stok memakai sumber proyeksi yang sama dengan Stok Barang. Stok menipis < minimum, sama minimum Cukup; Habis memerlukan histori. Belum ada transaksi dan barang nonaktif tidak masuk statistik kondisi. Jangan menjumlahkan satuan barang berbeda.
- Tiga grafik saja: Kondisi stok, Aktivitas transaksi (area penuh: tahun, bulan, minggu), Tujuan penyaluran terbanyak. Aktivitas menghitung dokumen receipt/issue/return/stocktake tanpa opening/reversal/dibatalkan. Penyaluran memakai pembatalan sampai akhir periode. Bahasa singkat, warna tema, 24px antarsection, 44px kontrol dan komponen/adapter grafik bersama.
- Dashboard tidak mengirim daftar draft. Daftar perhatian maksimal sepuluh dan terbaru lima. Tautan membawa filter/gudang berizin. Uji API/browser pada database terpisah, scope berbeda per section, pencabutan, kondisi stok, periode organisasi dan responsif.

Dashboard pribadi dan Inventaris: header profil tetap di atas konten, tanpa tab. Pegawai dan Inventaris tidak memakai section Akses cepat. Aktivitas transaksi memakai area penuh dengan filter tahun, bulan, minggu; ringkasan tetap bulan ini. Warna jenis konsisten dengan riwayat.

Dashboard Inventaris dibuka melalui submenu atau tautan langsung sesuai izin, tanpa tab. Stok menipis/habis memakai kartu produk horizontal yang dapat digeser dengan keyboard/sentuhan; transaksi bulanan berupa daftar jenis dan jumlah di atas kartu ringkasan. Tooltip aktivitas memakai tanggal lengkap, sumbu area menyisakan ruang puncak dan ujung label.

### Log kerja sementara

- Jangan menyimpan hasil build, lint, atau pengujian sebagai file log di root proyek. Gunakan output terminal atau folder sementara sistem jika hasil perlu dibaca ulang. Bersihkan log setelah verifikasi selesai.
- Folder scripts berisi alat migration, backup, dan pemeliharaan production. Folder tests dan skrip test-* telah dihapus atas instruksi pemilik proyek; perintah npm test terkait juga dihapus. Kebutuhan verifikasi perubahan tetap berlaku melalui lint, build, smoke test, dan pemeriksaan terarah di lingkungan terpisah. Periksa pemanggilan runtime sebelum menghapus alat operasional.

### File pengujian sementara saat pengembangan

- File yang dibuat khusus untuk mencoba atau menguji perubahan bersifat sementara, baik berupa skrip `test-*`, `*.test.*`, helper, fixture, file SQL uji, screenshot, laporan, maupun file pendukung lainnya. Gunakan folder sementara sistem bila memungkinkan.
- Setelah pengujian selesai, berhasil, dan tujuan pemeriksaan terpenuhi, wajib hapus seluruh file sementara yang dibuat untuk pengujian tersebut sebelum menyatakan pekerjaan selesai. Jangan meninggalkan folder pengujian kosong atau artefak uji di root proyek.
- Bersihkan seluruh penghubung ke file yang dihapus: import/export, pemanggilan skrip, perintah `package.json`, konfigurasi, pengecualian `.gitignore`, serta petunjuk dokumentasi. Jangan meninggalkan referensi atau perintah yang rusak. Dependensi khusus pengujian yang ditambahkan untuk pekerjaan tersebut dan tidak lagi digunakan juga dilepas beserta pembaruan lockfile terkait.
- Penghapusan mengikuti fungsi file, bukan hanya namanya. Pastikan file memang dibuat untuk pengujian dan tidak digunakan oleh alur aplikasi, migration, backup/restore, worker, atau pemeliharaan production. Data pengguna, histori bisnis, migration resmi, dan alat operasional yang masih digunakan tetap dipertahankan.
- Kewajiban menguji perubahan tetap berlaku. Jika pengujian belum berhasil, lanjutkan perbaikan dan verifikasi; jangan menghapus bukti masalah lalu menyatakan pengujian lulus. Setelah berhasil, catat ringkasan hasil pemeriksaan pada laporan pekerjaan tanpa menyimpan file uji sementara.
- Sebelum menutup pekerjaan, periksa tidak ada referensi tersisa menuju file uji yang dihapus dan jalankan verifikasi yang relevan terhadap konfigurasi/kode akhir setelah pembersihan.

- Grafik Aktivitas transaksi pada Tahun ini selalu mencakup Januari sampai Desember. Bulan tanpa transaksi, termasuk bulan mendatang, ditampilkan 0 agar garis berlanjut penuh; angka ini berarti belum ada transaksi tercatat, bukan prediksi. Ringkasan tetap menghitung transaksi nyata sampai tanggal organisasi.

- Grafik Aktivitas transaksi juga mengisi tanggal tanpa transaksi dengan 0 hingga akhir bulan/minggu yang dipilih. Kurva area memakai smooth seperti dashboard HRD; tooltip tetap nilai transaksi sebenarnya dan tanggal lengkap.

- Dashboard HRD menampilkan pie Cuti & Izin tahun ini (pencatatan approved yang beririsan periode tahun sampai hari ini) dan grafik batang Sanksi tahun ini (tindakan resmi per jenis snapshot berdasarkan issued_date, tanpa draft). Statistik ditempatkan setelah grafik unit/kontrak; permission dan scope diperiksa sebelum query serta proyeksi DTO. Detail transaksi dari Kartu Stok memakai modal bersama di tempat tanpa pindah halaman dan tanpa aksi pembatalan.

- Ringkasan Cuti & Izin menampilkan jenis aktif organisasi termasuk nol serta jenis nonaktif yang masih memiliki data berizin. Panel Sanksi tahun ini memerlukan izin menu Sanksi Pegawai (disciplinary-actions-report); Data Pegawai saja tidak memberikan statistik tersebut. Rekap Akhir Kontrak berupa daftar jumlah dokumen per bulan/status untuk 12 bulan terakhir, menggantikan grafik batang.

Jadwal Kontrak Berakhir menggantikan rekap histori kontrak: jumlah kontrak aktif yang telah mulai, pegawai aktif/probation/suspended, bertanggal akhir mulai hari ini menurut timezone organisasi sampai akhir bulan kalender ke-12. Query dashboard dan laporan memakai buildReportQuery yang sama dengan contractStatus=active; kontrak draft, dibatalkan, berakhir, diperpanjang, tanpa tanggal akhir, serta pegawai final tidak dihitung. Setiap bulan menampilkan jumlah kontrak akan berakhir. Lihat pegawai hanya tersedia bagi akun berizin laporan Kontrak Akan Berakhir, mempertahankan organisasi dan rentang bulan. Tidak memakai label Aktif/Selesai atau diperpanjang pada panel jadwal.

Jadwal Kontrak Berakhir memakai kalender brand merah untuk bulan dengan data. Ikon mata membuka ContractEmployeesModal di dashboard, memakai API laporan yang sama dan filter bulan/organisasi/status aktif. Modal memakai AppModal, ResponsiveDataView, DataPagination cursor, ReportIdentity/ReportRemaining, dan ImagePreviewModal untuk pas foto. Pemeriksaan izin laporan tetap di backend; menutup modal mempertahankan halaman serta posisi dashboard.

Rekap Cuti & Izin: label Durasi cuti/izin; seluruh header dan sel tabel dibatasi garis tipis, termasuk ketiga subkolom Hak/Terpakai/Sisa. Sisa memakai CompactInfoChip: hijau tersedia, kuning ketika positif maksimal 25% hak, merah saat nol/habis atau negatif. Ini indikator tampilan, bukan aturan persetujuan. Jenis tanpa saldo tidak diberi indikator saldo. Modal Rincian rekap menampilkan identitas, ringkasan angka dan saldo, serta daftar kartu kejadian dengan navigasi keyset lima data per halaman. Jangan memakai modal operasional satu kejadian atau tabel bersarang untuk rincian rekap. Excel memakai header saldo dua tingkat dan sheet rincian report-only dari snapshot/filter/scope yang sama, batas 5.000 masing-masing tanpa pemotongan.

Pemulihan navigasi sidebar: selesaikan token loading saat transisi router selesai, termasuk redirect ke pathname asal. Setelah 30 detik, href internal yang sudah melewati guard isian dapat dibuka via request dokumen baru agar router RSC tertahan tidak menggagalkan perpindahan. Validasi origin wajib; jangan memakai reload otomatis untuk proses upload/simpan atau melewati konfirmasi isian. Tanpa href pemulihan valid, pertahankan notifikasi dan pelepasan token navigasi saja.

Dashboard Inventaris memakai label Stok perlu diisi kembali dan status Di bawah minimum/Habis. Daftar maksimal 10 barang memakai HorizontalCarousel: autoplay satu kartu ke kiri hanya saat overflow, scrollbar tersembunyi, jeda hover/fokus/sentuhan/manual serta saat foto terbuka atau panel/tab tidak terlihat. Pada mobile (<600px) tampilkan satu kartu penuh dengan scroll snap, tanpa cuplikan kartu berikutnya. Sediakan panah dan keyboard tanpa tombol jeda/jalankan; autoplay kembali setelah jeda interaksi manual 9 detik dan tetap menghormati reduced motion; salinan loop tidak menambah urutan Tab/pembaca layar. StockAttentionCard menonjolkan Stok tersedia dan Batas minimum dengan warna status serta shadow token tema, tanpa mengubah proyeksi stok atau menambah data palsu.

Kartu produk Stok perlu diisi kembali memakai label Stok segera habis untuk stok di bawah minimum dan Stok habis untuk nol. Chip, aksen serta bagian Stok tersedia memakai brand merah SITOU. Nama kategori statistik tetap Di bawah minimum; tidak menghitung prediksi waktu habis.

Dashboard Inventaris Transaksi terbaru: tombol detail desktop/tablet berupa ikon mata 44px dengan tooltip, mobile ikon dan teks. Buka TransactionDetailModal bersama di tempat melalui API transaksi berizin, bukan pindah menu. Pertahankan organisasi/scope, loading/error, pembatalan request saat unmount, URL/posisi gulir; konteks Dashboard tidak menyediakan pembatalan transaksi.

Dashboard Pegawai memakai banner profil, tiga ringkasan sesuai izin, saldo per jenis dengan LeaveBalanceFields, lima cuti/izin terbaru dan lima sanksi resmi terbaru. Filter status berlaku pada lima data terbaru dan keterangannya wajib jelas. Jangan menampilkan angka contoh, menganggap saldo yang belum ditetapkan sebagai nol, atau membuat tombol pengajuan mandiri yang belum tersedia. Navigasi bersama berlaku untuk seluruh role dan wajib diuji pada layar pendek selain lebar 320–1920px.


### Konsistensi ringkasan Dashboard Pegawai

- Dashboard Pegawai, HRD, dan Inventaris memakai DashboardMetric untuk kartu angka; angka besar/tebal dan satuan hari, jam, tahun, bulan, pengajuan atau sanksi lebih kecil. Komponen mendukung parts dan progress tanpa menjumlahkan saldo lintas jenis/satuan.
- Dashboard tidak memakai header sambutan atau PageHeader terpisah; EmployeeProfileBanner berada di DashboardWorkspace di atas konten dan tampil untuk semua role, termasuk pada Inventaris. Jika profil pegawai tertaut, banner menampilkan status dan jenis kepegawaian dari kontrak yang berlaku atau histori terakhir, bukan nama role akun. Jika tidak tertaut, tampilkan identitas akun tanpa NIP atau status kepegawaian buatan. Banner menonjolkan NIP bila tersedia, tanpa mengulang jabatan/divisi dari Penempatan saya; atasan langsung berasal dari penempatan utama aktif. Tanggal akhir kontrak hanya tampil jika employment_types.requires_end_date aktif.
- Tidak ada section Apa yang ingin Anda lihat? atau Informasi kepegawaian yang terpisah. EmployeeLeavePanel menampilkan lima cuti atau izin terbaru tanpa blok saldo atau keterangan alur HRD. Ringkasan jatah/sisa tampil pada kartu dashboard, sedangkan rincian Hak/Terpakai/Sisa tersedia pada modal. Hak tahunan yang belum terbentuk tidak dianggap saldo ledger nol.
- Baris cuti membuka LeaveDetailModal bersama melalui GET /api/dashboard/leave_self/:id. Role Pegawai dan leave_requests.read_self wajib, organisasi dan pemilik dipetakan dari session, draft dikecualikan. Lampiran sendiri juga memerlukan private_files.read_self dan relasi nyata ke permintaan nondraft milik sendiri. Tidak memberi permission administrasi atau mutation.

- Dashboard Pegawai hanya menampilkan tiga kartu: cuti/izin, masa kerja, dan sanksi aktif. Satuan tahun/bulan/hari pada DashboardMetric memakai jarak antar pasangan dan wrap. Tab cuti berlabel Semua, Menunggu, Disetujui; panah menggunakan action:chevron-right.
- Sanksi & teguran berada tepat di bawah Cuti & izin saya. Klik baris berchevron membuka DisciplineCaseDetailModal bersama melalui /api/dashboard/discipline_self/:id. Hanya kasus dengan tindakan resmi nondraft milik pegawai sesi yang boleh dibaca; catatan internal HRD tidak dikirim. Surat sendiri memerlukan disciplinary_actions.read_self dan private_files.read_self, relasi tindakan resmi dan pemilik yang cocok, audit serta no-store.


### Saldo pilihan dan riwayat pribadi Dashboard

- Kartu jatah/sisa cuti & izin memakai EmployeeBalanceMetric dan DashboardMetric: hanya jenis aktif yang memakai jatah, sesuai jenis kelamin profil menurut leave_types.eligible_gender, dan memiliki saldo ledger atau jatah tahunan positif; satu jenis tampil langsung, banyak jenis dapat digeser dengan sentuhan/mouse, tombol titik, atau panah keyboard. Banyak jenis berganti otomatis setiap 5 detik hanya saat kartu terlihat dan tidak sedang dibaca: jeda saat kursor berada di kartu, fokus keyboard di dalam kartu, tab tersembunyi, atau kartu di luar layar; lanjut lagi setelah kondisi jeda sementara berakhir. Tidak ada tombol jeda/lanjutkan; pengaturan pengurangan animasi menonaktifkan pergantian otomatis. Jangan memakai dropdown atau panah visual. Judul kartu adalah nama jenis cuti/izin yang tampil; nama tidak diulang di bawah judul. Pilihan tersimpan per akun/organisasi, diverifikasi ulang terhadap DTO. Default jenis dengan saldo ledger lalu urutan nama. Bila hak tahunan belum terbentuk, jatah dari aturan boleh ditampilkan sebagai informasi awal yang jelas dibedakan dari saldo resmi; jangan menyebutnya saldo ledger atau menganggapnya transaksi grant. Jangan menampilkan teks tahun tersendiri di bawah angka; indikator penuh membedakan "Jatah tahun ini belum digunakan" dari saldo resmi "Saldo tahun ini belum digunakan". Nama, jumlah, satuan, keterangan, serta indikator bawah wajib berasal dari jenis yang sama dan berganti bersama. Indikator menunjukkan jatah yang masih tersedia, baik dari aturan maupun ledger: penuh hijau, sebagian terpakai kuning, tersisa maksimal 25% merah. Teks jumlah pemakaian tetap tampil bila sudah digunakan sehingga warna bukan satu-satunya petunjuk. Saldo resmi nol dan negatif tetap dibedakan. Hari/jam tidak dijumlahkan, nama tidak diasumsikan Cuti Tahunan. Transisi singkat dan nonaktif saat pengguna meminta pengurangan animasi.
- Aturan leave_types.eligible_gender bernilai all|male|female; aturan lama default all. Profil pegawai other, undisclosed, atau kosong hanya dapat memakai jenis all. Form pencatatan menyaring pilihan setelah pegawai dipilih dan service memvalidasi ulang sebelum membuat hak saldo atau transaksi. Riwayat permintaan dan ledger lama tidak disaring ulang saat aturan atau profil berubah.
- Masa kerja hanya menampilkan bagian tahun/bulan/hari positif. Hari pertama berdasarkan tanggal organisasi; data hilang/invalid berlabel Belum tersedia tanpa angka nol palsu. Foto banner 96px desktop/80px mobile dengan bingkai putih 3px, memakai PhotoAvatar bersama.
- Sanksi memakai DisciplineHistoryList dengan baris brand dan chevron. Jumlah sanksi aktif tampil sebagai deskripsi tepat di bawah judul panel; ringkasan memakai CompactInfoChip reusable dengan tone danger jika ada sanksi aktif atau success jika tidak ada, tanpa kotak pemberitahuan atau section terpisah. Tombol Riwayat dan modal daftar riwayat tidak ditampilkan pada dashboard. Klik baris tetap membuka detail kasus pribadi berizin. Status berada dalam kolom terpisah dan sejajar tengah dengan ikon/panah.


### Layout dashboard dan navigasi ringkas

- Profil/identitas akun tampil di DashboardWorkspace sebelum konten untuk seluruh role; header sambutan dihapus. Pegawai memakai sumber employee_self, sedangkan akun tertaut non-Pegawai dapat membaca jenis kepegawaiannya melalui profil sendiri. EmployeeProfileBanner memakai PhotoAvatar/ImagePreviewModal bersama.
- DashboardMetric memakai flex column dan keterangan di bawah kartu secara default, termasuk sparkline bila tersedia. Kartu yang memakai progress mempertahankan keterangan sebelum indikator; angka dan satuan tidak berubah. Varian balanced pada Masa kerja dan Sanksi aktif memisahkan header, area angka di tengah vertikal, serta keterangan bawah dengan divider tipis. Angka memakai ukuran responsif 26–34px dan satuan tetap kecil; gunakan varian komponen bersama tanpa menambah informasi dekoratif.
- SidebarContent memakai satu area scroll vertikal untuk logo, organisasi, menu serta masa akses. Navigasi tidak menjadi viewport scroll kecil yang dibatasi footer; submenu terakhir wajib dapat dijangkau pada layar pendek. SubscriptionAccessCard ringkas berisi ikon perisai bercentang (subscription:access), status, tanggal akhir, sisa hari dan tombol Perpanjang akses 44px dengan notifikasi Coming soon.

- Pergantian ringkasan memakai navigasi submenu dan URL terpisah, bukan state tab lokal. Pencabutan izin menutup tujuan yang tidak lagi tersedia. Permission Inventaris tetap diperiksa melalui snapshot shell dan API server.

- Ulang tahun pegawai tampil pada Ringkasan Kepegawaian HRD dan Superadmin. Superadmin pada Semua organisasi menerima gabungan organisasi aktif, dengan nama organisasi dan tanggal kalender masing-masing timezone; pilihan satu organisasi memakai query organisasi yang sama. HRD tetap dibatasi izin Data Pegawai serta scope lokasi, tanpa akses lintas organisasi.

- Aktivitas terbaru pada ringkasan organisasi hanya menampilkan aktivitas HRD pada organisasi yang sama, dengan membership berlaku saat kejadian. Login wajib memakai snapshot audit role_code=hrd; login Pegawai, Pimpinan, atau Superadmin tidak masuk feed meskipun role akun kemudian berubah. Filter pelaku, izin, dan scope diterapkan sebelum LIMIT lima data; audit asal tetap utuh.

- Filter Status sanksi pada Data Pegawai default Tanpa filter sanksi; mendukung Pernah mendapat sanksi (seluruh tindakan resmi nondraft), Memiliki sanksi aktif, dan Tidak memiliki sanksi aktif. Jenis sanksi berasal dari master organisasi, termasuk jenis nonaktif yang masih memiliki histori berizin. Jenis dan status dipadukan pada tindakan yang sama dengan EXISTS, tanpa menggandakan pegawai. Aktif/dalam banding harus sudah mulai dan belum berakhir menurut timezone organisasi. Daftar, total, pagination, chip aktif, serta Excel memakai aturan bersama; filter tidak membuka draft, uraian kasus, surat, atau data di luar organisasi/scope.

- Label awal filter bersifat netral dan menjelaskan tidak ada pembatasan. Status sanksi memakai Tanpa filter sanksi, bukan Semua pegawai yang dapat disalahartikan sebagai seluruh pegawai memiliki sanksi. Bedakan Tidak memiliki sanksi aktif dari tidak pernah mendapat sanksi; riwayat yang telah berakhir tetap dapat ada. Gunakan katalog label bersama pada UI dan ekspor.

- Aktivitas terbaru HRD menyediakan tombol ikon 44px dengan tooltip/aria untuk membuka AppModal Riwayat aktivitas. Daftar memakai baris bersama dashboard, diurutkan occurred_at dan ID menurun, keyset default 10 data per halaman (pilihan 10/20/50) melalui DataPagination. GET /api/dashboard/activities hanya menerima cursor dan pageSize; organisasi berasal dari sesi HRD. Cursor bertanda tangan, berlaku 30 menit dan terikat akun/organisasi/fingerprint izin/scope lokasi/ukuran halaman, dengan ketelitian mikrodetik PostgreSQL. Query dan filter izin/pelaku sama dengan ringkasan; total seluruh aktivitas berizin dan halaman dihitung dalam satu snapshot SQL; no-store, tanpa payload audit lengkap atau mutation. Sediakan loading, kosong, gagal/coba lagi, pembatalan request saat ditutup, fokus keyboard dan pengembalian fokus ke tombol.

- DataPagination bersama pada tabel dan modal memakai satu kolom di mobile (<600px): ringkasan, Sebelumnya, Berikutnya, lalu pilihan jumlah data masing-masing satu baris; kedua tombol dan dropdown selebar area, tinggi minimal 44px, jarak minimal 12px. Desktop tetap ringkas. Pagination modal berada pada slot pagination AppModal yang tetap terlihat di bawah area gulir data dan terpisah dari footer Tutup. Perubahan ukuran halaman kembali ke halaman pertama dan mereset cursor.
- Aktivitas dashboard/riwayat memakai katalog activityPresentation bersama, kode aksi server menentukan ikon semantik activity:* lokal dan tone tema, bukan pencocokan teks terjemahan. Login, edit profil, cuti, kontrak, disiplin, pencabutan, import/export dibedakan; label tetap terlihat agar warna bukan satu-satunya petunjuk. Baris memakai AppIconTile bersama; tombol pembuka memakai ikon daftar activity:view-all, berbeda dari ikon histori judul.

- Kontrak ikon/tone aktivitas memiliki ACTIVITY_PRESENTATION_VERSION bersama pada cache server dan key ringkasan client. Saat kontrak berubah, naikkan versi agar ringkasan tidak mempertahankan snapshot tanpa metadata visual ketika modal sudah memakai versi baru. Ringkasan dan modal wajib diuji dari API nyata serta hasil render untuk aktivitas dengan ID sama, bukan hanya fixture yang menimpa respons ringkasan. Tidak menambah polling atau menebak ikon dari teks terjemahan.

- Modal daftar berpaginasi seperti Riwayat aktivitas dan Kontrak Berakhir memakai slot pagination AppModal di luar body yang bergulir. Total data dan jumlah yang sedang ditampilkan berasal dari server/halaman aktual, bukan pageSize atau jumlah seluruh audit tanpa scope. Gunakan displayedCount pada DataPagination dan contentResetKey untuk kembali ke atas saat halaman/ukuran berubah. Header, pagination dan Tutup tetap terlihat pada desktop/mobile; hanya isi daftar yang bergulir.

- Distribusi Barang berfokus pada filter dan tabel tanpa empat kartu ringkasan. Cari data (Input berikon, dapat dihapus, debounce) berada sebelum Periode penyaluran yang memakai DatePicker.RangePicker bersama, bukan dua DatePicker terpisah. Rentang diubah atomik; hapus/reset kembali ke awal bulan–hari ini zona organisasi. Nama barang memakai AsyncSelect dengan label ringkas Nama · Kode · Satuan dari histori berizin. Bahasa tabel/Excel memakai Nama barang, Tanggal penyaluran, Tujuan penyaluran, Pegawai penerima dan Jumlah transaksi; hindari label pencarian sempit Barang atau nomor memo jika query juga mencari kode/penerima. Perhitungan cutoff, filter, scope, keyset, ekspor dan audit tetap sama.

- Pada laporan Distribusi Barang gunakan Penyaluran bersih untuk net_quantity, yaitu jumlah disalurkan dikurangi pengembalian sampai akhir periode. Hindari label Belum dikembalikan yang dapat memberi kesan kewajiban mengembalikan atau stok penerima. Angka tersebut bukan stok gudang maupun sisa barang pada penerima. Tabel, kartu mobile, dan Excel memakai label/penjelasan bersama distributionLabels.mjs tanpa mengubah rumus atau ledger.

- Distribusi Barang langsung menampilkan Rincian penyaluran saja. Tidak ada filter Tampilan, mode rekap barang/tujuan, query grouped, cursor kelompok, atau Excel rekap. API menolak parameter view lama; total menghitung baris barang per transaksi berizin. Barang/tujuan sama pada transaksi berbeda tetap terpisah. Excel selalu berisi rincian dan akses modal mengikuti izin transaksi.

- Laporan Stok pada /reports/inventory-stock memakai inventory.reports.read dan scope gudang existing. Format mengikuti dokumen periode: Stok awal, Barang masuk, Jumlah stok, Barang keluar, Stok akhir; satu baris barang–gudang. Identitas barang memakai foto privat InventoryItemPhoto dan ImagePreviewModal bersama, kode serta satuan. Tidak ada kolom Keterangan pada tabel/mobile/Excel. Ikon Laporan Stok memakai navigation:inventory-stock-report lokal bold duotone. Seluruh angka berasal dari proyeksi efektif bersama Kartu Stok, masuk/keluar menurut tanda efek (termasuk pengembalian, opname, pembatalan). Stok awal adalah saldo sebelum periode, bukan transaksi opening yang terjadi dalam periode. Rincian report-only tidak membuka dokumen tanpa izin transaksi; Excel seluruh hasil maksimal 5.000, tanpa total lintas satuan, audit/no-store dan cursor HMAC terikat akun/filter/scope. Lihat docs/inventory-stock-report.md.

- Ekspor Excel Laporan Stok dan Distribusi Barang memakai sheet Informasi Laporan pertama untuk identitas, periode, waktu, filter serta penjelasan melalui reportWorkbookInfo bersama. Sheet kedua hanya tabel data: Laporan Stok atau Distribusi, header baris 1 dan freeze/autofilter mengikuti header tersebut. Jangan menaruh metadata di atas tabel atau memindahkan informasi ke sheet terakhir.

- Kartu mobile master dan operasional Inventaris memakai InventoryMobileCardContent bersama laporan: identitas/ikon semantik, status sesuai isi, fakta berlabel, angka bersatuan dalam area netral bila diperlukan, dan aksi teks selebar kartu di footer minimal 44px. Kategori/Satuan/Gudang memakai InventoryMasterCardContent; edit langsung membuka form berizin, bukan menu tambahan untuk satu aksi. Kode kategori/gudang tetap CompactInfoChip info di bawah nama. Tidak membuat bingkai/nomor kedua, footer kosong atau status selebar kartu. Stok membedakan batas minimum dan tersedia; transaksi tidak menjumlahkan barang/satuan dan menyebut barang tambahan di detail. Font mengikuti mobileDataTypography/FontStyle terpusat, nama/angka panjang tetap utuh. Desktop serta izin server tidak berubah. Lihat docs/inventory-mobile-ui.md.

- Identitas kartu master dan Transaksi Barang memakai InventoryCardIdentity: chip status di bawah nama/jenis pada kolom teks, sebaris dengan kode jika ada dan ruang cukup (wrap pada layar sempit). Ikon 48px/glyph 24px sejajar tengah dengan blok identitas. Aksi edit master memakai pensil outline EditOutlined; ukuran KindMark di pemakai lain tidak berubah.
