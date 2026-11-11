# Query dan laporan Pegawai

### Laporan kontrak dan proyeksi pensiun

- Dashboard, daftar laporan, dan ekspor wajib memakai service/filter laporan bersama serta tanggal acuan dari timezone organisasi. Usia pensiun wajib membaca `organization_retirement_policies`, tidak memakai konstanta global. Organisasi lama mendapat kebijakan awal 58 tahun dari migration 027; organisasi baru wajib mengaturnya. Perubahan wajib beralasan, terkonfirmasi, menggunakan version check dan audit append-only; hanya HRD/Superadmin dengan permission khusus dapat menyimpan. Pimpinan membaca. Kebijakan belum tersedia wajib ditampilkan jelas, bukan dianggap nol pegawai. Cache/cursor mengikuti versi kebijakan. Tanggal 29 Februari menjadi 28 Februari pada tahun nonkabisat. Laporan tidak otomatis mengakhiri hubungan kerja.

- Default pensiun adalah 12 bulan ke depan dan kontrak 30 hari ke depan, inklusif. Kelompok sudah lewat tidak dibatasi periode masa depan. Tahun ini/rentang sendiri dapat mencakup tanggal lewat dan mendatang; tanggal lahir bermasalah tidak difilter tanggal proyeksi.

- Hanya pegawai aktif, masa percobaan, atau ditangguhkan yang tidak dihapus logis masuk laporan. Kontrak tanpa tanggal akhir, draft, dibatalkan, terminated, atau histori yang sudah digantikan tidak boleh dianggap tunggakan perpanjangan.

- Laporan dan ekspor wajib memeriksa permission, organisasi, dan cakupan lokasi yang sama. HRD bercakupan lokasi tidak mendapat akses tambahan pada pegawai tanpa penempatan. Superadmin memilih satu organisasi secara eksplisit.

- Excel memuat seluruh hasil filter, maksimal 5.000 baris; kelebihan batas harus ditolak tanpa pemotongan diam-diam. NIP/nomor kontrak berupa teks literal, tanpa NIK/dokumen privat; ekspor diaudit dan memakai no-store.

- Definisi dan prosedur uji terdapat pada `lib/reports/README.md`. Perhitungan adalah data turunan, bukan kolom baru.

Aturan wajib:

- Hindari `SELECT *` pada API.

- Semua list memakai keyset pagination bila data besar; offset hanya untuk master kecil.

- Filter **Ditambahkan oleh** pada daftar pegawai wajib berasal dari audit append-only `employee.create`, dibatasi organisasi dan scope lokasi actor. Dilarang menambah kolom pembuat yang dapat ditimpa pada profil pegawai hanya demi kebutuhan filter.

- Filter organisasi dan rentang tanggal harus berada di query SQL.

- Hindari N+1; gunakan join/batch query.

- Dashboard membaca view/rekap dan cache singkat bila tidak harus real-time.

- Export besar dijalankan background job dan menghasilkan file privat.

- Jangan menambah index untuk setiap kolom. Tambah index berdasarkan query nyata.

- Sebelum merge query penting, uji `EXPLAIN (ANALYZE, BUFFERS)` dengan data representatif.

- Pantau `pg_stat_statements`, koneksi, lock, autovacuum, dead tuples, cache hit, dan pertumbuhan index.

Index utama sudah disiapkan untuk:

- pencarian nama pegawai dengan trigram;

- daftar pegawai aktif per organisasi;

- penempatan aktif dan histori;

- kontrak akan berakhir;

- event per pegawai/waktu dan event perlu tinjau;

- rekap per tanggal/status, ranking terlambat, dan histori pegawai;

- izin menunggu dan histori izin;

- indikator/kasus/tindakan disiplin;

- audit dan outbox.

Gunakan connection pool. Banyak instance/serverless memerlukan pool eksternal seperti PgBouncer. Transaksi harus singkat; jangan melakukan upload atau network call di dalam transaksi database.
