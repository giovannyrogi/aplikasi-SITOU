# Autentikasi SITOU Mobile

## Kontrak lokal — 27 Oktober 2026

Flutter menggunakan backend Next.js dan PostgreSQL SITOU yang sama. Login web, cookie `sitou_session`, validasi origin, pesan dan permission web tetap dipertahankan. Verifikasi bcrypt, dummy hash, bucket kegagalan dan audit login digunakan bersama melalui `lib/auth/credentialService.js` dan `userRepository.js`; kebijakan mobile berada di `lib/auth/mobile/`.

| Metode/path | Request | Hasil |
| --- | --- | --- |
| POST `/api/auth/mobile/login` | JSON `{username,password}` | `data: {token,tokenType:"Bearer",expiresAt,user}` |
| GET `/api/auth/mobile/me` | `Authorization: Bearer <token>` | `data: {user,expiresAt}` |
| POST `/api/auth/mobile/logout` | Bearer sesi yang hendak dicabut | `data: null`; idempotent, token hilang/palsu tetap sukses |

Envelope mengikuti SITOU: `success`, `message`, `code`, `requestId`, `data` pada sukses; error memakai `fieldErrors` bila relevan. Semua respons `Cache-Control: no-store`, tanpa cookie. Timestamp expiry ISO 8601 UTC. Login tidak di-retry otomatis; logout berulang aman. Jangan mengirim token melalui URL, analytics, log atau laporan QA. `/me` mengabaikan ID organisasi/Pegawai yang diberikan klien dan selalu memakai identitas sesi. Endpoint web existing belum menerima bearer mobile.

Login hanya menerima dua field tersebut, JSON maksimum 8 KiB, username 1–100 karakter mengikuti format existing, password tidak dipangkas dan maksimum 72 byte UTF-8 bcrypt. Malformed JSON, tipe/field tambahan dan panjang invalid ditolak 400; Content-Type salah 415; payload terlalu besar 413. Origin browser asing tetap ditolak; request native tanpa Origin diterima sesuai helper existing.

## Pesan dan kelayakan

Username tidak ditemukan: HTTP 401 `USERNAME_NOT_FOUND`, `fieldErrors.username`, “Nama pengguna tidak ditemukan.” Password salah: HTTP 401 `PASSWORD_MISMATCH`, `fieldErrors.password`, “Kata sandi tidak sesuai.” Field kosong: “Isi nama pengguna.” / “Isi kata sandi.” Dummy bcrypt tetap dikerjakan pada username yang tidak ditemukan. Pengungkapan keberadaan username merupakan keputusan produk yang disetujui; pantau log terstruktur `[auth.mobile.rejected]` (code/requestId/IP tanpa username/password/token) serta bucket keamanan. Web tetap memakai pesan kredensial gabungan existing.

Lima kegagalan kredensial per jendela 15 menit memakai bucket existing yang sama pada pasangan sumber/username web dan mobile. Percobaan berikutnya 429 `RATE_LIMITED`, pesan “Terlalu banyak percobaan. Coba lagi nanti.” dan `Retry-After` detik. Tidak menambah kebijakan penguncian akun global.

Setelah password benar, urutan penolakan mobile adalah organisasi/masa akses, profil, status akhir/draft, akun, kemudian membership. Status organisasi didahulukan. Pensiun tetap menghasilkan pesan pensiun meski workflow menonaktifkan akun. Superadmin/platform tanpa profil organisasi berizin tidak diberi akses pribadi.

| Kode HTTP 403 | Pesan |
| --- | --- |
| ORGANIZATION_INACTIVE | Organisasi dinonaktifkan. |
| ORGANIZATION_NOT_STARTED | Masa akses organisasi belum dimulai. |
| SUBSCRIPTION_SUSPENDED | Masa akses organisasi ditangguhkan. |
| SUBSCRIPTION_CANCELLED | Masa akses organisasi dibatalkan. |
| ORGANIZATION_EXPIRED | Masa akses organisasi berakhir. |
| SUBSCRIPTION_UNAVAILABLE | Masa akses organisasi belum tersedia. |
| EMPLOYEE_NOT_LINKED | Akun belum terhubung ke profil Pegawai. |
| EMPLOYEE_PROFILE_UNAVAILABLE | Profil Pegawai tidak tersedia. |
| EMPLOYEE_DRAFT | Profil Pegawai belum aktif. |
| EMPLOYEE_RETIRED | Tidak dapat masuk. Status Pegawai sudah pensiun. |
| EMPLOYEE_TERMINATED | Tidak dapat masuk. Hubungan kerja sudah berakhir. |
| EMPLOYEE_DECEASED | Tidak dapat masuk. Status Pegawai tercatat meninggal. |
| ACCOUNT_INACTIVE | Akun dinonaktifkan. |
| ROLE_INACTIVE | Hak akses akun tidak aktif. |
| EMPLOYEE_STATUS_INACTIVE | Status Pegawai tidak aktif. |

HRD, Pimpinan dan Pegawai dengan membership berlaku pada organisasi profil mendapat Homepage yang sama. Profil aktif/masa percobaan mendapat `accessMode:self_service`; ditangguhkan mendapat `read_only`. Penempatan, lokasi/divisi nonaktif tidak memblokir login mobile; fitur operasional mendatang wajib memeriksa kelayakannya. Grace organisasi mengikuti layanan web existing dan tetap diizinkan. Role admin tidak diubah dan tidak otomatis memberi akses API administrasi kepada aplikasi mobile.

## Sesi dan fitur berikutnya

API baca beranda kini tersedia lokal melalui GET `/api/mobile/home` dan `/api/mobile/profile-photo`, tanpa mengubah envelope login/me/logout. Lihat `docs/mobile-home.md` untuk DTO minimum, permission per bagian, akses foto privat, zona waktu dan urutan deployment. Endpoint web existing tetap tidak menerima bearer mobile; hanya adapter mobile tersebut yang ditambahkan. Tidak ada endpoint pencatatan absensi/cuti baru.

Migration `20261027_065_mobile_auth_sessions.sql` menambah `mobile_auth_sessions`. Token acak 256 bit dengan prefix `sm1_`; hanya SHA-256 token tersimpan di database. Expiry mutlak dibaca dari `AUTH_MOBILE_SESSION_TTL_MINUTES` pada environment backend, tanpa refresh. Snapshot mengikat user, organisasi, profil, membership dan `credential_version`; FK komposit mencegah referensi profil/membership lintas organisasi. Hasil API hanya identitas minimum, bukan data profil sensitif atau password hash.

Setiap request terproteksi memanggil `requireMobileUser(request)`, membaca ulang status dan versi kredensial. Sesi hilang/palsu/expired/revoked -> 401 `UNAUTHENTICATED`, “Sesi berakhir. Silakan masuk kembali.” Perubahan password atau relasi/membership membuat snapshot tidak cocok dan mencabut sesi; penonaktifan, pensiun atau akses dicabut ditolak pada pemakaian berikutnya. Logout mencabut satu sesi. Sesi perangkat lain independen sampai status/versi berubah.

Mutation mendatang **wajib** memakai `requireMobileUser(request,{write:true})` dan pemeriksaan permission/objek khusus fitur. `read_only` ditolak 403 `MOBILE_READ_ONLY` (“Akun hanya memiliki akses baca.”). Guard ini bukan pengganti transaksi, idempotency atau izin objek. Belum ada endpoint absensi/cuti mobile dalam pekerjaan ini.

Flutter menyimpan sesi melalui secure storage platform; password tidak disimpan. Startup/resume memeriksa `/me`, sesi tidak valid dibersihkan, kegagalan jaringan sementara mempertahankan token. Request terproteksi fitur berikutnya wajib menangani penolakan sesi melalui controller dan guard yang sama. Native HTTP hanya loopback development; rilis wajib HTTPS dengan validasi sertifikat normal.

## Operasional dan penerapan

Upgrade database existing melalui migration 065, **bukan** menjalankan bootstrap `sitou_schema_v3.sql`. Snapshot tersebut sudah memuat struktur akhir untuk database kosong. `npm run db:verify-bootstrap` membandingkan kolom/constraint mobile upgrade dan bootstrap. Backup dan review migration pada staging sebelum penerapan produksi; penambahan tabel tidak memigrasikan akun/password atau mengubah alur web.

Pembersihan berkala: `npm run auth:mobile-sessions:prune` (environment default `.env.development`; pilih file dengan `ENV_FILE`). Menghapus sesi expired dan sesi revoked lebih dari satu hari, mempertahankan audit. Jadwalkan harian melalui mekanisme operasional VPS setelah deployment diotorisasi. Tidak membuat cron otomatis pada pekerjaan ini.

Untuk lokal: jalankan Next.js port 3000, `adb reverse tcp:3000 tcp:3000`, lalu Flutter debug memakai `http://127.0.0.1:3000`. Kredensial akun nyata diketik langsung di aplikasi. QA status memakai fixture sintetis terisolasi yang dibersihkan. Deployment VPS/restart/migration produksi belum dilakukan; saat rollout diperlukan migration 065, kode backend terbaru dan konfigurasi base URL HTTPS mobile. Endpoint ini tidak memerlukan secret baru di APK.

Risiko: username enumeration sengaja diterima dengan kontrol kegagalan bersama dan audit. Tidak ada klaim kebal DoS atau sertifikasi MASVS. Upload/lokasi/idempotency transaksi bisnis tidak berlaku pada login; wajib dinilai saat fiturnya dibangun. iOS, konfigurasi signing produksi, identifier distribusi dan rollout VPS memerlukan verifikasi tersendiri.

## Konfigurasi durasi sesi backend

`lib/auth/mobile/config.mjs` membaca `AUTH_MOBILE_SESSION_TTL_MINUTES` saat login, bukan dari environment Flutter. Next.js memuat environment sesuai mode server: `.env.development` untuk development dan `.env.production` untuk production, dengan prioritas override environment/berkas lokal sesuai loader Next.js. Gunakan `AUTH_MOBILE_SESSION_TTL_MINUTES=10080` untuk tujuh hari (bukan 10000 menit).

Nilai wajib bilangan bulat desimal 1–10080 menit. Nilai kosong/hilang, nol, negatif, pecahan, nonnumerik atau lebih dari 10080 ditolak sebelum verifikasi kredensial/penerbitan sesi. Tidak ada fallback diam-diam. HTTP mengembalikan gangguan generik 500 tanpa membuka detail konfigurasi; log server memuat kode `AUTH_CONFIGURATION_ERROR`. Login web tetap memakai `AUTH_SESSION_TTL_MINUTES` dan tidak bergantung pada variabel mobile ini.

Expiry sesi baru dihitung menggunakan parameter SQL menit dan disimpan sebagai timestamp absolut. Sesi yang sudah terbit tetap mengikuti `expires_at` awal; mengurangi TTL bukan pencabutan sesi existing. `/me`, logout, versi kredensial, hash token dan kontrak respons tidak berubah. Batas database maksimal tujuh hari tetap berlaku sehingga tidak diperlukan migration baru.

Sesudah mengubah environment, muat ulang/restart backend development bila nilai belum termuat. Untuk rollout VPS nanti, konfigurasi variabel ini pada environment production **sebelum** proses backend baru dijalankan/restart. Production tanpa konfigurasi tersebut menolak login mobile; login web tetap independen. Pekerjaan ini tidak mengubah `.env.production` atau VPS. Flutter tidak perlu dibangun ulang untuk perubahan TTL.
