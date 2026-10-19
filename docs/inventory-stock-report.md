# Rekap Stok

Laporan → Rekap Stok (`/reports/inventory-stock`) mengikuti format laporan stok periodik: No, Nama barang, Satuan, Stok awal, Barang masuk, Jumlah stok, Barang keluar, Stok akhir. Gudang ditampilkan terpisah jika semua gudang dipilih. Satu baris per barang–gudang; tidak menjumlahkan barang atau satuan berbeda.

## Perhitungan

Sumber tunggal adalah `inventory_stock_projection`, melalui pergerakan dengan transaksi resmi `posted`, sama dengan Kartu Stok. Tidak membuat ledger, saldo, atau isian laporan baru. Stok awal = jumlah efek sebelum awal periode. Masuk = seluruh efek positif selama periode; keluar = nilai absolut seluruh efek negatif selama periode. Jumlah stok = awal + masuk; akhir = jumlah stok − keluar. Tanggal awal/akhir inklusif. Transaksi Stok awal yang terjadi dalam periode termasuk masuk, bukan saldo sebelum periode. Pengembalian, opname dan pembatalan dikategorikan menurut tanda efek efektifnya. Pembatalan mempertahankan pergerakan asal dan pergerakan pembatalan pada tanggal masing-masing, bukan menghilangkan histori sebelum tanggal pembatalan. Koreksi/penerimaan terlambat dapat memperbarui laporan historis sesuai mesin replay; Excel mencantumkan waktu pembuatan.

Barang dengan histori sampai akhir periode tetap tampil, termasuk saldo nol, tanpa pergerakan dalam periode, atau master nonaktif. Barang tanpa histori sampai akhir periode tidak dianggap stok nol terhitung. Identitas barang memakai InventoryItemPhoto bersama: foto privat dapat diperbesar dengan ImagePreviewModal, fallback ikon bila tidak ada/gagal dimuat. Nama diikuti kode dan satuan. Kolom Keterangan tidak ditampilkan pada desktop, mobile maupun Excel. Ikon navigasi Rekap Stok memakai navigation:inventory-stock-report (clipboard-check bold duotone lokal).

## Filter dan UI

Cari barang (nama/kode, debounce, sebelum periode), Periode laporan (RangePicker bersama), Gudang, Kategori barang, Nama barang (Nama · Kode · Satuan, AsyncSelect). Default awal bulan–hari ini zona organisasi. Hapus/reset periode mengembalikan default. Superadmin memilih satu organisasi. Tidak ada kartu ringkasan tambahan. Desktop tabel, mobile kartu berlabel, DataPagination 10/20/50 dengan total/jumlah tampil aktual.

Aksi Lihat rincian stok membuka AppModal Kartu Stok dengan barang/gudang/periode yang sama dan ringkasan lima angka. Pagination tetap pada slot di luar body gulir. Detail berisi tanggal/jenis/masuk/keluar/saldo; dokumen transaksi hanya dapat dibuka dengan `inventory.transactions.read` pada gudang yang sama. Modal dokumen tidak menawarkan mutation. Rincian stok dan dokumen tidak ditumpuk; saat kembali halaman/posisi rincian dipertahankan. Request dibatalkan saat ditutup/berubah. Loading, kosong, gagal/coba lagi tersedia.

## API dan akses

Saat ikon mata dipilih, loading backdrop bersama tampil selama pengambilan dan pembacaan respons sampai detail transaksi disiapkan. Backdrop dilepas juga saat request gagal atau dibatalkan; pesan gagal tetap tampil pada Kartu Stok.

`GET /api/inventory/stock-report`: daftar; `options=1`: pilihan; `action=history` + warehouseId/itemId: rincian; `export=xlsx`: seluruh hasil (maksimal 5.000, lebih ditolak tanpa pemotongan). Mode tidak digabungkan. Memakai `inventory.reports.read` dari fitur Inventaris dan scope gudang aktual, bukan akses HRIS/master. Organisasi ditentukan/dicocokkan sesi. Rincian report-only tidak memerlukan `inventory.stock.read` dan tidak membuka dokumen/file. ID transaksi dihilangkan jika izin transaksi tidak tersedia. Cursor HMAC 30 menit terikat akun, organisasi, scope, filter, mode dan ukuran halaman. Setiap request memeriksa akses terbaru. Daftar/total dibaca dalam snapshot repeatable-read. Respons private/no-store; ekspor dan akses Superadmin diaudit. Ekspor memakai batas frekuensi dan validasi origin yang sama dengan Distribusi Barang.

Excel memiliki dua sheet: Informasi Laporan pertama memuat organisasi, gudang, periode, waktu, filter dan rumus melalui helper reportWorkbookInfo bersama Distribusi Barang. Sheet Rekap Stok kedua hanya memuat tabel sesuai urutan foto, tanpa Aksi; header mulai baris 1, freeze/autofilter/judul cetak baris 1, border dan cetak landscape. Teks literal (bukan formula); pecahan maksimal tiga digit; angka di luar presisi aman Excel disimpan sebagai teks. Tidak perlu migration atau grant otomatis baru karena menggunakan permission/proyeksi existing.

## Verifikasi

Periksa periode penuh/subperiode/tanpa pergerakan, stok awal dalam periode, penerimaan, pengembalian, opname positif/negatif, pembatalan sebelum/setelah cutoff, koreksi, master nonaktif, pecahan dan saldo nol. Cocokkan awal/akhir dan rincian dengan Kartu Stok. Uji paging >10 tanpa duplikasi, cursor akun/filter/scope berbeda ditolak, organisasi/gudang tanpa izin ditolak, report-only tanpa ID dokumen, batas ekspor dan audit. Periksa 320px–1920px serta pagination modal tetap terlihat.

## Hasil verifikasi lokal — 19 Oktober 2026

Lint dan build produksi lulus. SQL diuji dengan tabel sementara transaksional (rollback): isolasi organisasi/scope, cutoff, stok awal sebelum/dalam periode, penerimaan/pengeluaran/pengembalian, opname, pembatalan, draft, pecahan, tanpa pergerakan dan keyset lebih dari 10 baris. Excel dibaca ulang untuk urutan header, angka dan pengaturan cetak. API nyata diperiksa untuk tiga barang lokal, kecocokan awal/akhir Kartu Stok, ekspor, no-store, sesi kosong, organisasi/gudang tidak berizin, cursor rusak serta rentang invalid. Browser Chrome memeriksa 320/375/768/1440/1920px, tanpa overflow horizontal halaman, modal/pagination tetap, pencarian/reset dan tanpa error JavaScript. Tidak mengubah histori bisnis; fixture SQL dibatalkan dan berkas uji dibersihkan.
