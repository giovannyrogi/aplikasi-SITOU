# QA, pembersihan dan penyelesaian

Jika implementasi berbeda dari aturan yang berlaku, catat perubahannya melalui migration bila schema terdampak, test relevan, dan pembaruan dokumentasi.

## Testing wajib

### QA wajib setiap perubahan

Setiap penambahan fitur, perubahan alur, perbaikan bug, migration, dan perubahan
UI wajib ditutup dengan QA yang disiplin sesuai risiko perubahan. Perlakukan
pengujian sebagai pekerjaan QA profesional: pahami kebutuhan, susun skenario,
jalankan pada sistem sebenarnya, periksa hasil serta efek samping, dan catat
buktinya. Lint atau build berhasil saja tidak cukup untuk menyatakan fitur benar.

1. Sebelum menguji, susun di chat cakupan, aturan bisnis, hasil yang diharapkan, risiko,
   dan bagian terkait yang perlu regresi. Sesuaikan kedalaman dengan dampak;
   jangan mengulang seluruh modul yang tidak terpengaruh tanpa alasan.

2. Uji alur normal, kondisi batas, input invalid, kondisi kosong, kegagalan
   request/transaksi, batal/konfirmasi, pengulangan klik atau retry, serta state
   setelah reload. Untuk bug, reproduksi kondisi asal lalu buktikan perbaikannya.

3. Uji keamanan pada backend, bukan hanya tombol UI: tanpa sesi, sesi tidak valid,
   role tanpa izin, HRD Lihat Saja/Kelola dan scope lokasi bila terkait, manipulasi
   ID/payload, serta akses lintas organisasi dan lintas pegawai. Untuk mutasi,
   periksa validasi origin, validasi schema, dan tidak adanya perubahan pada
   request yang ditolak. Untuk file, uji akses privat dan kebocoran metadata.

4. Untuk perubahan data, periksa invariant, constraint, nomor unik, histori,
   audit pelaku/waktu, rollback, dan request bersamaan sesuai risikonya. Migration
   wajib diuji pada upgrade berisi data sintetis serta bootstrap kosong; nomor,
   tanggal, dokumen, dan histori lama tidak boleh berubah tanpa aturan eksplisit.

5. Jalankan pengujian integrasi terhadap service/database dan endpoint nyata
   untuk perilaku penting. Fixture atau mock UI boleh melengkapi pengujian,
   tetapi tidak membuktikan authorization, transaksi, atau mutasi backend nyata.
   Sebutkan secara jelas bagian mana yang memakai mock atau respons yang dicegat.

6. Untuk UI/alur yang berubah, periksa browser pada lebar 320/375/768/1024/1366
   serta desktop lebar, layar pendek, keyboard/fokus, keterjangkauan aksi, loading,
   feedback sukses/gagal, pemeliharaan isian, overflow, dan console/runtime serta
   warning API deprecated. Periksa regresi komponen bersama pada pemakai terkait.

7. Jalankan lint, build, dan pemeriksaan diff/format yang relevan pada source akhir.
   Bila ditemukan bug, perbaiki, ulangi skenario yang gagal dan regresi terkait;
   jelaskan skenario reproduksi/regresi di chat atau tambahkan pada suite test
   yang sesuai bila diperlukan untuk menjaga perilaku penting.

8. Gunakan database/akun/file sintetis terisolasi. Jangan menjalankan uji destruktif,
   penetration test, atau load test pada VPS/data nyata tanpa izin eksplisit.
   Bersihkan database, file, sesi, dan server QA milik pengujian setelah selesai;
   jangan menghentikan layanan lain atau mengubah data nyata demi membuat tes lolos.

9. Setiap pekerjaan selesai wajib menyertakan ringkasan QA langsung pada jawaban
   akhir di chat: cakupan perubahan, lingkungan, apa yang diuji, hasil aktual
   dibanding harapan, kegagalan dan perbaikan, bukti perintah/respons yang relevan,
   bagian yang belum diuji, serta risiko tersisa. Dilarang membuat file atau folder
   baru di proyek untuk laporan, checklist, bukti, atau ringkasan hasil QA, kecuali
   pengguna secara eksplisit meminta artefak tersebut. Dokumentasi fitur/schema
   dan source test yang diperlukan tetap mengikuti aturan masing-masing; keduanya
   bukan tempat memindahkan laporan QA. Artefak pengujian sementara harus
   dibersihkan setelah selesai. Jangan menyebut tes lulus bila belum dijalankan
   atau menyamakan keberhasilan lokal dengan verifikasi VPS.

10. Perubahan belum boleh dinyatakan siap rilis bila ada temuan kritis/tinggi,
    kegagalan invariant/akses, atau pemeriksaan wajib yang belum selesai. Laporkan
    hambatan serta cakupan yang belum terbukti. QA mengurangi risiko; dilarang
    menjanjikan sistem 100% bebas bug atau seluruh celah berdasarkan tes terbatas.

Skenario wajib per domain berikut dijalankan ketika domain tersebut terdampak:

- Unit test aturan shift fixed, flexible, field, lintas tengah malam, toleransi, pulang awal, dan kandidat lembur.

- Unit test mangkir 1, 3 berturut-turut, 5 berturut-turut, dan 9 dalam sebulan menghasilkan indikator yang tepat tetapi tidak membuat sanksi.

- Integration test rolling menutup penempatan lama dan menyimpan histori.

- Integration test tidak ada dua penempatan utama aktif.

- Integration test import: preview, error per baris, duplicate retry, dan commit idempotent.

- Integration test mobile event retry tidak menggandakan event.

- Integration test HRD-only decision; Pimpinan dan Pegawai ditolak.

- Test izin sakit tidak dapat approved tanpa surat dokter ketika diwajibkan.

- Test lintas organisasi untuk setiap repository/use case utama.

- Test file privat tidak bisa diakses dengan object key langsung.

- Test query plan untuk dashboard pada dataset representatif.

Gunakan data sintetis. Jangan memakai data pegawai asli pada test atau development bersama.

## Definition of Done

Pekerjaan selesai hanya jika:

1. Kebutuhan dan permission jelas.

2. Migration/schema, code, dan dokumentasi konsisten.

3. Isolasi organisasi diterapkan.

4. Validasi frontend dan backend tersedia.

5. Audit dan error handling sesuai risiko.

6. Test relevan lulus.

7. Query baru memiliki index/query plan yang masuk akal.

8. Tidak ada rahasia atau data pribadi dalam repo/log.

9. UI responsive dan state penting diuji.

10. Perubahan tidak merusak kontrak mobile/API tanpa versioning.

11. Laporan akhir menjelaskan rincian penambahan, perubahan, koreksi, serta hasil pemeriksaan sesuai aturan berikut.

### Laporan akhir setelah perubahan

- Setiap selesai mengerjakan perubahan, wajib berikan penjelasan yang cukup rinci agar pemilik proyek memahami hasilnya tanpa membaca kode atau update proses sebelumnya. Jangan hanya memberi daftar singkat seperti “sudah diperbaiki” atau menyebut nama fitur tanpa menjelaskan perubahannya.

- Jelaskan bagian/menu yang dikerjakan, apa yang ditambahkan, diubah, dihapus, atau dikoreksi, serta alasan dan dampaknya pada penggunaan aplikasi. Untuk perbaikan bug, jelaskan penyebab yang sudah terverifikasi dan bagaimana perbaikan mengatasi masalah tersebut; bedakan temuan pasti dari dugaan.

- Uraikan perubahan alur, tampilan, validasi, hak akses, cakupan data, API, database/migration, atau komponen reusable yang memang terdampak. Kelompokkan berdasarkan fitur agar mudah diikuti; tidak perlu menjelaskan kategori yang tidak berkaitan dengan pekerjaan.

- Sebutkan pemeriksaan yang benar-benar dijalankan, skenario penting yang diuji, dan hasilnya. Jika ada pengujian yang belum dijalankan atau gagal, jelaskan secara jujur; jangan menyatakan seluruh pengujian berhasil tanpa bukti.

- Jelaskan batasan, pekerjaan yang belum selesai, dan langkah yang masih diperlukan pengguna jika memang ada, termasuk status penerapan migration atau kebutuhan restart. Jika membuat file pengujian sementara, laporkan status pembersihannya secara sesuai fakta.

- Gunakan Bahasa Indonesia yang sederhana, jelas, dan konkret. Detail harus sebanding dengan cakupan perubahan: gunakan judul dan poin yang terstruktur untuk pekerjaan besar, hindari pengulangan, istilah teknis tanpa penjelasan, serta daftar file/kode panjang yang tidak membantu pengguna memahami hasil.

### Log kerja sementara

- Jangan menyimpan hasil build, lint, atau pengujian sebagai file log di root proyek. Gunakan output terminal atau folder sementara sistem jika hasil perlu dibaca ulang. Bersihkan log setelah verifikasi selesai.

- Folder scripts berisi alat migration, backup, dan pemeliharaan production. Folder tests dan skrip test-* telah dihapus atas instruksi pemilik proyek; perintah npm test terkait juga dihapus. Kebutuhan verifikasi perubahan tetap berlaku melalui lint, build, smoke test, dan pemeriksaan terarah di lingkungan terpisah. Periksa pemanggilan runtime sebelum menghapus alat operasional.

### File pengujian sementara saat pengembangan

- File yang dibuat khusus untuk mencoba atau menguji perubahan bersifat sementara, baik berupa skrip `test-*`, `*.test.*`, helper, fixture, file SQL uji, screenshot, laporan, maupun file pendukung lainnya. Gunakan folder sementara sistem bila memungkinkan.

- Setelah pengujian selesai, berhasil, dan tujuan pemeriksaan terpenuhi, wajib hapus seluruh file sementara yang dibuat untuk pengujian tersebut sebelum menyatakan pekerjaan selesai. Jangan meninggalkan folder pengujian kosong atau artefak uji di root proyek.

- Bersihkan seluruh penghubung ke file yang dihapus: import/export, pemanggilan skrip, perintah `package.json`, konfigurasi, pengecualian `.gitignore`, serta petunjuk dokumentasi. Jangan meninggalkan referensi atau perintah yang rusak. Dependensi khusus pengujian yang ditambahkan untuk pekerjaan tersebut dan tidak lagi digunakan juga dilepas beserta pembaruan lockfile terkait.

- Penghapusan mengikuti fungsi file, bukan hanya namanya. Pastikan file memang dibuat untuk pengujian dan tidak digunakan oleh alur aplikasi, migration, backup/restore, worker, atau pemeliharaan production. Data pengguna, histori bisnis, migration resmi, dan alat operasional yang masih digunakan tetap dipertahankan.

- Kewajiban menguji perubahan tetap berlaku. Jika pengujian belum berhasil, lanjutkan perbaikan dan verifikasi; jangan menghapus bukti masalah lalu menyatakan pengujian lulus. Setelah berhasil, catat ringkasan hasil pemeriksaan pada laporan pekerjaan tanpa menyimpan file uji sementara.

- Sebelum menutup pekerjaan, periksa tidak ada referensi tersisa menuju file uji yang dihapus dan jalankan verifikasi yang relevan terhadap konfigurasi/kode akhir setelah pembersihan.
