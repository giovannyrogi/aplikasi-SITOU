# Migration Database SITOU

Folder ini menyimpan perubahan schema secara berurutan untuk database SITOU yang sudah pernah dibuat. Migration berfungsi membawa schema lama ke versi baru tanpa membuat ulang seluruh database.

## Kapan dijalankan

- Database kosong baru: gunakan `sitou_schema_v3.sql` sebagai schema lengkap terkini. Jangan lanjut menjalankan seluruh migration historis di folder ini.
- Database lama: jalankan hanya migration yang belum pernah diterapkan, sesuai urutan nomor nama file.
- Database development lokal `sitou_db` memiliki hasil migration `001` sampai `016`. Migration `016` menambahkan histori pencabutan tindakan disiplin tanpa menghapus tindakan atau dokumen historis. Migration `017` menormalkan nama role lama menjadi Pegawai dan perlu dijalankan pada database lama.

Jangan menjalankan semua file secara acak atau mengulang migration tanpa pemeriksaan. Sebagian migration mengubah atau menghapus kolom lama dan sengaja berhenti ketika kondisi data tidak aman.

Setelah membuat database kosong atau menyelesaikan upgrade, jalankan `npm run db:check`.
Database belum boleh dipakai aplikasi jika hasil pemeriksaan menunjukkan `ready: false`.

## Cara menjalankan migration baru

1. Backup database dan pastikan target adalah database development yang benar.
2. Baca SQL, preflight, serta dampak datanya.
3. Jalankan migration berikutnya melalui skrip proyek:

```powershell
npm run db:migrate -- database/migrations/NAMA_FILE.sql
```

4. Verifikasi schema, constraint, index, data, API terkait, dan production build.
5. Sinkronkan `sitou_schema_v3.sql` dan `docs/database-schema.md` agar database baru langsung memakai kondisi akhir.

Migration yang telah diterapkan tidak boleh diedit. Koreksi dibuat sebagai migration bernomor berikutnya.

Migration `018` memperbaiki database yang belum memiliki relasi permission
`accounts.read` dan `accounts.manage` untuk role Superadmin serta HRD. Migration
ini idempotent dan hanya menyentuh permission modul Akun Organisasi. Terapkan pada
environment yang mengembalikan HTTP 403 ketika Superadmin atau HRD mengelola akun.

Migration `011` menambahkan version timestamp dan metadata pembatalan logis pada `employment_contracts`. Migration ini memungkinkan koreksi salah input dan pembatalan kontrak tanpa menghapus histori maupun dokumen terkait.

Migration `012` menghubungkan identitas administratif pegawai dengan file privat melalui `document_file_id`, menambahkan label untuk jenis identitas fleksibel, serta menambahkan jenis Kartu Keluarga. KTP tetap memakai `employees.national_id` sebagai sumber nilai NIK; identitas lain dipakai untuk BPJS, NPWP, KK, dan kebutuhan organisasi lainnya.

Migration `014` menambahkan profil platform, view identitas terpusat, dan versi kredensial. Migration `015` mengarsipkan identitas legacy ke `user_identity_legacy_backups`, memverifikasi kelengkapan backup, lalu menghapus kolom identitas dari `users`. Arsip migration bukan sumber identitas aplikasi dan wajib mengikuti kebijakan akses serta retention data pribadi.

Migration `019` mewajibkan NIK 16 digit pada seluruh pegawai, menormalkan dan membatasi status perkawinan ke kode resmi, serta memperbaiki constraint checkpoint wizard agar menerima step Penempatan (`current_step=3`). Migration berhenti dengan pesan preflight bila masih ada pegawai tanpa NIK atau nilai status lama yang belum dapat dipetakan.

Migration `020` menambahkan `updated_at` dan trigger versi pada `employee_assignments`. Kolom ini digunakan untuk koreksi salah input penempatan dengan optimistic concurrency dan audit tanpa menghapus histori.

Migration `021` menghapus default tanggal server pada `organization_unit_locations.active_from` dan menambahkan constraint anti-overlap. Aplikasi wajib mengirim tanggal efektif eksplisit untuk setiap lokasi Divisi & Unit.

Migration `022` memisahkan cuti dari `employees.employment_status`, menormalkan status lama menjadi aktif dengan audit, menambahkan permission modul, lifecycle pembatalan, kategori lampiran privat, entitlement tahunan, dan ledger saldo cuti. Jalankan migration ini sebelum membuka menu Cuti & Izin.

Migration `023` mengeraskan kompatibilitas data cuti lama dan mengizinkan keputusan oleh Superadmin berizin tanpa mengubah kewenangan Pimpinan. Migration ini idempotent terhadap constraint keputusan hasil migration `022`.

Migration `024` mengubah jatah tahunan, durasi pencatatan, dan transaksi saldo cuti/izin menjadi bilangan bulat. Migration berhenti bila menemukan data pecahan agar saldo tidak dibulatkan secara diam-diam.

Migration `025` menambahkan metadata penonaktifan dan purge byte pada `stored_files`, antrean `file_cleanup_runs`, hasil per file `file_cleanup_items`, serta permission `storage_maintenance.manage` khusus Superadmin. Jalankan worker terpisah dengan `npm run worker:file-cleanup`; satu organisasi hanya dapat memiliki satu pemeriksaan atau pembersihan aktif.

Migration `026` menambahkan partial index audit untuk filter **Ditambahkan oleh** pada Daftar Data Pegawai. Filter memakai audit `employee.create` agar pencatat awal tidak dapat berubah ketika profil pegawai diedit.

Migration `030` mengganti hubungan keluarga ambigu dengan kode eksplisit untuk Istri, Suami, Ayah, Ibu, Kakek, Nenek, dan hubungan lain. Data `spouse` dikonversi memakai bukti kontak darurat lebih dahulu lalu gender pegawai; data `parent` dikonversi dari kode hari lahir NIK. Migration berhenti dan rollback bila menemukan bukti konflik atau data yang tidak dapat dipetakan. Jalankan migration ini sebelum deploy aplikasi yang memakai pilihan hubungan baru.

Migration `029` mengganti enum tindakan disiplin dengan master sanksi per organisasi, melakukan
backfill snapshot kebijakan pada seluruh tindakan lama, menambah status `superseded`, dan menambah
permission Pengaturan Sanksi. Terapkan migration ini sebelum membuka menu Pengaturan Organisasi →
Pengaturan Sanksi. Jadwalkan `npm run disciplinary-actions:expire` minimal sekali sehari; query tetap
memeriksa tanggal akhir sehingga keterlambatan worker tidak membuat tindakan kedaluwarsa dihitung aktif.

# Kebijakan pensiun organisasi — 027

Jalankan `npm run db:migrate -- database/migrations/20260914_027_organization_retirement_policy.sql` pada database yang sudah berjalan sebelum deploy aplikasi. Migration menambah pengaturan per organisasi dan permission baca/kelola, serta backfill usia 58 tahun untuk organisasi lama. Database baru memakai snapshot `sitou_schema_v3.sql`. Perubahan usia berikutnya hanya melalui Pengaturan Organisasi → Kebijakan Pensiun, dengan alasan dan audit.

Migration `031` memusatkan lifecycle file dengan status `draft|active|deleted|purged`, slot draft unik, versi dokumen kontrak/penempatan, dan dukungan scanner untuk byte tanpa metadata. Jalankan setelah memastikan backup database/direktori upload dan `UPLOAD_ROOT` aplikasi-worker sama. Rekonsiliasi awal wajib mode laporan; jangan aktifkan cleanup bila masih ada metadata aktif dengan byte hilang. Terapkan dengan `npm run db:migrate -- database/migrations/20260921_031_centralized_file_lifecycle.sql` sebelum deploy endpoint multipart baru.

Migration `032` menambahkan status antivirus, antrean purge byte pascacommit, dan rate limit PostgreSQL. Backup database dan `UPLOAD_ROOT`, pastikan migration `031` sudah tercatat, lalu jalankan `npm run db:migrate -- database/migrations/20260922_032_production_security_hardening.sql`. Deploy aplikasi dan worker baru dalam satu maintenance window setelah ClamAV tersedia.

Migration `033` menambahkan permission `employees.export_sensitive` hanya untuk Superadmin dan HRD. Jalankan `npm run db:migrate -- database/migrations/20260924_033_employee_sensitive_export.sql` sebelum mengaktifkan tombol Export pada menu Data Pegawai.
