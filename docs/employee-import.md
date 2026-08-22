# Import Pegawai SITOU

## Cakupan

SITOU menerima satu workbook `.xlsx` maksimal 10 MB. Workbook memuat `Petunjuk`, `Pegawai`, `Kontak`, `Identitas`, `Rekening`, `Keluarga`, `Kontak_Darurat`, `Akun_Sosial`, `Pendidikan`, `Keahlian`, `Sertifikasi`, `Kontrak`, `Penempatan`, dan hidden sheet `Referensi`.

`Nomor Pegawai` menghubungkan seluruh sheet. Sheet `Kontrak` dan `Penempatan` dapat memiliki beberapa baris untuk menyimpan histori tanpa menimpa periode lama. Referensi seperti `KON-001` dan `PEN-001` harus unik dalam workbook.

Import tidak memproses akun login, foto, dokumen, kasus disiplin, tindakan sanksi, absensi, atau payroll. Pas foto, scan identitas, sertifikat, kontrak bertanda tangan, dan dokumen lain diunggah manual melalui detail pegawai setelah import berhasil.

## Sheet Wajib dan Opsional

| Sheet                                       | Status          | Penggunaan                                                                                                                                                          |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pegawai`                                   | Wajib           | Selalu diisi satu baris per pegawai. Nomor Pegawai, nama lengkap, NIK 16 digit, dan status wajib tersedia.                                                          |
| `Kontrak`                                   | Wajib bersyarat | Wajib untuk pegawai berstatus aktif, masa percobaan, atau cuti (`active`, `probation`, atau `leave`); dapat memuat histori kontrak yang periodenya tidak bertumpuk. |
| `Penempatan`                                | Wajib bersyarat | Wajib untuk pegawai berstatus aktif, masa percobaan, atau cuti (`active`, `probation`, atau `leave`); dapat memuat histori rolling, promosi, demosi, atau mutasi.   |
| `Kontak`, `Identitas`, `Rekening`           | Opsional        | Diisi bila data administratif tersebut tersedia.                                                                                                                    |
| `Keluarga`, `Kontak_Darurat`, `Akun_Sosial` | Opsional        | Diisi sesuai kebutuhan profil pegawai.                                                                                                                              |
| `Pendidikan`, `Keahlian`, `Sertifikasi`     | Opsional        | Diisi untuk melengkapi kompetensi dan riwayat pegawai; file sertifikat tetap diunggah manual.                                                                       |

Sheet opsional yang tidak diperlukan boleh dibiarkan kosong dan tidak menghalangi proses import. Seluruh petunjuk workbook dan modal bersumber dari definisi yang sama agar status pengisian tetap konsisten.

## Identitas dan Duplikasi

- NIK wajib berisi tepat 16 digit.
- Nomor Pegawai dinormalisasi dengan trim dan uppercase; NIK disimpan sebagai digit canonical.
- Nomor Pegawai atau NIK yang sama dalam workbook membuat seluruh data pegawai terkait invalid.
- Pemeriksaan database mencakup pegawai aktif, nonaktif, dan soft-deleted.
- Commit memeriksa ulang identitas dalam transaction lock. Unique index database mencegah dua request bersamaan membuat data ganda.
- Nama bukan kunci unik karena orang berbeda dapat memiliki nama yang sama.

## Alur Pengguna

1. Unduh template organisasi agar sheet `Referensi` berisi master aktif yang boleh digunakan.
2. Isi sheet `Pegawai`, lalu gunakan Nomor Pegawai yang sama pada sheet terkait.
3. Hapus seluruh baris contoh `CONTOH-001`.
4. Upload workbook dan tunggu validasi; tahap ini belum menulis data pegawai final.
5. Periksa ringkasan per pegawai dan unduh laporan kesalahan bila diperlukan.
6. Klik `Impor pegawai valid`. Pegawai invalid dilewati dan dapat diajukan kembali setelah diperbaiki.
7. Lengkapi foto dan dokumen melalui detail pegawai.

Commit atomik per pegawai. Kegagalan satu pegawai tidak menggagalkan pegawai valid lain dan retry batch tidak menggandakan data yang sudah berhasil.

## Keamanan dan Endpoint

Server memeriksa signature file, struktur OOXML, jumlah entry, ukuran hasil ekstraksi, macro, external link, embedded object, enkripsi, formula, header, tipe data, batas panjang, tanggal, enum, referensi organisasi, dan cakupan HRD. Batas per workbook adalah 5.000 pegawai dan 50.000 baris data.

- `GET /api/employees/imports/template?organizationId=...`: template organisasi.
- `POST /api/employees/imports`: multipart `file` dan organisasi target khusus Superadmin.
- `GET /api/employees/imports/:id`: preview batch per pegawai.
- `GET /api/employees/imports/:id/errors`: laporan kesalahan `.xlsx`.
- `POST /api/employees/imports/:id/commit`: commit idempotent per pegawai.

Semua endpoint memerlukan permission import dan isolasi organisasi. File sumber disimpan privat menggunakan UUID. Audit dan log tidak memuat NIK atau payload sensitif.
