# Master Plan Sistem dan Database HRIS Perumda Pasar Manado

> Dokumen ini menjadi sumber aturan proyek untuk developer dan AI/Codex. Jika implementasi berbeda dari dokumen ini, perubahan harus disetujui dan dicatat melalui migration serta pembaruan dokumen.

## 1. Hasil utama

Skema dirancang sebagai aplikasi HRIS **multi-perusahaan (multi-tenant)** untuk PostgreSQL 18. Superadmin mengelola perusahaan, paket langganan, dan masa aktif setiap lokasi; admin HRD hanya mengelola tenant yang ditugaskan; Direksi memperoleh akses baca sesuai izin; karyawan mengelola profil dan pengajuan miliknya sendiri.

Desain memisahkan data yang bersifat **master**, **transaksi**, dan **histori**. Jabatan, lokasi, kontrak, penempatan, surat peringatan, serta absensi tidak ditimpa ketika berubah. Pendekatan ini penting agar Direksi dapat melihat kondisi saat ini sekaligus riwayat lengkap pegawai.

File implementasi: `hris_perumda_postgresql.sql`.

## 2. Prinsip rancangan

1. Semua data bisnis terkait tenant mempunyai `organization_id` secara langsung atau melalui pegawai.
2. Primary key seluruh tabel memakai BIGINT GENERATED ALWAYS AS IDENTITY agar menghasilkan ID numerik berurutan. Identitas event eksternal mobile memakai token teks terpisah untuk idempotensi.
3. NIK, NIP, nomor telepon, BPJS, dan nomor dokumen memakai teks, bukan angka.
4. Umur dan masa kerja tidak disimpan karena berubah terhadap waktu; keduanya dihitung dari `birth_date`, `joined_date`, atau histori kontrak.
5. Riwayat penempatan/jabatan memakai periode `start_date`–`end_date`.
6. Absensi menyimpan event mentah dan ringkasan harian secara terpisah sehingga aturan perhitungan dapat diubah tanpa kehilangan bukti asli.
7. `client_event_id` membuat sinkronisasi mobile idempotent: pengiriman ulang tidak menghasilkan absensi ganda.
8. Pada versi awal, dokumen disimpan di folder privat `uploads/`; database hanya menyimpan path relatif `file_key` dan metadata, bukan byte file. Kontrak API harus memungkinkan pemindahan ke object storage kelak tanpa mengubah tabel bisnis.
9. Data sensitif dilindungi dengan izin granular dan semua perubahan penting dicatat di `audit_logs`.
10. Kolom `jsonb` hanya untuk metadata/integrasi tambahan, bukan sebagai pengganti struktur relasional inti.

## 3. Kelompok tabel dan fungsinya

| Kelompok | Tabel | Fungsi |
|---|---|---|
| Tenant | `organizations` | Perusahaan/organisasi, masa aktif, status, zona waktu, konfigurasi. |
| Komersial | `subscription_plans`, `organization_subscriptions`, `location_licenses` | Paket aplikasi, masa langganan tenant, batas fitur, dan aktivasi setiap lokasi. |
| Organisasi | `locations`, `org_units`, `positions` | Cabang/unit pasar/lokasi; struktur divisi bertingkat; master jabatan. |
| Akses | `users`, `roles`, `permissions`, `role_permissions`, `user_organization_roles` | Login dan RBAC per perusahaan. Role Direksi ditambahkan karena kebutuhannya berbeda dari admin HRD dan staff. |
| Pegawai | `employees`, `employee_contacts` | Profil inti dan kontak/alamat pegawai. |
| Keluarga | `employee_dependents`, `employee_emergency_contacts` | Pasangan, anak, tanggungan, dan kontak darurat. |
| Kompetensi | `education_levels`, `employee_educations` | Pendidikan terakhir dan histori pendidikan. |
| Identitas | `employee_identifiers`, `employee_social_accounts`, `employee_documents` | BPJS/NPWP, media sosial, serta dokumen pegawai. |
| Hubungan kerja | `employment_types`, `employment_contracts` | Jenis pegawai dan seluruh periode kontrak PKWT/PHL/THL/dll. |
| Histori organisasi | `employee_assignments` | Riwayat jabatan, divisi, lokasi, mutasi, pelaksana tugas, dan atasan. |
| Disiplin | `disciplinary_action_types`, `disciplinary_actions` | SP1/SP2/SP3, masa berlaku, dokumen, pencabutan, dan status. |
| Absensi | `work_shifts`, `employee_shift_schedules`, `attendance_devices`, `attendance_events`, `attendance_daily_summaries` | Shift, jadwal, sumber absensi, event mobile/device, dan rekap dashboard. |
| Cuti/izin | `leave_types`, `leave_balances`, `leave_requests`, `leave_request_attachments`, `leave_approvals` | Jenis izin, saldo, permohonan, surat dokter, dan alur persetujuan. |
| Tata kelola | `audit_logs`, `integration_outbox` | Jejak perubahan dan integrasi asinkron dengan mobile/sistem lain. |

## 4. Pemetaan seluruh kolom Excel

| Kolom/sumber Excel | Tujuan database | Catatan |
|---|---|---|
| Unit pasar pada Sheet1 | `locations.name` | Angka responden/belum merespon adalah laporan sementara, bukan data induk pegawai. |
| JABATAN | `positions.name` + `employee_assignments.position_id` | Jabatan aktif dan histori dipisahkan. |
| JUMLAH PERSONIL | Query `COUNT(*)` | Tidak disimpan untuk menghindari ketidaksesuaian data. |
| NAMA PERSONIL | `employees.full_name` | Nama utama pegawai. |
| NIP | `employees.employee_no` | Bertipe teks. |
| BPJS Kesehatan | `employee_identifiers` tipe `bpjs_health` | Mendukung lebih dari satu jenis identitas. |
| BPJS TK / BPJS TK BSU | `employee_identifiers` tipe `bpjs_employment` | Label BSU tetap bisa dicatat di metadata/catatan migrasi. |
| T.M.T | `employees.joined_date`, `employment_contracts.start_date`, atau `employee_assignments.start_date` | Makna harus dipilih saat migrasi sesuai konteks sheet. |
| AWAL PKWT / AKHIR PKWT | `employment_contracts.start_date/end_date` | Riwayat perpanjangan menjadi baris baru. |
| MASA KERJA | Dihitung dengan `age(current_date, joined_date)` | Tidak disimpan. |
| T.T.L | `employees.birth_place` + `employees.birth_date` | Data sumber perlu dipecah dan dinormalisasi karena formatnya beragam. |
| UMUR | Dihitung dari `birth_date` | Tidak disimpan. |
| GENDER | `employees.gender` | Nilai PRIA/WANITA dipetakan ke `male/female`. |
| NO HP/WA | `employee_contacts.phone/whatsapp` | Bertipe teks. |
| NIK | `employees.national_id` | Unique dalam satu perusahaan; bertipe teks. |
| ALAMAT | `employee_contacts.address` dan komponen wilayah opsional | Data lama dapat tetap masuk ke alamat lengkap terlebih dahulu. |
| PENDIDIKAN TERAKHIR | `employee_educations` + `education_levels` | Bisa menyimpan institusi dan jurusan pada tahap berikutnya. |
| AGAMA | `employees.religion` | Teks fleksibel agar tidak mengunci daftar terlalu dini. |
| STATUS | `employees.marital_status` | Normalisasi KAWIN/MENIKAH dan BELUM KAWIN/BELUM MENIKAH saat impor. |
| JUMLAH SUAMI/ISTRI | Hasil `COUNT(employee_dependents)` relasi `spouse` | Idealnya data pasangan per individu, bukan hanya jumlah. |
| JUMLAH ANAK | Hasil `COUNT(employee_dependents)` relasi `child` | Tetap bisa diimpor sebagai catatan sementara jika nama belum tersedia. |
| AKUN MEDIA SOSIAL | `employee_social_accounts` | Satu pegawai dapat memiliki beberapa akun/platform. |
| JABATAN SEBELUMNYA | Baris historis di `employee_assignments` | Jangan disimpan sebagai satu kolom teks permanen. |
| TANGGAL PINDA TUGAS | Batas `end_date/start_date` antar-penugasan | Menjadi tanggal efektif mutasi. |
| KET. PHL/DRIVER | `employment_types` dan/atau `positions` | PHL adalah jenis hubungan kerja; DRIVER adalah jabatan. |

Sheet yang diperiksa: `Sheet1`, `STRUKTUR`, `PHL`, `PKWT`, `TENAGA TEKNIS`, dan `STAF KHUSUS`.

## 5. Penjelasan kolom standar

Kolom berikut berulang pada banyak tabel:

| Kolom | Fungsi |
|---|---|
| `id` | Identitas numerik berurutan dari PostgreSQL IDENTITY. |
| `organization_id` | Pembatas tenant/perusahaan. Wajib menjadi filter setiap query bisnis. |
| `code` | Kode singkat yang stabil untuk integrasi dan URL internal. |
| `is_active` | Menonaktifkan master tanpa menghapus histori. |
| `active_from`, `active_until` | Masa berlaku perusahaan/lokasi/unit. |
| `created_at`, `updated_at` | Waktu pembuatan dan perubahan data. |
| `created_by`, `uploaded_by`, `verified_by` | Akun pelaku tindakan. |
| `start_date`, `end_date` | Periode berlakunya kontrak/penempatan. `end_date NULL` berarti masih aktif. |
| `status` | Tahap proses atau keadaan record. |
| `document_id` | Referensi ke dokumen pendukung. |
| `metadata`/`settings` | Atribut tambahan untuk integrasi/konfigurasi yang belum layak menjadi kolom inti. |

Komentar teknis juga sudah dimasukkan langsung ke SQL untuk tabel/kolom yang membutuhkan penegasan.

## 6. Koreksi terhadap rancangan role awal

Tiga role `superadmin`, `admin`, dan `staff` belum cukup untuk kebutuhan yang dijelaskan. Direksi sebaiknya menjadi role tersendiri (`director`) dengan izin baca data pegawai, laporan absensi, histori jabatan/penempatan, dan status tindakan disiplin, tanpa otomatis memperoleh hak mengubah data HRD.

Jangan menuliskan logika hanya berdasarkan nama role di kode Next.js. Gunakan permission seperti `employee.read`, `employee.update`, `attendance.read`, `discipline.read`, dan `leave.approve`, lalu hubungkan permission ke role. Dengan demikian hak Direksi atau HRD dapat disesuaikan tanpa migrasi database.

## 7. Catatan keamanan dan implementasi Next.js

- Semua query tenant harus menyertakan `organization_id`; pertimbangkan PostgreSQL Row-Level Security pada fase produksi setelah pola koneksi aplikasi ditetapkan.
- NIK, BPJS, alamat, surat dokter, dan dokumen disiplin merupakan data sensitif. Batasi respons API berdasarkan field, bukan hanya halaman UI.
- Simpan password memakai Argon2id/bcrypt di aplikasi atau gunakan penyedia autentikasi; jangan pernah menyimpan password biasa.
- Gunakan folder `uploads/` yang privat melalui API terotorisasi pada tahap awal; pertahankan storage abstraction agar dapat dipindahkan ke object storage privat kemudian.
- Validasi MIME type, ukuran, dan malware pada upload.
- Audit perubahan data pegawai, role, penempatan, SP, koreksi absensi, dan keputusan cuti.
- Gunakan transaksi database saat mengganti penempatan: tutup penempatan lama dan buat penempatan baru dalam satu transaksi.
- API web dan mobile sebaiknya memakai service layer yang sama. Next.js tidak boleh menganggap event absensi selalu datang berurutan atau hanya sekali.
- Tanggal/waktu absensi memakai `timestamptz`; tanggal lahir dan tanggal kontrak memakai `date`.

## 8. Urutan implementasi yang disarankan

1. Tenant, struktur organisasi, user, dan RBAC.
2. Profil pegawai, kontak, identitas, pendidikan, keluarga, dan dokumen.
3. Kontrak, jabatan, penempatan, dan histori mutasi.
4. SP/tindakan disiplin serta dashboard Direksi.
5. Cuti dan izin beserta upload dan approval.
6. Shift, jadwal, absensi web/import, lalu event mobile.
7. Audit, notifikasi, integrasi, dan penguatan Row-Level Security.

## 9. Hal yang perlu diputuskan sebelum migrasi data

- Definisi pasti T.M.T pada setiap sheet: tanggal masuk perusahaan, tanggal mulai kontrak, atau tanggal mulai jabatan.
- Apakah unit pasar diperlakukan sebagai `location`, `org_unit`, atau keduanya. Saran: pasar sebagai lokasi, sedangkan organisasi pengelolanya sebagai unit.
- Aturan masa berlaku SP1/SP2/SP3 dan alur banding/pencabutan.
- Jenis cuti/izin, kuota tahunan, urutan approver, serta kapan surat dokter wajib.
- Apakah seorang pegawai dapat memiliki lebih dari satu penempatan aktif (misalnya pelaksana tugas tambahan).
- Kebijakan akses Direksi terhadap NIK, alamat, BPJS, dan dokumen medis; data yang tidak dibutuhkan sebaiknya dimasking.

## 10. Arsitektur aplikasi

### 10.1 Teknologi

- Next.js full-stack dengan TypeScript strict untuk frontend, route handler/server action, dan service layer.
- PostgreSQL 18 sebagai satu-satunya sumber kebenaran data bisnis.
- ORM boleh Prisma atau Drizzle, tetapi SQL pada file pendamping adalah kontrak domain. Setiap perubahan wajib dibuat sebagai migration yang dapat direview.
- Aplikasi web responsive adalah tahap pertama. API dan service layer tidak boleh bergantung pada tampilan web agar kelak dapat dipakai aplikasi mobile.
- Gunakan satu zona waktu tenant pada `organizations.timezone`; simpan timestamp sebagai `timestamptz` dan tampilkan sesuai tenant.

### 10.2 Lapisan wajib

1. **UI/component layer**: hanya presentasi, state tampilan, dan validasi kenyamanan pengguna.
2. **Route/API layer**: autentikasi, parsing input, rate limit, dan serialisasi respons.
3. **Service/domain layer**: aturan HRIS, otorisasi, transaksi, dan audit.
4. **Repository/data layer**: query terparameterisasi dan selalu tenant-scoped.
5. **Storage layer**: validasi dan akses file melalui API, tidak pernah melalui static public directory.

Komponen UI dilarang mengakses database secara langsung. Route handler juga tidak boleh menaruh aturan bisnis kompleks; panggil service yang dapat diuji.

## 11. Role dan izin

| Role awal | Batas akses |
|---|---|
| `superadmin` | Mengelola tenant, admin tenant, paket, langganan, aktivasi lokasi, serta konfigurasi platform. Tidak otomatis membaca dokumen medis kecuali ada izin eksplisit. |
| `admin` | HRD tenant: data pegawai, struktur, kontrak, penempatan, SP, jadwal, absensi, cuti, dan laporan pada tenant sendiri. |
| `director` | Membaca dashboard dan profil yang diizinkan, absensi, jabatan, histori penempatan, dan status SP. Tidak boleh mengubah data HRD secara default. |
| `staff` | Melihat data sendiri, mengusulkan perubahan profil, mengajukan cuti/izin, mengunggah lampiran, serta melihat histori sendiri. |

AI wajib menggunakan permission granular, bukan pemeriksaan nama role yang tersebar. Contoh permission: `employee.read`, `employee.write`, `employee.sensitive.read`, `attendance.read`, `attendance.correct`, `assignment.write`, `discipline.read`, `discipline.write`, `leave.request`, `leave.approve`, `subscription.manage`.

## 12. Aturan tenant, langganan, dan masa aktif

- Setiap permintaan setelah login harus mempunyai konteks tenant yang tervalidasi dari keanggotaan server-side; jangan percaya `organization_id` dari browser.
- Semua query data tenant wajib difilter tenant. ID numerik yang valid tetap tidak boleh diakses bila berasal dari tenant lain.
- Tenant dapat digunakan hanya bila organisasi aktif dan langganan berada pada status `trial`, `active`, atau `grace` serta belum melewati batas waktunya.
- Fitur berbasis lokasi juga memerlukan `location_licenses` aktif. Menonaktifkan lokasi tidak menghapus pegawai atau histori.
- Masa aktif baru dicatat sebagai baris langganan/lisensi baru. Jangan menimpa histori pembayaran atau aktivasi lama.
- Batas `max_locations` dan `max_employees` diperiksa di backend dalam transaksi sebelum insert.
- Ketika langganan berakhir, default-nya akses menjadi read-only untuk admin tenant selama grace period; kebijakan final harus dapat dikonfigurasi.

## 13. Aturan upload dan API file

Struktur yang disarankan:

```text
uploads/
  organizations/{organizationId}/
    employees/{employeeId}/photos/
    employees/{employeeId}/documents/
    leave-requests/{leaveRequestId}/
    disciplinary-actions/{disciplinaryActionId}/
```

Aturan wajib:

- Folder `uploads/` tidak boleh berada di `public/` dan tidak boleh dilayani langsung oleh web server.
- Database menyimpan path relatif seperti `organizations/1/employees/20/documents/abc.pdf`, bukan `C:\...`, `/home/...`, atau URL penuh.
- Upload hanya melalui endpoint terautentikasi, misalnya `POST /api/uploads`; view/download melalui `GET /api/uploads/{documentId}`.
- API view harus memeriksa tenant, kepemilikan, permission, status record, dan klasifikasi rahasia sebelum mengirim file.
- Nama file fisik dibuat acak; `original_name` hanya metadata download. Jangan memakai nama asli sebagai path.
- Tolak path traversal (`..`), null byte, double extension berbahaya, dan symlink escape.
- Validasi ukuran, ekstensi, MIME hasil deteksi isi file, dan signature/magic bytes. Jangan percaya header browser.
- Allowlist awal: foto `jpg/jpeg/png/webp`; dokumen `pdf`; format lain harus disetujui. Blokir HTML, SVG aktif, executable, script, dan arsip secara default.
- Terapkan batas ukuran terkonfigurasi, scanning malware, checksum SHA-256, dan audit upload/download sensitif.
- Endpoint gambar mengirim `Content-Type` benar, `X-Content-Type-Options: nosniff`, kebijakan cache privat, dan `Content-Disposition` aman.
- Penghapusan record memakai soft delete/retention. File fisik dibersihkan oleh job setelah masa retensi, bukan langsung saat transaksi utama.
- Jangan menerima path file dari client. Client hanya mengirim file dan ID konteks; server menentukan destination.

## 14. Validasi frontend dan backend

- Frontend wajib memberi feedback cepat, tetapi seluruh aturan wajib diulang di backend. Validasi frontend bukan kontrol keamanan.
- Gunakan schema bersama (misalnya Zod) bila sesuai, namun backend tetap menjadi otoritas final.
- Normalisasi string dengan trim; kosong menjadi `NULL` jika semantik memang tidak ada.
- NIK harus berupa teks 16 digit bila kebijakan final mewajibkan; NIP, telepon, BPJS, dan kode lain tetap teks.
- Validasi tanggal lahir tidak di masa depan; akhir kontrak tidak mendahului awal; akhir penempatan tidak mendahului awal; rentang izin valid.
- Umur dan masa kerja dihitung, tidak diterima sebagai field yang dapat disunting.
- Untuk sakit, backend memeriksa `leave_types.requires_attachment`; request tidak boleh disubmit tanpa surat dokter yang valid.
- Pergantian penempatan utama wajib transaksi: kunci record terkait, tutup penempatan lama, buat yang baru, lalu audit.
- Cegah dua penempatan utama aktif melalui index database dan penanganan konflik aplikasi.
- Tampilkan error field-level yang aman; jangan kirim stack trace, SQL, path server, atau detail internal.

## 15. Keamanan autentikasi dan backend

- Password di-hash Argon2id (atau bcrypt dengan parameter kuat bila Argon2id tidak tersedia); jangan pernah log password/token.
- Cookie sesi wajib `HttpOnly`, `Secure` di produksi, dan `SameSite=Lax/Strict` sesuai alur. Rotasi sesi setelah login/perubahan privilege.
- Proteksi CSRF untuk mutation berbasis cookie, CORS allowlist, rate limiting login/upload/API sensitif, dan lockout bertahap.
- Otorisasi dilakukan pada setiap service operation dan setiap file download. Menyembunyikan tombol bukan otorisasi.
- Gunakan query parameterized/ORM; dilarang menyusun SQL dari input dengan concatenation.
- Terapkan least privilege pada akun database dan pisahkan credential development, staging, production.
- Rahasia hanya dari environment/secret manager; `.env` tidak dikomit. Validasi environment saat startup.
- Masking NIK/BPJS/telepon pada list dan log. Data lengkap hanya untuk permission sensitif.
- Audit login, perubahan role, perubahan pegawai, mutasi, SP, koreksi absensi, approval, upload/download sensitif, dan perubahan lisensi.
- Jangan memasukkan data pribadi ke analytics, error tracker, fixture, screenshot, atau seed publik.
- Backup terenkripsi dan uji restore secara berkala. Tetapkan retention serta prosedur akses dan penghapusan data.

## 16. Keamanan frontend

- React melakukan escaping secara default; dilarang memakai `dangerouslySetInnerHTML` untuk data pengguna tanpa sanitizer yang disetujui.
- Jangan menyimpan access token atau data sensitif permanen di `localStorage`.
- Jangan mengandalkan ID dari URL tanpa pemeriksaan backend.
- Terapkan Content Security Policy, frame-ancestors, Referrer-Policy, dan Permissions-Policy yang sesuai.
- Semua mutation mempunyai loading, success, failure, dan pencegahan double-submit.
- Data sensitif tidak boleh berada di source HTML/React payload jika user tidak berhak, walaupun disembunyikan dengan CSS.

## 17. Desain UI/UX responsive dan aksesibilitas

- Mobile-first pada lebar 320 px ke atas; breakpoint harus konsisten dan diuji pada ponsel, tablet, laptop, serta desktop.
- Tidak boleh ada horizontal overflow halaman. Tabel besar memakai responsive table, column priority, scroll container, atau card view.
- Sidebar berubah menjadi drawer pada layar kecil; aksi utama tetap mudah dijangkau.
- Form panjang dibagi per bagian/tab/step, tetapi status validasi dan data draft tidak hilang saat berpindah.
- Target sentuh minimum sekitar 44×44 px, focus state terlihat, urutan keyboard logis, dan modal dapat ditutup dengan keyboard.
- Semua input memiliki label, helper/error yang terhubung secara aksesibel, kontras memadai, serta tidak hanya mengandalkan warna.
- Gunakan skeleton seperlunya, empty state informatif, konfirmasi untuk tindakan berdampak, dan toast tidak menjadi satu-satunya tempat error penting.
- Dashboard Direksi fokus pada pencarian pegawai, ringkasan absensi, posisi saat ini, histori penempatan, kontrak, dan status SP aktif/riwayat.
- Desain harus konsisten melalui design tokens untuk warna, spacing, radius, typography, z-index, dan state komponen. Hindari nilai acak per halaman.

## 18. Aturan data dan transaksi HRIS

- Record histori (kontrak, penempatan, SP, approval, langganan) tidak di-update menjadi histori baru; buat record periode baru dan pertahankan yang lama.
- Soft delete dipakai untuk pegawai/dokumen yang perlu retensi. Master yang sudah direferensikan dinonaktifkan, bukan dihapus.
- PHL/THL/PKWT adalah jenis hubungan kerja; Driver/Kepala Unit/Staf adalah jabatan; Pasar Bersehati adalah lokasi. Jangan mencampur ketiganya.
- Perubahan data oleh karyawan yang sensitif (NIK, tanggal lahir, rekening, status keluarga) sebaiknya masuk workflow usulan dan persetujuan HRD, bukan langsung mengganti data resmi.
- Koreksi absensi tidak mengubah event mentah; simpan koreksi dan audit, lalu hitung ulang summary.
- Event mobile harus idempotent melalui `client_event_id`; server mencatat waktu kejadian dan waktu diterima.
- Semua operasi multi-record wajib transaksi dan rollback utuh jika satu langkah gagal.

## 19. Kontrak API

- Prefix versi, misalnya `/api/v1`, agar mobile lama tetap dapat bekerja ketika API berkembang.
- Gunakan bentuk respons konsisten: data, metadata pagination, dan error code stabil.
- Pagination wajib untuk daftar pegawai, absensi, audit, dokumen, dan histori besar; jangan mengirim semua baris.
- Filter/sort hanya dari allowlist. Search memakai index yang sesuai dan dibatasi panjangnya.
- Mutation menerima idempotency key untuk operasi yang rawan retry.
- Jangan mengirim model database mentah. Gunakan DTO agar field sensitif dan perubahan schema tidak bocor ke client.
- Endpoint health tidak boleh membuka versi dependency, secret, atau detail database.

## 20. Aturan database PostgreSQL 18

- Semua primary key tabel menggunakan `bigint GENERATED ALWAYS AS IDENTITY`; jangan memakai `serial`, `bigserial`, atau UUID sebagai primary key.
- Semua foreign key harus sama-sama `bigint` dan mempunyai index bila dipakai untuk join/filter berfrekuensi tinggi.
- Gunakan `date` untuk tanggal tanpa waktu, `timestamptz` untuk kejadian, `numeric` untuk jumlah presisi, dan teks untuk identifier.
- Constraint database adalah lapisan terakhir: `NOT NULL`, `CHECK`, `UNIQUE`, foreign key, dan partial unique index tetap wajib meski aplikasi sudah memvalidasi.
- Nama tabel/kolom snake_case; nama constraint/index eksplisit untuk aturan bisnis penting.
- Migration harus forward-only, kecil, dapat direview, dan memiliki rencana backfill. Jangan mengedit migration yang sudah dijalankan di lingkungan bersama.
- Perubahan destruktif memakai pola expand–migrate–contract dan backup terverifikasi.
- Query tenant besar harus mempunyai index gabungan yang dimulai dari `organization_id` bila pola akses memerlukannya.
- Gunakan transaksi dengan isolation/locking yang sesuai untuk kuota langganan, assignment aktif, saldo cuti, dan approval.

## 21. Testing dan quality gate wajib

- Unit test untuk service domain, kalkulasi absensi, validasi kontrak, saldo cuti, masa aktif, dan permission.
- Integration test dengan PostgreSQL nyata untuk constraint, transaction rollback, dan query tenant.
- Test isolasi tenant: user tenant A tidak dapat membaca/mengubah ID milik tenant B pada setiap endpoint kritis.
- Test upload: ukuran berlebih, MIME palsu, path traversal, file berbahaya, akses tenant lain, dan download tanpa izin.
- Test role matrix untuk superadmin, admin, director, dan staff.
- E2E untuk login, pembuatan pegawai, mutasi, SP, cuti sakit dengan surat dokter, approval, dan dashboard Direksi.
- Responsive visual test pada ukuran mobile/tablet/desktop dan pemeriksaan keyboard/accessibility.
- Sebelum merge: lint, typecheck, unit test, integration test, migration check, dan build produksi harus lulus.
- Bug fix wajib disertai regression test bila masuk akal.

## 22. Definition of Done untuk AI/Codex

AI hanya boleh menyatakan tugas selesai bila:

1. Kebutuhan dan tenant scope sudah dipahami; asumsi penting dicatat.
2. Implementasi mengikuti lapisan arsitektur dan permission server-side.
3. Validasi ada di frontend untuk UX dan backend untuk keamanan.
4. Mutation penting memakai transaksi dan menghasilkan audit.
5. Upload tidak mengekspos folder `uploads/` secara publik.
6. UI responsive, accessible, dan mempunyai loading/error/empty state.
7. Migration dan index relevan tersedia tanpa merusak histori.
8. Test relevan ditambah dan seluruh quality gate lulus.
9. Tidak ada secret, PII nyata, debug log, SQL mentah, atau path server yang bocor.
10. Dokumentasi API/schema diperbarui jika kontrak berubah.

AI dilarang melakukan perubahan luas di luar permintaan, menghapus histori, menonaktifkan validasi demi membuat test lulus, atau mengubah aturan keamanan tanpa persetujuan eksplisit.

## 23. Catatan deployment penyimpanan lokal

Folder `uploads/` cocok untuk tahap awal hanya bila server mempunyai disk persisten dan backup. Deployment serverless/container stateless dapat kehilangan file ketika instance diganti. Karena sistem akan dikomersialkan, storage interface harus diabstraksikan sejak awal (`LocalStorageProvider`), sehingga nanti dapat diganti dengan S3-compatible storage tanpa mengubah service HRIS atau database.

## 24. Kamus kolom per tabel

Semua tabel mempunyai `id` sebagai primary key numerik identity. Nilainya tampak seperti 1, 2, 3, dan seterusnya, tetapi PostgreSQL tidak menjamin tanpa celah setelah rollback/delete; ID tidak boleh diurutkan ulang atau dipakai sebagai nomor dokumen bisnis.

| Tabel | Arti kolom khusus |
|---|---|
| `organizations` | `parent_id` hierarki perusahaan; `code/name/legal_name` identitas; `organization_type` jenis tenant; `timezone/locale` format; `active_from/active_until/is_active` operasional; `settings` konfigurasi tambahan. |
| `subscription_plans` | `billing_period/price` periode dan harga; `max_locations/max_employees` kuota; `features` fitur paket. |
| `organization_subscriptions` | `organization_id/subscription_plan_id` tenant dan paket; `starts_at/ends_at/grace_ends_at` periode; `status` keadaan langganan; `external_reference` referensi invoice/payment. |
| `locations` | `organization_id/parent_id` tenant dan hierarki; `location_type` kantor/pasar/cabang; koordinat dan `attendance_radius_m` geofence; kolom aktif menentukan operasional. |
| `location_licenses` | Menghubungkan lokasi dengan langganan; periode dan `status` menentukan apakah lokasi boleh memakai aplikasi. |
| `org_units` | Struktur organisasi bertingkat melalui `parent_id`; `unit_type` membedakan direktorat/divisi/subdivisi/unit/tim. |
| `positions` | Jabatan pada unit; `grade/level_no` level; `is_managerial` penanda pimpinan; `reports_to_position_id` jalur pelaporan. |
| `users` | Akun login global; `password_hash` hash kredensial; verifikasi, login terakhir, dan status akun. |
| `roles` | Nama role dan `scope` platform/tenant/diri sendiri. |
| `permissions` | Kode aksi granular yang boleh dilakukan. |
| `role_permissions` | Pasangan role–permission yang unik. |
| `user_organization_roles` | Role akun pada tenant tertentu dan periode berlakunya; tenant kosong hanya untuk superadmin platform. |
| `employees` | `employee_no` NIP; `national_id` NIK; identitas lahir/gender/agama/perkawinan; status hubungan aktif; tanggal masuk/keluar; `photo_path` path relatif foto; `deleted_at` soft delete. |
| `employee_contacts` | Email kerja/pribadi, telepon, WhatsApp, alamat dan wilayah. |
| `employee_social_accounts` | Platform dan handle/URL media sosial; dapat lebih dari satu. |
| `employee_dependents` | Hubungan pasangan/anak/orang tua, identitas, tanggal lahir, status tanggungan, dan BPJS. |
| `education_levels` | Kode/nama jenjang dan `rank_no` untuk pengurutan. |
| `employee_educations` | Institusi, jurusan, tahun mulai/lulus, sertifikat, serta penanda pendidikan tertinggi. |
| `employee_emergency_contacts` | Nama, hubungan, nomor, alamat, dan kontak darurat utama. |
| `employee_identifiers` | Jenis/nomor BPJS, NPWP, paspor, tanggal terbit dan kedaluwarsa. |
| `employee_documents` | Jenis dokumen, `file_key` relatif `uploads/`, nama asli, MIME, ukuran, masa berlaku, verifikasi, uploader, dan kerahasiaan. |
| `employment_types` | PKWTT/PKWT/PHL/THL/dll serta kewajiban tanggal akhir. |
| `employment_contracts` | Pegawai, jenis hubungan kerja, nomor kontrak, periode, status, dokumen, dan catatan. |
| `employee_assignments` | Pegawai, jabatan, unit, lokasi, jenis assignment, periode, alasan mutasi, nomor SK, atasan, dan dokumen. |
| `disciplinary_action_types` | Kode SP/teguran, tingkat keparahan, dan masa berlaku default. |
| `disciplinary_actions` | Pegawai, jenis tindakan, nomor kasus, tanggal terbit/efektif, alasan, status, dokumen, penerbit, dan pencabutan. |
| `work_shifts` | Jam mulai/akhir, istirahat, lintas tengah malam, toleransi terlambat/pulang awal. |
| `employee_shift_schedules` | Shift pegawai pada tanggal/lokasi dan status jadwal. |
| `attendance_devices` | Kode/nama/jenis sumber absensi, lokasi, hash API key, status, dan waktu terlihat terakhir. |
| `attendance_events` | Event masuk/keluar/istirahat, waktu kejadian, sumber, koordinat, akurasi, foto, token idempotensi, waktu diterima, dan metadata. |
| `attendance_daily_summaries` | Rekap tanggal kerja, check-in/out pertama/terakhir, menit kerja, terlambat, pulang awal, lembur, dan status. |
| `leave_types` | Kategori cuti/izin/sakit, satuan hari/jam, kewajiban lampiran, aturan lampiran, kebutuhan saldo, dan kuota default. |
| `leave_balances` | Saldo awal, perolehan, pemakaian, penyesuaian per pegawai/jenis/tahun. Saldo tersedia = awal + perolehan + penyesuaian − pemakaian. |
| `leave_requests` | Nomor permohonan, pegawai, jenis, rentang, jumlah unit, alasan, status, waktu submit/keputusan. |
| `leave_request_attachments` | Hubungan permohonan dengan dokumen seperti surat dokter. |
| `leave_approvals` | Urutan approver, keputusan, waktu keputusan, dan catatan. |
| `audit_logs` | Pelaku, tenant, aksi, jenis/ID entitas, data sebelum/sesudah, IP, user-agent, dan waktu. |
| `integration_outbox` | Jenis event, aggregate, payload, waktu publish, jumlah percobaan, dan error untuk integrasi andal. |

Kolom `created_at`, `updated_at`, `created_by`, `status`, `start/end`, dan foreign key mengikuti arti standar pada Bagian 5. Constraint lengkap, tipe data, nilai yang diizinkan, index, view, dan seed awal terdapat di file SQL pendamping.
