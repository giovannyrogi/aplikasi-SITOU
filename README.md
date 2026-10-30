# SITOU

SITOU (Sistem Informasi Teknologi dan Organisasi Unit) adalah dashboard HRIS multi-organisasi untuk mengelola organisasi, lokasi, akun Admin/HRD, pegawai, penempatan, kontrak, absensi, izin, dokumen, dan disiplin secara terisolasi per organisasi.

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

Untuk deployment di balik reverse proxy, isi `APP_ORIGIN=https://sitou.pasarmanado.id`
dan pastikan proxy menimpa `X-Forwarded-Proto` serta `X-Forwarded-Host` dengan nilai
publik yang benar. Validasi origin upload tetap aktif, tetapi kini memahami origin publik
yang diteruskan proxy sehingga request tidak dibandingkan dengan alamat internal aplikasi.

## Masa akses organisasi

Identitas organisasi disimpan pada `organizations`. Semua histori masa akses berada pada `organization_subscriptions`; onboarding membuat periode pertama dan perpanjangan selalu menambah periode baru. Lokasi memakai `operational_from` dan `operational_until` untuk umur operasional, bukan untuk masa berlangganan SITOU.

Urutan upgrade database lama:

1. Terapkan `20260821_002_expand_organization_subscriptions.sql`.
2. Deploy aplikasi yang sudah membaca schema baru dan verifikasi backfill.
3. Terapkan `20260821_003_contract_subscription_columns.sql` untuk menghapus kolom legacy.

Baca `AGENTS.md` untuk aturan pengembangan dan `docs/database-schema.md` untuk peta database.

## Identitas akun

`users` hanya menyimpan kredensial dan metadata keamanan. Nama serta kontak akun organisasi dibaca langsung dari profil pegawai; Superadmin memakai `platform_user_profiles`, sedangkan akun HRD/Pimpinan yang belum tertaut ditampilkan menggunakan username. Menu Pengaturan menyediakan Profil dan Keluar tanpa menampilkan identitas pada pop-up.

## Deployment production

Ikuti [panduan hardening dan rollout production](docs/production-hardening.md) untuk migration 032, ClamAV, pemindaian file lama, worker purge, Nginx, dan smoke test sebelum membuka kembali aplikasi.

## Backend SITOU Mobile

Beranda Flutter memakai API baca bearer `/api/mobile/home` dan `/api/mobile/profile-photo`; lihat [kontrak beranda mobile](docs/mobile-home.md). Deploy kode backend sebelum APK homepage, tanpa migration baru; login/web tetap memakai kontrak existing. Data shift/absensi/ringkasan/pengumuman contoh Flutter bukan hasil database dan belum siap operasional produksi. Penerapan VPS tetap tindakan terpisah.

API login native tersedia pada `/api/auth/mobile/login`, `/me`, `/logout`; [kontrak, kebijakan dan operasional](docs/mobile-auth.md). Login web tetap memakai cookie dan perilaku existing. Sebelum mengaktifkan backend versi ini pada database existing, terapkan migration `20261027_065_mobile_auth_sessions.sql` setelah migration sebelumnya; jangan menjalankan bootstrap pada database berisi data. Jalankan `npm run db:check` dan `npm run db:verify-bootstrap` sebelum restart.

Pemeliharaan harian sesi: `npm run auth:mobile-sessions:prune`, pilih konfigurasi dengan `ENV_FILE` sesuai environment. Flutter development mengakses Next.js lokal port 3000 melalui `adb reverse`; rilis memakai host HTTPS VPS. Tidak ada deployment VPS/migration produksi otomatis dalam integrasi lokal ini. Cadangkan database, verifikasi staging dan review prosedur rollback sebelum rollout; tabel baru bersifat aditif dan cookie/web tidak diganti.

Durasi sesi mobile ditentukan backend melalui `AUTH_MOBILE_SESSION_TTL_MINUTES=10080` (tujuh hari), wajib integer 1–10080. Atur di environment development dan, saat rollout, production sebelum restart. Nilai hilang/invalid menolak login mobile; tidak memakai fallback atau TTL web. Hanya sesi baru mengikuti nilai baru. Tidak perlu migration/ubah Flutter untuk TTL dalam batas tersebut. Detail: `docs/mobile-auth.md`.

## Jadwal kerja

Data Master → Jadwal Kerja menyediakan dropdown **Jam kerja tetap** atau **Kerja shift** di samping Nama jadwal pada desktop dan bertumpuk pada ponsel. Daftar memakai filter jenis dalam dropdown, dengan penjelasan singkat. Pilihan shift dapat dilipat tanpa kehilangan isian. Jam tetap memakai hari mingguan, jam utama dan perubahan per hari. Kerja shift menyediakan Tambah shift dengan nama/jam bebas, validasi benturan termasuk shift malam, serta satu pilihan shift per Pegawai. Hari yang tidak dipilih adalah Libur. Simpan jadwal membuka ringkasan sebelum konfirmasi. Kepegawaian → Jadwal Pegawai menyediakan penetapan individu/massal dan kalender otomatis. Pendaftaran memakai langkah 4 Penempatan atau Atur jadwal nanti. Data Pegawai dapat disaring berdasarkan Status perkawinan yang sama dengan pendaftaran, termasuk saat ekspor, tanpa migration tambahan. Jadwal lama tetap terbaca tanpa dikonversi. [Panduan, kontrak dan operasional](docs/work-schedules.md).

Environment existing yang sudah menerapkan 066 perlu **migration 067**, lalu **068** untuk katalog Fitur Absensi sebelum backend/dashboard baru. Jika 067 sudah tersedia, jalankan hanya 068. Jangan ulang 063–066 atau memakai bootstrap untuk upgrade database berjalan. Migration 067 menambah kelompok dan relasi pilihan shift, tanpa mengubah penetapan lama. Jalankan pemeriksaan upgrade/bootstrap dan hak HRIS baca/kelola. Tidak memberi grant otomatis. Kamera/absensi mobile, kerja tambahan serta penggantian waktu belum diintegrasikan. Tidak ada deployment atau restart VPS otomatis.

Kalender Libur dan Jadwal Pegawai mengikuti alur pada [panduan jadwal kerja](docs/work-schedules.md). Status kalender berada di bawah form. Penetapan jadwal tersedia pada header halaman, dengan pilihan Pegawai per halaman serta avatar privat. Perubahan tampilan ini tidak memerlukan migration atau perubahan aplikasi mobile.

Dialog Jadwal Pegawai memakai penetapan tanpa tanggal berakhir, perubahan satu tanggal melalui Ubah jadwal harian, dan kartu riwayat berlabel. Riwayat periode lama dan kontrak API tetap kompatibel. Lihat docs/work-schedules.md.

## Fitur Absensi per organisasi

Superadmin membuka **Organisasi → Fitur organisasi**, mengaktifkan **Fitur Absensi**, lalu menyimpan. Modul mencakup Jadwal Kerja, Kalender Libur dan Jadwal Pegawai. HRD tetap memerlukan izin menu yang sesuai. Tanpa aktivasi, termasuk pada organisasi lama, menu/API jadwal tertutup meskipun akun adalah Admin HRD penuh. Penonaktifan menyimpan data dan grant untuk pengaktifan kembali. Cuti/izin serta login tetap terpisah.

Sesudah struktur 067 tersedia, jalankan **migration 068** katalog attendance sebelum rollout kode ini pada environment existing. Jangan ulang 063–067. Jalankan pemeriksaan database/bootstrap dan aktivasi organisasi secara eksplisit oleh Superadmin. Tidak ada auto-aktivasi, deployment atau restart VPS. [Kontrak API, alur dan batas integrasi mobile](docs/work-schedules.md#aktivasi-fitur-absensi-oleh-superadmin).

Daftar Organisasi menampilkan kode, nama, lokasi aktif, akun HRD, akhir masa akses, serta status akses dan tiap fitur secara terpisah. Organisasi dan Jadwal Kerja berada dalam satu kelompok Kepegawaian pada Data Master. Pengelompokan ini tidak mengubah izin Organisasi yang tetap khusus Superadmin. Perapian tampilan ini tidak membutuhkan migration atau perubahan aplikasi mobile.
