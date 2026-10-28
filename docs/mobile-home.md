# API baca beranda SITOU Mobile

Beranda Flutter memakai sesi bearer existing. Login/me/logout, cookie web, origin, role serta permission administrasi tidak berubah. Tidak ada tabel atau migration baru. `lib/auth/mobile/home.js` adalah adapter baca berizin untuk sumber data dan storage existing.

## Kontrak

GET `/api/mobile/home` menerima Authorization Bearer, tanpa query/body selector. Respons envelope SITOU menyertakan requestId dan `data:{profile:{name,hasPhoto},organization:{name,timezone},placement,serverTime}`. `placement` string nama lokasi penempatan utama yang berlaku atau null; tidak menunjukkan validasi GPS. `serverTime` ISO 8601 UTC; timezone IANA berasal dari organisasi. Tidak mengirim NIK, kontak, password, object key, token atau daftar data administratif.

Setiap request memanggil requireMobileUser dan `employees.read_self`. Identitas actor selalu dipetakan dari sesi, bukan ID klien; readEmployeeDashboard membaca profil user dan penempatan utama sesuai tanggal zona organisasi. Penempatan hanya dikirim dengan `assignments.read_self`. hasPhoto hanya aktif jika ada referensi foto dan `profile_self.read`. Tidak membaca statistik cuti/sanksi/kontrak untuk DTO beranda. Zona invalid/tidak tersedia ditolak 503 TIMEZONE_UNAVAILABLE; tidak memilih zona perangkat atau fallback baru.

GET `/api/mobile/profile-photo` menerima bearer dan tidak menerima fileId/employeeId/organizationId atau query lain. Wajib `employees.read_self` dan `profile_self.read`; getSelfProfilePhoto memastikan employee.user_id, organisasi, pemilik file, referensi pas foto, category employee_photo dan lifecycle aktif tanpa draft/deleted/purged. getStoredFile dan assertStoredFileAvailable mempertahankan kebijakan pemindaian serta storage privat existing. Hanya JPEG/PNG/WebP maksimal 5 MiB, preview diaudit melalui private_file.preview. Respons memakai Content-Type, Content-Length, nama tersanitasi, CSP sandbox, nosniff, private/no-store. File tetap privat, tidak tersedia melalui path publik.

Kedua GET memakai validasi origin existing. Tanpa sesi/invalid/revoked/expired ditolak 401; kelayakan akun/organisasi memakai 403 kontrak mobile. SELF_FORBIDDEN 403 tidak berarti sesi dicabut. Query selector ditolak 400 VALIDATION_ERROR dengan fieldErrors; foto kosong/tidak dimiliki/tidak aktif 404; gangguan internal aman 500 dengan requestId. Tidak ada mutation bisnis atau retry otomatis; GET dapat dicoba ulang manual. Audit preview merupakan efek baca yang disengaja, bukan pencatatan absensi. Metode selain GET tidak ditambahkan.

## Integrasi dan penerapan

Flutter memisahkan profil asli dari HomeExampleData: shift, status absensi, ringkasan 19/1/0 dan pengumuman contoh diotorisasi pemilik untuk desain, bukan hasil query database. Tombol belum tersedia hanya menampilkan Segera tersedia; tidak memanggil endpoint pencatatan. API ini tidak memberikan data absensi atau saldo cuti dan tidak boleh diklaim menyelesaikan integrasi bisnis tersebut.

Deploy kode backend baru sebelum distribusi APK homepage; schema tetap existing (termasuk sesi mobile migration 065). APK lama tetap memakai kontrak auth unchanged. APK baru menangani endpoint belum tersedia sebagai kegagalan muat/coba lagi. Gunakan base URL HTTPS domain pada rilis, tanpa adb reverse. Tidak ada penerapan VPS otomatis. Rilis operasional menunggu penggantian data contoh, QA perangkat/platform serta regresi sesi dan permission.
