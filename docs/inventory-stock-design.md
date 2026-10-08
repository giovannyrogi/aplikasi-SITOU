# Rancangan Persediaan & Stok dan Manajemen Aset SITOU

Status: hasil diskusi untuk dilanjutkan nanti. Dokumentasi ini tidak mengaktifkan
role, paket akses, tabel, API, menu, atau fitur inventaris/aset.

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

Satu akun, satu profil pegawai, satu role dasar, dan beberapa paket akses per
organisasi. Paket menentukan permission Pembaca/Pengelola serta cakupan gudang
atau lokasi aset. Akses Persediaan dan Aset tidak memberikan akses HRD atau
Superadmin. Fondasi paket akses harus dibangun sebelum kedua modul; sistem
saat ini masih mengevaluasi satu role aktif. Jangan membuat akun ganda untuk profil sama.

## Fondasi implementasi nanti

Ledger stok append-only menjadi sumber saldo. Posting, pembatalan, dan saldo
harus atomik, idempotent, diaudit, serta aman dari pengeluaran bersamaan/stock minus.
Gunakan organization_id dan composite FK, permission backend serta scope eksplisit.
Lampiran memakai stored_files privat, antivirus, dan lifecycle transaksional, serta
harus dikenali pemeliharaan file dan backup. Semua perubahan schema melalui
migration dan pembaruan schema referensi. Daftar/laporan memakai pagination,
total sesuai filter/scope, dan ekspor yang diaudit.
