# Pemeliharaan Penyimpanan File

Khusus Superadmin. Pilih satu organisasi, jalankan pemeriksaan, lalu pilih **Bersihkan**
untuk kandidat yang tidak digunakan. Setiap tabel, kartu, riwayat, preview, dan
konfirmasi menampilkan organisasi asal dari server.

## Klasifikasi

| Kondisi | Hasil / tindakan |
|---|---|
| Masih dirujuk profil, histori, versi dokumen atau data organisasi dan valid | Tidak tampil |
| Tanpa referensi, termasuk kontrak/cuti/penempatan | Siap dibersihkan → Bersihkan |
| File tanpa catatan, berumur minimal 24 jam | Siap dibersihkan → Bersihkan |
| Catatan tanpa referensi dan file hilang | Siap dibersihkan → Bersihkan catatan |
| File dirujuk tetapi hilang | Integritas & pemulihan → Unggah pemulihan |
| File dirujuk tetapi status terhapus | Integritas & pemulihan → Pulihkan status |
| Scanner gagal pada file dirujuk | Integritas & pemulihan → Periksa antivirus |
| Path, izin atau provider bermasalah | Petunjuk perbaikan server dan Validasi ulang |
| Terinfeksi | Karantina privat / Ancaman keamanan → Hapus permanen |
| Karantina biasa | Pulihkan atau Hapus permanen |

Kategori resmi dan employee_id bukan bukti bahwa file masih digunakan. Referensi
histori tetap dilindungi tanpa menyaring status akhir pegawai. Draft aktif dan
upload baru dilindungi. Inventaris filesystem mencocokkan semua lifecycle agar
arsip retained/purged/quarantined tidak dianggap file tanpa catatan.

## Eksekusi dan keamanan

Scan tidak menghapus kandidat. Pembersihan manual terkonfirmasi menghapus permanen,
tanpa tambahan masa tunggu tujuh hari. Status scanner gagal/belum diperiksa tidak
menghalangi penghapusan file tanpa referensi. Preview/unduh tetap hanya untuk clean.
Pemeriksaan antivirus ulang menjalankan scanner pada file yang belum bersih.

Worker memeriksa referensi, organisasi, path, symlink, ukuran dan hash ulang.
Transaksi penghapusan menggunakan lock singkat pada tabel referensi dan stored_files
untuk mencegah pengaitan file bersamaan; lock timeout menyebabkan retry.
File dipindahkan sementara sebelum commit, dipulihkan jika rollback, lalu dihapus.
Ini mekanisme pemulihan transaksi, bukan karantina tujuh hari. Metadata menjadi
purged; catatan file dan audit tetap tersedia. Hanya ENOENT berarti file hilang.

Pemulihan wajib memakai file asli dengan ukuran, MIME, SHA-256 yang cocok dan ClamAV
clean. File terinfeksi tidak boleh dibuka, diunduh, atau dipulihkan. Karantina ancaman
tetap tujuh hari atau dihapus lebih awal dengan konfirmasi.

API tetap memakai endpoint runs/:id/cleanup, items/:itemId/content, recovery,
resolve, serta quarantine/:id/restore dan purge. Cleanup menerima kandidat dengan
atau tanpa catatan database. Respons publik tidak memuat object key/path/hash.
Aksi lama stage_cleanup/retain_official dipertahankan untuk kompatibilitas klien;
UI baru memakai kandidat hasil scan terbaru dan endpoint cleanup.

## Worker dan rollout VPS

Jalankan web dan worker dengan revisi yang sama:

```bash
pm2 startOrReload ecosystem.config.js
pm2 save
pm2 status
```

Pastikan sitou dan sitou-file-cleanup-worker online serta UPLOAD_ROOT menunjuk mount
persisten yang sama. Update ini tidak mengubah migration 036 atau schema database.
Jalankan scan baru setelah deployment; jangan memakai hasil lama sebagai bukti
bahwa file boleh dihapus. Worker tetap memeriksa kondisi terkini pada setiap aksi.

## Diagnosis koneksi

UI menampilkan kegagalan jaringan dalam Bahasa Indonesia, satu pesan koneksi dengan
Coba lagi, polling berurutan, dan membatalkan request saat organisasi/halaman berubah.
Respons API mempertahankan request ID ketika tersedia.

“Failed to fetch” di VPS belum dapat dipastikan hanya dari screenshot. Cocokkan waktu
dan endpoint request gagal pada Network/Console browser dengan:
`pm2 logs sitou --lines 100`, log reverse proxy, status worker, HTTPS/certificate,
dan kebijakan CSP. Jangan membagikan cookie, token, isi file, atau konfigurasi rahasia.
Pesan yang lebih jelas tidak membuktikan penyebab jaringan telah diperbaiki.

## Verifikasi

- `node scripts/test-storage-reference-cleanup-db.mjs`: membuat database bootstrap
  serta direktori upload sementara; menguji dokumen resmi tanpa referensi, orphan,
  file hilang, race referensi, organisasi berbeda, dan retry tanpa data pengguna.
- `node --test tests/storage-maintenance.test.mjs tests/storage-reference-policy.test.mjs`
- `npm run test:storage-maintenance:http`: pemeriksaan akses Superadmin/HRD terhadap server lokal.
- Lint, build produksi, dan regresi upload pegawai tetap wajib.
