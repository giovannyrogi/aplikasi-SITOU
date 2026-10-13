# Laporan Distribusi Barang

Menu canonical: `/reports/inventory-distribution`; API: `GET /api/inventory/distribution`.
Laporan hanya membaca penyaluran resmi; tidak membuat transaksi, saldo penerima, permintaan, approval, atau perubahan stok.

## Periode dan jumlah

- `from`–`to` memilih **tanggal kejadian penyaluran**, inklusif. Bawaan awal bulan sampai hari ini dari zona organisasi.
- Pengembalian terkait dan pembatalannya dihitung sampai `to`, termasuk pengembalian setelah tanggal penyaluran. Pengembalian dari penyaluran sebelum `from` tidak termasuk cohort laporan ini.
- Pembatalan penyaluran baru menghapus efek penyalurannya jika tanggal pembatalan pada/sebelum `to`. Pembatalan setelah akhir periode tidak mengubah angka periode sebelumnya.
- `original_quantity`: jumlah dokumen asal yang tetap immutable.
- `distributed_quantity`: jumlah efektif penyaluran (nol jika dibatalkan sampai tanggal akhir).
- `returned_quantity`: pengembalian terkait yang masih berlaku sampai tanggal akhir.
- `net_quantity`: penyaluran efektif dikurangi pengembalian. **Bukan stok penerima atau bukti pemakaian.**
- Stok opname, saldo awal, koreksi saldo awal, dan penerimaan tidak menjadi penyaluran; tidak dijumlahkan pada laporan ini. Rumus saldo gudang tidak diubah.

Tujuan lokasi/unit dan penerima berasal dari header transaksi asal. Rolling Pegawai tidak memindahkan histori distribusi. Nama master/profil dibaca dari referensi saat laporan dibuat; ID tujuan transaksi tetap asal. Data nonaktif tetap dapat dibaca untuk histori.

## Filter dan tampilan

Filter: organisasi (Superadmin), tanggal awal/akhir, gudang asal, barang, lokasi tujuan, Divisi & Unit tujuan, Pegawai penerima, nama/kode barang/penerima/nomor memo, status `effective|cancelled|all`, tampilan `details|summary`. Semua filter digabung sebagai irisan.

- Rincian: satu baris per barang dalam satu transaksi penyaluran, jumlah efektif/return/bersih, status pada akhir periode, dan rincian transaksi berizin.
- Rekap: per gudang–barang–lokasi–unit, jumlah transaksi serta kuantitas per satuan barang. Aksi membuka rincian dengan dimensi yang sama.
- Kartu jumlah transaksi, jenis barang, pasangan lokasi/unit tujuan, penerima mengikuti seluruh filter/status. Tidak ada penjumlahan lintas satuan.
- Pagination keyset, ukuran 10/20/50, cursor terikat seluruh filter dan scope. Hasil, total dan metrik dibaca pada snapshot PostgreSQL `REPEATABLE READ READ ONLY` yang sama; tanpa cache payload.
- Loading/error/kosong dibedakan. Error tidak ditampilkan sebagai statistik nol.

## Hak akses dan rincian

Semua API dan halaman memakai `inventory.reports.read`, modul aktif dan scope gudang server terbaru. Lihat Saja/Pengelola Gudang memperoleh hak melalui paket operasional. HRD penuh atau Pengelola Master tidak otomatis membaca distribusi tanpa paket yang sesuai. Grant master all tidak memperluas scope laporan reader selected.

Tombol detail memerlukan `inventory.transactions.read` pada gudang sumber. Modal bersama `TransactionDetailModal` mempertahankan foto/preview/PDF privat; dari laporan tidak ada tombol pembatalan. Modal menjelaskan bahwa status dokumen adalah status terkini, sedangkan angka laporan dibatasi tanggal akhir. Endpoint lampiran tetap memeriksa izin saat dibuka.

Respons memakai `private, no-store`; organisasi tidak diambil dari body yang dipercaya. Pembacaan lintas organisasi Superadmin eksplisit dan diaudit. Pencabutan/modul nonaktif berlaku pada request berikutnya.

## Ekspor

`export=xlsx` memakai filter/view/scope/periode yang sama, seluruh baris maksimal 5.000. Lebih dari batas ditolak dengan pesan dan field error, tanpa pemotongan. Lima ekspor per lima menit. Ekspor berhasil diaudit; file tidak menyimpan object key, ID file privat, NIK, rekening, atau data profil sensitif.

Workbook berisi Petunjuk dan Distribusi, waktu server menurut zona organisasi, cutoff pengembalian/pembatalan, filter, serta satuan per barang. Teks selalu literal, bukan formula; kuantitas yang melebihi ketelitian aman JavaScript ditulis sebagai teks desimal tepat. Tidak membuat penomoran dokumen baru.

## Database dan pengujian

Tidak perlu migration: memakai `inventory_transactions`, `inventory_transaction_lines`, referensi organisasi, dan `audit_logs` yang sudah ada. Return memakai source_line_id dan reversal memakai reversal_of_id; join agregasi/batch, bukan N+1. Ledger dan balances tidak diubah.

Jalankan `npm run test:inventory-distribution:http`. Runner bootstrap database terpisah, menguji periode sebelum/setelah return dan reversal, status, scope/gabungan master, organisasi, modul, session dicabut, keyset, export literal/audit/batas, tujuan sesudah rolling, EXPLAIN, modal read-only, serta browser 320–1920. Database uji dibersihkan otomatis.
