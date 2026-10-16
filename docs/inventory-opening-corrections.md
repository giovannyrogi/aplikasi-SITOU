# Stok awal dan penerimaan terlambat — migration 057

## Aturan pengguna

Stok Awal adalah persediaan sebelum pencatatan operasional, sekali per barang–gudang. Pilihan hanya tersedia jika barang/gudang/link aktif, berizin, dan belum memiliki stok awal maupun transaksi resmi. Draft dan batas minimum bukan transaksi resmi. Pembatalan seluruh transaksi tidak membuka kesempatan membuat stok awal kedua.

Barang Masuk boleh menjadi transaksi pertama, dimulai dari nol tanpa membuat dokumen stok awal nol. Sebelum riwayat tersedia, stok ditampilkan **Belum ada transaksi**. Setelah riwayat dimulai, saldo nol ditampilkan **Habis**. Barang Keluar dan Stok Opname memerlukan riwayat; tanggal pembuatan master tidak membatasi tanggal penerimaan.

Stok awal memakai tanggal acuan stok sebelum pencatatan dimulai. Tanggal sebelumnya tidak memerlukan alasan keterlambatan; batas tanggal 30 hari dan larangan masa depan tetap berlaku. Nomor referensi tidak ditawarkan pada input stok awal baru; nilai lama tetap dipertahankan.

Penerimaan terlambat tetap Barang Masuk, memakai tanggal penerimaan sebenarnya, maksimal 30 hari sebelumnya dan alasan minimal 10 karakter. Tanggal dari zona organisasi/database, bukan jam browser. Jika mendahului stok awal manual, pengguna berizin meninjau tanggal/jumlah stok awal yang benar; tidak mengubah tanggal kejadian agar lolos.

## Koreksi dan izin

`inventory.openings.correct` berasal dari paket tambahan `inventory_opening_corrector`, **Koreksi Stok Awal**. Tidak ada grant otomatis. Pemberi hanya Superadmin atau admin HRD penuh. Penerima harus mempunyai `inventory_manager` dengan cakupan yang mencakup cakupan koreksi. Backend memeriksa kedua permission pada gudang yang sama setiap request. Pengelola Master tidak otomatis mendapat operasional atau koreksi.

Modal menampilkan nilai lama, histori, nilai baru yang ditentukan pengguna, alasan, dan preview. Koreksi mandiri dikonfirmasi sebelum disimpan. Koreksi dari draft disiapkan di form, lalu disimpan atomik bersama penerimaan; kegagalan membatalkan keduanya. Tanggal stok awal paling lambat transaksi operasional pertama; tanggal sama berarti posisi awal hari. Nilai tidak ditebak otomatis.

## API

- `GET /api/inventory/openings?organizationId=...&warehouseId=...&itemId=...`: stok awal asal/efektif, revisions, histori, current, version, fingerprint.
- `POST /api/inventory/openings`: identity yang sama, `action: preview|correct`, UUID `operationId`, `correction: {occurredOn,quantity,reason,version,fingerprint}`. Preview tidak menyimpan. Retry operation identik mengembalikan hasil tersimpan; operasi berbeda dengan UUID sama ditolak.
- Draft/preview/post transaksi menerima `openingCorrections?: [{itemId,occurredOn,quantity,reason,version,fingerprint}]`; hanya Barang Masuk dapat menggabungkan koreksi. Omission tetap kompatibel.
- Preview transaksi mengembalikan `calculationVersions: [{itemId,version,fingerprint}]`; wizard mengirimnya saat commit. Sumber berubah menghasilkan `VERSION_CONFLICT` dan preview ulang. API lama tanpa field tetap divalidasi ulang server.
- Options mengembalikan `canInitializeOpening`, `eligibleWarehouses`, `canCorrectOpening`, `opening_eligible` dan `has_history` per barang. Stok membedakan `has_opening` manual dan `has_history` resmi.

Semua endpoint memeriksa session, modul, organisasi dan scope; respons private/no-store, validasi fieldErrors serta requestId untuk kegagalan internal. Error bisnis menunjuk penyebab pasti, barang/gudang/tanggal/jumlah. Gangguan saat commit diperiksa melalui UUID transaksi sebelum retry; bila status belum diketahui, UI tidak mengklaim gagal atau berhasil.

## Mesin dan penyimpanan

`replay.mjs` memakai BigInt satuan 1/1000. Satu mesin menghitung preview/post/cancel/correction; stok dan Kartu Stok membaca hasil proyeksi yang sama.

- `inventory_opening_revisions`: append-only, FK organisasi, baris asal, revisi sebelumnya, actor/waktu server, alasan, UUID operasi.
- `inventory_stock_projection`: tanggal efektif, selisih efektif dan saldo per baris ledger, data turunan.
- `inventory_stock_calculations`: versi per barang–gudang, state legacy/active.

Dokumen/ledger asli tetap immutable. Stocktake mempertahankan hasil fisik, menghitung ulang delta terhadap saldo sebelumnya. Reversal pada tanggal pembatalan memakai kebalikan delta efektif asal, termasuk stocktake. Saldo negatif pada tanggal mana pun ditolak, menyebut titik pertama yang negatif. Input retro pada hari yang sama dengan stocktake ditolak khusus karena jam kejadian belum tersedia. Kartu Stok menandai hasil yang dihitung ulang dan menyertakan tanggal/delta asal pada DTO.

## Rollout terkontrol

Migration 057 menyalin proyeksi legacy **persis dari ledger lama**, tidak menulis ulang saldo atau dokumen. Perbedaan replay legacy memblokir mutation dengan `REPLAY_REVIEW_REQUIRED`. Pasangan yang matematis tetap sama dapat menjalankan transaksi baru; perubahan yang dihasilkan berasal dari operasi tersebut.

1. Uji migration dan bootstrap pada database terpisah; backup sesuai aturan proyek sebelum penerapan.
2. Jalankan `node scripts/replay-inventory-stock.mjs --database=NAMA --report=laporan.json`. Default read-only; laporan memuat organisasi, barang/gudang, nilai lama/baru, checkpoint berubah, error dan fingerprint sumber.
3. Tinjau setiap selisih. Laporan invalid tidak bisa diaktifkan. **Persetujuan manusia wajib sebelum aktivasi**; simpan `approved: true` hanya setelah peninjauan dan persetujuan.
4. Aktivasi eksplisit: `node scripts/replay-inventory-stock.mjs --database=NAMA --report=laporan.json --activate --actor=ID_SUPERADMIN`. Verifikasi Superadmin aktif, lock pasangan, fingerprint sama; perubahan saldo/proyeksi/audit seluruhnya atomik. Sumber berubah mengharuskan dry-run ulang.
5. Smoke test memakai profil uji; periksa stok, kartu, penerimaan retro dan permission. Tidak ada aktivasi produksi otomatis dari build/migration.

Rujukan prinsip: [Zoho opening stock](https://www.zoho.com/us/inventory/kb/items/item-initial-stock.html), [ERPNext repost](https://docs.frappe.io/erpnext/repost-item-valuation), [Odoo physical count](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/count_products.html). Detail pembatasan tanggal, izin koreksi, dan transaksi atomik adalah keputusan produk SITOU.
