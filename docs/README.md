# Peta dokumentasi SITOU

Gunakan tabel ini untuk memilih sumber sesuai tugas, bukan daftar bacaan wajib seluruhnya. Aturan aktif, kontrak, referensi komponen, prosedur operasional dan histori mempunyai peran berbeda. Satu aturan dipelihara di pemiliknya; dokumen lain cukup merujuk. Kode/path teknis dalam dokumen relatif terhadap root repositori kecuali dinyatakan lain.

## Aturan dasar dan mutu

| Kapan dibaca | Sumber pemilik |
| --- | --- |
| Memulai tugas dan menentukan bacaan | [AGENTS](../AGENTS.md) |
| Tujuan/batas produk | [Produk](rules/product.md) |
| Struktur kode/lapisan/larangan domain | [Arsitektur](rules/architecture.md) |
| Schema, query, histori, migration, partisi | [Data](rules/data.md), lalu [peta schema](database-schema.md) untuk tabel yang disentuh |
| Endpoint, validasi, isolasi organisasi, privasi | [API/keamanan](rules/api-security.md) |
| Role, HRIS, fitur, delegasi, izin | [Akses](rules/access.md), [desain HRIS](hris-access-design.md) untuk kontrak implementasi |
| Menentukan uji, menutup pekerjaan, membersihkan QA | [Kualitas](rules/quality.md) |
| Mendesain frontend | [Pedoman UI/UX](ui-ux-guidelines.md), cari section fitur/nama komponen yang relevan |
| Memakai/mengubah API komponen | [Indeks komponen](../app/components/README.md) |
| Menjalankan alur skill UI/UX | [Skill proyek](skills/sitou-ui-ux/SKILL.md) |

## Pegawai, cuti, disiplin dan laporan

| Cakupan | Sumber |
| --- | --- |
| Profil, kontrak, penempatan, lifecycle | [Aturan Pegawai](rules/employees.md), [onboarding](employee-onboarding.md) bila form komposit terdampak |
| Impor Pegawai | [Import](employee-import.md) |
| Cuti/izin dan saldo | [Aturan cuti/izin](rules/leave.md) |
| Rekap dan export cuti | [Laporan saldo/rekap](leave-summary-report.md), [export](leave-export.md) sesuai aksi |
| Indikator, kasus dan sanksi | [Aturan disiplin](rules/discipline.md) |
| Workflow terbit/pulih sanksi | [Penerbitan](disciplinary-issuance.md), [pemulihan](disciplinary-restoration.md) |
| Filter dan presentasi laporan disiplin | [Filter Pegawai](employee-sanction-filter.md), [UI laporan](disciplinary-report-ui.md) |
| Kontrak akan berakhir, pensiun dan query laporan | [Aturan laporan](rules/reports.md), [fondasi query](../lib/reports/README.md) |
| Dashboard HRD/Pegawai/Inventaris | [Aturan dashboard](rules/dashboard.md), [workspace](dashboard-workspace.md), [histori aktivitas](dashboard-activity-history.md), baca hanya bagian terkait |

## Jadwal, kalender dan absensi

| Cakupan | Sumber |
| --- | --- |
| Jadwal tetap/shift, revisi, penetapan, perubahan harian | [Jadwal kerja](work-schedules.md) |
| Katalog, kalender organisasi, penghapusan | [Katalog libur](holiday-catalogs.md) |
| Unggah SKB, parser/worker, setup Windows/VPS | [PDF SKB](holiday-pdf-import.md), hanya section OS/operasi yang diperlukan |
| Impor, event, geofence, rekap dan aturan domain absensi | [Aturan absensi](rules/attendance.md) |
| Filter, indikator, rincian foto, dan Excel Rekap Absensi | [Laporan Rekap Absensi](attendance-summary-report.md) |
| Kontrak self-service, preflight, foto, waktu dan sesi | [API absensi mobile](mobile-attendance.md) |
| Titik, radius, lokasi dan akses tambahan | [Titik absensi](attendance-points.md) |
| Login native/session | [Auth mobile](mobile-auth.md) |
| Beranda native | [Kontrak beranda](mobile-home.md) |

## Inventaris

[Aturan Inventaris](rules/inventory.md) adalah pemilik kebijakan akses dan bisnis. Buka kontrak yang sesuai aksi: [stok dan kartu stok](inventory-stock-design.md), [laporan stok](inventory-stock-report.md), [distribusi](inventory-distribution.md), [stok awal/koreksi](inventory-opening-corrections.md), atau [presentasi mobile](inventory-mobile-ui.md). Jangan membaca semua dokumen untuk perubahan satu label/kontrol.

## Operasional

| Pekerjaan | Prosedur |
| --- | --- |
| File privat/antivirus/storage | [Aturan file](rules/files.md), [pemeliharaan storage](storage-maintenance.md) |
| Backup/restore | [Backup](system-backup.md) |
| Rilis/VPS/hardening | [Produksi](production-hardening.md) |
| Logging, monitoring, health | [Operasional](rules/operations.md) |
| Runner skrip/migration | [Skrip](../scripts/README.md), [migration](../database/migrations/README.md) |
| Mengganti font | [Tipografi](typography.md) |

Panduan operasional menyimpan perintah dan prasyarat, bukan salinan aturan pengembangan. [README proyek](../README.md) adalah pintu masuk menjalankan aplikasi. [CHANGELOG](../CHANGELOG.md) menyimpan kejadian historis, bukan keputusan aktif atau bukti fitur masih memakai perilaku lama. Tidak perlu membacanya untuk setiap tugas.

## Hubungan web dan mobile

Repositori ini memiliki kontrak backend, schema, otorisasi dan aturan lintas organisasi. Checkout Flutter memiliki aturan platform, desain native, widget dan operasional build pada AGENTS.md serta indeksnya sendiri. Cari checkout dari workspace atau set SITOU_WEB_ROOT/SITOU_MOBILE_ROOT pada lingkungan kerja bila perlu. Variabel itu petunjuk dokumentasi, bukan konfigurasi baru aplikasi. Bila checkout pasangan tidak tersedia, gunakan repositori sumber dengan revisi yang cocok dan sebutkan keterbatasannya. Jangan menyalin .env atau rahasia untuk memperoleh aturan.

Keputusan lintas proyek ditulis pada pemiliknya dan dirujuk proyek lain. Jangan memakai path absolut dari komputer pembuat dokumen sebagai kontrak.
