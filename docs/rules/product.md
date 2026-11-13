# Produk, Pegawai dan aturan HRIS

Bagian terkait

- [Pegawai, penempatan dan lifecycle](#pegawai-penempatan-dan-lifecycle)
- [Wizard dan Draft Pegawai](#wizard-dan-draft-pegawai)
- [Import Pegawai SITOU](#import-pegawai-sitou)
- [Cuti dan izin](#cuti-dan-izin)
- [Rekap Cuti & Izin](#rekap-cuti--izin)
- [Export Cuti & Izin](#export-cuti--izin)
- [Disiplin dan sanksi](#disiplin-dan-sanksi)
- [Penerbitan dan penggantian sanksi](#penerbitan-dan-penggantian-sanksi)
- [Pemulihan sanksi dan penghapusan kasus](#pemulihan-sanksi-dan-penghapusan-kasus)
- [Tampilan laporan Sanksi Pegawai](#tampilan-laporan-sanksi-pegawai)
- [Filter sanksi pada Data Pegawai](#filter-sanksi-pada-data-pegawai)
- [Query dan laporan Pegawai](#query-dan-laporan-pegawai)
- [Aturan dashboard](#aturan-dashboard)
- [Dashboard Pegawai dan Inventaris](#dashboard-pegawai-dan-inventaris-1)
- [Riwayat aktivitas dashboard HRD](#riwayat-aktivitas-dashboard-hrd)

## Tujuan produk saat ini

Bangun dashboard HRIS multi-organisasi yang stabil untuk:

- Superadmin membuat organisasi, lokasi awal, akun HRD, dan cakupan akses.

- HRD mengelola seluruh profil, kontrak, penempatan, rolling, izin, absensi, dokumen, dan tindakan disiplin.

- Pimpinan memantau data dan histori pegawai tanpa mengubah administrasi HRD.

- Pegawai disiapkan sebagai role self-service untuk aplikasi web/mobile lanjutan.

- Absensi tahap awal masuk melalui import Excel/CSV dan koreksi HRD; mobile attendance dikembangkan setelah dashboard stabil.

Jangan membangun payroll, pengenalan wajah, atau keputusan sanksi otomatis kecuali ada permintaan dan aturan baru yang disetujui.

## Pegawai, penempatan dan lifecycle

### Struktur organisasi, cabang, dan divisi

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

#### Import pegawai multi-sheet

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

#### Filter daftar Pegawai

- Status perkawinan memakai MARITAL_STATUS_OPTIONS dan MARITAL_STATUS_VALUES yang sama dengan pendaftaran. Query maritalStatus opsional divalidasi server dan dipakai konsisten pada data, total, pagination serta ekspor. Tidak mengubah nilai profil, urutan nama/ID atau scope.

- Golongan darah pada daftar dan export memakai BLOOD_TYPE_OPTIONS yang sama dengan form (A/B/AB/O); tidak menambah klasifikasi baru atau mengubah data lama.

- Tanpa penempatan berada dalam Kelengkapan data dan memakai employeeWithoutAssignmentSql yang sama dengan Dashboard: status aktif/masa percobaan, tanpa penempatan utama yang berlaku hari ini. Penempatan tambahan, masa depan, dan yang sudah berakhir tidak memenuhi penempatan utama saat ini. Scope HRD terpilih tetap membatasi akses; filter ini tidak memberikan akses ke Pegawai di luar scope. Filter daftar, total, pagination, dan export harus konsisten.

## Wizard dan Draft Pegawai

### Alur Pengguna

Wizard tambah pegawai terdiri dari empat langkah: `Profil`, `Pendidikan`, `Kontrak`, dan `Penempatan`. Setiap step hanya menampilkan field miliknya. Perubahan disimpan ke draft privat saat pengguna menekan `Lanjut`, `Kembali`, atau `Simpan draft & tutup`; pengetikan field tidak mengirim request ke server. Draft aktif dipulihkan ketika modal dibuka kembali, termasuk setelah refresh atau login ulang.

Draft berlaku tujuh hari dan hanya dapat dibaca atau diubah oleh pembuatnya pada organisasi yang sama. Tombol `Mulai ulang` menandai draft lama serta file staging sebagai terhapus, lalu membuat draft kosong.

KTP dan pas foto bersifat opsional. KTP menerima JPEG, PNG, WebP, atau PDF maksimal 5 MB; pas foto menerima JPEG, PNG, atau WebP maksimal 5 MB. Pendaftaran awal boleh tanpa nomor/dokumen kontrak dan SK. Dokumen yang diisi tetap divalidasi; kontrak/penempatan baru di luar onboarding mengikuti workflow dokumen masing-masing. MIME diperiksa dari isi byte dan browser hanya menerima ID metadata file.

### Endpoint

- `GET/POST /api/employees/drafts`: mengambil atau membuat draft aktif.

- `PATCH/DELETE /api/employees/drafts/:id`: menyimpan checkpoint draft dengan version check atau membuang draft.

- `POST /api/employees/drafts/:id/files`: upload staging KTP, pas foto, PDF kontrak, atau PDF SK.

- `DELETE /api/employees/drafts/:id/files/:fileId`: soft delete file staging.

- `POST /api/employees/drafts/:id/submit`: finalisasi idempotent menjadi pegawai.

Finalisasi memvalidasi ulang payload, organisasi, referensi master, dan file dalam backend. Profil, kontak, kontrak, penempatan, referensi pas foto, serta relasi dokumen KTP opsional dibuat dalam satu transaksi. File staging kemudian dialihkan ke pegawai tanpa pernah mengirim `object_key` ke browser.

### Operasional

Jalankan `npm run employee-drafts:expire` melalui scheduler harian. Proses hanya mengubah draft kedaluwarsa menjadi `expired` dan melakukan soft delete metadata staging; penghapusan byte fisik tetap mengikuti retention storage.

### Usia dan tanggal akhir kontrak

Rujukan: [Usia dan tanggal akhir kontrak](data.md#usia-dan-tanggal-akhir-kontrak).

### Jadwal kerja awal

Bagian Jadwal kerja tetap di langkah 4 Penempatan; tidak menambah langkah. Pilih Atur jadwal nanti atau Pilih jadwal kerja. Daftar memuat jadwal tetap dan pilihan Nama jadwal — Nama shift. Pilih satu shift yang akan dijalani Pegawai, bukan seluruh kelompok. Ketika dipilih, tampilkan ringkasan hari/jam/libur, Mulai berlaku, Berakhir (opsional), serta Tanggal hari pertama putaran hanya untuk pola rotasi lama. Jenis baru tidak memerlukan tanggal putaran. Tanggal awal mengikuti nilai yang lebih akhir antara hari ini organisasi dan tanggal bergabung; isian draft yang sudah ada tidak ditimpa. Pengguna tanpa Kelola Jadwal Pegawai tetap dapat mendaftar sesuai hak existing dan melihat petunjuk untuk HRD berizin.

Pilihan shift kelompok menggunakan ID pola anggota existing. Bentuk workSchedule {patternId,from,until?,anchorDate?} disimpan/dipulihkan bersama draft; Atur jadwal nanti dikirim sebagai null. Pilihan organisasi lama dibersihkan saat organisasi berubah. Finalisasi profil dan penetapan tetap satu transaksi; gagal jadwal membatalkan profil parsial. Payload lama tanpa jadwal dan import tetap kompatibel. Pegawai existing memakai Kepegawaian → Jadwal Pegawai atau tab Jadwal kerja detail Pegawai. Lihat work-schedules.md.

Status perkawinan pada Data Pegawai menggunakan pilihan yang sama dengan pendaftaran: Belum Menikah, Menikah, Cerai Hidup dan Cerai Mati. Filter hanya menyaring daftar serta ekspor. Menghapus pilihan atau Atur ulang menampilkan seluruh status, termasuk nilai kosong, tanpa mengubah profil.

#### Jadwal dan aktivasi Fitur Absensi

Pilihan jadwal langkah 4 Penempatan memerlukan Fitur Absensi organisasi aktif dan hak kelola Jadwal Pegawai. Saat nonaktif, HRD tetap dapat mendaftarkan profil tanpa jadwal. Panel informasi menjelaskan aktivasi melalui Superadmin → Organisasi. Payload lama/draft yang masih meminta penetapan jadwal ditolak server ketika fitur telah dimatikan, sehingga tidak ada bypass melalui browser lama. Profil dan penetapan tetap satu transaksi. Mengaktifkan fitur tidak memberi grant pendaftar secara otomatis.

## Import Pegawai SITOU

Template versi 3 memakai pilihan Lokasi berdasarkan nama dan lokasi induk bila ada. Pilihan menyertakan ID lokasi yang dicocokkan server dalam organisasi aktif. Unduh template baru dan pilih ulang lokasi untuk data yang berasal dari template lama. Batch yang sudah tervalidasi memakai ID lokasi tersimpan.

### Cakupan

SITOU menerima satu workbook `.xlsx` maksimal 10 MB. Workbook memuat `Petunjuk`, `Pegawai`, `Kontak`, `Identitas`, `Rekening`, `Keluarga`, `Kontak_Darurat`, `Akun_Sosial`, `Pendidikan`, `Keahlian`, `Sertifikasi`, `Kontrak`, `Penempatan`, dan hidden sheet `Referensi`.

`NIP` menghubungkan seluruh sheet. Sheet `Kontrak` dan `Penempatan` dapat memiliki beberapa baris untuk menyimpan histori tanpa menimpa periode lama. Referensi seperti `KON-001` dan `PEN-001` harus unik dalam workbook.

Import tidak memproses akun login, foto, dokumen, kasus disiplin, tindakan sanksi, absensi, atau payroll. Pas foto, scan identitas, sertifikat, kontrak bertanda tangan, dan dokumen lain diunggah manual melalui detail pegawai setelah import berhasil.

### Sheet Wajib dan Opsional

| Sheet                                       | Status          | Penggunaan                                                                                                                                         |
| ------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pegawai`                                   | Wajib           | Selalu diisi satu baris per pegawai. NIP, nama lengkap, NIK 16 digit, dan status wajib tersedia.                                                   |
| `Kontrak`                                   | Wajib bersyarat | Wajib untuk pegawai berstatus aktif atau masa percobaan (`active` atau `probation`); dapat memuat histori kontrak yang periodenya tidak bertumpuk. |
| `Penempatan`                                | Wajib bersyarat | Wajib untuk pegawai berstatus aktif atau masa percobaan (`active` atau `probation`); dapat memuat histori rolling, promosi, demosi, atau mutasi.   |
| `Kontak`, `Identitas`, `Rekening`           | Opsional        | Diisi bila data administratif tersebut tersedia.                                                                                                   |
| `Keluarga`, `Kontak_Darurat`, `Akun_Sosial` | Opsional        | Keluarga menyimpan hubungan dan tanggungan; seluruh nomor yang dapat dihubungi hanya diisi pada `Kontak_Darurat`.                                  |
| `Pendidikan`, `Keahlian`, `Sertifikasi`     | Opsional        | Diisi untuk melengkapi kompetensi dan riwayat pegawai; file sertifikat tetap diunggah manual.                                                      |

Sheet opsional yang tidak diperlukan boleh dibiarkan kosong dan tidak menghalangi proses import. Seluruh petunjuk workbook dan modal bersumber dari definisi yang sama agar status pengisian tetap konsisten.

### Identitas dan Duplikasi

- NIK wajib berisi tepat 16 digit.

- NIP dinormalisasi dengan trim dan uppercase; NIK disimpan sebagai digit canonical.

- NIP atau NIK yang sama dalam workbook membuat seluruh data pegawai terkait invalid.

- Pemeriksaan database mencakup pegawai aktif, nonaktif, dan soft-deleted.

- Commit memeriksa ulang identitas dalam transaction lock. Unique index database mencegah dua request bersamaan membuat data ganda.

- Nama bukan kunci unik karena orang berbeda dapat memiliki nama yang sama.

### Alur Pengguna

1. Unduh template organisasi agar sheet `Referensi` berisi master aktif yang boleh digunakan.

2. Isi sheet `Pegawai`, lalu gunakan NIP yang sama pada sheet terkait.
   Kolom yang berbentuk pilihan di aplikasi juga memakai dropdown pada Excel, termasuk jenis
   kelamin, status perkawinan, golongan darah, status pegawai, jenis identitas, hubungan keluarga,
   platform akun sosial, jenjang pendidikan, tingkat keahlian, status kontrak, serta klasifikasi
   penempatan. Pilihan master organisasi menampilkan kode dan nama, misalnya
   `PUSAT - Kantor Pusat`.

3. Hapus seluruh baris contoh `CONTOH-001`.

4. Upload workbook dan tunggu validasi; tahap ini belum menulis data pegawai final.

5. Periksa ringkasan per pegawai dan unduh laporan kesalahan bila diperlukan.

6. Klik `Impor pegawai valid`. Pegawai invalid dilewati dan dapat diajukan kembali setelah diperbaiki.

7. Lengkapi foto dan dokumen melalui detail pegawai.

Commit atomik per pegawai. Kegagalan satu pegawai tidak menggagalkan pegawai valid lain dan retry batch tidak menggandakan data yang sudah berhasil.

### Keamanan dan Endpoint

Server memeriksa signature file, struktur OOXML, jumlah entry, ukuran hasil ekstraksi, macro, external link, embedded object, enkripsi, formula, header, tipe data, batas panjang, tanggal, enum, referensi organisasi, dan cakupan HRD. Batas per workbook adalah 5.000 pegawai dan 50.000 baris data.

- `GET /api/employees/imports/template?organizationId=...`: template organisasi.

- `POST /api/employees/imports`: multipart `file` dan organisasi target khusus Superadmin.

- `GET /api/employees/imports/:id`: preview batch per pegawai.

- `GET /api/employees/imports/:id/errors`: laporan kesalahan `.xlsx`.

- `POST /api/employees/imports/:id/commit`: commit idempotent per pegawai.

Semua endpoint memerlukan permission import dan isolasi organisasi. File sumber disimpan privat menggunakan UUID. Audit dan log tidak memuat NIK atau payload sensitif.

### Keselarasan Pilihan

- Label dropdown Excel mengikuti Bahasa Indonesia yang tampil pada form aplikasi.

- Parser menormalisasi label tersebut ke kode stabil API/database. Template lama yang masih
  memakai kode canonical tetap dapat divalidasi.

- Status pegawai untuk import baru hanya `Aktif`, `Masa percobaan`, `Cuti`, dan `Ditangguhkan`.
  Status akhir hubungan kerja tidak tersedia karena wajib dicatat melalui workflow terkonfirmasi.

- Dropdown `Atasan Langsung` berisi NIP dan nama pegawai aktif organisasi. NIP pegawai baru yang
  berada dalam workbook yang sama tetap dapat dikenali oleh validasi server bila diisi sebagai kode.

- Hubungan keluarga memakai pilihan terstruktur. Hubungan pada kontak darurat tetap berupa teks
  bebas, sama seperti form aplikasi.

- Kolom tanggal memakai validasi Excel dan format `dd mmm yyyy`; teks bebas yang
  bukan tanggal ditolak. Untuk menghindari perbedaan regional Excel, pengguna mengetik format ISO
  `YYYY-MM-DD`, misalnya `1994-02-21`. Nilai tanggal native Excel juga tetap diterima. Template tidak
  memakai macro atau add-in.

- Tahun kelulusan hanya menerima angka tahun dari 1900 sampai tahun berjalan.

### Usia dan tanggal akhir kontrak

Rujukan: [Usia dan tanggal akhir kontrak](data.md#usia-dan-tanggal-akhir-kontrak).

Rujukan: [Usia dan tanggal akhir kontrak](data.md#usia-dan-tanggal-akhir-kontrak).

## Cuti dan izin

### Cuti dan izin

- Kartu mobile daftar Cuti & Izin memakai identitas pegawai dengan NIP berlabel, status/kategori terpisah, serta ReportCardFields untuk nomor, jenis, tanggal mulai/selesai, durasi bersatuan, penempatan dan jumlah lampiran. Jangan menggabungkan NIP/nomor atau periode/durasi dalam satu baris metadata. Aksi berada pada footer kartu melalui RowActionMenu berlabel dan selebar kartu; target tombol serta item menu minimal 44px. Bingkai, nomor urut, tipografi mobile dan pagination tetap dari ResponsiveDataView. Tabel desktop, data sumber, hak akses dan workflow persetujuan/pembatalan tidak berubah karena perbaikan tampilan.

- Identitas pada Rekap Cuti & Izin memakai ID pas foto profil aktif yang sama dengan Kepegawaian, melalui endpoint file privat dan ImagePreviewModal. Grant laporan boleh membaca pas foto pada organisasi/scope pegawai yang sama, tanpa membuka dokumen identitas, lampiran pribadi, atau mutation file. Saldo desktop memakai kolom terpisah Hak/Terpakai/Sisa; mobile memakai LeaveBalanceFields dengan label serta satuan yang sama. Jangan menyembunyikan Hak/Terpakai sebagai metadata kecil atau mengubah perhitungan ledger demi tampilan.

- Halaman Rekap Cuti & Izin berfokus pada filter dan tabel, tanpa kartu ringkasan atau grafik yang sudah tersedia di Dashboard. Filter Cari pegawai berada sebelum Tahun. Dataset agregat boleh tetap digunakan untuk Excel tiga sheet.

- Laporan **Rekap Cuti & Izin** (`leave-summary-report`) memiliki grant read-only terpisah dari menu operasional. Kartu, grafik jenis/bulan, baris pegawai–jenis, rincian, dan Excel memakai cohort berizin yang sama: penempatan utama saat ini, tanggal mulai pada tahun organisasi, status approved/cancelled terpisah, tanpa draft atau alasan/lampiran pribadi. Durasi penuh sesuai persetujuan; hari/jam tidak dijumlahkan. Saldo dari ledger entitlement tahun pilihan, posisi terkini; hak termasuk carryover/koreksi, pemakaian bersih setelah restoration, tanpa entitlement jangan mengarang saldo. Rincian melalui modal report-only. Batas Excel 5.000 baris, audit, no-store, dan cursor terikat scope wajib. Aturan rinci: `docs/rules/product.md`.

- Export pada daftar Cuti & Izin memakai `GET /api/leave-requests/export`, permission `leave_requests.read`, filter dan scope lokasi yang sama dengan daftar. Excel memuat seluruh hasil maksimal 5.000 data tanpa pemotongan diam-diam; NIP berupa teks, durasi angka bulat beserta satuan. Alasan pribadi, data medis, dan lampiran tidak diekspor. Unduhan diaudit dan private/no-store. PDF memakai notifikasi Coming soon melalui TableExportMenu. Lihat `docs/rules/product.md`.

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

Rekap Cuti & Izin: label Durasi cuti/izin; seluruh header dan sel tabel dibatasi garis tipis, termasuk ketiga subkolom Hak/Terpakai/Sisa. Sisa memakai CompactInfoChip: hijau tersedia, kuning ketika positif maksimal 25% hak, merah saat nol/habis atau negatif. Ini indikator tampilan, bukan aturan persetujuan. Jenis tanpa saldo tidak diberi indikator saldo. Modal Rincian rekap menampilkan identitas, ringkasan angka dan saldo, serta daftar kartu kejadian dengan navigasi keyset lima data per halaman. Jangan memakai modal operasional satu kejadian atau tabel bersarang untuk rincian rekap. Excel memakai header saldo dua tingkat dan sheet rincian report-only dari snapshot/filter/scope yang sama, batas 5.000 masing-masing tanpa pemotongan.

## Rekap Cuti & Izin

Menu **Laporan → Rekap Cuti & Izin** memakai ikon dokumen bertanda centang. Menu **Kepegawaian → Cuti & Izin** tetap untuk administrasi per kejadian. Rekap tidak membuat atau mengubah keputusan, saldo, maupun data pegawai.

### Isi

- Filter nama/NIP sebelum tahun, lokasi, Divisi & Unit, jenis, serta organisasi eksplisit untuk Superadmin. Dropdown pilihan memakai `AsyncSelect` dengan pencarian label; tahun memakai input kalender tahun.
- Halaman hanya menampilkan filter, keterangan singkat, dan tabel rekap. Kartu ringkasan/grafik berada di Dashboard; tidak diulang pada halaman laporan. Agregat jenis/bulan tetap tersedia untuk Excel empat sheet.
- Satu baris per pasangan pegawai–jenis: jumlah disetujui, durasi, pembatalan, hak disesuaikan, terpakai bersih, dan sisa saldo. Pasangan dengan entitlement tanpa pengajuan juga tampil.
- Pegawai memakai pas foto profil yang sama dengan Kepegawaian melalui ID file privat; klik atau Enter pada avatar membuka ImagePreviewModal. File yang dihapus/tidak tersedia memakai inisial. Grant laporan hanya mengizinkan preview pas foto pada scope pegawai yang sama, bukan KTP, dokumen pribadi, atau perubahan file.
- Pada desktop, Saldo tahun pilihan dikelompokkan menjadi tiga kolom **Hak**, **Terpakai**, **Sisa**. Angka dan satuan tampil utuh; Sisa memakai CompactInfoChip: tersedia hijau, menipis kuning ketika positif dan maksimal 25% hak, habis merah pada nol, saldo negatif merah. Indikator ini hanya tampilan dan tidak memengaruhi persetujuan. Seluruh header dan sel tabel memakai garis pembatas tipis, termasuk setiap subkolom Hak/Terpakai/Sisa. Tooltip judul menerangkan hak dengan saldo bawaan/koreksi dan pemakaian bersih. Mobile memakai tiga nilai berlabel melalui LeaveBalanceFields. Tanpa entitlement tampil Saldo belum tersedia; jenis tanpa saldo menampilkan Tidak menggunakan saldo.
- Ikon mata membuka Rincian rekap cuti & izin: identitas pegawai dan penempatan saat ini, ringkasan Disetujui/Durasi cuti/izin/Dibatalkan, saldo tahun pilihan, serta daftar kartu kejadian berisi nomor, status, periode, dan durasi. Daftar memakai keyset lima data per halaman, tanpa tabel bersarang atau modal administrasi satu kejadian. Pembatalan tidak masuk jumlah/durasi disetujui. Loading, kosong, dan error dibedakan. Tanpa alasan pribadi, catatan medis, dokumen, atau tautan administrasi berizin lain.
- Excel memuat empat sheet: Rekap pegawai, Rincian cuti izin, Rekap jenis, Rekap bulanan. Header rekap dua tingkat dengan Saldo tahun pilihan menaungi Hak/Terpakai/Sisa, dan label Durasi cuti/izin sama dengan UI. Rincian memuat data modal report-only dari cohort dan snapshot SQL yang sama. Rekap dan rincian masing-masing maksimal 5.000 baris; kelebihan ditolak tanpa pemotongan. PDF menampilkan Coming soon melalui komponen bersama.

### Perhitungan

Tahun mengikuti **tanggal mulai** cuti/izin pada zona waktu organisasi. Contoh: mulai 31 Desember 2026 dan selesai Januari 2027 tetap masuk rekap 2026 dengan seluruh durasi persetujuannya. Ini rekap keputusan/penggunaan tercatat, bukan rekap kehadiran atau jumlah hari kalender dalam bulan.

Status `approved` masuk jumlah dan durasi disetujui. `cancelled` hanya masuk pembatalan. Draft, menunggu, dan ditolak tidak dihitung. Riwayat resmi pegawai berstatus final tetap tersedia selama profil belum dihapus logis.

Cakupan pegawai dan filter lokasi/unit mengikuti **penempatan utama yang berlaku pada tanggal organisasi saat laporan dibaca**; tanpa penempatan tidak masuk scope HRD selected. Pengaturan ini sama untuk kartu, jenis, bulan, baris, rincian, dan Excel. Penempatan historis pada awal kejadian masih dapat dilihat pada halaman operasional sesuai izin terpisah.

Saldo mengambil entitlement dengan tahun `period_start` sesuai pilihan, sebagaimana ringkasan saldo pada detail pegawai. Semua transaksi ledger entitlement dijumlahkan:

- Hak disesuaikan = grant + carryover + adjustment.
- Terpakai bersih = negatif dari usage + restoration.
- Sisa = seluruh ledger, tanpa menimpa saldo atau menghitung ulang kalender.

Saldo adalah posisi terkini entitlement tahun terpilih pada `asOf`, bukan snapshot akhir tahun. Tanpa entitlement tampil Belum ada saldo, bukan angka nol dari annual allowance. Jenis tanpa saldo ditandai Tanpa saldo. Durasi yang disetujui dan pemakaian ledger dapat berbeda untuk jenis tanpa saldo atau saldo yang dikoreksi; keduanya diberi label berbeda.

### API dan akses

- `GET /api/reports/leave-summary`: filter `year`, `organizationId`, `search`, `employeeId`, `leaveTypeId`, `locationId`, `organizationUnitId`, `pageSize`, `cursor`. Default tahun organisasi. Respons private/no-store berisi summary, types, months, rows, total, filter options, nextCursor.
- `view=details` wajib `employeeId` dan `leaveTypeId`; mengembalikan rincian resmi berizin dengan keyset pagination.
- `GET /api/reports/leave-summary/export`: filter sama, view pegawai, pagination diabaikan; detail_rows/detail_total hanya diminta untuk export dalam statement yang sama; XLSX private/no-store/nosniff, audit `report.export` dengan entity `leave-summary` sebelum dikirim.
- Menu `leave-summary-report` bersifat read-only dan terpisah dari `leave-requests`. HRD terdelegasi wajib mendapat grant laporan eksplisit. Grant laporan tidak membuka administrasi cuti, alasan, lampiran, saldo mutation, atau profil lengkap. Admin HRD penuh, Pimpinan, dan Superadmin mengikuti aturan role yang ada.
- Backend memeriksa session, menu HRIS, permission role `leave_requests.read`, organisasi session, dan scope lokasi. Superadmin memilih satu organisasi. Cursor terikat filter, organisasi, scope, dan tanggal acuan.
- Setiap respons laporan dibangun dari satu statement SQL: kartu, grafik, saldo, total, dan baris memakai snapshot yang sama. Tidak ada N+1.
- Migration `058` mendaftarkan menu read-only tanpa memberikan grant baru kepada HRD terdelegasi. Bootstrap mencerminkan seed yang sama. Tidak ada tabel bisnis baru.

### Pemeriksaan

Gunakan database sintetis terpisah. Bandingkan kartu/jenis/bulan/baris/Excel, ledger grant–pemakaian–pembatalan–koreksi, hari/jam, jenis nol/nonaktif, batas tahun organisasi, periode lintas tahun, saldo tanpa pengajuan, keyset, hak laporan saja dan operasional saja, isolasi organisasi/lokasi, batas export, audit, modal, keyboard, layar 320–1920px, serta query plan. File dan database uji sementara wajib dibersihkan.

## Export Cuti & Izin

Pada Kepegawaian → Cuti & Izin, tombol Export berada di header Daftar cuti dan izin. Excel mengunduh semua hasil filter, bukan hanya halaman yang terlihat. Pilihan PDF menampilkan notifikasi Coming soon; belum membuat file PDF.

### API

`GET /api/leave-requests/export` menerima filter yang sama dengan `GET /api/leave-requests`: organisasi, pegawai, jenis, lokasi, Divisi & Unit, jabatan, status, kategori, periode, sumber, saldo, lampiran, status pegawai, tanggal, pencarian dan urutan. Pagination diabaikan saat export. Rentang tanggal memakai periode yang beririsan seperti daftar; durasi merupakan durasi penuh setiap cuti/izin, bukan durasi yang dipotong pada batas filter.

- Wajib session dan permission `leave_requests.read`; organisasi diperiksa server dan scope lokasi mengikuti penempatan pada awal cuti/izin seperti daftar.
- Maksimal 5.000 data. Hasil lebih banyak ditolak dengan `LEAVE_EXPORT_LIMIT`, HTTP 400, disertai arahan mempersempit filter.
- Data dan total dibaca dalam satu snapshot repeatable read. Workbook dibuat setelah transaksi baca selesai; ekspor dicatat sebagai audit `leave_request.export` sebelum dikirim.
- Respons XLSX memakai private/no-store, nosniff, dan nama `sitou-cuti-izin-YYYY-MM-DD.xlsx` menurut tanggal organisasi.
- Kolom: nomor cuti/izin, NIP, nama, jenis, kategori, tanggal mulai/akhir, durasi, satuan, lokasi, Divisi & Unit, jabatan, status.
- NIP/nomor tetap teks; durasi angka bulat tanpa titik tambahan. Nilai berawalan formula diperlakukan sebagai teks literal. Alasan pribadi, data medis, dokumen, dan URL file tidak disertakan.

### Verifikasi

Gunakan database sementara dan data sintetis: bandingkan seluruh hasil daftar dengan Excel meskipun daftar dipaginasi; uji filter tanggal/status/pegawai, scope lokasi, organisasi berbeda, tanpa izin, hasil kosong, batas 5.000, format NIP dan durasi, serta audit. Pada browser periksa unduhan Excel dan notifikasi PDF pada desktop/mobile. Hapus seluruh fixture dan skrip sementara setelah pengujian berhasil.

## Disiplin dan sanksi

### Disiplin berdasarkan Peraturan Perusahaan

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

- Tanggal tindakan wajib mengikuti tanggal kejadian <= tanggal terbit <= mulai
  berlaku, termasuk draft. Saat Aktif, tanggal terbit/mulai tidak boleh melewati
  hari ini di zona organisasi; tanggal mendatang hanya draft. Kalender menonaktifkan
  tanggal di luar batas, form memvalidasi ketergantungan field, dan service memeriksa
  ulang tanggal kejadian dari kasus yang dikunci saat create/edit/penerbitan draft.
  Jangan menyesuaikan tanggal pengguna diam-diam atau mengubah keputusan resmi lama.

Sistem hanya membentuk `discipline_indicators`. HRD harus:

1. Meninjau bukti.

2. Membuka `discipline_cases` bila layak.

3. Mencatat klasifikasi dan penjelasan pegawai.

4. Mengunggah surat untuk tindakan tertulis.

5. Menerbitkan `disciplinary_actions`.

Dilarang membuat job yang otomatis mengubah indikator menjadi SP/PHK. Direct SP2/SP3 wajib menyimpan `direct_escalation=true` dan alasan. Dokumen dan uraian kasus hanya boleh terlihat oleh role berwenang.

Lifecycle tindakan disiplin wajib mempertahankan histori: status `draft` masih dapat diedit dan boleh belum memiliki surat lengkap; perubahan ke `active` memvalidasi ulang nomor serta PDF tindakan tertulis. Tindakan `active` dilarang ditimpa atau dihapus. Pencabutan `revoked` wajib beralasan dengan pelaku/waktu/audit; penerbitan sanksi baru dapat mengubah keputusan aktif sebelumnya menjadi `superseded` dalam transaksi terkonfirmasi, sementara masa berlaku lewat menjadi `expired`. Seluruh data dan dokumen asal tetap tersimpan.

## Penerbitan dan penggantian sanksi

### Aturan pilihan

Jenis yang sama (ID jenis) tidak dapat dipilih selama keputusan terkait masih aktif dan tanggal berlakunya mencakup hari ini menurut timezone organisasi. Tahapan bawaan teguran lisan → SP1 → SP2 → SP3 tidak dapat turun atau diulang selama tahapan yang sama/lebih tinggi masih berlaku. Jenis lain seperti skorsing, penurunan jabatan, dan jenis tambahan tidak diberi urutan dari nama atau kode tampilan; keputusan tetap pada HRD. Rename jenis dengan ID yang sama tidak melewati larangan duplikasi. Jenis nonaktif tetap terlihat dengan alasan, tidak dapat dipilih.

Setelah sanksi berakhir/dicabut/digantikan, larangan berdasarkan sanksi tersebut tidak berlaku. Pengurangan tingkat keputusan aktif harus melalui proses pencabutan beralasan terlebih dahulu; jangan menerbitkan teguran baru untuk menghapus SP3 aktif secara terselubung. Ini kebijakan produk SITOU berdasarkan alur bertahap internal, bukan klaim fitur Talenta atau aturan universal HRIS. SP2/SP3 tanpa tahap sebelumnya yang masih berlaku memerlukan pilihan penerbitan langsung dan alasan, diperiksa ulang pada publikasi server. SP3 tidak otomatis mengakibatkan PHK; jenis lain dan keputusan lanjutan tetap ditinjau HRD.

### Konfirmasi

Form membaca konteks kasus berizin saat dibuka dan sekali lagi sebelum simpan. Saat status baru Aktif dan masih ada sanksi berjalan, form disembunyikan sementara dan ConfirmDialog bersama menampilkan nama/masa berlaku keputusan lama serta nama jenis baru. Pesan: Sanksi baru akan menggantikan sanksi lama berikut. Surat dan riwayat sanksi lama tetap tersimpan. Kedua keputusan ditampilkan dalam blok berstruktur sama dengan label Sanksi lama (warning) dan Sanksi baru (info), nama serta masa berlaku. Sanksi lama berada lebih dahulu; periode keputusan baru dihitung dari pilihan form yang dikonfirmasi. Batal kembali ke form dengan nilai dan file tetap terjaga. Tidak ada dua modal bertumpuk. Menyimpan draft tidak mengganti keputusan lama.

Tanggal mendatang hanya boleh disimpan sebagai draft karena scheduler penerbitan belum tersedia; jangan menghentikan sanksi aktif sebelum keputusan baru mulai berlaku. Histori lama bertanggal mendatang tidak diubah menjadi Digantikan oleh penerbitan hari ini.

### API dan transaksi

#### Urutan tanggal tindakan

Draft dan tindakan resmi wajib memenuhi tanggal kejadian ≤ tanggal terbit ≤ mulai
berlaku. Tanggal kejadian dibaca dari kasus berizin pada konteks form dan dibaca
ulang di bawah lock kasus saat create/edit/penerbitan. Hari ini memakai zona waktu
organisasi. Status Aktif tidak menerima tanggal terbit atau mulai mendatang;
status Draft tetap boleh memakai tanggal mendatang dengan urutan yang benar.

Kalender menonaktifkan tanggal sebelum batas yang sesuai dan tanggal mendatang
saat Aktif. Validator field serta schema/service memakai aturan bersama pada
`issuancePolicy.mjs`; validasi server tetap berlaku untuk request yang melewati
UI. Tanggal kalender tidak nyata ditolak schema ISO. Jika tanggal terbit/status
diubah sehingga tanggal lain invalid, tampilkan error dan pertahankan isian,
termasuk lampiran; jangan mengubah tanggal pengguna otomatis. Form baru memakai
hari ini dari server (atau tanggal kejadian jika lebih kemudian) sebagai nilai
awal, sedangkan edit draft mempertahankan tanggal tersimpan sampai dikoreksi.
Keputusan resmi lama tidak diubah oleh perubahan validasi ini; tidak ada migration
atau koreksi massal tanggal historis.

GET /api/discipline/cases/:id/actions memerlukan discipline.manage dan akses pegawai dalam organisasi/scope, dengan no-store. Organisasi dipetakan/divalidasi dari sesi. DTO: today, incidentDate (tanggal kejadian dari kasus), activeActions (ID, ID jenis, snapshot nama, tanggal, nomor surat), actionTypes dengan disabled_reason. system_key hanya untuk aturan tahap bawaan, tidak menjadi label pengguna.

POST endpoint yang sama dan PATCH /api/discipline/actions/:id menerima replacementActionIds (default []). Server mengunci pegawai lebih dahulu untuk menserialisasi penerbitan lintas kasus, kemudian membaca/mengunci keputusan berjalan. Larangan jenis/tahap diterapkan juga di backend untuk draft dan publikasi. Publikasi mengharuskan daftar ID yang dikonfirmasi sama dengan keputusan berjalan pada transaksi. Perubahan serentak menolak simpan dengan ACTION_CONFIRMATION_CHANGED dan meminta tinjau ulang. Payload klien tidak menentukan daftar keputusan yang diubah. Penggantian, penerbitan dan audit tetap atomik; surat lama tidak dihapus. Pencabutan dan scope existing tetap berlaku.

Tidak ada migration, perubahan schema database, permission HRIS generik baru, atau sanksi otomatis dari indikator. Metadata konfirmasi bukan kolom baru.

### Verifikasi

Uji sementara memakai database QA terpisah dari schema bootstrap dan fixture sintetis, lalu dihapus. Skenario: teguran aktif → SP1 draft → SP1 terbit terkonfirmasi; jenis sama ditolak; SP3 aktif memblokir tahap bawah, jenis lain tetap bisa dipilih; pencabutan membuka kembali pilihan; konfirmasi lama ditolak; tanggal masa depan ditolak untuk publikasi; dua penerbitan paralel hanya satu berhasil; audit penggantian dipertahankan.

Pemeriksaan akhir: npm run lint/build lulus. Browser Chrome pada 320/375/768/1024/1366/1920px dan layar pendek 320×568 memverifikasi pilihan dinonaktifkan, satu modal konfirmasi, tombol fullwidth mobile berjarak aman, batal mempertahankan status/nomor surat/PDF, tidak ada mutation saat batal, dan konflik konfirmasi kembali ke form. GET konteks nyata no-store, kasus dari organisasi yang salah tidak terbaca, akun Pegawai ditolak. Fixture mutation hanya di browser; database aplikasi tidak diubah. Uji database QA juga memverifikasi eskalasi langsung wajib dan penerbitan paralel saat FK memegang KEY SHARE; lock NO KEY UPDATE mencegah konflik lock upload. Database QA, script dan server uji dibersihkan setelah pemeriksaan.

Verifikasi perapian konfirmasi: label Sanksi lama/Sanksi baru pada dua blok seragam, periode keduanya, urutan lama lalu baru, deskripsi rata kiri, satu modal, Batal kembali ke form tanpa mutation; browser 320–1920px dan layar pendek lulus. ESLint terarah dan build lulus. Artefak dan server uji dibersihkan.

Header blok perbandingan memakai dua kolom: nama sanksi di kiri dan chip Sanksi lama/baru di kanan, sejajar tengah dalam baris yang sama. Nama panjang membungkus di kolom teks; chip mengikuti isi. Masa berlaku tetap di bawah header.

## Pemulihan sanksi dan penghapusan kasus

### Pemulihan setelah pencabutan

Migration `063` menyimpan hubungan penggantian pada
`disciplinary_action_replacements`, dengan foreign key organisasi dan pegawai.
Saat penerbitan mengganti sanksi berjalan, hubungan pendahulu–pengganti ditulis
dalam transaksi penerbitan yang sama.

Saat pengganti dicabut, server menelusuri seluruh rantai penggantian yang tercatat.
Hanya satu pendahulu terdekat berstatus `superseded` yang tanggal berlakunya masih
mencakup hari ini menurut zona waktu organisasi yang dipulihkan. Jika pendahulu
langsung sudah berakhir atau dicabut, penelusuran berlanjut ke pendahulunya;
sanksi dicabut tidak ikut diaktifkan. Pada jarak sama, tanggal terbit dan ID terbaru
menjadi pembeda. ID yang telah dilalui tidak ditelusuri ulang untuk mencegah siklus.
Pemulihan tidak dilakukan bila ada keputusan lain yang masih berjalan. Tanggal
awal, tanggal akhir, surat, dan snapshot keputusan tidak diubah. Sanksi yang tidak
memiliki hubungan tercatat tidak ditebak dari tanggal atau nama.

`GET /api/discipline/actions/:id/revoke` memberikan pratinjau berizin
`discipline.manage`, organisasi, dan scope pegawai. Form alasan sementara ditutup
saat ConfirmDialog menampilkan kartu **Akan dicabut** dan **Berlaku kembali**.
Batal mengembalikan form beserta alasan yang sudah diisi.

POST mengirim `restorationActionIds` yang telah ditinjau. Server mengunci pegawai
serta keputusan, menghitung ulang kandidat, dan menolak konfirmasi usang dengan
409. Pencabutan, pemulihan, serta audit `disciplinary_action.revoke` dan
`disciplinary_action.restore` bersifat atomik. Respons privat memakai no-store.

Backfill hanya memakai audit penerbitan dan penggantian yang dapat dipasangkan
secara pasti melalui organisasi, pegawai, pelaku, dan request ID. Hubungan tidak
ditebak dari tanggal. Pencabutan yang sudah terjadi sebelum migration tidak
diubah secara otomatis. Laporan sanksi terbaru tetap dapat menampilkan keputusan
terbaru yang dicabut; keputusan berjalan dibaca dari status aktif dan periodenya.

### Hapus kasus tanpa tindakan

`DELETE /api/discipline/cases/:id` memerlukan `discipline.manage`, validasi asal
request, organisasi, dan scope pegawai. Tombol **Hapus kasus** hanya muncul bila
kasus tidak memiliki tindakan, termasuk draft. Server memeriksa ulang kondisi
tersebut di dalam transaksi; menyembunyikan tombol bukan kontrol keamanan.

Penghapusan menggunakan `deleted_at` dan `deleted_by_user_id`. Nomor kasus serta
audit `discipline_case.delete` tetap tersimpan. Kasus yang dihapus tidak muncul
pada daftar, detail, histori pegawai, konteks penerbitan, dan indikator dashboard.
Nomor kasus tidak digunakan ulang. Penguncian pegawai lalu kasus menyelaraskan
penghapusan dengan penerbitan sehingga kasus bertindakan tidak dapat terhapus
akibat request bersamaan.

### Urutan dan nomor kasus — migration 064

Daftar kasus serta tab Disiplin pegawai diurutkan berdasarkan `opened_at DESC,
id DESC`, sehingga kasus baru berada paling atas meskipun tanggal kejadiannya
lebih lama. Riwayat sanksi tetap berdasarkan tanggal penerbitan dan ID terbaru.
Pencabutan tidak mengubah posisi kasus atau waktu pencatatannya.

`discipline_case_number_counters` menyimpan angka terakhir per organisasi dan
tahun pencatatan dari zona waktu organisasi. UPSERT atomik di transaksi pembuatan
kasus menserialisasi alokasi nomor bersamaan. Counter awal diisi dari suffix
tertinggi pada nomor lama, termasuk kasus terhapus, bukan jumlah kasus ataupun
tahun kejadian. Nomor lama tidak diubah. Koreksi tanggal kejadian serta penghapusan
tidak menurunkan counter. Organisasi berbeda dapat menggunakan nomor tampilan
yang sama; identitas kasus tetap dipisahkan organisasi dan ID, dengan constraint
`UNIQUE(organization_id,case_no)` sebagai pertahanan terakhir.

Di VPS, hentikan sementara penulisan kasus selama pembaruan, jalankan migration
063 jika belum diterapkan, lalu 064 sebelum menjalankan kode baru. Jangan jalankan
ulang migration yang sudah diterapkan. Migration tidak memulihkan pencabutan lama
secara otomatis. Hubungan lama tetap bergantung pada audit yang dapat dibuktikan
oleh backfill 063; perubahan ini tidak menyimpulkan hubungan yang hilang.

### Verifikasi

Pengujian integrasi memakai database QA sementara dari bootstrap schema lengkap:
hubungan penggantian, pemulihan dengan tanggal asli, penolakan konfirmasi usang,
pendahulu kedaluwarsa, penolakan hapus kasus draft/resmi, isolasi organisasi,
penyembunyian kasus terhapus, audit, dan persaingan hapus–penerbitan. Database QA
dihapus setelah pengujian. Migration development diterapkan melalui runner;
lingkungan lain tetap harus menjalankan migration yang belum tercatat.

Pemeriksaan browser pada lebar 320, 375, 768, 1024, 1366, dan 1920 piksel
memverifikasi satu modal, tidak ada overflow horizontal, tombol konfirmasi,
batal mempertahankan alasan tanpa mutasi, pengiriman ID pemulihan yang ditinjau,
serta tombol hapus hanya untuk kasus kosong. Mutasi browser dicegat dengan data
sintetis; data bisnis tidak diubah. Build produksi dan lint diperiksa terpisah.
API nyata juga diperiksa untuk pratinjau berizin dengan no-store, organisasi
yang salah (404), serta penolakan akses Pimpinan dan Pegawai sebelum mutasi.
Kolom, constraint, dan index tambahan pada database development hasil upgrade
dibandingkan dengan bootstrap kosong dan terbukti ekuivalen.

Verifikasi lanjutan 064 menggunakan database upgrade berisi kasus sintetis dan
database bootstrap kosong: struktur counter/constraint/index ekuivalen dengan
database lokal; suffix tertinggi kasus terhapus dipertahankan; nomor antarorganisasi
terpisah; koreksi tanggal lintas tahun dan 12 pembuatan bersamaan tidak menghasilkan
duplikat; kedua daftar kasus menampilkan pencatatan terbaru lebih dahulu. Alur
penerbitan SP1–SP2–SP3 dan pencabutan bertahap diuji melalui service sebenarnya.
Uji rantai melewati pendahulu kedaluwarsa/dicabut, mengabaikan histori tak terkait,
mencegah siklus, menolak konfirmasi usang serta organisasi lain, dan membuktikan
dua pencabutan bersamaan hanya menghasilkan satu pemulihan/audit. Tanggal asal
tetap sama. Database QA dibuang setelah pengujian.

Browser memeriksa urutan kartu dan modal SP3→SP1 pada enam lebar viewport yang
sama, tanpa overflow atau warning runtime/deprecated. Batal mempertahankan alasan;
mutasi browser dicegat. Tidak ada penyesuaian status data lokal lama atau data VPS
sebagai bagian pengujian ini.

## Tampilan laporan Sanksi Pegawai

### Ringkasan

Kolom Pegawai desktop memiliki lebar dasar 400px. ReportIdentity menerima noWrap
khusus tabel ini; nama utuh tetap satu baris tanpa ellipsis, dan tabel memakai
scroll horizontal max-content agar nama lebih panjang tidak menimpa kolom lain.
Kartu mobile serta pemakai ReportIdentity lainnya tetap membungkus nama. Foto/NIP
dan akses pratinjau tetap mengikuti komponen bersama.

Satu baris tetap mewakili satu pegawai. Sanksi terbaru berasal dari hasil filter, sedangkan total sanksi mengikuti agregat resmi yang sudah disediakan server. Tabel memakai kolom Pegawai (foto, nama, NIP), Lokasi, Divisi & Unit, Jabatan, Sanksi terbaru, Status sanksi, Tanggal terbit, Total sanksi, dan Aksi. Total sanksi adalah seluruh tindakan resmi nondraft, termasuk berakhir, dicabut, digantikan atau dalam banding; bukan hanya hasil filter. Sesuai filter dan Aktif / banding dihapus dari tabel, kartu, ringkasan modal dan Excel karena bukan informasi utama. Nama sanksi berupa teks; chip dipakai untuk status. Tabel boleh digulir di dalam panel tanpa overflow halaman.

Nomor kasus/surat, tingkat, kejadian, periode berlaku, penerbit, uraian, pembelaan dan pencabutan tersedia pada rincian. Kartu mobile memisahkan identitas, sanksi terbaru, fakta dan ringkasan berlabel. Aksi desktop adalah mata dengan tooltip dan label aksesibel; mobile berupa ikon daftar disertai teks Lihat riwayat sanksi. Excel tetap memuat fakta rinci, dengan penamaan Total sanksi dan tanpa kedua kolom hitungan tambahan. Field API/agregat tetap kompatibel.

### Riwayat

AppModal bersama menampilkan lima sanksi per halaman, diurutkan tanggal terbit dan ID menurun. Endpoint histori existing masih mengembalikan seluruh histori resmi; pagination dilakukan pada presentasi browser, bukan request keyset baru. Ini membatasi panjang tampilan, bukan jumlah data yang diunduh. Tidak ada perubahan API/database/migration.

Setiap sanksi mula-mula tertutup, satu rincian dapat dibuka pada satu waktu. Header ringkas memuat nama sanksi, tanggal, nomor kasus dan status; status seluruh baris tetap terlihat termasuk histori lama. Rincian mempertahankan uraian lengkap, penjelasan pegawai, surat, alasan langsung serta pelaku/waktu/alasan pencabutan. Penempatan dan ringkasan pegawai langsung ditampilkan dalam section berjudul tanpa collapse, sehingga lokasi, Divisi & Unit, jabatan, status pegawai, dan total sanksi dapat dibaca tanpa klik tambahan. Pagination tetap di slot AppModal di luar body scroll, total dan jumlah tampil berdasarkan data aktual. Pergantian halaman kembali ke atas dan menutup rincian lama.

Daftar riwayat selalu seluruh tindakan resmi pegawai, tidak mengikuti filter tindakan pada laporan; keterangannya eksplisit. Loading, kosong, error/coba lagi, AbortController saat tutup/ganti target, Escape dan pengembalian fokus tetap berlaku. Draft disaring server; filter defensif UI tidak menggantikan authorization. Surat tetap endpoint privat berizin/audit. Menu detail pegawai hanya muncul jika grant Data Pegawai tersedia.

### Referensi desain

- OrangeHRM Discipline: https://orangehrm.com/solutions/culture/discipline — ringkasan dan rincian terpisah, histori tindakan dapat ditelusuri.
- Carbon Data Table: https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines — tabel ringkas dan rincian bertahap.

Referensi hanya untuk struktur informasi; warna, spacing, chip, tombol, modal serta pagination mengikuti komponen SITOU.

### Fokus, status dan filter

Uraian kejadian dan Penjelasan pegawai berada pada grid fakta utama, berdampingan pada desktop dan bertumpuk pada mobile. Area setelah divider hanya muncul jika ada eskalasi/pencabutan, juga memakai dua kolom desktop. Status memakai ACTION_STATUS bersama: Aktif hijau, Berakhir/Belum mulai/Draft biru, Dicabut merah, Dalam banding/Digantikan kuning. Warna ini menjelaskan lifecycle, bukan tingkat pelanggaran.

Filter Status tindakan hanya menawarkan Aktif, Berakhir, Dicabut dan Digantikan. Dalam banding tidak ditawarkan karena workflow pengajuan/penyelesaiannya belum tersedia. DISCIPLINARY_FILTER_STATUSES memisahkan pilihan UI dari status histori/API sehingga data dan tautan lama tetap terbaca. Digantikan memang dihasilkan closePreviousActions saat sanksi baru diterbitkan untuk pegawai yang sama; sanksi lama yang sudah lewat tanggal akhir menjadi Berakhir, sedangkan yang masih aktif menjadi Digantikan. Seluruh perubahan tersebut diaudit. Pemeriksaan lint terarah dan daftar opsi lewat modul policy lulus.

### Bahasa status

Katalog DISCIPLINARY_ACTION_STATUS pada lib/discipline/presentation.mjs menjadi sumber label dan tone untuk UI serta Excel. Gunakan Sanksi Aktif, Sanksi Berakhir, Sanksi Dicabut, Sanksi Digantikan, Sanksi dalam Banding, Sanksi Belum Berlaku, dan Draft Sanksi. Status pegawai tetap menggunakan katalog pegawai (misalnya Aktif), sehingga kedua informasi tidak tertukar. Filter dan form memakai label Status sanksi; nilai teknis status/API tidak berubah.

## Filter sanksi pada Data Pegawai

Filter awal **Tanpa filter sanksi** tidak membatasi sanksi. Pilihan **Pernah mendapat
sanksi** mencari tindakan resmi nondraft, termasuk yang berakhir atau dicabut.
**Memiliki sanksi aktif** dan **Tidak memiliki sanksi aktif** mempertimbangkan status
active/appealed, tanggal mulai, dan tanggal akhir menurut timezone organisasi.
Tanggal awal/akhir bersifat inklusif. Draft tidak pernah dihitung.

**Jenis sanksi** memakai ID master organisasi. Memilih jenis saat status Tanpa
filter sanksi otomatis memilih Pernah mendapat sanksi. Memilih Tanpa filter sanksi atau
Atur ulang membersihkan jenis. Menghapus jenis kembali mencakup semua jenis
pada status pilihan. Jenis nonaktif berlabel nonaktif tetap tersedia bila ada
riwayat resmi dalam cakupan pengguna. Nama tidak menjadi kondisi query.

Status dan jenis harus cocok pada tindakan yang sama. EXISTS mencegah duplikasi
pegawai dengan banyak tindakan. Tidak memiliki sanksi aktif + jenis berarti tidak memiliki
sanksi aktif dari jenis tersebut. Filter digabung dengan pencarian, lokasi,
Divisi & Unit, jabatan, jenis kepegawaian, status pegawai, dan filter lainnya.

Parser bersama dipakai daftar dan Excel. Service listEmployees memakai kondisi
yang sama untuk data dan total; ekspor memanggil service tersebut tanpa pagination
layar, maksimal 5.000 pegawai. Workbook mencantumkan status serta jenis sanksi
terpilih. Urutan nama lalu ID menjaga pagination stabil untuk nama sama.

Permission employees.read, organisasi sesi, dan scope lokasi tetap berlaku.
Referensi hanya berisi ID, nama, dan status aktif jenis; tidak mengirim uraian,
catatan internal, draft, atau surat. Tidak ada schema atau migration baru.

Verifikasi memakai fixture sementara: default, riwayat/aktif/tanpa aktif,
jenis ganda, jenis nonaktif, draft, masa depan/berakhir/dicabut/dalam banding,
batas tanggal, isolasi organisasi/lokasi, total dan pagination tanpa duplikasi,
validasi ID, reset/pencarian dropdown, serta label filter Excel. Artefak uji
sementara dibersihkan setelah pemeriksaan berhasil.

Label filter adalah **Status sanksi**. Pilihan **Tanpa filter sanksi** berarti
tidak membatasi daftar berdasarkan sanksi, bukan berarti pegawai tidak memiliki
sanksi. **Tidak memiliki sanksi aktif** tetap dapat mencakup pegawai dengan
riwayat sanksi yang sudah berakhir. Pilihan awal filter harus menjelaskan bahwa
filter tidak diterapkan; hindari label umum yang dapat disalahartikan sebagai
kondisi seluruh hasil. Label pilihan dipusatkan bersama dengan ekspor.

## Query dan laporan Pegawai

#### Laporan kontrak dan proyeksi pensiun

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

## Aturan dashboard

#### Dashboard dasar dan katalog menu bersama

- Dashboard selalu halaman awal autentikasi, bukan grant statistik. Hapus pilihan Dashboard dari editor/rincian; kode lama kompatibel tetapi tidak memberi data. Isi data Dashboard wajib sesuai hak domain/submenu, organisasi dan scope server. HRD tanpa hak data melihat kartu terkunci tanpa data asli; Pegawai melihat ringkasan profil sendiri.

- Data Pegawai memberi ringkasan Pegawai/penempatan/kelengkapan/perkembangan/komposisi/ulang tahun. Ringkasan kontrak/pensiun/disiplin boleh untuk Data Pegawai atau laporan terkait; cuti memerlukan Cuti & Izin. Prioritas/aktivitas/link juga mengikuti izin. Statistik Inventaris tersedia melalui tab terpisah sesuai izin sumber dan scope gudang.

- Query hanya untuk section berizin; payload dilarang membawa section tak berizin atau nol palsu. Cache wajib memuat fingerprint izin efektif dan scope, termasuk saat pencabutan session aktif.

- menuCatalog.mjs menjadi katalog deklaratif sidebar/editor/evaluator; setiap menu baru wajib melengkapi jenis izin, scope, delegasi, penjelasan dan pengujian registrasi. Tidak memberi hak otomatis kepada akun terbatas.

- Form akses vertikal: nama menu → dropdown jika perlu → batas izin singkat. Tidak memakai section Informasi menu. Track minmax(0,1fr), min-width:0, popup wrap dan max-width:100% wajib diuji dengan pilihan terpanjang dan zoom 200%.

- Section fitur dapat dilipat independen, header kanan untuk buka/tutup; cabut akses di bawah setelah divider, tombol merah solid. Melipat tidak mencabut, tidak menghapus nilai/dirty, dan error membuka section sebelum fokus. Fitur baru terbuka; edit membuka HRIS atau fitur pertama.

#### Konsistensi ringkasan Dashboard Pegawai

- Dashboard Pegawai, HRD, dan Inventaris memakai DashboardMetric untuk kartu angka; angka besar/tebal dan satuan hari, jam, tahun, bulan, pengajuan atau sanksi lebih kecil. Komponen mendukung parts dan progress tanpa menjumlahkan saldo lintas jenis/satuan.

- Dashboard tidak memakai header sambutan atau PageHeader terpisah; EmployeeProfileBanner berada di DashboardWorkspace di atas konten dan tampil untuk semua role, termasuk pada Inventaris. Jika profil pegawai tertaut, banner menampilkan status dan jenis kepegawaian dari kontrak yang berlaku atau histori terakhir, bukan nama role akun. Jika tidak tertaut, tampilkan identitas akun tanpa NIP atau status kepegawaian buatan. Banner menonjolkan NIP bila tersedia, tanpa mengulang jabatan/divisi dari Penempatan saya; atasan langsung berasal dari penempatan utama aktif. Tanggal akhir kontrak hanya tampil jika employment_types.requires_end_date aktif.

- Tidak ada section Apa yang ingin Anda lihat? atau Informasi kepegawaian yang terpisah. EmployeeLeavePanel menampilkan lima cuti atau izin terbaru tanpa blok saldo atau keterangan alur HRD. Ringkasan jatah/sisa tampil pada kartu dashboard, sedangkan rincian Hak/Terpakai/Sisa tersedia pada modal. Hak tahunan yang belum terbentuk tidak dianggap saldo ledger nol.

- Baris cuti membuka LeaveDetailModal bersama melalui GET /api/dashboard/leave_self/:id. Role Pegawai dan leave_requests.read_self wajib, organisasi dan pemilik dipetakan dari session, draft dikecualikan. Lampiran sendiri juga memerlukan private_files.read_self dan relasi nyata ke permintaan nondraft milik sendiri. Tidak memberi permission administrasi atau mutation.

- Dashboard Pegawai hanya menampilkan tiga kartu: cuti/izin, masa kerja, dan sanksi aktif. Satuan tahun/bulan/hari pada DashboardMetric memakai jarak antar pasangan dan wrap. Tab cuti berlabel Semua, Menunggu, Disetujui; panah menggunakan action:chevron-right.

- Sanksi & teguran berada tepat di bawah Cuti & izin saya. Klik baris berchevron membuka DisciplineCaseDetailModal bersama melalui /api/dashboard/discipline_self/:id. Hanya kasus dengan tindakan resmi nondraft milik pegawai sesi yang boleh dibaca; catatan internal HRD tidak dikirim. Surat sendiri memerlukan disciplinary_actions.read_self dan private_files.read_self, relasi tindakan resmi dan pemilik yang cocok, audit serta no-store.

#### Saldo pilihan dan riwayat pribadi Dashboard

- Kartu jatah/sisa cuti & izin memakai EmployeeBalanceMetric dan DashboardMetric: hanya jenis aktif yang memakai jatah, sesuai jenis kelamin profil menurut leave_types.eligible_gender, dan memiliki saldo ledger atau jatah tahunan positif; satu jenis tampil langsung, banyak jenis dapat digeser dengan sentuhan/mouse, tombol titik, atau panah keyboard. Banyak jenis berganti otomatis setiap 5 detik hanya saat kartu terlihat dan tidak sedang dibaca: jeda saat kursor berada di kartu, fokus keyboard di dalam kartu, tab tersembunyi, atau kartu di luar layar; lanjut lagi setelah kondisi jeda sementara berakhir. Tidak ada tombol jeda/lanjutkan; pengaturan pengurangan animasi menonaktifkan pergantian otomatis. Jangan memakai dropdown atau panah visual. Judul kartu adalah nama jenis cuti/izin yang tampil; nama tidak diulang di bawah judul. Pilihan tersimpan per akun/organisasi, diverifikasi ulang terhadap DTO. Default jenis dengan saldo ledger lalu urutan nama. Bila hak tahunan belum terbentuk, jatah dari aturan boleh ditampilkan sebagai informasi awal yang jelas dibedakan dari saldo resmi; jangan menyebutnya saldo ledger atau menganggapnya transaksi grant. Jangan menampilkan teks tahun tersendiri di bawah angka; indikator penuh membedakan "Jatah tahun ini belum digunakan" dari saldo resmi "Saldo tahun ini belum digunakan". Nama, jumlah, satuan, keterangan, serta indikator bawah wajib berasal dari jenis yang sama dan berganti bersama. Indikator menunjukkan jatah yang masih tersedia, baik dari aturan maupun ledger: penuh hijau, sebagian terpakai kuning, tersisa maksimal 25% merah. Teks jumlah pemakaian tetap tampil bila sudah digunakan sehingga warna bukan satu-satunya petunjuk. Saldo resmi nol dan negatif tetap dibedakan. Hari/jam tidak dijumlahkan, nama tidak diasumsikan Cuti Tahunan. Transisi singkat dan nonaktif saat pengguna meminta pengurangan animasi.

- Aturan leave_types.eligible_gender bernilai all|male|female; aturan lama default all. Profil pegawai other, undisclosed, atau kosong hanya dapat memakai jenis all. Form pencatatan menyaring pilihan setelah pegawai dipilih dan service memvalidasi ulang sebelum membuat hak saldo atau transaksi. Riwayat permintaan dan ledger lama tidak disaring ulang saat aturan atau profil berubah.

- Masa kerja hanya menampilkan bagian tahun/bulan/hari positif. Hari pertama berdasarkan tanggal organisasi; data hilang/invalid berlabel Belum tersedia tanpa angka nol palsu. Foto banner 96px desktop/80px mobile dengan bingkai putih 3px, memakai PhotoAvatar bersama.

- Sanksi memakai DisciplineHistoryList dengan baris brand dan chevron. Jumlah sanksi aktif tampil sebagai deskripsi tepat di bawah judul panel; ringkasan memakai CompactInfoChip reusable dengan tone danger jika ada sanksi aktif atau success jika tidak ada, tanpa kotak pemberitahuan atau section terpisah. Tombol Riwayat dan modal daftar riwayat tidak ditampilkan pada dashboard. Klik baris tetap membuka detail kasus pribadi berizin. Status berada dalam kolom terpisah dan sejajar tengah dengan ikon/panah.

#### Layout dashboard dan navigasi ringkas

- Profil/identitas akun tampil di DashboardWorkspace sebelum konten untuk seluruh role; header sambutan dihapus. Pegawai memakai sumber employee_self, sedangkan akun tertaut non-Pegawai dapat membaca jenis kepegawaiannya melalui profil sendiri. EmployeeProfileBanner memakai PhotoAvatar/ImagePreviewModal bersama.

- DashboardMetric memakai flex column dan keterangan di bawah kartu secara default, termasuk sparkline bila tersedia. Kartu yang memakai progress mempertahankan keterangan sebelum indikator; angka dan satuan tidak berubah. Varian balanced pada Masa kerja dan Sanksi aktif memisahkan header, area angka di tengah vertikal, serta keterangan bawah dengan divider tipis. Angka memakai ukuran responsif 26–34px dan satuan tetap kecil; gunakan varian komponen bersama tanpa menambah informasi dekoratif.

- SidebarContent memakai satu area scroll vertikal untuk logo, organisasi, menu serta masa akses. Navigasi tidak menjadi viewport scroll kecil yang dibatasi footer; submenu terakhir wajib dapat dijangkau pada layar pendek. SubscriptionAccessCard ringkas berisi ikon perisai bercentang (subscription:access), status, tanggal akhir, sisa hari dan tombol Perpanjang akses 44px dengan notifikasi Coming soon.

- Submenu yang mencampur fitur, seperti Data Master dan Laporan, menampilkan pemisah berlabel Kepegawaian, Inventaris, atau Platform berdasarkan metadata access.kind dari katalog bersama, setelah penyaringan izin. Gunakan judul kecil dan divider halus tanpa ikon atau tingkat collapse tambahan. Jika hanya satu kelompok terlihat, hilangkan pemisah agar ringkas. Jangan mengubah urutan, tujuan, atau hak akses menu; judul kosong tidak boleh muncul. Sidebar desktop dan drawer mobile memakai penyajian yang sama, target submenu minimal 44px, label panjang dapat membungkus, serta status terbuka dan halaman aktif tersedia bagi pembaca layar.

- Ketentuan ini berlaku untuk setiap fitur dan hak akses baru. Daftarkan tujuan menu dan kontrak izin pada `lib/access/menuCatalog.mjs`, tentukan `access.kind` fitur secara eksplisit, dan daftarkan label kelompoknya pada `app/components/navbar/sidebarGroups.mjs`. Fitur baru harus mempunyai identitas kelompok sendiri yang mudah dipahami; jangan memasukkannya ke Kepegawaian/Inventaris secara sembarang atau membiarkan label sementara Lainnya sebagai hasil akhir. Sidebar mengambil kelompok dari metadata bersama secara otomatis setelah penyaringan izin, bukan dari role, nama menu, URL, atau pemeriksaan fitur khusus di JSX. Jangan membuat sidebar terpisah untuk fitur baru atau membuka akses hanya agar kelompok tampil.

- Penanda kelompok ditentukan per submenu induk dari menu yang benar-benar dapat diakses: hanya HRD/Kepegawaian saja atau hanya Inventaris saja tetap tampil normal tanpa pemisah; dua atau lebih fitur dalam induk yang sama menampilkan pemisah sesuai nama fitur. Banyak role/permission tidak selalu berarti banyak kelompok. Induk khusus satu fitur tetap tanpa pemisah meskipun akun memiliki akses fitur lain di induk berbeda. Izin yang dicabut harus menghilangkan menu dan judul kelompok kosong; bila tersisa satu kelompok, pemisah kembali disembunyikan. Pengembangan fitur baru wajib menguji akses satu fitur, gabungan fitur lama–baru, akses terbatas, dan pencabutan izin, termasuk menu aktif, navigasi keyboard, desktop/mobile, serta layar pendek.

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

- Laporan Stok pada /reports/inventory-stock memakai inventory.reports.read dan scope gudang existing. Format mengikuti dokumen periode: Stok awal, Barang masuk, Jumlah stok, Barang keluar, Stok akhir; satu baris barang–gudang. Identitas barang memakai foto privat InventoryItemPhoto dan ImagePreviewModal bersama, kode serta satuan. Tidak ada kolom Keterangan pada tabel/mobile/Excel. Ikon Laporan Stok memakai navigation:inventory-stock-report lokal bold duotone. Seluruh angka berasal dari proyeksi efektif bersama Kartu Stok, masuk/keluar menurut tanda efek (termasuk pengembalian, opname, pembatalan). Stok awal adalah saldo sebelum periode, bukan transaksi opening yang terjadi dalam periode. Rincian report-only tidak membuka dokumen tanpa izin transaksi; Excel seluruh hasil maksimal 5.000, tanpa total lintas satuan, audit/no-store dan cursor HMAC terikat akun/filter/scope. Lihat docs/rules/inventory.md.

- Ekspor Excel Laporan Stok dan Distribusi Barang memakai sheet Informasi Laporan pertama untuk identitas, periode, waktu, filter serta penjelasan melalui reportWorkbookInfo bersama. Sheet kedua hanya tabel data: Laporan Stok atau Distribusi, header baris 1 dan freeze/autofilter mengikuti header tersebut. Jangan menaruh metadata di atas tabel atau memindahkan informasi ke sheet terakhir.

- Kartu mobile master dan operasional Inventaris memakai InventoryMobileCardContent bersama laporan: identitas/ikon semantik, status sesuai isi, fakta berlabel, angka bersatuan dalam area netral bila diperlukan, dan aksi teks selebar kartu di footer minimal 44px. Kategori/Satuan/Gudang memakai InventoryMasterCardContent; edit langsung membuka form berizin, bukan menu tambahan untuk satu aksi. Kode kategori/gudang tetap CompactInfoChip info di bawah nama. Tidak membuat bingkai/nomor kedua, footer kosong atau status selebar kartu. Stok membedakan batas minimum dan tersedia; transaksi tidak menjumlahkan barang/satuan dan menyebut barang tambahan di detail. Font mengikuti mobileDataTypography/FontStyle terpusat, nama/angka panjang tetap utuh. Desktop serta izin server tidak berubah. Lihat docs/rules/inventory.md.

- Identitas kartu master dan Transaksi Barang memakai InventoryCardIdentity: chip status di bawah nama/jenis pada kolom teks, sebaris dengan kode jika ada dan ruang cukup (wrap pada layar sempit). Ikon 48px/glyph 24px sejajar tengah dengan blok identitas. Aksi edit master memakai pensil outline EditOutlined; ukuran KindMark di pemakai lain tidak berubah.

- Laporan Sanksi Pegawai memakai kolom ringkas: Lokasi, Divisi & Unit, Jabatan, status dan Total sanksi terpisah; hitungan Sesuai filter serta Aktif / banding tidak tampil pada UI/Excel; jangan menumpuk nama sanksi/status/eskalasi dalam satu sel. Total sanksi mencakup seluruh tindakan resmi nondraft, termasuk dicabut/berakhir/digantikan. Uraian kejadian dan penjelasan pegawai menjadi dua kolom fakta utama; area bawah khusus eskalasi/pencabutan. ACTION_STATUS memakai katalog DISCIPLINARY_ACTION_STATUS bersama UI/Excel: Sanksi Aktif success, Sanksi Berakhir/Sanksi Belum Berlaku/Draft Sanksi info, Sanksi Dicabut danger, Sanksi dalam Banding/Sanksi Digantikan warning. Status pegawai tetap memakai katalog pegawai yang terpisah. Data sekunder tetap pada Riwayat sanksi: lima tindakan resmi per halaman, satu accordion rincian terbuka, status setiap histori terlihat, pagination pada slot tetap AppModal. Penempatan dan ringkasan pegawai langsung terlihat tanpa collapse; hanya rincian tiap sanksi memakai accordion. Aksi mata desktop dan daftar berteks mobile. Endpoint histori existing tetap seluruh data (pagination presentasi), filter laporan tidak membatasi daftar riwayat. Lihat docs/rules/product.md.

- Filter Status sanksi laporan hanya menampilkan status dengan alur tersedia: Sanksi Aktif, Sanksi Berakhir, Sanksi Dicabut, Sanksi Digantikan. Jangan menawarkan Sanksi dalam Banding sebelum workflow keberatan tersedia; status histori/API lama tetap dipertahankan. Pilihan UI memakai DISCIPLINARY_FILTER_STATUSES, terpisah dari OFFICIAL_ACTION_STATUSES untuk kompatibilitas histori.

- Penerbitan sanksi memakai konteks kasus berizin GET /api/discipline/cases/:id/actions dan ConfirmDialog bersama tanpa dua modal bertumpuk. Jenis sama serta tahap teguran lisan/SP1/SP2/SP3 yang sama/lebih rendah diblokir ketika masih berlaku, berdasarkan ID/system_key, bukan nama. Jenis lain tidak diberi peringkat buatan. Backend mengunci pegawai dan keputusan berjalan, memverifikasi replacementActionIds serta scope/tanggal organisasi sebelum draft/publikasi. Draft tidak mengganti keputusan lama; tanggal mendatang hanya draft sampai scheduler tersedia. Pesan konfirmasi menyebut sanksi berjalan dan pengganti, batal mempertahankan isian/file. Rincian: docs/rules/product.md.

- Pencabutan sanksi menelusuri rantai disciplinary_action_replacements dan memulihkan satu pendahulu terdekat berstatus superseded yang masih berlaku, hanya bila tidak ada keputusan lain berjalan. Lewati pendahulu dicabut/kedaluwarsa tanpa mengaktifkannya, cegah siklus, dan jangan menebak hubungan dari tanggal. Konfirmasi memverifikasi restorationActionIds dalam transaksi; tanggal/surat asal tidak diubah, audit restore wajib. Kasus tanpa tindakan (termasuk draft) boleh dihapus logis dengan scope, konfirmasi, dan audit; kasus bertindakan tetap dipertahankan. Daftar kasus memakai opened_at/id terbaru; riwayat sanksi memakai tanggal terbit/id terbaru. Nomor kasus memakai counter atomik organisasi/tahun pencatatan zona organisasi, diinisialisasi dari nomor lama termasuk terhapus; koreksi tanggal kejadian tidak mengubah nomor atau counter. Lihat docs/rules/product.md.

- Grafik Aktivitas transaksi pada Tahun ini selalu mencakup Januari sampai Desember. Bulan tanpa transaksi, termasuk bulan mendatang, ditampilkan 0 agar garis berlanjut penuh; angka ini berarti belum ada transaksi tercatat, bukan prediksi. Ringkasan tetap menghitung transaksi nyata sampai tanggal organisasi.

- Grafik Aktivitas transaksi juga mengisi tanggal tanpa transaksi dengan 0 hingga akhir bulan/minggu yang dipilih. Kurva area memakai smooth seperti dashboard HRD; tooltip tetap nilai transaksi sebenarnya dan tanggal lengkap.

- Dashboard HRD menampilkan pie Cuti & Izin tahun ini (pencatatan approved yang beririsan periode tahun sampai hari ini) dan grafik batang Sanksi tahun ini (tindakan resmi per jenis snapshot berdasarkan issued_date, tanpa draft). Statistik ditempatkan setelah grafik unit/kontrak; permission dan scope diperiksa sebelum query serta proyeksi DTO. Detail transaksi dari Kartu Stok memakai modal bersama di tempat tanpa pindah halaman dan tanpa aksi pembatalan.

- Ringkasan Cuti & Izin menampilkan jenis aktif organisasi termasuk nol serta jenis nonaktif yang masih memiliki data berizin. Panel Sanksi tahun ini memerlukan izin menu Sanksi Pegawai (disciplinary-actions-report); Data Pegawai saja tidak memberikan statistik tersebut. Rekap Akhir Kontrak berupa daftar jumlah dokumen per bulan/status untuk 12 bulan terakhir, menggantikan grafik batang.

Jadwal Kontrak Berakhir menggantikan rekap histori kontrak: jumlah kontrak aktif yang telah mulai, pegawai aktif/probation/suspended, bertanggal akhir mulai hari ini menurut timezone organisasi sampai akhir bulan kalender ke-12. Query dashboard dan laporan memakai buildReportQuery yang sama dengan contractStatus=active; kontrak draft, dibatalkan, berakhir, diperpanjang, tanpa tanggal akhir, serta pegawai final tidak dihitung. Setiap bulan menampilkan jumlah kontrak akan berakhir. Lihat pegawai hanya tersedia bagi akun berizin laporan Kontrak Akan Berakhir, mempertahankan organisasi dan rentang bulan. Tidak memakai label Aktif/Selesai atau diperpanjang pada panel jadwal.

Jadwal Kontrak Berakhir memakai kalender brand merah untuk bulan dengan data. Ikon mata membuka ContractEmployeesModal di dashboard, memakai API laporan yang sama dan filter bulan/organisasi/status aktif. Modal memakai AppModal, ResponsiveDataView, DataPagination cursor, ReportIdentity/ReportRemaining, dan ImagePreviewModal untuk pas foto. Pemeriksaan izin laporan tetap di backend; menutup modal mempertahankan halaman serta posisi dashboard.

Dashboard Inventaris memakai label Stok perlu diisi kembali dan status Di bawah minimum/Habis. Daftar maksimal 10 barang memakai HorizontalCarousel: autoplay satu kartu ke kiri hanya saat overflow, scrollbar tersembunyi, jeda hover/fokus/sentuhan/manual serta saat foto terbuka atau panel/tab tidak terlihat. Pada mobile (<600px) tampilkan satu kartu penuh dengan scroll snap, tanpa cuplikan kartu berikutnya. Sediakan panah dan keyboard tanpa tombol jeda/jalankan; autoplay kembali setelah jeda interaksi manual 9 detik dan tetap menghormati reduced motion; salinan loop tidak menambah urutan Tab/pembaca layar. StockAttentionCard menonjolkan Stok tersedia dan Batas minimum dengan warna status serta shadow token tema, tanpa mengubah proyeksi stok atau menambah data palsu.

Kartu produk Stok perlu diisi kembali memakai label Stok segera habis untuk stok di bawah minimum dan Stok habis untuk nol. Chip, aksen serta bagian Stok tersedia memakai brand merah SITOU. Nama kategori statistik tetap Di bawah minimum; tidak menghitung prediksi waktu habis.

Dashboard Inventaris Transaksi terbaru: tombol detail desktop/tablet berupa ikon mata 44px dengan tooltip, mobile ikon dan teks. Buka TransactionDetailModal bersama di tempat melalui API transaksi berizin, bukan pindah menu. Pertahankan organisasi/scope, loading/error, pembatalan request saat unmount, URL/posisi gulir; konteks Dashboard tidak menyediakan pembatalan transaksi.

Dashboard Pegawai memakai banner profil, tiga ringkasan sesuai izin, saldo per jenis dengan LeaveBalanceFields, lima cuti/izin terbaru dan lima sanksi resmi terbaru. Filter status berlaku pada lima data terbaru dan keterangannya wajib jelas. Jangan menampilkan angka contoh, menganggap saldo yang belum ditetapkan sebagai nol, atau membuat tombol pengajuan mandiri yang belum tersedia. Navigasi bersama berlaku untuk seluruh role dan wajib diuji pada layar pendek selain lebar 320–1920px.

#### Dashboard Pegawai dan Inventaris

- Menu Dashboard tetap tujuan login. Jika satu ringkasan tersedia, Dashboard adalah tautan langsung tanpa submenu; jika lebih dari satu, Dashboard hanya membuka submenu Ringkasan Kepegawaian, Ringkasan Pribadi, dan/atau Inventaris menurut hak akses. Ringkasan Kepegawaian memerlukan sekurangnya satu izin baca bagian kepegawaian dan merangkum data pegawai organisasi; Ringkasan Pribadi memerlukan profil tertaut dan permission `*_self` bagi Pegawai, HRD, atau Pimpinan. Inventaris memerlukan izin fitur. URL masing-masing `/dashboard/staff`, `/dashboard/personal`, `/dashboard/inventory`; `/dashboard` memilih tujuan berizin, termasuk kompatibilitas `?tab=inventory` lama.

- Ringkasan Kepegawaian tidak memuat data secara berkala: ambil saat halaman dibuka, saat tombol Muat ulang dipilih, atau ketika snapshot akses menunjukkan bagian ringkasan atau cakupan akses berubah. `ProtectedShell` memeriksa `/api/access/me` setiap 20 detik hanya pada tab organisasi yang terlihat, serta saat navigasi/fokus dan event perubahan akses. `scopeRevision` adalah penanda perubahan lokasi HRD dan paket/cakupan gudang Inventaris, bukan bukti izin. Saat penanda berubah, segera buang seluruh konten, modal, dan isian yang belum disimpan dari cakupan lama lalu muat ulang halaman berizin; jika seluruh akses dicabut, sembunyikan konten dan alihkan. Pemberitahuan perubahan akses wajib singkat dan tidak boleh menyatakan ada form atau isian belum disimpan tanpa konteks yang sesuai. Backend tetap memeriksa izin dan cakupan pada setiap request.

- Ringkasan Pribadi menerima profil, penempatan utama, kepegawaian, kontrak, saldo/cuti/izin dan ringkasan sanksi resmi sendiri melalui `/api/dashboard/employee_self`. Target selalu dari sesi, permission `*_self` diperiksa per bagian. Migration 059 memberi izin pribadi cuti dan sanksi kepada Pegawai; migration 062 memberi izin baca pribadi kepada HRD/Pimpinan tanpa membuka administrasi, persetujuan, atau mutation. Rincian kasus resmi, cuti/izin nondraft, dan file sendiri wajib selalu dikunci ke profil sesi juga saat role memiliki izin HRIS yang lebih luas. Saldo dari ledger tahun organisasi, hari/jam per jenis; draft dikecualikan. Sanksi aktif memperhatikan periode, bukan status tersimpan saja. Belum ada pengajuan baru mandiri; rincian dibuka langsung dari daftar pribadi.

- `/api/dashboard/inventory` memisahkan scope stok, transaksi dan laporan. Query dan DTO hanya bagian berizin; respons private/no-store tanpa cache bersama. Superadmin memilih organisasi eksplisit. Gudang aktif dan lokasi operasional mengikuti tanggal organisasi.

- Kondisi stok memakai sumber proyeksi yang sama dengan Stok Barang. Stok menipis < minimum, sama minimum Cukup; Habis memerlukan histori. Belum ada transaksi dan barang nonaktif tidak masuk statistik kondisi. Jangan menjumlahkan satuan barang berbeda.

- Tiga grafik saja: Kondisi stok, Aktivitas transaksi (area penuh: tahun, bulan, minggu), Tujuan penyaluran terbanyak. Aktivitas menghitung dokumen receipt/issue/return/stocktake tanpa opening/reversal/dibatalkan. Penyaluran memakai pembatalan sampai akhir periode. Bahasa singkat, warna tema, 24px antarsection, 44px kontrol dan komponen/adapter grafik bersama.

- Dashboard tidak mengirim daftar draft. Daftar perhatian maksimal sepuluh dan terbaru lima. Tautan membawa filter/gudang berizin. Uji API/browser pada database terpisah, scope berbeda per section, pencabutan, kondisi stok, periode organisasi dan responsif.

Dashboard pribadi dan Inventaris: header profil tetap di atas konten, tanpa tab dan tanpa Draft saya. Pegawai dan Inventaris tidak memakai section Akses cepat. Aktivitas transaksi memakai area penuh dengan filter tahun, bulan, minggu; ringkasan tetap bulan ini. Warna jenis konsisten dengan riwayat.

Dashboard Inventaris dibuka melalui submenu atau tautan langsung sesuai izin, tanpa tab. Stok menipis/habis memakai kartu produk horizontal yang dapat digeser dengan keyboard/sentuhan; transaksi bulanan berupa daftar jenis dan jumlah di atas kartu ringkasan. Tooltip aktivitas memakai tanggal lengkap, sumbu area menyisakan ruang puncak dan ujung label.

## Dashboard Pegawai dan Inventaris

### Loading data dashboard

Login mempertahankan token navigasi sampai halaman tujuan terpasang. Pengambilan
data Ringkasan Kepegawaian, Ringkasan Pribadi, Inventaris, dan profil header memakai
token proses LoadingBackdropProvider tersendiri. Pelepasan token navigasi tidak
menutup backdrop milik request data yang masih berjalan. Tidak ada delay minimum
atau backdrop baru per halaman.

`useDashboardData(url, { blocking: true })` membuka backdrop sebelum request dan
menutup token miliknya setelah data diproses, request gagal, atau komponen dilepas.
Request lama dibatalkan saat URL/scope berubah; respons lama tidak menimpa scope
baru. Ringkasan Kepegawaian mengikuti lifecycle yang sama pada fetch summary.
URL kosong tidak membuat request maupun token. Pemakai hook pada modal pagination
atau proses lokal tetap nonblocking secara default; retry dashboard tetap blocking.

Ketentuan navigasi dan izin pada dua bagian pertama adalah acuan terkini; uraian perubahan historis di bagian bawah menjelaskan keputusan lama sebelum submenu Dashboard diterapkan.

Dashboard tetap tujuan login. Jika satu ringkasan tersedia, menu Dashboard langsung membukanya; jika lebih dari satu, Dashboard membuka submenu **Ringkasan Kepegawaian**, **Ringkasan Pribadi**, dan/atau **Inventaris** sesuai izin. URL tiap ringkasan adalah `/dashboard/staff`, `/dashboard/personal`, dan `/dashboard/inventory`. `/dashboard` memilih tujuan berizin (Pegawai mendahulukan ringkasan pribadi); tautan lama `?tab=inventory` diarahkan ke Inventaris bila berizin. Ringkasan Kepegawaian merangkum data pegawai organisasi dan disembunyikan jika tidak ada bagian kepegawaian yang boleh dibaca. Ringkasan Pribadi tersedia untuk Pegawai, HRD, atau Pimpinan yang profilnya tertaut. Semua role memakai header identitas yang sama di atas konten, tanpa PageHeader dashboard terpisah. Akun tanpa profil tertaut tidak diberi informasi kepegawaian buatan. Pemilih organisasi Superadmin tetap tersedia pada ringkasan terkait.

Ikon seluruh menu dan submenu sidebar memakai `@iconify/react/dist/offline` dengan data SVG lokal `app/components/icons/localIconData.mjs`; SVG tersedia sejak HTML awal dan tidak ada permintaan ke API Iconify saat runtime. Katalog nama semantik dan sumber ikon berada di `navigationIconSources.mjs`. Seluruh ikon navigasi memakai Solar bold-duotone (two-tone terisi) sesuai makna menu. Ikon Dashboard utama bergerak dengan skala halus berulang, berhenti saat hover/fokus, dan ditukar dengan ikon statis saat `prefers-reduced-motion`. Setelah memilih/mengubah ikon, cukup simpan nama Iconify di katalog; `npm run dev` memperbarui data lokal otomatis dan `npm run build` membuat ulang data sebelum kompilasi. `npm run icons:check` memeriksa kesesuaian tanpa mengubah file; uji sidebar tanpa koneksi jaringan. Ikon lokal tidak otomatis membuat halaman/API SITOU berfungsi offline.

### API pribadi

`GET /api/dashboard/employee_self` tersedia bagi Pegawai, HRD, atau Pimpinan berprofil tertaut dengan permission `employees.read_self`. Migration 062 memberi grant baca pribadi untuk HRD/Pimpinan tanpa izin administrasi tambahan. Target selalu organisasi dan user dari session; query target ditolak. Rincian cuti/izin, sanksi dan file melalui mode pribadi juga memeriksa kepemilikan profil serta menolak draft. Respons memuat `profile`, `employment`, serta `assignment`/`contract` menurut permission self terkait. Tidak ada NIK, alamat, rekening, dokumen, uraian kasus atau data Pegawai lain. Foto menggunakan endpoint `profile_self`. Kontrak membaca periode aktif yang berlaku, fallback histori terakhir non-draft/non-cancelled; tanpa periode tidak membuat data kosong palsu.

### API Inventaris

`GET /api/dashboard/inventory?organizationId=...&warehouseId=...&trendPeriod=year|month|week`. Organisasi dikunci session kecuali Superadmin yang wajib memilih eksplisit. Filter positif divalidasi; gudang aktif pada lokasi operasional dalam union izin tersedia. Scope tiap section tetap terpisah:

| Section | Permission | Data |
|---|---|---|
| `stock` | `inventory.stock.read` | low/empty/sufficient, perhatian maksimal 10 |
| `transactions` | `inventory.transactions.read` | jumlah/jenis, grafik area tahun/bulan/minggu, terbaru maksimal 5 |
| `distribution` | `inventory.reports.read` | jumlah penyaluran dan lima lokasi terbanyak |

Respons membawa `sections`, `unavailable`, `warehouses`, `period`, `generatedAt`, `errors`. Section tanpa izin tidak ada dalam DTO. Filter gudang di luar scope salah satu section menyebabkan section itu tidak dikirim dan ditandai unavailable, tanpa memperluas scope. Kegagalan query satu section memuat pesan aman dan requestId pada errors, section lain tetap berjalan. Modul nonaktif atau semua izin tidak tersedia menghasilkan 403. Seluruh respons private/no-store, tanpa cache payload bersama.

### Angka dan grafik

- Stok membaca `STOCK_SOURCE_SQL` yang sama dengan Stok Barang: barang–gudang aktif dengan histori, < minimum Di bawah minimum, 0 Habis, >= minimum Cukup. Histori kosong dikecualikan. Urutan perhatian Habis, rasio stok/minimum terkecil, nama/ID deterministik. Tidak ada agregasi kuantitas antar-satuan.

- Grafik kondisi stok menghitung pasangan barang–gudang, bukan barang unik lintas gudang.

- Aktivitas bulan organisasi mulai tanggal 1 sampai hari ini. Kartu dan rincian tetap bulan ini. Grafik memakai trendPeriod: year (default, Januari sampai Desember), month (tanggal), week (Senin sampai Minggu dengan hari dan tanggal). Grafik tahun mengisi bulan tanpa transaksi, termasuk bulan mendatang, dengan 0 agar garis mencapai Desember. Nilai ini menunjukkan belum ada transaksi tercatat, bukan prediksi. Grafik bulan dan minggu juga mengisi tanggal tanpa transaksi sampai akhir periode dengan 0. Semua area memakai kurva smooth dan isian transparan dari adapter bersama seperti grafik HRD. Menghitung dokumen receipt/issue/return/stocktake resmi tanpa pembatalan; opening/reversal dikecualikan.

- Penyaluran menghitung dokumen issue yang tidak dibatalkan sampai akhir periode, sama dengan aturan Distribusi Barang. Grafik tujuan menghitung transaksi, bukan nilai pembelian/jumlah barang campuran.

- Draft tidak masuk angka stok/statistik resmi. Filter tidak memberi akses tambahan.

### Verifikasi

prosedur verifikasi fitur

prosedur verifikasi fitur membuat dan membersihkan database uji terpisah, server sementara port 3004, data synthetic dan screenshot. Membuktikan profile self, payload berbeda pada scope sama, scope berbeda per section, modul/izin dicabut, angka/stock source, query plan, tab/link/keyboard dan lebar 320–1920. Tidak mengubah database aktif atau menyalakan server development port 3000.

Schema dan grant historis tetap; tidak ada migration baru. UI tidak menambahkan absensi, pengajuan, prediksi/valuasi persediaan, approval atau aset.

Tab berada setelah header profil bersama. Draft tidak dikirim API dashboard. Pegawai memiliki akses cepat ke bagian informasi pribadi yang sudah berizin. Grafik area penuh memakai empat warna yang sama dengan ringkasan dan ikon transaksi terbaru. Label bulan disingkat pada layar kecil.

Rujukan presentasi Dashboard Inventaris: [aturan dashboard Inventaris](product.md#dashboard-pegawai-dan-inventaris). Ketentuan tanpa tab menggantikan rancangan tab terdahulu.

Catatan pemeliharaan: runner pengujian otomatis dan folder tests dihapus atas keputusan proyek. Uraian pengujian di atas menjadi acuan pemeriksaan; perintah pengujian lama tidak tersedia. Gunakan lint, build, dan smoke test di lingkungan terpisah untuk perubahan berikutnya.

Pemeriksaan izin browser dipusatkan di ProtectedShell: saat navigasi, setiap 20 detik untuk akun organisasi pada tab terlihat, serta saat fokus/visibilitas kembali. Event pasif berdekatan digabung dengan jeda minimal 2 detik; request yang berjalan tidak diduplikasi. Respons `/api/access/me` membawa `scopeRevision` stabil dari mode/daftar lokasi HRD dan paket/cakupan gudang Inventaris; nilainya hanya untuk mendeteksi perubahan UI, bukan otorisasi. Saat cakupan berubah, konten dan modal lama ditutup segera, isian belum disimpan dilepas, dan halaman berizin dimuat ulang termasuk Dashboard walau daftar bagiannya sama. Ringkasan Kepegawaian tidak memakai interval sendiri: data dimuat saat halaman dibuka, melalui tombol Muat ulang, atau ketika bagian/cakupan yang diizinkan berubah. Pencabutan seluruh hak menyembunyikan halaman dan menjalankan pengalihan. Backend tetap memeriksa izin dan cakupan pada setiap request fitur.

### Statistik HRD: Cuti & Izin dan Sanksi

Di bawah Distribusi Divisi & Unit dan Kontrak berakhir per bulan terdapat pie Cuti & Izin tahun ini serta batang horizontal Sanksi tahun ini. Endpoint summary memakai section leave/discipline yang sudah ada; query dan proyeksi respons memeriksa izin masing-masing dan cakupan penempatan utama. Pegawai tidak menerima statistik organisasi ini.

Cuti & Izin menghitung pencatatan approved per jenis yang periodenya beririsan dengan awal tahun sampai hari ini, memakai timezone organisasi. Tidak menjumlahkan hari/jam dan tidak menghitung draft, ditolak, atau dibatalkan. Sanksi menghitung tindakan resmi (bukan pegawai unik) berdasarkan issued_date dari awal tahun sampai hari ini, memakai nama jenis snapshot. Histori berakhir, digantikan, atau dicabut tetap dihitung; draft dikecualikan. Tidak mengirim uraian, alasan, surat, atau identitas pegawai dalam dataset grafik.

Jadwal Kontrak Berakhir menunjukkan jumlah kontrak aktif yang akan berakhir per bulan mulai hari ini sampai akhir bulan ke-12. Perlu ditinjau tetap daftar prioritas individual untuk 30 hari mendatang. Setiap bulan pada jadwal dapat dibuka ke laporan sesuai izin.

Detail transaksi dari Kartu Stok dibuka melalui TransactionDetailModal pada halaman Stok Barang tanpa navigasi, tanpa aksi pembatalan. Endpoint detail tetap memeriksa inventory.transactions.read dan scope gudang. Menutup detail mempertahankan Kartu Stok beserta filter dan paginasi.

Cuti & Izin kini menyertakan seluruh jenis aktif organisasi (0 jika belum digunakan), serta jenis nonaktif yang masih memiliki pencatatan approved dalam periode dan scope. Rincian jenis/jumlah selalu tampil; grafik kosong tidak menyembunyikan daftar jenis. Panel Sanksi menggunakan section sanctions khusus izin disciplinary-actions-report; akses Data Pegawai saja tidak membuka statistik laporan sanksi. Rekap Akhir Kontrak mengganti batang dengan jumlah dokumen per bulan dan rincian status, tanpa mengubah periode atau sumber hitungan.

Visual Cuti & Izin menggunakan donat, bukan lingkaran penuh; total pencatatan di tengah dibuat tebal dan tetap terlihat saat hover. Daftar jenis/jumlah tetap di samping pada desktop dan di bawah pada ponsel. Warna pertama merah SITOU, pendamping memakai token tema.

Rujukan: [File pengujian sementara saat pengembangan](quality.md#file-pengujian-sementara-saat-pengembangan).

### Stok perlu diisi kembali

Panel memakai StockAttentionCard: status Stok segera habis/Stok habis, foto privat, barang, gudang, angka Stok tersedia dan Batas minimum. Status kartu, aksen atas, serta Stok tersedia memakai warna brand SITOU dengan permukaan merah muda ringan; shadow/hover mengikuti token tema. Kartu ringkasan serta legenda kondisi stok tetap memakai istilah Di bawah minimum. Label Stok segera habis pada kartu produk berarti stok di bawah minimum, bukan perkiraan waktu habis. Perhitungan dan urutan perhatian dari server tetap sama, maksimal 10 pasangan barang-gudang.

HorizontalCarousel menggeser satu kartu ke kiri setiap 4,5 detik hanya jika data melebihi lebar panel. Akhir daftar tersambung ke awal tanpa animasi mundur. Scrollbar disembunyikan; sentuhan, scroll horizontal, panah 44px dan ArrowLeft/ArrowRight tetap tersedia. Pada mobile (<600px), satu kartu memenuhi lebar area dan scroll snap merapikan posisi setelah digeser. Tidak ada tombol jeda/jalankan. Hover dan fokus menjeda sementara; sentuhan, scroll manual dan tombol panah memberi waktu baca 9 detik sebelum rotasi otomatis dapat berlanjut. Auto berhenti saat tab/panel tidak terlihat, foto diperbesar, atau prefers-reduced-motion aktif. Satu kartu atau daftar yang seluruhnya muat tidak menampilkan kontrol maupun autoplay. Salinan visual untuk loop tersembunyi dari pembaca layar dan tombol fotonya tidak masuk urutan Tab.

Grafik area memakai gradasi muda yang diturunkan dari warna seri melalui adapter bersama. Stop gradasi bersifat opaque agar tumpukan seri tidak mencampurkan biru dengan oranye menjadi abu-abu. Garis, legenda dan tooltip tetap mengikuti warna seri yang sama; grafik batang tidak berubah.

Urutan bagian Inventaris: pilihan Gudang, kartu ringkasan berizin (Stok di bawah minimum, Stok habis, Transaksi bulan ini, Penyaluran bulan ini), lalu panel Stok perlu diisi kembali dan rincian Transaksi bulan ini. Urutan sama pada desktop/mobile; grid kartu tetap mengikuti ukuran layar dan izin.

### Transaksi terbaru

RecentInventoryTransactions menampilkan maksimal lima transaksi resmi dari DTO yang sudah berizin sebagai kartu dengan aksen jenis, shadow token tema dan hover ringan. KindMark/AppIconTile dipakai ulang; override tone hanya untuk menyamakan biru Pengembalian dan ungu Stok opname dengan legenda Dashboard. Setiap kartu memisahkan jenis/status/jumlah jenis barang, Tanggal transaksi, Gudang, Disimpan oleh (ActorIdentity dengan pas foto privat dan jabatan), serta tombol Lihat detail. Desktop/tablet memakai ikon mata 44px dengan tooltip, mobile di bawah 768px memakai ikon dan teks. Transaksi dibatalkan memakai status dan aksen merah tanpa menyembunyikan identitas atau angka asal. Desktop empat bagian sejajar, tablet dua kolom, mobile satu kolom dengan divider tipis serta tombol 44px selebar kartu. Reduced motion menonaktifkan efek terangkat. Tombol membaca GET /api/inventory/transactions/:id dengan organizationId dan private/no-store, lalu membuka TransactionDetailModal yang sama langsung di Dashboard tanpa navigasi. Endpoint tetap memeriksa izin transaksi serta scope gudang. Loading/error memakai komponen bersama, klik ganda dicegah, request dibatalkan saat komponen dilepas/organisasi berubah. Modal Dashboard tidak menerima onCancel. Menutup modal mempertahankan URL dan posisi gulir. Data, filter organisasi/gudang, serta urutan tetap sama.

### Redesign ruang kerja Pegawai (059)

Dashboard Pegawai menampilkan sapaan, tanggal organisasi, banner profil brand, status/jenis/Divisi & Unit, empat kartu ringkasan sesuai izin, akses cepat ke section pribadi, serta penempatan dan kontrak. Kartu saldo menampilkan seluruh jenis bersaldo dengan Hak/Terpakai/Sisa dan satuan masing-masing. Saldo yang belum memiliki entitlement tetap null; jenis tanpa saldo tidak diberi angka palsu. Ringkasan cuti disetujui berdasarkan tahun tanggal mulai; menunggu meliputi seluruh pengajuan submitted. Daftar dibatasi lima terbaru menurut ID, filter status hanya berlaku pada lima data itu. Rincian memakai AppModal pada Dashboard. Pengajuan baru dan koreksi tetap melalui HRD; tidak menambahkan workflow pengajuan/approval mandiri.

Migration 059 memberi `leave_requests.read_self` dan `disciplinary_actions.read_self` hanya kepada role employee. API existing menolak semua parameter target; repository selalu memetakan employee dari organization_id dan user_id session. DTO menghilangkan bagian tanpa permission. Satu query ringkasan mengambil saldo ledger, hitungan cuti, serta lima sanksi resmi terbaru tanpa draft, lampiran, alasan, catatan internal atau uraian kasus. Sanksi aktif diperiksa tanggal mulai/akhir dalam timezone organisasi; yang belum mulai berlabel Belum mulai dan yang sudah lewat Berakhir. Tidak ada perubahan saldo atau status domain akibat render.

Navigasi seluruh role kini menampilkan organisasi dan lokasi utama di sidebar. TopMenu memakai avatar privat + nama depan/terakhir + jabatan, fallback username/role; menu Profil/Keluar dan lifecycle logout tetap sama. SubscriptionAccessCard memindahkan masa akses dari topbar/banner ke bawah sidebar/drawer, dengan label status, tanggal Indonesia, sisa hari dari server, serta Perpanjang akses yang hanya menampilkan Coming soon. Masa tenggang memakai tanggal tenggang; kartu tidak muncul untuk platform tanpa organisasi. Menu dan kartu tetap dapat digulir pada viewport pendek.

Verifikasi perubahan: schema bootstrap serta migration idempotent di database sementara; ledger grant/carryover/usage/restoration, saldo belum tersedia, draft, periode sanksi, scope akun/organisasi, permission ditolak dan EXPLAIN ANALYZE BUFFERS. UI diuji desktop/mobile dengan data synthetic melalui intersepsi API; akun, perpanjangan, filter dan modal. File uji sementara dibersihkan setelah selesai.

### Penyederhanaan Dashboard Pegawai

Header profil bersama dipakai oleh seluruh role pada tab Dashboard dan Inventaris. Profil pegawai yang tertaut menampilkan status dan jenis kepegawaian dari kontrak yang berlaku atau histori terakhir, tanpa chip role akun. DashboardMetric menjadi komponen kartu angka bersama HRD/Inventaris/Pegawai, mendukung value + unit, parts untuk tahun/bulan, dan progress pemakaian. Kartu sisa cuti memilih satu jenis dengan jatah; jika hak tahunan sudah ada, angka berasal dari ledger. Jika belum ada hak tahunan tetapi aturan memberi jatah positif, kartu menampilkan jatah dari aturan sebagai informasi awal dan menjelaskan bahwa saldo resmi dibuat saat cuti pertama disimpan. Jenis dan satuan tidak dijumlahkan. Pilihan jenis yang tersedia berada selebar kartu di atas angka.

Banner menampilkan nama lengkap, NIP yang diperjelas, status dan jenis pegawai. Jabatan/divisi dan atasan langsung berada di Penempatan saya. Tanggal akhir mengikuti requires_end_date master jenis pegawai, termasuk modal kontrak.

EmployeeLeavePanel menggantikan akses cepat, saldo terpisah dan informasi kepegawaian berulang. Daftar lima terbaru memakai tab dengan jumlah dalam lima data tersebut, ikon brand, tanggal/durasi, status, serta panah. Hak/Terpakai/Sisa jenis terkait tersedia di modal detail melalui LeaveBalanceFields. Baris membuka LeaveDetailModal yang sama dengan menu operasional, berisi alasan, penempatan pada awal izin, pencatat, keputusan, pembatalan dan lampiran berizin. Saldo pada modal adalah posisi tahun dashboard saat ini, bukan saldo historis pada tanggal izin.

Endpoint GET /api/dashboard/leave_self/:id menolak parameter query dan permintaan orang lain/organisasi lain/draft. Pegawai, HRD, dan Pimpinan berprofil tertaut memakai mode pribadi yang mengunci employee.user_id dan organization_id dari sesi. Endpoint file dalam mode pribadi hanya membuka leave_attachment dengan permission read_self, kepemilikan employee dan relasi permintaan nondraft yang cocok; scan, audit preview/download, CSP dan private/no-store tetap berjalan.

Verifikasi penyederhanaan: ESLint pada komponen/service/route terkait; build produksi; browser 320, 375, 768, 1366 dan 1920 px; buka rincian tanpa pindah halaman; saldo terisi/belum ditetapkan; modal saldo; kontrak bertanggal akhir/tanpa tanggal akhir; API sendiri dan penolakan target lain/query. Authorization lampiran diuji dengan tabel temporer PostgreSQL sintetis untuk organisasi lain, pegawai lain, draft, file tanpa relasi, kategori salah dan permission dicabut. Tanggal pada rincian menggunakan timezone organisasi agar konsisten dengan ringkasan. Seluruh artefak uji sementara dibersihkan.

### Penyederhanaan tiga kartu dan rincian disiplin pribadi

Kartu Menunggu HRD dihapus, sehingga grid desktop berisi tiga kartu. Masa kerja menampilkan tahun, bulan dan hari hasil age pada tanggal organisasi, dengan pasangan angka/satuan berjarak dan dapat membungkus. Daftar Cuti & izin saya langsung menampilkan tab Semua/Menunggu/Disetujui serta baris terbaru; tidak ada blok saldo atau penjelasan HRD. Saldo tetap ada di modal detail jika jenisnya memiliki saldo. Ikon navigasi menggunakan chevron bersama.

EmployeeDisciplinePanel berada di kolom kiri setelah cuti. Kartu memisahkan nama/status dari periode berlaku dan tombol Lihat detail. Modal memakai DisciplineCaseDetailModal bersama. Endpoint discipline_self memeriksa permission, organisasi, pegawai dari sesi dan keberadaan tindakan nondraft sebelum membaca rincian, mengecualikan catatan internal, serta mengaudit pembacaan. Surat memakai endpoint file privat dengan pemeriksaan pemilik dan relasi tindakan resmi; draft, file tanpa relasi dan pegawai/organisasi lain ditolak. Perubahan ini tidak menambah permission HRIS generik maupun mengubah schema.

Verifikasi perubahan tiga kartu: build produksi dan ESLint berhasil; browser 320–1920 px tanpa overflow, tab Menunggu, penghapusan blok saldo/keterangan HRD, dan pembukaan modal kasus tanpa navigasi berhasil. Pemeriksaan API pribadi dan isolasi kasus/surat dengan tabel PostgreSQL temporer mencakup pemilik, organisasi lain, draft, file tanpa relasi dan pencabutan permission. Artefak uji sementara dibersihkan.

### Saldo pilihan, masa kerja ringkas dan riwayat sanksi

Saldo memakai EmployeeBalanceMetric dan DashboardMetric. Nama jenis yang sedang tampil menjadi judul kartu, tanpa diulang di bawahnya; tahun tidak ditampilkan pada teks tersendiri. Indikator penuh membedakan jatah awal "Jatah tahun ini belum digunakan" dari saldo resmi "Saldo tahun ini belum digunakan"; jumlah pemakaian ditampilkan hanya bila ada. Satu jenis tampil langsung; beberapa jenis digeser dengan sentuhan/mouse atau panah keyboard, serta titik navigasi kecil yang dapat dipilih. Bila ada beberapa jenis, kartu berganti otomatis tiap 5 detik; jeda saat kursor berada di kartu, fokus keyboard aktif, tab atau kartu tidak terlihat. Pergantian berlanjut setelah kursor meninggalkan kartu atau fokus keyboard keluar. Pengurangan animasi menonaktifkan autoplay. Titik dibuat dekat indikator dengan jarak aman; tidak ada dropdown atau panah visual. Nama, angka, satuan, keterangan, dan indikator warna selalu berubah bersama jenis yang tampil. DTO saldo menyertakan is_active; hanya jenis aktif yang menggunakan saldo dan sesuai jenis kelamin profil menjadi pilihan. Penyimpanan lokal memakai akun dan organisasi, dengan fallback memori ketika storage diblokir. Pilihan tidak valid kembali ke jenis berhak saldo pertama menurut nama; tidak ada agregasi antarjenis/satuan. Tidak tersedia berbeda dari hak belum ditetapkan, nol dan negatif. Jenis nonaktif dan jenis yang tidak lagi sesuai profil tetap dapat dibaca pada histori. Tanpa tombol jeda permanen, carousel otomatis ini belum memenuhi WCAG 2.2.2.

personalPresentation.mjs memvalidasi tanggal dan bagian masa kerja; hanya bagian positif ditampilkan. Hari pertama tampil sebagai teks dan nilai hilang tidak dianggap nol. Banner menggunakan foto 96px desktop atau 80px mobile dengan pembungkus putih 3px.

DisciplineHistoryList dipakai dashboard (lima terbaru) dan AppModal riwayat (10 per halaman), dengan summary aktif, nama/status/periode/chevron. GET /api/dashboard/discipline_self hanya menerima cursor dan mengembalikan items, active, total, next. SQL memfilter organisasi/user/nondraft, mengurutkan issued_date/id menurun; cursor bertanda HMAC mengikat user, organisasi dan versi urutan. Permission dibaca ulang setiap request. Detail tetap memakai endpoint self dan modal bersama; status belum mulai juga konsisten di detail. Riwayat disembunyikan saat detail tampil lalu posisi, halaman dan fokus dikembalikan. Error dapat dicoba ulang, request dibatalkan saat ditutup/unmount. Tidak ada migration baru.

Verifikasi saldo/riwayat: browser 320–1920 px tanpa overflow, pilihan saldo tersimpan setelah reload, jenis hari/jam, saldo belum ditetapkan/nol/negatif, nama panjang, modal detail tunggal, pemulihan fokus/halaman, error dan coba lagi. PostgreSQL temporer dengan 23 tindakan resmi membuktikan keyset 10/10/3 tanpa duplikasi dan penolakan cursor lintas akun/organisasi/tamper. Fokus isi modal dipulihkan setelah pagination agar Escape bekerja saat tombol halaman berikutnya nonaktif.

### Layout terbaru: profil bersama dan sidebar ringkas

Header sambutan Pegawai dihapus. EmployeeProfileBanner dipindah ke DashboardWorkspace sebelum tab Dashboard/Inventaris; data employee_self dimuat satu kali pada workspace dan diteruskan sebagai dashboardState ke EmployeeDashboard. Pada Inventaris role Pegawai, header halaman tambahan disembunyikan sehingga urutannya profil → tab → konten. Role administratif mempertahankan konteks halaman Inventaris, dengan judul Dashboard Inventaris tanpa sambutan.

DashboardMetric menjadi flex column: keterangan/sparkline berada di bagian bawah secara default; kartu saldo dengan progress mempertahankan keterangan di atas indikator. Status sanksi memakai kolom terpisah align center bersama ikon dan chevron. Aksi Riwayat dan modal daftar dihapus dari UI; klik baris tetap membuka detail kasus dengan guard self dan surat berizin yang sama.

SidebarContent hanya memiliki satu scroll container. Menu bertambah sesuai submenu tanpa terpotong oleh footer tetap. SubscriptionAccessCard diringkas dengan ikon kunci akses, judul/status sebaris, tanggal/sisa hari pada baris berikutnya, tombol Perpanjang akses 44px; keterangan panjang dihapus. Grace/active, tanggal dan perhitungan sisa hari tetap berasal dari session server.

Verifikasi layout terbaru: profil mendahului tab pada Dashboard dan Inventaris, perpindahan tab tidak menambah request employee_self, header sambutan/tombol Riwayat tidak tampil, detail kasus tetap terbuka, status ikon/panah sejajar tengah, keterangan dua kartu sejajar bawah. Browser 320–1920 px tanpa overflow; drawer 375×500 dapat menggulir sampai submenu terakhir dan tombol Perpanjang akses. Kartu masa akses diukur kurang dari 190px, notifikasi Coming soon berhasil. Tab menyelaraskan URL melalui history.replaceState agar workspace tidak dimuat ulang oleh navigasi server.

Ikon masa akses menggunakan alias semantik subscription:access yang dipetakan ke perisai bercentang (SafetyCertificateOutlined) melalui AppIcon bersama. Ukuran 18px pada tile 30px menjaga keterbacaan tanpa menyerupai ikon pencarian.

Jumlah sanksi aktif pada Sanksi & teguran ditampilkan melalui description DataPanel tepat di bawah judul, tanpa kotak pemberitahuan terpisah. Baris pertama tidak menambah garis di atas divider header agar pembatas tetap tipis dan rapi.

Kartu Masa kerja/Sanksi aktif memakai varian balanced DashboardMetric: header dan ikon di atas, angka responsif 26–34px pada area tengah flex, keterangan di bawah divider tipis. Render angka/satuan memakai MetricValue yang sama dengan layout standar. Kartu jatah/sisa cuti memakai nama jenis sebagai judul yang dapat membungkus baris tanpa berbenturan dengan ikon. Indikator bawah menunjukkan persentase jatah yang masih tersedia, termasuk jatah awal dari aturan: penuh hijau, sebagian terpakai kuning, tersisa maksimal 25% merah. Keterangan angka menjelaskan pemakaian bila ada sehingga warna bukan satu-satunya petunjuk. Browser 320–1920 px perlu memverifikasi tinggi kartu, footer sejajar, dan wrapping untuk masa kerja panjang serta kondisi nol.

## Riwayat aktivitas dashboard HRD

Tombol ikon di kanan atas Aktivitas terbaru membuka AppModal di tempat, tanpa
pindah halaman. Judul Riwayat aktivitas; baris memakai DashboardActivityRows
bersama dengan lima aktivitas dashboard. Waktu mengikuti timezone organisasi.
Riwayat default 10 aktivitas per halaman, dengan pilihan 10/20/50; DataPagination menyediakan
Sebelumnya dan Berikutnya. Menutup/membuka kembali dimulai dari halaman pertama.

GET /api/dashboard/activities menerima cursor opsional dan pageSize (10/20/50, default 10). Parameter berulang atau nilai lain ditolak.
Role HRD, sesi aktif dan sekurangnya satu bagian ringkasan berizin diperlukan.
Organisasi selalu dari sesi. Pegawai, Pimpinan, Superadmin, parameter organisasi
atau pegawai dari klien ditolak. Izin diperiksa ulang setiap request.

activityAccess.mjs dan buildOrganizationActivitySql merupakan sumber bersama
ringkasan dan riwayat: hanya pelaku HRD organisasi dengan membership yang berlaku
saat kejadian; login memerlukan snapshot role HRD. Platform dan role lain tidak
masuk. Jenis aktivitas, laporan, target akun serta lokasi mengikuti izin actor.
Draft/internal/file privat dikecualikan sesuai aturan feed yang sama.

DTO baris hanya id, label kegiatan, akun pelaku, ringkasan target publik, timezone, dan
waktu, serta ikon/tone semantik dari katalog bersama. Tidak mengirim before_data/after_data, catatan internal, surat atau path
file. Audit asli tetap append-only; membaca riwayat tidak membuat aktivitas baru.
Respons private/no-store dan tidak menggunakan cache bersama.

Keyset memakai occurred_at dan ID menurun. Cursor HMAC memakai namespace fitur,
berlaku 30 menit dan terikat akun, organisasi, fingerprint izin, daftar lokasi serta ukuran halaman.
Waktu mempertahankan enam digit mikrodetik agar halaman tidak melewatkan aktivitas
yang terjadi pada milidetik sama. Scope/izin berubah, cursor diubah, atau cursor
kedaluwarsa menghasilkan 400 dan meminta pengguna membuka kembali riwayat.

UI menyediakan skeleton, kosong, error dengan Coba lagi, kontrol 44px, tooltip dan
nama aksesibel. AppModal mengelola fokus, Escape dan scroll; useDashboardData
membatalkan fetch ketika halaman berganti atau modal ditutup serta mengabaikan
respons terlambat. Tidak memerlukan migration atau permission generik baru.

Verifikasi: lebih dari 20 aktivitas, timestamp sama dan berbeda mikrodetik,
keyset tanpa duplikasi, kesamaan lima data dengan ringkasan, lintas organisasi,
role lain, membership tidak berlaku, scope lokasi dan izin parsial/tercabut,
cursor palsu/berbeda akun/kedaluwarsa; browser desktop/mobile, keyboard, loading,
kosong, gagal/coba lagi dan tutup saat request masih berjalan.

Pagination memakai slot pagination AppModal di luar body yang bergulir, sama
dengan Kontrak Berakhir; footer hanya berisi Tutup. Mengubah ukuran halaman mereset cursor dan halaman.
DataPagination bersama pada mobile <600px menumpuk ringkasan, tombol Sebelumnya,
tombol Berikutnya, serta dropdown ukuran; tiap kontrol selebar area, minimal 44px
dan jarak 12px. Desktop tetap satu baris bila ruang cukup.

activityPresentation.mjs memetakan kode aksi ke ikon activity:* yang tersedia
secara lokal dan tone tema. Login memakai ikon masuk hijau, edit profil ikon edit
biru, persetujuan cuti kalender hijau, tindakan disiplin perisai warning, pencabutan
ikon urungkan secondary, dan impor/ekspor panah sesuai arah. Aktivitas, target,
akun dan waktu ditata terpisah; label tetap menjelaskan makna tanpa bergantung
pada warna. Tombol pembuka memakai ikon daftar, berbeda dari ikon judul.

ACTIVITY_PRESENTATION_VERSION membatasi versi snapshot visual pada kunci cache
server dan key komponen ringkasan client. Naikkan ketika kontrak ikon/tone berubah
agar snapshot yang telah terbuka dimuat ulang, tanpa polling. Respons ringkasan
menyertakan activityPresentationVersion. Verifikasi wajib membandingkan ikon/tone
aktivitas dengan ID yang sama pada API serta render ringkasan dan modal nyata.

Respons daftar menyertakan total seluruh aktivitas berizin. Total dan halaman
dihitung melalui CTE visible yang sama dalam satu query/snapshot PostgreSQL;
count tidak dipengaruhi cursor dan tidak mencakup data di luar izin/lokasi/role.
DataPagination menampilkan Total: N data dan Ditampilkan: M; M berasal dari
jumlah baris aktual, bukan ukuran halaman pilihan. Tidak mengarang total saat
memuat atau gagal. Slot pagination AppModal tidak ikut scroll; contentResetKey
mengembalikan body ke atas ketika halaman/ukuran berubah. Kontrak Berakhir
memakai pola dan komponen yang sama.
