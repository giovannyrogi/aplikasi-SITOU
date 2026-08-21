# Database Schema SITOU

Dokumen ini adalah peta cepat database SITOU. Gunakan dokumen ini sebelum membuka `sitou_schema_v3.sql`; buka SQL hanya saat perlu detail constraint, index, fungsi partisi, definisi view, atau membuat migration.

## Prinsip Umum

- `organization_id` adalah batas organisasi utama pada semua tabel bisnis.
- Histori pegawai tidak ditimpa: kontrak ada di `employment_contracts`, penempatan/rolling ada di `employee_assignments`, dan event absensi mentah ada di `attendance_events`.
- File privat tidak pernah dikirim sebagai `object_key` langsung ke browser. Metadata file ada di `stored_files`.
- Event absensi mentah append-only. Rekap cepat dashboard ada di `attendance_daily_summaries` dan boleh dihitung ulang.
- Role stabil di tabel `roles.code`: `superadmin`, `hrd`, `leader`, dan `employee`.

## Organisasi, File, Branding, Struktur

### Alur onboarding dan masa akses

1. Superadmin membuat identitas `organizations` dan periode pertama `organization_subscriptions` dalam satu transaksi.
2. Superadmin membuat minimal satu `locations` yang aktif dan berada dalam umur operasional.
3. Superadmin membuat akun `users`, memasang role `hrd`, lalu menetapkan cakupan lokasi.
4. Organisasi siap digunakan ketika status administratif aktif, memiliki langganan efektif `active`/`grace`, lokasi operasional, dan Admin/HRD aktif.

`organizations.is_active=false` adalah penghentian administratif manual. Status langganan efektif dihitung dengan timezone organisasi: `scheduled`, `active`, `grace`, atau `expired`; status manual `suspended` dan `cancelled` selalu mengalahkan tanggal. Job menyelaraskan status tersimpan, tetapi login dan validasi session tetap memeriksa tanggal. Perpanjangan selalu menambah baris baru dan periode non-suspended/non-cancelled tidak boleh tumpang tindih.

Superadmin dapat menonaktifkan lokasi tanpa menghapus `user_location_scopes`, profil pegawai, atau histori `employee_assignments`. Login Admin/HRD tidak bergantung pada lokasi scope; Admin/HRD tetap dapat masuk selama akun, role, organisasi, dan langganan efektif masih aktif. Lokasi scope hanya membatasi data yang dapat dikelola. Pimpinan yang memiliki scope wajib masih memiliki sedikitnya satu lokasi efektif. Karyawan tidak memakai `user_location_scopes` sebagai sumber penempatan: aksesnya mengikuti profil `employees` dan penempatan utama aktif pada `employee_assignments`.

### Matriks validasi login dan session

Validasi berikut dijalankan saat login dan diulang ketika session dipakai pada server:

| Kondisi                                                                                                          | Superadmin | Admin/HRD             | Pimpinan | Karyawan | Kode penolakan login                                             |
| ---------------------------------------------------------------------------------------------------------------- | ---------- | --------------------- | -------- | -------- | ---------------------------------------------------------------- |
| `users.is_active=false`                                                                                          | Ditolak    | Ditolak               | Ditolak  | Ditolak  | `ACCOUNT_INACTIVE`                                               |
| Role belum mulai atau sudah berakhir                                                                             | Ditolak    | Ditolak               | Ditolak  | Ditolak  | `ROLE_INACTIVE`                                                  |
| `organizations.is_active=false`                                                                                  | N/A        | Ditolak               | Ditolak  | Ditolak  | `ORGANIZATION_INACTIVE`                                          |
| Langganan tidak efektif (`scheduled`, `expired`, `suspended`, `cancelled`, atau tidak ada)                       | N/A        | Ditolak               | Ditolak  | Ditolak  | Kode `ORGANIZATION_*`/`SUBSCRIPTION_*`                           |
| Seluruh `user_location_scopes` Pimpinan tidak aktif atau di luar periode operasional                             | N/A        | Tidak memblokir login | Ditolak  | N/A      | `LOCATION_SCOPE_INACTIVE`                                        |
| Profil karyawan tidak tersedia, soft-deleted, atau `employment_status` bukan `active`, `probation`, atau `leave` | N/A        | N/A                   | N/A      | Ditolak  | `EMPLOYEE_PROFILE_INACTIVE`/`EMPLOYEE_STATUS_INACTIVE`           |
| Tidak ada penempatan utama yang efektif pada tanggal berjalan                                                    | N/A        | N/A                   | N/A      | Ditolak  | `EMPLOYEE_ASSIGNMENT_INACTIVE`                                   |
| Lokasi penempatan `is_active=false` atau di luar `operational_from`/`operational_until`                          | N/A        | N/A                   | N/A      | Ditolak  | `EMPLOYEE_LOCATION_INACTIVE`/`EMPLOYEE_LOCATION_NOT_OPERATIONAL` |
| Divisi/unit penempatan `organization_units.is_active=false`                                                      | N/A        | N/A                   | N/A      | Ditolak  | `EMPLOYEE_UNIT_INACTIVE`                                         |

Pesan penolakan tidak membocorkan SQL atau data internal. Akun, profil, penempatan, lokasi, atau divisi yang tidak aktif mengarahkan pengguna ke Admin organisasi. Organisasi atau masa berlaku yang tidak aktif mengarahkan pengguna ke Admin SITOU.

| Tabel                         | Fungsi                                     | Kolom Kunci                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organizations`               | Identitas organisasi.                      | `id`, `parent_id`, `code`, `name`, `legal_name`, `organization_type`, `timezone`, `locale`, `is_active`, `settings`, audit waktu.                                              |
| `organization_subscriptions`  | Histori periode akses dan masa tenggang.   | `organization_id`, `starts_on`, `ends_on`, `grace_ends_on`, `status`, `notes`, `created_by_user_id`, `request_id`.                                                             |
| `stored_files`                | Metadata file privat.                      | `organization_id`, `storage_provider`, `object_key`, `original_name`, `mime_type`, `size_bytes`, `sha256`, `category`, `is_confidential`, `uploaded_by_user_id`, `deleted_at`. |
| `organization_branding`       | Logo dan warna organisasi.                 | `organization_id`, `logo_file_id`, `primary_color`, `secondary_color`, `updated_at`.                                                                                           |
| `locations`                   | Kantor pusat, cabang, pasar, site, gudang. | `organization_id`, `parent_location_id`, `code`, `name`, `location_type`, koordinat, `logo_file_id`, `operational_from`, `operational_until`, `is_active`.                     |
| `organization_units`          | Direktorat/divisi/departemen/unit/tim.     | `organization_id`, `parent_unit_id`, `code`, `name`, `unit_type`, `is_active`.                                                                                                 |
| `organization_unit_locations` | Relasi many-to-many unit dan lokasi.       | `organization_id`, `organization_unit_id`, `location_id`, `is_primary`, `active_from`, `active_until`.                                                                         |
| `positions`                   | Master jabatan.                            | `organization_id`, `code`, `name`, `grade`, `level_no`, `is_managerial`, `is_active`.                                                                                          |

## User, Role, Permission

| Tabel                     | Fungsi                                                                    | Kolom Kunci                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `users`                   | Akun login global.                                                        | `email`, `username`, `password_hash`, `full_name`, `phone`, `is_active`, `email_verified_at`, `last_login_at`, `last_login_ip`. |
| `roles`                   | Role dasar platform/organisasi/self.                                      | `code`, `name`, `scope`, `description`, `is_system`.                                                                            |
| `permissions`             | Hak granular backend.                                                     | `code`, `description`.                                                                                                          |
| `role_permissions`        | Mapping role ke permission.                                               | `role_id`, `permission_id`.                                                                                                     |
| `user_organization_roles` | Role user per organisasi atau platform.                                   | `user_id`, `organization_id`, `role_id`, `active_from`, `active_until`, `created_by_user_id`.                                   |
| `user_location_scopes`    | Batas data lokasi untuk Admin/Pimpinan; bukan sumber penempatan karyawan. | `user_organization_role_id`, `organization_id`, `location_id`.                                                                  |

## Pegawai dan Profil

| Tabel                         | Fungsi                                                                  | Kolom Kunci                                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `employees`                   | Profil inti pegawai dan penghubung akun self-service melalui `user_id`. | `organization_id`, `employee_no`, `user_id`, `full_name`, `preferred_name`, `national_id`, data lahir, `gender`, `religion`, `marital_status`, `employment_status`, `joined_date`, `termination_date`, `profile_photo_file_id`, `deleted_at`. |
| `employee_contacts`           | Kontak dan alamat pegawai.                                              | `employee_id`, email pribadi/kerja, `phone`, `whatsapp`, alamat KTP/domisili, wilayah, `postal_code`.                                                                                                                                         |
| `employee_identifiers`        | BPJS, NPWP, paspor, identitas lain.                                     | `employee_id`, `identifier_type`, `identifier_value`, `issued_at`, `expires_at`, `is_verified`.                                                                                                                                               |
| `employee_bank_accounts`      | Rekening pegawai sensitif.                                              | `employee_id`, `bank_name`, `account_number`, `account_holder`, `is_primary`, `verified_at`.                                                                                                                                                  |
| `employee_dependents`         | Tanggungan/keluarga.                                                    | `employee_id`, `relationship`, `full_name`, `birth_date`, `national_id`, `phone`, `is_dependent`, `is_emergency_contact`.                                                                                                                     |
| `employee_emergency_contacts` | Kontak darurat.                                                         | `employee_id`, `full_name`, `relationship`, `phone`, `address`, `is_primary`.                                                                                                                                                                 |
| `employee_social_accounts`    | Akun sosial bila diperlukan.                                            | `employee_id`, `platform`, `handle_or_url`.                                                                                                                                                                                                   |
| `employee_educations`         | Riwayat pendidikan.                                                     | `employee_id`, `education_level`, `institution`, `field_of_study`, `graduation_year`, `is_highest`, `certificate_file_id`.                                                                                                                    |
| `employee_skills`             | Keahlian pegawai.                                                       | `employee_id`, `skill_name`, `proficiency_level`, `notes`.                                                                                                                                                                                    |
| `employee_certifications`     | Sertifikasi profesional.                                                | `employee_id`, `certification_name`, `issuer`, `credential_no`, `issued_at`, `expires_at`, `certificate_file_id`.                                                                                                                             |
| `employee_documents`          | Dokumen privat pegawai.                                                 | `employee_id`, `document_type`, `file_id`, `issued_at`, `expires_at`, `verified_at`, `verified_by_user_id`.                                                                                                                                   |

## Kontrak dan Penempatan

| Tabel                  | Fungsi                                                                     | Kolom Kunci                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `employment_types`     | Jenis hubungan kerja per organisasi.                                       | `organization_id`, `code`, `name`, `requires_end_date`, `is_active`.                                                                                                                                   |
| `employment_contracts` | Histori kontrak pegawai.                                                   | `employee_id`, `employment_type_id`, `contract_no`, `start_date`, `end_date`, `status`, `document_file_id`, `notes`.                                                                                   |
| `employee_assignments` | Histori dan sumber penempatan aktif karyawan untuk validasi lokasi/divisi. | `employee_id`, `location_id`, `organization_unit_id`, `position_id`, `supervisor_employee_id`, `assignment_type`, `change_type`, `effective_from`, `effective_until`, `decree_no`, `document_file_id`. |

## Shift, Jadwal, dan Absensi

| Tabel                          | Fungsi                                          | Kolom Kunci                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `work_shifts`                  | Master shift fixed/flexible/field/off.          | `shift_type`, `start_time`, `end_time`, window clock-in, `required_work_minutes`, `break_minutes`, `crosses_midnight`, toleransi terlambat/pulang awal, lembur kandidat.            |
| `shift_patterns`               | Pola mingguan/rotasi.                           | `code`, `name`, `cycle_days`, `is_active`.                                                                                                                                          |
| `shift_pattern_days`           | Isi harian pola shift.                          | `shift_pattern_id`, `day_no`, `shift_id`.                                                                                                                                           |
| `shift_assignments`            | Aturan pola untuk pegawai/unit/lokasi.          | target pegawai/unit/lokasi, `shift_pattern_id`, `effective_from`, `effective_until`, `priority`, `created_by_user_id`.                                                              |
| `employee_daily_schedules`     | Snapshot jadwal harian.                         | `employee_id`, `work_date`, `shift_id`, `location_id`, `scheduled_start_at`, `scheduled_end_at`, `status`, `is_override`, `override_reason`.                                        |
| `attendance_points`            | Titik/geofence absensi.                         | `location_id`, `code`, `name`, `latitude`, `longitude`, `radius_m`, `max_accuracy_m`, flags foto/liveness/background, masa aktif.                                                   |
| `attendance_point_assignments` | Aturan titik absensi untuk pegawai/unit/lokasi. | `attendance_point_id`, target pegawai/unit/lokasi, `effective_from`, `effective_until`.                                                                                             |
| `attendance_devices`           | Registry perangkat/sumber absensi.              | `device_code`, `name`, `device_type`, `location_id`, `api_key_hash`, `is_active`, `last_seen_at`.                                                                                   |
| `attendance_import_batches`    | Header import Excel/CSV.                        | `source_file_id`, `status`, hitungan baris, `uploaded_by_user_id`, `committed_at`, `error_summary`.                                                                                 |
| `attendance_import_rows`       | Staging baris import.                           | `batch_id`, `row_no`, `employee_no`, `employee_id`, `occurred_at`, `event_type`, `raw_data`, `validation_status`, `validation_errors`.                                              |
| `attendance_event_receipts`    | Idempotensi mobile/web.                         | `client_event_id`, `employee_id`, `event_date`, `received_at`, `processing_status`, `rejection_code`.                                                                               |
| `attendance_events`            | Event absensi mentah partisi bulanan.           | `event_date`, `employee_id`, `receipt_id`, `daily_schedule_id`, `attendance_point_id`, `device_id`, `event_type`, `occurred_at`, `source`, koordinat, validasi, foto, offline flag. |
| `attendance_daily_summaries`   | Rekap cepat dashboard.                          | `employee_id`, `work_date`, clock-in/out pertama/akhir, menit kerja/terlambat/pulang awal/lembur, `attendance_status`, versi kalkulasi, override HRD.                               |

## Cuti, Izin, dan Disiplin

| Tabel                       | Fungsi                              | Kolom Kunci                                                                                                                                                                    |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `leave_types`               | Master cuti/izin.                   | `code`, `name`, `category`, `unit`, `requires_attachment`, `required_attachment_category`, `uses_balance`, `annual_allowance`, `is_active`.                                    |
| `leave_requests`            | Pengajuan/input HRD cuti/izin.      | `request_no`, `employee_id`, `leave_type_id`, `start_at`, `end_at`, `requested_units`, `reason`, `submission_source`, `status`, `submitted_at`.                                |
| `leave_request_attachments` | Lampiran izin/cuti.                 | `leave_request_id`, `file_id`, `attachment_category`, `uploaded_at`.                                                                                                           |
| `leave_decisions`           | Keputusan final HRD.                | `leave_request_id`, `decision`, `decided_by_user_id`, `decision_role`, `notes`, `decided_at`.                                                                                  |
| `discipline_rules`          | Aturan pembentuk indikator.         | `code`, `name`, `severity`, `metric_type`, `threshold_value`, `window_days`, `legal_reference`, `recommended_action`, `is_active`.                                             |
| `discipline_indicators`     | Sinyal otomatis untuk ditinjau HRD. | `employee_id`, `rule_id`, periode, `measured_value`, `status`, `evidence`, `reviewed_by_user_id`, `reviewed_at`.                                                               |
| `discipline_cases`          | Pemeriksaan kasus oleh HRD.         | `case_no`, `employee_id`, `indicator_id`, `severity`, `incident_date`, `description`, `employee_explanation`, `status`, `opened_by_user_id`, `closed_at`.                      |
| `disciplinary_actions`      | Tindakan/sanksi resmi.              | `discipline_case_id`, `employee_id`, `action_type`, `letter_no`, tanggal berlaku, `status`, `direct_escalation`, `escalation_reason`, `document_file_id`, `issued_by_user_id`. |

## Audit, Outbox, dan View

| Objek                          | Fungsi                                            | Kolom Kunci                                                                                                                                            |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `audit_logs`                   | Audit append-only.                                | `organization_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, data sebelum/sesudah tersaring, IP, user agent, `request_id`, `occurred_at`. |
| `integration_outbox`           | Transactional outbox.                             | `organization_id`, `event_type`, `aggregate_type`, `aggregate_id`, `payload`, `published_at`, `attempts`, `next_attempt_at`, `last_error`.             |
| `v_employee_current_profile`   | View profil dan penempatan aktif untuk dashboard. | Baca profil pegawai aktif dari `employees` + `employee_assignments` aktif.                                                                             |
| `v_employee_attention_summary` | View ringkasan perhatian 30 hari.                 | Ringkasan absensi/indikator untuk HRD dan pimpinan tanpa membuka bukti sensitif.                                                                       |

## Kapan Membuka SQL

- Membuat migration baru atau memvalidasi constraint/FK/index.
- Mengecek enum `CHECK` secara persis.
- Mengecek definisi partition `attendance_events`.
- Mengecek definisi view atau fungsi PostgreSQL.
- Menjalankan query plan atau debugging database sungguhan.
