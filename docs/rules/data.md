# Data, query dan migration

## Sumber kebenaran data

- Skema referensi: `sitou_schema_v3.sql`.

- Panduan baca cepat database: `docs/database-schema.md`. Buka dokumen ini lebih dulu untuk memahami tabel, kolom penting, relasi, dan aturan data; buka `sitou_schema_v3.sql` hanya ketika perlu detail constraint, index, view SQL, atau membuat migration.

- Sebelum mengusulkan tabel atau kolom, periksa skema acuan, migration, relasi, dan sumber data yang sudah ada. Catat alasan pemilihan desain. Pakai struktur yang sudah ada bila makna, batas organisasi, dan kebutuhan histori terpenuhi. Tambah struktur hanya untuk kebutuhan yang tidak dapat dipenuhi dengan desain saat ini, misalnya relasi, constraint, atau pencarian. Jika struktur berubah, sinkronkan migration, skema acuan, dan dokumentasi pada perubahan yang sama.

- Perubahan database hanya melalui migration baru; jangan mengedit database produksi manual.

- Setiap migration baru yang mengubah schema wajib pada perubahan yang sama direfleksikan ke `sitou_schema_v3.sql`. File tersebut harus selalu merepresentasikan schema akhir setelah seluruh migration diterapkan dan menjadi sumber bootstrap untuk membuat database SITOU baru dari kondisi kosong.

- Pembaruan `sitou_schema_v3.sql` tidak menggantikan migration dan tidak boleh dipakai untuk memperbarui database yang sudah berjalan. Database development, staging, dan production yang sudah ada tetap disinkronkan dengan menjalankan migration yang belum tercatat.

- Istilah domain resmi adalah **organisasi**. UI, pesan API, dokumentasi, komentar, test, dan penamaan abstraksi domain dilarang menyebut organisasi sebagai "tenant" atau "perusahaan". Nilai teknis schema yang sudah menjadi kontrak, seperti `organization_id` dan enum `company`, tetap dipertahankan, tetapi label yang dibaca pengguna wajib memakai "organisasi".

- Istilah pengguna resmi adalah **Pegawai** dan **NIP (Nomor Induk Pegawai)**. UI, notifikasi, validasi, template import, dokumentasi, dan test dilarang memakai label "Karyawan" atau "Nomor Pegawai"; identifier teknis lama seperti role code `employee`, kolom `employee_no`, dan alias kompatibilitas tidak diubah tanpa migration kontrak khusus.

- Event absensi mentah bersifat append-only.

- `attendance_daily_summaries` adalah hasil olahan dan boleh dihitung ulang.

- Lokasi/divisi/jabatan aktif berasal dari `employee_assignments`, bukan kolom duplikat pada `employees`.

- Riwayat kontrak dan penempatan tidak boleh ditimpa atau dihapus fisik. Salah input kontrak dikoreksi melalui aksi edit yang diaudit atau dibatalkan secara logis dengan alasan; dokumen setiap record histori tetap dapat dilihat melalui file ID berizin. Tampilan histori lifecycle wajib menampilkan pelaku dan waktu pencatatan, koreksi terakhir, serta pembatalan dari kolom domain atau `audit_logs`; data audit tidak boleh disimpulkan dari actor yang sedang login.

- Ringkasan hubungan kerja pegawai berstatus final wajib tetap menampilkan kontrak terakhir dari histori, status akhir, dan akses ke detail alasan, tanggal efektif, pelaku, serta waktu pencatatan. Jangan mengosongkan informasi hanya karena kontrak aktif telah ditutup.

- Akhir hubungan kerja hanya boleh diproses melalui workflow terkonfirmasi yang atomik dengan status `terminated`, `retired`, atau `deceased`. Tanggal efektif wajib berada di antara tanggal bergabung dan hari ini; tanggal masa depan dilarang sampai scheduler khusus tersedia.

- Pengakhiran hubungan kerja menutup penempatan dan kontrak aktif, menonaktifkan akun tertaut, serta menyimpan status, tanggal, alasan, pelaku, waktu, dan audit tanpa menghapus profil maupun histori. Pegawai berstatus final tidak boleh diubah kembali melalui form profil, kontrak, penempatan, atau profil lengkap biasa.

- File bersifat privat; `object_key` tidak pernah dikirim mentah ke browser.

## Query dan indexing

## Partitioning dan retention

- `attendance_events` dipartisi bulanan berdasarkan `event_date`.

- Scheduler membuat partisi bulan berjalan dan minimal dua bulan ke depan memakai `ensure_attendance_month_partition()`.

- Default partition hanya pengaman; monitor dan pindahkan isinya ke partisi yang benar.

- Jangan membuat satu partisi per organisasi atau per hari.

- Rekap harian tidak perlu dipartisi sebelum volume dan query plan membuktikan kebutuhan.

- Kebijakan retention foto absensi dapat lebih pendek daripada rekap, tetapi harus disetujui organisasi.

## Migration dan transaksi

- Satu migration untuk satu perubahan logis.

- Setiap perubahan yang menghasilkan migration wajib menyertakan pembaruan `sitou_schema_v3.sql` dan, bila struktur atau aturan data berubah, `docs/database-schema.md` dalam commit yang sama. Migration, snapshot schema, dan dokumentasi tidak boleh dibiarkan berbeda versi.

- Karena pengembangan dilakukan dari beberapa device dan environment, sebelum mulai bekerja atau menjalankan aplikasi wajib periksa status migration database lokal terhadap migration di repository, lalu jalankan hanya migration yang belum diterapkan. Dilarang mengandalkan asumsi bahwa schema PC, laptop, dan VPS sudah sama.

- Sebelum migration dianggap selesai, verifikasi dua jalur: upgrade database yang sudah berisi data melalui seluruh migration baru, serta bootstrap database kosong menggunakan `sitou_schema_v3.sql`. Hasil struktur akhirnya harus ekuivalen.

- Migration harus dapat dijalankan pada database kosong dan database berisi data.

- Perubahan destruktif memakai pola expand-migrate-contract.

- Backfill besar berjalan batch dan dapat dilanjutkan.

- Pembuatan index besar di produksi pertimbangkan `CREATE INDEX CONCURRENTLY` pada migration nontransactional.

- Jangan mengganti migration yang sudah dirilis; buat migration koreksi.

- Setiap use case multi-tabel memakai transaksi.

- Lock record aktif saat rolling, approval, commit import, dan penerbitan tindakan untuk mencegah race condition.
