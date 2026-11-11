# File privat dan pemindaian

## File privat

- Pemeliharaan penyimpanan melindungi file berdasarkan referensi nyata, termasuk histori, versi dokumen, logo organisasi, dan draft aktif. Kategori dokumen resmi atau kepemilikan `employee_id` saja bukan alasan mempertahankan file tanpa referensi. Superadmin boleh membersihkan file tersebut secara permanen setelah konfirmasi dan pemeriksaan ulang; histori bisnis dan audit tidak dihapus.

- Halaman Pemeliharaan Penyimpanan memuat data saat dibuka, organisasi berganti, tab kembali aktif, atau pengguna meminta Muat ulang. Polling berurutan 10 detik hanya saat ada proses `queued`/`running` dan tab terlihat; hentikan saat idle/tersembunyi, coba ulang kegagalan jaringan proses aktif tanpa menumpuk request.

- File tanpa catatan berumur kurang dari 24 jam tidak menjadi kandidat. Pembersihan manual kandidat tanpa referensi tidak memerlukan hasil antivirus bersih atau masa tunggu tujuh hari; preview/unduh tetap wajib bersih. File terinfeksi tetap mengikuti karantina keamanan.

- Semua temuan, kartu, riwayat, dan modal pemeliharaan wajib menampilkan organisasi asal dari data server. Organisasi yang belum terverifikasi memblokir penghapusan. Gunakan keterangan singkat seperti “Tidak digunakan”, “File tanpa catatan”, atau “File tidak ditemukan”, serta tombol tindakan yang sesuai masalah.

- Development boleh memakai direktori privat di luar public web root.

- Produksi direkomendasikan object storage privat.

- Backup sistem manual oleh Superadmin wajib mencakup PostgreSQL dan seluruh file yang tersedia di `UPLOAD_ROOT` lintas organisasi dalam satu paket terenkripsi. Kata sandi tidak disimpan; paket siap tetap berada di server sampai Superadmin menghapusnya secara eksplisit, unduhan dan penghapusan diaudit, dan restore produksi tidak tersedia dari dashboard. Penghapusan hanya menghapus artefak backup, bukan database aktif, `UPLOAD_ROOT`, histori, temuan, atau audit. File yang dirujuk tetapi hilang atau berbeda dicatat sebagai temuan dengan identitas organisasi serta pemilik yang terverifikasi dan menghasilkan status `ready_with_warnings`; kegagalan snapshot, path tidak aman, atau penyimpanan tidak dapat dibaca tetap menggagalkan backup. Uji pemulihan dilakukan di lingkungan terpisah. Lihat `docs/system-backup.md`.

- Setiap backup baru mengelompokkan tiga artefak terenkripsi dalam satu folder bertanggal dari `created_at`, snapshot IANA `time_zone` (default backup baru WITA/Asia/Makassar), dan UUID lengkap. Waktu riwayat/detail dikonversi ke zona browser pengguna; nama artefak tetap memakai snapshot dan detail menampilkan kedua waktu serta nama ZIP. Jam browser tidak menjadi sumber pencatatan audit. ZIP upload satu lapis langsung berisi `uploads/`, semua entri AES-256; daftar path dapat terlihat sebelum kata sandi. Dump Custom bertanggal direferensikan manifest format 3. Kata sandi pendek tetap diperbolehkan dengan indikator lokal Lemah/Sedang/Kuat yang tidak memblokir penyimpanan. Seluruh akses/cleanup memakai helper path terpusat, menolak symlink, dan hanya menghapus artefak dikenal serta folder kosong.

- ZIP database dan ZIP seluruh upload hanya boleh dibuat dari snapshot paket utama yang sama, wajib terenkripsi AES-256, diaudit saat diunduh, dan dihapus manual bersama paket utama. Restore penuh harus memakai `.sitou-backup` melalui alat server Windows/Ubuntu setelah aplikasi serta worker dihentikan; jangan menjadikan dua ZIP terpisah sebagai input restore otomatis atau menimpa produksi melalui dashboard.

- Database menyimpan `object_key`, nama asli, MIME, ukuran, hash, kategori, dan pemilik organisasi.

- API file melakukan authorization setiap preview/download dan mengaudit dokumen sensitif.

- Jangan membangun URL `/uploads/...` yang bisa ditebak.

- Nama objek gunakan UUID; jangan gunakan nama asli atau NIK.

- Upload logo juga masuk `stored_files`, lalu direferensikan oleh `organization_branding` atau lokasi.

- Dokumen histori resmi seperti kontrak, SK penempatan, dan surat sanksi memakai soft delete/retention dan tidak boleh dihapus fisik melalui form profil. Lampiran profil yang dapat diganti seperti pas foto, identitas, pendidikan, dan sertifikasi wajib menghapus byte fisik setelah penghapusan referensi database berhasil.

- Development memakai `UPLOAD_ROOT` atau default `<project>/uploads`; production wajib memakai mounted persistent storage yang dibackup, bukan filesystem ephemeral.

- Struktur pegawai wajib `org_{organizationId}/pegawai/employee_{employeeId}/{kategori}/{tahun}/{uuid}.{ext}`. Kategori meliputi `pas_foto`, `identitas/ktp`, `identitas/kk`, `identitas/npwp`, `kontrak`, `pendidikan`, `sertifikasi`, `sanksi/sp1|sp2|sp3|lainnya`, dan `dokumen_lain`.

- Nama fisik wajib memuat UUID. Nama pegawai, NIK, nomor rekening, nomor surat, dan data pribadi lain dilarang berada dalam object key, path, atau log. Pengecualian khusus selfie absensi baru mengizinkan awalan nama depan yang disanitasi pada nama fisik di storage privat. Nama lengkap, NIP dan NIK tetap dilarang. Path atau nama fisik selfie tidak boleh dikirim ke klien atau ditulis di log.

- Selfie absensi baru memakai org_<id>/absensi/<tahun>/<lokasi>-<id>/<unit>-<id>/<bulan>/<hari>/<nama-depan>-<masuk|pulang>-<HHmmss>-<uuid>.<ext>. Gunakan penempatan utama efektif pada tanggal kerja dan jam kejadian dalam zona organisasi. Semua segmen berasal dari data server dan nama label dinormalisasi serta dibatasi. UUID dan publikasi atomik tanpa timpa melindungi file yang sudah ada.

- Browser hanya menerima ID metadata dan mengakses `/api/uploads/:fileId`; endpoint catch-all berdasarkan path dilarang.

- Response file memakai `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, CSP ketat, nama download tersanitasi, authorization organisasi/scope, dan audit untuk preview/download sensitif.

- Gambar menerima JPEG/PNG/WebP maksimal 5 MB. Dokumen menerima PDF maksimal 10 MB; DOCX hanya untuk kategori yang membutuhkannya dan tidak dipreview inline. MIME harus dideteksi dari byte.

- Dropzone gambar wajib menampilkan pratinjau dan metadata file setelah upload berhasil. File lama berbasis `fileId` harus memiliki lifecycle lihat, ganti, dan hapus yang sama dengan file baru; aksi hapus wajib membersihkan state UI serta melepas referensi profil terkait secara transaksional agar ID file usang tidak muncul kembali.

- Pada form komposit yang memiliki tombol simpan utama seperti `Profil lengkap pegawai`, pemilihan file hanya boleh membuat pratinjau lokal. Byte file, metadata `stored_files`, dan referensi domain baru disimpan ketika tombol simpan utama berhasil; kegagalan validasi atau transaksi wajib membersihkan file sementara dan tidak boleh meninggalkan metadata/file baru setengah jadi.

- Pas foto, KTP, Kartu Keluarga, NPWP, BPJS, ijazah, dan sertifikat adalah bukti visual: upload baru hanya menerima JPEG/PNG/WebP. Kontrak, SK penempatan, dan surat sanksi adalah dokumen resmi: upload baru hanya menerima PDF. File lama dengan tipe sebelumnya tetap dapat dibuka secara berizin, tetapi tidak boleh menggantikan validasi tipe baru.

- Tulis upload ke file sementara, hash SHA-256, lalu atomic move. Bersihkan byte bila transaksi metadata gagal. Penghapusan lampiran profil memakai karantina atomik: pulihkan file bila transaksi database gagal dan hapus byte karantina setelah commit berhasil. Bukti histori resmi tetap memakai soft delete dan retention.

### Pemindaian file development dan production

- Kepegawaian dan Inventaris wajib memakai pipeline storage/pemindaian yang sama. npm run dev dapat tanpa ClamAV dengan CLAMAV_REQUIRED=0 dan CLAMAV_ENABLED=0; validasi MIME byte/ukuran/dimensi/hash, organisasi/scope, staging dan rollback tetap berlaku. Status file legacy_unscanned, bukan clean palsu.

- NODE_ENV=production selalu wajib scan, termasuk npm start lokal, walaupun flag bernilai 0. Scanner tidak tersedia, timeout, atau ancaman menggagalkan upload. File belum clean diblokir pada preview/unduh production; jalankan pemindaian sebelum memakai file development di VPS.

- Upload Inventaris memakai PrivateFileUpload/FileUploadField dan ImagePreviewModal yang sudah ada. Foto barang disimpan bersama Simpan barang; lampiran transaksi mengikuti draft privat. Callback penghapusan async wajib ditunggu dan dilindungi loading/error; jangan membuat upload/dropzone paralel atau mencabut referensi UI sebelum hasil pemilik diketahui.

- Metadata tampilan upload dibaca melalui helper bersama `readUploadMetadata`: mendukung `mime_type`/`mimeType`, `size_bytes`/`sizeBytes`, serta file lokal. DTO upload dan pembukaan kembali draft wajib menyertakan MIME nyata dan ukuran agar preview konsisten; nama/ekstensi bukan dasar penentuan MIME. Uji gambar langsung setelah upload, draft dibuka kembali, PDF, dan penghapusan.
