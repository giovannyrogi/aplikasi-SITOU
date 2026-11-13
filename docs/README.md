# Peta dokumentasi SITOU

Mulai dari [AGENTS.md](../AGENTS.md). Baca bagian yang berhubungan dengan tugas dan gunakan kode, tes, skema akhir, serta migration sebagai acuan implementasi.

## Aturan dasar dan mutu

- [UI/UX Dashboard](ui-ux-guidelines.md#daftar-isi) dan [katalog komponen](../app/components/README.md)
- [Keamanan, akses, dan file privat](rules/api-security.md)
- [Arsitektur, data, dan migration](rules/data.md)
- [QA dan penyelesaian](rules/quality.md)
- [Skill UI/UX SITOU](skills/sitou-ui-ux/SKILL.md)

## Pegawai, cuti, disiplin dan laporan

[Aturan produk dan HRIS](rules/product.md) mencakup Pegawai, onboarding, impor, cuti/izin, disiplin, dashboard, serta laporan.

## Jadwal, kalender dan absensi

[Jadwal, hari libur dan absensi](work-schedules.md) memuat aturan, kontrak server, titik absensi, dan rekap. [Kontrak API Mobile](mobile-api.md) mencakup login, beranda, dan absensi Flutter.

## Inventaris

[Aturan dan kontrak Inventaris](rules/inventory.md) mencakup akses gudang, stok, transaksi, koreksi, serta laporan.

## Operasional

[Skrip dan operasional](../scripts/README.md) memuat prosedur backup, pemulihan, penyimpanan, OCR, dan rilis. Untuk skema akhir buka [SQL bootstrap](../sitou_schema_v3.sql), dan untuk upgrade buka [panduan migration](../database/migrations/README.md).

## Hubungan web dan mobile

Checkout web memiliki kontrak backend, skema, dan otorisasi. Checkout Flutter memiliki aturan platform dan antarmuka native. Temukan checkout pasangan dari workspace atau SITOU_WEB_ROOT/SITOU_MOBILE_ROOT. Saat kontrak bersama berubah, perbarui rujukan terkait di kedua proyek.
