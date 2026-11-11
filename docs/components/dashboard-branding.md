# dashboard branding

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

### Workspace Dashboard

`dashboard/DashboardWorkspace` memakai `DetailTabs` embedded hanya jika Inventaris berizin. `EmployeeDashboard` memakai ringkasan self-service, PhotoAvatar dan ImagePreviewModal; `InventoryDashboard` memakai DashboardMetric, DashboardChart, StackedBarChart/HorizontalBarChart, ResponsiveDataView dan InventoryItemPhoto. Section data terpisah per permission/scope, status loading/kosong/error dan retry memakai helper API bersama. Jarak section 24px, kontrol 44px. Grafik bukan data contoh dan tidak menjumlahkan satuan barang berbeda.

Presentasi dashboard mengikuti [aturan Inventaris](../rules/dashboard.md#dashboard-pegawai-dan-inventaris); acuan tab lama telah diganti oleh navigasi submenu.

Rujukan: [Verifikasi](../dashboard-workspace.md#verifikasi).

DataPanel menerima action opsional di kanan judul. Aksi lihat semua stok memakai ikon action:view-all, tooltip, aria-label, dan target 44px; filter gudang dan organisasi tetap dibawa.

DonutChart mendukung type=pie dan unit untuk komposisi jumlah pencatatan, tanpa label pegawai yang keliru. Statistik sanksi memakai HorizontalBarChart integer/scrollable. Kartu Stok membuka TransactionDetailModal berizin di tempat tanpa navigasi dan tanpa aksi pembatalan.

CategoryPieSummary menampilkan pie bersama total dan daftar jenis/jumlah termasuk nol, memakai warna tema yang sama. ContractEndingSummary menyajikan Rekap Akhir Kontrak berupa daftar bulanan berlabel status dan total. Keduanya memakai region scroll berkeyboard dan menyembunyikan scrollbar lokal.

Cuti & Izin memakai donat dengan total pencatatan di tengah dan daftar jenis/jumlah. DonutChart memakai lubang 72%, angka total 30px tebal, label netral 12px, serta total tetap saat hover. Jenis kelamin memakai biru info dan merah brand palette.primary.main; kategori cuti memakai merah brand sebagai warna pertama disertai warna tema lainnya.

Daftar CategoryPieSummary dibatasi lebar 288px dan tinggi scroll 240px; label 12px, jumlah 14px dengan angka tabular, padding kanan aman, nama panjang membungkus. Lebih dari lima jenis menampilkan petunjuk gulir; fokus keyboard dan scroll sentuhan tetap tersedia.

Label pengguna pada donat Cuti & Izin memakai Total cuti & izin dan satuan tooltip cuti/izin. Jumlah tetap menghitung pengajuan/catatan approved per jenis, bukan hari atau pegawai unik.

Rujukan: [File pengujian sementara saat pengembangan](../rules/quality.md#file-pengujian-sementara-saat-pengembangan).

Jadwal Kontrak Berakhir memakai ikon kalender per bulan (netral jika kosong, info jika ada kontrak), jumlah yang menonjol, serta aksi mata 44px dengan tooltip/aria-label. Bulan tanpa kontrak tidak memiliki aksi kosong; daftar tetap dapat digulir dan diakses keyboard.

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
