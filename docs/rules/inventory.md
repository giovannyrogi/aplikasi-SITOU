# Aturan Inventaris

Bagian terkait

- [Model akses dan transaksi Persediaan](#model-akses-dan-transaksi-persediaan)
- [Stok awal dan penerimaan terlambat — migration 057](#stok-awal-dan-penerimaan-terlambat--migration-057)
- [Rekap Stok](#rekap-stok)
- [Laporan Distribusi Barang](#laporan-distribusi-barang-1)
- [Kartu mobile Data Master dan Inventaris](#kartu-mobile-data-master-dan-inventaris)

## Inventaris, paket akses, dan cakupan gudang

- Role dasar per membership organisasi tetap berlaku. Paket adalah kumpulan permission fitur, bukan role baru atau paket langganan. Inventaris tidak memberikan akses HRD, platform, atau self-service milik orang lain.

- Aktivasi modul organisasi terpisah dari grant akun; default nonaktif dan tanpa paket otomatis. Modul nonaktif memblokir operasi tanpa menghapus grant/gudang; pengaktifan kembali memulihkan grant yang masih berlaku.

- Permission dan scope diperiksa dari grant yang sama. Dilarang membuat union semua permission dikalikan semua gudang. Scope selected kosong selalu ditolak; all harus eksplisit dan mencakup gudang baru. Penempatan pegawai tidak otomatis memberi atau mengubah scope paket.

- Superadmin mengaktifkan modul dan memberi paket pada akun organisasi secara eksplisit serta diaudit. HRD yang memiliki permission delegasi tetap mengelola akun Pegawai sesuai service akun saat ini, hanya pada organisasi/profil/lokasi yang berizin; selected HRD tidak dapat memberi all atau scope di luar lokasi. Paket sendiri tidak memberi permission delegasi.

- HRD tidak boleh meningkatkan akses sendiri atau mengubah grant lama di luar kewenangannya. Grant yang tidak diubah dapat dipertahankan ketika field akun lain dikoreksi. Akun/profil/membership dan paket disimpan atomik dengan version check; perubahan/pencabutan diaudit dan berlaku pada request berikutnya.

- Sidebar, page, API, daftar, laporan, export, dan file harus memakai pemeriksaan permission/scope server yang sama. Token/browser hanya identitas atau tampilan, bukan sumber hak akses. Jangan melemahkan izin HRIS lama untuk membuka Inventaris.

- Data Master memuat Barang Persediaan, Kategori Barang, Satuan Barang, dan Gudang sebagai halaman terpisah berizin Inventaris. Inventaris hanya memuat Stok Barang dan Transaksi Barang; Laporan memuat Distribusi Barang sesuai permission fitur. Parent tampil bila ada submenu berizin; Pegawai tidak memperoleh akses master/laporan HRIS. Kartu Stok kelak berada di detail barang per gudang pada Stok Barang; pencatatan masuk/keluar memakai use case bersama.

- Tahap 1–2 menyediakan akses, gudang, katalog Barang/Kategori/Satuan, foto privat opsional, dan batas minimum barang-gudang. Halaman stok/transaksi/distribusi disediakan sesuai tahap masing-masing. Dashboard Pegawai mengikuti ketentuan ringkasan pribadi di bawah. Jangan membangun ledger, stok awal, transaksi, request/approval, atau aset pada tahap penataan navigasi ini.

- Katalog barang/kategori/satuan dan metadata gudang digunakan bersama organisasi. Hanya Superadmin atau Pengelola Master Inventaris boleh menambah/edit/nonaktifkan master dan membuat gudang. Pengelola Gudang (all maupun selected) tidak membuka halaman master atau mengubah metadata master. Pengaturan barang/minimum serta operasional stok memakai permission dan scope grant gudang asalnya. Batas minimum bukan saldo stok.

- Foto barang memakai stored_files kategori inventory_item_photo dan folder privat org_{organizationId}/inventaris/foto_barang/{tahun}/{UUID}.{ext}; MIME nyata JPEG/PNG/WebP maksimal 5 MB, scan/hash serta pipeline temp/atomic move yang sama. Simpan hanya saat form barang berhasil, bersihkan byte baru pada rollback, dan antrekan purge foto yang diganti/dilepas secara transaksional. Registry pemeliharaan/backup wajib melindungi foto barang yang masih dirujuk, termasuk barang nonaktif. API foto memeriksa akses Inventaris serta referensi nyata tanpa memberikan permission HRIS generik.

- Master persediaan canonical memakai /master-data/inventory-items|inventory-categories|inventory-units|inventory-warehouses; Distribusi Barang memakai /reports/inventory-distribution. Route lama /inventory/catalog dan /inventory/master-data diarahkan menurut tab, default Barang Persediaan; /inventory/reports diarahkan ke Distribusi Barang. Pertahankan organisasi valid dan pemeriksaan server. Tombol tambah di PageHeader, pemilih organisasi Superadmin di toolbar filter; wajib satu organisasi sebelum membaca/membuat. Gunakan ikon semantik lokal, reusable tabel/kartu/modal, pagination+total. Referensi tidak dihapus fisik; perubahan diaudit dan memakai version. Aturan pecahan/satuan dasar terkunci setelah dipakai.

- Gudang memiliki organisasi/lokasi, kode uppercase unik, status dan versi. Gudang berreferensi tidak dihapus fisik; lokasi terkunci setelah direferensikan paket. Gudang nonaktif tetap dapat dibaca/dipulihkan oleh pengelola berizin tetapi tidak dipilih untuk grant baru atau transaksi stok nanti.

- Kartu stok nantinya menunjukkan masuk/keluar/saldo satu barang-gudang. Distribusi Barang merangkum penyaluran lintas transaksi dan tidak membuktikan sisa stok penerima. Permintaan tetap manual; request, approval, dan pemenuhan kelak memiliki permission terpisah tanpa posting stok dua kali.

- Pada edit akses Inventaris, field packageAccess yang tidak dikirim mempertahankan grant dan array kosong mencabut grant dalam kewenangan actor. Perubahan akun dan grant bersifat atomik dengan version check. Scope lama di luar kewenangan actor tidak boleh diubah, tetapi dapat dipertahankan saat field lain diedit. Paket tetap tersimpan ketika role dasar berubah.

### Arahan prasyarat fitur

- Field/alur yang membutuhkan data lain wajib menjelaskan apa yang diperlukan, menu tempat membuatnya, dan langkah singkat sesuai hak akses pengguna. Gunakan 1–2 kalimat sederhana, dekat field, dengan `FontStyle explanation`; jangan hanya mengandalkan dropdown kosong.

- Tampilkan arahan setelah referensi berhasil dimuat. Bedakan data belum tersedia, nonaktif, hasil pencarian kosong, keterbatasan cakupan, dan kegagalan pemuatan. Jangan menyimpulkan seluruh organisasi kosong dari daftar scope pengguna.

- Tautan prasyarat hanya bagi pengguna berizin, mempertahankan organisasi dan memakai lifecycle loading serta dirty-state warning. Pengguna tanpa izin diarahkan meminta pihak berwenang; field wajib tetap divalidasi. Tidak membuat form bertingkat untuk prasyarat.

### Satuan tanpa kode input dan chip master persediaan

Satuan Barang tidak meminta atau menampilkan kode. API menerima kode opsional untuk
kompatibilitas klien lama; create tanpa kode membuat kode internal UUID di server,
edit tanpa kode mempertahankan nilai lama. Tidak ada perubahan schema atau backfill.
Nama satuan wajib dan unik per organisasi; konflik ditampilkan pada field nama.
Kode barang/kategori/gudang tampil sebagai CompactInfoChip tone info di bawah nama
pada kolom identitas yang sama dan pada kartu mobile. Kategori, satuan, aturan
pecahan, dan status memakai chip semantik yang sudah tersedia; nama dan uraian
bebas tetap teks agar penanda penting tidak tenggelam dalam terlalu banyak chip.

### Tingkat akses Inventaris

- Label akses fitur: Lihat Saja, Pengelola Gudang, Pengelola Master Inventaris. Kode inventory_reader/inventory_manager dipertahankan; kode baru inventory_master. Cakupan selected ditampilkan Pilih Gudang; master selalu organisasi (scope_mode=all, warehouseIds kosong) dan bukan akses operasional seluruh gudang.

- Lihat Saja membuka Stok Barang, Transaksi Barang, dan Distribusi Barang secara baca sesuai scope. Jangan menampilkan master Inventaris; URL langsung master wajib ditolak di server. Metadata baca katalog/gudang tetap dapat digunakan API operasional/file berizin tanpa membuka halaman master.

- Pengelola Gudang (inventory_manager) hanya operasional pada gudang all/selected. Pengelola Master Inventaris (inventory_master) hanya master bersama organisasi; tidak otomatis mempunyai akses stok/transaksi/distribusi atau pengaturan minimum. Satu akun boleh menerima ketiganya, tetap satu role dasar. Menonaktifkan data mempertahankan histori/referensi, bukan menghapus fisik.

- Form pemberian fitur wajib menjelaskan kemampuan pilihan tepat di bawah field serta batas membuat gudang di field cakupan. Role Pegawai/HRD tidak membatasi kemampuan Inventaris yang sah dan tidak memberikan izin otomatis.

- Transaksi Barang memakai `AppModal` empat tahap dengan draft privat yang terpisah dari draft Pegawai. Saat Catat transaksi dibuka, muat draft aktif terakhir milik petugas pada organisasi tersebut; jangan tampilkan area daftar draft. Pengguna dapat melanjutkan atau membuang draft aktif dan mulai ulang dari modal. Ikuti pola checkpoint form Pegawai (Lanjut, Kembali, Simpan draft & tutup, finalisasi), tanpa autosave per ketikan; tutup hanya setelah simpan berhasil. Saat pengguna memilih jenis transaksi lain, jangan langsung mengubah isian; setelah menekan Lanjut, minta konfirmasi jika sudah ada isian, lalu kosongkan isian jenis sebelumnya dan bersihkan lampiran lama pada checkpoint. Semua pilihan dropdown di wizard harus dapat dicari dengan ketikan memakai komponen pilihan bersama. Tombol footer modal dan konfirmasi tersusun satu tombol per baris, lebar penuh, dan berjarak aman pada ponsel. Draft tidak boleh dikirim sebagai bagian API ledger. Ledger terposting memakai `DataPanel` dan `DataPagination` cursor, satu Tanggal transaksi per baris, kolom Status terpisah dari jenis transaksi, ikon jenis yang ringkas, tombol detail ikon berlabel aksesibel, serta baris responsif pada ponsel. Footer menampilkan total hasil filter dan ukuran halaman yang benar dari server. Detail dan lampiran wajib memakai `AppModal`, `AppNotice`, `PrivateFileUpload`, `ImagePreviewModal` untuk gambar, serta `LoadingBackdrop` dan `Notification` sesuai aksi. Gambar pada detail terlihat langsung dalam ukuran memadai dan dapat diperbesar; PDF tampil sebagai item dokumen dengan aksi buka berizin. Jaga jarak aman minimal 24px antara area unggah dan footer modal maupun antara dua area unggah yang berurutan.

- Pilihan jenis transaksi pada wizard dan ledger memakai sumber label/ikon/warna yang sama. Pencarian riwayat berada di `OperationalFilterSection`, bukan toolbar tabel tersendiri; dropdown filternya harus bisa dicari dengan ketikan. Kolom Tanggal transaksi tetap satu baris pada desktop, dan Status berada setelah Dicatat oleh serta sebelum Aksi.

### Delegasi dan kompatibilitas master Inventaris

- Hak master tidak diberikan otomatis kepada akun lama. Migration 050 memindahkan hak metadata/master dari inventory_manager ke inventory_master; grant lama tetap operasional dengan scope asalnya. Berikan fitur master secara eksplisit bila diperlukan.

- Superadmin atau HRD dengan cakupan seluruh lokasi boleh mendelegasikan master kepada akun yang dapat dikelolanya. HRD lokasi terpilih tidak boleh memberi/mengubah/mencabut master organisasi; grant lama yang tidak berubah dapat dipertahankan pada edit field lain.

- Scope master tidak meminta gudang, valid walau gudang belum tersedia. Akses master tidak menjadi referensi scope operasional gudang dan tidak mengunci lokasi gudang sendirian. Kunci dari referensi operasional/histori tetap utuh.

### Stok Barang dan Kartu Stok

- Tahap Stok Barang menggantikan placeholder stok pada tahap awal. Distribusi Barang membaca laporan penyaluran resmi sesuai docs/rules/inventory.md; request/approval/aset belum dikembangkan. Tidak membuat ledger atau saldo kedua.

- Stok dibaca per pasangan barang–gudang dari proyeksi replay bersama serta inventory_stock_balances; stok awal manual terpisah dari keberadaan riwayat. Belum ada riwayat resmi berarti Belum ada transaksi, bukan nol. Setelah riwayat dimulai, saldo nol berarti Habis; saldo positif di bawah minimum berarti Di bawah minimum; nilai lainnya Cukup. Batas minimum bukan saldo.

- Kartu Stok berada pada detail barang–gudang, memakai inventory_stock_projection dan referensi inventory_stock_movements, dengan tanggal efektif dan urutan replay yang sama dengan validasi transaksi. Hitung running balance sebelum filter tanggal/pagination; pembatalan tetap transaksi pembalik. Draft tidak masuk kartu stok. Tautan rincian diperiksa dengan permission transaksi asal gudang.

- Daftar/Kartu Stok memakai permission inventory.stock.read, scope gudang server terbaru, DTO privat, pagination cursor terikat filter/scope, total server, dan komponen tabel/kartu/modal/filter yang sudah ada. Barang/gudang nonaktif tetap tersedia melalui filter untuk pemeriksaan histori, tanpa operasi stok baru.

- Pengaturan minimum hanya dengan inventory.item_warehouses.update pada gudang yang sama, memakai use case/version/audit yang tersedia. Pembuatan transaksi hanya melalui menu Transaksi Barang; Stok Barang fokus pada pemantauan, Kartu Stok, minimum, dan koreksi stok awal, tanpa tombol Tambah transaksi pada header.

- Thumbnail barang menggunakan InventoryItemPhoto dan ImagePreviewModal, mendukung keyboard dan target 44px. Pada wizard jumlah/stok awal terkunci sebelum barang valid dipilih. Memperbesar foto tidak mengubah isian/dirty state.

### Bahasa dan ringkasan transaksi Inventaris

- Gunakan Tambah transaksi untuk membuka form baru, Simpan transaksi untuk finalisasi, dan Simpan draft & tutup untuk draft. Hindari istilah Catat transaksi pada alur pengguna. Status resmi ditampilkan Tersimpan; identifier teknis posted/recorded_at tetap dipertahankan.

- Pilihan transaksi asal menampilkan nomor dokumen bila ada, tanggal, gudang, dan ringkasan barang/jumlah. UUID atau potongannya bukan nomor referensi dan tidak boleh menjadi label pilihan pengguna. Pemilihan barang keluar asal memerlukan gudang terlebih dahulu.

- Nomor referensi berada pada grid dua kolom desktop (sejajar dengan Pegawai penerima pada barang keluar), satu kolom mobile. Tombol hapus baris barang sejajar tengah control pilihan/jumlah, bukan sejajar label.

- Detail transaksi menampilkan foto barang melalui InventoryItemPhoto/ImagePreviewModal. Lampiran dokumen tampil sebelum foto serah terima. Foto tidak menampilkan nama file; petunjuk memperbesar berada di tengah bawah gambar.

- InventoryQuantityChip menampilkan jumlah/stok penting secara utuh dengan font terbaca dan wrap mobile, bukan ellipsis yang menyembunyikan angka. Label membedakan Jumlah masuk/keluar, stok sebelum, stok setelah tanggal transaksi, dan stok gudang saat ini.

- Pada tahap Barang, Barang Masuk/Keluar/Stok opname menampilkan Stok gudang saat ini dan satuan dari saldo server untuk gudang terpilih. Jumlah yang sedang diisi belum termasuk saldo tersebut; perubahan setelah transaksi berada pada tahap Periksa. Stok awal yang belum tersedia tidak boleh diberi angka nol palsu.

- Tahap Periksa wajib memakai perkiraan server melalui POST /api/inventory/transactions/preview. Validasi jumlah/tanggal/pecahan/sumber dan cakupan memakai helper yang sama dengan penyimpanan. Simulasi tidak menulis saldo, ledger, draft, file atau audit transaksi. Data bertanggal sebelumnya menampilkan kedua saldo yang relevan; finalisasi tetap memvalidasi ulang stok terbaru, version dan transaksi atomik. Draft yang dibuka pada tahap Periksa memuat ulang perkiraan, bukan memakai angka lama dari browser.

### Pengembalian ke gudang

- Field transaksi penyaluran sebelumnya memakai lebar satu kolom desktop dan penuh pada mobile. Pengembalian tidak menyediakan input nomor referensi baru; nomor memo asal dapat dibaca pada rincian penyaluran. Label jumlah pada daftar tetap cukup Jumlah (satuan). Tahap Periksa membedakan Tanggal penyaluran sebelumnya dan Tanggal pengembalian ke gudang; tanggal transaksi pengembalian adalah tanggal barang kembali, bukan tanggal sumber atau waktu input.

- Riwayat transaksi memakai lebar kolom desktop yang memadai dan scroll horizontal lokal. Tanggal/nama jenis transaksi pada baris data memakai bobot normal; nama transaksi, gudang dan ringkasan barang tidak wrap pada desktop. Mobile tetap wrap dengan track yang menyusut. Jangan menyembunyikan overflow halaman secara global untuk mempertahankan tampilan dense.

- Ledger utama menampilkan satu baris per transaksi asal; dokumen pembalik pembatalan tetap append-only di database, pergerakan stok, audit, dan Kartu Stok tetapi tidak menjadi baris kedua di ledger utama. Transaksi asal menampilkan status Dibatalkan; modal detailnya menampilkan alasan, pelaku, waktu pembatalan, dan rincian asal. Pagination, filter, total, dan urutan terbaru mengikuti baris yang terlihat; pembatalan memperbarui posisi urutan transaksi asal. Baris ledger membedakan jumlah barang yang dicatat dari perubahan stok dengan tanda dan warna semantik. Untuk transaksi yang dibatalkan, angka perubahan asal tetap terbaca tanpa garis coret, disertai keterangan sederhana bahwa stok sudah dikembalikan. Istilah teknis seperti "dibalik" dan "dampak akhir" tidak dipakai dalam teks UI.

- Pengembalian adalah penerimaan fisik barang dari penyaluran sebelumnya. Label Transaksi penyaluran sebelumnya menggantikan Barang keluar asal; aksi RelatedRecordAction dengan tombol Lihat detail transaksi yang menonjol membuka AppModal berisi tanggal, tujuan lokasi/unit, penerima, serta barang/jumlah penyaluran tanpa mengubah isian.

- Tanggal barang diterima kembali wajib, default hari ini dari database/zona organisasi. Tidak mengambil tanggal penyaluran sebagai tanggal kembali. Tanggal sebelumnya tetap memerlukan alasan input terlambat; batas 30 hari, larangan masa depan, serta larangan tanggal sebelum penyaluran dipertahankan.

- Semua barang dari penyaluran tampil otomatis pada tahap Barang, tanpa tambah/ganti/hapus produk. Jumlah awal berisi sisa maksimal yang masih dapat dikembalikan dari server; pengguna dapat mengurangi atau mengisi 0 untuk barang yang tidak kembali. Tampilkan jumlah disalurkan, sudah kembali, dan maksimal tersisa dari server. Barang nonaktif/seluruhnya kembali tetap terlihat dengan input terkunci dan petunjuk.

- Draft menyimpan semua baris; preview/finalisasi hanya mengirim jumlah positif. Jangan mengasumsikan semua barang dikembalikan atau mengubah saldo dengan baris 0. Pemulihan draft mempertahankan jumlah lama dan mengambil ulang batas terbaru.

- Batas pengembalian selalu dihitung server per baris sumber. Lock transaksi penyaluran sebelum query agregasi dengan snapshot baru untuk menghindari pengembalian serentak berlebih. Pembatalan pengembalian yang sah mengembalikan batas tersebut; histori dan audit tetap utuh.

- Daftar transaksi sumber memiliki pencarian dan pagination dropdown agar penyaluran lama tidak terpotong pada halaman pertama. Endpoint return-options memeriksa organisasi, scope gudang, modul/session aktif, dan permission transaksi; tidak membuka hak HRIS atau master.

### Stok awal, koreksi dan replay Inventaris (057)

- Stok awal hanya sebelum riwayat resmi barang–gudang dimulai. Penerimaan pertama boleh tanpa stok awal, dimulai dari nol tanpa dokumen stok awal palsu. Riwayat yang sudah dibatalkan tetap menghalangi stok awal baru. Eligibility berasal dari backend dan diperiksa ulang preview/commit.

- Koreksi tanggal/jumlah stok awal append-only, wajib alasan minimal 10 karakter, preview/version/fingerprint/konfirmasi/audit. Gabungan koreksi+penerimaan wajib atomik; isian draft tidak diubah otomatis. Tanggal stok awal pada/sebelum operasi pertama; tidak menebak jumlah sebenarnya.

- Koreksi hanya Superadmin atau paket Koreksi Stok Awal eksplisit disertai Pengelola Gudang pada gudang yang sama. Pemberi paket hanya Superadmin/admin HRD penuh; scope koreksi tidak lebih luas dari manager. Grant tidak otomatis untuk akun lama atau master.

- Replay BigInt tiga desimal bersama untuk preview/post/cancel/correction dan proyeksi stok/kartu/minimum. Hasil fisik stok opname tetap, delta dan reversal memakai efek replay. Tolak negatif historis dan retro pada hari stocktake yang sama. Dokumen/ledger asal immutable.

- Pesan error wajib satu penyebab pasti, dengan barang/gudang/tanggal/angka faktual dan fieldErrors. Jangan memakai diagnosis dengan beberapa kemungkinan. Status commit tidak pasti diverifikasi melalui UUID sebelum retry, bukan notifikasi gagal yang diasumsikan.

- Saldo legacy tidak berubah diam-diam. Dry-run, laporan selisih, persetujuan, fingerprint dan aktivasi atomik diaudit wajib sesuai docs/rules/inventory.md. Migration mencerminkan bootstrap dan diuji pada database terpisah.

- Aksi Kartu Stok/Atur minimum/Koreksi memakai AppIcon semantik terdaftar, tema info/secondary/warning, tooltip/aria/44px. Jangan memakai fallback tanda tanya.

### Field administratif Transaksi Barang

- transactionFieldPolicy.mjs adalah sumber bersama form/backend untuk kewajiban alasan terlambat dan metadata nomor dokumen. Stok awal tidak meminta alasan keterlambatan, meskipun tanggal acuannya sebelum hari ini. Barang masuk, keluar, pengembalian dan stok opname bertanggal sebelumnya tetap wajib alasan minimal 10 karakter. Batas 30 hari, larangan masa depan dan audit tidak berubah.

- Input nomor dokumen hanya untuk Barang masuk (Nomor dokumen penerimaan, opsional) serta Barang keluar (Nomor memo/permintaan, opsional). Stok awal, pengembalian, stok opname tidak menawarkan input nomor referensi baru. Kontrak referenceNo dipertahankan; nilai draft/dokumen lama tidak dihapus karena field disembunyikan, ditampilkan sebagai informasi tersimpan. Nomor penyaluran asal tidak disalin menjadi nomor pengembalian baru.

- Ringkasan tidak menampilkan placeholder nomor referensi kosong. Pembatalan dan koreksi stok awal tetap wajib alasan tindakan, termasuk jika dilakukan hari ini. Catatan transaksi tetap opsional. Tidak ada penomoran otomatis baru pada tahap ini.

### Laporan Distribusi Barang

- Laporan membaca dokumen Barang keluar yang tersimpan, tidak menulis stok, tidak menginput distribusi lagi. Cohort berdasarkan tanggal penyaluran; pengembalian/reversal dibatasi tanggal akhir laporan. Nilai asal immutable; penyaluran efektif nol setelah pembatalan pada/sebelum akhir periode. Penyaluran bersih bukan stok atau pemakaian unit.

- Scope inventory.reports.read mengikuti paket yang memuat permission tersebut; master all tidak memperluas reader selected. Detail dan lampiran tetap memerlukan izin transaksi/file. Modal bersama dari laporan tidak menawarkan pembatalan dan menjelaskan perbedaan cutoff laporan dengan status dokumen terkini.

- Rincian/rekap/satuan/filter/keyset/total/Excel memakai service dan snapshot baca yang sama. Ekspor maksimal 5.000 baris, literal, diaudit, no-store, tanpa pemotongan. Jangan menjumlahkan kuantitas lintas satuan atau menampilkan error sebagai statistik nol.

- Tujuan berasal dari transaksi asal, bukan penempatan Pegawai terkini. Default periode awal bulan–hari ini zona organisasi. Perubahan aturan historis harus diuji terhadap return dan pembatalan sebelum/sesudah cutoff. Rancangan/API/uji: docs/rules/inventory.md.

- Bahasa Inventaris memakai Stok awal/Koreksi stok awal pada UI, validasi dan katalog izin; identifier kontrak opening/balance tetap. Stok Barang default menampilkan yang sudah memiliki transaksi, menyediakan Semua barang/Belum ada transaksi, dan tidak menampilkan stok nol palsu. Tabel ringkas memakai nama/kode barang serta nama gudang. Ringkasan satu barang rata kiri; jumlah transaksi berada dalam Perubahan stok gudang. Label distribusi sederhana tanpa mengubah perhitungan historis.

- Identitas pelaku Inventaris memakai nama pertama dan terakhir dari profil tertaut, fallback username. Avatar memakai komponen bersama dan preview privat berizin, terkait pelaku dokumen sebenarnya; akses Inventaris tidak membuka seluruh profil/dokumen HRIS. Backend, ekspor, rincian, pembatalan dan Kartu Stok memakai aturan identitas yang sama. Uji foto lintas organisasi/scope, target palsu, keyboard serta fallback.

Jabatan di bawah nama pelaku Inventaris berasal dari penempatan utama yang berlaku hari ini menurut timezone organisasi. `ActorIdentity` menerima `position` opsional; profil tanpa jabatan tidak menampilkan keterangan pengganti. Riwayat transaksi menempatkan Disimpan oleh sebelum Status.

## Model akses dan transaksi Persediaan

Bagian ini memuat detail kontrak dan keputusan fitur, termasuk catatan tahap lama. Untuk aturan aktif, gunakan bagian Aturan Inventaris di awal dokumen serta implementasi dan tes terkait.
### Keputusan tahap pertama

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

### Pengembangan berikutnya

Manajemen Aset menangani barang jangka panjang yang dilacak per unit fisik:
kode aset, kondisi, lokasi, penanggung jawab, perpindahan, garansi, dan perawatan.
Penerimaan barang dapat menjadi sumber pencatatan aset; jangan menghitung barang
yang sama dua kali. Klasifikasi serta divisi pengelola mengikuti kebijakan organisasi.
Pengajuan online, persetujuan, pemakaian/saldo divisi, dan akuntansi aset memerlukan
diskusi lanjutan sebelum diterapkan.

### Model akses yang disepakati

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

#### Pemberi akses

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

### Navigasi yang disepakati

Keputusan navigasi terbaru: Data Master memuat **Barang Persediaan**, **Kategori
Barang**, **Satuan Barang**, dan **Gudang** sebagai halaman terpisah. Inventaris
memuat **Stok Barang** dan **Transaksi Barang**; Laporan memuat **Distribusi Barang**.
Setiap submenu memakai permission fitur dan scope organisasi yang sama; parent
hanya tampil bila ada anak berizin. Tidak ada tab Katalog & Gudang lagi.
Tombol tambah berada pada header, filter organisasi Superadmin pada toolbar daftar.
Wajib memilih satu organisasi; Dashboard Pegawai menampilkan ringkasan profil sendiri; tab Inventaris mengikuti izin. Lihat `docs/rules/product.md`.

Kartu Stok nantinya berada di detail satu barang pada satu gudang, menampilkan
masuk, keluar, dan saldo setelah setiap transaksi. Distribusi Barang merangkum
penyaluran lintas transaksi menurut periode, barang, gudang, dan divisi/unit tujuan.
Keduanya berasal dari transaksi yang sama, bukan pencatatan terpisah. Laporan
distribusi tidak membuktikan sisa stok divisi. Pencatatan dari Stok Barang dan
Transaksi Barang kelak menyusun form/use case yang sama.

### Kontrak API tahap 1

#### Uji coba pengguna

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

#### Endpoint

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

### Tahap 2 — Master Persediaan (9 Oktober 2026)

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

### Arahan prasyarat dan tautan lama

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

#### Satuan tanpa kode input dan chip master persediaan

Rujukan: [Satuan tanpa kode input dan chip master persediaan](inventory.md#satuan-tanpa-kode-input-dan-chip-master-persediaan).

### Penyesuaian tingkat akses (9 Oktober 2026)

Fitur Inventaris — Lihat Saja (kode inventory_reader) tidak membuka empat master
Inventaris, termasuk melalui URL langsung. Stok/Transaksi/Distribusi tetap dapat
dibuka tanpa mutasi; isi operasionalnya masih tahap pengembangan berikutnya.
Fitur Inventaris — Pengelola boleh menambah/edit/nonaktifkan barang, kategori,
dan satuan bersama organisasi meskipun memilih gudang tertentu. Perubahan ini
berlaku untuk seluruh katalog organisasi; bukan membuat katalog per gudang.
Gudang terpilih hanya boleh dikelola sesuai grant; gudang baru memerlukan all.
Form menampilkan penjelasan kemampuan dan batas scope dekat field. Migration 049
mencabut inventory.master.read dari paket reader tanpa menghapus grant lama.

### Pemisahan master dan operasional — migration 050

Rujukan: [Pemisahan master dan operasional — migration 050](data.md#pemisahan-master-dan-operasional--migration-050).

- Pengelola Gudang (inventory_manager): izin operasional gudang serta minimum barang-gudang dalam scope all/selected. Tidak CRUD katalog/metadata gudang, termasuk scope all. Migration 054 menambahkan pencatatan dan pembatalan transaksi dalam gudang yang diizinkan. Stok awal, masuk, keluar, pengembalian, dan stok opname memakai riwayat `inventory_stock_movements` yang sama; draft tidak mengubah stok. Kontrak Kartu Stok dan laporan ada di bagian operasional dan laporan dokumen ini.

- Pencatatan Transaksi Barang memakai `AppModal` empat tahap (jenis, detail, barang, periksa). Tombol Catat transaksi memulihkan draft aktif terakhir milik petugas/organisasi tanpa menampilkan daftar draft; draft Pegawai tetap terpisah. Draft memakai checkpoint saat Lanjut, Kembali, Simpan draft & tutup, atau finalisasi, bukan autosave per perubahan field; penutupan menunggu simpan berhasil. Pengguna dapat membuang draft aktif dan mulai ulang di modal. Pemilihan jenis lain baru meminta konfirmasi ketika Lanjut ditekan dan isian lama ada; isian dikosongkan hanya setelah pengguna setuju dan checkpoint jenis baru berhasil. Lampiran lama dibersihkan saat jenis baru tersimpan. Seluruh dropdown wizard dapat dicari dengan ketikan; footer dan tombol konfirmasi menempati satu baris masing-masing dengan lebar penuh pada ponsel. Dua area unggah yang berurutan dan area unggah terakhir terhadap footer memiliki jarak aman. Lampiran draft disimpan privat serta dibersihkan saat draft dibuang/kedaluwarsa (migration 056). Pilihan jenis pada tahap pertama dan ledger berbagi label, ikon, serta warna yang sama. Riwayat hanya berisi transaksi terposting, berbentuk ledger responsif padat per dokumen dengan kolom Status setelah Dicatat oleh, ikon jenis ringkas, dan cursor 10/20/50 baris per halaman (awal 20), diurutkan menurut waktu pencatatan terbaru. Pencarian dan dropdown yang bisa diketik berada dalam section filter bersama; toolbar pencarian/muat ulang terpisah tidak digunakan. `DataPagination` menampilkan total hasil filter dari server. Satu tanggal di baris adalah Tanggal transaksi; waktu pencatatan tetap tersedia di detail audit. Bukti pembelian baru memakai JPEG/PNG/WebP maksimal 5 MB; PDF lama tetap terbaca berizin.

### Metadata lampiran transaksi

Respons upload `POST /api/inventory/transactions/:id/draft-files` dan daftar
lampiran pada detail transaksi memuat `id`, `purpose`, `name`, `mimeType`, serta
`sizeBytes`. MIME berasal dari pemeriksaan byte server; ukuran berasal dari
metadata file yang disimpan. Preview memakai `/api/uploads/:fileId` berizin.
Komponen upload bersama mendukung kontrak ini dan metadata Kepegawaian tanpa
menentukan jenis file dari nama/ekstensi. Foto barang memakai pilihan lokal
hingga Simpan barang; lampiran transaksi disimpan ke draft privat.

### Tahap Stok Barang (12 Oktober 2026)

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

### Perapian transaksi dan perkiraan stok

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

### Pengembalian ke gudang — alur penyaluran terkait

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

#### Penyempurnaan rincian dan jumlah awal

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

### Stok awal dan penerimaan terlambat

Rujukan: [Revisi stok awal — migration 057](data.md#revisi-stok-awal--migration-057).

#### Pembagian Stok dan Transaksi Barang

Tambah transaksi hanya berada pada Transaksi Barang. Header Stok Barang tidak menawarkan pembuatan transaksi; halaman ini memantau saldo/indikator, Kartu Stok, minimum dan koreksi stok awal berizin.

#### Field administratif menurut jenis transaksi

Stok awal tidak wajib alasan keterlambatan. Barang masuk, keluar, pengembalian dan stok opname sebelum hari ini wajib alasan minimal 10 karakter, sesuai transactionFieldPolicy.mjs bersama UI/backend. Pembatalan dan koreksi tetap wajib alasan tindakan. Nomor dokumen baru hanya pada penerimaan/penyaluran, opsional, dengan label Nomor dokumen penerimaan dan Nomor memo/permintaan. Opening/return/stocktake menyimpan dan menampilkan referensi lama tanpa input baru atau penghapusan diam-diam. Catatan tetap opsional; nomor kosong tidak ditampilkan di ringkasan. Kontrak API referenceNo/lateReason, schema, audit, tanggal dan izin tidak berubah; tidak perlu migration.

#### Implementasi Distribusi Barang

Rujukan: [Laporan Distribusi Barang](data.md#laporan-distribusi-barang).

Tabel Stok Barang secara default memakai condition=recorded: pasangan barang–gudang dengan riwayat resmi, termasuk stok habis dan transaksi yang dibatalkan. Pilihan Semua barang atau Belum ada transaksi tetap tersedia; stok tanpa riwayat adalah null dan ditampilkan sebagai —. Identitas barang cukup nama/kode, gudang cukup nama. Istilah antarmuka adalah Stok awal/Koreksi stok awal; kode opening, permission, tabel, audit lama dan migration historis tetap kompatibel.

Rujukan: [Verifikasi](product.md#verifikasi-3).

Pada tahap Periksa transaksi, Perubahan stok gudang memakai InventoryStockMetric dan AppIconTile yang sama untuk Jumlah, Sebelum, Sesudah, dan Stok saat ini: tile 36px, ikon 18px, tipografi seragam. Jumlah mengikuti warna jenis transaksi, Sebelum netral, Sesudah biru atau merah jika nol. Divider berada sesudah Jumlah dengan gap 16px; padding panel 16px. Tidak mengubah proyeksi atau validasi stok.

#### Kompatibilitas aktivasi Absensi

Fitur organisasi kini memuat sakelar Inventaris dan Absensi yang terpisah. GET/PATCH /api/access/modules bentuk lama tetap khusus Inventaris tanpa perubahan respons. GET view=all dan PATCH changes menambahkan batch atomik maksimal kedua fitur, dengan versi dan audit masing-masing. Absensi tidak menggunakan paket atau scope gudang Inventaris. Aktivasi tidak memberi grant, penonaktifan tidak menghapus data maupun grant. [Kontrak lengkap](../work-schedules.md#kontrak-aktivasi-organisasi).

## Stok awal dan penerimaan terlambat — migration 057

### Aturan pengguna

Stok Awal adalah persediaan sebelum pencatatan operasional, sekali per barang–gudang. Pilihan hanya tersedia jika barang/gudang/link aktif, berizin, dan belum memiliki stok awal maupun transaksi resmi. Draft dan batas minimum bukan transaksi resmi. Pembatalan seluruh transaksi tidak membuka kesempatan membuat stok awal kedua.

Barang Masuk boleh menjadi transaksi pertama, dimulai dari nol tanpa membuat dokumen stok awal nol. Sebelum riwayat tersedia, stok ditampilkan **Belum ada transaksi**. Setelah riwayat dimulai, saldo nol ditampilkan **Habis**. Barang Keluar dan Stok Opname memerlukan riwayat; tanggal pembuatan master tidak membatasi tanggal penerimaan.

Stok awal memakai tanggal acuan stok sebelum pencatatan dimulai. Tanggal sebelumnya tidak memerlukan alasan keterlambatan; batas tanggal 30 hari dan larangan masa depan tetap berlaku. Nomor referensi tidak ditawarkan pada input stok awal baru; nilai lama tetap dipertahankan.

Penerimaan terlambat tetap Barang Masuk, memakai tanggal penerimaan sebenarnya, maksimal 30 hari sebelumnya dan alasan minimal 10 karakter. Tanggal dari zona organisasi/database, bukan jam browser. Jika mendahului stok awal manual, pengguna berizin meninjau tanggal/jumlah stok awal yang benar; tidak mengubah tanggal kejadian agar lolos.

### Koreksi dan izin

`inventory.openings.correct` berasal dari paket tambahan `inventory_opening_corrector`, **Koreksi Stok Awal**. Tidak ada grant otomatis. Pemberi hanya Superadmin atau admin HRD penuh. Penerima harus mempunyai `inventory_manager` dengan cakupan yang mencakup cakupan koreksi. Backend memeriksa kedua permission pada gudang yang sama setiap request. Pengelola Master tidak otomatis mendapat operasional atau koreksi.

Modal menampilkan nilai lama, histori, nilai baru yang ditentukan pengguna, alasan, dan preview. Koreksi mandiri dikonfirmasi sebelum disimpan. Koreksi dari draft disiapkan di form, lalu disimpan atomik bersama penerimaan; kegagalan membatalkan keduanya. Tanggal stok awal paling lambat transaksi operasional pertama; tanggal sama berarti posisi awal hari. Nilai tidak ditebak otomatis.

### API

- `GET /api/inventory/openings?organizationId=...&warehouseId=...&itemId=...`: stok awal asal/efektif, revisions, histori, current, version, fingerprint.
- `POST /api/inventory/openings`: identity yang sama, `action: preview|correct`, UUID `operationId`, `correction: {occurredOn,quantity,reason,version,fingerprint}`. Preview tidak menyimpan. Retry operation identik mengembalikan hasil tersimpan; operasi berbeda dengan UUID sama ditolak.
- Draft/preview/post transaksi menerima `openingCorrections?: [{itemId,occurredOn,quantity,reason,version,fingerprint}]`; hanya Barang Masuk dapat menggabungkan koreksi. Omission tetap kompatibel.
- Preview transaksi mengembalikan `calculationVersions: [{itemId,version,fingerprint}]`; wizard mengirimnya saat commit. Sumber berubah menghasilkan `VERSION_CONFLICT` dan preview ulang. API lama tanpa field tetap divalidasi ulang server.
- Options mengembalikan `canInitializeOpening`, `eligibleWarehouses`, `canCorrectOpening`, `opening_eligible` dan `has_history` per barang. Stok membedakan `has_opening` manual dan `has_history` resmi.

Semua endpoint memeriksa session, modul, organisasi dan scope; respons private/no-store, validasi fieldErrors serta requestId untuk kegagalan internal. Error bisnis menunjuk penyebab pasti, barang/gudang/tanggal/jumlah. Gangguan saat commit diperiksa melalui UUID transaksi sebelum retry; bila status belum diketahui, UI tidak mengklaim gagal atau berhasil.

### Mesin dan penyimpanan

`replay.mjs` memakai BigInt satuan 1/1000. Satu mesin menghitung preview/post/cancel/correction; stok dan Kartu Stok membaca hasil proyeksi yang sama.

- `inventory_opening_revisions`: append-only, FK organisasi, baris asal, revisi sebelumnya, actor/waktu server, alasan, UUID operasi.
- `inventory_stock_projection`: tanggal efektif, selisih efektif dan saldo per baris ledger, data turunan.
- `inventory_stock_calculations`: versi per barang–gudang, state legacy/active.

Dokumen/ledger asli tetap immutable. Stocktake mempertahankan hasil fisik, menghitung ulang delta terhadap saldo sebelumnya. Reversal pada tanggal pembatalan memakai kebalikan delta efektif asal, termasuk stocktake. Saldo negatif pada tanggal mana pun ditolak, menyebut titik pertama yang negatif. Input retro pada hari yang sama dengan stocktake ditolak khusus karena jam kejadian belum tersedia. Kartu Stok menandai hasil yang dihitung ulang dan menyertakan tanggal/delta asal pada DTO.

### Rollout terkontrol

Migration 057 menyalin proyeksi legacy **persis dari ledger lama**, tidak menulis ulang saldo atau dokumen. Perbedaan replay legacy memblokir mutation dengan `REPLAY_REVIEW_REQUIRED`. Pasangan yang matematis tetap sama dapat menjalankan transaksi baru; perubahan yang dihasilkan berasal dari operasi tersebut.

1. Uji migration dan bootstrap pada database terpisah; backup sesuai aturan proyek sebelum penerapan.
2. Jalankan `node scripts/replay-inventory-stock.mjs --database=NAMA --report=laporan.json`. Default read-only; laporan memuat organisasi, barang/gudang, nilai lama/baru, checkpoint berubah, error dan fingerprint sumber.
3. Tinjau setiap selisih. Laporan invalid tidak bisa diaktifkan. **Persetujuan manusia wajib sebelum aktivasi**; simpan `approved: true` hanya setelah peninjauan dan persetujuan.
4. Aktivasi eksplisit: `node scripts/replay-inventory-stock.mjs --database=NAMA --report=laporan.json --activate --actor=ID_SUPERADMIN`. Verifikasi Superadmin aktif, lock pasangan, fingerprint sama; perubahan saldo/proyeksi/audit seluruhnya atomik. Sumber berubah mengharuskan dry-run ulang.
5. Smoke test memakai profil uji; periksa stok, kartu, penerimaan retro dan permission. Tidak ada aktivasi produksi otomatis dari build/migration.

Rujukan prinsip: [Zoho opening stock](https://www.zoho.com/us/inventory/kb/items/item-initial-stock.html), [ERPNext repost](https://docs.frappe.io/erpnext/repost-item-valuation), [Odoo physical count](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/count_products.html). Detail pembatasan tanggal, izin koreksi, dan transaksi atomik adalah keputusan produk SITOU.

## Rekap Stok

Laporan → Rekap Stok (`/reports/inventory-stock`) mengikuti format laporan stok periodik: No, Nama barang, Satuan, Stok awal, Barang masuk, Jumlah stok, Barang keluar, Stok akhir. Gudang ditampilkan terpisah jika semua gudang dipilih. Satu baris per barang–gudang; tidak menjumlahkan barang atau satuan berbeda.

### Perhitungan

Sumber tunggal adalah `inventory_stock_projection`, melalui pergerakan dengan transaksi resmi `posted`, sama dengan Kartu Stok. Tidak membuat ledger, saldo, atau isian laporan baru. Stok awal = jumlah efek sebelum awal periode. Masuk = seluruh efek positif selama periode; keluar = nilai absolut seluruh efek negatif selama periode. Jumlah stok = awal + masuk; akhir = jumlah stok − keluar. Tanggal awal/akhir inklusif. Transaksi Stok awal yang terjadi dalam periode termasuk masuk, bukan saldo sebelum periode. Pengembalian, opname dan pembatalan dikategorikan menurut tanda efek efektifnya. Pembatalan mempertahankan pergerakan asal dan pergerakan pembatalan pada tanggal masing-masing, bukan menghilangkan histori sebelum tanggal pembatalan. Koreksi/penerimaan terlambat dapat memperbarui laporan historis sesuai mesin replay; Excel mencantumkan waktu pembuatan.

Barang dengan histori sampai akhir periode tetap tampil, termasuk saldo nol, tanpa pergerakan dalam periode, atau master nonaktif. Barang tanpa histori sampai akhir periode tidak dianggap stok nol terhitung. Identitas barang memakai InventoryItemPhoto bersama: foto privat dapat diperbesar dengan ImagePreviewModal, fallback ikon bila tidak ada/gagal dimuat. Nama diikuti kode dan satuan. Kolom Keterangan tidak ditampilkan pada desktop, mobile maupun Excel. Ikon navigasi Rekap Stok memakai navigation:inventory-stock-report (clipboard-check bold duotone lokal).

### Filter dan UI

Cari barang (nama/kode, debounce, sebelum periode), Periode laporan (RangePicker bersama), Gudang, Kategori barang, Nama barang (Nama · Kode · Satuan, AsyncSelect). Default awal bulan–hari ini zona organisasi. Hapus/reset periode mengembalikan default. Superadmin memilih satu organisasi. Tidak ada kartu ringkasan tambahan. Desktop tabel, mobile kartu berlabel, DataPagination 10/20/50 dengan total/jumlah tampil aktual.

Aksi Lihat rincian stok membuka AppModal Kartu Stok dengan barang/gudang/periode yang sama dan ringkasan lima angka. Pagination tetap pada slot di luar body gulir. Detail berisi tanggal/jenis/masuk/keluar/saldo; dokumen transaksi hanya dapat dibuka dengan `inventory.transactions.read` pada gudang yang sama. Modal dokumen tidak menawarkan mutation. Rincian stok dan dokumen tidak ditumpuk; saat kembali halaman/posisi rincian dipertahankan. Request dibatalkan saat ditutup/berubah. Loading, kosong, gagal/coba lagi tersedia.

### API dan akses

Saat ikon mata dipilih, loading backdrop bersama tampil selama pengambilan dan pembacaan respons sampai detail transaksi disiapkan. Backdrop dilepas juga saat request gagal atau dibatalkan; pesan gagal tetap tampil pada Kartu Stok.

`GET /api/inventory/stock-report`: daftar; `options=1`: pilihan; `action=history` + warehouseId/itemId: rincian; `export=xlsx`: seluruh hasil (maksimal 5.000, lebih ditolak tanpa pemotongan). Mode tidak digabungkan. Memakai `inventory.reports.read` dari fitur Inventaris dan scope gudang aktual, bukan akses HRIS/master. Organisasi ditentukan/dicocokkan sesi. Rincian report-only tidak memerlukan `inventory.stock.read` dan tidak membuka dokumen/file. ID transaksi dihilangkan jika izin transaksi tidak tersedia. Cursor HMAC 30 menit terikat akun, organisasi, scope, filter, mode dan ukuran halaman. Setiap request memeriksa akses terbaru. Daftar/total dibaca dalam snapshot repeatable-read. Respons private/no-store; ekspor dan akses Superadmin diaudit. Ekspor memakai batas frekuensi dan validasi origin yang sama dengan Distribusi Barang.

Excel memiliki dua sheet: Informasi Laporan pertama memuat organisasi, gudang, periode, waktu, filter dan rumus melalui helper reportWorkbookInfo bersama Distribusi Barang. Sheet Rekap Stok kedua hanya memuat tabel sesuai urutan foto, tanpa Aksi; header mulai baris 1, freeze/autofilter/judul cetak baris 1, border dan cetak landscape. Teks literal (bukan formula); pecahan maksimal tiga digit; angka di luar presisi aman Excel disimpan sebagai teks. Tidak perlu migration atau grant otomatis baru karena menggunakan permission/proyeksi existing.

### Verifikasi

Periksa periode penuh/subperiode/tanpa pergerakan, stok awal dalam periode, penerimaan, pengembalian, opname positif/negatif, pembatalan sebelum/setelah cutoff, koreksi, master nonaktif, pecahan dan saldo nol. Cocokkan awal/akhir dan rincian dengan Kartu Stok. Uji paging >10 tanpa duplikasi, cursor akun/filter/scope berbeda ditolak, organisasi/gudang tanpa izin ditolak, report-only tanpa ID dokumen, batas ekspor dan audit. Periksa 320px–1920px serta pagination modal tetap terlihat.

## Laporan Distribusi Barang

Menu canonical: `/reports/inventory-distribution`; API: `GET /api/inventory/distribution`.
Laporan hanya membaca penyaluran resmi; tidak membuat transaksi, saldo penerima, permintaan, approval, atau perubahan stok.

### Periode dan jumlah

- `from`–`to` memilih **tanggal kejadian penyaluran**, inklusif. Bawaan awal bulan sampai hari ini dari zona organisasi.

- Pengembalian terkait dan pembatalannya dihitung sampai `to`, termasuk pengembalian setelah tanggal penyaluran. Pengembalian dari penyaluran sebelum `from` tidak termasuk cohort laporan ini.

- Pembatalan penyaluran baru menghapus efek penyalurannya jika tanggal pembatalan pada/sebelum `to`. Pembatalan setelah akhir periode tidak mengubah angka periode sebelumnya.

- `original_quantity`: jumlah dokumen asal yang tetap immutable.

- `distributed_quantity`: jumlah efektif penyaluran (nol jika dibatalkan sampai tanggal akhir).

- `returned_quantity`: pengembalian terkait yang masih berlaku sampai tanggal akhir.

- `net_quantity`: penyaluran efektif dikurangi pengembalian. **Bukan stok penerima atau bukti pemakaian.**

- Stok opname, stok awal, koreksi stok awal, dan penerimaan tidak menjadi penyaluran; tidak dijumlahkan pada laporan ini. Rumus saldo gudang tidak diubah.

Tujuan lokasi/unit dan penerima berasal dari header transaksi asal. Rolling Pegawai tidak memindahkan histori distribusi. Nama master/profil dibaca dari referensi saat laporan dibuat; ID tujuan transaksi tetap asal. Data nonaktif tetap dapat dibaca untuk histori.

### Filter dan tampilan

Filter: organisasi (Superadmin), Cari data (nama/kode barang, penerima atau nomor memo), Periode penyaluran melalui DatePicker.RangePicker bersama, gudang asal, Nama barang, lokasi tujuan, Divisi & Unit tujuan, Pegawai penerima, status `effective|cancelled|all`. Semua filter digabung sebagai irisan.

- Rincian: satu baris per barang dalam satu transaksi penyaluran, jumlah efektif/return/bersih, status pada akhir periode, dan rincian transaksi berizin.

- Halaman berfokus pada filter dan tabel, tanpa empat kartu ringkasan transaksi/barang/tujuan/penerima. Total/pagination tetap memakai filter yang sama. Tidak ada penjumlahan lintas satuan.

- Pagination keyset, ukuran 10/20/50, cursor terikat seluruh filter dan scope. Hasil dan total dibaca pada snapshot PostgreSQL `REPEATABLE READ READ ONLY` yang sama; tanpa cache payload.

- Loading/error/kosong dibedakan. Error tidak ditampilkan sebagai statistik nol.

### Hak akses dan rincian

Semua API dan halaman memakai `inventory.reports.read`, modul aktif dan scope gudang server terbaru. Lihat Saja/Pengelola Gudang memperoleh hak melalui paket operasional. HRD penuh atau Pengelola Master tidak otomatis membaca distribusi tanpa paket yang sesuai. Grant master all tidak memperluas scope laporan reader selected.

Tombol detail memerlukan `inventory.transactions.read` pada gudang sumber. Modal bersama `TransactionDetailModal` mempertahankan foto/preview/PDF privat; dari laporan tidak ada tombol pembatalan. Modal menjelaskan bahwa status dokumen adalah status terkini, sedangkan angka laporan dibatasi tanggal akhir. Endpoint lampiran tetap memeriksa izin saat dibuka.

Respons memakai `private, no-store`; organisasi tidak diambil dari body yang dipercaya. Pembacaan lintas organisasi Superadmin eksplisit dan diaudit. Pencabutan/modul nonaktif berlaku pada request berikutnya.

### Ekspor

`export=xlsx` memakai filter/scope/periode yang sama, seluruh baris maksimal 5.000. Lebih dari batas ditolak dengan pesan dan field error, tanpa pemotongan. Lima ekspor per lima menit. Ekspor berhasil diaudit; file tidak menyimpan object key, ID file privat, NIK, rekening, atau data profil sensitif.

Workbook berisi Informasi Laporan pada sheet pertama (helper reportWorkbookInfo bersama Laporan Stok): waktu server menurut zona organisasi, cutoff pengembalian/pembatalan dan filter. Sheet Distribusi kedua hanya berisi tabel data mulai header baris 1, dengan satuan per barang. Teks selalu literal, bukan formula; kuantitas yang melebihi ketelitian aman JavaScript ditulis sebagai teks desimal tepat. Tidak membuat penomoran dokumen baru.

### Database dan pengujian

Tidak perlu migration: memakai `inventory_transactions`, `inventory_transaction_lines`, referensi organisasi, dan `audit_logs` yang sudah ada. Return memakai source_line_id dan reversal memakai reversal_of_id; join agregasi/batch, bukan N+1. Ledger dan balances tidak diubah.

Jalankan prosedur verifikasi fitur. Runner bootstrap database terpisah, menguji periode sebelum/setelah return dan reversal, status, scope/gabungan master, organisasi, modul, session dicabut, keyset, export literal/audit/batas, tujuan sesudah rolling, EXPLAIN, modal read-only, serta browser 320–1920. Database uji dibersihkan otomatis.

Label laporan menggunakan Jumlah disalurkan, Dikembalikan, dan Penyaluran bersih. Filter Status penyaluran default Semua status, mencakup Berlaku dan Dibatalkan sesuai tanggal akhir periode. Berlaku berarti belum ada pembatalan sampai tanggal akhir; pengembalian sebagian/penuh tidak mengubah status ini. Dibatalkan berarti pembatalan sudah berlaku sampai tanggal akhir. Status memakai kolom tersendiri pada desktop dan chip terpisah pada kartu mobile; identitas barang hanya memuat foto, nama, kode, dan satuan. Penjelasan perhitungan pada ekspor Excel tetap tersedia. Aturan perhitungan historis dan kontrak DTO tidak berubah.

Identitas pencatat memakai nama pertama–terakhir dari profil Pegawai pada organisasi dokumen, atau profil platform, dengan fallback username. DTO rincian membawa actor_photo_file_id saja; tidak mengirim data profil lain. Avatar melalui GET /api/uploads/:fileId dengan inventoryActorTransactionId, inventoryActorRole=creator|cancelled dan inventoryActorView=transaction|stock|distribution. Server mencocokkan foto aktif milik pelaku dokumen dan memeriksa izin/konteks/gudang terbaru, lalu memeriksa file serta mengaudit preview. Scope Inventaris tidak membuka akses foto/profil HRIS umum. Ekspor memakai actor_name ringkas yang sama.

Format jumlah pada Excel mengikuti presisi setiap nilai: bilangan bulat tanpa pemisah desimal, pecahan maksimal tiga desimal tanpa nol tambahan. Jangan memakai format desimal opsional `#,##0.###` yang dapat menghasilkan titik/koma kosong. Jumlah biasa tetap numeric; jumlah di luar batas presisi aman tetap teks agar tidak dibulatkan.

Rujukan: [Verifikasi](product.md#verifikasi-3).

Cari data berada sebelum Periode penyaluran. Rentang tanggal memperbarui from/to
secara bersamaan; menghapus rentang atau Atur ulang kembali ke awal bulan sampai
hari ini berdasarkan timezone organisasi. Tidak menambah dua input tanggal terpisah.
Pencarian memakai Input bersama dengan ikon cari dan hapus, debounce 300 ms,
parameter search yang sama untuk tabel dan Excel, tanpa field Barang atau nomor
memo terpisah. Filter atau periode berubah mereset cursor melalui signature.

Nama barang memakai AsyncSelect yang dapat dicari. Pilihan berupa Nama · Kode ·
Satuan, unik berdasarkan ID, hanya dari histori penyaluran resmi dalam organisasi
dan scope gudang. Kode/satuan memperjelas pilihan nama serupa; barang nonaktif
dengan histori tetap dapat dicari. Tidak membuka stok, profil, atau dokumen lain.

Bahasa UI dan Excel memakai Nama barang, Tanggal penyaluran, Tujuan penyaluran,
Pegawai penerima, dan Jumlah transaksi. Pesan kosong: Tidak ada data penyaluran
yang sesuai dengan pencarian dan filter. Penjelasan jumlah tetap menyebut satuan
barang dan pembatalan sampai akhir periode; perhitungan historis tidak berubah.

Penyaluran bersih berarti jumlah disalurkan dikurangi pengembalian sampai akhir
periode. Angka ini bukan stok gudang, sisa barang pada penerima, atau kewajiban
pengembalian. Label tabel, kartu mobile, dan Excel memakai distributionLabels.mjs;
net_quantity serta perhitungan historis tetap sama.

Distribusi Barang hanya memiliki Rincian penyaluran, tanpa filter Tampilan atau
rekap barang dan tujuan. Query pengelompokan dan jumlah kelompok dihapus;
setiap barang pada tiap transaksi tetap baris terpisah, termasuk bila barang
dan tujuannya sama. API dan Excel tidak menyediakan mode rekap. Parameter view
yang lama ditolak sebagai filter tidak valid; cursor lama dimuat ulang dari
halaman pertama karena fingerprint filter berubah. Excel selalu memuat tanggal,
penerima, nomor memo, jumlah penyaluran awal, pelaku, dan tanggal pembatalan.
Tidak ada perubahan stok, cutoff pengembalian, audit, batas ekspor atau scope.

Identitas Pegawai penerima memakai ActorIdentity bersama (foto privat, nama lengkap, jabatan) pada distribusi desktop/mobile, detail transaksi dari seluruh pintu masuk, detail sumber pengembalian, serta tahap Periksa penyaluran/pengembalian. Jabatan detail tersimpan/laporan adalah penempatan utama terkini seperti Disimpan oleh; pilihan penerima sebelum penyimpanan memakai penempatan pada tanggal transaksi. Foto hanya dibuka untuk profil penerima yang benar pada organisasi dan gudang berizin, atau cohort pilihan penerima yang divalidasi server. Tidak memberi akses dokumen/profil HRIS lain.

## Kartu mobile Data Master dan Inventaris

### Acuan dan keputusan

Acuan utama adalah kartu Rekap Stok/Distribusi Barang SITOU. Referensi eksternal: [Carbon Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) untuk hierarki, pengelompokan, konsistensi dan akses aksi; [Material color roles](https://m3.material.io/styles/color/the-color-system/color-roles) untuk pembedaan permukaan netral dengan warna penekanan. Alur barang/perubahan stok juga ditinjau dari [Zoho Inventory mobile](https://www.zoho.com/us/inventory/mobile-apps/). Implementasi tetap memakai token tema, font dan komponen SITOU; tidak meniru warna produk lain atau menambah informasi palsu.

### Komponen dan informasi

InventoryMobileCardContent adalah susunan slot bersama. InventoryReportCardContent tetap kompatibel sebagai alias. ResponsiveDataView menyediakan bingkai tunggal, nomor, loading/kosong/gagal dan typography mobile minimal 14px. Identitas dan angka utama tetap lebih besar melalui FontStyle; tidak mengurangi ukuran teks per fitur. Gap antarbagian 24px, fakta 16px, label/nilai 8px. Tombol teks di bawah divider minimal 44px, lebar penuh dan dapat membungkus. Tidak menaruh ikon edit kecil sendirian di samping nama pada mobile.

- Kategori Barang: ikon kategori brand, nama, chip kode, status dan Catatan jika ada. Edit kategori langsung membuka form yang sama.
- Satuan Barang: ikon penggaris, nama/status dan Aturan jumlah (Angka bulat atau Pecahan diizinkan). Tidak menampilkan kode internal satuan. Edit satuan langsung membuka form yang sama.
- Gudang: ikon gudang, nama, chip kode, status dan Lokasi. Edit hanya jika row.canEdit.
- Stok Barang: foto privat/fallback dan pratinjau yang sama, kondisi stok, Gudang, Batas minimum dan Stok tersedia (penekanan). Tanpa histori tetap Belum ada transaksi, bukan angka nol buatan. Lihat kartu stok, Atur batas minimum dan Koreksi stok awal hanya sesuai izin existing.
- Transaksi Barang: jenis dengan ikon/warna semantik, status, tanggal, gudang dan referensi bila tersedia. Maksimal dua barang menampilkan jumlah asli dan perubahan masing-masing; bila lebih, jumlah barang lainnya disebut dan seluruh rincian tersedia di modal. Tidak menjumlahkan angka berbeda satuan atau menafsirkan hasil opname sebagai jumlah penerimaan. Dokumen dibatalkan mempertahankan angka asal dan penjelasan stok dikembalikan. Pelaku dari DTO server. Lihat detail transaksi memakai modal bersama.

Transaksi mobile di bawah 768px menggunakan ResponsiveDataView; tablet/desktop mempertahankan ledger. Rentang tanggal Transaksi Barang dan Kartu Stok menggunakan ResponsiveRangePicker dengan perubahan atomik serta batal tanpa mengubah filter. Kartu Stok juga memakai susunan kartu bersama dan pagination pada slot tetap AppModal. Tidak mengubah sumber ledger, perhitungan, filter SQL, permission, scope, draft, mutation maupun audit. Barang Persediaan dan komponen galeri tetap seperti sebelumnya.

### Verifikasi

Periksa kelima menu pada 320–1920px, layar pendek, nama/kode panjang, chip nonaktif, notes kosong/panjang, pecahan, stok nol/tanpa histori, transaksi banyak barang dan dibatalkan. Cek label dan lebar aksi minimal 44px, form/detail tanpa menyimpan, pencarian/reset, pagination, tanggal lintas bulan dan pembatalan kalender. Pastikan hanya scroll lokal desktop yang diperlukan, tanpa overflow horizontal halaman mobile. Uji laporan kembali karena slot digunakan bersama. Fixture UI hanya untuk kasus tepi dan tidak mengubah record bisnis.
