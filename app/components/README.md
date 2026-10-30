# Katalog Komponen Reusable SITOU

Font UI dipusatkan di `app/theme/typography.js` (`appFont`, `APP_FONT_FAMILY`, `APP_FONT_WEIGHTS`). Layout, CSS global, Material UI, Ant Design dan grafik membaca konfigurasi yang sama; FontStyle serta breadcrumb mengikuti theme. Jangan menentukan nama font per komponen. Cara mengganti font lokal: `docs/typography.md`.

Periksa katalog dan folder `app/components` sebelum membuat komponen baru. Nama komponen mengikuti fungsi umum, bukan nama menu pertama yang memakainya.

## Layout dan Filter

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

## Actions dan Modal

| Komponen                     | Tujuan                                                                                                                                       | Props penting                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `actions/RowActionMenu`      | Menu aksi per baris/kartu dengan target sentuh yang aman.                                                                                    | `items`                                                                                                                 |
| `actions/ConfirmDialog`      | Konfirmasi risiko yang menyusun `AppModal`.                                                                                                  | `open`, `title`, `message`, `confirmText`, `danger`, `onConfirm`, `illustration`, `heading`, `children`, `messageAlign` |
| `modals/AppModal`            | Satu-satunya modal shell umum untuk form, detail, konfirmasi, dan konten React. Properti ikon menerima nama Iconify atau elemen React lokal. | `open`, `onClose`, `title`, `description`, `icon`, `size`, `width`, `component`, `onSubmit`, `footer`, close controls   |
| `modals/ExpiredSessionModal` | Feedback sesi kedaluwarsa, countdown, progress, dan redirect login.                                                                          | `open`, `secondsRemaining`, `onLogout`                                                                                  |
| `modals/ImagePreviewModal`   | Preview endpoint privat/blob/file lokal dengan loading, error, alt text, dan zoom.                                                           | `imageUrl`, `alt`, `title`, `open`, `onClose`                                                                           |

`LoadingBackdrop` dan `Notification` dikontrol parent. Modal fitur wajib menyusun `AppModal`; dilarang membuat modal shell lain.

Pada detail pegawai, tab Dokumen hanya menampilkan checklist kelengkapan. Upload serta aksi file ditempatkan pada konteks domainnya supaya pengguna tidak melihat dua kontrol dengan fungsi sama: identitas melalui Profil Lengkap, kontrak melalui histori Kontrak, SK melalui histori Penempatan, serta ijazah dan sertifikat melalui tab Pendidikan.

Popup AntD seperti Select, DatePicker, Dropdown, Tooltip, dan Popover memakai `zIndexPopupBase` terpusat pada `approvider/AppProviders.jsx`. Jangan memberi z-index per field; popup harus tetap berada di atas `AppModal` dan di bawah LoadingBackdrop/Notification.
Seluruh tanggal form memakai `DatePicker` dengan locale terpusat; komponen fitur hanya mengubah nilai Day.js menjadi ISO `YYYY-MM-DD` ketika menyusun request API dan tidak menyediakan input tanggal manual.

## Form dan Select

| Komponen                             | Tujuan                                                                                                                                                 | Props penting                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `forms/AsyncSelect`                  | Dropdown pilihan wajib untuk form, filter, dan pagination: pencarian label selalu aktif; mendukung pencarian server melalui onSearch/filterOption.     | Props AntD `Select`, `loading`, `options`                                                                                 |
| `forms/OrganizationScopeField`       | Pemilih organisasi Superadmin atau organisasi session HRD yang terkunci.                                                                               | `disabled`                                                                                                                |
| `forms/FormSettingSwitch`            | Satu-satunya kontrol on/off untuk form domain non-pegawai; menyatukan judul, penjelasan, kondisi terkunci, dan field lanjutan.                         | `name`, `title`, `description`, `notice.on/off`, `disabled`, `disabledReason`, `children`, `switchProps`, `formItemProps` |
| `forms/FileUploadField`              | Dropzone umum untuk Excel, PDF, gambar, dan dokumen; gambar selalu dilihat melalui `ImagePreviewModal`.                                                | `value`, `accept`, `maxSizeBytes`, `onSelect`, `onRemove`, `previewUrl`                                                   |
| `forms/FileUploadListField`          | Adapter file lokal yang menyusun `FileUploadField`; `maxCount=1` menampilkan satu area untuk pilih, ganti, dan hapus. `id` mendukung fokus error form. | `value`, `accept`, `maxSizeBytes`, `maxCount`, `onChange`, `onError`, `fullWidth`, `id`                                   |
| `forms/IndonesiaPhoneInput`          | Input nomor seluler Indonesia dengan prefix tetap `+62` dan nilai E.164.                                                                               | Props standar AntD Input: `value`, `onChange`, `disabled`, `placeholder`                                                  |
| `forms/IndonesianNationalIdInput`    | Input NIK 16 digit dengan penyaring angka, counter, dan indikator valid.                                                                               | Props standar AntD Input: `value`, `onChange`, `disabled`, `placeholder`                                                  |
| `forms/PrivateFileUpload`            | Adapter upload privat umum berbasis file ID atau pilihan file tertunda untuk form komposit, dengan backdrop global opsional.                           | `value`, `deferred`, `uploadUrl`, `removeUrl`, `fields`, `accept`, `maxSizeBytes`, `showRemove`                           |
| `forms/PrivatePdfUpload`             | Adapter upload PDF privat berbasis file ID yang menyusun `FileUploadField`.                                                                            | `value`, `uploadUrl`, `removeUrl`, `fields`, `organizationId`, `onChange`, `showRemove`, `backdropMessages`               |
| `selects/OrganizationSelect`         | Pilihan organisasi dari endpoint options.                                                                                                              | `excludeIds`, `autoSelectFirst`, `includeAll`, props `AsyncSelect`                                                        |
| `selects/LocationSelect`             | Pilihan lokasi aktif berdasarkan organisasi; label kode dapat disembunyikan pada filter.                                                               | `organizationId`, `showCode`, props `AsyncSelect`                                                                         |
| `selects/OrganizationUnitTypeSelect` | Pilihan jenis unit aktif per organisasi dan pilihan lama saat edit.                                                                                    | `organizationId`, `includeId`, props `AsyncSelect`                                                                        |
| `selects/EmployeeSelect`             | Pilihan pegawai aktif sesuai organisasi dan cakupan lokasi actor; callback pilihan juga menerima pegawai preset setelah opsi selesai dimuat.           | `organizationId`, `excludeId`, `showEmployeeNumber`, `onSelectedEmployeeChange`, props `AsyncSelect`                      |

Form domain tetap berada di modul fitur dan dirender sebagai children `AppModal`. Gunakan `hooks/useFormModalClose` bersama `ConfirmDialog` untuk dirty-state warning.
Form fitur non-pegawai dilarang memakai `Switch` AntD secara langsung. Susun pengaturan terkait dengan `FormSettingsGroup` dan `FormSettingSwitch`; gunakan judul yang menjelaskan dampak bagi pengguna, bukan istilah teknis seperti "Status aktif". Gunakan `Segmented` untuk pilihan mode yang saling eksklusif dan `Checkbox` hanya untuk beberapa pilihan independen atau persetujuan.

Untuk switch status aktif/nonaktif, gunakan `FormSettingSwitch` dengan `notice.on` dan `notice.off` (masing-masing judul serta penjelasan dampak). Switch tampil sebagai aksi di dalam `AppNotice`; jangan ulangi status sebagai baris label atau panel informasi terpisah. Status aktif memakai notifikasi dan switch hijau (warna keberhasilan); status nonaktif memakai notifikasi peringatan dan switch abu-abu. Switch pengaturan lain yang bukan status tetap memakai bentuk label dan bantuan biasa.
Form panjang dengan tab/collapse wajib mengarahkan validasi ke section bermasalah: tampilkan Notification, buka dan tandai section, lalu fokuskan field pertama yang gagal.
Seluruh UI pemilihan file wajib memakai `forms/FileUploadField`; adapter domain boleh menyusunnya untuk menangani endpoint atau lifecycle khusus.
Seluruh aksi lihat gambar wajib memakai `modals/ImagePreviewModal`; jangan membuka gambar langsung pada tab browser atau membuat modal preview per fitur.

## Subscription dan Feedback

| Komponen                          | Tujuan                                                                                                                                                     | Props penting                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `subscription/SubscriptionStatus` | Status ringkas masa akses organisasi pada topbar.                                                                                                          | `status`, `endsOn`, `graceEndsOn`, `daysRemaining`                                    |
| `subscription/SubscriptionBanner` | Peringatan 30 hari terakhir dan tombol perpanjang.                                                                                                         | `status`, `endsOn`, `graceEndsOn`, `daysRemaining`, `onRenew`                         |
| loading/LoadingBackdropProvider   | Mengelola token proses dan navigasi; backdrop aktif sampai seluruh proses selesai. Durasi visual minimum memakai helper terpusat bila alur membutuhkannya. | startLoading, runWithLoadingBackdrop, startNavigationLoading, finishNavigationLoading |
| `Notifications/Notification`      | Feedback berhasil, gagal, peringatan, atau informasi.                                                                                                      | `open`, `message`, `severity`, `onClose`                                              |
| `font-style/FontStyle`            | Satu-satunya typography MUI SITOU.                                                                                                                         | Props typography; bobot 500, 600, atau maksimal 700                                   |

## Dashboard dan Visualisasi

| Komponen                               | Tujuan                                                                                                                            | Props penting                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `dashboard/DashboardMetric`            | Panel KPI dengan aksen status, angka lokal, ikon, dan dukungan microtrend.                                                        | `metric`, `loading`                                                                  |
| `dashboard/DashboardCardPlaceholder`   | Kartu HRD terkunci atau data belum tersedia; dekorasi sintetis tanpa dataset sensitif.                                            | `title`, `kind`, `locked`                                                            |
| `dashboard/DashboardChart`             | Shell grafik dengan header, tinggi stabil, loading, empty state, dan hover yang halus.                                            | `title`, `description`, `icon`, `loading`                                            |
| `dashboard/AreaTrendChart`             | Grafik area untuk membandingkan arus perubahan berdasarkan periode.                                                               | `data`                                                                               |
| `dashboard/HorizontalBarChart`         | Grafik batang horizontal untuk label kategori yang panjang.                                                                       | `data`, `percent`                                                                    |
| `dashboard/StackedBarChart`            | Grafik batang bertumpuk untuk komposisi beberapa seri.                                                                            | `data`, `horizontal`                                                                 |
| `dashboard/DonutChart`                 | Grafik donut kelengkapan data dengan total dan legend Bahasa Indonesia.                                                           | `data`                                                                               |
| `dashboard/MetricSparkline`            | Grafik mini tanpa sumbu untuk tren pada KPI.                                                                                      | `data`, `color`                                                                      |
| `dashboard/DashboardAttentionList`     | Daftar prioritas operasional dengan tingkat urgensi.                                                                              | `items`, `loading`                                                                   |
| `dashboard/EmployeeCompositionSummary` | Satu panel snapshot komposisi jenis kelamin, status, masa kerja, dan jenis kepegawaian.                                           | `data`, `loading`                                                                    |
| `dashboard/DashboardCardPlaceholder`   | Siluet sintetis untuk kartu HRD terkunci; jenisnya harus mengikuti konten asli dan tidak menerima data tanpa izin.                | `title`, `kind`, `locked`                                                            |
| `modals/AccessChangedModal`            | Modal pencabutan izin dengan hitungan mundur beraksen brand. Peringatan isian bersifat kondisional dan tidak tampil di Dashboard. | `mode`, `secondsRemaining`, `onContinue`, `showUnsavedNotice`                        |
| `modals/AccessCountdownPanel`          | Panel hitungan mundur responsif; varian ringkas beraksen brand untuk perubahan izin, varian standar untuk sesi berakhir.          | `secondsRemaining`, `destination`, `description`, `label`, `icon`, `compact`, `tone` |
| `dashboard/DashboardActivityList`      | Aktivitas organisasi dengan pelaku, tindakan, nama/NIP pegawai, dan waktu organisasi; tanpa payload audit sensitif.               | `items` (`label`, `actor`, `subject`, `occurredAt`, `timezone`), `loading`           |
| `dashboard/chartAdapter`               | Sumber konfigurasi ApexCharts untuk theme, format Indonesia, responsive behavior, tooltip, dan animasi.                           | `createChartOptions`, `formatChartCategory`                                          |

Seluruh grafik dashboard wajib menyusun adapter ApexCharts terpusat dan dirender melalui `ApexChartClient` dengan SSR nonaktif. Adapter wajib menormalkan kategori dan nilai numerik agar label `NaN` atau `undefined` tidak pernah tampil. Grafik fitur tidak boleh menyalin konfigurasi theme, tooltip, breakpoint, atau reduced motion secara terpisah. Grafik harus mendukung keputusan pengguna dan selalu memiliki state loading, kosong, serta error pada shell-nya. `DashboardAttentionList` menerima scope organisasi agar item disiplin dapat membuka tab sanksi pegawai yang tepat; chip prioritas ditempatkan bersama judul dan aksi detail memakai ikon mata yang mudah dikenali.

## Branding

- `branding/AppLogo` adalah satu-satunya komponen untuk menampilkan logo SITOU. Gunakan `variant="full"` untuk komposisi ikon dan teks **SITOU** pada navbar, serta `variant="mark"` untuk simbol ringkas.
- Path ikon logo dan warna teks SITOU dipusatkan melalui `branding/AppLogo.jsx` dan token tema agar tampilannya konsisten pada navbar desktop maupun mobile.
- `navbar/SidebarContent` memakai pas foto profil pegawai yang ditautkan ke akun dari data session terbaru, melalui endpoint file privat. Desktop dan drawer mobile memakai komponen yang sama; inisial tetap tampil jika foto belum ada atau gagal dimuat.
- Setelah edit data pegawai atau Profil lengkap berhasil disimpan, `router.refresh()` memuat ulang identitas layout server agar sidebar desktop dan mobile langsung memakai pas foto terbaru (termasuk kembali ke inisial setelah foto dilepas), tanpa reload halaman penuh. Penyimpanan gagal tidak memicu refresh identitas.
- Pas foto sidebar dapat ditekan atau dibuka melalui keyboard untuk menampilkan `ImagePreviewModal` menggunakan endpoint privat yang sama.
- `/public/logo-sitou-v2.png`: logo huruf/simbol ringkas.
- `/public/logo-sitou-v1.png`: logo SITOU beserta tagline.
- SITOU hanya memakai theme light. Merah adalah aksen, bukan warna seluruh permukaan.
- `ACTION_TONES` tersedia melalui `theme.action`. Tombol AntD memakai `data-action-tone="detail|download|database|files|verify|danger"`: detail biru, paket lengkap teal, database biru, file ungu, verifikasi hijau, hapus merah. Styling terpusat mencakup hover, fokus keyboard, dan target sentuh 44px.
- `system-backup/BackupProgressPanel` menerima `job`; ikon mengikuti tahap dan hasil, bergerak hanya saat proses aktif serta menghormati prefers-reduced-motion. Gagal memakai ikon error, siap dengan temuan memakai peringatan, dan siap tanpa temuan memakai centang.
- Token BRAND_COLORS dan STATUS_TONES berada di themeprovider/ThemeProvider.jsx serta tersedia melalui theme.brand dan theme.status. Komponen MUI, AntD, badge, dan halaman fitur harus memakai sumber warna semantik yang sama.
- Gunakan warna brand sebagai aksen yang relevan, bukan warna bawaan seluruh angka atau panel. Ikon dekoratif berlatar warna memakai `icons/AppIconTile` agar bentuk dan intensitas latarnya sama untuk semua tone; pilih `tone` sesuai makna. Pada ringkasan stok awal, ikon Stok awal memakai `info` biru dan ikon Stok saat ini memakai `brand` merah; kedua nilai stok tetap netral. Warna status/aksi lain mengikuti token semantik sesuai artinya.

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

# Modul Cuti & Izin

Form pencatatan membaca saldo dari endpoint ringkasan pegawai sesuai organisasi dan tahun tanggal mulai. Informasi meliputi hak tahunan, pemakaian bersih setelah pembatalan, penyesuaian, sisa saldo, dan perkiraan setelah disimpan. Hak yang belum dicatat mengikuti pengaturan jenis cuti dan baru dibuat dalam transaksi penyimpanan pertama. Saldo belum tersedia, habis, atau tidak mencukupi memblokir Simpan; backend tetap menjadi pemeriksaan final. Filter awal dan Atur ulang menggunakan tahun berjalan pada timezone organisasi.

- Halaman operasional memakai `ResponsiveDataView`, filter server-side, dan state filter di URL.
- `LeaveRequestForm` memakai tombol Simpan dan konfirmasi berisi nama/NIP, jenis, periode, jumlah hari/jam, serta dampak saldo. Validasi gagal memberi notifikasi dan fokus ke field tanpa menghapus isian atau file. Jumlah HRD tetap menjadi dasar pemotongan; perkiraan rentang tanggal memakai hari kalender dan dapat disesuaikan.
- `LeaveDetailModal` menjadi tampilan yang sama untuk HRD, Superadmin, dan Pimpinan read-only.
- Tab pegawai membaca `leave-summary`; saldo berasal dari ledger dan approved record hanya dapat dikoreksi melalui pembatalan beralasan.
- Pencatatan baru menerima satu dokumen pendukung JPEG/PNG/WebP/PDF maksimal 10 MB; total multipart maksimal 11 MB. File dipilih lokal dan baru disimpan bersama pencatatan. Histori lama tetap dapat membuka semua lampirannya. File privat dibatasi organisasi/pegawai dan dibersihkan bila transaksi gagal.

# Laporan pegawai

Semua tabel AntD disusun melalui `data-display/NumberedTable.jsx`, yang menambahkan kolom **No** otomatis. `ResponsiveDataView` memakai wrapper ini dan menampilkan nomor yang sama pada card mobile. Nomor memakai `(page - 1) * pageSize + index + 1`; pagination eksternal/cursor memasok `rowOffset` (jumlah baris sebelum halaman). Tanpa pagination dimulai dari 1. Jangan menambahkan kolom No manual pada menu. Offset laporan dihitung server terhadap filter dan cursor yang sama agar tautan halaman tetap konsisten.

`reports/EmployeeReport.jsx` menyatukan filter URL, daftar desktop/card mobile, ringkasan, navigasi detail, dan ekspor untuk Kontrak Akan Berakhir serta Proyeksi Pensiun. Gunakan komponen ini untuk kedua route, bukan membuat salinan form filter.

`ResponsiveDataView` menerima `pagination={false}` untuk daftar dengan kontrol keyset server sendiri. Semua tabel/daftar berpaginasi memakai `DataPagination` pada desktop dan mobile: `pagination` untuk halaman bernomor, `cursor` untuk keyset, `total` sebagai jumlah seluruh hasil filter, serta `pageSize`/`onPageSizeChange` bila API mendukung 10/20/50 baris. Daftar dengan ukuran halaman tetap memakai `pageSizeOptions={[]}`. Jangan memakai footer AntD tersendiri. `DashboardMetric` menerima `metric.description` sebagai penjelasan indikator, tidak dapat diklik, dan memakai hover seragam dengan dukungan reduced motion. Dashboard tidak memiliki filter tanggal global; tren memakai 12 bulan kalender hingga hari ini. `DashboardAttentionList` juga menerima `title`, `description`, `emptyMessage`, dan `showPriority` untuk daftar lima kasus resmi terbaru. Tombol detail pada daftar tetap dapat digunakan.

# Pengaturan organisasi

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

# Pas foto sidebar Pegawai

Sidebar desktop dan mobile membaca pas foto Pegawai melalui `/api/uploads/profile_self`
dengan permission `profile_self.read`. Target selalu dipetakan dari session dan
referensi pas foto aktif pada profil akun sendiri. Parameter `photoVersion` hanya
memicu pemuatan ulang setelah foto diganti, bukan memilih file. Endpoint file umum
tetap memerlukan `private_files.read_sensitive`; Pegawai tidak memperoleh akses
ke foto atau dokumen pegawai lain. Preview tetap diaudit dan tidak di-cache.

`useBrowserTimeZone` mendeteksi zona perangkat dengan hydration aman dan fallback UTC. Backup memakai hook ini untuk tampilan waktu lokal, sedangkan nama artefak tetap mengikuti snapshot zona waktu pekerjaan.

## Fondasi Inventaris dan akses fitur

Istilah produk memakai Fitur organisasi, Fitur Inventaris, Akses fitur, serta
Fitur dan izin. Label nama fitur/izin terpusat pada `lib/access/featureLabels.mjs`;
kode dan kontrak API paket tetap dipertahankan. Form akses menjelaskan lokasi
pembuatan gudang dan daftar organisasi menampilkan Fitur aktif dari server.

- `navigation/DetailTabs` menerima `embedded` (default false) untuk tab pada halaman dengan DataPanel agar tidak membentuk panel bertumpuk. Kontrak lama tetap berlaku.
- `useFormModalClose(form, onClose, isDirty?)` menerima pembanding dirty opsional; default tetap isFieldsTouched untuk pemakai lama. Form akses/gudang/modul membedakan inisialisasi server dari perubahan pengguna.
- `access/PackageAccessFields` menyusun Form.List, paket dan scope gudang dari reference-options server; props form/options/existing. Field disimpan bersama form akun, bukan mutation terpisah.
- `access/OrganizationModulesModal` menyusun AppModal/FormSettingSwitch/ConfirmDialog untuk aktivasi modul organisasi oleh Superadmin.
- `inventory/InventoryWorkspace` menyusun scope organisasi URL dan panel master terpisah. `WarehousePanel` menyusun DataPanel/ResponsiveDataView; `WarehouseForm` menyusun AppModal/ConfirmDialog. Tidak ada shell, tabel, badge, atau dropzone baru.
- Resolver menu menerima snapshot permission tambahan; sidebar desktop/mobile memakai konfigurasi yang sama. Snapshot dari `/api/access/me` hanya untuk UI; page/API tetap memeriksa authorization server.
- RowActionMenu menutup popup ketika aksi dipilih sebelum modal dibuka, agar menu lama tidak menutupi form. DetailTabs embedded memakai dua kolom pada mobile dan susunan horizontal pada layar lebih besar.

`inventory/CatalogPanel` menyusun OperationalFilterSection dan InventoryItemGallery
untuk Barang Persediaan; Kategori dan Satuan tetap memakai DataPanel/ResponsiveDataView.
Katalog barang sengaja menampilkan grid kartu langsung tanpa bingkai DataPanel atau
paginasi visual: `useDataList` mode infinite memuat halaman berikutnya lewat
IntersectionObserver dengan tombol manual sebagai cadangan. Mode standar hook dan
DataPanel pada daftar operasional lain tidak berubah.
Kartu barang menampilkan foto atau ikon tanpa foto, identitas, status, kategori,
satuan, dan batas minimum per gudang yang berizin, bukan saldo stok. Dua gudang
pertama tampak langsung dan sisanya dapat dibuka di AppModal. Filter nama/status,
lokasi, gudang, barang belum didaftarkan, serta rentang batas minimum diproses server
sebelum pengambilan halaman. Pilihan gudang menampilkan nama gudang saja karena lokasi
punya filter terpisah. Tombol pensil kartu membuka menu edit/atur gudang yang tetap
memeriksa izin. AppModal tetap dipakai untuk edit dan pengaturan minimum per gudang.
Penjelasan ambang stok dan dampak status barang-gudang memakai AppNotice.
Foto memakai PrivateFileUpload deferred dan ImagePreviewModal; byte disimpan
bersama transaksi form, bukan saat dipilih. InventoryWorkspace menampilkan master terpisah pada Data Master; setiap panel memiliki
header dan filter organisasi sendiri.

### Master Inventaris dan prasyarat

- CatalogPanel / WarehousePanel menyediakan PageHeader dengan aksi tambah berizin,
  DataPanel, serta organizationFilter pada toolbar. organizationId wajib sebelum
  request; remount per organisasi membersihkan daftar/options/form. Tidak memakai tab.
- PrerequisiteHint menerima text, href, onNavigate, linkLabel. Arahan ditampilkan
  melalui AppNotice warning dengan teks justify dan tautan hanya ketika berizin. Pemilik form memakai
  usePrerequisiteNavigation untuk dirty-state confirmation sebelum route berubah.
- Barang/Kategori/Satuan/Gudang berada di Data Master; Distribusi Barang di Laporan.

PackageAccessFields menerima optionsReady agar arahan gudang kosong/nonaktif tidak
ditampilkan sebelum reference-options berhasil dimuat. OrganizationAccountForm
menyediakan navigasi prasyarat dengan penjagaan isian.

### Satuan tanpa kode input dan chip master persediaan

Satuan Barang tidak meminta atau menampilkan kode. API menerima kode opsional untuk
kompatibilitas klien lama; create tanpa kode membuat kode internal UUID di server,
edit tanpa kode mempertahankan nilai lama. Tidak ada perubahan schema atau backfill.
Nama satuan wajib dan unik per organisasi; konflik ditampilkan pada field nama.
Kode barang/kategori/gudang tampil sebagai CompactInfoChip tone info di bawah nama
pada kolom identitas yang sama dan pada kartu mobile. Kategori, satuan, aturan
pecahan, dan status memakai chip semantik yang sudah tersedia; nama dan uraian
bebas tetap teks agar penanda penting tidak tenggelam dalam terlalu banyak chip.

Tingkat akses Inventaris: PackageAccessFields menampilkan accessFeatureDescription
tepat di bawah pemilih fitur serta batas scope gudang. Lihat Saja tidak mempunyai
submenu master; Pengelola all/selected mempunyai aksi katalog. canManageCatalog
berasal dari permission backend, bukan role atau mode all pada browser.

Spacing bantuan field diatur AppThemeProvider untuk `.ant-form-item-extra`:
8px atas, line-height 1.6, 4px bawah; extra kosong tidak menambah ruang.
PrerequisiteHint memakai gap 8px dan line-height 1.6 dengan tautan target 44px.
Tidak perlu margin tambahan pada pemanggil agar spacing tidak berlipat.

## Pemisahan master dan operasional — migration 050

- Lihat Saja (inventory_reader): baca Stok Barang/Transaksi Barang/Distribusi Barang, scope gudang all/selected; tidak membuka atau mengubah master.
- Pengelola Gudang (inventory_manager): izin operasional gudang serta minimum barang-gudang dalam scope all/selected. Tidak CRUD katalog/metadata gudang, termasuk scope all. Transaksi stok/ledger belum diimplementasikan; permission transaksi mutasi ditambahkan bersama fitur berikutnya.
- Pengelola Master Inventaris (inventory_master): baca/tambah/edit/nonaktifkan Barang/Kategori/Satuan/Gudang, termasuk membuat gudang. Cakupan organisasi, disimpan scope_mode=all dan warehouseIds kosong. Tidak memberi akses operasional stok/transaksi/laporan/minimum; bukan seluruh gudang operasional.

Satu akun dapat menerima tiga pilihan tersebut secara independen. Form master
menampilkan Cakupan akses organisasi tanpa pemilih gudang; pergantian kembali ke
akses operasional mereset scope selected dan gudang kosong. Izin master hanya
didelegasikan Superadmin/HRD seluruh lokasi; HRD selected tidak boleh mengubahnya.
Master tidak mengunci lokasi gudang tanpa referensi operasional. Semua permission
masih dipasangkan dengan scope grant asalnya, memakai module/membership aktif,
version check, transaksi dan audit. Data organisasi lain serta permission HRIS
atau self-service tidak diberikan.

Akun Pengelola lama tetap operasional dengan scope semula, tidak otomatis mendapat
master. Migration 050 mengubah mapping permission, menambah katalog akses dan
CHECK scope master; grant/histori dipertahankan. Schema bootstrap memuat perubahan.
Berikan master secara eksplisit bila diperlukan. Keputusan ini menggantikan izin
master bagi inventory_manager pada tahap 049.

CatalogPanel Kategori menampilkan field notes sebagai Catatan pada tabel desktop
(dash jika kosong) dan section Catatan pada kartu mobile hanya jika berisi.
Form kategori memakai label Catatan (opsional), kontrak API notes tetap sama.
Teks catatan dibungkus aman dan justify dengan line-height 1.6.

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

### Metadata dan preview upload Inventaris

`FileUploadField` membuat ulang pemilih file native setelah penghapusan berhasil agar file yang sama dapat dipilih kembali. Callback hapus yang mengembalikan `false` mempertahankan pilihan dan input; kegagalan hapus tidak dianggap berhasil.

`FileUploadField` membaca metadata melalui `lib/ui/uploadMetadata.mjs`. File lokal,
DTO Kepegawaian (`mime_type`, `size_bytes`), dan DTO Inventaris (`mimeType`,
`sizeBytes`) memakai preview gambar yang sama. Endpoint lampiran transaksi
mengembalikan MIME dan ukuran pada upload maupun pembukaan kembali draft.
Gambar memakai `ImagePreviewModal`; PDF memakai aksi buka privat, bukan preview gambar.
Validasi MIME byte, scanning, dan authorization tetap dilakukan server.

### Stok Barang

StockPanel memakai OperationalFilterSection, DataPanel, ResponsiveDataView,
DataPagination cursor, CompactInfoChip, AppModal, dan ConfirmDialog. Kartu Stok
berada pada modal detail barang–gudang; pengaturan minimum memakai use case lama.
InventoryItemPhoto merupakan thumbnail privat untuk stok serta wizard transaksi,
dengan aksi keyboard/touch untuk ImagePreviewModal. Input jumlah wizard terkunci
sebelum barang dipilih; preview foto tidak mengubah data form.

InventoryQuantityChip membungkus CompactInfoChip untuk jumlah/stok operasional
dengan font 13px, label tebal, tinggi fleksibel dan wrap; angka tidak terpotong
ellipsis. TransactionWizard mengambil perkiraan stok dari endpoint preview pada
tahap Periksa dan saat memulihkan draft. Detail transaksi menggunakan thumbnail
InventoryItemPhoto serta menempatkan dokumen sebelum gambar lampiran.

TransactionSourceDetailModal menampilkan penyaluran terpilih, foto, jumlah asal,
sudah kembali dan sisa melalui AppModal/ImagePreviewModal. Wizard Pengembalian
memakai daftar barang tetap dari return-options; InputNumber hanya mengubah
jumlah dan tidak memilih produk baru. ReturnPolicy memisahkan baris draft (semua)
dari payload transaksi resmi (jumlah positif). Tanggal default berasal dari
options.today; bantuan menjelaskan tanggal penerimaan fisik, bukan tanggal sumber.

## OpeningCorrectionModal dan ikon stok

Lihat `docs/inventory-opening-corrections.md` untuk aturan eligibility, permission koreksi, kontrak API, proyeksi replay bersama, dan rollout legacy. `OpeningCorrectionModal` memakai AppModal, ConfirmDialog, AppNotice dan InventoryQuantityChip; koreksi dari draft hanya menyiapkan perubahan sampai Simpan transaksi. AppIcon mendaftarkan inventory:stock-card, inventory:minimum, inventory:opening-correction.

### RelatedRecordAction

`actions/RelatedRecordAction` menampilkan konteks record terkait dan tombol detail sekunder yang terlihat jelas. Gunakan title/description singkat, label tindakan lengkap, warna info dari tema, AppIcon semantik, target minimal 44px, serta loading/disabled. Pada wizard Pengembalian, letakkan di samping pemilih penyaluran pada desktop dan setelah pemilih pada mobile. Membuka detail tidak mengubah isian maupun dirty-state.

### Modal transaksi dan laporan bersama

Lihat docs/inventory-distribution.md. Distribusi memakai transaksi/line/reversal existing, tanpa migration atau perubahan saldo. DistributionPanel menggunakan DataPanel, ResponsiveDataView, DataPagination, OperationalFilterSection, DashboardMetric, chip, modal dan preview terpusat. TransactionDetailModal/TransactionPresentationParts dipakai bersama dengan Transaksi Barang; onCancel hanya diberikan workspace transaksi berizin, bukan laporan.

TableExportMenu menerima `formats` opsional (default Excel/PDF). Distribusi memilih `["excel"]` sehingga UI hanya menawarkan format yang sudah tersedia. Perhitungan kartu laporan menggunakan DashboardMetric bersama; error tidak dirender sebagai nilai nol.

Ringkasan transaksi: satu InventoryItemCard rata kiri, beberapa kartu mengikuti grid responsif. Jumlah masuk/keluar/kembali berada dalam kelompok Perubahan stok gudang; jumlah perubahan memakai info/warning, hasil stok memakai statusnya. Stok awal dan seluruh label Inventaris memakai istilah stok, bukan saldo.

`data-display/ActorIdentity` memakai `PhotoAvatar` dan `ImagePreviewModal` untuk nama pelaku serta pas foto dengan target 44px/keyboard. Metadata Inventaris memakai nama pertama–terakhir dari profil tertaut, fallback username; tidak berasal dari akun pembaca. URL avatar tetap `/api/uploads/:fileId`, terikat transaksi/pelaku/konteks baca dan scope gudang terbaru; tidak membuka izin profil HRIS. Ekspor menggunakan nama ringkas yang sama.

Jabatan di bawah nama pelaku Inventaris berasal dari penempatan utama yang berlaku hari ini menurut timezone organisasi. `ActorIdentity` menerima `position` opsional; profil tanpa jabatan tidak menampilkan keterangan pengganti. Riwayat transaksi menempatkan Disimpan oleh sebelum Status.

### Workspace Dashboard

`dashboard/DashboardWorkspace` memakai `DetailTabs` embedded hanya jika Inventaris berizin. `EmployeeDashboard` memakai ringkasan self-service, PhotoAvatar dan ImagePreviewModal; `InventoryDashboard` memakai DashboardMetric, DashboardChart, StackedBarChart/HorizontalBarChart, ResponsiveDataView dan InventoryItemPhoto. Section data terpisah per permission/scope, status loading/kosong/error dan retry memakai helper API bersama. Jarak section 24px, kontrol 44px. Grafik bukan data contoh dan tidak menjumlahkan satuan barang berbeda.

Dashboard Pegawai dan Inventaris: tab setelah header, tanpa Draft saya/Akses cepat. Aktivitas transaksi memakai area penuh dengan filter tahun, bulan, minggu; ringkasan tetap bulan ini. Warna jenis konsisten dengan riwayat.

Dashboard Inventaris: tab memakai garis bawah. Stok menipis/habis memakai kartu produk horizontal yang dapat digeser dengan keyboard/sentuhan; transaksi bulanan berupa daftar jenis dan jumlah di atas kartu ringkasan. Tooltip aktivitas memakai tanggal lengkap, sumbu area menyisakan ruang puncak dan ujung label.

DataPanel menerima action opsional di kanan judul. Aksi lihat semua stok memakai ikon action:view-all, tooltip, aria-label, dan target 44px; filter gudang dan organisasi tetap dibawa.

Catatan pemeliharaan: runner pengujian otomatis dan folder tests dihapus atas keputusan proyek. Uraian pengujian di atas menjadi acuan pemeriksaan; perintah pengujian lama tidak tersedia. Gunakan lint, build, dan smoke test di lingkungan terpisah untuk perubahan berikutnya.

DonutChart mendukung type=pie dan unit untuk komposisi jumlah pencatatan, tanpa label pegawai yang keliru. Statistik sanksi memakai HorizontalBarChart integer/scrollable. Kartu Stok membuka TransactionDetailModal berizin di tempat tanpa navigasi dan tanpa aksi pembatalan.

CategoryPieSummary menampilkan pie bersama total dan daftar jenis/jumlah termasuk nol, memakai warna tema yang sama. ContractEndingSummary menyajikan Rekap Akhir Kontrak berupa daftar bulanan berlabel status dan total. Keduanya memakai region scroll berkeyboard dan menyembunyikan scrollbar lokal.

Cuti & Izin memakai donat dengan total pencatatan di tengah dan daftar jenis/jumlah. DonutChart memakai lubang 72%, angka total 30px tebal, label netral 12px, serta total tetap saat hover. Jenis kelamin memakai biru info dan merah brand palette.primary.main; kategori cuti memakai merah brand sebagai warna pertama disertai warna tema lainnya.

Daftar CategoryPieSummary dibatasi lebar 288px dan tinggi scroll 240px; label 12px, jumlah 14px dengan angka tabular, padding kanan aman, nama panjang membungkus. Lebih dari lima jenis menampilkan petunjuk gulir; fokus keyboard dan scroll sentuhan tetap tersedia.

Label pengguna pada donat Cuti & Izin memakai Total cuti & izin dan satuan tooltip cuti/izin. Jumlah tetap menghitung pengajuan/catatan approved per jenis, bukan hari atau pegawai unik.

Jadwal Kontrak Berakhir menggantikan rekap histori kontrak: jumlah kontrak aktif yang telah mulai, pegawai aktif/probation/suspended, bertanggal akhir mulai hari ini menurut timezone organisasi sampai akhir bulan kalender ke-12. Query dashboard dan laporan memakai buildReportQuery yang sama dengan contractStatus=active; kontrak draft, dibatalkan, berakhir, diperpanjang, tanpa tanggal akhir, serta pegawai final tidak dihitung. Setiap bulan menampilkan jumlah kontrak akan berakhir. Lihat pegawai hanya tersedia bagi akun berizin laporan Kontrak Akan Berakhir, mempertahankan organisasi dan rentang bulan. Tidak memakai label Aktif/Selesai atau diperpanjang pada panel jadwal.

Jadwal Kontrak Berakhir memakai ikon kalender per bulan (netral jika kosong, info jika ada kontrak), jumlah yang menonjol, serta aksi mata 44px dengan tooltip/aria-label. Bulan tanpa kontrak tidak memiliki aksi kosong; daftar tetap dapat digulir dan diakses keyboard.

Jadwal Kontrak Berakhir memakai kalender brand merah untuk bulan dengan data. Ikon mata membuka ContractEmployeesModal di dashboard, memakai API laporan yang sama dan filter bulan/organisasi/status aktif. Modal memakai AppModal, ResponsiveDataView, DataPagination cursor, ReportIdentity/ReportRemaining, dan ImagePreviewModal untuk pas foto. Pemeriksaan izin laporan tetap di backend; menutup modal mempertahankan halaman serta posisi dashboard.

LeaveBalanceFields memakai CompactInfoChip dan kondisi bersama leavePresentation.mjs. LeaveSummaryDetailsModal menampilkan identitas, ringkasan angka dan saldo, serta daftar kartu kejadian lima data per halaman memakai DataPagination keyset. Informasi privat tetap mengikuti izin laporan; loading, kosong, dan error memakai komponen bersama.

Navigasi sidebar memakai useTransition agar loading selesai juga ketika redirect kembali ke pathname yang sama. href pemulihan hanya dikirim setelah guard isian menyetujui navigasi; tujuan wajib satu origin dan seluruh otorisasi server tetap berlaku. Token upload/simpan tidak dilepas oleh pemulihan navigasi.

InventoryStockMetric menyatukan ukuran tile 36px, ikon 18px, label 11.5px dan nilai 13.5px pada ringkasan stok wizard. Tidak ada varian prominent. Jumlah mengikuti tone jenis transaksi, Sebelum netral, Sesudah info (nol memakai danger). Divider bersama memisahkan jumlah dari Sebelum/Sesudah; panel memakai padding dan gap 16px.

HorizontalCarousel adalah daftar horizontal reusable dengan autoplay kondisional overflow, loop ke kiri, kontrol manual, jeda interaksi/visibilitas, dan reduced motion. Mobile <600px menampilkan satu kartu penuh dengan scroll snap; desktop mempertahankan lebar kartu 240px. Tanpa tombol jeda/jalankan; interaksi manual menunda autoplay 9 detik, hover/fokus dan reduced motion tetap dihormati. Props: items, getKey, renderItem(item,{isClone}), label, paused. Semua elemen interaktif pada salinan visual wajib memakai tabIndex=-1. StockAttentionCard memakai InventoryItemPhoto (tabIndex opsional), CompactInfoChip, FontStyle dan token tema untuk panel Stok perlu diisi kembali.

chartAdapter: fill grafik area memakai gradasi vertikal dari lighten(warna seri,0.76) ke lighten(warna seri,0.97) dengan opacity 1. Warna muda dibentuk sebelum dirender agar hue seri tetap terbaca saat bertumpuk; bukan lapisan alpha yang saling mencampur warna. Grafik non-area tetap memakai fill semula.

StockAttentionCard: chip Stok segera habis/Stok habis, border atas, label/angka Stok tersedia dan permukaan stok memakai token brand SITOU. Kondisi tetap dihitung server; label segera habis hanya penyebutan stok di bawah minimum, tanpa prediksi.

RecentInventoryTransactions memakai KindMark (tone override opsional), CompactInfoChip, ActorIdentity dan FontStyle untuk kartu Transaksi terbaru. Props: transactions, organizationId. Memuat label metadata yang jelas, status pembatalan, aksen/shadow tema, tautan detail, layout 1/2/4 bagian responsif, serta reduced motion. Ringkasan menerima DTO berizin. Aksi detail memakai API transaksi privat yang sudah tersedia serta TransactionDetailModal tanpa mutasi, dengan LoadingBackdropProvider/Notification dan pembatalan request saat unmount. Tombol ikon saja pada desktop/tablet, ikon+teks pada mobile; URL dan posisi halaman tetap.

### Ruang kerja Pegawai dan navigasi akun

EmployeeDashboard memakai DataPanel, AppIconTile, PhotoAvatar, LeaveBalanceFields, CompactInfoChip, dan AppModal untuk ringkasan pribadi berizin. Tidak memakai data contoh atau memberi hak administrasi. Akses cepat memfokuskan section yang dituju dan menghormati reduced motion.

SubscriptionAccessCard({ user, onRenew }) menampilkan masa akses organisasi dari tanggal/status/sisa hari server. SidebarContent, LeftNavBar dan MobileLeftNavBar menerima onRenew dari ProtectedShell; notifikasi Coming soon menggunakan Notification bersama. TopMenu mengganti ikon pengaturan dengan avatar dan nama ringkas actorDisplayName; menu tetap Profil/Keluar. Sidebar menampilkan organisasi dan location_name dari penempatan utama milik akun.

DashboardMetric adalah kartu angka bersama Dashboard HRD, Pegawai dan Inventaris. `metric.unit` menampilkan satuan kecil, `metric.parts` menampilkan beberapa angka/satuan (masa kerja), dan `metric.progress` opsional untuk pemakaian. AppIconTile memusatkan ikon kartu. EmployeeLeavePanel memakai DataPanel, CompactInfoChip, AppModal dan LeaveDetailModal bersama; LeaveDetailModal menerima `balance`/`balanceYear` opsional tanpa mengubah pemakai operasional.

EmployeeDisciplinePanel menyajikan tindakan resmi pribadi di bawah daftar cuti, memakai DataPanel/AppIconTile/CompactInfoChip dan DisciplineCaseDetailModal bersama. DashboardMetric mendukung pasangan tahun/bulan/hari dengan jarak dan wrapping. action:chevron-right di AppIcon dipakai untuk navigasi baris tanpa batang panah.

EmployeeBalanceMetric mengisi DashboardMetric melalui slot selection dan metric.valueText, dengan AsyncSelect dan pilihan bersaldo per akun/organisasi. DisciplineHistoryList menyajikan baris sanksi pribadi; jumlah sanksi aktif memakai description DataPanel di bawah judul. EmployeeDisciplinePanel mengelola keyset DataPagination, loading/error/cancel serta transisi ke DisciplineCaseDetailModal tanpa modal bertumpuk.

EmployeeProfileBanner berada di DashboardWorkspace di atas tab dan dipakai pada Dashboard serta Inventaris untuk semua role. Akun tanpa tautan pegawai memakai identitas akun tanpa NIP/status buatan; Dashboard tidak memakai PageHeader terpisah. EmployeeDashboard menerima dashboardState dari workspace. Keterangan DashboardMetric berada di bawah kecuali kartu berindikator progress. SidebarContent memakai satu scroll container yang tetap dapat digulir dengan scrollbar tersembunyi dan SubscriptionAccessCard ringkas. EmployeeDisciplinePanel menampilkan daftar terbaru tanpa tombol/modal Riwayat; detail kasus tetap memakai modal bersama.

SidebarContent membagi submenu campuran menjadi kelompok Kepegawaian, Inventaris, dan Platform melalui `navbar/sidebarGroups.mjs`, berdasarkan `sidebarGroup` bila tersedia, atau `access.kind` sebagai fallback, pada menu yang sudah disaring oleh `getMenusByRole`. Pemisah hanya tampil jika lebih dari satu kelompok terlihat, dengan urutan kelompok mengikuti kemunculan pertama dan urutan item di dalamnya tetap, tanpa collapse tambahan. Metadata `access` diteruskan oleh MenuConfig dari katalog bersama; jangan menyimpulkan kelompok dari teks label atau URL. Desktop/drawer mobile berbagi susunan, submenu minimal 44px, label panjang membungkus, dan `aria-expanded`/`aria-current` menandai keadaan navigasi.

Untuk menambahkan fitur baru, daftarkan menu/izin dan `access.kind` pada `lib/access/menuCatalog.mjs`, lalu tambahkan nama kelompok pada pemetaan `navbar/sidebarGroups.mjs`. Renderer bersama menangani pemisah tanpa percabangan fitur baru di SidebarContent. Label Lainnya hanya fallback, bukan identitas final fitur. Perhitungan dilakukan per induk setelah penyaringan izin: satu kelompok tanpa pemisah, beberapa kelompok memakai pemisah, kelompok kosong hilang. Uji gabungan fitur lama–baru, satu fitur saja, akses terbatas dan pencabutan izin pada desktop/mobile serta layar pendek; banyak permission dalam satu fitur tetap satu kelompok.

Badge profil pegawai yang tertaut memakai status dan jenis kepegawaian, bukan role akun. EmployeeBalanceMetric memakai saldo ledger bila hak tahunan sudah terbentuk; sebelum itu kartu menampilkan jatah positif dari aturan sebagai informasi awal, bukan saldo resmi. Pemilih jenis menempati lebar kartu di atas angka, dan angka DashboardMetric lebih kecil pada layar sempit.

DashboardMetric menerima balanced untuk susunan header → angka tengah → footer berdivider pada Masa kerja/Sanksi aktif. MetricValue menjaga format angka/satuan konsisten dengan susunan standar.

Rekap Stok memakai StockReportPanel, AppModal, ResponsiveDataView, DataPagination dan TableExportMenu bersama. Rincian membaca proyeksi Kartu Stok dengan permission laporan; dokumen memerlukan izin transaksi tersendiri. Tidak menambahkan perhitungan atau saldo client. Lihat docs/inventory-stock-report.md.

### Pemilih rentang tanggal responsif

Gunakan `forms/ResponsiveRangePicker` untuk seluruh rentang tanggal. Desktop (mulai 768px) memakai AntD RangePicker; mobile memakai AppModal dengan satu kalender, ringkasan rentang satu baris, navigasi bulan/tahun tanpa kotak tambahan, dan hanya tombol Terapkan selebar modal. Ketukan pertama memulai rentang baru, ketukan kedua melengkapinya; urutan terbalik diurutkan otomatis, ketukan berikutnya memulai ulang. Nilai form/filter hanya berubah saat Terapkan atau ikon kosongkan pada field asal; Escape/ikon tutup/backdrop mempertahankan nilai awal. Tidak ada tombol Hapus/Batal, kotak tanggal mulai/akhir, atau instruksi visual berulang dalam modal. Instruksi pemilihan tetap tersedia bagi pembaca layar. Tombol preset mobile tersusun rata tengah dengan jarak konsisten; setiap baris tetap rata tengah saat membungkus pada layar sempit. Preset tetap tersedia, `allowClear={false}` menyembunyikan ikon kosongkan, dan batas tanggal serta status validasi mengikuti pemanggil. Kosongkan tetap memanggil `onChange(null)` agar reset periode mengikuti aturan fitur masing-masing. Tidak mengubah perhitungan, timezone, atau validasi server. Uji 320px, layar pendek, lintas bulan/tahun, satu hari, urutan terbalik, pembatalan, keyboard, dan Form.Item di dalam modal. Pemakaian di dalam Form.Item wajib menambahkan `formField` agar status error mengikuti validasi form tanpa peringatan pada filter biasa.

### Kartu laporan Inventaris

`InventoryReportCardContent` menyusun isi kartu Distribusi Barang dan Rekap Stok di dalam `ResponsiveDataView`, tanpa membuat bingkai kartu kedua. Identitas barang memakai foto privat bersama; status berukuran sesuai isi, metadata memakai pasangan label/nilai semantik, penerima/pencatat tetap memakai identitas berizin. Kelompok kuantitas memakai angka bersatuan rata kanan dan penekanan pada hasil akhir, tanpa chip bertumpuk. Jarak section 24px, fakta berbeda 16px, dan aksi mobile dipisahkan garis lalu tombol teks selebar kartu minimal 44px. Desktop tetap tabel dengan aksi ikon. `DataPanel` memakai jarak judul–deskripsi 8px pada desktop; aksi menempati dua baris header agar tingginya tidak menambah ruang kosong sebelum deskripsi. Pada mobile aksi mengambang di kanan agar teks mengalir di samping lalu di bawahnya, tanpa tinggi tombol menambah jarak judul–deskripsi; jarak tetap 8px. Deskripsi header laporan Inventaris memakai teks ringkas dari label/policy bersama; penjelasan perhitungan lengkap tetap tersedia pada Excel.

### Typography data mobile

`data-display/mobileDataTypography.mjs` dipakai DataPanel, ResponsiveDataView, ModernTableFrame, dan DataPagination pada lebar di bawah 768px. Teks data mobile minimal 14px; FontStyle menambah 2px pada ukuran dasar dengan batas minimum tersebut sehingga nama dan angka utama tetap lebih besar (misalnya 14 menjadi 16px). Metadata, status, nomor baris, dan pagination ikut terbaca. FontStyle membaca variabel CSS area data; font desktop dan area lain tidak berubah. Typography lama dan sel tabel AntD mendapat minimum 14px melalui selector terpusat. Jangan mengecilkan font per fitur atau memotong isi untuk menghindari scroll; angka/nama panjang tetap membungkus.

### Keterbacaan filter dan form mobile

Pada lebar di bawah 768px, ThemeProvider menetapkan minimum FontStyle 14px untuk label/metadata/teks bantuan di luar area tabel juga. Pengaturan area data tetap dipertahankan. Kontrol input, angka, tanggal, pemilih rentang, pilihan Select dan dropdown portal memakai 16px; label Form dan pesan bantuan/error memakai 14px. Opsi dropdown dan tombol memiliki target minimal 44px. OperationalFilterSection memakai jarak antar-field 16px dan label-kontrol 8px. Ukuran desktop tetap mengikuti nilai asal. Saat mengubah kontrol, verifikasi placeholder, opsi panjang, pesan error, keyboard, navigasi akun, dan overflow pada 320–1920px.

### Kartu master Inventaris mobile

InventoryMasterCardContent digunakan Kategori Barang, Satuan Barang dan Gudang di dalam ResponsiveDataView. Identitas memakai ikon semantik AppIconTile, nama dan chip kode. Status mengikuti ukuran isi; catatan/lokasi/aturan jumlah berlabel. Aksi edit langsung berupa tombol teks selebar kartu di footer, dengan label aksesibel yang menyebut nama data. Tidak membuat bingkai/nomor kedua atau menu tambahan untuk satu aksi. Izin options.canManageCatalog/row.canEdit tetap berlaku.

### Susunan kartu mobile Inventaris bersama

InventoryMobileCardContent menyatukan identitas, status, fakta berlabel, area jumlah berlatar lembut, pelaku dan footer aksi. InventoryReportCardContent menjadi alias kompatibel sehingga laporan dan operasional memakai susunan sama. InventoryCardAction memakai Button bersama, label teks, target minimal 44px dan lebar penuh. Tidak ada pengurangan ukuran font atau pemotongan nama/angka.

Stok Barang menampilkan foto, kondisi, gudang, batas minimum dan stok tersedia tanpa mencampurkan nilai tersebut. Tombol kartu stok/minimum/koreksi mengikuti izin lama. InventoryTransactionCardContent memperlihatkan jenis berikon, status, tanggal/gudang/referensi, maksimal dua barang dengan jumlah serta perubahan masing-masing; jumlah barang tambahan disebut jelas dan detail tetap membuka seluruh dokumen. Tidak menjumlahkan satuan atau menafsirkan stok fisik dari jumlah transaksi. Pembatalan tetap menampilkan angka asal dengan keterangan. Desktop menggunakan tabel/ledger yang sama.

Rentang pada Transaksi Barang dan modal Kartu Stok memakai ResponsiveRangePicker bersama, tanpa mengubah aturan tanggal atau server. Pagination Kartu Stok memakai slot tetap AppModal dan jumlah tampil aktual. Pola dan referensi: docs/inventory-mobile-ui.md.

InventoryCardIdentity dipakai master dan kartu Transaksi Barang untuk menyelaraskan ikon 48px/glyph 24px dengan blok nama/metadata. Chip status berada tepat di bawah nama; bila ada kode, kode/status sebaris dan wrap. InventoryCardAction menerima ikon semantik atau React icon; aksi edit master memakai EditOutlined outline. Ukuran default KindMark di pemakai lain tetap 28/40px.

Pada InventoryItemCard, kolom aksi merentang baris nama dan metadata agar tinggi tombol edit tidak menambah jarak di bawah nama. Kode dan status tersusun rapat pada kolom nama; pembungkus metadata memakai alignItems flex-start agar chip status mengikuti isi, bukan melebar memenuhi kolom. Foto, atribut dan batas minimum tetap memakai komponen yang sama.

Foto StockAttentionCard memenuhi lebar area gambar dengan tinggi 184px pada mobile dan 160px mulai 600px. InventoryItemPhoto mendukung height opsional (default mengikuti size); objectFit contain mempertahankan proporsi dan seluruh gambar, tanpa stretch atau crop. StockAttentionCard memakai frameless agar foto yang tersedia tidak memiliki latar atau bingkai abu-abu; placeholder tetap terlihat ketika foto tidak tersedia/gagal dimuat. Thumbnail pemakai lain tetap persegi dan memakai bingkai default.

DisciplinaryReport memisahkan status dan angka ringkasan pada kolom masing-masing; DisciplinaryHistoryModal memakai AppModal/DataPagination, lima tindakan per halaman dan accordion satu rincian. Modal menampilkan seluruh histori resmi tanpa filter laporan, status semua tindakan, retry dan pembatalan request. Kontrak backend/Excel tetap. Rincian desain: docs/disciplinary-report-ui.md.

Laporan sanksi menampilkan Lokasi/Divisi & Unit/Jabatan pada kolom masing-masing dan satu hitungan Total sanksi (seluruh tindakan resmi). Hitungan hasil filter dan aktif/banding dihapus dari tampilan/Excel. Modal memakai grid dua kolom desktop untuk fakta termasuk uraian/penjelasan; divider bawah hanya untuk eskalasi/pencabutan. Tone status mengikuti ACTION_STATUS bersama pada semua pemakai, bukan override khusus laporan.

DisciplinaryActionForm membaca konteks pilihan dari kasus berizin; disabled_reason mencegah pilihan jenis aktif yang sama/tahap lebih rendah. ConfirmDialog menampilkan keputusan berjalan dan pengganti saat publikasi; form disembunyikan sementara, isian/file tetap di state. Konfirmasi mengirim replacementActionIds untuk pemeriksaan ulang transaksi. Tanggal organisasi berasal dari server. Lihat docs/disciplinary-issuance.md.

Konfirmasi penggantian sanksi menampilkan dua blok seragam berlabel Sanksi lama/Sanksi baru, masing-masing nama dan masa berlaku. ConfirmDialog menerima description opsional dengan default lama agar konteks konfirmasi dapat dijelaskan tanpa mengubah pemakai lain.

AppModal mendukung descriptionAlign (default justify); ConfirmDialog mengikuti messageAlign untuk deskripsi header. Konfirmasi sanksi memakai rata kiri agar jarak antarkata tidak melebar pada mobile.

### Konfirmasi pemulihan sanksi dan hapus kasus

DisciplinaryActionRevokeForm memakai ConfirmDialog dan ReplacementSanctionCard dengan label Akan dicabut / Berlaku kembali. Form alasan ditutup sementara; batal mempertahankan isian. EmployeeDetail menyediakan Hapus kasus hanya tanpa tindakan termasuk draft, dengan konfirmasi dan pemeriksaan server. Lihat docs/disciplinary-restoration.md.

Kandidat pemulihan berasal dari penelusuran rantai di server; modal menampilkan
satu pendahulu terdekat yang masih berlaku beserta tanggal aslinya. Daftar kasus
EmployeeDetail mengikuti urutan waktu pencatatan dari API, tanpa pengurutan ulang
berdasarkan tanggal kejadian di client. Riwayat sanksi tetap tanggal terbit terbaru.

## Jadwal kerja

- work-schedules/TemplatePage.jsx mengelola daftar melalui dropdown Jenis jam kerja pada OperationalFilterSection dengan deskripsi singkat, opsi organisasi, loading/gagal/coba lagi, aksi detail/edit/salin serta review sebelum satu request simpan. Jadwal mandiri memakai templates?standalone=true. Kelompok memakai work-schedule-groups. Satu useDataList memuat endpoint jenis aktif agar pencarian/status konsisten dan request usang dibatalkan. Identitas ID kelompok tidak dikirim sebagai patternId penetapan.
- TemplateEditor.jsx menampilkan Nama jadwal dan dropdown Jenis jam kerja sejajar di desktop serta full width di ponsel, tanpa pilihan awal pada jadwal baru. Jam kerja tetap memakai hari, jam utama dan panel Atur jam kerja per hari. Jam khusus memakai CompactInfoChip neutral/info. Jadwal lama yang rotasi/fleksibel/beberapa waktu ditampilkan read-only, dengan nama/status tetap editable. Status selalu paling bawah.
- WorkTimeFields.jsx memusatkan satu rentang waktu, istirahat, Pulang hari berikutnya, pengurangan istirahat serta panel toleransi. Komponen masih dapat membaca aturan lama, tetapi form baru tidak menampilkan pemilih fixed/flexible/off. FormSettingSwitch, TimeField dan MinutesField tetap bersama.
- ShiftGroupFields.jsx menyediakan Hari kerja dan Form.List panel Collapse untuk nama/jam shift. Panel baru terbuka dan panel existing bernama awalnya dilipat. forceRender mempertahankan registrasi field, validasi membuka panel yang perlu diperbaiki, dan key stabil mengikuti identitas Form.List saat penghapusan. Informasi memakai AppNotice bersama. Tambah/Hapus tidak mengubah pilihan lain. Maksimal 16 kartu. Tidak membuat beberapa waktu kerja untuk satu pilihan atau kontrol Libur kedua. Hari tidak dipilih berarti Libur.
- ShiftGroupSummary.jsx menyajikan seluruh nama/jam pilihan, hari dan kebijakan libur. ScheduleReview.jsx memilih ringkasan kelompok atau ScheduleSummary.jsx sesuai jenis. Review tidak mengirim HTTP tulis. Nama/status/hari/aturan dapat ditinjau sebelum konfirmasi.
- scheduleForm.mjs memusatkan templateValues, templateReview, shiftGroupPayload dan weeklyScheduleDays. Payload memakai allowlist sesuai jenis. Salinan tidak membawa ID referensi kelompok. Form lama mempertahankan aturan dan referensi shift saat metadata disimpan.
- ScheduleFields.jsx menyediakan opsi loading/error/retry, tanggal/jam/menit dan WorkScheduleFields bersama untuk onboarding/penetapan. Pilih satu jadwal tetap atau pilihan shift. Payload patternId dan draft tetap kompatibel. TimeField tidak menampilkan pintasan Sekarang.
- WorkSchedulePage.jsx tetap menyediakan penetapan maksimal 100, histori, pembatalan dan perubahan tanggal. ScheduleCalendar.jsx membaca maksimal 31 tanggal tanpa generator/mutation serta mengabaikan respons usang. WorkMasterPage.jsx mengarahkan master ke form gabungan. MasterEditor.jsx tetap digunakan kalender serta kompatibilitas lama.

Gunakan AppModal dengan deskripsi singkat, FontStyle, FormSettingSwitch, AsyncSelect, CompactInfoChip, divider dan token theme. Pasangan jam dua kolom di desktop serta satu kolom di ponsel. scrollHeaderWithContent memungkinkan header/isi modal digulir bersama dan footer terjangkau, tanpa mengganti default form lain. validationFocus membuka panel/hari dan toleransi yang memiliki error tersembunyi. Notifikasi serta loading backdrop existing tetap bersama. Tidak memakai titik koma pada bahasa UI. Baca docs/ui-ux-guidelines.md dan docs/work-schedules.md sebelum perubahan.

### Kalender libur dan pemilihan Jadwal Pegawai

MasterEditor menempatkan status kalender paling bawah melalui FormSettingSwitch dengan notice aktif/nonaktif. Baris Tanggal libur responsif, tombol Hapus tanggal sejajar kontrol desktop dan bertumpuk pada ponsel. WorkMasterPage memberikan deskripsi filter/tabel kalender. WorkSchedulePage memakai PageHeader.action untuk penetapan, DataPanel.description, checkbox pilihan halaman dengan indeterminate dan batas 100, serta EmployeeAvatar/ImagePreviewModal untuk identitas. Pilihan halaman kartu berada pada toolbar mobile. Batalkan semua pilihan hanya membersihkan state pilihan. Komponen bersama tidak diubah.

### Dialog jadwal Pegawai

WorkSchedulePage menggunakan identitas Pegawai berlabel melalui InfoField dan EmployeeAvatar. WorkScheduleFields menerima allowEndDate (default true demi kompatibilitas onboarding), dengan false pada workspace Jadwal Pegawai. State kosong/gagal pilihan serta informasi periode memakai AppNotice. Ubah jadwal harian memisahkan tanggal/pemeriksaan, pilihan Bekerja atau Libur, waktu kerja dan alasan dengan gap 24px. UI dayType dipetakan ke shiftIds, tidak masuk payload server.

ScheduleHistory.jsx menyusun kartu histori melalui CompactInfoChip, InfoField, InfoFieldGrid dan EmptyState. Periode lama tetap ditampilkan. Metadata tidak tersedia tidak dibuat-buat. Tombol pembatalan hanya dirender untuk penetapan mendatang yang belum dibatalkan dan pengguna berizin, dengan validasi final backend existing.

MasterEditor memakai AppIcon solar:trash-bin-trash-linear dan Tooltip AntD untuk menghapus baris kalender, target 44×44px serta aria-label per baris. WorkSchedulePage memakai solar:eye-linear untuk Periksa jadwal, ikon desktop dan ikon+teks pada ponsel di bawah 600px. Tooltip memakai trigger hover/focus, label tetap tersedia bagi pembaca layar. Label form memakai labelWrap agar teks besar tetap membungkus. Ikon berasal dari pemetaan lokal existing, tanpa sumber runtime baru.

### Aktivasi Fitur Absensi organisasi

OrganizationModulesModal memakai ORGANIZATION_MODULES terpusat untuk FormSettingSwitch Inventaris dan Absensi. GET view=all menunggu status asli sebelum menampilkan sakelar. AppNotice gagal/Coba lagi tidak menyamar sebagai status nonaktif. Isian tetap ada bila PATCH gagal. Hanya perubahan dikirim sebagai satu batch atomik beserta version tiap fitur, dan ConfirmDialog muncul sebelum penonaktifan. AppModal, label aksesibel, status teks selain warna, loading backdrop, timeout/abort serta dirty-close existing tetap digunakan. HrisAccessFields/AccountAccessSummary menjelaskan bahwa Admin HRD penuh mengikuti fitur aktif. EmployeeForm menampilkan AppNotice ketika jadwal dapat diatur nanti, termasuk alasan fitur Absensi belum aktif. Tidak ada komponen gaya baru atau dependency tambahan.

### Organisasi: kelompok dan fakta terpisah

- menuCatalog menyediakan sidebarGroup untuk presentasi yang berbeda dari access.kind. sidebarGroups membentuk kelompok unik setelah filter izin dan mempertahankan urutan item di dalam kelompok. Organisasi tetap platform-only meski tampil di Kepegawaian. Organisasi menjadi item pertama Data Master, Jadwal Kerja mengikuti master kepegawaian lain.
- OrganizationsPage memakai kolom Kode/Nama/Lokasi aktif/Akun HRD/Akses berakhir/Status akses dan satu kolom status per fitur dari ORGANIZATION_MODULES. active_features existing menjadi sumber konfigurasi modul, tidak ada request/API baru. Nama resmi, jenis dan detail periode tetap di OrganizationForm/SubscriptionModal. Kelola fitur memakai SettingOutlined outline, ukuran dari RowActionMenu.
- CompactInfoChip menerima wrap opsional, default false. Jika aktif, tinggi menyesuaikan, label boleh membungkus termasuk kata panjang, tanpa ellipsis. Pemakai existing mempertahankan tinggi/ellipsis lama. OrganizationsPage mengaktifkannya pada kode serta status akses/fitur.
- ReportCardFields menerima stacked opsional, default false. Jika aktif, label di atas nilai dengan satu kolom agar informasi tetap utuh pada ponsel/teks besar. Pemakai laporan existing mempertahankan pasangan dua kolom. Kartu Organisasi memakai stacked dan RowActionMenu fullWidth/buttonLabel pada footer.

Tanggal akhir pada daftar/kartu Organisasi mengikuti status server. Saat grace, tampilkan akhir masa tenggang yang tersedia. Jika tidak, gunakan akhir periode. Status dan pemeriksaan akses tetap kewenangan backend.
