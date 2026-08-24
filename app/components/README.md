# Katalog Komponen Reusable SITOU

Periksa katalog dan folder `app/components` sebelum membuat komponen baru. Nama komponen mengikuti fungsi umum, bukan nama menu pertama yang memakainya.

## Layout dan Filter

| Komponen                         | Tujuan                                                                                                                 | Props penting                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `layout/PageHeader`              | Paper header operasional dengan breadcrumb, identitas visual, metadata, judul, deskripsi, dan aksi utama.              | `title`, `description`, `action`, `leading`, `metadata`, `breadcrumbs`, `menuList`         |
| `navigation/AppBreadcrumbs`      | Breadcrumb rekursif yang mengikuti route paling spesifik dari `MenuConfig` dan lifecycle loading navigasi.             | `items`, `menuList`, `fallbackLabel`                                                       |
| `navigation/DetailTabs`          | Workspace detail dengan tab berikon, active state, konten terpadu, keyboard, dan horizontal scroll mobile.             | `items`, `activeKey`, `onChange`, `ariaLabel`                                              |
| `filters/DataToolbar`            | Pencarian, filter status, filter tambahan, dan refresh; mode embedded dipakai di dalam `DataPanel`.                    | `search`, `onSearchChange`, `status`, `onStatusChange`, `filters`, `onRefresh`, `embedded` |
| `navbar/ProtectedShell`          | Shell terproteksi yang menyatukan topbar, sidebar desktop, drawer mobile, subscription, sesi, loading, dan notifikasi. | `user`, `children`                                                                         |
| `auth/AuthenticatedUserProvider` | Membagikan identitas session terverifikasi kepada halaman client tanpa request tambahan.                               | `user`, `children`; hook `useAuthenticatedUser`                                            |

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

Pada detail pegawai, tab Dokumen hanya menampilkan checklist kelengkapan. Upload serta aksi file ditempatkan pada konteks domainnya supaya pengguna tidak melihat dua kontrol dengan fungsi sama: identitas melalui Profil Lengkap, kontrak melalui histori Kontrak, SK melalui histori Penempatan, dan dokumen kompetensi melalui tab Kompetensi.

Popup AntD seperti Select, DatePicker, Dropdown, Tooltip, dan Popover memakai `zIndexPopupBase` terpusat pada `approvider/AppProviders.jsx`. Jangan memberi z-index per field; popup harus tetap berada di atas `AppModal` dan di bawah LoadingBackdrop/Notification.

## Form dan Select

| Komponen                             | Tujuan                                                                          | Props penting                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `forms/AsyncSelect`                  | Select async umum dengan loading dan empty state.                               | Props AntD `Select`, `loading`, `options`                                               |
| `forms/OrganizationScopeField`       | Pemilih organisasi Superadmin atau organisasi session HRD yang terkunci.        | `disabled`                                                                              |
| `forms/FileUploadField`              | Dropzone umum untuk Excel, PDF, gambar, dan dokumen dengan state file terpilih. | `value`, `accept`, `maxSizeBytes`, `onSelect`, `onRemove`, `previewUrl`                 |
| `forms/IndonesiaPhoneInput`          | Input nomor seluler Indonesia dengan prefix tetap `+62` dan nilai E.164.        | Props standar AntD Input: `value`, `onChange`, `disabled`, `placeholder`                |
| `forms/PrivateFileUpload`            | Adapter upload privat umum berbasis file ID untuk gambar dan dokumen.           | `value`, `uploadUrl`, `removeUrl`, `fields`, `accept`, `maxSizeBytes`, `showRemove`     |
| `forms/PrivatePdfUpload`             | Adapter upload PDF privat berbasis file ID yang menyusun `FileUploadField`.     | `value`, `uploadUrl`, `removeUrl`, `fields`, `organizationId`, `onChange`, `showRemove` |
| `selects/OrganizationSelect`         | Pilihan organisasi dari endpoint options.                                       | `excludeIds`, props `AsyncSelect`                                                       |
| `selects/LocationSelect`             | Pilihan lokasi aktif berdasarkan organisasi.                                    | `organizationId`, props `AsyncSelect`                                                   |
| `selects/OrganizationUnitTypeSelect` | Pilihan jenis unit aktif per organisasi dan pilihan lama saat edit.             | `organizationId`, `includeId`, props `AsyncSelect`                                      |
| `selects/EmployeeSelect`             | Pilihan pegawai aktif sesuai organisasi dan cakupan lokasi actor.               | `organizationId`, `excludeId`, props `AsyncSelect`                                      |

Form domain tetap berada di modul fitur dan dirender sebagai children `AppModal`. Gunakan `hooks/useFormModalClose` bersama `ConfirmDialog` untuk dirty-state warning.
Seluruh UI pemilihan file wajib memakai `forms/FileUploadField`; adapter domain boleh menyusunnya untuk menangani endpoint atau lifecycle khusus.

## Subscription dan Feedback

| Komponen                          | Tujuan                                                                                         | Props penting                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `subscription/SubscriptionStatus` | Status ringkas masa akses organisasi pada topbar.                                              | `status`, `endsOn`, `graceEndsOn`, `daysRemaining`                                    |
| `subscription/SubscriptionBanner` | Peringatan 30 hari terakhir dan tombol perpanjang.                                             | `status`, `endsOn`, `graceEndsOn`, `daysRemaining`, `onRenew`                         |
| loading/LoadingBackdropProvider   | Mengelola token proses dan navigasi tanpa delay; backdrop aktif sampai seluruh proses selesai. | startLoading, runWithLoadingBackdrop, startNavigationLoading, finishNavigationLoading |
| `Notifications/Notification`      | Feedback berhasil, gagal, peringatan, atau informasi.                                          | `open`, `message`, `severity`, `onClose`                                              |
| `font-style/FontStyle`            | Satu-satunya typography MUI SITOU.                                                             | Props typography; bobot 500, 600, atau maksimal 700                                   |

## Branding

- `branding/AppLogo` adalah satu-satunya komponen untuk menampilkan logo SITOU. Gunakan `variant="full"` untuk logo beserta tagline dan `variant="mark"` untuk simbol ringkas.
- Seluruh path aset logo, termasuk metadata aplikasi, bersumber dari `APP_LOGO_ASSETS` di `branding/AppLogo.jsx`. Perubahan logo dilakukan hanya pada konfigurasi tersebut.
- `/public/logo-sitou-v2.png`: logo huruf/simbol ringkas.
- `/public/logo-sitou-v1.png`: logo SITOU beserta tagline.
- SITOU hanya memakai theme light. Merah adalah aksen, bukan warna seluruh permukaan.
- Token BRAND_COLORS dan STATUS_TONES berada di themeprovider/ThemeProvider.jsx serta tersedia melalui theme.brand dan theme.status. Komponen MUI, AntD, badge, dan halaman fitur harus memakai sumber warna semantik yang sama.

## Kepegawaian dan Akses

| Komponen                           | Tujuan                                                                                                                         | Props penting                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `employees/EmployeeDirectory`      | Satu pintu masuk daftar pegawai dengan aksi cepat menuju tab profil, penempatan, kontrak, dokumen, dan disiplin.               | Tanpa props; role dan organisasi berasal dari session |
| `employees/EmployeeForm`           | Workflow profil, KTP/pas foto opsional, kontrak, PDF kontrak, penempatan, PDF SK, dan draft tujuh hari berbasis aksi pengguna. | `open`, `item`, `organizationId`, callback            |
| `employees/EmployeeImportModal`    | Stepper import Excel data kepegawaian, petunjuk, preview per pegawai, dan commit idempotent.                                   | `open`, `organizationId`, callback                    |
| `employees/EmployeeDetail`         | Workspace detail responsif untuk ringkasan, histori, checklist dokumen, disiplin, dan akun sesuai role.                        | `employeeId`; tab aktif melalui query `tab`           |
| `employees/EmployeeLifecycleForms` | Form record baru untuk rolling/mutasi dan kontrak tanpa menimpa histori.                                                       | `employee`, callback                                  |
| `discipline/DisciplineForms`       | Membuka kasus manual dan menerbitkan tindakan keputusan HRD.                                                                   | `organizationId` atau `disciplineCase`, callback      |
| `access/OrganizationAccountForm`   | Membuat akun organisasi, tautan profil opsional untuk HRD/Pimpinan, wajib untuk Karyawan, serta mengatur scope.                | `item`, `organizationId`, callback                    |

Komponen domain di atas menyusun fondasi reusable umum dan tidak membuat modal, tabel, chip, notification, atau loading shell baru.

Halaman detail memakai `DetailTabs` sebelum membuat tab shell baru. Informasi dikelompokkan berdasarkan kebutuhan pengguna, status diterjemahkan ke Bahasa Indonesia, dan aksi utama ditempatkan pada header section. Pimpinan memakai workspace yang sama dalam mode read-only tanpa menerima tab atau data akun.

`TopMenu` memakai tombol Pengaturan tanpa identitas pengguna pada pop-up. Aksi Profil wajib menuju `/profile` melalui lifecycle loading shell; aksi Keluar memakai alur logout terpusat.
