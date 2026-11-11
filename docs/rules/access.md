# Role, fitur dan hak akses

Sumber aturan aktif untuk bidang ini. Gunakan [indeks](../README.md) untuk memilih section dan kontrak terkait. Path teknis tanpa tautan relatif terhadap root repositori.

## Role dan permission

### Superadmin

- Mengelola organisasi, lokasi awal, akun admin/HRD, masa aktif, dan konfigurasi platform.
- Tidak otomatis menjadi HRD organisasi; gunakan aksi lintas organisasi yang eksplisit.

### HRD

- CRUD data pegawai dan master organisasi sesuai submenu Lihat Saja/Kelola setelah konfigurasi hak HRIS diaktifkan; organisasi lama tetap mengikuti [rollout HRIS](#hak-akses-submenu-hris).
- Data Master HRD memakai halaman/API yang sama dengan Superadmin, tetapi `organization_id` selalu dikunci dari session. HRD dapat mengelola lokasi, jenis unit organisasi, Divisi & Unit, jabatan, serta jenis kepegawaian organisasinya; identitas organisasi, masa akses, dan Admin/HRD pertama tetap khusus Superadmin.
- Mengelola kontrak, penempatan, shift, absensi, izin, dokumen, kasus, dan sanksi.
- Menjadi satu-satunya approver cuti/izin.
- Mengunggah dokumen sanksi dan mengubah status tindakan.
- Setelah konfigurasi HRIS aktif, admin HRD penuh mengelola akun HRD, Pimpinan, dan Pegawai serta delegasi HRIS. HRD terdelegasi hanya mengelola akun Pegawai sesuai dua kewenangan pada [delegasi akun Pegawai](#penyatuan-fitur-dan-delegasi-akun-pegawai). Tautan profil pegawai opsional untuk HRD/Pimpinan dan wajib untuk Pegawai; dilarang memberi role Superadmin atau menonaktifkan diri. Superadmin boleh mencabut admin penuh tanpa pengganti dan mengubah role/status HRD aktif terakhir. Pengakhiran hubungan kerja melalui workflow terpisah tetap meminta pencabutan admin penuh terlebih dahulu.
- Cakupan HRD selalu eksplisit melalui `location_scope_mode=all|selected`; ketiadaan baris scope tidak boleh ditafsirkan sebagai akses penuh ketika mode `selected`.

### Pimpinan

- Read-only untuk seluruh profil, penempatan, kontrak, dokumen sensitif, dan histori sanksi pada organisasinya tanpa batas lokasi. Preview/download sensitif wajib diaudit.
- Tidak dapat mengubah profil HRD, memutus izin, atau menerbitkan sanksi melalui sistem.
- Dokumen dan data sangat sensitif memerlukan permission khusus.

### Pegawai

- Tahap sekarang dapat dibuat tanpa akun aktif.
- Tahap mobile/web lanjutan: melihat data sendiri, absensi, mengajukan izin/cuti, dan mengunggah lampiran.
- Tidak pernah boleh memilih `employee_id` milik orang lain.
- Permission self-service wajib memakai kode dan endpoint `*_self` yang memetakan pegawai dari session. Dilarang memberikan permission HRIS generik organisasi kepada Pegawai sebelum endpoint self-service tersedia. Akses operasional Inventaris hanya diperoleh melalui paket organisasi dan scope gudang eksplisit, terpisah dari self-service.

Semua aksi diperiksa di backend. Menyembunyikan tombol di frontend bukan kontrol keamanan.

## Hak akses submenu HRIS

- Role dasar tetap satu. HRIS administratif hanya role HRD; Pegawai tidak mendapat permission HRIS organisasi. Inventaris/self-service tetap terpisah.
- Superadmin dapat menetapkan/mengalihkan paling banyak satu admin HRD penuh aktif per organisasi; organisasi boleh sementara tidak memilikinya. Admin ini selalu seluruh lokasi dan satu-satunya pemberi HRIS selain Superadmin. HRD lain dapat mengelola akun Pegawai dan fitur non-HRIS hanya jika diberi kewenangan eksplisit pada [delegasi akun Pegawai](#penyatuan-fitur-dan-delegasi-akun-pegawai). HRD terbatas mengikuti submenu Lihat Saja/Kelola; cakupan lokasi tetap per akun. HRD pertama tidak otomatis menjadi admin penuh.
- Katalog tertutup HRIS_MENUS menentukan hak yang tersedia. Fitur baru termasuk payroll tidak mendapat akses otomatis dari role/admin penuh. Laporan/Dashboard hanya baca; Data Pegawai termasuk identitas/rekening/dokumen dan harus dijelaskan pada form. Cuti serta akun di detail tetap berizin terpisah.
- Guard wajib pada halaman/API/file, bukan tombol saja. Context path/method selalu ditimpa Proxy; grant dibaca dari database terbaru. File kategori memisahkan identitas, foto referensi, surat sanksi dan lampiran izin.
- Migration 053 mengubah hak efektif HRD lama yang belum diatur menjadi grant eksplisit seluruh menu HRIS serta kewenangan Akun & Akses yang setara; akun yang sudah diatur tidak boleh ditimpa. Setelah migration, tidak ada fallback akses legacy: setiap akun selain admin penuh hanya mengikuti grant dan flag database. Omission mempertahankan grant, array kosong mencabut. Akun HRD baru atau baru beralih ke role HRD tanpa pilihan mulai tanpa menu. Transaksi akun/grant/admin memakai version, lock organisasi dan audit.
- Admin penuh wajib dialihkan sebelum dinonaktifkan, diturunkan role/cakupan, atau diproses akhir hubungan kerja, kecuali pencabutan status admin penuh atau perubahan role yang secara eksplisit diizinkan pada butir berikut. Pengakhiran hubungan kerja tetap memerlukan pengalihan/pencabutan terlebih dahulu. Jangan mengubah perhitungan/alur inti HRIS lain tanpa keputusan baru.
- Superadmin boleh mematikan switch Admin HRD penuh atau mengubah role admin penuh menjadi Pegawai/Pimpinan tanpa pengganti. Dalam transaksi yang sama, kosongkan seluruh hak menu dan kewenangan akun HRIS milik akun lama; Inventaris dan histori tetap. `primary_membership_id=NULL` berarti belum ada admin penuh, bukan HRIS nonaktif. Penetapan admin baru ketika admin lama tetap HRD mempertahankan hak HRIS tersimpan admin lama. Perubahan admin wajib memakai versi kebijakan dan audit.
- Pembagian submenu menggunakan satu bagian Akses fitur bersama Inventaris. Tabel menampilkan satu chip fitur dan +N fitur lainnya; rincian melalui Aksi → Lihat hak akses. Dilarang menumpuk submenu, grant gudang, atau tautan rincian pada kolom Akses fitur.
- Rancangan, rollout dan kontrak API: docs/hris-access-design.md. Uji regresi akses, scope, session aktif, file privat, transfer dan guard pada database terpisah.

## Penyatuan fitur dan delegasi akun Pegawai

- Satu blok per fitur HRIS/Inventaris di OrganizationAccountForm. Pilihan HRIS hanya untuk actor Superadmin/admin HRD penuh dan target HRD. Role Pegawai tidak menerima administrasi HRIS. Identitas role/admin tetap terpisah dari izin operasional.
- Dua kewenangan eksplisit: Kelola akun Pegawai (CRUD/status/profil/reset password tanpa perubahan fitur) dan Kelola akun Pegawai & akses fitur (ditambah delegasi non-HRIS). Delegator tidak wajib menggunakan Inventaris; tetap mengikuti modul aktif, organisasi dan cakupan lokasi/gudang. Tidak dapat mengelola HRD/Pimpinan/diri, memberi HRIS, atau menaikkan kewenangannya sendiri.
- Daftar dan pencarian Akun Organisasi hanya menampilkan akun selain akun yang sedang login; filter ini diterapkan di query data dan total, bukan hanya UI. Detail, edit, serta reset password akun sendiri melalui endpoint Akun Organisasi ditolak di service. Akun sendiri dikelola melalui Profil; Superadmin lain tetap dapat mengelola akun tersebut sesuai kewenangannya.
- Omission mempertahankan kewenangan/grant, none/array kosong mencabut eksplisit. Backend menerima grant identik pada koreksi akun tanpa hak delegasi; perubahan grant tetap ditolak. Pencabutan berlaku pada request berikutnya dan audit/version/rollback tetap wajib.
- Setiap fitur, izin, submenu dan cakupan wajib mempunyai uraian terpusat tentang kemampuan/batas. Tampilkan 1–2 kalimat sederhana dekat field aktif, minimal 8px dari control, justify dan line-height konsisten. Jangan hanya memakai tooltip/dropdown; jangan menjanjikan kemampuan yang belum ada. Jelaskan prasyarat kosong vs gagal dimuat sesuai izin.
- Ringkasan menghitung fitur sekali, bukan jumlah izin/gudang: satu chip +N fitur lainnya tanpa interaksi. Aksi Lihat hak akses membuka AppModal di level halaman agar pergantian tabel/kartu tidak menutupnya. Ikon semantik, chip selebar isi, gap 12–16px antarbaris dan 24px antarsection, status berlabel serta loading/error/kosong wajib tersedia.
- Migration 052 default flag nonaktif dan tidak mengubah rollout organisasi lama. Rekonsiliasi snapshot/menu/API membaca akses server terkini. Proses inti HRIS dan admin tunggal tidak berubah.

### Presentasi menu dan informasi hak akses

- Hak Akun Organisasi tampil dalam kelompok Akun & Akses di editor HRIS, dengan checkbox aktivasi. Saat aktif pilih Kelola akun Pegawai atau Kelola akun Pegawai & akses fitur; saat dinonaktifkan simpan none. Pengaktifan kembali default Kelola akun Pegawai, bukan delegasi fitur. Kontrak dan authority backend tetap.
- Menu tanpa CRUD seperti Laporan tidak memakai dropdown tingkat akses. Tampilkan label Hanya baca; checkbox memberikan/mencabut grant read. Dashboard adalah halaman dasar tanpa kontrol grant. Gunakan divider antarbaris dan uraian batas izin singkat.
- Login tetap /dashboard. Konten data mengikuti izin domain/submenu, bukan grant dashboard lama. HRD tanpa hak data melihat kartu terkunci dengan placeholder sintetis tanpa data; API mengirim DTO kosong tanpa dataset terlarang. Pegawai melihat ringkasan profil milik akun sendiri melalui endpoint self-service. Navigasi menu berizin tetap tersedia.

### Identitas modal transaksi

- Setelah jenis transaksi dipilih dan diterapkan pada form, judul/icon AppModal mengikuti katalog jenis transaksi. Status melanjutkan draft berada pada deskripsi, bukan menggantikan identitas jenis transaksi. Loading draft memakai judul jelas sampai data tersedia.
- Aksi rincian penyaluran memakai RelatedRecordAction; desktop di samping pilihan sumber, mobile tepat setelah pilihan sumber, dengan konteks singkat dan tombol semantik 44px. Preview tidak mengubah isian, draft, stok, atau dirty-state.

## Aktivasi Fitur Absensi organisasi

- Fitur Absensi memakai organization_modules code attendance dan diaktifkan hanya oleh Superadmin melalui Organisasi → Fitur organisasi. Tidak ada auto-aktivasi atau grant otomatis, termasuk organisasi existing. Cakupan saat ini Jadwal Kerja, Kalender Libur, Jadwal Pegawai dan pengaturan titik absensi. Cuti/izin terpisah.
- Aktivasi dan izin akun berbeda. Menu Absensi memakai grant HRIS baca/kelola serta scope existing. Admin HRD penuh tidak melewati aktivasi. Penonaktifan menutup menu/API tanpa menghapus jadwal, kalender, penetapan, histori atau grant. Pengaktifan kembali mengikuti grant yang masih berlaku.
- Seluruh service jadwal, penetapan onboarding dan endpoint absensi mendatang wajib memakai gerbang server requireAttendanceModule selain permission/objek/organisasi sesi. Mutation mengunci organisasi sebelum pemeriksaan modul dan sebelum lock target lain. Jangan mempercayai snapshot/flag mobile sebagai authorization. Login dan kontrak mobile existing tidak ikut dinonaktifkan.
- API modul bentuk lama tetap khusus Inventaris. Batch baru hanya kode allowlist, strict, atomik, audit dan version check. UI wajib membedakan loading/gagal/status nonaktif dan mempertahankan isian saat gagal. Kontrak serta migration katalog 068: docs/work-schedules.md dan database/migrations/README.md.

## Presentasi Data Master dan daftar Organisasi

- Organisasi ditampilkan dalam kelompok Kepegawaian bersama Lokasi hingga Jadwal Kerja pada Data Master, tanpa pemisah Platform atau Kepegawaian ganda. Gunakan metadata sidebarGroup untuk presentasi. Jangan mengubah access.kind=platform, role, assignable atau guard Organisasi demi layout. Filter izin tetap dijalankan sebelum pengelompokan.
- Tabel Organisasi memisahkan kode, nama, lokasi aktif, akun HRD, akhir akses, status akses dan status tiap fitur. Jangan menumpuk nama, kode serta nama resmi dalam satu sel, atau menyebut hitungan lokasi/admin sebagai kesiapan onboarding. Rincian identitas/periode tetap pada form existing. Status modul berbeda dari akses organisasi.
- Ikon aksi organisasi memakai keluarga outline yang sama dengan aksi lain melalui RowActionMenu, Kelola fitur memakai SettingOutlined. Kode/status panjang menggunakan CompactInfoChip wrap, kartu mobile menggunakan ReportCardFields stacked serta footer aksi berlabel. Kedua varian bersifat opt-in agar pemakai lain tetap kompatibel. Acuan docs/ui-ux-guidelines.md dan katalog komponen.

## Sebutan Admin SITOU dan pilihan izin fitur

- Seluruh teks yang dibaca pengguna, label role, pesan API, notifikasi dan bantuan memakai **Admin SITOU**, bukan Superadmin. Kode role `superadmin`, konstanta, permission, error code dan pemeriksaan otorisasi tetap dipertahankan.
- Pilihan izin Absensi pada form akun HRD tetap terlihat ketika fitur nonaktif, tetapi checkbox dan tingkat aksesnya dinonaktifkan. Tampilkan pesan merah yang menyebut Fitur Absensi belum aktif dan meminta pengguna menghubungi Admin SITOU. Pilih semua hanya mengubah menu yang dapat dipilih dan tidak boleh menghapus atau menambah izin menu terkunci. Izin lama tetap tersimpan. Aktivasi tidak otomatis memberi izin baru. Menu Absensi baru, termasuk mobile mendatang, wajib terdaftar pada katalog gerbang fitur bersama serta diperiksa di server.
