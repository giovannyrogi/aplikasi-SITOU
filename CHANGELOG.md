# Catatan perubahan SITOU

## 2026-10-28 — Fondasi jadwal fleksibel

Dashboard menyediakan master Shift & Pola Kerja, Kalender Libur dan Jadwal Kerja, jadwal awal opsional pada langkah 4 Penempatan, jadwal khusus dan snapshot beberapa sesi per hari. Tidak memakai field Kode pada master baru ini. Kerja tambahan/penggantian waktu dan absensi mobile belum diintegrasikan. Tidak mengubah kontrak login web/mobile atau mengirim data nyata ke QA. Panduan lengkap: docs/work-schedules.md.

| File | Status | Tujuan |
| --- | --- | --- |
| `CHANGELOG.md` | Ditambah | Catat fitur, setiap file/tujuan, risiko, hasil verifikasi dan status penerapan. |
| `AGENTS.md` | Diubah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `README.md` | Diubah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `app/components/README.md` | Diubah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `app/components/employees/EmployeeDetail.jsx` | Diubah | Tab Jadwal kerja sesudah Penempatan dengan hak tersendiri; URL tab dan histori browser. |
| `app/components/employees/EmployeeForm.jsx` | Diubah | Jadwal kerja awal opsional pada langkah 4 dan serialisasi draft. |
| `app/components/icons/localIconData.mjs` | Diubah | Sumber dan bundle ikon lokal untuk tiga menu jadwal. |
| `app/components/icons/navigationIconSources.mjs` | Diubah | Sumber dan bundle ikon lokal untuk tiga menu jadwal. |
| `database/migrations/README.md` | Diubah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `docs/database-schema.md` | Diubah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `docs/employee-onboarding.md` | Diubah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `docs/hris-access-design.md` | Diubah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `lib/access/accessDescriptions.mjs` | Diubah | Katalog, uraian dan pemetaan izin tiga menu HRIS; tanpa grant delegasi otomatis. |
| `lib/access/hrisPolicy.mjs` | Diubah | Katalog, uraian dan pemetaan izin tiga menu HRIS; tanpa grant delegasi otomatis. |
| `lib/access/menuCatalog.mjs` | Diubah | Katalog, uraian dan pemetaan izin tiga menu HRIS; tanpa grant delegasi otomatis. |
| `lib/employees/schemas.js` | Diubah | Kontrak draft/pendaftaran menerima workSchedule opsional, payload lama tetap valid. |
| `lib/employees/service.js` | Diubah | Profil dan jadwal awal atomik; urutan lock sebelum guard existing mencegah deadlock. |
| `scripts/verify-schema-bootstrap.mjs` | Diubah | Perluas pemeriksaan ekuivalensi kolom, constraint dan index tabel jadwal. |
| `sitou_schema_v3.sql` | Diubah | Migration 066 dan bootstrap final: tanpa kode shift/pola, revisi/kalender/sesi/exception/version/idempotency. |
| `".qa-schedule-build-source/node_modules/react-date-range/. eslintignore"` | Ditambah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `app/(protected)/master-data/work-shifts/page.jsx` | Ditambah | Halaman dashboard untuk menu baru yang terdaftar pada katalog izin. |
| `app/(protected)/organization-settings/work-calendars/page.jsx` | Ditambah | Halaman dashboard untuk menu baru yang terdaftar pada katalog izin. |
| `app/(protected)/work-schedules/page.jsx` | Ditambah | Halaman dashboard untuk menu baru yang terdaftar pada katalog izin. |
| `app/api/shift-patterns/options/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/shift-patterns/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-calendars/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-schedules/cancel/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-schedules/exceptions/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-schedules/generate/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-schedules/options/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-schedules/preview/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-schedules/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/api/work-shifts/route.js` | Ditambah | Route tipis API jadwal dengan guard sesi, izin, validasi, envelope dan layanan bersama. |
| `app/components/work-schedules/MasterEditor.jsx` | Ditambah | Editor shift, pola mingguan/rotasi dan kalender tanpa field Kode. |
| `app/components/work-schedules/ScheduleFields.jsx` | Ditambah | Field jadwal dipakai ulang onboarding/penetapan, transport dan pencarian referensi terbatasi. |
| `app/components/work-schedules/WorkMasterPage.jsx` | Ditambah | Daftar/filter/form/histori master memakai komponen operasional bersama. |
| `app/components/work-schedules/WorkSchedulePage.jsx` | Ditambah | Penetapan, konfirmasi, jadwal khusus, histori, preview dan generator pada menu/detail Pegawai. |
| `database/migrations/20261028_066_work_schedule_foundation.sql` | Ditambah | Migration 066 dan bootstrap final: tanpa kode shift/pola, revisi/kalender/sesi/exception/version/idempotency. |
| `docs/work-schedules.md` | Ditambah | Sinkronkan aturan, alur, peta database, katalog atau panduan rollout sesuai fitur jadwal. |
| `lib/work-schedules/http.js` | Ditambah | Adapter request/response, origin/rate-limit dan pemetaan kegagalan aman. |
| `lib/work-schedules/repository.js` | Ditambah | Query organisasi, scope Pegawai, hak terkini dan sumber aturan. |
| `lib/work-schedules/rules.mjs` | Ditambah | Aturan waktu murni, timezone, durasi, siklus dan overlap. |
| `lib/work-schedules/schemas.mjs` | Ditambah | Schema strict payload, batas ukuran/jumlah dan pesan validasi. |
| `lib/work-schedules/service.js` | Ditambah | Transaksi master/penetapan/exception/generator, revisi/snapshot/idempotency/audit. |

Risiko utama: akses lintas organisasi/lokasi, perubahan histori, overlap lintas tengah malam, request ulang/paralel dan profil parsial. Kontrol di lib/work-schedules serta transaksi onboarding: hak HRIS terkini, query berparameter/scoped dan FK komposit; Zod strict, origin/rate limit/batas JSON, locking/version, exclusion, idempotency/audit; snapshot terpakai dipertahankan. Pengujian sintetis meliputi penolakan role/grant/scope/ID lain, nama duplikat/nonaktif, stale version, rollback batch/profil, request paralel, revisi/kalender/shift malam/rotasi/fleksibel dan durasi 45/120/195 menit. Upload, GPS, kamera, secure storage dan payroll tidak berlaku pada fondasi dashboard ini; kontrol absensi tetap tahap berikutnya.

Verifikasi aktual: 71 pemeriksaan layanan/database lulus, 15 pemeriksaan upgrade berisi data lama vs bootstrap kosong lulus (12 tabel ekuivalen kolom/constraint/index). Pemeriksaan bootstrap terhadap development lokal lulus. 29 pemeriksaan HTTP/UI lulus, termasuk login/logout web, CSRF origin, tanpa sesi, JSON rusak, hak baca menolak mutation, CRUD melalui form, penetapan/konfirmasi/generator/exception serta render tiga halaman pada 320/375/768/1024/1366 tanpa overflow. Render 375 diperiksa visual; komponen form/toolbar diselaraskan dengan padding DataPanel. Build production akhir Next.js --webpack lulus pada salinan QA terpisah; 123 halaman berhasil dibentuk. Lint source, pemeriksaan format kode baru, git diff --check dan icons:check lulus. Setelah perapian padding, 23 pemeriksaan ulang HTTP/render lulus dan render 375 diperiksa visual. Uji inline pesan schema Bahasa Indonesia/field tambahan lulus. Warning build tentang dua lockfile hanya berasal dari salinan QA; tidak mengubah konfigurasi root atau NODE_ENV aplikasi.

Migration 066 diterapkan hanya pada database development lokal. VPS belum diubah/deploy/restart. Rollout wajib backup/staging, cek dependency code eksternal serta data duplikat/bentrok, migration, kode dan pemberian grant HRIS sesuai docs/work-schedules.md. Tidak mengulang migration pada schema yang sudah diperbarui. Pengujian ini bukan audit penetrasi menyeluruh atau uji beban produksi; browser/perangkat lain belum seluruhnya diperiksa.

Artefak QA sementara yang telah dibersihkan setelah pengujian dan verifikasi path absolut: scripts/schedule-qa-loader-temporary.mjs, scripts/work-schedule-qa-temporary.mjs, scripts/work-schedule-upgrade-qa-temporary.mjs, scripts/work-schedule-ui-qa-temporary.mjs, .qa-schedule-build-source/ (termasuk junction dependency, cache/build dan AGENTS hasil Next), .qa-schedule-images/ (tiga screenshot). Database QA upgrade/fresh/service/UI dibuat dengan prefix sitou_schedule_* dan dihapus dalam finally setiap pengujian; server QA port 3101 dihentikan. Tidak menghapus suite/file existing atau server port 3000.

Pembersihan akhir: seluruh empat script sementara, tiga screenshot dan folder QA beserta junction/build/cache sudah dihapus. Suite existing, node_modules asli dan server development port 3000 dipertahankan. Tidak ada data QA yang disimpan pada database development nyata. Flutter/mobile tidak dibangun karena tidak ada perubahan Dart/platform.
