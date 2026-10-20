# Dashboard Pegawai dan Inventaris

Ketentuan navigasi dan izin pada dua bagian pertama adalah acuan terkini; uraian perubahan historis di bagian bawah menjelaskan keputusan lama sebelum submenu Dashboard diterapkan.

Dashboard tetap tujuan login. Jika satu ringkasan tersedia, menu Dashboard langsung membukanya; jika lebih dari satu, Dashboard membuka submenu **Ringkasan Kepegawaian**, **Ringkasan Pribadi**, dan/atau **Inventaris** sesuai izin. URL tiap ringkasan adalah `/dashboard/staff`, `/dashboard/personal`, dan `/dashboard/inventory`. `/dashboard` memilih tujuan berizin (Pegawai mendahulukan ringkasan pribadi); tautan lama `?tab=inventory` diarahkan ke Inventaris bila berizin. Ringkasan Kepegawaian merangkum data pegawai organisasi dan disembunyikan jika tidak ada bagian kepegawaian yang boleh dibaca. Ringkasan Pribadi tersedia untuk Pegawai, HRD, atau Pimpinan yang profilnya tertaut. Semua role memakai header identitas yang sama di atas konten, tanpa PageHeader dashboard terpisah. Akun tanpa profil tertaut tidak diberi informasi kepegawaian buatan. Pemilih organisasi Superadmin tetap tersedia pada ringkasan terkait.

Ikon seluruh menu dan submenu sidebar memakai `@iconify/react/dist/offline` dengan data SVG lokal `app/components/icons/localIconData.mjs`; SVG tersedia sejak HTML awal dan tidak ada permintaan ke API Iconify saat runtime. Katalog nama semantik dan sumber ikon berada di `navigationIconSources.mjs`. Seluruh ikon navigasi memakai Solar bold-duotone (two-tone terisi) sesuai makna menu. Ikon Dashboard utama bergerak dengan skala halus berulang, berhenti saat hover/fokus, dan ditukar dengan ikon statis saat `prefers-reduced-motion`. Setelah memilih/mengubah ikon, cukup simpan nama Iconify di katalog; `npm run dev` memperbarui data lokal otomatis dan `npm run build` membuat ulang data sebelum kompilasi. `npm run icons:check` memeriksa kesesuaian tanpa mengubah file; uji sidebar tanpa koneksi jaringan. Ikon lokal tidak otomatis membuat halaman/API SITOU berfungsi offline.

## API pribadi

`GET /api/dashboard/employee_self` tersedia bagi Pegawai, HRD, atau Pimpinan berprofil tertaut dengan permission `employees.read_self`. Migration 062 memberi grant baca pribadi untuk HRD/Pimpinan tanpa izin administrasi tambahan. Target selalu organisasi dan user dari session; query target ditolak. Rincian cuti/izin, sanksi dan file melalui mode pribadi juga memeriksa kepemilikan profil serta menolak draft. Respons memuat `profile`, `employment`, serta `assignment`/`contract` menurut permission self terkait. Tidak ada NIK, alamat, rekening, dokumen, uraian kasus atau data Pegawai lain. Foto menggunakan endpoint `profile_self`. Kontrak membaca periode aktif yang berlaku, fallback histori terakhir non-draft/non-cancelled; tanpa periode tidak membuat data kosong palsu.

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

Tab berada setelah header profil bersama. Draft tidak dikirim API dashboard. Pegawai memiliki akses cepat ke bagian informasi pribadi yang sudah berizin. Grafik area penuh memakai empat warna yang sama dengan ringkasan dan ikon transaksi terbaru. Label bulan disingkat pada layar kecil.

Dashboard Inventaris: tab memakai garis bawah. Stok menipis/habis memakai kartu produk horizontal yang dapat digeser dengan keyboard/sentuhan; transaksi bulanan berupa daftar jenis dan jumlah di atas kartu ringkasan. Tooltip aktivitas memakai tanggal lengkap, sumbu area menyisakan ruang puncak dan ujung label.

Catatan pemeliharaan: runner pengujian otomatis dan folder tests dihapus atas keputusan proyek. Uraian pengujian di atas menjadi acuan pemeriksaan; perintah pengujian lama tidak tersedia. Gunakan lint, build, dan smoke test di lingkungan terpisah untuk perubahan berikutnya.

Pemeriksaan izin browser dipusatkan di ProtectedShell: saat navigasi, setiap 20 detik untuk akun organisasi pada tab terlihat, serta saat fokus/visibilitas kembali. Event pasif berdekatan digabung dengan jeda minimal 2 detik; request yang berjalan tidak diduplikasi. Respons `/api/access/me` membawa `scopeRevision` stabil dari mode/daftar lokasi HRD dan paket/cakupan gudang Inventaris; nilainya hanya untuk mendeteksi perubahan UI, bukan otorisasi. Saat cakupan berubah, konten dan modal lama ditutup segera, isian belum disimpan dilepas, dan halaman berizin dimuat ulang termasuk Dashboard walau daftar bagiannya sama. Ringkasan Kepegawaian tidak memakai interval sendiri: data dimuat saat halaman dibuka, melalui tombol Muat ulang, atau ketika bagian/cakupan yang diizinkan berubah. Pencabutan seluruh hak menyembunyikan halaman dan menjalankan pengalihan. Backend tetap memeriksa izin dan cakupan pada setiap request fitur.

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

HorizontalCarousel menggeser satu kartu ke kiri setiap 4,5 detik hanya jika data melebihi lebar panel. Akhir daftar tersambung ke awal tanpa animasi mundur. Scrollbar disembunyikan; sentuhan, scroll horizontal, panah 44px dan ArrowLeft/ArrowRight tetap tersedia. Pada mobile (<600px), satu kartu memenuhi lebar area dan scroll snap merapikan posisi setelah digeser. Tidak ada tombol jeda/jalankan. Hover dan fokus menjeda sementara; sentuhan, scroll manual dan tombol panah memberi waktu baca 9 detik sebelum rotasi otomatis dapat berlanjut. Auto berhenti saat tab/panel tidak terlihat, foto diperbesar, atau prefers-reduced-motion aktif. Satu kartu atau daftar yang seluruhnya muat tidak menampilkan kontrol maupun autoplay. Salinan visual untuk loop tersembunyi dari pembaca layar dan tombol fotonya tidak masuk urutan Tab.

Grafik area memakai gradasi muda yang diturunkan dari warna seri melalui adapter bersama. Stop gradasi bersifat opaque agar tumpukan seri tidak mencampurkan biru dengan oranye menjadi abu-abu. Garis, legenda dan tooltip tetap mengikuti warna seri yang sama; grafik batang tidak berubah.

Urutan bagian Inventaris: pilihan Gudang, kartu ringkasan berizin (Stok di bawah minimum, Stok habis, Transaksi bulan ini, Penyaluran bulan ini), lalu panel Stok perlu diisi kembali dan rincian Transaksi bulan ini. Urutan sama pada desktop/mobile; grid kartu tetap mengikuti ukuran layar dan izin.

## Transaksi terbaru

RecentInventoryTransactions menampilkan maksimal lima transaksi resmi dari DTO yang sudah berizin sebagai kartu dengan aksen jenis, shadow token tema dan hover ringan. KindMark/AppIconTile dipakai ulang; override tone hanya untuk menyamakan biru Pengembalian dan ungu Stok opname dengan legenda Dashboard. Setiap kartu memisahkan jenis/status/jumlah jenis barang, Tanggal transaksi, Gudang, Disimpan oleh (ActorIdentity dengan pas foto privat dan jabatan), serta tombol Lihat detail. Desktop/tablet memakai ikon mata 44px dengan tooltip, mobile di bawah 768px memakai ikon dan teks. Transaksi dibatalkan memakai status dan aksen merah tanpa menyembunyikan identitas atau angka asal. Desktop empat bagian sejajar, tablet dua kolom, mobile satu kolom dengan divider tipis serta tombol 44px selebar kartu. Reduced motion menonaktifkan efek terangkat. Tombol membaca GET /api/inventory/transactions/:id dengan organizationId dan private/no-store, lalu membuka TransactionDetailModal yang sama langsung di Dashboard tanpa navigasi. Endpoint tetap memeriksa izin transaksi serta scope gudang. Loading/error memakai komponen bersama, klik ganda dicegah, request dibatalkan saat komponen dilepas/organisasi berubah. Modal Dashboard tidak menerima onCancel. Menutup modal mempertahankan URL dan posisi gulir. Data, filter organisasi/gudang, serta urutan tetap sama.


## Redesign ruang kerja Pegawai (059)

Dashboard Pegawai menampilkan sapaan, tanggal organisasi, banner profil brand, status/jenis/Divisi & Unit, empat kartu ringkasan sesuai izin, akses cepat ke section pribadi, serta penempatan dan kontrak. Kartu saldo menampilkan seluruh jenis bersaldo dengan Hak/Terpakai/Sisa dan satuan masing-masing. Saldo yang belum memiliki entitlement tetap null; jenis tanpa saldo tidak diberi angka palsu. Ringkasan cuti disetujui berdasarkan tahun tanggal mulai; menunggu meliputi seluruh pengajuan submitted. Daftar dibatasi lima terbaru menurut ID, filter status hanya berlaku pada lima data itu. Rincian memakai AppModal pada Dashboard. Pengajuan baru dan koreksi tetap melalui HRD; tidak menambahkan workflow pengajuan/approval mandiri.

Migration 059 memberi `leave_requests.read_self` dan `disciplinary_actions.read_self` hanya kepada role employee. API existing menolak semua parameter target; repository selalu memetakan employee dari organization_id dan user_id session. DTO menghilangkan bagian tanpa permission. Satu query ringkasan mengambil saldo ledger, hitungan cuti, serta lima sanksi resmi terbaru tanpa draft, lampiran, alasan, catatan internal atau uraian kasus. Sanksi aktif diperiksa tanggal mulai/akhir dalam timezone organisasi; yang belum mulai berlabel Belum mulai dan yang sudah lewat Berakhir. Tidak ada perubahan saldo atau status domain akibat render.

Navigasi seluruh role kini menampilkan organisasi dan lokasi utama di sidebar. TopMenu memakai avatar privat + nama depan/terakhir + jabatan, fallback username/role; menu Profil/Keluar dan lifecycle logout tetap sama. SubscriptionAccessCard memindahkan masa akses dari topbar/banner ke bawah sidebar/drawer, dengan label status, tanggal Indonesia, sisa hari dari server, serta Perpanjang akses yang hanya menampilkan Coming soon. Masa tenggang memakai tanggal tenggang; kartu tidak muncul untuk platform tanpa organisasi. Menu dan kartu tetap dapat digulir pada viewport pendek.

Verifikasi perubahan: schema bootstrap serta migration idempotent di database sementara; ledger grant/carryover/usage/restoration, saldo belum tersedia, draft, periode sanksi, scope akun/organisasi, permission ditolak dan EXPLAIN ANALYZE BUFFERS. UI diuji desktop/mobile dengan data synthetic melalui intersepsi API; akun, perpanjangan, filter dan modal. File uji sementara dibersihkan setelah selesai.


## Penyederhanaan Dashboard Pegawai

Header profil bersama dipakai oleh seluruh role pada tab Dashboard dan Inventaris. Profil pegawai yang tertaut menampilkan status dan jenis kepegawaian dari kontrak yang berlaku atau histori terakhir, tanpa chip role akun. DashboardMetric menjadi komponen kartu angka bersama HRD/Inventaris/Pegawai, mendukung value + unit, parts untuk tahun/bulan, dan progress pemakaian. Kartu sisa cuti memilih satu jenis dengan jatah; jika hak tahunan sudah ada, angka berasal dari ledger. Jika belum ada hak tahunan tetapi aturan memberi jatah positif, kartu menampilkan jatah dari aturan sebagai informasi awal dan menjelaskan bahwa saldo resmi dibuat saat cuti pertama disimpan. Jenis dan satuan tidak dijumlahkan. Pilihan jenis yang tersedia berada selebar kartu di atas angka.

Banner menampilkan nama lengkap, NIP yang diperjelas, status dan jenis pegawai. Jabatan/divisi dan atasan langsung berada di Penempatan saya. Tanggal akhir mengikuti requires_end_date master jenis pegawai, termasuk modal kontrak.

EmployeeLeavePanel menggantikan akses cepat, saldo terpisah dan informasi kepegawaian berulang. Daftar lima terbaru memakai tab dengan jumlah dalam lima data tersebut, ikon brand, tanggal/durasi, status, serta panah. Hak/Terpakai/Sisa jenis terkait tersedia di modal detail melalui LeaveBalanceFields. Baris membuka LeaveDetailModal yang sama dengan menu operasional, berisi alasan, penempatan pada awal izin, pencatat, keputusan, pembatalan dan lampiran berizin. Saldo pada modal adalah posisi tahun dashboard saat ini, bukan saldo historis pada tanggal izin.

Endpoint GET /api/dashboard/leave_self/:id menolak parameter query dan permintaan orang lain/organisasi lain/draft. Pegawai, HRD, dan Pimpinan berprofil tertaut memakai mode pribadi yang mengunci employee.user_id dan organization_id dari sesi. Endpoint file dalam mode pribadi hanya membuka leave_attachment dengan permission read_self, kepemilikan employee dan relasi permintaan nondraft yang cocok; scan, audit preview/download, CSP dan private/no-store tetap berjalan.


Verifikasi penyederhanaan: ESLint pada komponen/service/route terkait; build produksi; browser 320, 375, 768, 1366 dan 1920 px; buka rincian tanpa pindah halaman; saldo terisi/belum ditetapkan; modal saldo; kontrak bertanggal akhir/tanpa tanggal akhir; API sendiri dan penolakan target lain/query. Authorization lampiran diuji dengan tabel temporer PostgreSQL sintetis untuk organisasi lain, pegawai lain, draft, file tanpa relasi, kategori salah dan permission dicabut. Tanggal pada rincian menggunakan timezone organisasi agar konsisten dengan ringkasan. Seluruh artefak uji sementara dibersihkan.


## Penyederhanaan tiga kartu dan rincian disiplin pribadi

Kartu Menunggu HRD dihapus, sehingga grid desktop berisi tiga kartu. Masa kerja menampilkan tahun, bulan dan hari hasil age pada tanggal organisasi, dengan pasangan angka/satuan berjarak dan dapat membungkus. Daftar Cuti & izin saya langsung menampilkan tab Semua/Menunggu/Disetujui serta baris terbaru; tidak ada blok saldo atau penjelasan HRD. Saldo tetap ada di modal detail jika jenisnya memiliki saldo. Ikon navigasi menggunakan chevron bersama.

EmployeeDisciplinePanel berada di kolom kiri setelah cuti. Kartu memisahkan nama/status dari periode berlaku dan tombol Lihat detail. Modal memakai DisciplineCaseDetailModal bersama. Endpoint discipline_self memeriksa permission, organisasi, pegawai dari sesi dan keberadaan tindakan nondraft sebelum membaca rincian, mengecualikan catatan internal, serta mengaudit pembacaan. Surat memakai endpoint file privat dengan pemeriksaan pemilik dan relasi tindakan resmi; draft, file tanpa relasi dan pegawai/organisasi lain ditolak. Perubahan ini tidak menambah permission HRIS generik maupun mengubah schema.

Verifikasi perubahan tiga kartu: build produksi dan ESLint berhasil; browser 320–1920 px tanpa overflow, tab Menunggu, penghapusan blok saldo/keterangan HRD, dan pembukaan modal kasus tanpa navigasi berhasil. Pemeriksaan API pribadi dan isolasi kasus/surat dengan tabel PostgreSQL temporer mencakup pemilik, organisasi lain, draft, file tanpa relasi dan pencabutan permission. Artefak uji sementara dibersihkan.


## Saldo pilihan, masa kerja ringkas dan riwayat sanksi

Saldo memakai EmployeeBalanceMetric dan DashboardMetric. Nama jenis yang sedang tampil menjadi judul kartu, tanpa diulang di bawahnya; tahun tidak ditampilkan pada teks tersendiri. Indikator penuh membedakan jatah awal "Jatah tahun ini belum digunakan" dari saldo resmi "Saldo tahun ini belum digunakan"; jumlah pemakaian ditampilkan hanya bila ada. Satu jenis tampil langsung; beberapa jenis digeser dengan sentuhan/mouse atau panah keyboard, serta titik navigasi kecil yang dapat dipilih. Bila ada beberapa jenis, kartu berganti otomatis tiap 5 detik; jeda saat kursor berada di kartu, fokus keyboard aktif, tab atau kartu tidak terlihat. Pergantian berlanjut setelah kursor meninggalkan kartu atau fokus keyboard keluar. Pengurangan animasi menonaktifkan autoplay. Titik dibuat dekat indikator dengan jarak aman; tidak ada dropdown atau panah visual. Nama, angka, satuan, keterangan, dan indikator warna selalu berubah bersama jenis yang tampil. DTO saldo menyertakan is_active; hanya jenis aktif yang menggunakan saldo dan sesuai jenis kelamin profil menjadi pilihan. Penyimpanan lokal memakai akun dan organisasi, dengan fallback memori ketika storage diblokir. Pilihan tidak valid kembali ke jenis berhak saldo pertama menurut nama; tidak ada agregasi antarjenis/satuan. Tidak tersedia berbeda dari hak belum ditetapkan, nol dan negatif. Jenis nonaktif dan jenis yang tidak lagi sesuai profil tetap dapat dibaca pada histori. Tanpa tombol jeda permanen, carousel otomatis ini belum memenuhi WCAG 2.2.2.

personalPresentation.mjs memvalidasi tanggal dan bagian masa kerja; hanya bagian positif ditampilkan. Hari pertama tampil sebagai teks dan nilai hilang tidak dianggap nol. Banner menggunakan foto 96px desktop atau 80px mobile dengan pembungkus putih 3px.

DisciplineHistoryList dipakai dashboard (lima terbaru) dan AppModal riwayat (10 per halaman), dengan summary aktif, nama/status/periode/chevron. GET /api/dashboard/discipline_self hanya menerima cursor dan mengembalikan items, active, total, next. SQL memfilter organisasi/user/nondraft, mengurutkan issued_date/id menurun; cursor bertanda HMAC mengikat user, organisasi dan versi urutan. Permission dibaca ulang setiap request. Detail tetap memakai endpoint self dan modal bersama; status belum mulai juga konsisten di detail. Riwayat disembunyikan saat detail tampil lalu posisi, halaman dan fokus dikembalikan. Error dapat dicoba ulang, request dibatalkan saat ditutup/unmount. Tidak ada migration baru.

Verifikasi saldo/riwayat: browser 320–1920 px tanpa overflow, pilihan saldo tersimpan setelah reload, jenis hari/jam, saldo belum ditetapkan/nol/negatif, nama panjang, modal detail tunggal, pemulihan fokus/halaman, error dan coba lagi. PostgreSQL temporer dengan 23 tindakan resmi membuktikan keyset 10/10/3 tanpa duplikasi dan penolakan cursor lintas akun/organisasi/tamper. Fokus isi modal dipulihkan setelah pagination agar Escape bekerja saat tombol halaman berikutnya nonaktif.


## Layout terbaru: profil bersama dan sidebar ringkas

Header sambutan Pegawai dihapus. EmployeeProfileBanner dipindah ke DashboardWorkspace sebelum tab Dashboard/Inventaris; data employee_self dimuat satu kali pada workspace dan diteruskan sebagai dashboardState ke EmployeeDashboard. Pada Inventaris role Pegawai, header halaman tambahan disembunyikan sehingga urutannya profil → tab → konten. Role administratif mempertahankan konteks halaman Inventaris, dengan judul Dashboard Inventaris tanpa sambutan.

DashboardMetric menjadi flex column: keterangan/sparkline berada di bagian bawah secara default; kartu saldo dengan progress mempertahankan keterangan di atas indikator. Status sanksi memakai kolom terpisah align center bersama ikon dan chevron. Aksi Riwayat dan modal daftar dihapus dari UI; klik baris tetap membuka detail kasus dengan guard self dan surat berizin yang sama.

SidebarContent hanya memiliki satu scroll container. Menu bertambah sesuai submenu tanpa terpotong oleh footer tetap. SubscriptionAccessCard diringkas dengan ikon kunci akses, judul/status sebaris, tanggal/sisa hari pada baris berikutnya, tombol Perpanjang akses 44px; keterangan panjang dihapus. Grace/active, tanggal dan perhitungan sisa hari tetap berasal dari session server.

Verifikasi layout terbaru: profil mendahului tab pada Dashboard dan Inventaris, perpindahan tab tidak menambah request employee_self, header sambutan/tombol Riwayat tidak tampil, detail kasus tetap terbuka, status ikon/panah sejajar tengah, keterangan dua kartu sejajar bawah. Browser 320–1920 px tanpa overflow; drawer 375×500 dapat menggulir sampai submenu terakhir dan tombol Perpanjang akses. Kartu masa akses diukur kurang dari 190px, notifikasi Coming soon berhasil. Tab menyelaraskan URL melalui history.replaceState agar workspace tidak dimuat ulang oleh navigasi server.

Ikon masa akses menggunakan alias semantik subscription:access yang dipetakan ke perisai bercentang (SafetyCertificateOutlined) melalui AppIcon bersama. Ukuran 18px pada tile 30px menjaga keterbacaan tanpa menyerupai ikon pencarian.

Jumlah sanksi aktif pada Sanksi & teguran ditampilkan melalui description DataPanel tepat di bawah judul, tanpa kotak pemberitahuan terpisah. Baris pertama tidak menambah garis di atas divider header agar pembatas tetap tipis dan rapi.

Kartu Masa kerja/Sanksi aktif memakai varian balanced DashboardMetric: header dan ikon di atas, angka responsif 26–34px pada area tengah flex, keterangan di bawah divider tipis. Render angka/satuan memakai MetricValue yang sama dengan layout standar. Kartu jatah/sisa cuti memakai nama jenis sebagai judul yang dapat membungkus baris tanpa berbenturan dengan ikon. Indikator bawah menunjukkan persentase jatah yang masih tersedia, termasuk jatah awal dari aturan: penuh hijau, sebagian terpakai kuning, tersisa maksimal 25% merah. Keterangan angka menjelaskan pemakaian bila ada sehingga warna bukan satu-satunya petunjuk. Browser 320–1920 px perlu memverifikasi tinggi kartu, footer sejajar, dan wrapping untuk masa kerja panjang serta kondisi nol.
