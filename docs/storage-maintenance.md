# Pemeliharaan Penyimpanan File

Fitur ini tersedia khusus Superadmin melalui menu **Pemeliharaan Sistem > Penyimpanan File**. Pilih satu organisasi, jalankan pemeriksaan, tinjau hasil, pilih kandidat aman, lalu setujui konfirmasi penghapusan permanen.

Hasil dibagi menjadi **Siap dibersihkan**, **Karantina**, **Integritas & pemulihan**,
**Ancaman keamanan**, dan **Riwayat proses**. File aktif atau histori resmi yang masih
memiliki referensi tidak ditampilkan. Preview gambar/PDF dan unduhan hanya tersedia
setelah ClamAV memberi status `clean`; file `infected` hanya menampilkan metadata
ancaman dan tidak pernah dapat dibuka atau diunduh.

Pada tab **Integritas & pemulihan**, aksi **Lihat hubungan file** membuka modal yang
menjelaskan organisasi, pegawai terkait, referensi bisnis, status antivirus, dampak,
dan tindakan yang tersedia. Superadmin menyelesaikan pemulihan dari modal ini tanpa
berpindah ke halaman detail pegawai yang bergantung pada membership organisasi.

Klasifikasi hasil mengikuti kepastian kondisi:

- File dengan referensi bisnis valid dan byte tersedia tidak ditampilkan.
- File tanpa referensi yang aman dibersihkan masuk **Siap dibersihkan** setelah masa tunggu.
- Metadata aktif tanpa referensi memerlukan persetujuan **Pindahkan ke pembersihan**;
  server memeriksa ulang referensi, hash, ukuran, MIME, ClamAV, dan kategori sebelum
  memulai masa aman tujuh hari.
- **Isi file aktif tidak ditemukan** hanya digunakan bila metadata masih dirujuk data
  bisnis tetapi byte benar-benar tidak ada di storage. Tindak lanjutnya adalah unggah
  file yang sama dari backup.
- Bila byte tidak ada dan tidak ada referensi bisnis, Superadmin dapat menyelesaikan
  catatan pembersihan setelah pemeriksaan ulang server.
- Dokumen histori resmi tidak dapat dipindahkan ke pembersihan; tindakannya adalah
  pemulihan byte/referensi atau retensi sebagai arsip resmi.

## Menjalankan worker

API hanya memasukkan pekerjaan ke antrean. Jalankan worker sebagai proses terpisah dari server web:

```powershell
npm run worker:file-cleanup
```

Untuk memproses satu pekerjaan lalu berhenti saat pengujian:

```powershell
npm run worker:file-cleanup -- --once
```

Production harus menjalankan worker sebagai service yang otomatis hidup kembali. Pengambilan job memakai `FOR UPDATE SKIP LOCKED` dan pembersihan per file tetap idempotent.

Repository sudah mendaftarkan server web dan satu worker pada `ecosystem.config.js`. Setelah deployment, muat ulang keduanya melalui PM2:

```bash
pm2 startOrReload ecosystem.config.js
pm2 save
```

Jalankan `pm2 startup` satu kali pada VPS dan ikuti perintah yang ditampilkan agar daftar proses hasil `pm2 save` dipulihkan setelah server reboot. Pastikan `pm2 status` menampilkan `sitou` dan `sitou-file-cleanup-worker` dalam keadaan `online`.

Saat antrean kosong worker memeriksa pekerjaan baru setiap dua detik. Halaman menampilkan **Menunggu worker** selama pekerjaan masih berstatus `queued`, kemudian **Pemeriksaan berjalan** atau **Pembersihan berjalan** setelah worker mengambilnya. Antrean yang belum diambil dapat dibatalkan dari pemberitahuan halaman atau tab riwayat.

## Aturan keamanan

- Pemeriksaan selalu dibatasi ke satu organisasi.
- Hanya file profil replaceable yang sudah nonaktif minimal tujuh hari yang dapat menjadi kandidat.
- Kandidat wajib memiliki nol referensi pada seluruh tabel bisnis.
- Dokumen histori resmi tidak pernah dibersihkan melalui fitur ini.
- Worker memeriksa ulang status, organisasi, kategori, umur, provider, path, object key, dan referensi tepat sebelum karantina.
- File yang berubah setelah pemeriksaan dilewati dan alasannya disimpan.
- Metadata file dan audit tidak dihapus setelah byte berhasil dibersihkan.
- Byte tanpa metadata dikarantina tujuh hari dan dapat dipulihkan sebelum tenggat.
- File terinfeksi otomatis dikarantina, tidak dapat dipulihkan lewat UI, dan dihapus
  otomatis setelah tujuh hari atau lebih awal setelah konfirmasi Superadmin.
- Dokumen histori resmi yang terlepas hanya dapat dipulihkan referensinya atau
  dipertahankan sebagai arsip; menu ini tidak menyediakan aksi hapus untuk dokumen tersebut.
- Isi file aktif yang hilang hanya dapat dipulihkan dari backup dengan file yang sama persis.
  Server mencocokkan ukuran, MIME dari byte, dan SHA-256, lalu mewajibkan hasil ClamAV
  `clean` sebelum melakukan pemulihan atomik dan mencatat audit.

## Endpoint tindakan

Seluruh endpoint berikut mewajibkan `storage_maintenance.manage`, memilih organisasi
secara eksplisit, dan mengaudit akses atau perubahan. Endpoint isi file juga memakai
respons `private, no-store`, `nosniff`, dan CSP sandbox:

- `GET /api/system/storage-maintenance/runs/:runId/items/:itemId/content` untuk preview/unduh file bersih.
- `POST /api/system/storage-maintenance/runs/:runId/items/:itemId/quarantine` untuk orphan bersih.
- `POST /api/system/storage-maintenance/runs/:runId/items/:itemId/recovery` untuk pemulihan byte dari backup.
- `POST /api/system/storage-maintenance/runs/:runId/items/:itemId/resolve` untuk pemulihan metadata atau retensi arsip resmi.
- `POST /api/system/storage-maintenance/quarantine/:id/restore` untuk memulihkan orphan sebelum tenggat.
- `POST /api/system/storage-maintenance/quarantine/:id/purge` untuk menghapus ancaman lebih awal.

## CLI darurat

Dry-run menampilkan jumlah per kategori tanpa mengungkap object key atau data pribadi:

```powershell
npm run files:cleanup-profile -- --organization-id=12
```

Eksekusi darurat memerlukan ID akun Superadmin aktif dan tetap memakai worker serta pemeriksaan yang sama:

```powershell
npm run files:cleanup-profile -- --organization-id=12 --actor-user-id=1 --apply
```

Untuk operasi rutin gunakan menu aplikasi agar pilihan file, konfirmasi, dan riwayat lebih mudah ditinjau.
