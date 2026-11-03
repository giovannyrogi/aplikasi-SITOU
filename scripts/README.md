# Skrip operasional SITOU

Folder ini menyimpan alat yang masih digunakan untuk menjalankan dan memelihara sistem:

- `run-system-backup.mjs`: proses backup dari dashboard.
- `restore-system-backup.mjs` dan `verify-system-backup*.mjs`: pemulihan dan verifikasi backup.
- `apply-*.mjs`, `check-employee-foundation-db.mjs`, `verify-schema-bootstrap.mjs`: migration dan pemeriksaan struktur database.
- `file-cleanup-worker.mjs`, `cleanup-replaced-profile-files.mjs`, `scan-stored-files-malware.mjs`: pemeliharaan file privat.
- `expire-*.mjs`, `reconcile-subscriptions.mjs`: pemeliharaan status dan draft.
- `replay-inventory-stock.mjs`: pemeriksaan/perhitungan ulang stok terkontrol.
- `seed-superadmin.mjs`: penyiapan akun platform.
- `generate-local-icons.mjs`, `watch-local-icons.mjs`, `run-dev-with-icons.mjs`: bundel ikon Iconify lokal. Cukup ubah nama ikon di `app/components/icons/navigationIconSources.mjs`; `npm run dev` memperbarui hasil saat file disimpan dan build membuat ulang sebelum kompilasi. `npm run icons:check` hanya memeriksa.

Skrip test-* lama tidak digunakan aplikasi. Tes regresi terpilih tersedia di folder `tests/` dan dijalankan dengan `node --test`. Perintah operasional tersedia pada package.json; jalankan sesuai prosedur dan lingkungan target. Skrip database/restore dapat mengubah data dan tidak dijalankan otomatis sekadar dengan membuka folder ini.

Generator ikon membandingkan isi SVG setelah menormalkan akhir baris CRLF/LF,
sehingga checkout Windows tidak dianggap memiliki bundle usang hanya karena
perbedaan akhir baris. Nama atau data ikon yang benar-benar berubah tetap harus
dibuat ulang melalui `npm run icons:generate`.

- `prune-mobile-sessions.mjs` / `npm run auth:mobile-sessions:prune`: menghapus sesi mobile expired atau revoked lebih dari satu hari, tanpa menghapus audit. Default `.env.development`, override dengan `ENV_FILE`; jadwalkan harian hanya pada environment yang diotorisasi setelah migration 065. Tidak mencetak credential/token. Lihat `docs/mobile-auth.md`.
- `verify-schema-bootstrap.mjs` juga membandingkan kolom/constraint `mobile_auth_sessions` dengan hasil upgrade lokal.

## Worker PDF SKB

`npm run holiday-pdf:check` memeriksa executable Tesseract/Poppler, bahasa ind/eng/osd, storage privat, schema dan scanner. `npm run worker:holiday-pdf` menjalankan antrean PostgreSQL dan cleanup unggahan tanpa referensi; `-- --once` memproses maksimal satu pekerjaan. ENV_FILE default mengikuti NODE_ENV. Web/worker memakai database serta UPLOAD_ROOT sama. Instalasi dan process manager: docs/holiday-pdf-import.md.

Worker PDF juga mengerjakan pembersihan permanen PDF katalog melalui holiday_pdf_purge_jobs setelah migration 071–072. Mode --once memproses maksimal satu pembersihan dan satu OCR. Retry pembersihan 30 detik, lease row lock, referensi revisi lain tetap terlindungi. Lihat docs/holiday-catalogs.md dan docs/holiday-pdf-import.md.
