# layout data

## Layout dan Filter

Petunjuk periode BulkScheduleExceptionDialog memakai AppNotice sebelum pemilih tanggal, bukan deskripsi FormSection. Bahasa komponen wajib ditinjau bersama label/tombol/validasi: kalimat pendek, kata umum dan tindakan/dampak yang konkret sesuai AGENTS.md serta pedoman UI/UX.

BulkScheduleExceptionDialog hanya mengubah jam kerja: tidak ada radio Jenis hari atau dayType; shiftIds wajib 1–16, dikirim langsung setelah validasi. Pilihan libur tidak tersedia pada opsi operasional. Backend memeriksa ulang tipe revisi tiap tanggal tanpa mengubah resolver atau histori libur.

`data-display/AppCollapse` adalah fondasi pelipatan konten berbasis AntD: items, activeKey/defaultActiveKey, onChange, accordion, styles, extra dan forceRender tetap mengikuti kontrak library. Header minimal 44px, label membungkus, destroyOnHidden default false; forceRender ditentukan kebutuhan form. Pemakai: akses fitur/HRIS, profil/impor Pegawai, tanggal/kategori libur, pilihan shift, pengaturan jam, dan ringkasan hari. Adapter AppCollapseRegion dipakai navigasi; AppAccordion/Summary/Details mempertahankan laporan existing. Hanya file ini boleh mengimpor primitive Collapse/Accordion library; ESLint memeriksanya.

`employees/SelectedEmployeesList` menyusun daftar semantik ul/li, EmployeeAvatar interaktif dan FontStyle; baris identitas full width tanpa header tabel/pagination, scroll lokal maksimal min(360px, 40dvh), footer total Pegawai. onPreview membuka ImagePreviewModal privat. Dipakai penetapan dan perubahan harian. Modal sumber memakai keepMounted ketika ditutup sementara untuk preview agar form/list terpelihara; hanya satu modal aktif.

WorkSchedulePage menyimpan langsung melalui tombol Tetapkan jadwal. ScheduleSummary melipat rincian per hari. WorkScheduleFields membatasi tanggal mulai berdasarkan hari ini organisasi dan tanggal bergabung, termasuk validasi input manual. Collapse daftar mempertahankan isian ketika dibuka/ditutup.

AppModal menyembunyikan scrollbar untuk shell dan seluruh region di dalamnya melalui styling bersama, tanpa menonaktifkan scroll. Body memiliki region Isi modal yang dapat difokuskan untuk scroll keyboard. Header/footer tetap mengikuti fondasi existing.

Toolbar Jadwal Pegawai menonaktifkan Ubah jadwal harian bila pilihan mengandung Pegawai tanpa penetapan aktif/mendatang, disertai AppNotice warning terpisah di atas DataPanel, berisi jumlah tanpa nama dan arahan. Toolbar tidak menampilkan teks jumlah pilihan. BulkScheduleExceptionDialog tetap memeriksa seluruh tanggal melalui server sebelum tinjauan dan simpan; pilihan tidak dipotong otomatis.

`employees/SelectedEmployeesSummary` menyusun EmployeeAvatar dan FontStyle untuk avatar beberapa Pegawai, label +N Pegawai lainnya di samping avatar tanpa mengulang total di header; total hanya di footer, panah tetap ujung kanan rata tengah. Tidak ada teks Lihat daftar Pegawai; body Collapse tanpa padding ganda. Ringkasan hanya dapat dilipat bila jumlah >1; daftar dibuka inline melalui AppCollapse. `EmployeeAvatar`/`PhotoAvatar` mendukung `interactive=false` untuk foto di dalam tombol ringkasan/daftar tanpa tombol bersarang; default pemakai lain tetap interaktif.

`work-schedules/BulkScheduleExceptionDialog` menyusun AppModal, ResponsiveRangePicker, FormSection, AsyncSelect, AppNotice dan DataPagination. Tahap form/tinjauan/rincian benturan berada dalam satu modal; daftar Pegawai dibuka inline melalui AppCollapse; Form tetap mounted agar isian terpelihara. Ringkasan memakai SelectedEmployeesSummary. Daftar bergulir di dalam panel Collapse, tanpa header tabel/pagination dan footer hanya total; footer mobile dari AppModal. Penyimpanan memakai previewHash dan requestKey yang tetap selama retry. Toolbar melayani pilihan massal; menu Aksi melayani satu Pegawai melalui form yang sama. Filter minimum berasal dari API opsi jadwal yang sudah berizin.

`DailyAdjustmentReview` memakai AppCollapse per rentang tanggal/Pegawai dengan jam dan alasan masing-masing; perubahan sebelumnya memakai alasan dari audit berizin. `ScheduleConflictDetails` menampilkan benturan pertama berikut dua rentang jam, Pegawai dan tanggal kerja. Keduanya isi modal, tanpa shell sendiri. `AppNotice.centerContent` menyelaraskan ikon dan isi secara vertikal untuk pesan benturan pendek; default notice lain tidak berubah. Detail alasan pada pilihan jadwal yang bertabrakan memakai warna danger serta teks, bukan warna saja.

HolidayDateList menyusun Collapse kategori Libur nasional/Cuti bersama, tertutup pada awalnya. Header menampilkan jumlah tanggal dan jumlah dipilih bila digunakan pada pemilih katalog. Isi tetap ResponsiveDataView dengan empty state, pilihan tanggal terkunci dan metadata sumber existing; forceRender mempertahankan state saat dilipat. Berlaku pada detail, tinjauan, pratinjau API/OCR dan pemilih kalender agar pola tidak berbeda antaralur. Tidak menambah modal atau menyalin tabel/header panel di dalam Collapse.

`forms/AppYearPicker` menerima/menghasilkan tahun numerik, memakai DatePicker picker=year, inputReadOnly, minYear/maxYear dan popup responsif dengan target 44 px. Pembatasan tahun lampau hanya diaktifkan pada pembuat katalog baru; histori dan filter tidak ikut dibatasi. `forms/FormSection` memakai `first` eksplisit hanya di awal form; padding section tengah tetap 24 px meskipun berada di wrapper baru. Jangan kembali memakai selector first-of-type untuk jarak antarsection.

Escape pada popup tahun menghentikan propagasi ke modal induk: tutup popup dahulu, pertahankan form. Aturan ukuran popup scoped pada sitou-year-picker-popup dan mengatasi prioritas theme AntD, tanpa mengubah popup pemilih tanggal lain.

`holiday-catalogs/HolidayDayFields` menyusun Collapse per tanggal. Header berisi tanggal terpilih (Pilih tanggal bila kosong), nama dan kategori; tanggal baru terbuka, tanggal existing lengkap dapat tertutup. Field memakai forceRender agar validasi dan nilai tetap terpelihara. Prop validationFailure dari pemakai membuka baris gagal dan memfokuskan field pertama. HolidayCatalogPage meneruskan kegagalan validateFields/server; HolidayPdfStage meneruskan onFinishFailed dan membuka koreksi. Aksi hapus di extra tidak ikut membuka/menutup panel.

`holiday-catalogs/CatalogEntryMethod` adalah pilihan radio responsif Ambil otomatis / Input manual + PDF. `HolidayPdfSource` menyusun FileUploadField existing langsung pada form manual; `useHolidayPdfImport` berbagi lifecycle unggah/polling dengan tahap HolidayPdfStage dalam AppModal yang sama. Hasil OCR tidak menimpa isian sampai Gunakan hasil pembacaan; tindakan itu belum menyimpan. HolidayDayFields menyusun EmptyState, IconActionButton, DateField dan AsyncSelect untuk kartu isian responsif, batas 366 serta tahun kalender yang sesuai. Jangan mengganti pola ini dengan tombol unggah/form/modal ad hoc.

`holiday-catalogs/HolidaySourcePreview` menyusun AppNotice, FontStyle dan HolidayDateList untuk hasil pengambilan setahun, sumber/waktu server, serta perbedaan tambahan/perubahan/penghapusan. Ini tahap dalam AppModal katalog existing. Kembali mempertahankan form; Gunakan dan simpan draft memanggil penyimpanan standar. Jangan membuat modal bertumpuk atau menerbitkan data hasil fetch otomatis.

`holiday-catalogs/CalendarEditor` menyusun AppModal untuk kalender organisasi dan tahap CalendarCatalogPicker, mempertahankan form tanpa modal bertumpuk. HolidayDateList menyusun DataPanel/ResponsiveDataView untuk kelompok Libur nasional dan Cuti bersama, pilihan berlabel, tanggal terkunci serta pratinjau. Form edit katalog terbit memakai HolidayDayFields yang sama pada kedua cara pengisian. HolidayCatalogPage memakai fondasi filter/tabel/pagination, AppNotice, CompactInfoChip dan ConfirmDialog bersama untuk draft–tinjau–publikasi platform dan edit katalog terbit dengan penyimpanan langsung setelah tinjauan. Daftar utama menampilkan satu katalog per tahun; filter histori menampilkan semua revisi dan draft. Kontrak asal tanggal dan prosedur revisi: `docs/holiday-catalogs.md`.

Ringkasan jadwal memakai chip Hari kerja (success) dan Hari libur (info). Pemberitahuan libur berada pada tiap hari tanpa sesi kerja aktif, termasuk sesi `off`; tidak bergantung pada nama hari. Kalender tambahan tetap dijelaskan terpisah bila dipilih. Pada editor jam per hari, Jam utama memakai success dan Jam khusus memakai info.

`AppModal` mengatur footer mobile secara terpusat: tombol satu per baris, full width, tinggi minimal 44px, jarak 12px, termasuk di dalam AntD Space. Desktop tetap sejajar. `ScheduleSessionDetails` menyatukan fakta berlabel untuk ringkasan harian dan shift; `ScheduleSummary` memakai pembatas antarhari dan `ScheduleHolidayNotice` untuk aturan libur.

`forms/AppTimePicker` menjadi pemilih jam bersama berformat `HH:mm`. Pilihan langsung diterapkan tanpa konfirmasi (`needConfirm=false`). Tombol opsional “Pilih jam” selebar footer menutup panel dan mengembalikan fokus ke field. `work-schedules/TimeField` memakai komponen ini untuk seluruh form jam jadwal, termasuk jam utama, pengecualian harian, shift dan form lama.

`FontStyle explanation` adalah gaya paragraf penjelasan/informasi: justify,
baris terakhir normal, serta pemenggalan kata yang wajar. Deskripsi PageHeader,
DataPanel, AppModal, dan FormSettingSwitch menerapkannya otomatis. ConfirmDialog
memakai justify secara default; `messageAlign="center"` tetap mempertahankan
desain pesan utama seperti modal hapus backup. Judul, label, angka, dan metadata
tidak memakai gaya paragraf ini. Tulis penjelasan sederhana dalam 1–3 kalimat.
Bantuan field AntD (`Form.Item extra`) mengikuti alignment paragraf yang sama
melalui theme terpusat. Override center yang eksplisit tetap digunakan sesuai konteks.

`forms/PasswordStrengthIndicator` menampilkan perkiraan Lemah/Sedang/Kuat untuk
kata sandi backup. Estimator dimuat lokal saat modal aktif; indikator tidak
memblokir kata sandi pendek dan tidak mengirim kata sandi ke layanan lain.

| Komponen                           | Tujuan                                                                                                                 | Props penting                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `layout/PageHeader`                | Paper header operasional dengan breadcrumb, identitas visual, metadata, judul, deskripsi, dan aksi utama.              | `title`, `description`, `action`, `leading`, `metadata`, `breadcrumbs`, `menuList` |
| `navigation/AppBreadcrumbs`        | Breadcrumb rekursif yang mengikuti route paling spesifik dari `MenuConfig` dan lifecycle loading navigasi.             | `items`, `menuList`, `fallbackLabel`                                               |
| `navigation/DetailTabs`            | Workspace detail dengan tab berikon, active state, konten terpadu, keyboard, dan horizontal scroll mobile.             | `items`, `activeKey`, `onChange`, `ariaLabel`                                      |
| `filters/OperationalFilterSection` | Section filter yang selalu terlihat dengan label, grid responsif, dan aksi atur ulang untuk daftar operasional.        | `title`, `description`, `items`, `onReset`, `onRefresh`, pencarian/status opsional |
| `navbar/ProtectedShell`            | Shell terproteksi yang menyatukan topbar, sidebar desktop, drawer mobile, subscription, sesi, loading, dan notifikasi. | `user`, `children`                                                                 |
| `auth/AuthenticatedUserProvider`   | Membagikan identitas session terverifikasi kepada halaman client tanpa request tambahan.                               | `user`, `children`; hook `useAuthenticatedUser`                                    |

## Data Display

`actions/RowActionMenu` mendukung `buttonLabel` untuk teks tombol yang terlihat dan `fullWidth` untuk footer kartu mobile. `triggerLabel` tetap menjadi nama aksesibel yang dapat menyebut record. Tanpa kedua prop baru, tombol tetap ikon 44px seperti sebelumnya. Penyaringan aksi berdasarkan izin tetap berlaku; item dropdown memiliki target minimal 44px. Kartu daftar Cuti & Izin memakai varian berlabel di footer dan ReportCardFields untuk fakta terpisah, bukan menumpuk NIP/nomor/periode/durasi sebagai metadata gabungan.

| Komponen                          | Tujuan                                                                                          | Props penting                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `data-display/DataPanel`          | Satu paper untuk judul daftar, ringkasan, aksi hasil, data view, dan pagination.                | `title`, `description`, `toolbar`, `children`                                                                                         |
| `data-display/ResponsiveDataView` | AntD Table pada tablet/desktop dan card list dengan loading serta pagination pada mobile.       | `data`, `columns`, `renderCard`, `pagination`, `onPageChange`, `loading`, `error`                                                     |
| `data-display/DataPagination`     | Navigasi bersama untuk daftar master bernomor dan riwayat besar berbasis cursor.                | `pagination`, `onPageChange` atau `cursor`, `onPrevious`, `onNext`, `count`, `loading`                                                |
| `data-display/PhotoAvatar`        | Avatar foto privat yang dapat diperbesar; inisial saat tidak ada foto atau gambar gagal dimuat. | `name`, `photoUrl`, `photoLabel`, `previewTitle`, `size`, `onPreview`                                                                 |
| `data-display/EmptyState`         | Empty/no-result state umum.                                                                     | `title`, `description`                                                                                                                |
| `data-display/ErrorState`         | Error state dengan aksi retry.                                                                  | `message`, `onRetry`                                                                                                                  |
| `data-display/AppNotice`          | Panel informasi tetap pada halaman/modal, dengan warna dan ikon semantik terpusat.              | `tone=info/warning/success/danger`, `title`, `description`/`children`, `descriptionAlign`, `descriptionId`, `action`, `compact`, `sx` |
| `chips/CompactInfoChip`           | Satu-satunya chip untuk metadata dan status, dengan tone semantik, ikon, dan label.             | `label`, `status`, `tone`, `icon`, `color`, `sx`                                                                                      |

Area daftar operasional wajib memeriksa `DataPanel` sebelum membuat wrapper baru. Filter memakai section terpisah sebelum hasil. Toolbar panel hanya memuat aksi hasil, bukan pencarian atau pilihan filter. Hindari paper tambahan untuk tabel di dalam panel; card hanya dipakai sebagai item berulang pada mobile. `CompactInfoChip` menangani metadata sekaligus status agar tidak ada reusable badge kedua dengan fungsi sama. Chip dipakai untuk data yang perlu ditonjolkan, bukan seluruh teks tabel.

Gunakan `AppNotice` untuk arahan atau peringatan yang tetap terlihat, termasuk di dalam `AppModal` dan penjelasan hak akses. Info biru, peringatan kuning, keberhasilan hijau, dan kegagalan merah. Paragraf isi rata kiri-kanan secara default; judul dan tombol tidak. Untuk pesan yang memang didesain rata tengah, tetapkan `descriptionAlign="center"` secara eksplisit. Teks harus menyebut dampak serta tindakan berikutnya tanpa mengandalkan warna saja. `Notification` tetap untuk pesan sementara; jangan menggantinya dengan panel tetap.

EmployeeDirectory menambahkan filter Status perkawinan melalui AsyncSelect dengan MARITAL_STATUS_OPTIONS yang sama dengan pendaftaran. Clear/reset menghapus maritalStatus dan ekspor mempertahankan filter aktif.

`OperationalFilterSection` adalah satu-satunya shell filter daftar. Letakkan sebelum `DataPanel`, bukan di toolbar tabel. Akun Organisasi, Organisasi, seluruh master HRD, kategori/satuan/gudang Inventaris, dan Pengaturan Sanksi memakai props pencarian/status bersama dengan label sesuai domain; field tambahan disusun melalui `items`. Reset bawaan mengosongkan pencarian dan memilih Semua status tanpa mengubah organisasi. Reset domain melalui `onReset` harus tetap mempertahankan organisasi wajib. `onRefresh` opsional menampilkan aksi Muat ulang. Dropdown status memakai `AsyncSelect`. Jangan menambahkan pilihan yang tidak didukung query server.

`OperationalFilterSection` membatasi `wideColumns` maksimal 4: desktop >=1200px empat kolom, 900-1199px tiga, 600-899px dua, dan mobile satu. Field tambahan masuk baris berikutnya.

Ekspor opsional memakai `DataPanel exportConfig={{ enabled: true, onExcel, loading, disabled }}`.
Laporan memakai `ReportCardFields` untuk baris label-nilai berdivider dan `ReportRemaining` untuk chip tenggat bersama dashboard. Padding halaman/panel/kartu mengikuti shell, `DataPanel`, dan `ResponsiveDataView`, tanpa padding halaman tambahan.
Tanpa konfigurasi atau dengan `enabled: false`, tombol tidak tampil. `TableExportMenu` menempatkan
Export di kanan judul; di bawah 1024px hanya ikon dengan tooltip. Excel memanggil handler modul,
sedangkan PDF hanya menampilkan pemberitahuan segera hadir. Permission, filter, audit, dan batas
unduhan tetap ditangani endpoint modul. Ekspor tersedia pada laporan terkait dan menu Data Pegawai. Pada Data Pegawai, menu Export berada di kanan judul tabel seperti halaman laporan, sedangkan Import data dan Tambah pegawai tetap menjadi aksi halaman. Endpoint tetap menjadi sumber permission, filter, scope lokasi, audit, dan batas unduhan.

## Acuan font dan penemuan komponen

Font UI dipusatkan di `app/theme/typography.js` (`appFont`, `APP_FONT_FAMILY`, `APP_FONT_WEIGHTS`). Layout, CSS global, Material UI, Ant Design dan grafik membaca konfigurasi yang sama; FontStyle serta breadcrumb mengikuti theme. Jangan menentukan nama font per komponen. Cara mengganti font lokal: `docs/typography.md`.

Periksa katalog dan folder `app/components` sebelum membuat komponen baru. Nama komponen mengikuti fungsi umum, bukan nama menu pertama yang memakainya.
