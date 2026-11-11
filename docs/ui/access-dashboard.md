# Koreksi UI akses dan dashboard

## Daftar organisasi dan kelompok navigasi

- Kelompok sidebar adalah presentasi, bukan izin. Organisasi berada bersama Lokasi, Jenis Unit Organisasi, Divisi & Unit, Jabatan, Jenis Kepegawaian dan Jadwal Kerja dalam satu kelompok Kepegawaian pada Data Master. Izin Organisasi tetap platform khusus Superadmin. Jangan mengubah access.kind atau role untuk memindahkan letak menu. sidebarGroup dapat mengatur presentasi, dan label kelompok tidak diulang ketika item berselang.

- Daftar Organisasi memisahkan Kode, Nama organisasi, Lokasi aktif, Akun HRD, Akses berakhir, Status akses, Inventaris dan Absensi. Satu fakta utama per kolom. Nama resmi, jenis dan rincian periode tetap tersedia pada form terkait, tidak ditumpuk bersama nama/kode pada sel identitas. Angka lokasi/admin memakai arti DTO existing, bukan indikator kesiapan onboarding yang belum dihitung.

- Setiap fitur memiliki status Aktif/Nonaktif dengan CompactInfoChip existing beserta ikon dan teks. Status konfigurasi fitur berbeda dari status akses organisasi. Kode dan status panjang memakai wrap opsional agar utuh, termasuk saat teks diperbesar. Tabel boleh digulir horizontal secara lokal pada layar menengah, tanpa overflow halaman atau mengecilkan font.

- Kartu mobile memakai ReportCardFields stacked: label di atas nilai, fakta terpisah, dan aksi berlabel Aksi organisasi pada footer. Nama panjang boleh membungkus. RowActionMenu tetap menyediakan nama aksesibel yang menyebut organisasi.

- Aksi Kelola fitur memakai SettingOutlined dari keluarga outline yang sama dengan EditOutlined, SyncOutlined dan StopOutlined. Gaya navigasi bold duotone tidak disisipkan ke antara ikon aksi outline. Ukuran menu aksi mengikuti RowActionMenu bersama, bukan ukuran ad hoc per item.

Tanggal Akses berakhir memakai subscription_ends_on untuk periode biasa dan subscription_grace_ends_on ketika API menyatakan status grace. Tidak menghitung ulang status atau masa akses di browser. Tanggal kosong ditampilkan Belum diatur.

## Konsistensi modal wajib

- Pelipatan konten wajib memakai AppCollapse; region navigasi dan accordion laporan memakai adapter pada file yang sama. Jangan mengimpor primitive Collapse/Accordion library di fitur. Pertahankan state terkontrol, forceRender untuk form yang memerlukannya, pembukaan panel error dan keyboard. Label/status tetap terbaca saat tertutup.

## UI/UX

- Saat logout dimulai, hentikan polling akses dan timer sesi, batalkan request akses yang masih berjalan, serta abaikan respons terlambat. Modal sesi berakhir/perubahan akses tidak boleh muncul selama logout. Jika logout gagal, pulihkan pemeriksaan sesi dan polling; kedaluwarsa sungguhan tetap mengikuti alur keamanan.

- Desktop: sidebar; mobile: drawer/bottom navigation dan tabel kompleks menjadi card list.

- Shell halaman terproteksi wajib memakai `app/components/navbar/LeftNavBar.jsx` sebagai sidebar permanen pada desktop (`lg` ke atas), `app/components/navbar/MobileLeftNavBar.jsx` sebagai drawer pada tablet/mobile (`lg` ke bawah), dan `app/components/navbar/TopMenu.jsx` sebagai topbar bersama. Keduanya wajib memakai sumber menu dan renderer sidebar yang sama agar hak akses, status aktif, dan tampilan tidak berbeda antar-device.

- Tombol notifikasi di `TopMenu` tetap ditampilkan sebagai placeholder sampai modul notifikasi SITOU dikembangkan, tetapi dilarang menambahkan polling, request API, badge jumlah, popover data, atau event notifikasi lama. SITOU tidak memakai tombol pengganti tema light/dark.

- Tombol akun TopMenu memakai avatar privat, nama depan dan belakang dari identitas lengkap (abaikan nama tengah), serta jabatan dari penempatan utama; fallback akun tanpa profil memakai username dan role. Pada mobile di bawah breakpoint sm (600px), tampilkan hanya avatar dan panah bawah; nama/jabatan tetap tersedia pada tooltip, nama akun tetap ada pada label aksesibel, dan teks tampil kembali mulai tablet. Target sentuh tetap minimal 44px. Pop-up tetap Profil/Keluar. Sidebar menampilkan organisasi dan lokasi penempatan sendiri; kartu masa akses di bawah sidebar/drawer menampilkan tanggal/status/sisa hari server dan Perpanjang akses dengan notifikasi Coming soon. Jangan mengubah lifecycle logout atau guard navigasi. Route /profile tetap memakai identitas terpusat.

- Form login SITOU hanya meminta username dan password. `users` khusus menyimpan kredensial dan metadata keamanan; nama, email, serta WhatsApp dilarang diduplikasi ke tabel atau form akun. Identitas organisasi berasal dari profil pegawai, identitas Superadmin berasal dari `platform_user_profiles`, dan akun tanpa profil memakai username sebagai fallback. Tautan lupa password tetap dipertahankan sampai OTP WhatsApp terverifikasi dikembangkan.

- Navigasi wajib memakai lifecycle navigasi provider: loading dimulai sebelum router push/replace dan baru dilepas setelah route tujuan terpasang. Bila halaman tujuan mengambil data, proses pengambilan data memiliki token loading sendiri sehingga backdrop tetap tampil sampai data selesai dimuat.

- Status berhasil atau gagal pada login, navigasi yang memerlukan feedback, dan CRUD wajib memakai reusable `app/components/Notifications/Notification.jsx`. Periksa komponen loading dan notifikasi yang ada sebelum membuat komponen baru.

- Schema checkpoint draft wajib menerima nilai parsial dari step yang belum diselesaikan dan tetap menolak key asing atau payload berlebihan. Kelengkapan field wajib divalidasi pada navigasi step dan diulang dengan schema final saat submit; kegagalan API wajib dipetakan kembali ke field/step terkait tanpa menghapus isian pengguna.

## Fondasi reusable dan standar visual SITOU

- Halaman detail wajib mempunyai hierarchy identitas, status, navigasi, section informasi, dan aksi yang jelas. Kelompokkan informasi berdasarkan kebutuhan pengguna, bukan mengikuti urutan kolom database atau menampilkan kumpulan label-nilai datar tanpa struktur.

- Sidebar desktop harus tetap setinggi viewport dan memiliki scroll navigasi internal sendiri ketika menu atau konten halaman memanjang.

- Penolakan login wajib memakai kode stabil dan pesan spesifik: masalah akun/profil/penempatan/lokasi/divisi mengarahkan pengguna ke Admin organisasi, sedangkan organisasi nonaktif atau masa berlaku tidak efektif mengarahkan pengguna ke Admin SITOU.

- Ikon navigasi dan aksi akun di topbar (notifikasi, Profil, Keluar) wajib memakai Iconify offline melalui `AppIcon` (`@iconify/react/dist/offline`) dengan ID semantik dan data SVG lokal yang dibundel dari `navigationIconSources.mjs`; jangan memakai nama ikon Iconify yang diunduh dari API saat runtime, URL eksternal, atau font ikon CDN. Untuk mengganti ikon, ubah hanya nama Iconify di sebelah kanan ID semantik pada file tersebut. `npm run dev` membuat data SVG lokal saat mulai dan memperbaruinya otomatis ketika sumber diubah; `npm run build` membuat ulang sebelum kompilasi; `npm run icons:check` memeriksa kesesuaian tanpa mengubah file untuk CI/review. Nama ikon salah wajib gagal dengan pesan jelas tanpa menimpa data lama. Seluruh ikon sudah tersedia sejak HTML awal dan tetap tampil ketika klien tidak terhubung ke internet. Seluruh ikon menu dan aksi akun topbar memakai Solar bold-duotone (two-tone terisi) yang sesuai objek/menu. Ikon Dashboard utama boleh beranimasi skala halus secara terus-menerus sebagai pengecualian, berhenti saat hover/fokus, dan wajib menjadi statis untuk `prefers-reduced-motion`; ikon menu lain tidak beranimasi. Ikon lama di luar navigasi dan aksi akun topbar boleh dipertahankan sampai dimigrasikan; jangan menambah ikon navigasi atau aksi akun topbar AntD/MUI baru.

- Dashboard visual wajib memakai komponen reusable pada `app/components/dashboard` dan adapter ApexCharts terpusat. Dilarang mendefinisikan ulang konfigurasi theme, format tooltip Indonesia, responsive breakpoint, atau reduced motion pada setiap halaman.

- Dashboard tidak memakai filter tanggal global. Enam indikator organisasi menampilkan kondisi saat ini dan tidak menjadi tautan; semua memakai hover halus yang menghormati reduced motion. Tren pegawai dan kontrak memakai 12 bulan kalender termasuk bulan berjalan hingga hari ini, sesuai timezone organisasi. Kontrak segera berakhir tetap 30 hari ke depan; proyeksi pensiun tetap 12 bulan ke depan.

- Dashboard tidak boleh terasa polos ataupun berlebihan. Kekayaan visual dibangun dari hierarchy, komposisi grid, iconography, status tint, microtrend, dan spacing; hindari gradient dekoratif, animasi terus-menerus selain pengecualian ikon Dashboard utama di sidebar, data label yang ramai, dan kartu bertingkat.

- Dataset dashboard wajib difilter berdasarkan role, organisasi, dan cakupan lokasi di backend. Data draft atau sensitif yang tidak berhak dilihat role dilarang dikirim ke browser hanya untuk disembunyikan di UI.

- Query agregasi dashboard wajib dikelompokkan tanpa N+1, memakai parameter SQL, cache singkat bila sesuai, dan diuji pada dataset representatif sebelum optimasi melalui index atau materialized view.

- Dataset Dashboard dengan kewenangan yang sama ditampilkan konsisten untuk HRD dan Pimpinan. HRD terbatas hanya menerima domain/submenu yang diberikan; organisasi, cakupan lokasi, draft dan data sensitif tetap diperiksa di backend.

- Item prioritas disiplin wajib menavigasi ke detail pegawai pada tab Disiplin melalui LoadingBackdrop dan mempertahankan scope organisasi Superadmin. Chip prioritas ditempatkan dekat nama data dengan jarak aman, sedangkan aksi detail memakai ikon mata, tooltip, dan aria-label yang jelas. Data tindakan draft tetap tidak boleh dikirim kepada Pimpinan.

## Pemulihan loading navigasi

- Bedakan token proses simpan/upload/autentikasi dari token navigasi. Pembatalan stream RSC, Back/Forward, atau perpindahan yang tidak selesai tidak boleh meninggalkan overlay navigasi permanen.

- Loading navigasi memiliki deadline terpusat 30 detik dan pemberitahuan pemulihan; timer lama dibatalkan saat selesai/diganti. Hanya token navigasi dilepas, bukan proses upload/simpan aktif. Jangan menekan console error framework secara global untuk menutupi masalah.

Pemulihan navigasi sidebar: selesaikan token loading saat transisi router selesai, termasuk redirect ke pathname asal. Setelah 30 detik, href internal yang sudah melewati guard isian dapat dibuka via request dokumen baru agar router RSC tertahan tidak menggagalkan perpindahan. Validasi origin wajib; jangan memakai reload otomatis untuk proses upload/simpan atau melewati konfirmasi isian. Tanpa href pemulihan valid, pertahankan notifikasi dan pelepasan token navigasi saja.
