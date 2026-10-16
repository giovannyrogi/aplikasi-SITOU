# Dashboard Pegawai dan Inventaris

Dashboard tetap halaman login. Tanpa Inventaris berizin, navigasi tab tidak ditampilkan. Dengan akses, tab Dashboard dan Inventaris memakai URL `?tab=inventory`; default Dashboard. HRD/Pimpinan/platform tetap menggunakan dashboard sebelumnya.

## API pribadi

`GET /api/dashboard/employee_self` hanya role Pegawai dengan permission `employees.read_self`. Target selalu organisasi dan user dari session; query target ditolak. Respons memuat `profile`, `employment`, serta `assignment`/`contract` menurut permission self terkait. Nama/NIP/pas foto, penempatan utama berlaku, jenis/status/masa kerja dan periode kontrak saja. Tidak ada NIK, alamat, rekening, dokumen, sanksi atau data Pegawai lain. Foto menggunakan endpoint `profile_self`. Kontrak membaca periode aktif yang berlaku, fallback histori terakhir non-draft/non-cancelled; tanpa periode tidak membuat data kosong palsu.

## API Inventaris

`GET /api/dashboard/inventory?organizationId=...&warehouseId=...&trendPeriod=year|month|week`. Organisasi dikunci session kecuali Superadmin yang wajib memilih eksplisit. Filter positif divalidasi; gudang aktif pada lokasi operasional dalam union izin tersedia. Scope tiap section tetap terpisah:

| Section | Permission | Data |
|---|---|---|
| `stock` | `inventory.stock.read` | low/empty/sufficient, perhatian maksimal 10 |
| `transactions` | `inventory.transactions.read` | jumlah/jenis, grafik area tahun/bulan/minggu, terbaru maksimal 5 |
| `distribution` | `inventory.reports.read` | jumlah penyaluran dan lima lokasi terbanyak |

Respons membawa `sections`, `unavailable`, `warehouses`, `period`, `generatedAt`, `errors`. Section tanpa izin tidak ada dalam DTO. Filter gudang di luar scope salah satu section menyebabkan section itu tidak dikirim dan ditandai unavailable, tanpa memperluas scope. Kegagalan query satu section memuat pesan aman dan requestId pada errors, section lain tetap berjalan. Modul nonaktif atau semua izin tidak tersedia menghasilkan 403. Seluruh respons private/no-store, tanpa cache payload bersama.

## Angka dan grafik

- Stok membaca `STOCK_SOURCE_SQL` yang sama dengan Stok Barang: barang–gudang aktif dengan histori, < minimum Di bawah minimum, 0 Habis, >= minimum Cukup. Histori kosong dikecualikan. Urutan perhatian Habis, rasio stok/minimum terkecil, nama/ID deterministik. Tidak ada agregasi kuantitas antar-satuan.
- Grafik kondisi stok menghitung pasangan barang–gudang, bukan barang unik lintas gudang.
- Aktivitas bulan organisasi mulai tanggal 1 sampai hari ini. Kartu dan rincian tetap bulan ini. Grafik memakai trendPeriod: year (default, Januari sampai Desember), month (tanggal), week (Senin sampai Minggu dengan hari dan tanggal). Grafik tahun mengisi bulan tanpa transaksi, termasuk bulan mendatang, dengan 0 agar garis mencapai Desember. Nilai ini menunjukkan belum ada transaksi tercatat, bukan prediksi. Grafik bulan dan minggu juga mengisi tanggal tanpa transaksi sampai akhir periode dengan 0. Semua area memakai kurva smooth dan isian transparan dari adapter bersama seperti grafik HRD. Menghitung dokumen receipt/issue/return/stocktake resmi tanpa pembatalan; opening/reversal dikecualikan.
- Penyaluran menghitung dokumen issue yang tidak dibatalkan sampai akhir periode, sama dengan aturan Distribusi Barang. Grafik tujuan menghitung transaksi, bukan nilai pembelian/jumlah barang campuran.
- Draft tidak masuk angka stok/statistik resmi. Filter tidak memberi akses tambahan.

## Verifikasi

prosedur verifikasi fitur

prosedur verifikasi fitur membuat dan membersihkan database uji terpisah, server sementara port 3004, data synthetic dan screenshot. Membuktikan profile self, payload berbeda pada scope sama, scope berbeda per section, modul/izin dicabut, angka/stock source, query plan, tab/link/keyboard dan lebar 320–1920. Tidak mengubah database aktif atau menyalakan server development port 3000.

Schema dan grant historis tetap; tidak ada migration baru. UI tidak menambahkan absensi, pengajuan, prediksi/valuasi persediaan, approval atau aset.

Tab berada setelah PageHeader. Dashboard Pegawai dan Dashboard Inventaris memakai judul eksplisit. Draft saya dan Akses cepat tidak ditampilkan; draft tidak dikirim API dashboard. Grafik area penuh memakai empat warna yang sama dengan ringkasan dan ikon transaksi terbaru. Label bulan disingkat pada layar kecil.

Dashboard Inventaris: tab memakai garis bawah. Stok menipis/habis memakai kartu produk horizontal yang dapat digeser dengan keyboard/sentuhan; transaksi bulanan berupa daftar jenis dan jumlah di atas kartu ringkasan. Tooltip aktivitas memakai tanggal lengkap, sumbu area menyisakan ruang puncak dan ujung label.

Catatan pemeliharaan: runner pengujian otomatis dan folder tests dihapus atas keputusan proyek. Uraian pengujian di atas menjadi acuan pemeriksaan; perintah pengujian lama tidak tersedia. Gunakan lint, build, dan smoke test di lingkungan terpisah untuk perubahan berikutnya.

Pemeriksaan izin browser dipusatkan di ProtectedShell: saat navigasi, setiap 8 detik untuk akun organisasi pada tab terlihat, serta saat fokus/visibilitas kembali. Event pasif berdekatan digabung dengan jeda minimal 2 detik; request yang berjalan tidak diduplikasi. Dashboard memakai snapshot konteks shell tanpa fetch access/me sendiri. Backend tetap memeriksa izin pada setiap request fitur.

## Statistik HRD: Cuti & Izin dan Sanksi

Di bawah Distribusi Divisi & Unit dan Kontrak berakhir per bulan terdapat pie Cuti & Izin tahun ini serta batang horizontal Sanksi tahun ini. Endpoint summary memakai section leave/discipline yang sudah ada; query dan proyeksi respons memeriksa izin masing-masing dan cakupan penempatan utama. Pegawai tidak menerima statistik organisasi ini.

Cuti & Izin menghitung pencatatan approved per jenis yang periodenya beririsan dengan awal tahun sampai hari ini, memakai timezone organisasi. Tidak menjumlahkan hari/jam dan tidak menghitung draft, ditolak, atau dibatalkan. Sanksi menghitung tindakan resmi (bukan pegawai unik) berdasarkan issued_date dari awal tahun sampai hari ini, memakai nama jenis snapshot. Histori berakhir, digantikan, atau dicabut tetap dihitung; draft dikecualikan. Tidak mengirim uraian, alasan, surat, atau identitas pegawai dalam dataset grafik.

Jadwal Kontrak Berakhir menunjukkan jumlah kontrak aktif yang akan berakhir per bulan mulai hari ini sampai akhir bulan ke-12. Perlu ditinjau tetap daftar prioritas individual untuk 30 hari mendatang. Setiap bulan pada jadwal dapat dibuka ke laporan sesuai izin.

Detail transaksi dari Kartu Stok dibuka melalui TransactionDetailModal pada halaman Stok Barang tanpa navigasi, tanpa aksi pembatalan. Endpoint detail tetap memeriksa inventory.transactions.read dan scope gudang. Menutup detail mempertahankan Kartu Stok beserta filter dan paginasi.

Cuti & Izin kini menyertakan seluruh jenis aktif organisasi (0 jika belum digunakan), serta jenis nonaktif yang masih memiliki pencatatan approved dalam periode dan scope. Rincian jenis/jumlah selalu tampil; grafik kosong tidak menyembunyikan daftar jenis. Panel Sanksi menggunakan section sanctions khusus izin disciplinary-actions-report; akses Data Pegawai saja tidak membuka statistik laporan sanksi. Rekap Akhir Kontrak mengganti batang dengan jumlah dokumen per bulan dan rincian status, tanpa mengubah periode atau sumber hitungan.

Visual Cuti & Izin menggunakan donat, bukan lingkaran penuh; total pencatatan di tengah dibuat tebal dan tetap terlihat saat hover. Daftar jenis/jumlah tetap di samping pada desktop dan di bawah pada ponsel. Warna pertama merah SITOU, pendamping memakai token tema.

Jadwal Kontrak Berakhir menggantikan rekap histori kontrak: jumlah kontrak aktif yang telah mulai, pegawai aktif/probation/suspended, bertanggal akhir mulai hari ini menurut timezone organisasi sampai akhir bulan kalender ke-12. Query dashboard dan laporan memakai buildReportQuery yang sama dengan contractStatus=active; kontrak draft, dibatalkan, berakhir, diperpanjang, tanpa tanggal akhir, serta pegawai final tidak dihitung. Setiap bulan menampilkan jumlah kontrak akan berakhir. Lihat pegawai hanya tersedia bagi akun berizin laporan Kontrak Akan Berakhir, mempertahankan organisasi dan rentang bulan. Tidak memakai label Aktif/Selesai atau diperpanjang pada panel jadwal.

Jadwal Kontrak Berakhir memakai kalender brand merah untuk bulan dengan data. Ikon mata membuka ContractEmployeesModal di dashboard, memakai API laporan yang sama dan filter bulan/organisasi/status aktif. Modal memakai AppModal, ResponsiveDataView, DataPagination cursor, ReportIdentity/ReportRemaining, dan ImagePreviewModal untuk pas foto. Pemeriksaan izin laporan tetap di backend; menutup modal mempertahankan halaman serta posisi dashboard.

## Stok perlu diisi kembali

Panel memakai StockAttentionCard: status Stok segera habis/Stok habis, foto privat, barang, gudang, angka Stok tersedia dan Batas minimum. Status kartu, aksen atas, serta Stok tersedia memakai warna brand SITOU dengan permukaan merah muda ringan; shadow/hover mengikuti token tema. Kartu ringkasan serta legenda kondisi stok tetap memakai istilah Di bawah minimum. Label Stok segera habis pada kartu produk berarti stok di bawah minimum, bukan perkiraan waktu habis. Perhitungan dan urutan perhatian dari server tetap sama, maksimal 10 pasangan barang-gudang.

HorizontalCarousel menggeser satu kartu ke kiri setiap 4,5 detik hanya jika data melebihi lebar panel. Akhir daftar tersambung ke awal tanpa animasi mundur. Scrollbar disembunyikan; sentuhan, scroll horizontal, panah 44px dan ArrowLeft/ArrowRight tetap tersedia. Hover menjeda sementara; fokus, sentuhan, scroll manual dan tombol panah menjeda sampai Jalankan slide otomatis dipilih. Tombol Jeda tersedia ketika animasi diizinkan. Auto berhenti saat tab/panel tidak terlihat, foto diperbesar, atau prefers-reduced-motion aktif. Satu kartu atau daftar yang seluruhnya muat tidak menampilkan kontrol maupun autoplay. Salinan visual untuk loop tersembunyi dari pembaca layar dan tombol fotonya tidak masuk urutan Tab.

Grafik area memakai gradasi muda yang diturunkan dari warna seri melalui adapter bersama. Stop gradasi bersifat opaque agar tumpukan seri tidak mencampurkan biru dengan oranye menjadi abu-abu. Garis, legenda dan tooltip tetap mengikuti warna seri yang sama; grafik batang tidak berubah.

Urutan bagian Inventaris: pilihan Gudang, kartu ringkasan berizin (Stok di bawah minimum, Stok habis, Transaksi bulan ini, Penyaluran bulan ini), lalu panel Stok perlu diisi kembali dan rincian Transaksi bulan ini. Urutan sama pada desktop/mobile; grid kartu tetap mengikuti ukuran layar dan izin.

## Transaksi terbaru

RecentInventoryTransactions menampilkan maksimal lima transaksi resmi dari DTO yang sudah berizin sebagai kartu dengan aksen jenis, shadow token tema dan hover ringan. KindMark/AppIconTile dipakai ulang; override tone hanya untuk menyamakan biru Pengembalian dan ungu Stok opname dengan legenda Dashboard. Setiap kartu memisahkan jenis/status/jumlah jenis barang, Tanggal transaksi, Gudang, Disimpan oleh (ActorIdentity dengan pas foto privat dan jabatan), serta tombol Lihat detail. Desktop/tablet memakai ikon mata 44px dengan tooltip, mobile di bawah 768px memakai ikon dan teks. Transaksi dibatalkan memakai status dan aksen merah tanpa menyembunyikan identitas atau angka asal. Desktop empat bagian sejajar, tablet dua kolom, mobile satu kolom dengan divider tipis serta tombol 44px selebar kartu. Reduced motion menonaktifkan efek terangkat. Tombol membaca GET /api/inventory/transactions/:id dengan organizationId dan private/no-store, lalu membuka TransactionDetailModal yang sama langsung di Dashboard tanpa navigasi. Endpoint tetap memeriksa izin transaksi serta scope gudang. Loading/error memakai komponen bersama, klik ganda dicegah, request dibatalkan saat komponen dilepas/organisasi berubah. Modal Dashboard tidak menerima onCancel. Menutup modal mempertahankan URL dan posisi gulir. Data, filter organisasi/gudang, serta urutan tetap sama.
