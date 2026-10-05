# Hardening production dan rollout file lifecycle

Panduan ini wajib diikuti untuk deployment perubahan migration 032. Aplikasi baru memblokir unduhan file aktif yang belum berstatus antivirus `clean`, sehingga migration dan pemindaian file lama harus selesai sebelum proses web baru dibuka untuk pengguna.

## 1. Backup dan preflight

Untuk rilis baru, menu Superadmin **Backup Sistem** menyediakan paket terenkripsi database dan seluruh `UPLOAD_ROOT` serta unduhan selama 24 jam. Persyaratan worker, ruang, verifikasi, dan latihan restore dijelaskan pada `docs/system-backup.md`. Contoh manual di bawah tetap berguna sebagai prosedur darurat ketika dashboard tidak tersedia.

1. Aktifkan mode pemeliharaan agar mutasi profil dan upload berhenti.
2. Backup PostgreSQL dan seluruh direktori `UPLOAD_ROOT`.
3. Pastikan aplikasi web dan worker memakai nilai `UPLOAD_ROOT` absolut yang sama pada storage persisten.
4. Jalankan rekonsiliasi storage dalam mode laporan. Pulihkan metadata aktif yang byte-nya hilang sebelum cleanup diaktifkan.
5. Verifikasi ruang disk untuk temporary multipart, database, dan backup.

Contoh backup perlu disesuaikan dengan nama database serta lokasi storage VPS:

```bash
pg_dump --format=custom --file=sitou-before-032.dump "$DATABASE_URL"
tar -C /srv/sitou-storage -czf sitou-uploads-before-032.tar.gz uploads
```

## 2. Dependency dan ClamAV

```bash
npm ci
sudo apt-get update
sudo apt-get install -y clamav clamav-daemon
sudo freshclam
sudo systemctl enable --now clamav-daemon
sudo systemctl status clamav-daemon
```

Pastikan user PM2 dapat mengakses socket ClamAV. Gunakan environment production berikut:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://sitou.pasarmanado.id
TRUST_PROXY=1
UPLOAD_ROOT=/srv/sitou-storage/uploads
CLAMAV_REQUIRED=1
CLAMAV_SOCKET=/var/run/clamav/clamd.ctl
CLAMAV_TIMEOUT_MS=15000
```

Jika ClamAV memakai TCP privat, gunakan `CLAMAV_HOST=127.0.0.1` dan `CLAMAV_PORT=3310`. Jangan membuka port tersebut ke internet. Upload bersifat fail closed: scanner mati, timeout, atau respons tidak sah membuat upload ditolak.

## 3. Migration dan pemindaian file lama

```bash
ENV_FILE=.env.production npm run db:check
ENV_FILE=.env.production npm run db:migrate -- database/migrations/20260922_032_production_security_hardening.sql
NODE_ENV=production ENV_FILE=.env.production npm run files:scan-malware
```

Perintah scan keluar dengan status gagal jika ada file terinfeksi, byte hilang, path tidak aman, atau scanner gagal. Jangan lanjutkan deployment sebelum jumlah `infected` dan `failed` nol. File terinfeksi harus dikarantina dan ditinjau, sedangkan byte aktif yang hilang harus dipulihkan dari backup atau direkonsiliasi melalui prosedur data yang disetujui.

Verifikasi database:

```sql
SELECT malware_scan_status, count(*)
FROM stored_files
WHERE lifecycle_status IN ('draft', 'active')
GROUP BY malware_scan_status
ORDER BY malware_scan_status;

SELECT status, count(*)
FROM file_purge_jobs
GROUP BY status
ORDER BY status;
```

## 4. Build dan proses PM2

```bash
npm run lint
npm test
npm run db:verify-bootstrap
npm run build
npm audit --omit=dev
pm2 reload ecosystem.config.js --update-env
pm2 save
pm2 status
```

Kedua proses `sitou` dan `sitou-file-cleanup-worker` harus berstatus `online`. Worker memproses purge setelah commit dan mengulang kegagalan dengan backoff. Jangan menjalankan cleanup fisik manual saat antrean worker aktif.

### Dependency keamanan (5 Oktober 2026)

- Next.js dan `eslint-config-next` diselaraskan pada 16.3.8; Axios 1.20.0 dan Moment 2.31.0. Lockfile juga memperbarui DOMPurify ke 3.4.16 serta `brace-expansion` ke versi perbaikan pada masing-masing major (1.1.21, 2.1.7, 5.0.12).
- `package.json` dan `package-lock.json` harus diterapkan bersama, lalu gunakan `npm ci` agar versi dependency turunan sama dengan hasil pengujian. Tidak memerlukan migration database.
- Audit produksi (`npm audit --omit=dev`) setelah pembaruan menunjukkan nol temuan. Audit lengkap masih melaporkan lima paket high dalam satu rantai tooling: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
- Temuan terakhir berasal dari [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm); saat pemeriksaan, `braces` belum memiliki versi perbaikan resmi. Jalankan lint hanya pada kode/pola file proyek yang dipercaya; jangan memberikan pola glob dari request pengguna kepada tooling ini. Ini batasan sementara, bukan temuan yang telah diperbaiki.
- Jangan memakai `npm audit fix --force` untuk menurunkan konfigurasi Next.js ke versi 14 atau menghapus pemeriksaan lint. Perbarui kembali ketika rantai tooling menyediakan perbaikan kompatibel, lalu jalankan audit, unit test, lint, dan build.
- Peringatan deprecated dari dependency turunan ExcelJS dapat tetap tampil saat `npm ci`; berbeda dari temuan audit. Perubahan major paket import/export harus diuji terhadap template dan workbook yang sudah dipakai organisasi.

## 5. Nginx

Gunakan contoh [nginx-sitou.conf.example](../deploy/nginx-sitou.conf.example). Ketentuan utamanya:

- HTTPS wajib dan HTTP dialihkan ke HTTPS.
- `client_max_body_size 120m`.
- upstream hanya `127.0.0.1:3003`.
- `Host`, `X-Forwarded-Proto`, `X-Forwarded-Host`, dan `X-Forwarded-For` ditimpa oleh Nginx.
- buffering request dinonaktifkan agar multipart mengalir ke temporary storage.
- port aplikasi tidak diekspos ke internet.

Uji konfigurasi dengan `sudo nginx -t` sebelum reload.

## 6. Smoke test

Setelah proses aktif, uji dengan akun dan organisasi development khusus:

1. Login, logout, rate limit, serta penolakan origin asing.
2. Edit pegawai: keep, replace, dan remove untuk pas foto, KTP, dan KK.
3. Profil lengkap: pendidikan dan sertifikasi, termasuk validasi gagal setelah file dipilih.
4. Kontrak, koreksi kontrak, penempatan, dan koreksi penempatan dengan PDF.
5. Tindakan disiplin draft dan aktif beserta surat PDF.
6. Cuti dengan satu hingga lima lampiran.
7. Import XLSX valid dan XLSX berbahaya/tidak valid.
8. Preview file berizin, scope lokasi HRD, dan penolakan lintas organisasi.
9. Thumbnail pas foto, KTP, serta KK pada desktop, tablet, dan mobile; uji pembukaan modal dengan mouse dan keyboard.

Pastikan kegagalan bisnis tidak meninggalkan file pada `.tmp/multipart`, dan file lama baru menjadi `purged` setelah job worker berhasil.

## 7. Pemantauan

Query ringkas:

```sql
SELECT status, count(*), min(next_attempt_at) AS next_attempt
FROM file_purge_jobs
GROUP BY status;

SELECT count(*) AS file_aktif_belum_bersih
FROM stored_files
WHERE lifecycle_status IN ('draft', 'active')
  AND malware_scan_status <> 'clean';

SELECT id, stored_file_id, attempts, last_error, next_attempt_at
FROM file_purge_jobs
WHERE status IN ('retry', 'failed')
ORDER BY COALESCE(completed_at, started_at, created_at) DESC
LIMIT 100;

SELECT action, sum(request_count) AS requests
FROM security_rate_limit_buckets
WHERE expires_at > now()
GROUP BY action
ORDER BY requests DESC;
```

Pantau juga log 401/403/413/429/500, kapasitas disk, file `.tmp` dan `.trash`, file aktif tanpa referensi, metadata tanpa byte, serta versi signature ClamAV. Menu Penyimpanan File tetap menjadi alat audit dan pemulihan terakhir.
