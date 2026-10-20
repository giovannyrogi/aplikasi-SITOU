# Penerbitan dan penggantian sanksi

## Aturan pilihan

Jenis yang sama (ID jenis) tidak dapat dipilih selama keputusan terkait masih aktif dan tanggal berlakunya mencakup hari ini menurut timezone organisasi. Tahapan bawaan teguran lisan → SP1 → SP2 → SP3 tidak dapat turun atau diulang selama tahapan yang sama/lebih tinggi masih berlaku. Jenis lain seperti skorsing, penurunan jabatan, dan jenis tambahan tidak diberi urutan dari nama atau kode tampilan; keputusan tetap pada HRD. Rename jenis dengan ID yang sama tidak melewati larangan duplikasi. Jenis nonaktif tetap terlihat dengan alasan, tidak dapat dipilih.

Setelah sanksi berakhir/dicabut/digantikan, larangan berdasarkan sanksi tersebut tidak berlaku. Pengurangan tingkat keputusan aktif harus melalui proses pencabutan beralasan terlebih dahulu; jangan menerbitkan teguran baru untuk menghapus SP3 aktif secara terselubung. Ini kebijakan produk SITOU berdasarkan alur bertahap internal, bukan klaim fitur Talenta atau aturan universal HRIS. SP2/SP3 tanpa tahap sebelumnya yang masih berlaku memerlukan pilihan penerbitan langsung dan alasan, diperiksa ulang pada publikasi server. SP3 tidak otomatis mengakibatkan PHK; jenis lain dan keputusan lanjutan tetap ditinjau HRD.

## Konfirmasi

Form membaca konteks kasus berizin saat dibuka dan sekali lagi sebelum simpan. Saat status baru Aktif dan masih ada sanksi berjalan, form disembunyikan sementara dan ConfirmDialog bersama menampilkan nama/masa berlaku keputusan lama serta nama jenis baru. Pesan: Sanksi baru akan menggantikan sanksi lama berikut. Surat dan riwayat sanksi lama tetap tersimpan. Kedua keputusan ditampilkan dalam blok berstruktur sama dengan label Sanksi lama (warning) dan Sanksi baru (info), nama serta masa berlaku. Sanksi lama berada lebih dahulu; periode keputusan baru dihitung dari pilihan form yang dikonfirmasi. Batal kembali ke form dengan nilai dan file tetap terjaga. Tidak ada dua modal bertumpuk. Menyimpan draft tidak mengganti keputusan lama.

Tanggal mendatang hanya boleh disimpan sebagai draft karena scheduler penerbitan belum tersedia; jangan menghentikan sanksi aktif sebelum keputusan baru mulai berlaku. Histori lama bertanggal mendatang tidak diubah menjadi Digantikan oleh penerbitan hari ini.

## API dan transaksi

### Urutan tanggal tindakan

Draft dan tindakan resmi wajib memenuhi tanggal kejadian ≤ tanggal terbit ≤ mulai
berlaku. Tanggal kejadian dibaca dari kasus berizin pada konteks form dan dibaca
ulang di bawah lock kasus saat create/edit/penerbitan. Hari ini memakai zona waktu
organisasi. Status Aktif tidak menerima tanggal terbit atau mulai mendatang;
status Draft tetap boleh memakai tanggal mendatang dengan urutan yang benar.

Kalender menonaktifkan tanggal sebelum batas yang sesuai dan tanggal mendatang
saat Aktif. Validator field serta schema/service memakai aturan bersama pada
`issuancePolicy.mjs`; validasi server tetap berlaku untuk request yang melewati
UI. Tanggal kalender tidak nyata ditolak schema ISO. Jika tanggal terbit/status
diubah sehingga tanggal lain invalid, tampilkan error dan pertahankan isian,
termasuk lampiran; jangan mengubah tanggal pengguna otomatis. Form baru memakai
hari ini dari server (atau tanggal kejadian jika lebih kemudian) sebagai nilai
awal, sedangkan edit draft mempertahankan tanggal tersimpan sampai dikoreksi.
Keputusan resmi lama tidak diubah oleh perubahan validasi ini; tidak ada migration
atau koreksi massal tanggal historis.

GET /api/discipline/cases/:id/actions memerlukan discipline.manage dan akses pegawai dalam organisasi/scope, dengan no-store. Organisasi dipetakan/divalidasi dari sesi. DTO: today, incidentDate (tanggal kejadian dari kasus), activeActions (ID, ID jenis, snapshot nama, tanggal, nomor surat), actionTypes dengan disabled_reason. system_key hanya untuk aturan tahap bawaan, tidak menjadi label pengguna.

POST endpoint yang sama dan PATCH /api/discipline/actions/:id menerima replacementActionIds (default []). Server mengunci pegawai lebih dahulu untuk menserialisasi penerbitan lintas kasus, kemudian membaca/mengunci keputusan berjalan. Larangan jenis/tahap diterapkan juga di backend untuk draft dan publikasi. Publikasi mengharuskan daftar ID yang dikonfirmasi sama dengan keputusan berjalan pada transaksi. Perubahan serentak menolak simpan dengan ACTION_CONFIRMATION_CHANGED dan meminta tinjau ulang. Payload klien tidak menentukan daftar keputusan yang diubah. Penggantian, penerbitan dan audit tetap atomik; surat lama tidak dihapus. Pencabutan dan scope existing tetap berlaku.

Tidak ada migration, perubahan schema database, permission HRIS generik baru, atau sanksi otomatis dari indikator. Metadata konfirmasi bukan kolom baru.

## Verifikasi

Uji sementara memakai database QA terpisah dari schema bootstrap dan fixture sintetis, lalu dihapus. Skenario: teguran aktif → SP1 draft → SP1 terbit terkonfirmasi; jenis sama ditolak; SP3 aktif memblokir tahap bawah, jenis lain tetap bisa dipilih; pencabutan membuka kembali pilihan; konfirmasi lama ditolak; tanggal masa depan ditolak untuk publikasi; dua penerbitan paralel hanya satu berhasil; audit penggantian dipertahankan.

Pemeriksaan akhir: npm run lint/build lulus. Browser Chrome pada 320/375/768/1024/1366/1920px dan layar pendek 320×568 memverifikasi pilihan dinonaktifkan, satu modal konfirmasi, tombol fullwidth mobile berjarak aman, batal mempertahankan status/nomor surat/PDF, tidak ada mutation saat batal, dan konflik konfirmasi kembali ke form. GET konteks nyata no-store, kasus dari organisasi yang salah tidak terbaca, akun Pegawai ditolak. Fixture mutation hanya di browser; database aplikasi tidak diubah. Uji database QA juga memverifikasi eskalasi langsung wajib dan penerbitan paralel saat FK memegang KEY SHARE; lock NO KEY UPDATE mencegah konflik lock upload. Database QA, script dan server uji dibersihkan setelah pemeriksaan.

Verifikasi perapian konfirmasi: label Sanksi lama/Sanksi baru pada dua blok seragam, periode keduanya, urutan lama lalu baru, deskripsi rata kiri, satu modal, Batal kembali ke form tanpa mutation; browser 320–1920px dan layar pendek lulus. ESLint terarah dan build lulus. Artefak dan server uji dibersihkan.

Header blok perbandingan memakai dua kolom: nama sanksi di kiri dan chip Sanksi lama/baru di kanan, sejajar tengah dalam baris yang sama. Nama panjang membungkus di kolom teks; chip mengikuti isi. Masa berlaku tetap di bawah header.
