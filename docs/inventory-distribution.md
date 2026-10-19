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
- Stok opname, stok awal, koreksi stok awal, dan penerimaan tidak menjadi penyaluran; tidak dijumlahkan pada laporan ini. Rumus saldo gudang tidak diubah.

Tujuan lokasi/unit dan penerima berasal dari header transaksi asal. Rolling Pegawai tidak memindahkan histori distribusi. Nama master/profil dibaca dari referensi saat laporan dibuat; ID tujuan transaksi tetap asal. Data nonaktif tetap dapat dibaca untuk histori.

## Filter dan tampilan

Filter: organisasi (Superadmin), Cari data (nama/kode barang, penerima atau nomor memo), Periode penyaluran melalui DatePicker.RangePicker bersama, gudang asal, Nama barang, lokasi tujuan, Divisi & Unit tujuan, Pegawai penerima, status `effective|cancelled|all`. Semua filter digabung sebagai irisan.

- Rincian: satu baris per barang dalam satu transaksi penyaluran, jumlah efektif/return/bersih, status pada akhir periode, dan rincian transaksi berizin.
- Halaman berfokus pada filter dan tabel, tanpa empat kartu ringkasan transaksi/barang/tujuan/penerima. Total/pagination tetap memakai filter yang sama. Tidak ada penjumlahan lintas satuan.
- Pagination keyset, ukuran 10/20/50, cursor terikat seluruh filter dan scope. Hasil dan total dibaca pada snapshot PostgreSQL `REPEATABLE READ READ ONLY` yang sama; tanpa cache payload.
- Loading/error/kosong dibedakan. Error tidak ditampilkan sebagai statistik nol.

## Hak akses dan rincian

Semua API dan halaman memakai `inventory.reports.read`, modul aktif dan scope gudang server terbaru. Lihat Saja/Pengelola Gudang memperoleh hak melalui paket operasional. HRD penuh atau Pengelola Master tidak otomatis membaca distribusi tanpa paket yang sesuai. Grant master all tidak memperluas scope laporan reader selected.

Tombol detail memerlukan `inventory.transactions.read` pada gudang sumber. Modal bersama `TransactionDetailModal` mempertahankan foto/preview/PDF privat; dari laporan tidak ada tombol pembatalan. Modal menjelaskan bahwa status dokumen adalah status terkini, sedangkan angka laporan dibatasi tanggal akhir. Endpoint lampiran tetap memeriksa izin saat dibuka.

Respons memakai `private, no-store`; organisasi tidak diambil dari body yang dipercaya. Pembacaan lintas organisasi Superadmin eksplisit dan diaudit. Pencabutan/modul nonaktif berlaku pada request berikutnya.

## Ekspor

`export=xlsx` memakai filter/scope/periode yang sama, seluruh baris maksimal 5.000. Lebih dari batas ditolak dengan pesan dan field error, tanpa pemotongan. Lima ekspor per lima menit. Ekspor berhasil diaudit; file tidak menyimpan object key, ID file privat, NIK, rekening, atau data profil sensitif.

Workbook berisi Informasi Laporan pada sheet pertama (helper reportWorkbookInfo bersama Laporan Stok): waktu server menurut zona organisasi, cutoff pengembalian/pembatalan dan filter. Sheet Distribusi kedua hanya berisi tabel data mulai header baris 1, dengan satuan per barang. Teks selalu literal, bukan formula; kuantitas yang melebihi ketelitian aman JavaScript ditulis sebagai teks desimal tepat. Tidak membuat penomoran dokumen baru.

## Database dan pengujian

Tidak perlu migration: memakai `inventory_transactions`, `inventory_transaction_lines`, referensi organisasi, dan `audit_logs` yang sudah ada. Return memakai source_line_id dan reversal memakai reversal_of_id; join agregasi/batch, bukan N+1. Ledger dan balances tidak diubah.

Jalankan prosedur verifikasi fitur. Runner bootstrap database terpisah, menguji periode sebelum/setelah return dan reversal, status, scope/gabungan master, organisasi, modul, session dicabut, keyset, export literal/audit/batas, tujuan sesudah rolling, EXPLAIN, modal read-only, serta browser 320–1920. Database uji dibersihkan otomatis.

Label laporan menggunakan Jumlah disalurkan, Dikembalikan, dan Penyaluran bersih. Filter Status penyaluran default Semua status, mencakup Berlaku dan Dibatalkan sesuai tanggal akhir periode. Berlaku berarti belum ada pembatalan sampai tanggal akhir; pengembalian sebagian/penuh tidak mengubah status ini. Dibatalkan berarti pembatalan sudah berlaku sampai tanggal akhir. Status memakai kolom tersendiri pada desktop dan chip terpisah pada kartu mobile; identitas barang hanya memuat foto, nama, kode, dan satuan. Penjelasan perhitungan pada ekspor Excel tetap tersedia. Aturan perhitungan historis dan kontrak DTO tidak berubah.

Identitas pencatat memakai nama pertama–terakhir dari profil Pegawai pada organisasi dokumen, atau profil platform, dengan fallback username. DTO rincian membawa actor_photo_file_id saja; tidak mengirim data profil lain. Avatar melalui GET /api/uploads/:fileId dengan inventoryActorTransactionId, inventoryActorRole=creator|cancelled dan inventoryActorView=transaction|stock|distribution. Server mencocokkan foto aktif milik pelaku dokumen dan memeriksa izin/konteks/gudang terbaru, lalu memeriksa file serta mengaudit preview. Scope Inventaris tidak membuka akses foto/profil HRIS umum. Ekspor memakai actor_name ringkas yang sama.

Format jumlah pada Excel mengikuti presisi setiap nilai: bilangan bulat tanpa pemisah desimal, pecahan maksimal tiga desimal tanpa nol tambahan. Jangan memakai format desimal opsional `#,##0.###` yang dapat menghasilkan titik/koma kosong. Jumlah biasa tetap numeric; jumlah di luar batas presisi aman tetap teks agar tidak dibulatkan.

Catatan pemeliharaan: runner pengujian otomatis dan folder tests dihapus atas keputusan proyek. Uraian pengujian di atas menjadi acuan pemeriksaan; perintah pengujian lama tidak tersedia. Gunakan lint, build, dan smoke test di lingkungan terpisah untuk perubahan berikutnya.

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
