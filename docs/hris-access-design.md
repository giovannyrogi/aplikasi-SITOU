# Hak akses menu HRIS

## Model

Satu membership tetap memiliki satu role dasar. Administrasi HRIS hanya diberikan
kepada role HRD; Pegawai tetap memakai self-service dan akses Inventaris terpisah.
Superadmin menetapkan satu admin HRD penuh aktif per organisasi melalui modal
Tambah/Edit akun organisasi. Akun HRD aktif pertama yang dibuat Superadmin menjadi
admin penuh; pada organisasi lama penetapan dilakukan secara eksplisit.

Admin penuh membaca/mengelola seluruh menu HRIS yang terdaftar, seluruh lokasi,
serta akun HRD, Pimpinan, dan Pegawai. Hanya Superadmin boleh mengalihkan admin.
Admin penuh membagikan submenu dan tingkat Lihat Saja/Kelola kepada HRD lain pada
modal akun yang sama. Cakupan lokasi tetap satu per akun HRD, mengikuti aturan
lama. Inventaris dan fitur mendatang tidak otomatis diperoleh dari admin penuh.

## Menu dan sensitivitas

Katalog `HRIS_MENUS` berasal dari menuCatalog.mjs dan mempertahankan kode Dashboard
lama untuk kompatibilitas, tanpa menjadikannya grant data. Tiga belas submenu
HRIS yang dapat diberikan: Lokasi, Jenis Unit
Organisasi, Divisi & Unit, Jabatan, Jenis Kepegawaian; Data Pegawai, Cuti & Izin;
Kontrak Akan Berakhir, Proyeksi Pensiun, Sanksi Pegawai; Aturan Cuti & Izin,
Pengaturan Sanksi, Kebijakan Pensiun. Dashboard adalah halaman dasar; laporan hanya Lihat Saja;
submenu lain dapat Lihat Saja atau Kelola. Akun Organisasi dapat didelegasikan
terbatas ke akun Pegawai sesuai migration 052 di bawah.

Data Pegawai mencakup profil, identitas/KTP/KK, rekening, kontrak, penempatan,
pendidikan, dokumen dan disiplin sesuai proses yang sudah ada. Form menjelaskan
dampak ini. Cuti & Izin dan Akun pada detail Pegawai tetap mengikuti kewenangan
terpisah. Lampiran izin tidak memberikan hak membuka identitas privat. Foto
referensi dan surat sanksi hanya dibaca pada konteks berizin. Payroll belum ada
dan kelak harus mempunyai permission/katalog tersendiri.

Lihat Saja tidak menampilkan aksi perubahan dan backend menolak mutation/import
atau ekspor profil penuh. Ekspor laporan tetap bagian izin baca laporan tersebut.
Dashboard selalu menjadi halaman login; tanpa hak statistik hanya header tampil.

## Penyimpanan, API, dan rollout

Migration `051` menambah:

- `organization_hris_access_policies`: satu admin penuh, status konfigurasi, versi.
- `hris_menu_definitions`: katalog sistem bersama, tanpa organization_id.
- `user_hris_menu_grants`: level per submenu dan membership organisasi.
- `user_hris_access_settings`: penanda peninjauan eksplisit, termasuk grant kosong.

Grant dan penanda memakai composite FK membership organisasi. Kolom bisnis lama
tidak diubah. Schema bootstrap mencerminkan migration; database berjalan memakai
migration, bukan menjalankan ulang schema.

Endpoint akun menerima `isHrisAdmin`, `hrisPolicyVersion`, dan
`hrisMenuAccess: [{key,level}]`. Omission grant mempertahankan nilai lama saat
update; array kosong mencabut eksplisit. Penetapan admin memakai versi kebijakan,
sedangkan edit akun tetap memakai version akun. DTO akun menambah `hrisAccess`;
reference-options menambah kemampuan penetapan/status/versi; `/api/access/me`
memuat snapshot `hris` terbaru. Response tetap private/no-store.

Migration sendiri tidak mengaktifkan pembatasan pada organisasi lama. Sampai
Superadmin menunjuk admin penuh, hak HRD lama tetap berlaku. Pada aktivasi pertama,
hak menu bisnis HRD lama dipertahankan sebagai grant eksplisit kecuali telah
ditinjau sebelumnya. Setelah itu hanya satu admin penuh mengelola akun/delegasi;
admin perlu meninjau dan mengurangi grant lama sesuai tugas setiap akun.

Backend membaca membership/policy/grant terbaru setiap request. Proxy menimpa
header konteks path/method; session/browser bukan sumber izin. Sidebar, halaman,
API dan file kategori menerapkan guard yang konsisten. Account mutation mengecek
ulang kewenangan di transaksi dengan lock organisasi, version dan audit
`hris.admin.assign` / `hris.menu.update`. Transfer tidak menghapus grant akun lama;
akun itu kembali mengikuti grant tersimpan dan cakupannya.

Admin penuh tidak dapat dinonaktifkan, diturunkan role/cakupannya, atau diakhiri
hubungan kerjanya sebelum dialihkan melalui Superadmin. Guard lifecycle ini telah
disetujui; perhitungan, penutupan histori, tanggal dan alur HRIS lain tetap berlaku.

## UI dan pengujian

Form memakai satu bagian Akses fitur dengan blok HRIS dan Inventaris. HRIS memakai
kelompok menu yang dapat dilipat, checkbox submenu dan tingkat akses. Ringkasan
tabel hanya satu chip fitur +N fitur lainnya; rincian melalui Aksi → Lihat hak akses,
tanpa menumpuk seluruh grant di tabel. Gunakan layout responsif, teks sederhana,
justify untuk bantuan, spacing dan komponen SITOU yang sudah ada.

`tests/hris-access.test.mjs` memeriksa resolver/schema. Runner
`npm run test:inventory:http` mencakup bootstrap/upgrade 051–052, regresi Inventaris,
delegasi HRD, read/manage, URL langsung, spoof header, isolasi organisasi,
rollback/version, pencabutan session aktif, transfer admin, guard lifecycle,
serta UI 320–1920px di database terpisah.

Deploy migration 051–052 sebelum web baru. Smoke test dengan akun uji: Superadmin
menetapkan admin, admin memberikan submenu kepada HRD lain, verifikasi login/menu,
aksi baca/perubahan, lalu cabut hak saat sesi masih aktif. Jangan memberi akses
nyata otomatis selama pengujian.

## Delegasi akun Pegawai — migration 052

Tambahan pada user_hris_access_settings: can_manage_employee_accounts dan
can_delegate_employee_features, default false, dengan CHECK delegasi memerlukan
pengelolaan akun. HRIS_ACCOUNT_ACCESS API opsional memakai hrisAccountAccess:
none/manage/manage_and_delegate. Omission mempertahankan; perubahan diaudit sebagai
hris.account_access.update. DTO hrisAccess memuat accountAccess dan flags; snapshot
serta reference-options memuat canManageAccounts, canDelegateNonHris, canGrantHris,
dan canManageAllAccountRoles. Target non-HRD tidak memperoleh kewenangan ini.

Superadmin/admin penuh memberi dua pilihan: Kelola akun Pegawai (CRUD, status,
profil, reset password tanpa perubahan fitur), atau Kelola akun Pegawai & akses
fitur (ditambah pemberian/pencabutan non-HRIS). HRD terdelegasi hanya target Pegawai
dalam cakupannya, tidak HRD/Pimpinan/diri. Izin delegasi tidak mensyaratkan pemakaian
Inventaris. Modul harus aktif; HRD selected tidak memberikan master/all atau gudang
luar lokasi. HRIS tetap khusus pemberi Superadmin/admin penuh dan target HRD.
Pengelola tanpa delegasi dapat mempertahankan grant identik pada koreksi akun;
perubahan grant termasuk pencabutan ditolak. Kewenangan diperiksa ulang dalam
transaksi dan pencabutan berlaku pada session aktif. Rollout legacy tetap sama.

FeatureAccessFields hanya mengatur presentasi; featureModules tidak dikirim ke API.
Setiap pilihan memiliki uraian terpusat di accessDescriptions.mjs/featureLabels.mjs:
kemampuan, batas dan cakupan, 1–2 kalimat dekat field dengan jarak aman. Rincian
mengelompokkan HRIS per menu dan Inventaris per izin/scope, ikon semantik, chip
selebar isi, status aktif/nonaktif, identitas akun dan state loading/error/kosong.
AccountAccessDetails berada di level halaman agar tidak tertutup saat breakpoint
berubah. Halaman operasional Inventaris masih header; jangan menjanjikan posting
stok, approval, atau payroll yang belum tersedia.

Pada request legacy yang mengubah hanya hrisAccountAccess, menu yang belum pernah
ditinjau dipertahankan sebagai snapshot grant lama sebelum penanda settings dibuat.
Request tersebut tidak dianggap pencabutan menu. Peninjauan menu eksplisit kosong
yang sudah tercatat tetap dipertahankan; hak baru tidak diberikan otomatis.

### Pengelompokan Akun & Akses dan menu hanya baca

Akun Organisasi berada dalam kelompok Akun & Akses pada HRIS, dengan checkbox dan
dua mode aktif. Off menghasilkan hrisAccountAccess=none; on kembali default manage.
Tidak ada penambahan kode menu/grant atau migration: capability akun tetap terpisah
dari hrisMenuAccess. Dashboard/laporan tidak menampilkan dropdown satu pilihan;
chip Hanya baca menjelaskan tipe menu. Divider memisahkan submenu dan
AccessExplanation memperjelas informasi menu serta batas izin.
Login tetap /dashboard; isi mengikuti izin domain/submenu. Akun tanpa hak data
menerima header saja, menu berizin tetap dapat dinavigasi dan API mengirim DTO kosong.

## Dashboard dasar dan editor akses responsif

Dashboard selalu tersedia sebagai halaman awal, tanpa pilihan grant pada editor.
Grant dashboard historis tetap diterima untuk kompatibilitas, tetapi tidak memberi
hak statistik atau dikonversi menjadi akses lain. MENU_DEFINITIONS/MENU_LEAVES
pada lib/access/menuCatalog.mjs menjadi katalog bersama sidebar, editor, evaluator
dan schema; menu baru wajib memiliki jenis izin, scope, delegasi dan penjelasan.
Validasi katalog otomatis menolak definisi yang belum lengkap.

Form submenu ditata vertikal: nama/checkbox, kontrol tingkat bila ada, lalu batas
izin singkat. Tidak ada section Informasi menu. Track minmax(0,1fr), min-width:0,
control maksimal 100% dan pilihan popup yang dapat wrap mencegah overflow tanpa
memotong halaman. HRIS/Inventaris memakai Collapse fitur dengan ringkasan, tombol
buka/tutup kanan; fitur baru dibuka, edit membuka HRIS atau fitur pertama. Cabut
akses berada di bawah setelah divider, merah solid. Lipatan adalah state UI saja;
nilai tetap tersimpan, tidak menandai dirty, dan error membuka section terkait.

Backend Dashboard membaca izin efektif dari sumber server. Data Pegawai membuka
komposisi/penempatan/perkembangan/kelengkapan/ulang tahun; kontrak terbuka bagi
Data Pegawai atau laporan kontrak, pensiun bagi Data Pegawai atau laporan pensiun,
disiplin bagi Data Pegawai atau laporan sanksi. Cuti hanya hak Cuti & Izin. Akun
master/akun/Inventaris saja atau tanpa hak data menerima header saja. Pegawai tetap
header. Tidak menambahkan statistik Inventaris pada tahap ini.

DTO /api/dashboard/summary menambah sections; field employeeSummary,
birthdaySummary, retirementSummary dan recentDiscipline hanya dikirim bila berizin.
metrics/charts parsial; section tanpa izin tidak diwakili nol palsu. Snapshot
/api/access/me menambah dashboardDefault dan dashboardSections. Query yang tidak
diperlukan dilewati, aktivitas/prioritas difilter sebelum LIMIT, link tujuan tanpa
izin dihilangkan. Cache mencakup organisasi, role, scope, rentang, kebijakan dan
fingerprint izin/capability. Rumus/rentang/timezone/lifecycle HRIS tetap.

Uji permission kombinasi, session aktif/cache dua akun, legacy Dashboard,
Superadmin/Pimpinan/Pegawai, form panjang 320–1920px, zoom 200%, keyboard,
penyimpanan section terlipat dan query plan memakai database terpisah. Tidak ada
perubahan schema atau migration baru.

Menu baru dengan kode grant baru tetap harus menambah seed hris_menu_definitions
melalui migration serta schema bootstrap. Katalog UI bersama tidak menggantikan
permission backend, registrasi API, audit, atau composite FK organisasi. Dataset
Dashboard ditambahkan bersama permission sumbernya, tidak terbuka otomatis.
