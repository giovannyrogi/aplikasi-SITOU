# SITOU

SITOU (Sistem Informasi Tenaga Operasional Unit) adalah dashboard HRIS multi-organisasi untuk mengelola organisasi, lokasi, akun Admin/HRD, pegawai, penempatan, kontrak, absensi, izin, dokumen, dan disiplin secara terisolasi per organisasi.

## Teknologi

- Next.js App Router dan React
- PostgreSQL 18
- MUI dan Ant Design
- Zod untuk validasi
- bcryptjs untuk password

## Menjalankan development

1. Salin konfigurasi database dan session ke `.env.development`.
2. Untuk database kosong, jalankan `sitou_schema_v3.sql` satu kali. Jangan jalankan migration historis setelah schema final.
3. Untuk database berisi data, jalankan hanya migration yang belum diterapkan secara berurutan.
4. Pastikan database siap dengan `npm run db:check`.
5. Seed akun Superadmin dengan `npm run seed:superadmin`.
6. Jalankan aplikasi dengan `npm run dev`.

Perintah pemeriksaan utama:

```bash
npm run lint
npm run build
npm run db:check
npm run subscriptions:reconcile
```

Pada VPS yang memuat environment dari file production, jalankan preflight dengan
`ENV_FILE=.env.production npm run db:check` sebelum restart aplikasi. Perintah akan
gagal dan menampilkan tabel, kolom, constraint, atau permission yang belum lengkap.
Seed database production yang masih kosong dijalankan dengan
`ENV_FILE=.env.production npm run seed:superadmin`.

## Masa akses organisasi

Identitas organisasi disimpan pada `organizations`. Semua histori masa akses berada pada `organization_subscriptions`; onboarding membuat periode pertama dan perpanjangan selalu menambah periode baru. Lokasi memakai `operational_from` dan `operational_until` untuk umur operasional, bukan untuk masa berlangganan SITOU.

Urutan upgrade database lama:

1. Terapkan `20260821_002_expand_organization_subscriptions.sql`.
2. Deploy aplikasi yang sudah membaca schema baru dan verifikasi backfill.
3. Terapkan `20260821_003_contract_subscription_columns.sql` untuk menghapus kolom legacy.

Baca `AGENTS.md` untuk aturan pengembangan dan `docs/database-schema.md` untuk peta database.

## Identitas akun

`users` hanya menyimpan kredensial dan metadata keamanan. Nama serta kontak akun organisasi dibaca langsung dari profil pegawai; Superadmin memakai `platform_user_profiles`, sedangkan akun HRD/Pimpinan yang belum tertaut ditampilkan menggunakan username. Menu Pengaturan menyediakan Profil dan Keluar tanpa menampilkan identitas pada pop-up.