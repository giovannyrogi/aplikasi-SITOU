# Kartu mobile Data Master dan Inventaris

## Acuan dan keputusan

Acuan utama adalah kartu Rekap Stok/Distribusi Barang SITOU. Referensi eksternal: [Carbon Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) untuk hierarki, pengelompokan, konsistensi dan akses aksi; [Material color roles](https://m3.material.io/styles/color/the-color-system/color-roles) untuk pembedaan permukaan netral dengan warna penekanan. Alur barang/perubahan stok juga ditinjau dari [Zoho Inventory mobile](https://www.zoho.com/us/inventory/mobile-apps/). Implementasi tetap memakai token tema, font dan komponen SITOU; tidak meniru warna produk lain atau menambah informasi palsu.

## Komponen dan informasi

InventoryMobileCardContent adalah susunan slot bersama. InventoryReportCardContent tetap kompatibel sebagai alias. ResponsiveDataView menyediakan bingkai tunggal, nomor, loading/kosong/gagal dan typography mobile minimal 14px. Identitas dan angka utama tetap lebih besar melalui FontStyle; tidak mengurangi ukuran teks per fitur. Gap antarbagian 24px, fakta 16px, label/nilai 8px. Tombol teks di bawah divider minimal 44px, lebar penuh dan dapat membungkus. Tidak menaruh ikon edit kecil sendirian di samping nama pada mobile.

- Kategori Barang: ikon kategori brand, nama, chip kode, status dan Catatan jika ada. Edit kategori langsung membuka form yang sama.
- Satuan Barang: ikon penggaris, nama/status dan Aturan jumlah (Angka bulat atau Pecahan diizinkan). Tidak menampilkan kode internal satuan. Edit satuan langsung membuka form yang sama.
- Gudang: ikon gudang, nama, chip kode, status dan Lokasi. Edit hanya jika row.canEdit.
- Stok Barang: foto privat/fallback dan pratinjau yang sama, kondisi stok, Gudang, Batas minimum dan Stok tersedia (penekanan). Tanpa histori tetap Belum ada transaksi, bukan angka nol buatan. Lihat kartu stok, Atur batas minimum dan Koreksi stok awal hanya sesuai izin existing.
- Transaksi Barang: jenis dengan ikon/warna semantik, status, tanggal, gudang dan referensi bila tersedia. Maksimal dua barang menampilkan jumlah asli dan perubahan masing-masing; bila lebih, jumlah barang lainnya disebut dan seluruh rincian tersedia di modal. Tidak menjumlahkan angka berbeda satuan atau menafsirkan hasil opname sebagai jumlah penerimaan. Dokumen dibatalkan mempertahankan angka asal dan penjelasan stok dikembalikan. Pelaku dari DTO server. Lihat detail transaksi memakai modal bersama.

Transaksi mobile di bawah 768px menggunakan ResponsiveDataView; tablet/desktop mempertahankan ledger. Rentang tanggal Transaksi Barang dan Kartu Stok menggunakan ResponsiveRangePicker dengan perubahan atomik serta batal tanpa mengubah filter. Kartu Stok juga memakai susunan kartu bersama dan pagination pada slot tetap AppModal. Tidak mengubah sumber ledger, perhitungan, filter SQL, permission, scope, draft, mutation maupun audit. Barang Persediaan dan komponen galeri tetap seperti sebelumnya.

## Verifikasi

Periksa kelima menu pada 320–1920px, layar pendek, nama/kode panjang, chip nonaktif, notes kosong/panjang, pecahan, stok nol/tanpa histori, transaksi banyak barang dan dibatalkan. Cek label dan lebar aksi minimal 44px, form/detail tanpa menyimpan, pencarian/reset, pagination, tanggal lintas bulan dan pembatalan kalender. Pastikan hanya scroll lokal desktop yang diperlukan, tanpa overflow horizontal halaman mobile. Uji laporan kembali karena slot digunakan bersama. Fixture UI hanya untuk kasus tepi dan tidak mengubah record bisnis.

## Hasil verifikasi lokal — 20 Oktober 2026

Lint dan build produksi lulus. Chrome memeriksa kelima halaman dengan data nyata pada 320/375/600/767/768/1280/1920px dan tinggi 568px: tombol footer selebar isi minimal 44px, form edit langsung/detail tanpa menyimpan, kalender batal, pagination modal tetap saat digulir, serta tabel/ledger desktop. Rekap Stok dan Distribusi Barang diuji kembali karena slot kartu dipakai bersama. Fixture browser memeriksa nama/kode/catatan panjang, pecahan, stok tanpa histori, transaksi dibatalkan dengan tiga barang berbeda satuan, aksi lihat saja, kosong, serta gagal/coba lagi. Tidak ada error JavaScript atau overflow horizontal halaman. Tidak mengubah record bisnis. Berkas dan server uji sementara dibersihkan.

### Identitas dan ikon kartu

InventoryCardIdentity menempatkan status di bawah nama/jenis pada kolom teks; jika ada kode, kode dan status sejajar dalam baris flex wrap. Ikon 48px dengan glyph 24px disejajarkan tengah terhadap blok nama/metadata, bukan membuat status di bawah ikon. Master memakai pensil outline EditOutlined untuk aksi edit, bukan ikon pensil di dalam kotak filled. KindMark menerima ukuran opsional; ukuran bawaan di tabel/modal lain tetap sama.

Pemeriksaan penyesuaian identitas lulus pada 320/375/600px: status tepat di kolom nama, kode/status sebaris saat ruang cukup, ikon 48px sejajar tengah, pensil outline dan pembukaan form, serta pembungkusan nama/kode panjang pada status nonaktif/dibatalkan. Lint/build lulus; fixture, tangkapan layar dan server uji dibersihkan.
