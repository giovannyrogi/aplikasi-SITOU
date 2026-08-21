# SITOU

SITOU (Sistem Informasi Tenaga Operasional Unit) adalah dashboard HRIS multi-perusahaan untuk mengelola organisasi, lokasi, akun Admin/HRD, pegawai, penempatan, kontrak, absensi, izin, dokumen, dan disiplin secara terisolasi per tenant.

## Teknologi

- Next.js App Router dan React
- PostgreSQL 18
- MUI dan Ant Design
- Zod untuk validasi
- bcryptjs untuk password

## Menjalankan development

1. Salin konfigurasi database dan session ke `.env.development`.
2. Jalankan schema atau migration yang belum diterapkan.
3. Seed akun Superadmin dengan `npm run seed:superadmin`.
4. Jalankan aplikasi dengan `npm run dev`.

Perintah pemeriksaan utama:

```bash
npm run lint
npm run build
npm run subscriptions:reconcile
```

## Masa akses organisasi

Identitas tenant disimpan pada `organizations`. Semua histori masa akses berada pada `organization_subscriptions`; onboarding membuat periode pertama dan perpanjangan selalu menambah periode baru. Lokasi memakai `operational_from` dan `operational_until` untuk umur operasional, bukan untuk masa berlangganan SITOU.

Urutan upgrade database lama:

1. Terapkan `20260821_002_expand_organization_subscriptions.sql`.
2. Deploy aplikasi yang sudah membaca schema baru dan verifikasi backfill.
3. Terapkan `20260821_003_contract_subscription_columns.sql` untuk menghapus kolom legacy.

Baca `AGENTS.md` untuk aturan pengembangan dan `docs/database-schema.md` untuk peta database.
