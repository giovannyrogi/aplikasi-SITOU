# AGENTS.md - SITOU

Dokumen ini adalah aturan kerja utama untuk developer dan Codex pada proyek **SITOU - Sistem Informasi Tenaga Operasional Unit**. Berlaku untuk seluruh folder proyek, kecuali ada `AGENTS.md` yang lebih spesifik di subfolder. Jika implementasi berbeda dari dokumen ini, perubahan harus dicatat melalui migration, test, dan pembaruan dokumentasi.

## 1. Tujuan produk saat ini

Bangun dashboard HRIS multi-perusahaan yang stabil untuk:

- Superadmin membuat perusahaan, lokasi awal, akun HRD, dan cakupan akses.
- HRD mengelola seluruh profil, kontrak, penempatan, rolling, izin, absensi, dokumen, dan tindakan disiplin.
- Pimpinan memantau data dan histori pegawai tanpa mengubah administrasi HRD.
- Karyawan disiapkan sebagai role self-service untuk aplikasi web/mobile lanjutan.
- Absensi tahap awal masuk melalui import Excel/CSV dan koreksi HRD; mobile attendance dikembangkan setelah dashboard stabil.

Jangan membangun payroll, pengenalan wajah, atau keputusan sanksi otomatis kecuali ada permintaan dan aturan baru yang disetujui.

## 2. Stack dan struktur yang diharapkan

- Web/API: Next.js versi stabil dengan App Router dan TypeScript strict.
- Database: PostgreSQL 18.
- Validasi: schema bersama untuk request API, form, import, dan environment.
- File: penyimpanan privat melalui service abstraction; database hanya menyimpan metadata `stored_files`.
- Background job: antrean untuk import, rekap, indikator, export, notifikasi, dan outbox.
- Mobile: memakai API versi yang sama; tidak mengakses PostgreSQL secara langsung.

Pisahkan lapisan berikut:

1. `domain`: aturan bisnis murni dan tipe.
2. `application`: use case/transaksi.
3. `infrastructure`: database, storage, queue, email, dan integrasi.
4. `interfaces`: route handler, server action, worker, dan UI.

Route handler tidak boleh berisi query dan aturan bisnis panjang. Gunakan service/use case.

## 3. Sumber kebenaran data

- Skema referensi: `sitou_schema_v3.sql`.
- Perubahan database hanya melalui migration baru; jangan mengedit database produksi manual.
- Event absensi mentah bersifat append-only.
- `attendance_daily_summaries` adalah hasil olahan dan boleh dihitung ulang.
- Lokasi/divisi/jabatan aktif berasal dari `employee_assignments`, bukan kolom duplikat pada `employees`.
- Riwayat kontrak dan penempatan tidak boleh ditimpa.
- File bersifat privat; `object_key` tidak pernah dikirim mentah ke browser.

## 4. Aturan multi-tenant wajib

1. Setiap tabel bisnis tenant memiliki `organization_id` langsung.
2. Setiap query bisnis wajib memfilter `organization_id` dari session server, bukan dari body yang dipercaya begitu saja.
3. Foreign key lintas tabel tenant memakai pasangan `(organization_id, id)` bila tersedia.
4. Jangan menerima `organization_id` klien tanpa mencocokkannya dengan membership aktif.
5. Superadmin platform boleh lintas tenant hanya pada use case yang eksplisit dan diaudit.
6. Job, export, import, cache key, nama objek file, dan log juga harus membawa tenant.
7. Test wajib membuktikan user tenant A tidak dapat membaca atau mengubah tenant B.

Contoh pola service:

```ts
await db.transaction(async (tx) => {
  const actor = await requireTenantPermission(tx, session, organizationId, "employees.update");
  await employeeRepository.update(tx, { organizationId, employeeId, input, actorId: actor.userId });
});
```

## 5. Role dan permission

### Superadmin

- Mengelola tenant, lokasi awal, akun admin/HRD, masa aktif, dan konfigurasi platform.
- Tidak otomatis menjadi HRD tenant; gunakan aksi lintas tenant yang eksplisit.

### HRD

- CRUD data pegawai dan master tenant.
- Mengelola kontrak, penempatan, shift, absensi, izin, dokumen, kasus, dan sanksi.
- Menjadi satu-satunya approver cuti/izin.
- Mengunggah dokumen sanksi dan mengubah status tindakan.

### Pimpinan

- Read-only untuk dashboard, profil, penempatan, absensi, kontrak, indikator, dan histori sanksi sesuai permission/cakupan lokasi.
- Tidak dapat mengubah profil HRD, memutus izin, atau menerbitkan sanksi melalui sistem.
- Dokumen dan data sangat sensitif memerlukan permission khusus.

### Karyawan

- Tahap sekarang dapat dibuat tanpa akun aktif.
- Tahap mobile/web lanjutan: melihat data sendiri, absensi, mengajukan izin/cuti, dan mengunggah lampiran.
- Tidak pernah boleh memilih `employee_id` milik orang lain.

Semua aksi diperiksa di backend. Menyembunyikan tombol di frontend bukan kontrol keamanan.

## 6. Struktur perusahaan, cabang, dan divisi

- `organizations`: perusahaan/tenant.
- `locations`: kantor pusat, cabang, unit pasar, site, gudang.
- `organization_units`: direktorat, divisi, departemen, unit, tim.
- `organization_unit_locations`: menghubungkan banyak divisi ke satu cabang dan satu divisi ke beberapa lokasi.
- `employee_assignments`: lokasi + unit + jabatan + atasan pada suatu periode.

Rolling/mutasi harus dilakukan dalam satu transaksi:

1. Lock penempatan utama aktif pegawai.
2. Tutup `effective_until` lama satu hari sebelum tanggal efektif baru.
3. Insert baris penempatan baru.
4. Validasi unit memang tersedia pada lokasi atau minta override berizin.
5. Tulis audit log dan outbox.

Dilarang mengubah lokasi/divisi pada baris lama untuk merepresentasikan mutasi.

## 7. Shift dan jadwal

Gunakan empat jenis shift:

- `fixed`: jam masuk/pulang pasti, misalnya 09.00-17.00.
- `flexible`: jendela masuk dan durasi kerja minimum; keterlambatan hanya dinilai bila kebijakan mendefinisikannya.
- `field`: tenaga lapangan; utamakan durasi/kehadiran dan lokasi yang diizinkan.
- `off`: libur.

Aturan pola dapat ditempel pada pegawai, divisi, atau lokasi. Prioritas resolusi:

1. Target pegawai.
2. Target divisi/unit aktif.
3. Target lokasi aktif.
4. Jika tidak ada aturan, jadwal berstatus perlu ditinjau; jangan menebak shift.

Generator membuat `employee_daily_schedules` sebagai snapshot. Perubahan master shift tidak boleh mengubah rekap historis. Override jadwal harus menyimpan alasan dan audit.

Untuk shift fixed:

- Terlambat = clock-in pertama setelah `scheduled_start_at + late_tolerance_minutes`.
- Pulang awal = clock-out terakhir sebelum `scheduled_end_at - early_leave_tolerance_minutes`.
- Pulang melewati jadwal hanya menghasilkan `overtime_candidate_minutes`.
- `approved_overtime_minutes` hanya terisi jika kebijakan otomatis mengizinkan atau HRD menyetujui. Pulang telat tidak selalu berarti lembur.

Untuk shift lintas tengah malam, kaitkan event ke `work_date` jadwal, bukan sekadar tanggal kalender event.

## 8. Absensi tahap dashboard

Jangan memaksa HRD memasukkan ratusan pegawai satu per satu. Implementasikan urutan berikut:

1. Download template Excel/CSV dengan NIP, tanggal, jam masuk, jam pulang, status, dan catatan.
2. Upload ke file privat dan buat `attendance_import_batches`.
3. Parse ke `attendance_import_rows` tanpa langsung menulis event final.
4. Tampilkan preview dan error per baris: NIP tidak ada, duplikat, tanggal invalid, di luar tenant, atau urutan jam salah.
5. Commit seluruh baris valid dalam transaksi/batch yang idempotent.
6. Buat event `source='import'`, hitung ulang rekap terkait, dan tulis audit.

Sediakan input manual hanya untuk koreksi kasus kecil. Setiap koreksi menyimpan alasan, actor, dan audit.

Web kiosk/PWA capture boleh ditambahkan sebagai jembatan, tetapi harus memanggil endpoint attendance yang sama dengan mobile masa depan. Jangan membuat database kedua.

## 9. Kontrak mobile attendance

Mobile mengirim UUID `client_event_id` yang tetap sama saat retry. Server:

1. Autentikasi user dan petakan ke pegawai.
2. Buat/ambil `attendance_event_receipts` berdasarkan `(organization_id, client_event_id)`.
3. Jika receipt sudah `stored`, kembalikan hasil lama tanpa insert baru.
4. Ambil jadwal dan titik yang berlaku pada waktu kejadian.
5. Validasi waktu, koordinat, akurasi, radius, foto, perangkat, dan batas replay.
6. Simpan foto privat lebih dahulu secara aman, lalu event dan status receipt dalam transaksi terkoordinasi.
7. Jalankan rekap dan indikator secara asinkron/idempotent.

Event offline diperbolehkan sesuai kebijakan tenant. Simpan `occurred_at`, `received_at`, timezone, serta flag offline. Jangan memakai jam perangkat tanpa pemeriksaan deviasi.

## 10. Geofence, foto, dan validasi background

- `attendance_points` menyimpan koordinat, radius, batas akurasi, dan kebutuhan foto.
- `attendance_point_assignments` dapat menarget pegawai, divisi, atau lokasi dengan periode berlaku.
- Event menyimpan snapshot `distance_from_point_m` dan `allowed_radius_m`; perubahan radius tidak mengubah histori.
- Backend menghitung jarak dan tidak mempercayai boolean `inside_geofence` dari klien.
- Koordinat dan foto dianggap data sensitif dengan retention yang jelas.
- Foto wajib memiliki pemeriksaan MIME nyata, ukuran, dimensi, hash, dan malware scan bila tersedia.
- Validasi background/liveness adalah hasil verifikasi, bukan bukti absolut. Status meragukan masuk `needs_review`.
- Jangan menyimpan biometric embedding mentah tanpa keputusan hukum, keamanan, dan retention terpisah.

## 11. Rekap absensi

`attendance_events` adalah bukti mentah. `attendance_daily_summaries` menyimpan:

- hadir, terlambat, tidak hadir, cuti, izin, sakit, dinas, libur, tidak lengkap, perlu tinjau;
- jam masuk pertama dan pulang terakhir;
- menit kerja, terlambat, pulang awal, kandidat lembur, dan lembur disetujui;
- versi kalkulasi dan waktu hitung.

Rekap harus mempertimbangkan jadwal, event valid, izin disetujui, hari libur, dan koreksi HRD. Perubahan aturan memicu recalculation terkontrol, bukan update event mentah.

Dashboard dan laporan rutin membaca rekap, bukan menghitung jutaan event setiap request.

## 12. Cuti dan izin

- Approval final hanya oleh role HRD aktif.
- Tahap sekarang HRD dapat mencatat izin langsung dengan `submission_source='hrd_entry'`.
- Tahap mobile karyawan dapat submit; keputusan tetap HRD.
- Pimpinan hanya melihat sesuai permission.
- Jenis sakit dapat mewajibkan `required_attachment_category='medical_letter'`.
- Request tidak boleh menjadi approved jika lampiran wajib belum ada dan valid.
- Overlap izin, saldo, tanggal kontrak, hari libur, dan status pegawai harus divalidasi server.
- Keputusan, pembatalan, dan perubahan lampiran diaudit.

## 13. Disiplin berdasarkan Peraturan Perusahaan

Rujukan yang sudah diverifikasi: Pasal 52-58 pada dokumen Kode Etik, Tata Tertib, Jenis Pelanggaran dan Sanksi.

Aturan utama:

- Pelanggaran ringan mencakup mangkir 1 hari, terlambat/pulang awal tanpa izin, dan tidak melakukan absensi.
- Ringan: teguran lisan; SP1 bila tidak membaik; SP2 bila mengulang setelah SP1; SP3 bila mengulang setelah SP2.
- Sedang mencakup mangkir 3 hari kerja berturut-turut dan pengulangan pelanggaran ringan dalam masa SP.
- Sedang: SP1, lalu SP2, lalu SP3; perusahaan dapat langsung memberi SP2/SP3 dengan pertimbangan kesalahan dan dampak.
- Berat mencakup mangkir 5 hari kerja berturut-turut atau lebih, atau 9 hari kerja dalam 1 bulan, serta daftar pelanggaran berat lain dalam Pasal 58.
- Berat dapat berujung SP3, skorsing, penurunan jabatan, dan/atau PHK sesuai proses resmi.
- SP1, SP2, dan SP3 masing-masing berlaku 3 bulan sejak diterbitkan dan gugur bila tidak ada pelanggaran dalam masa berlaku.
- Pegawai dapat diberi kesempatan menjelaskan/membela diri sebelum sanksi berat, kecuali tertangkap tangan.

Sistem hanya membentuk `discipline_indicators`. HRD harus:

1. Meninjau bukti.
2. Membuka `discipline_cases` bila layak.
3. Mencatat klasifikasi dan penjelasan pegawai.
4. Mengunggah surat untuk tindakan tertulis.
5. Menerbitkan `disciplinary_actions`.

Dilarang membuat job yang otomatis mengubah indikator menjadi SP/PHK. Direct SP2/SP3 wajib menyimpan `direct_escalation=true` dan alasan. Dokumen dan uraian kasus hanya boleh terlihat oleh role berwenang.

## 14. File privat

- Development boleh memakai direktori privat di luar public web root.
- Produksi direkomendasikan object storage privat.
- Database menyimpan `object_key`, nama asli, MIME, ukuran, hash, kategori, dan pemilik tenant.
- API file melakukan authorization setiap preview/download dan mengaudit dokumen sensitif.
- Jangan membangun URL `/uploads/...` yang bisa ditebak.
- Nama objek gunakan UUID; jangan gunakan nama asli atau NIK.
- Upload logo juga masuk `stored_files`, lalu direferensikan oleh `organization_branding` atau lokasi.
- Delete normal adalah soft delete + retention job; jangan hapus bukti aktif secara langsung.

## 15. Query dan indexing

Aturan wajib:

- Hindari `SELECT *` pada API.
- Semua list memakai keyset pagination bila data besar; offset hanya untuk master kecil.
- Filter tenant dan rentang tanggal harus berada di query SQL.
- Hindari N+1; gunakan join/batch query.
- Dashboard membaca view/rekap dan cache singkat bila tidak harus real-time.
- Export besar dijalankan background job dan menghasilkan file privat.
- Jangan menambah index untuk setiap kolom. Tambah index berdasarkan query nyata.
- Sebelum merge query penting, uji `EXPLAIN (ANALYZE, BUFFERS)` dengan data representatif.
- Pantau `pg_stat_statements`, koneksi, lock, autovacuum, dead tuples, cache hit, dan pertumbuhan index.

Index utama sudah disiapkan untuk:

- pencarian nama pegawai dengan trigram;
- daftar pegawai aktif per tenant;
- penempatan aktif dan histori;
- kontrak akan berakhir;
- event per pegawai/waktu dan event perlu tinjau;
- rekap per tanggal/status, ranking terlambat, dan histori pegawai;
- izin menunggu dan histori izin;
- indikator/kasus/tindakan disiplin;
- audit dan outbox.

Gunakan connection pool. Banyak instance/serverless memerlukan pool eksternal seperti PgBouncer. Transaksi harus singkat; jangan melakukan upload atau network call di dalam transaksi database.

## 16. Partitioning dan retention

- `attendance_events` dipartisi bulanan berdasarkan `event_date`.
- Scheduler membuat partisi bulan berjalan dan minimal dua bulan ke depan memakai `ensure_attendance_month_partition()`.
- Default partition hanya pengaman; monitor dan pindahkan isinya ke partisi yang benar.
- Jangan membuat satu partisi per tenant atau per hari.
- Rekap harian tidak perlu dipartisi sebelum volume dan query plan membuktikan kebutuhan.
- Kebijakan retention foto absensi dapat lebih pendek daripada rekap, tetapi harus disetujui organisasi.

## 17. API

- Gunakan path versi, misalnya `/api/v1/...`.
- Respons error publik memakai kode stabil dan Bahasa Indonesia; jangan bocorkan SQL/stack trace.
- Mutation mendukung request ID dan idempotency pada operasi yang mungkin retry.
- Gunakan optimistic concurrency atau version check pada form edit penting.
- Tanggal tanpa waktu memakai ISO `YYYY-MM-DD`; waktu absolut memakai ISO 8601 UTC.
- Cursor pagination harus opaque.
- Semua endpoint mempunyai authorization test, validation test, dan tenant isolation test.

Endpoint awal yang disarankan:

- `GET/POST /api/v1/employees`
- `GET/PATCH /api/v1/employees/:id`
- `POST /api/v1/employees/:id/assignments`
- `GET /api/v1/employees/:id/history`
- `POST /api/v1/attendance/imports`
- `POST /api/v1/attendance/imports/:id/validate`
- `POST /api/v1/attendance/imports/:id/commit`
- `GET /api/v1/attendance/daily`
- `POST /api/v1/attendance/events` untuk web/mobile kelak
- `POST /api/v1/leave-requests`
- `POST /api/v1/leave-requests/:id/decision`
- `GET /api/v1/discipline/indicators`
- `POST /api/v1/discipline/cases`
- `POST /api/v1/discipline/cases/:id/actions`
- `GET /api/v1/dashboard/leader`

## 18. Keamanan dan privasi

- Password memakai Argon2id atau provider autentikasi tepercaya.
- Session server-side memakai cookie HttpOnly, Secure, SameSite yang tepat.
- Rate limit login, reset password, upload, export, dan attendance endpoint.
- NIK, BPJS, rekening, koordinat, dokumen, dan kasus disiplin dimasking di list/log.
- Jangan masukkan rahasia atau data pribadi ke analytics, fixture publik, screenshot, seed, atau error tracker.
- Audit login, perubahan role, pegawai, rolling, koreksi absensi, izin, dokumen sensitif, dan sanksi.
- Validasi MIME dari byte; jangan percaya ekstensi.
- Gunakan antivirus/malware scan bila tersedia.
- Backup terenkripsi dan uji restore berkala.
- Terapkan retention dan prosedur penghapusan yang disetujui.
- Frontend tidak boleh menerima data sensitif yang tidak berhak hanya untuk disembunyikan dengan CSS.

## 19. Migration dan transaksi

- Satu migration untuk satu perubahan logis.
- Migration harus dapat dijalankan pada database kosong dan database berisi data.
- Perubahan destruktif memakai pola expand-migrate-contract.
- Backfill besar berjalan batch dan dapat dilanjutkan.
- Pembuatan index besar di produksi pertimbangkan `CREATE INDEX CONCURRENTLY` pada migration nontransactional.
- Jangan mengganti migration yang sudah dirilis; buat migration koreksi.
- Setiap use case multi-tabel memakai transaksi.
- Lock record aktif saat rolling, approval, commit import, dan penerbitan tindakan untuk mencegah race condition.

## 20. Testing wajib

Minimal sebelum pekerjaan dianggap selesai:

- Unit test aturan shift fixed, flexible, field, lintas tengah malam, toleransi, pulang awal, dan kandidat lembur.
- Unit test mangkir 1, 3 berturut-turut, 5 berturut-turut, dan 9 dalam sebulan menghasilkan indikator yang tepat tetapi tidak membuat sanksi.
- Integration test rolling menutup penempatan lama dan menyimpan histori.
- Integration test tidak ada dua penempatan utama aktif.
- Integration test import: preview, error per baris, duplicate retry, dan commit idempotent.
- Integration test mobile event retry tidak menggandakan event.
- Integration test HRD-only decision; pimpinan dan karyawan ditolak.
- Test izin sakit tidak dapat approved tanpa surat dokter ketika diwajibkan.
- Test lintas tenant untuk setiap repository/use case utama.
- Test file privat tidak bisa diakses dengan object key langsung.
- Test query plan untuk dashboard pada dataset representatif.

Gunakan data sintetis. Jangan memakai data pegawai asli pada test atau development bersama.

## 21. UI/UX

- Seluruh antarmuka Bahasa Indonesia dan dapat dipahami pengguna nonteknis.
- Desktop: sidebar; mobile: drawer/bottom navigation dan tabel kompleks menjadi card list.
- Status tidak hanya disampaikan dengan warna; tambahkan label/ikon.
- List umum memasking data sensitif.
- Pimpinan melihat ringkasan dan histori, bukan tombol edit.
- Form panjang memakai stepper, autosave draft yang aman, dan peringatan perubahan belum disimpan.
- Sediakan loading, skeleton, empty, no-result, validation error, server error, permission denied, session expired, dan confirmation dialog.
- Tindakan disiplin ditampilkan profesional tanpa mempermalukan pegawai.

## 22. Observability dan operasional

- Gunakan structured logging dengan `request_id`, `organization_id`, `actor_user_id`, dan nama use case; jangan log payload sensitif.
- Ukur latency API p50/p95/p99, error rate, queue lag, koneksi DB, slow query, import duration, dan recalculation duration.
- Alert untuk partisi bulan depan belum ada, default partition bertambah, outbox macet, storage gagal, atau backup gagal.
- Health check tidak menjalankan query berat.

## 23. Definition of Done

Pekerjaan selesai hanya jika:

1. Kebutuhan dan permission jelas.
2. Migration/schema, code, dan dokumentasi konsisten.
3. Tenant isolation diterapkan.
4. Validasi frontend dan backend tersedia.
5. Audit dan error handling sesuai risiko.
6. Test relevan lulus.
7. Query baru memiliki index/query plan yang masuk akal.
8. Tidak ada rahasia atau data pribadi dalam repo/log.
9. UI responsive dan state penting diuji.
10. Perubahan tidak merusak kontrak mobile/API tanpa versioning.

## 24. Larangan untuk Codex/developer

- Jangan menghapus histori pegawai untuk “merapikan” data.
- Jangan menambahkan kolom `current_division`/`current_location` sebagai sumber kebenaran kedua.
- Jangan menghubungkan tabel lintas tenant hanya dengan ID tanpa memeriksa organisasi.
- Jangan menjadikan setiap checkout lewat jam sebagai lembur otomatis.
- Jangan membuat sanksi otomatis dari indikator.
- Jangan mengizinkan pimpinan menyetujui izin bila aturan produk masih HRD-only.
- Jangan menyimpan foto/dokumen sebagai URL publik atau base64 di tabel transaksi.
- Jangan memanggil database langsung dari mobile.
- Jangan menjalankan export besar pada request web sinkron.
- Jangan menonaktifkan constraint/index demi melewati bug tanpa analisis dan migration resmi.
