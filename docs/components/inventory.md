# inventory

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

Rujukan: [Satuan tanpa kode input dan chip master persediaan](../rules/inventory.md#satuan-tanpa-kode-input-dan-chip-master-persediaan).

Tingkat akses Inventaris: PackageAccessFields menampilkan accessFeatureDescription
tepat di bawah pemilih fitur serta batas scope gudang. Lihat Saja tidak mempunyai
submenu master; Pengelola all/selected mempunyai aksi katalog. canManageCatalog
berasal dari permission backend, bukan role atau mode all pada browser.

Spacing bantuan field diatur AppThemeProvider untuk `.ant-form-item-extra`:
8px atas, line-height 1.6, 4px bawah; extra kosong tidak menambah ruang.
PrerequisiteHint memakai gap 8px dan line-height 1.6 dengan tautan target 44px.
Tidak perlu margin tambahan pada pemanggil agar spacing tidak berlipat.

## Pemisahan master dan operasional — migration 050

Rujukan: [Pemisahan master dan operasional — migration 050](../database-schema.md#pemisahan-master-dan-operasional--migration-050).

- Pengelola Gudang (inventory_manager): izin operasional gudang serta minimum barang-gudang dalam scope all/selected. Tidak CRUD katalog/metadata gudang, termasuk scope all. Transaksi stok/ledger belum diimplementasikan; permission transaksi mutasi ditambahkan bersama fitur berikutnya.

CatalogPanel Kategori menampilkan field notes sebagai Catatan pada tabel desktop
(dash jika kosong) dan section Catatan pada kartu mobile hanya jika berisi.
Form kategori memakai label Catatan (opsional), kontrak API notes tetap sama.
Teks catatan dibungkus aman dan justify dengan line-height 1.6.

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

Rujukan: [Revisi stok awal — migration 057](../database-schema.md#revisi-stok-awal--migration-057).

### RelatedRecordAction

`actions/RelatedRecordAction` menampilkan konteks record terkait dan tombol detail sekunder yang terlihat jelas. Gunakan title/description singkat, label tindakan lengkap, warna info dari tema, AppIcon semantik, target minimal 44px, serta loading/disabled. Pada wizard Pengembalian, letakkan di samping pemilih penyaluran pada desktop dan setelah pemilih pada mobile. Membuka detail tidak mengubah isian maupun dirty-state.

### Modal transaksi dan laporan bersama

Rujukan: [Laporan Distribusi Barang](../database-schema.md#laporan-distribusi-barang).

TableExportMenu menerima `formats` opsional (default Excel/PDF). Distribusi memilih `["excel"]` sehingga UI hanya menawarkan format yang sudah tersedia. Perhitungan kartu laporan menggunakan DashboardMetric bersama; error tidak dirender sebagai nilai nol.

Ringkasan transaksi: satu InventoryItemCard rata kiri, beberapa kartu mengikuti grid responsif. Jumlah masuk/keluar/kembali berada dalam kelompok Perubahan stok gudang; jumlah perubahan memakai info/warning, hasil stok memakai statusnya. Stok awal dan seluruh label Inventaris memakai istilah stok, bukan saldo.

`data-display/ActorIdentity` memakai `PhotoAvatar` dan `ImagePreviewModal` untuk nama pelaku serta pas foto dengan target 44px/keyboard. Metadata Inventaris memakai nama pertama–terakhir dari profil tertaut, fallback username; tidak berasal dari akun pembaca. URL avatar tetap `/api/uploads/:fileId`, terikat transaksi/pelaku/konteks baca dan scope gudang terbaru; tidak membuka izin profil HRIS. Ekspor menggunakan nama ringkas yang sama.

Rujukan: [Laporan Distribusi Barang](../rules/inventory.md#laporan-distribusi-barang).

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
