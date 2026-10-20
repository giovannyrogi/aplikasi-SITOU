# Pemulihan sanksi dan penghapusan kasus

## Pemulihan setelah pencabutan

Migration `063` menyimpan hubungan penggantian pada
`disciplinary_action_replacements`, dengan foreign key organisasi dan pegawai.
Saat penerbitan mengganti sanksi berjalan, hubungan pendahulu–pengganti ditulis
dalam transaksi penerbitan yang sama.

Saat pengganti dicabut, server menelusuri seluruh rantai penggantian yang tercatat.
Hanya satu pendahulu terdekat berstatus `superseded` yang tanggal berlakunya masih
mencakup hari ini menurut zona waktu organisasi yang dipulihkan. Jika pendahulu
langsung sudah berakhir atau dicabut, penelusuran berlanjut ke pendahulunya;
sanksi dicabut tidak ikut diaktifkan. Pada jarak sama, tanggal terbit dan ID terbaru
menjadi pembeda. ID yang telah dilalui tidak ditelusuri ulang untuk mencegah siklus.
Pemulihan tidak dilakukan bila ada keputusan lain yang masih berjalan. Tanggal
awal, tanggal akhir, surat, dan snapshot keputusan tidak diubah. Sanksi yang tidak
memiliki hubungan tercatat tidak ditebak dari tanggal atau nama.

`GET /api/discipline/actions/:id/revoke` memberikan pratinjau berizin
`discipline.manage`, organisasi, dan scope pegawai. Form alasan sementara ditutup
saat ConfirmDialog menampilkan kartu **Akan dicabut** dan **Berlaku kembali**.
Batal mengembalikan form beserta alasan yang sudah diisi.

POST mengirim `restorationActionIds` yang telah ditinjau. Server mengunci pegawai
serta keputusan, menghitung ulang kandidat, dan menolak konfirmasi usang dengan
409. Pencabutan, pemulihan, serta audit `disciplinary_action.revoke` dan
`disciplinary_action.restore` bersifat atomik. Respons privat memakai no-store.

Backfill hanya memakai audit penerbitan dan penggantian yang dapat dipasangkan
secara pasti melalui organisasi, pegawai, pelaku, dan request ID. Hubungan tidak
ditebak dari tanggal. Pencabutan yang sudah terjadi sebelum migration tidak
diubah secara otomatis. Laporan sanksi terbaru tetap dapat menampilkan keputusan
terbaru yang dicabut; keputusan berjalan dibaca dari status aktif dan periodenya.

## Hapus kasus tanpa tindakan

`DELETE /api/discipline/cases/:id` memerlukan `discipline.manage`, validasi asal
request, organisasi, dan scope pegawai. Tombol **Hapus kasus** hanya muncul bila
kasus tidak memiliki tindakan, termasuk draft. Server memeriksa ulang kondisi
tersebut di dalam transaksi; menyembunyikan tombol bukan kontrol keamanan.

Penghapusan menggunakan `deleted_at` dan `deleted_by_user_id`. Nomor kasus serta
audit `discipline_case.delete` tetap tersimpan. Kasus yang dihapus tidak muncul
pada daftar, detail, histori pegawai, konteks penerbitan, dan indikator dashboard.
Nomor kasus tidak digunakan ulang. Penguncian pegawai lalu kasus menyelaraskan
penghapusan dengan penerbitan sehingga kasus bertindakan tidak dapat terhapus
akibat request bersamaan.

## Urutan dan nomor kasus — migration 064

Daftar kasus serta tab Disiplin pegawai diurutkan berdasarkan `opened_at DESC,
id DESC`, sehingga kasus baru berada paling atas meskipun tanggal kejadiannya
lebih lama. Riwayat sanksi tetap berdasarkan tanggal penerbitan dan ID terbaru.
Pencabutan tidak mengubah posisi kasus atau waktu pencatatannya.

`discipline_case_number_counters` menyimpan angka terakhir per organisasi dan
tahun pencatatan dari zona waktu organisasi. UPSERT atomik di transaksi pembuatan
kasus menserialisasi alokasi nomor bersamaan. Counter awal diisi dari suffix
tertinggi pada nomor lama, termasuk kasus terhapus, bukan jumlah kasus ataupun
tahun kejadian. Nomor lama tidak diubah. Koreksi tanggal kejadian serta penghapusan
tidak menurunkan counter. Organisasi berbeda dapat menggunakan nomor tampilan
yang sama; identitas kasus tetap dipisahkan organisasi dan ID, dengan constraint
`UNIQUE(organization_id,case_no)` sebagai pertahanan terakhir.

Di VPS, hentikan sementara penulisan kasus selama pembaruan, jalankan migration
063 jika belum diterapkan, lalu 064 sebelum menjalankan kode baru. Jangan jalankan
ulang migration yang sudah diterapkan. Migration tidak memulihkan pencabutan lama
secara otomatis. Hubungan lama tetap bergantung pada audit yang dapat dibuktikan
oleh backfill 063; perubahan ini tidak menyimpulkan hubungan yang hilang.

## Verifikasi

Pengujian integrasi memakai database QA sementara dari bootstrap schema lengkap:
hubungan penggantian, pemulihan dengan tanggal asli, penolakan konfirmasi usang,
pendahulu kedaluwarsa, penolakan hapus kasus draft/resmi, isolasi organisasi,
penyembunyian kasus terhapus, audit, dan persaingan hapus–penerbitan. Database QA
dihapus setelah pengujian. Migration development diterapkan melalui runner;
lingkungan lain tetap harus menjalankan migration yang belum tercatat.

Pemeriksaan browser pada lebar 320, 375, 768, 1024, 1366, dan 1920 piksel
memverifikasi satu modal, tidak ada overflow horizontal, tombol konfirmasi,
batal mempertahankan alasan tanpa mutasi, pengiriman ID pemulihan yang ditinjau,
serta tombol hapus hanya untuk kasus kosong. Mutasi browser dicegat dengan data
sintetis; data bisnis tidak diubah. Build produksi dan lint diperiksa terpisah.
API nyata juga diperiksa untuk pratinjau berizin dengan no-store, organisasi
yang salah (404), serta penolakan akses Pimpinan dan Pegawai sebelum mutasi.
Kolom, constraint, dan index tambahan pada database development hasil upgrade
dibandingkan dengan bootstrap kosong dan terbukti ekuivalen.

Verifikasi lanjutan 064 menggunakan database upgrade berisi kasus sintetis dan
database bootstrap kosong: struktur counter/constraint/index ekuivalen dengan
database lokal; suffix tertinggi kasus terhapus dipertahankan; nomor antarorganisasi
terpisah; koreksi tanggal lintas tahun dan 12 pembuatan bersamaan tidak menghasilkan
duplikat; kedua daftar kasus menampilkan pencatatan terbaru lebih dahulu. Alur
penerbitan SP1–SP2–SP3 dan pencabutan bertahap diuji melalui service sebenarnya.
Uji rantai melewati pendahulu kedaluwarsa/dicabut, mengabaikan histori tak terkait,
mencegah siklus, menolak konfirmasi usang serta organisasi lain, dan membuktikan
dua pencabutan bersamaan hanya menghasilkan satu pemulihan/audit. Tanggal asal
tetap sama. Database QA dibuang setelah pengujian.

Browser memeriksa urutan kartu dan modal SP3→SP1 pada enam lebar viewport yang
sama, tanpa overflow atau warning runtime/deprecated. Batal mempertahankan alasan;
mutasi browser dicegat. Tidak ada penyesuaian status data lokal lama atau data VPS
sebagai bagian pengujian ini.
