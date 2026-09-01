# Katalog Komponen Reusable SITOU

Periksa katalog dan folder `app/components` sebelum membuat komponen baru. Nama komponen mengikuti fungsi umum, bukan nama menu pertama yang memakainya.

## Layout dan Filter

| Komponen                           | Tujuan                                                                                                                 | Props penting                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `layout/PageHeader`                | Paper header operasional dengan breadcrumb, identitas visual, metadata, judul, deskripsi, dan aksi utama.              | `title`, `description`, `action`, `leading`, `metadata`, `breadcrumbs`, `menuList`         |
| `navigation/AppBreadcrumbs`        | Breadcrumb rekursif yang mengikuti route paling spesifik dari `MenuConfig` dan lifecycle loading navigasi.             | `items`, `menuList`, `fallbackLabel`                                                       |
| `navigation/DetailTabs`            | Workspace detail dengan tab berikon, active state, konten terpadu, keyboard, dan horizontal scroll mobile.             | `items`, `activeKey`, `onChange`, `ariaLabel`                                              |
| `filters/DataToolbar`              | Pencarian, filter status, filter tambahan, dan refresh; mode embedded dipakai di dalam `DataPanel`.                    | `search`, `onSearchChange`, `status`, `onStatusChange`, `filters`, `onRefresh`, `embedded` |
| `filters/OperationalFilterSection` | Section filter yang selalu terlihat dengan label, grid responsif, dan aksi atur ulang untuk daftar operasional.        | `title`, `description`, `items`, `onReset`                                                 |
| `navbar/ProtectedShell`            | Shell terproteksi yang menyatukan topbar, sidebar desktop, drawer mobile, subscription, sesi, loading, dan notifikasi. | `user`, `children`                                                                         |
| `auth/AuthenticatedUserProvider`   | Membagikan identitas session terverifikasi kepada halaman client tanpa request tambahan.                               | `user`, `children`; hook `useAuthenticatedUser`                                            |

## Data Display

| Komponen                          | Tujuan                                                                                    | Props penting                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `data-display/DataPanel`          | Satu paper untuk judul daftar, ringkasan, toolbar embedded, data view, dan pagination.    | `title`, `description`, `toolbar`, `children`                                     |
| `data-display/ResponsiveDataView` | AntD Table pada tablet/desktop dan card list dengan loading serta pagination pada mobile. | `data`, `columns`, `renderCard`, `pagination`, `onPageChange`, `loading`, `error` |
| `data-display/EmptyState`         | Empty/no-result state umum.                                                               | `title`, `description`                                                            |
| `data-display/ErrorState`         | Error state dengan aksi retry.                                                            | `message`, `onRetry`                                                              |
| `chips/CompactInfoChip`           | Satu-satunya chip untuk metadata dan status, dengan tone semantik, ikon, dan label.       | `label`, `status`, `tone`, `icon`, `color`, `sx`                                  |

Area daftar operasional wajib memeriksa `DataPanel` sebelum membuat wrapper baru. Hindari paper tambahan untuk toolbar atau tabel di dalam panel; card hanya dipakai sebagai item berulang pada mobile. `CompactInfoChip` menangani metadata sekaligus status agar tidak ada reusable badge kedua dengan fungsi sama. Chip dipakai untuk data yang perlu ditonjolkan, bukan seluruh teks tabel.

## Actions dan Modal

| Komponen                     | Tujuan                                                                                                                                       | Props penting                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `actions/RowActionMenu`      | Menu aksi per baris/kartu dengan target sentuh yang aman.                                                                                    | `items`                                                                                                               |
| `actions/ConfirmDialog`      | Konfirmasi risiko yang menyusun `AppModal`.                                                                                                  | `open`, `title`, `message`, `confirmText`, `danger`, `onConfirm`                                                      |
| `modals/AppModal`            | Satu-satunya modal shell umum untuk form, detail, konfirmasi, dan konten React. Properti ikon menerima nama Iconify atau elemen React lokal. | `open`, `onClose`, `title`, `description`, `icon`, `size`, `width`, `component`, `onSubmit`, `footer`, close controls |
| `modals/ExpiredSessionModal` | Feedback sesi kedaluwarsa, countdown, progress, dan redirect login.                                                                          | `open`, `secondsRemaining`, `onLogout`                                                                                |
| `modals/ImagePreviewModal`   | Preview endpoint privat/blob/file lokal dengan loading, error, alt text, dan zoom.                                                           | `imageUrl`, `alt`, `title`, `open`, `onClose`                                                                         |

`LoadingBackdrop` dan `Notification` dikontrol parent. Modal fitur wajib menyusun `AppModal`; dilarang membuat modal shell lain.

Pada detail pegawai, tab Dokumen hanya menampilkan checklist kelengkapan. Upload serta aksi file ditempatkan pada konteks domainnya supaya pengguna tidak melihat dua kontrol dengan fungsi sama: identitas melalui Profil Lengkap, kontrak melalui histori Kontrak, SK melalui histori Penempatan, serta ijazah dan sertifikat melalui tab Pendidikan.

Popup AntD seperti Select, DatePicker, Dropdown, Tooltip, dan Popover memakai `zIndexPopupBase` terpusat pada `approvider/AppProviders.jsx`. Jangan memberi z-index per field; popup harus tetap berada di atas `AppModal` dan di bawah LoadingBackdrop/Notification.
Seluruh tanggal form memakai `DatePicker` dengan locale terpusat; komponen fitur hanya mengubah nilai Day.js menjadi ISO `YYYY-MM-DD` ketika menyusun request API dan tidak menyediakan input tanggal manual.

## Form dan Select

| Komponen                             | Tujuan                                                                                                  | Props penting                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `forms/AsyncSelect`                  | Select async umum dengan loading dan empty state.                                                       | Props AntD `Select`, `loading`, `options`                                                                   |
| `forms/OrganizationScopeField`       | Pemilih organisasi Superadmin atau organisasi session HRD yang terkunci.                                | `disabled`                                                                                                  |
| `forms/FileUploadField`              | Dropzone umum untuk Excel, PDF, gambar, dan dokumen; gambar selalu dilihat melalui `ImagePreviewModal`. | `value`, `accept`, `maxSizeBytes`, `onSelect`, `onRemove`, `previewUrl`                                     |
| `forms/FileUploadListField`          | Adapter koleksi file lokal yang menyusun `FileUploadField` untuk form komposit dengan banyak lampiran.  | `value`, `accept`, `maxSizeBytes`, `maxCount`, `onChange`, `onError`, `fullWidth`                           |
| `forms/IndonesiaPhoneInput`          | Input nomor seluler Indonesia dengan prefix tetap `+62` dan nilai E.164.                                | Props standar AntD Input: `value`, `onChange`, `disabled`, `placeholder`                                    |
| `forms/IndonesianNationalIdInput`    | Input NIK 16 digit dengan penyaring angka, counter, dan indikator valid.                                | Props standar AntD Input: `value`, `onChange`, `disabled`, `placeholder`                                    |
| `forms/PrivateFileUpload`            | Adapter upload privat umum berbasis file ID untuk gambar dan dokumen, dengan backdrop global opsional.  | `value`, `uploadUrl`, `removeUrl`, `fields`, `accept`, `maxSizeBytes`, `showRemove`, `backdropMessages`     |
| `forms/PrivatePdfUpload`             | Adapter upload PDF privat berbasis file ID yang menyusun `FileUploadField`.                             | `value`, `uploadUrl`, `removeUrl`, `fields`, `organizationId`, `onChange`, `showRemove`, `backdropMessages` |
| `selects/OrganizationSelect`         | Pilihan organisasi dari endpoint options.                                                               | `excludeIds`, `autoSelectFirst`, props `AsyncSelect`                                                        |
| `selects/LocationSelect`             | Pilihan lokasi aktif berdasarkan organisasi.                                                            | `organizationId`, props `AsyncSelect`                                                                       |
| `selects/OrganizationUnitTypeSelect` | Pilihan jenis unit aktif per organisasi dan pilihan lama saat edit.                                     | `organizationId`, `includeId`, props `AsyncSelect`                                                          |
| `selects/EmployeeSelect`             | Pilihan pegawai aktif sesuai organisasi dan cakupan lokasi actor.                                       | `organizationId`, `excludeId`, props `AsyncSelect`                                                          |

Form domain tetap berada di modul fitur dan dirender sebagai children `AppModal`. Gunakan `hooks/useFormModalClose` bersama `ConfirmDialog` untuk dirty-state warning.
Form panjang dengan tab/collapse wajib mengarahkan validasi ke section bermasalah: tampilkan Notification, buka dan tandai section, lalu fokuskan field pertama yang gagal.
Seluruh UI pemilihan file wajib memakai `forms/FileUploadField`; adapter domain boleh menyusunnya untuk menangani endpoint atau lifecycle khusus.
Seluruh aksi lihat gambar wajib memakai `modals/ImagePreviewModal`; jangan membuka gambar langsung pada tab browser atau membuat modal preview per fitur.

## Subscription dan Feedback

| Komponen                          | Tujuan                                                                                         | Props penting                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `subscription/SubscriptionStatus` | Status ringkas masa akses organisasi pada topbar.                                              | `status`, `endsOn`, `graceEndsOn`, `daysRemaining`                                    |
| `subscription/SubscriptionBanner` | Peringatan 30 hari terakhir dan tombol perpanjang.                                             | `status`, `endsOn`, `graceEndsOn`, `daysRemaining`, `onRenew`                         |
| loading/LoadingBackdropProvider   | Mengelola token proses dan navigasi tanpa delay; backdrop aktif sampai seluruh proses selesai. | startLoading, runWithLoadingBackdrop, startNavigationLoading, finishNavigationLoading |
| `Notifications/Notification`      | Feedback berhasil, gagal, peringatan, atau informasi.                                          | `open`, `message`, `severity`, `onClose`                                              |
| `font-style/FontStyle`            | Satu-satunya typography MUI SITOU.                                                             | Props typography; bobot 500, 600, atau maksimal 700                                   |

## Dashboard dan Visualisasi

| Komponen                               | Tujuan                                                                                                  | Props penting                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `dashboard/DashboardMetric`            | Panel KPI dengan aksen status, angka lokal, ikon, dan dukungan microtrend.                              | `metric`, `loading`                         |
| `dashboard/DashboardChart`             | Shell grafik dengan header, tinggi stabil, loading, empty state, dan hover yang halus.                  | `title`, `description`, `icon`, `loading`   |
| `dashboard/AreaTrendChart`             | Grafik area untuk membandingkan arus perubahan berdasarkan periode.                                     | `data`                                      |
| `dashboard/HorizontalBarChart`         | Grafik batang horizontal untuk label kategori yang panjang.                                             | `data`, `percent`                           |
| `dashboard/StackedBarChart`            | Grafik batang bertumpuk untuk komposisi beberapa seri.                                                  | `data`, `horizontal`                        |
| `dashboard/DonutChart`                 | Grafik donut kelengkapan data dengan total dan legend Bahasa Indonesia.                                 | `data`                                      |
| `dashboard/MetricSparkline`            | Grafik mini tanpa sumbu untuk tren pada KPI.                                                            | `data`, `color`                             |
| `dashboard/DashboardAttentionList`     | Daftar prioritas operasional dengan tingkat urgensi.                                                    | `items`, `loading`                          |
| `dashboard/EmployeeCompositionSummary` | Satu panel snapshot komposisi jenis kelamin, status, masa kerja, dan jenis kepegawaian.                 | `data`, `loading`                           |
| `dashboard/DashboardActivityList`      | Daftar aktivitas audit terbaru tanpa membuka payload sensitif.                                          | `items`, `loading`                          |
| `dashboard/chartAdapter`               | Sumber konfigurasi ApexCharts untuk theme, format Indonesia, responsive behavior, tooltip, dan animasi. | `createChartOptions`, `formatChartCategory` |

Seluruh grafik dashboard wajib menyusun adapter ApexCharts terpusat dan dirender melalui `ApexChartClient` dengan SSR nonaktif. Adapter wajib menormalkan kategori dan nilai numerik agar label `NaN` atau `undefined` tidak pernah tampil. Grafik fitur tidak boleh menyalin konfigurasi theme, tooltip, breakpoint, atau reduced motion secara terpisah. Grafik harus mendukung keputusan pengguna dan selalu memiliki state loading, kosong, serta error pada shell-nya. `DashboardAttentionList` menerima scope organisasi agar item disiplin dapat membuka tab sanksi pegawai yang tepat; chip prioritas ditempatkan bersama judul dan aksi detail memakai ikon mata yang mudah dikenali.

## Branding

- `branding/AppLogo` adalah satu-satunya komponen untuk menampilkan logo SITOU. Gunakan `variant="full"` untuk logo beserta tagline dan `variant="mark"` untuk simbol ringkas.
- Seluruh path aset logo, termasuk metadata aplikasi, bersumber dari `APP_LOGO_ASSETS` di `branding/AppLogo.jsx`. Perubahan logo dilakukan hanya pada konfigurasi tersebut.
- `/public/logo-sitou-v2.png`: logo huruf/simbol ringkas.
- `/public/logo-sitou-v1.png`: logo SITOU beserta tagline.
- SITOU hanya memakai theme light. Merah adalah aksen, bukan warna seluruh permukaan.
- Token BRAND_COLORS dan STATUS_TONES berada di themeprovider/ThemeProvider.jsx serta tersedia melalui theme.brand dan theme.status. Komponen MUI, AntD, badge, dan halaman fitur harus memakai sumber warna semantik yang sama.

## Kepegawaian dan Akses

| Komponen                               | Tujuan                                                                                                                                                                                                                       | Props penting                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `employees/EmployeeDirectory`          | Satu pintu masuk daftar pegawai dengan aksi lihat ringkasan serta edit yang dibatasi untuk HRD dan Superadmin.                                                                                                               | Tanpa props; role dan organisasi berasal dari session  |
| `employees/EmployeeForm`               | Workflow profil, KTP/pas foto opsional, kontrak, PDF kontrak, penempatan, PDF SK, dan draft tujuh hari. Seluruh komunikasi backend di wizard memakai token `LoadingBackdropProvider`.                                        | `open`, `item`, `organizationId`, callback             |
| `employees/EmployeeImportModal`        | Stepper import Excel data kepegawaian, petunjuk, preview per pegawai, dan commit idempotent.                                                                                                                                 | `open`, `organizationId`, callback                     |
| `employees/EmployeeDetail`             | Workspace detail responsif dengan ringkasan identitas tanpa duplikasi, preview pas foto/KTP, tab jaminan, pendidikan terstruktur, histori kontrak beserta jejak audit pelaku/waktu, dokumen, disiplin, dan akun sesuai role. | `employeeId`; tab aktif melalui query `tab`            |
| `employees/EmployeeLifecycleForms`     | Form record baru untuk rolling/mutasi dan kontrak tanpa menimpa histori.                                                                                                                                                     | `employee`, callback                                   |
| `employees/EmployeeTerminationForm`    | Workflow terkonfirmasi untuk status Diberhentikan, Pensiun, atau Meninggal dunia; menutup data aktif tanpa menghapus histori.                                                                                                | `open`, `employee`, `organizationId`, callback         |
| `discipline/DisciplineForms`           | Membuka kasus, mengedit draft tindakan, menerbitkan keputusan, dan mencabut tindakan aktif dengan alasan tanpa menghapus histori.                                                                                            | `organizationId`, `disciplineCase`, `action`, callback |
| `discipline/DisciplineCaseDetailModal` | Detail lengkap kasus, pembelaan, tindakan, eskalasi, audit penerbit/pencabutan, dan satu aksi unduh surat melalui `AppModal`.                                                                                                | `open`, `disciplineCase`, `organizationId`, `onClose`  |
| `access/OrganizationAccountForm`       | Membuat akun organisasi, tautan profil opsional untuk HRD/Pimpinan, wajib untuk Pegawai, serta mengatur scope.                                                                                                               | `item`, `organizationId`, callback                     |

Komponen domain di atas menyusun fondasi reusable umum dan tidak membuat modal, tabel, chip, notification, atau loading shell baru.

Halaman detail memakai `DetailTabs` sebelum membuat tab shell baru. Informasi dikelompokkan berdasarkan kebutuhan pengguna, status diterjemahkan ke Bahasa Indonesia, dan aksi utama ditempatkan pada header section. Pimpinan memakai workspace yang sama dalam mode read-only tanpa menerima tab atau data akun.

Histori penempatan selalu dapat dibuka melalui modal `Detail penempatan`, termasuk record tanpa dokumen SK. Hanya penempatan aktif tanpa `effective_until` yang dapat dikoreksi; histori bersifat read-only di UI dan wajib ditolak kembali oleh service/API bila diminta langsung.

Data sensitif yang panjang memakai pola kartu ringkas dan `AppModal` detail. Kartu hanya membantu pemindaian daftar; uraian lengkap, pembelaan, audit, eskalasi, serta dokumen ditampilkan pada modal. Satu dokumen resmi hanya menyediakan satu aksi unduh yang tetap melewati endpoint berizin.

`TopMenu` memakai tombol Pengaturan tanpa identitas pengguna pada pop-up. Aksi Profil wajib menuju `/profile` melalui lifecycle loading shell; aksi Keluar memakai alur logout terpusat.

# Modul Cuti & Izin

- Halaman operasional memakai `ResponsiveDataView`, filter server-side, dan state filter di URL.
- `LeaveRequestForm` mencatat keputusan HRD langsung sebagai approved setelah konfirmasi; validasi lokal tidak membuka loading backdrop.
- `LeaveDetailModal` menjadi tampilan yang sama untuk HRD, Superadmin, dan Pimpinan read-only.
- Tab pegawai membaca `leave-summary`; saldo berasal dari ledger dan approved record hanya dapat dikoreksi melalui pembatalan beralasan.
- Lampiran diunggah privat dengan jenis `lampiran_cuti`, dibatasi organisasi/pegawai, dan dibersihkan kembali bila transaksi pencatatan gagal.
