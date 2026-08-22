# Migration Database SITOU

Folder ini menyimpan perubahan schema secara berurutan untuk database SITOU yang sudah pernah dibuat. Migration berfungsi membawa schema lama ke versi baru tanpa membuat ulang seluruh database.

## Kapan dijalankan

- Database kosong baru: gunakan `sitou_schema_v3.sql` sebagai schema lengkap terkini. Jangan lanjut menjalankan seluruh migration historis di folder ini.
- Database lama: jalankan hanya migration yang belum pernah diterapkan, sesuai urutan nomor nama file.
- Database development lokal `sitou_db` saat ini sudah memiliki hasil migration `001` sampai `012`; jangan menyalin dan menjalankannya ulang secara manual.

Jangan menjalankan semua file secara acak atau mengulang migration tanpa pemeriksaan. Sebagian migration mengubah atau menghapus kolom lama dan sengaja berhenti ketika kondisi data tidak aman.

## Cara menjalankan migration baru

1. Backup database dan pastikan target adalah database development yang benar.
2. Baca SQL, preflight, serta dampak datanya.
3. Jalankan migration berikutnya melalui skrip proyek:

```powershell
node scripts/apply-development-migration.js database/migrations/NAMA_FILE.sql
```

4. Verifikasi schema, constraint, index, data, API terkait, dan production build.
5. Sinkronkan `sitou_schema_v3.sql` dan `docs/database-schema.md` agar database baru langsung memakai kondisi akhir.

Migration yang telah diterapkan tidak boleh diedit. Koreksi dibuat sebagai migration bernomor berikutnya.

Migration `011` menambahkan version timestamp dan metadata pembatalan logis pada `employment_contracts`. Migration ini memungkinkan koreksi salah input dan pembatalan kontrak tanpa menghapus histori maupun dokumen terkait.

Migration `012` menghubungkan identitas administratif pegawai dengan file privat melalui `document_file_id`, menambahkan label untuk jenis identitas fleksibel, serta menambahkan jenis Kartu Keluarga. KTP tetap memakai `employees.national_id` sebagai sumber nilai NIK; identitas lain dipakai untuk BPJS, NPWP, KK, dan kebutuhan organisasi lainnya.
