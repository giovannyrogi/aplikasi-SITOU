# Rancangan Persediaan & Stok dan Manajemen Aset SITOU

Status: tahap 1–2 menyediakan akses fitur, aktivasi organisasi, serta master
Barang Persediaan/Kategori Barang/Satuan Barang/Gudang, foto privat opsional, dan batas minimum.
Transaksi/saldo stok, kartu stok, laporan operasional, permintaan/approval serta
Manajemen Aset belum diimplementasikan.

Pembaruan keputusan: 9 Oktober 2026. Pengembangan pertama berfokus pada
Persediaan & Stok; Manajemen Aset tetap pengembangan berikutnya.

## Keputusan tahap pertama

- Divisi penanggung jawab dapat berbeda antar organisasi; akses tidak otomatis mengikuti nama divisi.
- Persediaan & Stok menangani stok gudang, penerimaan, penyaluran, pengembalian,
  koreksi, stok opname, kartu stok, peringatan minimum, dan laporan distribusi.
- Permintaan antar divisi tetap manual. Pengelola mencatat penyaluran langsung,
  dengan gudang asal, lokasi dan Divisi & Unit tujuan, jumlah aktual, serta penerima.
- Dokumen permintaan, bukti pembelian, foto barang, dan foto serah terima opsional.
- Riwayat distribusi tidak menunjukkan sisa stok divisi tanpa pencatatan pemakaian
  atau penghitungan fisik. Jangan mengklaim sisa barang di divisi dari penyaluran saja.
- Excel LOGISTIK STOK dan kartu stok manual menjadi referensi pendataan barang.
  Stok awal harus dihitung dari kondisi nyata, bukan dianggap nol.
- Gudang, kategori, satuan, konversi kemasan, dan stok minimum fleksibel per organisasi.

## Pengembangan berikutnya

Manajemen Aset menangani barang jangka panjang yang dilacak per unit fisik:
kode aset, kondisi, lokasi, penanggung jawab, perpindahan, garansi, dan perawatan.
Penerimaan barang dapat menjadi sumber pencatatan aset; jangan menghitung barang
yang sama dua kali. Klasifikasi serta divisi pengelola mengikuti kebijakan organisasi.
Pengajuan online, persetujuan, pemakaian/saldo divisi, dan akuntansi aset memerlukan
diskusi lanjutan sebelum diterapkan.

## Model akses yang disepakati

Satu akun, satu profil pegawai tertaut sesuai aturan akun yang berlaku, satu role
dasar per organisasi, dan beberapa paket akses per organisasi. Tautan profil
tetap wajib untuk Pegawai; HRD/Pimpinan mengikuti aturan tautan opsional yang ada.
Jangan membuat akun ganda untuk profil yang sama. Role dasar bukan role global
yang otomatis memberikan kewenangan pada seluruh organisasi. Dukungan perpindahan
organisasi/session mengikuti kemampuan sistem dan memerlukan rancangan tersendiri.

- HRD tetap memperoleh permission administrasi HRD dari role dan scope yang berlaku.
- Pegawai memperoleh akses dasar Pegawai; paket menambahkan permission khusus modul.
- HRD juga dapat menerima paket Persediaan jika bertugas mengelola stok.
- Paket merupakan kumpulan permission tindakan, bukan paket langganan/komersial.
  Paket Persediaan tidak memberikan permission HRD atau Superadmin.
- Modul aktif pada organisasi dan pemberian paket kepada akun merupakan dua
  pengaturan terpisah. Modul aktif tidak otomatis membuka akses semua akun.
- Setiap pemberian paket memiliki scope sendiri. Pengelola Persediaan untuk
  Gudang Bersehati dapat digabung dengan Lihat Saja Persediaan untuk Gudang Pusat.
  Permission dan gudang harus diperiksa sebagai pasangan; jangan menggabungkan
  seluruh permission dengan seluruh gudang sehingga akses meluas tanpa sengaja.
- Gudang berada dalam satu organisasi dan terhubung ke lokasi operasional.
  Satu lokasi dapat memiliki beberapa gudang; stok dan transaksi setiap gudang terpisah.
- Penempatan pegawai dapat menjadi saran awal, tetapi tidak otomatis memberikan
  akses gudang. Mutasi penempatan tidak boleh diam-diam memperluas scope paket.
- Akses dapat mencakup satu, beberapa, atau seluruh gudang secara eksplisit.
  Scope kosong tidak berarti akses seluruh gudang.

### Pemberi akses

Superadmin mengaktifkan modul yang tersedia untuk organisasi serta mengatur
paket akses akun melalui tindakan lintas organisasi yang eksplisit dan diaudit.
HRD yang memiliki izin kelola akses dapat memberikan/mencabut paket saat membuat
atau mengedit akun dalam organisasinya, hanya untuk modul aktif dan paket/scope
yang boleh didelegasikannya. Tidak boleh memberikan Superadmin, meningkatkan
kewenangan sendiri, atau melampaui batas delegasi. Matriks permission delegasi
harus ditetapkan sebelum implementasi.

Seluruh API, laporan, export, dan akses lampiran memeriksa permission serta scope
di backend. Perubahan/pencabutan akses diaudit dan berlaku pada request berikutnya;
session/cache tidak boleh mempertahankan hak yang telah dicabut. Hak self-service
Pegawai tetap terpisah dari hak pengelola Persediaan.

Pola pemisahan role, permission, dan scope sejalan dengan model aplikasi seperti
[Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/sysadmin/role-based-security)
dan [ERPNext](https://docs.frappe.io/erpnext/user-permissions). Batas satu role dasar
ditambah paket merupakan keputusan desain SITOU, bukan ketentuan universal produk tersebut.

## Navigasi yang disepakati

Keputusan navigasi terbaru: Data Master memuat **Barang Persediaan**, **Kategori
Barang**, **Satuan Barang**, dan **Gudang** sebagai halaman terpisah. Inventaris
memuat **Stok Barang** dan **Transaksi Barang**; Laporan memuat **Distribusi Barang**.
Setiap submenu memakai permission fitur dan scope organisasi yang sama; parent
hanya tampil bila ada anak berizin. Tidak ada tab Katalog & Gudang lagi.
Tombol tambah berada pada header, filter organisasi Superadmin pada toolbar daftar.
Wajib memilih satu organisasi; Dashboard Pegawai menampilkan ringkasan profil sendiri; tab Inventaris mengikuti izin. Lihat `docs/dashboard-workspace.md`.

Kartu Stok nantinya berada di detail satu barang pada satu gudang, menampilkan
masuk, keluar, dan saldo setelah setiap transaksi. Distribusi Barang merangkum
penyaluran lintas transaksi menurut periode, barang, gudang, dan divisi/unit tujuan.
Keduanya berasal dari transaksi yang sama, bukan pencatatan terpisah. Laporan
distribusi tidak membuktikan sisa stok divisi. Pencatatan dari Stok Barang dan
Transaksi Barang kelak menyusun form/use case yang sama.

## Urutan pengembangan Persediaan & Stok

### Tahap 1 — Fondasi akses untuk Persediaan

Petakan evaluator permission, session, scope, akun, file, audit, dan menu yang ada.
Susun matriks permission serta rancangan migration paket akses organisasi, lalu
implementasikan akses Lihat Saja, Pengelola Gudang dan Pengelola Master Inventaris beserta delegasi
HRD/Superadmin. Pertahankan akses HRD/Pimpinan/Pegawai yang sudah berjalan.
Bangun fondasi yang dapat diperluas, tetapi hanya aktifkan permission Persediaan.
Tidak membuat paket, tabel bisnis, atau menu Manajemen Aset pada tahap ini.

Kriteria selesai: akun Pegawai dengan paket hanya mendapat tindakan yang diizinkan
pada organisasi/gudangnya; akun tanpa paket ditolak; gabungan paket tidak memperluas
scope tanpa sengaja; pencabutan efektif; audit tersedia; isolasi organisasi dan
regresi akses HRD/self-service lulus pengujian.

Implementasi tahap 1:

- Katalog `access_modules`, `access_packages`, `access_package_permissions`;
  aktivasi `organization_modules`; grant `user_access_packages` dan
  `user_package_warehouse_scopes`; master `inventory_warehouses`.
- Modul awalnya nonaktif, tanpa grant otomatis. Superadmin mengaktifkan lewat
  aksi **Kelola fitur** pada Data Master → Organisasi, lalu menyiapkan gudang.
- Superadmin memberikan paket kepada HRD/Pimpinan/Pegawai. HRD tetap hanya
  mengelola akun Pegawai sesuai service akun saat ini. Permission delegasi berasal
  dari role HRD, tidak memerlukan paket pengelolaan stok. HRD scope selected hanya
  mendelegasikan gudang di lokasi yang diizinkan dan tidak dapat memberikan all.
- Paket Lihat Saja membaca halaman operasional tanpa menu master. Pengelola Gudang
  bekerja dalam scope gudang; Pengelola Master Inventaris mengelola katalog/metadata gudang bersama organisasi. Tidak ada izin transaksi
  atau approval sebelum fiturnya dikembangkan. Self-service tetap terpisah.
- Scope selected wajib berisi gudang aktif pada pemberian baru; all eksplisit
  mencakup gudang baru. Penempatan tidak menjadi sumber scope paket. Gudang nonaktif
  tetap dibaca/dipulihkan melalui Data Master, tetapi tidak dipilih untuk grant baru.
- Kode gudang uppercase unik per organisasi; lokasi berasal dari master existing.
  Lokasi terkunci setelah gudang direferensikan scope selected atau all. Tidak ada
  penghapusan fisik gudang; penonaktifan dikonfirmasi dan diaudit.
- Perubahan akun/grant atomik dengan version check. Field `packageAccess` yang
  dihilangkan saat edit mempertahankan grant; array kosong mencabutnya. Scope lama
  di luar kewenangan HRD tidak boleh diubah olehnya, tetapi dapat dipertahankan
  ketika field lain dikoreksi. Paket tetap tersimpan ketika role dasar berubah.
- Modul dinonaktifkan tanpa menghapus paket/gudang; reaktivasi memulihkan grant
  yang masih berlaku. Backend membaca grant terbaru pada setiap request. Sidebar
  diperbarui saat navigasi, focus, dan event perubahan akses.
- Migration 045–046 dan schema referensi harus diterapkan bersama web. Uji bootstrap,
  upgrade migration, HTTP/DB, dan browser memakai database sintetis terpisah melalui
  prosedur verifikasi fitur; database uji dibersihkan otomatis.

### Tahap 2 — Melengkapi master barang

Gunakan organisasi, lokasi, dan Divisi & Unit yang sudah ada sebagai referensi.
Siapkan gudang, kategori barang, satuan dasar, katalog barang, status aktif,
foto barang opsional, serta stok minimum per barang per gudang. Barang habis
pakai menjadi fokus; nomor seri, penyusutan, dan perawatan aset belum termasuk.
Konversi kemasan hanya ditambahkan jika alur penerimaan/penyaluran memerlukannya.
Stok awal berasal dari penghitungan nyata, dengan tanggal acuan dan audit.

### Tahap 3 — Transaksi, dilanjutkan Kartu Stok

Implementasikan pencatatan stok awal, penerimaan pembelian, dan penyaluran ke
lokasi/Divisi & Unit, berikut penerima, tanggal, jumlah, dan catatan. Bukti pembelian,
dokumen permintaan, dan foto serah terima tetap opsional. Permintaan tetap manual;
pengelola langsung mencatat penyaluran tanpa workflow approval baru.

Kartu stok menampilkan masuk, keluar, saldo, sumber/tujuan, pelaku, dan referensi
transaksi. Transaksi terposting tidak ditimpa/dihapus; koreksi melalui pembatalan
beralasan atau transaksi koreksi yang diaudit. Pengembalian dan stok opname
melengkapi koreksi kondisi fisik. Cegah saldo negatif dan pengeluaran bersamaan
yang melampaui stok. Jangan menyediakan edit angka saldo langsung.

### Tahap 4 — Pemantauan dan laporan

Tampilkan stok tersedia dan indikator Habis/Menipis/Aman dengan label serta warna.
Laporan mencakup kartu stok, penerimaan, dan distribusi berdasarkan tanggal,
barang, gudang, lokasi dan Divisi & Unit tujuan, dengan pagination, total, export,
serta lampiran berizin. Riwayat penerimaan barang oleh divisi membantu meninjau
permintaan berulang; tidak menunjukkan sisa barang atau menyimpulkan penyalahgunaan.

### Tahap 5 — Uji dan penerapan terbatas

Uji transaksi bersamaan, retry, pembatalan, hitungan saldo, scope gabungan paket,
isolasi organisasi, lampiran opsional/privat, pencabutan akses, backup/pemeliharaan
file, dan UI mobile/desktop. Uji dengan gudang serta barang contoh sebelum memasukkan
stok awal nyata dan menjalankan operasional. Manajemen Aset dibahas terpisah nanti.

## Fondasi implementasi nanti

Ledger stok append-only menjadi sumber saldo. Posting, pembatalan, dan saldo
harus atomik, idempotent, diaudit, serta aman dari pengeluaran bersamaan/stock minus.
Gunakan organization_id dan composite FK, permission backend serta scope eksplisit.
Lampiran memakai stored_files privat, antivirus, dan lifecycle transaksional, serta
harus dikenali pemeliharaan file dan backup. Semua perubahan schema melalui
migration dan pembaruan schema referensi. Daftar/laporan memakai pagination,
total sesuai filter/scope, dan ekspor yang diaudit.

## Kontrak API tahap 1

### Uji coba pengguna

1. Superadmin membuka Data Master → Organisasi → menu aksi → Kelola fitur,
   kemudian mengaktifkan Inventaris pada organisasi target.
2. Superadmin membuka Data Master → Gudang, memilih organisasi pada filter, lalu
   menekan Tambah gudang.
3. HRD membuka Akun & Akses → Akun Organisasi dan menambah/mengedit akun Pegawai.
   Isi Akses fitur serta gudang dalam kewenangannya. Superadmin juga dapat
   memberikan paket melalui halaman yang sama.
4. Login memakai akun Pegawai. Dashboard tetap kosong; Inventaris menampilkan
   menu sesuai izin pada Data Master, Inventaris, dan Laporan. Lihat Saja hanya membaca; Pengelola Gudang bekerja dalam scope;
   Pengelola Master Inventaris mengelola master serta membuat gudang.
5. Cabut paket atau nonaktifkan modul, lalu pastikan API/page langsung ditolak
   dan sidebar diperbarui ketika kembali fokus/navigasi.

### Endpoint

Istilah UI adalah **Fitur**, bukan Paket: Fitur organisasi, Fitur Inventaris,
Akses fitur, dan Fitur dan izin. Pilihan izin ditampilkan sebagai Fitur Inventaris
— Lihat Saja/Pengelola Gudang/Pengelola Master Inventaris. Kode/tabel paket dan payload API tetap kompatibel. Daftar
organisasi menyediakan `active_features` dari konfigurasi organisasi di server;
kolom/kartu Fitur aktif menampilkan labelnya atau Belum ada fitur tambahan.
Gudang dibuat di Data Master → Gudang oleh Superadmin atau
Pengelola Master Inventaris, sebelum digunakan pada pilihan akses.

- `GET /api/access/me`: permission menu efektif dan kemampuan membuat gudang;
  tidak menjadi sumber authorization backend atau token login.
- `GET/PATCH /api/access/modules`: organisasi eksplisit, Superadmin, modul
  Inventaris (`isEnabled`, `version`); absent record berarti nonaktif, versi 0.
- Endpoint akun/reference-options existing menambahkan paket dan pilihan gudang
  dalam kewenangan actor. `packageAccess` memakai `{packageCode,scopeMode,warehouseIds}`.
- `GET/POST /api/inventory/warehouses` dan `PATCH /api/inventory/warehouses/:id`:
  DTO gudang berizin, pagination+total; `options=1` mengembalikan pilihan lokasi
  untuk form. Mutation memakai validasi bersama, organisasi server, scope, audit,
  request ID, serta versi integer gudang.
- Halaman master persediaan pada `/master-data/inventory-*`, `/inventory/stock`,
  `/inventory/transactions`, dan `/reports/inventory-distribution` dijaga server.
  Stok, request, approval, dan aset belum mempunyai API pada tahap ini.

## Tahap 2 — Master Persediaan (9 Oktober 2026)

Halaman Barang Persediaan, Kategori Barang, Satuan Barang dan Gudang sudah operasional, dengan pencarian,
status, pagination/total, tambah/edit, version check, konfirmasi nonaktif dan audit.
Superadmin memilih organisasi pada filter; petunjuk tampil pada header.
Tautan /inventory/master-data dan /inventory/catalog diarahkan ke master baru.

Katalog dan metadata gudang bersama diubah Superadmin/Pengelola Master Inventaris.
Pengelola Gudang tidak membuka master; pengaturan minimum dan operasional tetap
mengikuti scope grant gudang yang sesuai.
Kategori/satuan/kode terisolasi per organisasi. Satuan dapat memakai pecahan sampai
3 desimal, sementara satuan bulat menolak pecahan. Aturan pecahan dan satuan dasar
terkunci setelah dipakai. Data nonaktif tetap dibaca, bukan dihapus.

Foto opsional memakai file privat, scan, MIME dan hash; pemilihan hanya preview
lokal, penyimpanan mengikuti commit barang. Rollback menghapus byte baru; foto
lama yang diganti/dilepas masuk antrean purge transaksional. Registry pemeliharaan
serta backup melindungi referensi foto termasuk barang nonaktif. Tidak ada object
key dikirim ke browser; preview /api/uploads/:fileId memeriksa fitur dan referensi.

API /api/inventory/catalog/:kind (items/categories/units) mendukung list/create,
PATCH /:kind/:id, dan options=1; pengaturan gudang GET/PUT
/api/inventory/catalog/items/:id/warehouses memakai versi per barang-gudang.
minimumStock adalah batas peringatan, bukan saldo. Migration 047–048 diperlukan.
Daftar barang mengembalikan `warehouse_limits` hanya untuk gudang dalam cakupan baca
pengguna, sehingga batas minimum terlihat di kartu katalog desktop dan mobile.
Kartu menampilkan foto privat atau ikon tanpa foto, nama/kode, kategori, satuan,
status, dan batas minimum per gudang; batas bukan saldo stok. Filter katalog memakai
section filter bersama untuk nama/kode, status, lokasi, gudang, barang belum didaftarkan,
dan rentang nilai minimum. Filter dijalankan pada SQL sebelum paginasi dan dibatasi
cakupan gudang actor; ID gudang di luar cakupan ditolak. Barang tanpa tautan dalam
cakupan gudang yang dapat dilihat dianggap belum didaftarkan bagi akun tersebut.
Katalog menampilkan kartu langsung tanpa panel tabel atau paginasi visual. Halaman
berikutnya dimuat otomatis saat mendekati akhir viewport, dengan tombol muat berikutnya
sebagai cadangan; filter mereset daftar dari awal. Angka minimum bulat tidak dipaksa
menampilkan tiga desimal, sementara pecahan hingga tiga digit tetap dapat dimasukkan.
Setelah pengaturan disimpan, daftar dimuat ulang; gudang yang tidak berizin tidak
boleh muncul pada ringkasan maupun modal rincian batas.
Konversi kemasan, peringatan saldo nyata, kartu stok,
permintaan/approval, laporan operasional serta aset tetap tahap berikutnya.

## Arahan prasyarat dan tautan lama

Modal Barang menampilkan petunjuk dekat Kategori/Satuan ketika belum ada pilihan
aktif: siapkan melalui Data Master → Kategori Barang/Satuan Barang → Tambah.
Gudang memerlukan lokasi aktif; pengguna tanpa izin Lokasi meminta HRD/Superadmin.
Pemilih gudang menjelaskan ketiadaan gudang dalam cakupan, bukan seluruh organisasi.
Arahan singkat mengikuti AGENTS.md, disertai tautan berizin, konteks organisasi,
loading navigasi, dan konfirmasi bila isian belum disimpan.

Canonical master: /master-data/inventory-items, /master-data/inventory-categories,
/master-data/inventory-units, /master-data/inventory-warehouses. Laporan:
/reports/inventory-distribution. /inventory/catalog dan /inventory/master-data
redirect menurut tab lama (default items); /inventory/reports redirect ke laporan
baru. Hanya organizationId positif valid yang dipertahankan. API/database tidak
berubah. Penataan ini tidak mengimplementasikan saldo/transaksi/Kartu Stok/laporan.

### Satuan tanpa kode input dan chip master persediaan

Satuan Barang tidak meminta atau menampilkan kode. API menerima kode opsional untuk
kompatibilitas klien lama; create tanpa kode membuat kode internal UUID di server,
edit tanpa kode mempertahankan nilai lama. Tidak ada perubahan schema atau backfill.
Nama satuan wajib dan unik per organisasi; konflik ditampilkan pada field nama.
Kode barang/kategori/gudang tampil sebagai CompactInfoChip tone info di bawah nama
pada kolom identitas yang sama dan pada kartu mobile. Kategori, satuan, aturan
pecahan, dan status memakai chip semantik yang sudah tersedia; nama dan uraian
bebas tetap teks agar penanda penting tidak tenggelam dalam terlalu banyak chip.

## Penyesuaian tingkat akses (9 Oktober 2026)

Fitur Inventaris — Lihat Saja (kode inventory_reader) tidak membuka empat master
Inventaris, termasuk melalui URL langsung. Stok/Transaksi/Distribusi tetap dapat
dibuka tanpa mutasi; isi operasionalnya masih tahap pengembangan berikutnya.
Fitur Inventaris — Pengelola boleh menambah/edit/nonaktifkan barang, kategori,
dan satuan bersama organisasi meskipun memilih gudang tertentu. Perubahan ini
berlaku untuk seluruh katalog organisasi; bukan membuat katalog per gudang.
Gudang terpilih hanya boleh dikelola sesuai grant; gudang baru memerlukan all.
Form menampilkan penjelasan kemampuan dan batas scope dekat field. Migration 049
mencabut inventory.master.read dari paket reader tanpa menghapus grant lama.

## Pemisahan master dan operasional — migration 050

- Lihat Saja (inventory_reader): baca Stok Barang/Transaksi Barang/Distribusi Barang, scope gudang all/selected; tidak membuka atau mengubah master.
- Pengelola Gudang (inventory_manager): izin operasional gudang serta minimum barang-gudang dalam scope all/selected. Tidak CRUD katalog/metadata gudang, termasuk scope all. Migration 054 menambahkan pencatatan dan pembatalan transaksi dalam gudang yang diizinkan. Stok awal, masuk, keluar, pengembalian, dan stok opname memakai riwayat `inventory_stock_movements` yang sama; draft tidak mengubah stok. Kartu Stok dan laporan pemantauan tetap tahap berikutnya.
- Pencatatan Transaksi Barang memakai `AppModal` empat tahap (jenis, detail, barang, periksa). Tombol Catat transaksi memulihkan draft aktif terakhir milik petugas/organisasi tanpa menampilkan daftar draft; draft Pegawai tetap terpisah. Draft memakai checkpoint saat Lanjut, Kembali, Simpan draft & tutup, atau finalisasi, bukan autosave per perubahan field; penutupan menunggu simpan berhasil. Pengguna dapat membuang draft aktif dan mulai ulang di modal. Pemilihan jenis lain baru meminta konfirmasi ketika Lanjut ditekan dan isian lama ada; isian dikosongkan hanya setelah pengguna setuju dan checkpoint jenis baru berhasil. Lampiran lama dibersihkan saat jenis baru tersimpan. Seluruh dropdown wizard dapat dicari dengan ketikan; footer dan tombol konfirmasi menempati satu baris masing-masing dengan lebar penuh pada ponsel. Dua area unggah yang berurutan dan area unggah terakhir terhadap footer memiliki jarak aman. Lampiran draft disimpan privat serta dibersihkan saat draft dibuang/kedaluwarsa (migration 056). Pilihan jenis pada tahap pertama dan ledger berbagi label, ikon, serta warna yang sama. Riwayat hanya berisi transaksi terposting, berbentuk ledger responsif padat per dokumen dengan kolom Status setelah Dicatat oleh, ikon jenis ringkas, dan cursor 10/20/50 baris per halaman (awal 20), diurutkan menurut waktu pencatatan terbaru. Pencarian dan dropdown yang bisa diketik berada dalam section filter bersama; toolbar pencarian/muat ulang terpisah tidak digunakan. `DataPagination` menampilkan total hasil filter dari server. Satu tanggal di baris adalah Tanggal transaksi; waktu pencatatan tetap tersedia di detail audit. Bukti pembelian baru memakai JPEG/PNG/WebP maksimal 5 MB; PDF lama tetap terbaca berizin.
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

## Metadata lampiran transaksi

Respons upload `POST /api/inventory/transactions/:id/draft-files` dan daftar
lampiran pada detail transaksi memuat `id`, `purpose`, `name`, `mimeType`, serta
`sizeBytes`. MIME berasal dari pemeriksaan byte server; ukuran berasal dari
metadata file yang disimpan. Preview memakai `/api/uploads/:fileId` berizin.
Komponen upload bersama mendukung kontrak ini dan metadata Kepegawaian tanpa
menentukan jenis file dari nama/ekstensi. Foto barang memakai pilihan lokal
hingga Simpan barang; lampiran transaksi disimpan ke draft privat.

## Tahap Stok Barang (12 Oktober 2026)

Stok Barang kini menampilkan persediaan per barang–gudang, foto privat, kategori,
satuan, lokasi, saldo, minimum, dan kondisi stok. Filter mencakup nama/kode,
gudang berizin, kategori, kondisi, dan status aktif/nonaktif. Superadmin memilih
organisasi pada filter; akun organisasi memakai session. Tidak ada stok awal
ditampilkan Belum dicatat, stok awal nol Habis, saldo positif di bawah minimum
Di bawah minimum, dan saldo lain Cukup.

Kartu Stok dibuka melalui detail barang–gudang, bukan submenu baru. Pergerakan
masuk/keluar dan saldo berjalan berasal dari ledger yang sudah ada; urutan
tanggal dan ID pergerakan sama dengan validasi transaksi. Filter tanggal tidak
menghilangkan saldo sebelum periode. Pembatalan tetap terlihat sebagai pembalik.
Tombol rincian membuka transaksi yang terkait melalui parameter transactionId
dan authorization endpoint detail yang sama. Draft tidak mengubah stok.

GET /api/inventory/stock memakai inventory.stock.read dan scope gudang.
Filter: organizationId, warehouseId, categoryId, search, condition, status,
pageSize (10/20/50), cursor. Respons: data, total, nextCursor, kemampuan perubahan,
serta referensi gudang/kategori berizin. action=history memerlukan warehouseId
dan itemId; menerima from/to dan mengembalikan rows, opening_balance,
closing_balance, total, nextCursor, dan kemampuan membaca transaksi.
Cursor terikat filter dan scope; seluruh respons private, no-store.

Pengelola Gudang dapat mengubah minimum menggunakan API/use case yang sudah
ada, dengan version dan audit, tanpa mengubah saldo. Lihat Saja tidak mendapat
aksi perubahan. Pengelola Master tetap tidak otomatis mendapat operasional.
Catat transaksi memakai wizard yang sama dan memulihkan draft petugas.
Thumbnail pada tahap barang wizard dapat diperbesar; input jumlah terkunci
hingga barang dipilih. Tidak diperlukan migration atau perubahan schema.
Distribusi Barang, request/approval, dan aset tetap tahap lanjutan.

## Perapian transaksi dan perkiraan stok

Form baru menggunakan Tambah transaksi barang, tombol final Simpan transaksi,
serta Simpan draft & tutup untuk checkpoint. Nomor referensi memakai satu kolom
dari grid dua kolom desktop; pada barang keluar bersebelahan dengan penerima.
Tombol hapus sejajar dengan control barang/jumlah. Data jumlah dan saldo memakai
InventoryQuantityChip agar angka dan satuan terbaca utuh pada ponsel.

Detail transaksi mengembalikan photo_file_id pada setiap baris barang untuk
thumbnail privat dan ImagePreviewModal. Lampiran dokumen mendahului foto; gambar
tidak menampilkan nama fisik/file, hanya petunjuk memperbesar di tengah bawah.

POST /api/inventory/transactions/preview menerima kontrak transactionSchema,
memerlukan inventory.transactions.create pada gudang yang sama. Endpoint berbagi
prepareStockChanges dengan finalisasi tanpa mengubah aturan perhitungan.
DTO memuat occurredOn, asOf, serta lines: itemId, name, unit, quantity, delta,
beforeDate, afterDate, currentBefore, currentAfter. Simulasi memakai urutan
occurred_on,id dengan baris hipotetis setelah seluruh pergerakan pada tanggalnya,
menolak stok negatif di tanggal berikutnya, dan tidak menulis data transaksi.
Stok opname bertanggal sebelumnya memakai delta terhadap saldo pada tanggal
tersebut; currentAfter ikut memperhitungkan perubahan sesudahnya.

Tahap Periksa dan pemulihan draft memuat perkiraan server. Angka merupakan
perkiraan berdasarkan keadaan saat pemeriksaan; penyimpanan selalu memvalidasi
ulang karena petugas lain dapat memproses transaksi. Tidak diperlukan migration.

## Pengembalian ke gudang — alur penyaluran terkait

Alur mengikuti prinsip Material Return: terhubung ke penyaluran yang sudah terjadi,
barang asal tampil otomatis, pengguna mengisi jumlah yang benar-benar kembali.
Referensi: [Zoho Inventory Material Return](https://www.zoho.com/us/inventory/help/material-return/material-return.html).
SITOU memakai cakupan organisasi/gudang yang sudah ada, tanpa alur penjualan,
refund, approval, nomor otomatis baru, atau gudang tujuan berbeda.

1. Pilih Pengembalian ke gudang.
2. Pilih gudang dan Transaksi penyaluran sebelumnya. Tanggal barang diterima
   kembali default hari ini dari waktu organisasi; ubah hanya untuk kejadian pada
   tanggal lain. Tanggal sebelumnya memerlukan alasan agar kronologi stok dapat
   diperiksa. Lihat detail transaksi membuka daftar barang/jumlah sumber.
3. Semua barang tampil otomatis, tanpa tombol tambah/ganti/hapus. Isi jumlah
   dikembalikan, default sisa maksimal yang belum kembali (sesuai pembaruan UX), dan dapat diedit menjadi 0. Angka 0 tidak masuk
   transaksi resmi. Status barang nonaktif atau sudah seluruhnya kembali terlihat
   dan input terkunci. Draft mempertahankan seluruh baris dan jumlah yang diisi.
4. Periksa barang/jumlah positif dan perkiraan stok; simpan menggunakan guard
   transaksi dan audit yang sama. Source/qty/cakupan diperiksa ulang saat commit.

GET /api/inventory/transactions/:id/return-options?organizationId=&warehouseId=
mengembalikan detail penyaluran, today, dan lines dengan returnedQuantity,
remainingQuantity, canReturn, balance, allows_fractional, serta metadata foto/satuan.
Memerlukan inventory.transactions.create pada gudang asal dan membaca sumber
melalui guard transaksi berizin. Respons private, no-store. Agregasi jumlah
mengabaikan pengembalian yang dibatalkan, dan lock sumber diambil sebelum query
agregasi baru untuk serialisasi pengembalian serentak. Tidak diperlukan migration.

### Penyempurnaan rincian dan jumlah awal

Detail transaksi mengembalikan destination_location_name, destination_unit_name,
dan recipient_name melalui join yang dibatasi organisasi. Popup penyaluran
menampilkan tanggal, gudang, lokasi/unit tujuan dan Pegawai penerima. Tahap
Periksa menampilkan tanggal penyaluran asal terpisah dari tanggal pengembalian;
occurred_on pada transaksi return tetap tanggal pengembalian fisik ke gudang.

Field penyaluran dan nomor referensi berdampingan pada desktop, satu kolom
mobile. Tautan rincian tanpa ikon, font 12px dan target sentuh 44px. Jumlah awal
pilihan penyaluran baru memakai remainingQuantity, bukan jumlah asal jika
sebagian sudah kembali. Perubahan draft termasuk 0 tetap dipertahankan. Label
input Jumlah (satuan). Riwayat desktop memakai kolom lebih lebar, teks body
tanggal/jenis normal, dan scroll lokal agar data tidak wrap menjadi dua baris.


## Stok awal dan penerimaan terlambat

Lihat `docs/inventory-opening-corrections.md` untuk aturan eligibility, permission koreksi, kontrak API, proyeksi replay bersama, dan rollout legacy. `OpeningCorrectionModal` memakai AppModal, ConfirmDialog, AppNotice dan InventoryQuantityChip; koreksi dari draft hanya menyiapkan perubahan sampai Simpan transaksi. AppIcon mendaftarkan inventory:stock-card, inventory:minimum, inventory:opening-correction.


### Pembagian Stok dan Transaksi Barang

Tambah transaksi hanya berada pada Transaksi Barang. Header Stok Barang tidak menawarkan pembuatan transaksi; halaman ini memantau saldo/indikator, Kartu Stok, minimum dan koreksi stok awal berizin.


### Field administratif menurut jenis transaksi

Stok awal tidak wajib alasan keterlambatan. Barang masuk, keluar, pengembalian dan stok opname sebelum hari ini wajib alasan minimal 10 karakter, sesuai transactionFieldPolicy.mjs bersama UI/backend. Pembatalan dan koreksi tetap wajib alasan tindakan. Nomor dokumen baru hanya pada penerimaan/penyaluran, opsional, dengan label Nomor dokumen penerimaan dan Nomor memo/permintaan. Opening/return/stocktake menyimpan dan menampilkan referensi lama tanpa input baru atau penghapusan diam-diam. Catatan tetap opsional; nomor kosong tidak ditampilkan di ringkasan. Kontrak API referenceNo/lateReason, schema, audit, tanggal dan izin tidak berubah; tidak perlu migration.


### Implementasi Distribusi Barang

Lihat docs/inventory-distribution.md. Distribusi memakai transaksi/line/reversal existing, tanpa migration atau perubahan saldo. DistributionPanel menggunakan DataPanel, ResponsiveDataView, DataPagination, OperationalFilterSection, DashboardMetric, chip, modal dan preview terpusat. TransactionDetailModal/TransactionPresentationParts dipakai bersama dengan Transaksi Barang; onCancel hanya diberikan workspace transaksi berizin, bukan laporan.

Tabel Stok Barang secara default memakai condition=recorded: pasangan barang–gudang dengan riwayat resmi, termasuk stok habis dan transaksi yang dibatalkan. Pilihan Semua barang atau Belum ada transaksi tetap tersedia; stok tanpa riwayat adalah null dan ditampilkan sebagai —. Identitas barang cukup nama/kode, gudang cukup nama. Istilah antarmuka adalah Stok awal/Koreksi stok awal; kode opening, permission, tabel, audit lama dan migration historis tetap kompatibel.

Catatan pemeliharaan: runner pengujian otomatis dan folder tests dihapus atas keputusan proyek. Uraian pengujian di atas menjadi acuan pemeriksaan; perintah pengujian lama tidak tersedia. Gunakan lint, build, dan smoke test di lingkungan terpisah untuk perubahan berikutnya.

Pada tahap Periksa transaksi, Perubahan stok gudang memakai InventoryStockMetric dan AppIconTile yang sama untuk Jumlah, Sebelum, Sesudah, dan Stok saat ini: tile 36px, ikon 18px, tipografi seragam. Jumlah mengikuti warna jenis transaksi, Sebelum netral, Sesudah biru atau merah jika nol. Divider berada sesudah Jumlah dengan gap 16px; padding panel 16px. Tidak mengubah proyeksi atau validasi stok.
