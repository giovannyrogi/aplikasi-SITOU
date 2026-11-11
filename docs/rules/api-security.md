# API, isolasi organisasi dan keamanan

## Aturan multi-organisasi wajib

1. Setiap tabel bisnis organisasi memiliki `organization_id` langsung.

2. Setiap query bisnis wajib memfilter `organization_id` dari session server, bukan dari body yang dipercaya begitu saja.

3. Foreign key lintas tabel organisasi memakai pasangan `(organization_id, id)` bila tersedia.

4. Jangan menerima `organization_id` klien tanpa mencocokkannya dengan membership aktif.

5. Superadmin platform boleh lintas organisasi hanya pada use case yang eksplisit dan diaudit.

6. Job, export, import, cache key, nama objek file, dan log juga harus membawa identitas organisasi.

7. Test wajib membuktikan user organisasi A tidak dapat membaca atau mengubah organisasi B.

Contoh pola service:

```ts
await db.transaction(async (tx) => {
  const actor = await requireOrganizationPermission(
    tx,
    session,
    organizationId,
    "employees.update",
  );
  await employeeRepository.update(tx, { organizationId, employeeId, input, actorId: actor.userId });
});
```

## API

- Gunakan path langsung `/api/...` tanpa prefix versi. Endpoint autentikasi berada di `/api/auth/...`; endpoint modul berada langsung pada kelompoknya seperti `/api/employees` atau `/api/attendance/...`.

- Respons error publik memakai kode stabil dan Bahasa Indonesia; jangan bocorkan SQL/stack trace.

- Pesan error wajib spesifik, dapat ditindaklanjuti, dan menunjuk field atau aturan bisnis yang bermasalah. Respons validasi wajib menyertakan `fieldErrors`; frontend wajib menempelkannya ke field terkait dan dilarang membuang detail tersebut menjadi pesan generik.

- Error internal tetap memakai pesan aman tanpa SQL/stack trace dan wajib menyertakan `requestId` sebagai ID referensi yang ditampilkan kepada pengguna untuk pencocokan log server. Gunakan helper penanganan error terpusat untuk respons non-JSON, session berakhir, dan kegagalan jaringan.

- Mutation mendukung request ID dan idempotency pada operasi yang mungkin retry.

- Gunakan optimistic concurrency atau version check pada form edit penting.

- Tanggal tanpa waktu memakai ISO `YYYY-MM-DD`; waktu absolut memakai ISO 8601 UTC.

- Cursor pagination harus opaque.

- Semua endpoint mempunyai authorization test, validation test, dan uji isolasi organisasi.

Endpoint awal yang disarankan:

- `GET/POST /api/employees`

- `GET/PATCH /api/employees/:id`

- `POST /api/employees/:id/assignments`

- `GET /api/employees/:id/history`

- `POST /api/attendance/imports`

- `POST /api/attendance/imports/:id/validate`

- `POST /api/attendance/imports/:id/commit`

- `GET /api/attendance/daily`

- `POST /api/attendance/events` untuk web/mobile kelak

- `POST /api/leave-requests`

- `POST /api/leave-requests/:id/decision`

- `GET /api/discipline/indicators`

- `POST /api/discipline/cases`

- `POST /api/discipline/cases/:id/actions`

- `GET /api/dashboard/leader`

## Keamanan dan privasi

- Password memakai `bcryptjs` dengan cost factor minimal 12. Password baru minimal 6 karakter, maksimal 72 byte sesuai batas bcrypt, serta wajib memiliki huruf besar, huruf kecil, angka, dan simbol. Password polos tidak boleh ditulis ke repository atau log.

- Form reset password wajib memiliki field konfirmasi password. Frontend dan schema backend harus memvalidasi kesamaan password sebelum hashing; confirmPassword hanya data validasi request dan tidak pernah disimpan atau ditulis ke log.

- Session server-side memakai cookie HttpOnly, Secure, SameSite yang tepat.

- Rate limit login, reset password, upload, export, dan attendance endpoint.

- NIK, BPJS, rekening, koordinat, dokumen, dan kasus disiplin dimasking di list/log.

- Nomor WhatsApp/kontak seluler Indonesia wajib memakai komponen `IndonesiaPhoneInput` dan aturan terpusat `lib/validation/indonesianPhone.js`. UI menampilkan prefix tetap `+62`, pengguna mengisi mulai digit `8` tanpa awalan `0`, dan database menyimpan format E.164 `+628...`; dilarang membuat regex/normalisasi nomor sendiri di fitur lain.

- Seluruh input NIK wajib memakai reusable `IndonesianNationalIdInput` dan aturan terpusat `lib/validation/indonesianNationalId.js`. Input hanya menerima maksimal 16 digit, menampilkan counter selama belum lengkap, berubah menjadi ikon centang saat tepat 16 digit, dan wajib divalidasi kembali oleh schema backend; dilarang membuat regex atau input NIK terpisah pada fitur lain.

- Jangan masukkan rahasia atau data pribadi ke analytics, fixture publik, screenshot, seed, atau error tracker.

- Audit login, perubahan role, pegawai, rolling, koreksi absensi, izin, dokumen sensitif, dan sanksi.

- Validasi MIME dari byte; jangan percaya ekstensi.

- Gunakan antivirus/malware scan bila tersedia.

- Backup terenkripsi dan uji restore berkala.

- Terapkan retention dan prosedur penghapusan yang disetujui.

- Frontend tidak boleh menerima data sensitif yang tidak berhak hanya untuk disembunyikan dengan CSS.

## Kontrol bersama untuk integrasi native

Kontrol berikut berlaku pada batas klien/API. Aturan khusus OS/perangkat dikelola di dokumentasi Flutter.

### Validasi input dan aturan bisnis

- Validasi Flutter membantu pengguna, tetapi backend wajib memvalidasi ulang seluruh input dari body/query/path/header/file. Tentukan schema tipe, panjang, rentang, format, nilai yang diizinkan, jumlah item dan batas payload; tangani JSON rusak, null, field hilang, field tambahan, serta angka nonfinite bila relevan.
- Gunakan allowlist field yang boleh diubah untuk mencegah mass assignment. Klien tidak boleh menentukan actor, role, pemilik file, organisasi, saldo, status persetujuan atau hasil validasi yang menjadi kewenangan server.
- Validasi hubungan data, status saat ini, transisi status, tanggal, scope lokasi, saldo dan aturan bisnis berdasarkan data server terbaru dalam transaksi bila diperlukan. Jangan hanya memeriksa format atau mempercayai state UI lama.
- Gunakan query berparameter. SQL dinamis seperti kolom pengurutan harus berasal dari allowlist. Jangan menggabungkan input ke SQL, shell command atau path filesystem. Teks tak tepercaya tidak dirender sebagai HTML aktif; bila fitur membutuhkan HTML/WebView, batasi konten dan navigasinya serta gunakan sanitasi/encoding sesuai konteks.
- URL dari pengguna tidak boleh langsung diambil backend. Bila fitur mengambil resource eksternal, validasi skema/host/redirect dan cegah akses jaringan privat/metadata server untuk mengurangi risiko SSRF.

### Otorisasi, sesi dan penyalahgunaan API

- Periksa izin per endpoint, aksi, objek dan field di server, termasuk akses foto/download/export. Mengetahui ID/URL atau menyembunyikan tombol bukan hak akses; tolak akses yang tidak terbukti berizin.
- Uji manipulasi ID Pegawai/organisasi/file, peningkatan role, akses langsung endpoint admin dan data respons berlebih. Respons hanya mengandung field yang boleh diterima pemanggil.
- Terapkan batas percobaan login dan rate limit operasi sensitif berdasarkan risiko, dengan cakupan akun/sumber yang sesuai; endpoint login web dan mobile tidak boleh menjadi jalan bergantian untuk melewati kebijakan percobaan bersama. Hindari kebijakan penguncian yang mudah dipakai untuk memblokir akun orang lain.
- Sesi harus memverifikasi integritas, expiry dan status/versi kredensial/izin yang berlaku. Rancang serta uji pencabutan/logout, perubahan password, akun dinonaktifkan dan perubahan akses. Jika memakai refresh token, tentukan expiry, rotasi, deteksi reuse dan pencabutan; jangan sekadar memperpanjang token tanpa batas.
- Jangan memasukkan token ke URL/log atau menganggap API key/client secret yang ditanam di APK sebagai bukti identitas aplikasi. Biometrik lokal, deteksi root/jailbreak, obfuscation dan attestation hanya pertahanan tambahan bila dibutuhkan; tidak menggantikan otorisasi server atau menjamin aplikasi tak dapat dimodifikasi.

### Upload, jaringan dan pembatasan resource

- Selain ukuran dan MIME dari byte, batasi jumlah file, dimensi/piksel gambar, waktu proses, pagination dan batch sesuai risiko. Jangan mempercayai Content-Type, ekstensi, nama/path file atau ukuran yang dilaporkan klien. Hindari memuat payload tak terbatas ke memori.
- File memakai nama/key buatan server, storage privat, akses berizin dan pemindaian sesuai kebijakan web. Cegah path traversal, file executable/konten berbahaya serta pengambilan file milik pihak lain. Bersihkan file sementara/yatim dengan aman dan jangan menghapus file aktif akibat request gagal.
- Produksi wajib HTTPS dengan validasi sertifikat/hostname normal. Dilarang bypass TLS, menerima semua sertifikat atau mengirim credential melalui HTTP. Pengecualian development harus terisolasi dan tidak masuk build rilis.
- Tetapkan timeout, batas retry/backoff dan batas concurrency/kuota yang relevan di klien maupun server. Tangani rate limit tanpa retry terus-menerus. Jangan menganggap rate limit aplikasi sebagai perlindungan penuh terhadap seluruh serangan DoS.

### Request bersamaan, replay dan manipulasi alur

- Mutation yang dapat diulang harus memiliki idempotency server yang terikat aktor/organisasi/operasi dan payload, dengan kebijakan konflik serta masa simpan yang jelas. Key sama dengan payload berbeda tidak boleh diterima diam-diam. Cegah duplikasi dengan transaksi/constraint/locking atau version check yang tepat, bukan tombol disabled saja.
- Uji request paralel, retry setelah timeout ketika server mungkin sudah menyimpan, replay payload lama, urutan langkah dilewati dan perubahan data di tengah proses. Contoh relevan: dua absen identik, dua permintaan cuti yang saldonya bertabrakan dan pembatalan setelah status berubah.
- Kejadian absensi memeriksa waktu, jadwal, titik, akurasi dan kepemilikan file di server. Foto kamera, EXIF, flag mock location atau jam perangkat tidak menjadi bukti tunggal keaslian.
