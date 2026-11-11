# employees access

## Kepegawaian dan Akses

| Komponen                               | Tujuan                                                                                                                                                                                                                                                                                       | Props penting                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `employees/EmployeeDirectory`          | Satu pintu masuk daftar pegawai dengan aksi lihat ringkasan serta edit yang dibatasi untuk HRD dan Superadmin.                                                                                                                                                                               | Tanpa props; role dan organisasi berasal dari session  |
| `employees/EmployeeForm`               | Workflow profil, KTP/pas foto opsional, kontrak, PDF kontrak, penempatan, PDF SK, dan draft tujuh hari. Pada mode edit, perubahan profil dan file disimpan atomik melalui satu request komposit.                                                                                             | `open`, `item`, `organizationId`, callback             |
| `employees/EmployeeImportModal`        | Stepper import Excel data kepegawaian, petunjuk, preview per pegawai, dan commit idempotent.                                                                                                                                                                                                 | `open`, `organizationId`, callback                     |
| `employees/EmployeeDetail`             | Workspace detail responsif dengan ringkasan identitas tanpa duplikasi, preview pas foto/KTP, tab jaminan, pendidikan terstruktur, histori kontrak beserta jejak audit pelaku/waktu, dokumen, disiplin, dan akun sesuai role.                                                                 | `employeeId`; tab aktif melalui query `tab`            |
| `employees/EmployeeLifecycleForms`     | Form record baru untuk rolling/mutasi dan kontrak tanpa menimpa histori.                                                                                                                                                                                                                     | `employee`, callback                                   |
| `employees/EmployeeTerminationForm`    | Workflow terkonfirmasi untuk status Diberhentikan, Pensiun, atau Meninggal dunia; menutup data aktif tanpa menghapus histori.                                                                                                                                                                | `open`, `employee`, `organizationId`, callback         |
| `discipline/DisciplineForms`           | Membuka kasus, mengedit draft tindakan, menerbitkan keputusan, dan mencabut tindakan aktif dengan alasan tanpa menghapus histori. PDF lokal dipertahankan selama sesi form dan dikirim bersama tombol simpan; pembaruan data induk tidak mereset isian. Jarak field 24px, bantuan/error 8px. | `organizationId`, `disciplineCase`, `action`, callback |
| `discipline/DisciplineCaseDetailModal` | Detail lengkap kasus, pembelaan, tindakan, eskalasi, audit penerbit/pencabutan, dan satu aksi unduh surat melalui `AppModal`.                                                                                                                                                                | `open`, `disciplineCase`, `organizationId`, `onClose`  |
| `access/OrganizationAccountForm`       | Membuat akun organisasi, tautan profil opsional untuk HRD/Pimpinan, wajib untuk Pegawai, serta mengatur scope.                                                                                                                                                                               | `item`, `organizationId`, callback                     |

Komponen domain di atas menyusun fondasi reusable umum dan tidak membuat modal, tabel, chip, notification, atau loading shell baru.

Transaksi Barang memakai `TransactionPanel` untuk ledger dan `TransactionWizard` untuk `AppModal` empat tahap. Tombol Catat transaksi memulihkan draft aktif terakhir milik petugas/organisasi; tidak ada daftar draft di halaman. Draft disimpan sebagai checkpoint saat Lanjut, Kembali, Simpan draft & tutup, dan finalisasi; perubahan field tidak mengirim autosave. Pergantian jenis mengosongkan isian sebelumnya. Banner status memakai `AppNotice`, hasil aksi `Notification`, lampiran `PrivateFileUpload`, gambar `ImagePreviewModal`, dan aksi foreground `LoadingBackdrop`. Riwayat hanya menampilkan transaksi tercatat, memakai `DataPanel` dan `DataPagination` cursor; di ponsel tetap berupa baris satu daftar, bukan kartu. Detail menampilkan gambar berukuran memadai dan PDF sebagai item dokumen berizin. Bukti pembelian baru adalah gambar; PDF lama tetap dapat dibuka berizin.

Halaman detail memakai `DetailTabs` sebelum membuat tab shell baru. Informasi dikelompokkan berdasarkan kebutuhan pengguna, status diterjemahkan ke Bahasa Indonesia, dan aksi utama ditempatkan pada header section. Pimpinan memakai workspace yang sama dalam mode read-only tanpa menerima tab atau data akun.

Histori penempatan selalu dapat dibuka melalui modal `Detail penempatan`, termasuk record tanpa dokumen SK. Hanya penempatan aktif tanpa `effective_until` yang dapat dikoreksi; histori bersifat read-only di UI dan wajib ditolak kembali oleh service/API bila diminta langsung.

Data sensitif yang panjang memakai pola kartu ringkas dan `AppModal` detail. Kartu hanya membantu pemindaian daftar; uraian lengkap, pembelaan, audit, eskalasi, serta dokumen ditampilkan pada modal. Satu dokumen resmi hanya menyediakan satu aksi unduh yang tetap melewati endpoint berizin.

`TopMenu` memakai tombol Pengaturan tanpa identitas pengguna pada pop-up. Aksi Profil wajib menuju `/profile` melalui lifecycle loading shell; aksi Keluar memakai alur logout terpusat.

## Modul Cuti & Izin

Form pencatatan membaca saldo dari endpoint ringkasan pegawai sesuai organisasi dan tahun tanggal mulai. Informasi meliputi hak tahunan, pemakaian bersih setelah pembatalan, penyesuaian, sisa saldo, dan perkiraan setelah disimpan. Hak yang belum dicatat mengikuti pengaturan jenis cuti dan baru dibuat dalam transaksi penyimpanan pertama. Saldo belum tersedia, habis, atau tidak mencukupi memblokir Simpan; backend tetap menjadi pemeriksaan final. Filter awal dan Atur ulang menggunakan tahun berjalan pada timezone organisasi.

- Halaman operasional memakai `ResponsiveDataView`, filter server-side, dan state filter di URL.
- `LeaveRequestForm` memakai tombol Simpan dan konfirmasi berisi nama/NIP, jenis, periode, jumlah hari/jam, serta dampak saldo. Validasi gagal memberi notifikasi dan fokus ke field tanpa menghapus isian atau file. Jumlah HRD tetap menjadi dasar pemotongan; perkiraan rentang tanggal memakai hari kalender dan dapat disesuaikan.
- `LeaveDetailModal` menjadi tampilan yang sama untuk HRD, Superadmin, dan Pimpinan read-only.
- Tab pegawai membaca `leave-summary`; saldo berasal dari ledger dan approved record hanya dapat dikoreksi melalui pembatalan beralasan.
- Pencatatan baru menerima satu dokumen pendukung JPEG/PNG/WebP/PDF maksimal 10 MB; total multipart maksimal 11 MB. File dipilih lokal dan baru disimpan bersama pencatatan. Histori lama tetap dapat membuka semua lampirannya. File privat dibatasi organisasi/pegawai dan dibersihkan bila transaksi gagal.

## Laporan pegawai

Semua tabel AntD disusun melalui `data-display/NumberedTable.jsx`, yang menambahkan kolom **No** otomatis. `ResponsiveDataView` memakai wrapper ini dan menampilkan nomor yang sama pada card mobile. Nomor memakai `(page - 1) * pageSize + index + 1`; pagination eksternal/cursor memasok `rowOffset` (jumlah baris sebelum halaman). Tanpa pagination dimulai dari 1. Jangan menambahkan kolom No manual pada menu. Offset laporan dihitung server terhadap filter dan cursor yang sama agar tautan halaman tetap konsisten.

`reports/EmployeeReport.jsx` menyatukan filter URL, daftar desktop/card mobile, ringkasan, navigasi detail, dan ekspor untuk Kontrak Akan Berakhir serta Proyeksi Pensiun. Gunakan komponen ini untuk kedua route, bukan membuat salinan form filter.

`ResponsiveDataView` menerima `pagination={false}` untuk daftar dengan kontrol keyset server sendiri. Semua tabel/daftar berpaginasi memakai `DataPagination` pada desktop dan mobile: `pagination` untuk halaman bernomor, `cursor` untuk keyset, `total` sebagai jumlah seluruh hasil filter, serta `pageSize`/`onPageSizeChange` bila API mendukung 10/20/50 baris. Daftar dengan ukuran halaman tetap memakai `pageSizeOptions={[]}`. Jangan memakai footer AntD tersendiri. `DashboardMetric` menerima `metric.description` sebagai penjelasan indikator, tidak dapat diklik, dan memakai hover seragam dengan dukungan reduced motion. Dashboard tidak memiliki filter tanggal global; tren memakai 12 bulan kalender hingga hari ini. `DashboardAttentionList` juga menerima `title`, `description`, `emptyMessage`, dan `showPriority` untuk daftar lima kasus resmi terbaru. Tombol detail pada daftar tetap dapat digunakan.

## Pengaturan organisasi

Seluruh role masuk melalui `/dashboard`, lalu diarahkan ke Ringkasan Kepegawaian, Ringkasan Pribadi, atau Inventaris yang berizin. Jika lebih dari satu tersedia, sidebar menampilkan submenu Dashboard; jika hanya satu, Dashboard menjadi tautan langsung. `DashboardClient` memasang `OrganizationDashboard` hanya pada Ringkasan Kepegawaian dan `EmployeeDashboard` hanya pada Ringkasan Pribadi. Rute lama `/employee-dashboard` tetap mengarah ke `/dashboard`.

`AppModal` menyediakan `role=dialog`, `aria-modal`, dan hubungan judul/deskripsi pada panel konten agar konfirmasi dapat dikenali pembaca layar.

Lebar panel `AppModal` dibatasi oleh kolom grid yang dapat menyusut sesuai viewport, termasuk saat lebar modal lebih besar dari layar tablet. Footer tetap berada di dalam layar.

`organization-settings/RetirementPolicy` menampilkan usia berlaku, dasar perhitungan, audit terakhir, dan akses laporan. Tombol Ubah/Tetapkan membuka `RetirementPolicyEditor` berbasis AppModal. Form memakai schema bersama, snapshot versi, alasan dan konfirmasi, mempertahankan isian saat gagal, serta meminta konfirmasi sebelum membuang isian. Organisasi dipertahankan di URL; Pimpinan hanya membaca. Tidak ada perubahan status pegawai otomatis.

`ResponsiveDataView` membatasi track grid mobile dengan `minmax(0, 1fr)` dan membolehkan Box dalam kartu menyusut. Nama/NIP dan metadata pegawai membungkus teks panjang; tombol RowActionMenu tetap 44px dan tidak menyusut. Jangan mengganti perbaikan ukuran dengan overflow hidden yang memotong isi. Tes browser prosedur verifikasi fitur memeriksa batas elemen kartu, bukan hanya lebar dokumen, menggunakan data sintetis panjang pada tujuh menu.

- `ConfirmDialog` mendukung ikon ilustrasi, subjudul, dan children untuk rincian dampak; pemanggilan lama tetap didukung. Ikon database, folder file, unduhan paket, mata, perisai, dan tempat sampah mengikuti objek/tindakan, dengan label atau tooltip yang jelas.
- Backup berstatus dihapus menampilkan judul dan ZIP sebagai Dihapus, tanpa spinner atau unduhan. Temuan tetap menjadi histori pemeriksaan saat backup dibuat, bukan indikator kondisi penyimpanan terkini.

- Standar jarak aman: tombol 12px, field/fakta 16px, section dan pemisahan data-aksi 24px, label-nilai 8px, padding kartu mobile minimal 16px. Backup memakai kartu berlabel dengan kelompok aksi terpisah dan tombol lebar penuh pada mobile; kolom Aksi desktop memakai alignment tengah untuk header dan isi.

- Footer `AppModal` menjaga jarak minimal 12px antar tombol, termasuk saat tombol membungkus pada layar kecil.

- `ConfirmDialog.messageAlign` mengatur alignment paragraf utama (default `justify`); konfirmasi hapus backup memakai `center` tanpa mengubah alignment konten rincian.

- Form akun memakai `/api/access/accounts/reference-options`, bukan referensi pegawai umum. Profil yang tertaut ke akun lain (termasuk akun nonaktif) tidak ditawarkan; edit tetap menawarkan profil akun sendiri. Backend memeriksa organisasi/cakupan lokasi, mengunci profil dalam transaksi, dan mempertahankan constraint unik `employees.user_id`. Konflik penautan ditampilkan pada field profil. Daftar akun dimuat ulang saat jendela kembali aktif agar perubahan role oleh pengelola lain dapat terlihat.

## Pas foto sidebar Pegawai

Sidebar desktop dan mobile membaca pas foto Pegawai melalui `/api/uploads/profile_self`
dengan permission `profile_self.read`. Target selalu dipetakan dari session dan
referensi pas foto aktif pada profil akun sendiri. Parameter `photoVersion` hanya
memicu pemuatan ulang setelah foto diganti, bukan memilih file. Endpoint file umum
tetap memerlukan `private_files.read_sensitive`; Pegawai tidak memperoleh akses
ke foto atau dokumen pegawai lain. Preview tetap diaudit dan tidak di-cache.

`useBrowserTimeZone` mendeteksi zona perangkat dengan hydration aman dan fallback UTC. Backup memakai hook ini untuk tampilan waktu lokal, sedangkan nama artefak tetap mengikuti snapshot zona waktu pekerjaan.

## Komponen hak akses HRIS

AppIcon menyediakan ikon semantik tambahan untuk transaksi Inventaris (stok awal, masuk, keluar, pengembalian, stok opname, pembatalan, tambah, dan hapus). Gunakan ID ikon yang terdaftar; ID yang tidak ada akan menampilkan ikon tanda tanya.

Ikon navigasi dan aksi akun topbar (notifikasi, Profil, Keluar) pada `AppIcon` memakai data Iconify lokal, bukan pemuatan nama ikon dari API Iconify. Untuk menggantinya, ubah nama Iconify di `icons/navigationIconSources.mjs`; ID semantik dan komponen tidak perlu diubah. `npm run dev` membuat data saat mulai dan memantau perubahan file tersebut, sedangkan `npm run build` membuat ulang sebelum kompilasi. `npm run icons:check` tetap tersedia untuk memeriksa data tanpa menulis file. Pertahankan gaya Solar bold-duotone untuk seluruh menu dan aksi akun topbar. Dashboard utama memakai animasi skala halus berulang dengan pengganti statis saat pengurangan gerak aktif. Ikon lain yang belum dimigrasikan tetap memakai pemetaan lama.

HrisAccessFields menyusun kelompok menu utama, checkbox submenu dan tingkat
Lihat Saja/Kelola dalam OrganizationAccountForm yang sama dengan Inventaris.
Penetapan admin penuh hanya Superadmin; cakupan lokasi tetap field akun yang ada.
AccountAccessSummary menampilkan satu chip fitur +N fitur lainnya. AccountAccessDetails
dibuka melalui Aksi → Lihat hak akses dan memuat DTO/scope terbaru tanpa mutation. PageHeader dan
RowActionMenu memakai snapshot HRIS untuk menyembunyikan aksi perubahan pada mode
baca; permission tetap wajib diperiksa server. Detail: docs/hris-access-design.md.

## Form fitur dan rincian — migration 052

FeatureAccessFields menyatukan blok HRIS/Inventaris serta pemilih Tambahkan fitur;
field featureModules hanya state presentasi dan tidak dikirim sebagai kontrak API.
HrisAccessFields memakai Collapse kelompok, uraian submenu/level dan pemilih hak
Akun Organisasi. PackageAccessFields mendukung embedded dan onDirty serta beberapa
izin dalam satu blok Inventaris. Teks terpusat di lib/access/accessDescriptions.mjs
serta featureLabels.mjs dipakai form/rincian.
AccountAccessSummary hanya satu chip fitur +N fitur lainnya, tanpa tombol/link.
AccountAccessDetails diekspor terpisah dan dibuka melalui RowActionMenu pada level
halaman. Ikon, status, kemampuan dan scope berkelompok; chip selebar isi, gap aman,
loading/error/kosong dan modal stabil saat breakpoint berubah.

AccessExplanation adalah anotasi kemampuan/batas hak akses, dipakai editor HRIS,
field izin Inventaris dan rincian modal. Komposisi ikon informasi, heading singkat,
permukaan netral, teks justify dan jarak minimal 16px dari dropdown mengikuti
token komponen bersama.
Prop `tone` pada AccessExplanation mengikuti AppNotice (default `info`). Pemberitahuan fitur Absensi nonaktif memakai `danger`: latar merah lembut, ikon/border merah dan teks utama gelap dari theme.
HrisAccessFields memasukkan Akun Organisasi ke Collapse Akun & Akses dengan
checkbox + dua mode aktif; field hidden tetap hrisAccountAccess. Submenu readonly
menggunakan chip Hanya baca, bukan dropdown. Divider memisahkan setiap submenu.

FeatureAccessFields memakai Collapse per fitur, expandedFeatureSections hanya UI;
HrisAccessFields memakai expandedHrisGroups. OrganizationAccountForm mengeluarkan
kedua field dari payload, membuka section error lalu memfokuskan field. Tombol
cabut merah solid berada di footer section. Panel submenu vertikal dan popup wrap
menggantikan dua kolom, tanpa Informasi menu. Dashboard dasar tidak diatur grant;
sidebar/editor memakai metadata menuCatalog.mjs bersama dan validator registrasi.
DashboardClient menampilkan section dari DTO parsial; absence tidak menjadi nol
atau kartu kosong. Link Pegawai pada prioritas/pensiun mengikuti izin Data Pegawai.

PrivateFileUpload menunggu Promise dari onRemoveRequest, mempertahankan loading
selama operasi pemilik dan meneruskan kegagalan melalui onError. Callback yang
membuka konfirmasi dapat tetap synchronous; adapter tidak membersihkan value
pemilik secara otomatis. Inventory CatalogPanel (deferred photo) dan
TransactionWizard (purchase proof/request document/handover photo) sudah memakai
adapter yang sama. Scanner optional hanya development; production tetap fail closed.

LoadingBackdropProvider membedakan token proses (startLoading/runWithLoadingBackdrop)
dan token navigasi. Token navigasi memiliki deadline 30 detik agar pembatalan stream
RSC tidak mengunci overlay selamanya. Jika href internal tersedia dan tidak ada proses upload/simpan aktif, timeout membuka tujuan yang sama lewat request dokumen baru. Tanpa href valid atau saat proses lain masih aktif, hanya token navigasi dilepas dan Notification pemulihan tampil. Back/Forward
serta pageshow persisted juga melepas token navigasi. Timer lama dibatalkan ketika
navigasi selesai/diganti atau provider dilepas. Token upload/simpan tidak diakhiri
oleh pemulihan navigasi. Fase request login/logout memakai token proses, sedangkan
perpindahan setelah respons memakai token navigasi; endpoint dan aturan auth tetap.

### Export daftar Cuti & Izin

`reports/LeaveBalanceFields` menyatukan label, angka, dan satuan Hak/Terpakai/Sisa pada tiga kolom desktop dan grup saldo mobile. `LeaveBalanceValue` menekankan Sisa dengan token brand serta menyediakan label aksesibel, tanpa memotong angka. `LeaveBalanceEmpty` membedakan saldo belum tersedia dari jenis tanpa saldo. Rekap memakai ReportIdentity/EmployeeAvatar dan ImagePreviewModal untuk foto privat profil.

`reports/LeaveSummaryReport` menyusun PageHeader, OperationalFilterSection, DataPanel, ResponsiveDataView dan DataPagination untuk **Rekap Cuti & Izin**, tanpa kartu/grafik yang berulang dengan Dashboard. Cari pegawai berada sebelum Tahun; dropdown menggunakan AsyncSelect. `LeaveSummaryDetailsModal` memakai AppModal dengan API laporan sendiri. Ikon menu `navigation:leave-summary` berbeda dari kalender operasional. Filter tersimpan di URL; loading, kosong, dan error terpisah. Hak akses dan definisi angka: `docs/leave-summary-report.md`.

`ProtectedShell` membedakan logout yang sedang berjalan dari sesi kedaluwarsa. Logout menghentikan polling, membatalkan request akses aktif, menonaktifkan timer sesi serta modal countdown, dan mengabaikan respons lama. Kegagalan logout memulihkan pemeriksaan sesi dan memungkinkan percobaan ulang; sesi yang benar-benar berakhir tetap menampilkan ExpiredSessionModal.

Daftar Cuti & Izin memakai `DataPanel.exportConfig` dan `TableExportMenu` yang sama dengan tabel lain. Excel memakai query daftar tanpa pagination melalui `/api/leave-requests/export`; PDF tetap notifikasi Coming soon. Label jenis/status/satuan dipusatkan di `lib/leave/labels.mjs` dan diekspor ulang oleh `leave/leaveLabels` agar UI dan workbook konsisten. Kontrak ekspor: `docs/leave-export.md`.
