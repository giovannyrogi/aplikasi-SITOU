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

Skrip test-* dan folder tests sudah dihapus atas keputusan proyek. Aplikasi tidak memanggil runner pengujian tersebut. Perintah operasional tersedia pada package.json; jalankan sesuai prosedur dan lingkungan target. Skrip database/restore dapat mengubah data dan tidak dijalankan otomatis sekadar dengan membuka folder ini.
