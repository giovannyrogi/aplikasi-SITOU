# Wizard dan Draft Pegawai

## Alur Pengguna

Wizard tambah pegawai terdiri dari empat langkah: `Profil`, `Pendidikan`, `Kontrak`, dan `Penempatan`. Setiap step hanya menampilkan field miliknya. Perubahan disimpan ke draft privat saat pengguna menekan `Lanjut`, `Kembali`, atau `Simpan draft & tutup`; pengetikan field tidak mengirim request ke server. Draft aktif dipulihkan ketika modal dibuka kembali, termasuk setelah refresh atau login ulang.

Draft berlaku tujuh hari dan hanya dapat dibaca atau diubah oleh pembuatnya pada organisasi yang sama. Tombol `Mulai ulang` menandai draft lama serta file staging sebagai terhapus, lalu membuat draft kosong.

KTP dan pas foto bersifat opsional. KTP menerima JPEG, PNG, WebP, atau PDF maksimal 5 MB; pas foto menerima JPEG, PNG, atau WebP maksimal 5 MB. Pendaftaran awal boleh tanpa nomor/dokumen kontrak dan SK. Dokumen yang diisi tetap divalidasi; kontrak/penempatan baru di luar onboarding mengikuti workflow dokumen masing-masing. MIME diperiksa dari isi byte dan browser hanya menerima ID metadata file.

## Endpoint

- `GET/POST /api/employees/drafts`: mengambil atau membuat draft aktif.
- `PATCH/DELETE /api/employees/drafts/:id`: menyimpan checkpoint draft dengan version check atau membuang draft.
- `POST /api/employees/drafts/:id/files`: upload staging KTP, pas foto, PDF kontrak, atau PDF SK.
- `DELETE /api/employees/drafts/:id/files/:fileId`: soft delete file staging.
- `POST /api/employees/drafts/:id/submit`: finalisasi idempotent menjadi pegawai.

Finalisasi memvalidasi ulang payload, organisasi, referensi master, dan file dalam backend. Profil, kontak, kontrak, penempatan, referensi pas foto, serta relasi dokumen KTP opsional dibuat dalam satu transaksi. File staging kemudian dialihkan ke pegawai tanpa pernah mengirim `object_key` ke browser.

## Operasional

Jalankan `npm run employee-drafts:expire` melalui scheduler harian. Proses hanya mengubah draft kedaluwarsa menjadi `expired` dan melakukan soft delete metadata staging; penghapusan byte fisik tetap mengikuti retention storage.

## Usia dan tanggal akhir kontrak

Usia pada Ringkasan diturunkan sebagai tahun, bulan, dan hari dari tanggal lahir, memakai `organization_today` dari waktu database dalam zona organisasi. Pegawai meninggal memakai tanggal meninggal. Data kosong/invalid tidak dianggap usia nol. Tidak ada kolom usia tersimpan.

`employment_types.requires_end_date=true` berarti tanggal kedaluwarsa kontrak wajib; false berarti tidak digunakan. API detail menyediakan `contract_requires_end_date`; histori kontrak menyediakan `requires_end_date`. Form baru, pendaftaran/draft, dan koreksi menyembunyikan tanggal akhir serta mengirim null untuk jenis tanpa akhir. Request aktif/new dengan tanggal berisi ditolak sebagai `CONTRACT_END_NOT_APPLICABLE` dan field error. Histori tertutup tetap mempertahankan tanggal penutupannya, dengan label Tanggal penutupan periode. Tidak ada backfill atau penghapusan otomatis pada data/file lama.

Import menerapkan aturan yang sama pada validasi dan pemeriksaan ulang saat commit; tanggal penutupan histori resmi tetap dapat dicatat. Laporan/indikator kedaluwarsa hanya menghitung jenis yang menggunakan akhir. Export mempertahankan kolom dan memakai Tidak berlaku untuk kedaluwarsa yang tidak digunakan, sambil mempertahankan penutupan histori.

## Jadwal kerja awal

Bagian Jadwal kerja tetap di langkah 4 Penempatan; tidak menambah langkah. Pilih Atur jadwal nanti atau Pilih jadwal kerja. Daftar memuat jadwal tetap dan pilihan Nama jadwal — Nama shift. Pilih satu shift yang akan dijalani Pegawai, bukan seluruh kelompok. Ketika dipilih, tampilkan ringkasan hari/jam/libur, Mulai berlaku, Berakhir (opsional), serta Tanggal hari pertama putaran hanya untuk pola rotasi lama. Jenis baru tidak memerlukan tanggal putaran. Tanggal awal mengikuti nilai yang lebih akhir antara hari ini organisasi dan tanggal bergabung; isian draft yang sudah ada tidak ditimpa. Pengguna tanpa Kelola Jadwal Pegawai tetap dapat mendaftar sesuai hak existing dan melihat petunjuk untuk HRD berizin.

Pilihan shift kelompok menggunakan ID pola anggota existing. Bentuk workSchedule {patternId,from,until?,anchorDate?} disimpan/dipulihkan bersama draft; Atur jadwal nanti dikirim sebagai null. Pilihan organisasi lama dibersihkan saat organisasi berubah. Finalisasi profil dan penetapan tetap satu transaksi; gagal jadwal membatalkan profil parsial. Payload lama tanpa jadwal dan import tetap kompatibel. Pegawai existing memakai Kepegawaian → Jadwal Pegawai atau tab Jadwal kerja detail Pegawai. Lihat work-schedules.md.

Status perkawinan pada Data Pegawai menggunakan pilihan yang sama dengan pendaftaran: Belum Menikah, Menikah, Cerai Hidup dan Cerai Mati. Filter hanya menyaring daftar serta ekspor. Menghapus pilihan atau Atur ulang menampilkan seluruh status, termasuk nilai kosong, tanpa mengubah profil.

### Jadwal dan aktivasi Fitur Absensi

Pilihan jadwal langkah 4 Penempatan memerlukan Fitur Absensi organisasi aktif dan hak kelola Jadwal Pegawai. Saat nonaktif, HRD tetap dapat mendaftarkan profil tanpa jadwal. Panel informasi menjelaskan aktivasi melalui Superadmin → Organisasi. Payload lama/draft yang masih meminta penetapan jadwal ditolak server ketika fitur telah dimatikan, sehingga tidak ada bypass melalui browser lama. Profil dan penetapan tetap satu transaksi. Mengaktifkan fitur tidak memberi grant pendaftar secara otomatis.
