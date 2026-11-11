# Aturan Inventaris

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

- Tahap Stok Barang menggantikan placeholder stok pada tahap awal. Distribusi Barang membaca laporan penyaluran resmi sesuai docs/inventory-distribution.md; request/approval/aset belum dikembangkan. Tidak membuat ledger atau saldo kedua.

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

- Saldo legacy tidak berubah diam-diam. Dry-run, laporan selisih, persetujuan, fingerprint dan aktivasi atomik diaudit wajib sesuai docs/inventory-opening-corrections.md. Migration mencerminkan bootstrap dan diuji pada database terpisah.

- Aksi Kartu Stok/Atur minimum/Koreksi memakai AppIcon semantik terdaftar, tema info/secondary/warning, tooltip/aria/44px. Jangan memakai fallback tanda tanya.

### Field administratif Transaksi Barang

- transactionFieldPolicy.mjs adalah sumber bersama form/backend untuk kewajiban alasan terlambat dan metadata nomor dokumen. Stok awal tidak meminta alasan keterlambatan, meskipun tanggal acuannya sebelum hari ini. Barang masuk, keluar, pengembalian dan stok opname bertanggal sebelumnya tetap wajib alasan minimal 10 karakter. Batas 30 hari, larangan masa depan dan audit tidak berubah.

- Input nomor dokumen hanya untuk Barang masuk (Nomor dokumen penerimaan, opsional) serta Barang keluar (Nomor memo/permintaan, opsional). Stok awal, pengembalian, stok opname tidak menawarkan input nomor referensi baru. Kontrak referenceNo dipertahankan; nilai draft/dokumen lama tidak dihapus karena field disembunyikan, ditampilkan sebagai informasi tersimpan. Nomor penyaluran asal tidak disalin menjadi nomor pengembalian baru.

- Ringkasan tidak menampilkan placeholder nomor referensi kosong. Pembatalan dan koreksi stok awal tetap wajib alasan tindakan, termasuk jika dilakukan hari ini. Catatan transaksi tetap opsional. Tidak ada penomoran otomatis baru pada tahap ini.

### Laporan Distribusi Barang

- Laporan membaca dokumen Barang keluar yang tersimpan, tidak menulis stok, tidak menginput distribusi lagi. Cohort berdasarkan tanggal penyaluran; pengembalian/reversal dibatasi tanggal akhir laporan. Nilai asal immutable; penyaluran efektif nol setelah pembatalan pada/sebelum akhir periode. Penyaluran bersih bukan stok atau pemakaian unit.

- Scope inventory.reports.read mengikuti paket yang memuat permission tersebut; master all tidak memperluas reader selected. Detail dan lampiran tetap memerlukan izin transaksi/file. Modal bersama dari laporan tidak menawarkan pembatalan dan menjelaskan perbedaan cutoff laporan dengan status dokumen terkini.

- Rincian/rekap/satuan/filter/keyset/total/Excel memakai service dan snapshot baca yang sama. Ekspor maksimal 5.000 baris, literal, diaudit, no-store, tanpa pemotongan. Jangan menjumlahkan kuantitas lintas satuan atau menampilkan error sebagai statistik nol.

- Tujuan berasal dari transaksi asal, bukan penempatan Pegawai terkini. Default periode awal bulan–hari ini zona organisasi. Perubahan aturan historis harus diuji terhadap return dan pembatalan sebelum/sesudah cutoff. Rancangan/API/uji: docs/inventory-distribution.md.

- Bahasa Inventaris memakai Stok awal/Koreksi stok awal pada UI, validasi dan katalog izin; identifier kontrak opening/balance tetap. Stok Barang default menampilkan yang sudah memiliki transaksi, menyediakan Semua barang/Belum ada transaksi, dan tidak menampilkan stok nol palsu. Tabel ringkas memakai nama/kode barang serta nama gudang. Ringkasan satu barang rata kiri; jumlah transaksi berada dalam Perubahan stok gudang. Label distribusi sederhana tanpa mengubah perhitungan historis.

- Identitas pelaku Inventaris memakai nama pertama dan terakhir dari profil tertaut, fallback username. Avatar memakai komponen bersama dan preview privat berizin, terkait pelaku dokumen sebenarnya; akses Inventaris tidak membuka seluruh profil/dokumen HRIS. Backend, ekspor, rincian, pembatalan dan Kartu Stok memakai aturan identitas yang sama. Uji foto lintas organisasi/scope, target palsu, keyboard serta fallback.

Jabatan di bawah nama pelaku Inventaris berasal dari penempatan utama yang berlaku hari ini menurut timezone organisasi. `ActorIdentity` menerima `position` opsional; profil tanpa jabatan tidak menampilkan keterangan pengganti. Riwayat transaksi menempatkan Disimpan oleh sebelum Status.
