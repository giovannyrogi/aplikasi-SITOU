# AGENTS.md - SITOU

Dokumen ini adalah aturan kerja utama untuk developer dan Codex pada proyek **SITOU - Sistem Informasi Tenaga Operasional Unit**. Berlaku untuk seluruh folder proyek, kecuali ada `AGENTS.md` yang lebih spesifik di subfolder. Jika implementasi berbeda dari dokumen ini, perubahan harus dicatat melalui migration, test, dan pembaruan dokumentasi.

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

- CRUD data pegawai dan master organisasi.
- Data Master HRD memakai halaman/API yang sama dengan Superadmin, tetapi `organization_id` selalu dikunci dari session. HRD dapat mengelola lokasi, jenis unit organisasi, Divisi & Unit, jabatan, serta jenis kepegawaian organisasinya; identitas organisasi, masa akses, dan Admin/HRD pertama tetap khusus Superadmin.
- Mengelola kontrak, penempatan, shift, absensi, izin, dokumen, kasus, dan sanksi.
- Menjadi satu-satunya approver cuti/izin.
- Mengunggah dokumen sanksi dan mengubah status tindakan.
- Mengelola akun HRD, Pimpinan, dan Pegawai organisasinya. Tautan profil pegawai bersifat opsional untuk HRD/Pimpinan dan wajib untuk Pegawai; HRD tidak boleh memberi role Superadmin, menonaktifkan akun sendiri, atau menonaktifkan HRD aktif terakhir.
- Cakupan HRD selalu eksplisit melalui `location_scope_mode=all|selected`; ketiadaan baris scope tidak boleh ditafsirkan sebagai akses penuh ketika mode `selected`.

### Pimpinan

- Read-only untuk seluruh profil, penempatan, kontrak, dokumen sensitif, dan histori sanksi pada organisasinya tanpa batas lokasi. Preview/download sensitif wajib diaudit.
- Tidak dapat mengubah profil HRD, memutus izin, atau menerbitkan sanksi melalui sistem.
- Dokumen dan data sangat sensitif memerlukan permission khusus.

### Pegawai

- Tahap sekarang dapat dibuat tanpa akun aktif.
- Tahap mobile/web lanjutan: melihat data sendiri, absensi, mengajukan izin/cuti, dan mengunggah lampiran.
- Tidak pernah boleh memilih `employee_id` milik orang lain.
- Permission self-service wajib memakai kode dan endpoint `*_self` yang memetakan pegawai dari session. Dilarang memberikan permission baca generik modul organisasi kepada Pegawai sebelum endpoint self-service tersedia.

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

- Development boleh memakai direktori privat di luar public web root.
- Produksi direkomendasikan object storage privat.
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

Aturan wajib:

- Hindari `SELECT *` pada API.
- Semua list memakai keyset pagination bila data besar; offset hanya untuk master kecil.
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

- Seluruh antarmuka Bahasa Indonesia dan dapat dipahami pengguna nonteknis.
- Label, judul, tombol, bantuan, dan pesan validasi wajib menyebut isi atau tindakan dengan bahasa kerja yang langsung dipahami pengguna, sesuai fungsi kontrolnya. Hindari istilah struktur data atau label abstrak seperti "Nama jenis", "Jenis aktif", dan kode teknis ketika pengguna sebenarnya diminta memberi nama pilihan atau menentukan apakah pilihan tersebut tersedia. Gunakan pola yang konsisten, misalnya "Nama cuti atau izin", "Kelompok", "Kurangi jatah pegawai", dan "Tersedia untuk digunakan". Istilah teknis tetap boleh dipakai pada schema, kode program, dan dokumentasi pengembang, tetapi tidak ditampilkan sebagai beban input pengguna.
- Locale tanggal dan waktu wajib dipasang terpusat melalui `app/components/approvider/AppProviders.jsx`. Seluruh DatePicker/Calendar AntD memakai locale `id_ID` dan Day.js locale `id`, sedangkan MUI date picker memakai adapter locale `id`; dilarang mengatur nama bulan, hari, placeholder, atau tombol kalender per halaman secara manual.
- Seluruh field tanggal, bulan, dan tahun pada form wajib memakai date picker dengan mode yang sesuai dari library UI yang sudah terpasang, bukan `Input` teks atau input angka manual. Gunakan date picker standar untuk tanggal, month picker untuk bulan, dan year picker untuk tahun. Nilai form menggunakan objek tanggal adapter dan hanya dinormalisasi ke format kontrak API pada batas request.
- Sebelum membuat komponen UI baru, periksa `app/components` dan gunakan komponen reusable yang sudah ada untuk fungsi/kebutuhan yang sama. Perluas API komponen yang ada bila masih dalam tanggung jawab yang sama; jangan membuat duplikat hanya karena dipakai pada halaman berbeda.
- Seluruh typography MUI wajib menggunakan reusable component `app/components/font-style/FontStyle.jsx`, bukan mengimpor `Typography` langsung pada halaman atau komponen fitur. Gunakan font weight normal `500`, medium `600`, dan bold maksimal `700`; dilarang memakai bobot di atas `700`.
- Implementasi UI/UX wajib mengikuti best practice React/Next.js: komponen terfokus, state minimal, aksesibilitas dasar, semantic HTML, serta styling responsif yang tidak mengandalkan ukuran layar tunggal.
- Saat memakai atau mengubah komponen library UI seperti AntD/MUI, periksa kontrak versi yang benar-benar terpasang pada type definition atau dokumentasi lokal. Dilarang menambahkan prop/API deprecated; khusus AntD 6 gunakan `Alert.title` bukan `Alert.message`, `Steps.titlePlacement` bukan `Steps.labelPlacement`, `Tabs.destroyOnHidden` bukan `destroyInactiveTabPane`, `Timeline.items.content` bukan `items.children`, dan `Space.Compact` untuk prefix/suffix field, bukan `Input.addonBefore`/`addonAfter` yang deprecated. AntD `List` juga tidak boleh dipakai karena telah deprecated; susun daftar dengan semantic HTML/reusable data view yang sesuai kebutuhan.
- Sebelum perubahan UI dianggap selesai, periksa console browser dan cari penggunaan API deprecated pada seluruh area terkait agar warning yang sama tidak berpindah ke halaman lain.
- Validasi gagal dan tampilan Notification dilarang me-reset, me-remount, atau memuat ulang nilai form yang sedang diisi. Efek inisialisasi modal/wizard wajib memakai dependency stabil dan hanya dijalankan ketika sesi form, organisasi, atau record yang diedit benar-benar berubah.
- Metadata `key` dari render prop `Form.List` tidak boleh disebarkan ke beberapa elemen JSX. Pasang `key` hanya secara langsung pada wrapper baris dan berikan `name` field turunan secara eksplisit agar tidak menghasilkan duplicate key atau hydration warning React.
- Dropdown kategori pada data berulang yang bersifat satu-per-pegawai, seperti jenis identitas administratif dan platform akun sosial, wajib menonaktifkan pilihan yang sudah dipakai baris lain serta divalidasi ulang di backend. Nilai awal baris baru wajib berasal dari pilihan pertama yang masih tersedia, bukan nilai hardcoded; kategori yang secara bisnis boleh berulang tidak boleh ikut dikunci.
- SITOU menggunakan satu tema light yang konsisten. Jangan menambahkan dark mode, theme switcher, atau penyimpanan preferensi tema kecuali ada keputusan produk baru.
- Warna brand, status, feedback, state interaktif, dan permukaan UI wajib bersumber dari token terpusat di app/components/themeprovider/ThemeProvider.jsx. Dilarang menulis nilai hex, rgb/rgba, gradient, atau shadow berwarna langsung di halaman/komponen fitur bila token semantik yang sesuai dapat disediakan atau sudah tersedia.
- Gunakan theme.brand untuk identitas SITOU, theme.status untuk success/warning/info/danger/neutral, palette MUI untuk state komponen, dan theme.ui untuk kebutuhan visual reusable atau halaman khusus. Token AntD harus mengambil sumber warna yang sama agar MUI dan AntD konsisten.
- Desktop: sidebar; mobile: drawer/bottom navigation dan tabel kompleks menjadi card list.
- Shell halaman terproteksi wajib memakai `app/components/navbar/LeftNavBar.jsx` sebagai sidebar permanen pada desktop (`lg` ke atas), `app/components/navbar/MobileLeftNavBar.jsx` sebagai drawer pada tablet/mobile (`lg` ke bawah), dan `app/components/navbar/TopMenu.jsx` sebagai topbar bersama. Keduanya wajib memakai sumber menu dan renderer sidebar yang sama agar hak akses, status aktif, dan tampilan tidak berbeda antar-device.
- Tombol notifikasi di `TopMenu` tetap ditampilkan sebagai placeholder sampai modul notifikasi SITOU dikembangkan, tetapi dilarang menambahkan polling, request API, badge jumlah, popover data, atau event notifikasi lama. SITOU tidak memakai tombol pengganti tema light/dark.
- Tombol kanan akun di `TopMenu` adalah Pengaturan berikon roda gigi. Pop-up hanya memuat Profil dan Keluar tanpa nama, username, role, avatar, atau detail akun. Route `/profile` tidak masuk sidebar dan memakai identitas terpusat serta lifecycle loading navigasi.
- Responsive wajib diuji untuk desktop lebar, laptop, tablet, mobile besar, dan mobile kecil. Gunakan breakpoint yang stabil, hindari ukuran tetap yang membuat form/tabel terpotong, dan pastikan setiap halaman nyaman pada lebar 320px sampai desktop wide.
- Untuk setiap UI baru atau perubahan layout, verifikasi minimal pada viewport mobile 320/375px, tablet 768px, laptop 1024/1366px, dan desktop lebar. Pastikan tidak ada overflow horizontal, overlap, teks terpotong, atau tindakan utama yang sulit dijangkau.
- Asset logo resmi berada di `public/`: `logo-sitou-v2.png` untuk logo ikon/huruf, `logo-sitou-v1.png` untuk logo lengkap dengan tagline sesuai aset yang disediakan, dan `logo-sitou-v3.png` sebagai varian lengkap bertuliskan Sistem Informasi Tenaga Operasional Unit bila diperlukan untuk konteks produk.
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

- Katalog komponen berada di `app/components/README.md` dan wajib diperbarui setiap reusable component dibuat, dipindah, atau diubah kontraknya.
- Seluruh logo SITOU wajib memakai `app/components/branding/AppLogo.jsx`. Path aset hanya diubah melalui `APP_LOGO_ASSETS`; dilarang menulis path file logo langsung pada halaman atau komponen lain.
- Sebelum membuat komponen baru, cari fungsi yang sama di `app/components`. Jika sudah ada, perluas komponen tersebut dalam tanggung jawab yang sama; dilarang membuat duplikat.
- Reusable component diberi nama berdasarkan fungsi umum dan disimpan berdasarkan tanggung jawab, bukan berdasarkan nama menu pertama yang menggunakannya.
- Hanya ada satu modal shell umum, yaitu `app/components/modals/AppModal.jsx`. Modal khusus, preview, dan confirmation wajib menyusun `AppModal`.
- Komponen hanya boleh dihapus setelah seluruh import, pemanggilan dinamis, route, dan dokumentasi diperiksa.
- Form CRUD memakai dirty-state warning, validasi dekat field, mencegah submit ganda, dan menjelaskan dampak aksi berisiko.
- Form panjang yang memakai tab, step, atau collapse wajib menampilkan `Notification` pada setiap kegagalan validasi/simpan, menandai section bermasalah dengan state error yang jelas, membuka section tersebut, lalu menggulir dan memfokuskan field error pertama. Error tidak boleh hanya terlihat pada field yang sedang tertutup atau gagal diam-diam; penanda section harus hilang setelah isian terkait valid.
- Gunakan `PageHeader`, `DataToolbar`, `ResponsiveDataView`, `CompactInfoChip`, `RowActionMenu`, `ConfirmDialog`, select reusable, `Notification`, dan `LoadingBackdrop` sebelum membuat implementasi fitur sendiri. `CompactInfoChip` adalah satu-satunya chip untuk metadata dan status; dilarang membuat badge/chip reusable kedua dengan fungsi yang sama.
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
- Merah SITOU hanya menjadi aksen, primary action, active state, dan status penting. Permukaan utama memakai putih/abu netral dan teks gelap dari theme/token.
- Kontras teks normal minimal 4.5:1; teks besar, ikon penting, border interaktif, dan focus indicator minimal 3:1. Status selalu memakai label/ikon selain warna.
- Gunakan spacing scale `4, 8, 12, 16, 24, 32px`: ikon-teks 8-12px, antar-control 8-12px, antar-field 16-20px, panel/modal 16px mobile dan 20-24px desktop, halaman 16/24/32px, serta antar-section 24-32px.
- Target sentuh minimal 44x44px. Radius maksimal 8px kecuali avatar, status pill, dan elemen lingkaran. Shadow harus lembut dan tidak mendominasi.
- Teks harus terbaca, tidak bertumpuk dengan background/ikon, dan memakai wrap, ellipsis, atau tooltip sesuai konteks. Komponen tidak boleh berdempetan, overlap, keluar container, atau membuat horizontal page overflow.
- UI wajib diuji pada viewport 320, 375, 768, 1024, 1366, dan 1920px, browser zoom, keyboard navigation, focus order, overflow, overlap, kontras, serta safe area/keyboard mobile.
- Dilarang memakai orb, bokeh, gradient dekoratif, nested card, shadow tebal, radius berlebihan, palette satu nada, padding ekstrem, atau dekorasi yang mengurangi keterbacaan.
- Dashboard visual wajib memakai komponen reusable pada `app/components/dashboard` dan adapter ApexCharts terpusat. Dilarang mendefinisikan ulang konfigurasi theme, format tooltip Indonesia, responsive breakpoint, atau reduced motion pada setiap halaman.
- Grafik dashboard harus menjawab kebutuhan monitoring atau pengambilan keputusan, bukan menjadi dekorasi. Setiap grafik wajib memiliki judul, konteks, legend bila multi-seri, tooltip Bahasa Indonesia, tinggi stabil, serta state loading, kosong, dan error.
- Rentang awal dashboard wajib memakai 1 Januari tahun berjalan sampai hari ini. Pengguna tetap dapat memilih rentang lain maksimal 24 bulan melalui `RangePicker`.
- Dashboard tidak boleh terasa polos ataupun berlebihan. Kekayaan visual dibangun dari hierarchy, komposisi grid, iconography, status tint, microtrend, dan spacing; hindari gradient dekoratif, animasi terus-menerus, data label yang ramai, dan kartu bertingkat.
- Dataset dashboard wajib difilter berdasarkan role, organisasi, dan cakupan lokasi di backend. Data draft atau sensitif yang tidak berhak dilihat role dilarang dikirim ke browser hanya untuk disembunyikan di UI.
- Query agregasi dashboard wajib dikelompokkan tanpa N+1, memakai parameter SQL, cache singkat bila sesuai, dan diuji pada dataset representatif sebelum optimasi melalui index atau materialized view.
- Komposisi jenis kelamin, status pegawai, masa kerja, dan jenis kepegawaian pada dashboard adalah snapshot kondisi aktif saat ini; filter tanggal hanya memengaruhi tren, kontrak, disiplin, dan aktivitas. Snapshot tetap wajib mengikuti role, organisasi, serta cakupan lokasi actor di backend.
- Grafik dinamika pegawai tidak boleh mengulang snapshot status aktif. Gunakan arus pegawai baru dan pegawai keluar per periode, sedangkan kondisi aktif, masa percobaan, dan cuti tetap berada pada visual Status Pegawai.
- Dataset organisasi non-sensitif yang sudah tersedia pada dashboard ditampilkan konsisten untuk HRD dan Pimpinan. Perbedaan role hanya diterapkan pada mutation, cakupan data, serta data draft/sensitif yang memang dilarang dikirim kepada role tertentu.
- Adapter ApexCharts wajib menormalkan kategori kosong dan nilai nonnumerik sebelum render. Label `NaN`, `undefined`, atau sumbu kategori kosong dilarang tampil kepada pengguna.
- Item prioritas disiplin wajib menavigasi ke detail pegawai pada tab Disiplin melalui LoadingBackdrop dan mempertahankan scope organisasi Superadmin. Chip prioritas ditempatkan dekat nama data dengan jarak aman, sedangkan aksi detail memakai ikon mata, tooltip, dan aria-label yang jelas. Data tindakan draft tetap tidak boleh dikirim kepada Pimpinan.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
