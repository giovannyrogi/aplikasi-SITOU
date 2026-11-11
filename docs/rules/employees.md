# Pegawai, penempatan dan lifecycle

## Struktur organisasi, cabang, dan divisi

- `organizations`: identitas organisasi.

- `locations`: kantor pusat, cabang, unit pasar, site, gudang.

- `organization_unit_types`: master klasifikasi struktur yang fleksibel dan terisolasi per organisasi.

- `organization_units`: struktur organisasi bertingkat yang wajib mereferensikan `organization_unit_types` melalui `unit_type_id`.

- `organization_unit_locations`: menghubungkan banyak divisi ke satu cabang dan satu divisi ke beberapa lokasi.

- `employee_assignments`: lokasi + unit + jabatan + atasan pada suatu periode.

Aturan jenis unit organisasi:

1. `organization_unit_types` adalah satu-satunya sumber kebenaran jenis unit; dilarang menambahkan kembali enum, CHECK daftar tetap, atau kolom teks `organization_units.unit_type`.

2. Setiap jenis unit wajib memiliki `organization_id`, kode uppercase unik, nama unik case-insensitive, urutan tampil, dan status aktif.

3. `organization_units.unit_type_id` wajib memakai composite foreign key `(organization_id, unit_type_id)` agar tidak dapat mengambil jenis milik organisasi lain.

4. Jenis yang sudah digunakan tidak boleh dihapus; nonaktifkan agar histori tetap dapat dibaca dan cegah pemilihannya pada unit baru.

5. Jenis unit hanya mengklasifikasikan struktur. Hierarki tetap ditentukan oleh `parent_unit_id`, sedangkan lokasi operasional ditentukan oleh `organization_unit_locations`.

6. Setiap relasi Divisi & Unit-lokasi wajib menerima `active_from` eksplisit berdasarkan kondisi organisasi sebenarnya; dilarang mengisinya otomatis dari tanggal server. Beberapa lokasi boleh memakai tanggal bersama dengan override per lokasi. Koreksi atau pelepasan wajib beralasan, diaudit, dan tidak boleh membuat histori penempatan menjadi invalid.

Rolling/mutasi harus dilakukan dalam satu transaksi:

1. Lock penempatan utama aktif pegawai.

2. Tutup `effective_until` lama satu hari sebelum tanggal efektif baru.

3. Insert baris penempatan baru.

4. Validasi unit memang tersedia pada lokasi atau minta override berizin.

5. Tulis audit log dan outbox.

Dilarang mengubah lokasi/divisi pada baris lama untuk merepresentasikan mutasi.

### Import pegawai multi-sheet

- Import pegawai wajib memakai template multi-sheet terpusat yang sama untuk generator, parser, validasi, dokumentasi, dan laporan error; dilarang mendefinisikan header terpisah di route atau UI.

- Import hanya menerima `.xlsx` maksimal 10 MB. Foto, dokumen, kasus disiplin, dan tindakan sanksi tidak boleh dimasukkan; seluruh file dilengkapi manual melalui detail pegawai setelah profil tersedia.

- UI wajib menjelaskan data yang diproses, hubungan antar-sheet, batas file, preview, dampak commit parsial, dan langkah upload dokumen manual setelah import.

- `employee_no` adalah penghubung lintas-sheet. Referensi histori harus unik dalam workbook dan tidak boleh memakai ID database yang ditebak klien.

- Import hanya membuat pegawai baru. NIK wajib 16 digit. NIP dan NIK dinormalisasi serta diperiksa terhadap seluruh record termasuk soft-deleted; jangan mengubah import menjadi upsert tanpa keputusan produk dan audit baru.

- Validasi dilakukan sebelum commit dan error ditampilkan per pegawai, sheet, serta nomor baris. Satu error membuat seluruh kelompok pegawai invalid.

- Commit wajib atomik per pegawai, idempotent, dan dapat menghasilkan `partially_committed`; kegagalan satu pegawai tidak menggagalkan kelompok valid lain.

- Container OOXML wajib diperiksa sebelum parsing: tolak macro, external link, embedded object, enkripsi, formula, struktur tidak valid, dan perluasan data berlebihan.

- Commit melakukan lock dan pemeriksaan identitas ulang; unique constraint database tetap menjadi pertahanan terakhir terhadap race condition.

- Akun login, password, dokumen, kasus disiplin, tindakan sanksi, absensi, payroll, dan indikator otomatis tidak termasuk import pegawai kecuali ada perubahan produk eksplisit.

### Filter daftar Pegawai

- Status perkawinan memakai MARITAL_STATUS_OPTIONS dan MARITAL_STATUS_VALUES yang sama dengan pendaftaran. Query maritalStatus opsional divalidasi server dan dipakai konsisten pada data, total, pagination serta ekspor. Tidak mengubah nilai profil, urutan nama/ID atau scope.

- Golongan darah pada daftar dan export memakai BLOOD_TYPE_OPTIONS yang sama dengan form (A/B/AB/O); tidak menambah klasifikasi baru atau mengubah data lama.

- Tanpa penempatan berada dalam Kelengkapan data dan memakai employeeWithoutAssignmentSql yang sama dengan Dashboard: status aktif/masa percobaan, tanpa penempatan utama yang berlaku hari ini. Penempatan tambahan, masa depan, dan yang sudah berakhir tidak memenuhi penempatan utama saat ini. Scope HRD terpilih tetap membatasi akses; filter ini tidak memberikan akses ke Pegawai di luar scope. Filter daftar, total, pagination, dan export harus konsisten.
