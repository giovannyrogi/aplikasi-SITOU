# Pemeliharaan Penyimpanan File

Fitur ini tersedia khusus Superadmin melalui menu **Pemeliharaan Sistem > Penyimpanan File**. Pilih satu organisasi, jalankan pemeriksaan, tinjau hasil, pilih kandidat aman, lalu setujui konfirmasi penghapusan permanen.

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
