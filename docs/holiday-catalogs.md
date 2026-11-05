# Katalog hari libur dan kalender organisasi

## Sumber dan pemisahan

Libur mingguan berasal dari hari kerja pada jadwal. Katalog platform menyediakan referensi tanggal **Libur nasional** dan **Cuti bersama**. HRD memilih tanggal yang berlaku pada kalender organisasi dan dapat menambah **Libur organisasi** secara manual. Kalender lama tidak berubah oleh instalasi katalog, publikasi, atau revisi. Memilih cuti bersama tidak membuat permohonan cuti dan tidak menulis ledger saldo.

Data bawaan migration 069 diverifikasi terhadap lampiran SKB pemerintah, bukan perkiraan kalender atau API eksternal:

- [SKB 2026, lampiran halaman 3–4](https://www.kemenkopmk.go.id/sites/default/files/pengumuman/2025-09/SKB%20Libur%20Nasional%20dan%20Cuti%20Bersama%20Tahun%202026.pdf): nomor 1497/2025, 2/2025, 5/2025; 17 tanggal nasional dan 8 cuti bersama.
- [SKB 2027, lampiran halaman 4–5](https://kemenkopmk.go.id/sites/default/files/pengumuman/2026-09/SKB%20Libur%20Nasional%20dan%20Cuti%20Bersama%20Tahun%202027.pdf): nomor 1205/2026, 3/2026, 2/2026; 18 tanggal nasional dan 8 cuti bersama. Dua Isra Mikraj pada 5 Januari dan 26 Desember tetap merupakan dua tanggal resmi.

Tahun Baru selalu tercantum 1 Januari; 31 Desember tidak ditambahkan sebagai libur nasional. Nama ditulis dengan ejaan UI yang konsisten tanpa mengubah tanggal atau kategori resmi. Publikasi awal berpelaku sistem (`system_seed`, actor audit NULL), bukan identitas manusia rekaan.

## Prosedur Admin SITOU

**Gunakan dan simpan draft** pada pengisian otomatis langsung membuka **Tinjau katalog** dari versi yang tersimpan, dengan metode otomatis tetap terpilih. Publikasi tetap memerlukan konfirmasi. Pengisian manual tetap menyimpan draft sebelum membuka tinjauan.

Pemeriksaan tahun dilakukan sebelum mengambil data dari sumber, lalu diulangi dalam transaksi simpan dan terbitkan. Jika draft sudah ada, buka draft tersebut. Jika tahun sudah terbit, gunakan **Edit katalog** pada katalog terbaru. Tanggal tersimpan tampil sebagai panel lipat per tanggal. Jika Ambil data terbaru dipilih saat mengedit, hasil langsung mengisi panel dan baru disimpan lewat aksi simpan. Buka panel untuk mengubah tanggal, nama atau kategori, atau gunakan ikon sampah di header untuk menghapus tanggal dari form. Perubahan daftar masuk ke versi baru saat disimpan. Pada tahap tinjauan, **Simpan perubahan** langsung menerbitkan versi baru dalam satu transaksi. Daftar utama menampilkan satu katalog per tahun. Pilih **Semua revisi dan draft** untuk melihat histori dan draft lama. Publikasi ditolak jika acuan berubah atau isi tanggal, kategori, nama, nomor keputusan dan URL sumber sama dengan katalog terbit terbaru. Revisi sebelumnya tetap terbaca sebagai **Riwayat revisi**. Draft lama tanpa acuan tidak dapat diterbitkan untuk tahun yang sudah terbit; salin koreksi yang masih diperlukan sebelum menghapus draft melalui alur resmi dan membuat revisi dari katalog terbaru.

Kelompok Libur nasional dan Cuti bersama pada detail/tinjauan katalog, hasil sumber API/OCR serta pemilih kalender memakai Collapse yang awalnya tertutup. Jumlah tanggal dan pilihan tetap terlihat pada header. Buka kategori untuk membaca tabel/kartu atau memilih tanggal; menutupnya tidak menghapus pilihan atau mengubah data.

Form draft dimulai dengan dua pilihan **Ambil otomatis** atau **Input manual + PDF**. Pilihan otomatis menampilkan tahun dan tindakan Ambil data terbaru. Pilihan manual menampilkan bagian Dokumen SKB (FileUploadField bersama), Identitas keputusan, Tanggal hari libur dan pemeriksaan PDF. Bagian tanggal memiliki keadaan kosong, penghitung batas 366, serta aksi tambah/hapus berikon dengan nama aksesibel. Pilihan metode tidak menghapus isian.

Tahun katalog menentukan tahun sumber yang diambil dan tahun seluruh tanggal pada revisi. Katalog baru memakai pemilih tahun saja: tahun berjalan dan mendatang dapat dipilih, tahun sebelumnya disabled. Tahun draft/revisi existing tetap ditampilkan dan dikunci agar histori tidak berpindah tahun. Ini pembatasan pilihan form, bukan penghapusan akses katalog lama. Entri manual dapat dilipat per tanggal; judul mengikuti tanggal yang dipilih beserta nama dan kategori. Baris baru terbuka, isian tertutup tetap disimpan dan divalidasi, serta panel gagal terbuka kembali. Penjelasan Data otomatis memakai AppNotice bersama.

PDF yang selesai dibaca tidak mengisi atau menyimpan tanggal secara otomatis. Admin boleh mengisi tanggal sendiri, atau Tinjau hasil pembacaan → Gunakan hasil pembacaan untuk mengganti isian setelah mencocokkan perbedaannya. Simpan draft tetap terpisah, lalu Tinjau katalog → Terbitkan. PDF sah menggantikan kewajiban tautan pemerintah; pengisian lewat tautan resmi lama tetap kompatibel. Rincian alur dan setup OCR: `docs/holiday-pdf-import.md`.

1. Buka **Data Master → Katalog Hari Libur**, khusus Superadmin. Pilih tahun atau buat katalog baru. Tahun yang belum tersedia tidak diisi dari tahun sebelumnya.
2. Pilih **Ambil data terbaru** untuk mengisi satu tahun sekaligus dari Indonesian Holidays. Tahun, tanggal, nama, kategori, nomor keputusan dan tautan SKB diperiksa server. Tinjau tambahan/perubahan/penghapusan terhadap isian sekarang, lalu **Gunakan dan simpan draft**. Kembali ke draft mempertahankan isian sebelumnya. Pengambilan gagal atau tahun belum tersedia tidak menghapus isian maupun katalog tersimpan.
   Pengisian manual tetap tersedia: isi nomor keputusan, tautan HTTPS pemerintah berakhiran domain `.go.id`, tanggal, nama dan kategori. Satu tanggal hanya sekali, maksimal 366 tanggal per revisi, seluruhnya dalam tahun yang sama (2000–2200).
3. Cocokkan setiap tanggal, kategori dan nama dengan lampiran keputusan resmi. Tautan disimpan sebagai referensi; server tidak mengambil URL pengguna dan tidak melakukan sinkronisasi eksternal saat GET.
4. **Simpan draft**, kemudian **Tinjau katalog**. Perubahan belum disimpan memblokir publikasi. Kembali ke draft mempertahankan isian.
5. **Terbitkan katalog** meminta konfirmasi. Publikasi mengikat versi yang telah ditinjau, menyimpan pelaku/waktu/audit dan menjadi referensi baca HRD. Katalog terbit dan tanggalnya dilindungi trigger database dari perubahan. Penghapusan hanya melalui pemeriksaan belum pernah digunakan pada bagian Penghapusan permanen.
6. Jika SKB berubah, pilih **Edit katalog**, tinjau sumber dan tanggal, lalu pilih **Simpan perubahan**. Revisi lama tetap tersimpan. Draft lama yang identik dapat dipakai dalam transaksi simpan, sementara draft dengan perubahan perlu ditinjau secara eksplisit.

Pembaruan tahunan adalah tugas Admin SITOU melalui UI, dengan pengisian otomatis melalui tombol atau pengisian manual. Tidak memerlukan rilis aplikasi atau penulisan SQL manual. Tidak ada scheduler pengambilan otomatis pada tahap ini. Katalog belum tersedia ditampilkan jelas kepada HRD.

## Pengambilan data setahun

Sumber pihak ketiga adalah [Indonesian Holidays](https://github.com/ahrulsyamil/indonesian-holidays), endpoint tetap `https://indonesian-holidays.ahrulsyamil.com/holidays/{year}`. Sumber ini menyediakan kategori national_holiday/joint_leave dan metadata SKB. Sumber resmi keputusan tetap tautan pemerintah; data pihak ketiga wajib ditinjau Admin sebelum diterbitkan. Data 2026 berhasil diambil saat verifikasi implementasi, sedangkan respons penyedia 2027 masih kosong meskipun katalog bawaan SITOU 2027 sudah tersedia. Kekosongan penyedia tidak dianggap pembatalan keputusan dan tidak mengosongkan katalog SITOU.

Pengambilan hanya melalui POST Superadmin, maksimal 5 permintaan per menit per akun/IP. Browser mengirim tahun saja, tanpa URL bebas. Server memakai domain tetap, menolak redirect, batas waktu 15 detik dan respons maksimal 256 KiB. Validasi memeriksa JSON, tahun/count, kategori, konsistensi penanda nasional, tanggal valid dalam tahun yang sama, duplikasi, batas 366 dan sumber SKB HTTPS pemerintah. Data satu tanggal dengan beberapa kategori ditolak untuk peninjauan manual, bukan digabung/dihilangkan diam-diam.

Respons hanya mengisi tahap pratinjau dalam AppModal yang sama. Data lama tidak berubah sampai Admin memilih **Gunakan dan simpan draft**; tindakan ini mengganti seluruh tanggal dan metadata sumber draft melalui API simpan existing dengan optimistic version, receipt, transaksi dan audit. Pratinjau tanggal ditambah/diubah/dihapus memakai isian form saat pengambilan, termasuk perubahan yang belum disimpan. Setelah simpan otomatis, modal langsung membuka Tinjau. Publikasi tetap melalui konfirmasi Terbitkan, dan katalog terbit tetap immutable. Tidak ada pengambilan eksternal saat GET kalender, login, pergantian tahun atau resolusi jadwal.

Pengambilan berhasil diaudit sebagai `holiday_catalog.source_preview`, dengan pelaku, tahun, penyedia/URL tetap, waktu server, digest SHA-256, sumber SKB dan hasil normalisasi berstatus `preview_only`. Ini bukti pengambilan, bukan klaim hasil sudah disimpan atau sudah diverifikasi pemerintah. Simpan/publikasi tetap memiliki audit terpisah. Gagal mengaudit pratinjau membatalkan respons pengambilan; gagal menyimpan mempertahankan pratinjau dan isian agar dapat dicoba lagi. Riwayat tersimpan dapat digunakan ketika penyedia tidak tersedia.

## Prosedur HRD

1. Fitur Absensi organisasi harus aktif dan akun memiliki akses baca/kelola Kalender Libur. Admin HRD penuh tetap mengikuti gerbang fitur. Katalog global dapat dibaca hanya melalui konteks organisasi yang sah.
2. Buka Kalender Libur, buat atau edit kalender. Isi nama, lalu **Tambahkan dari katalog**. Ini tahap dalam AppModal yang sama, bukan modal bertumpuk; isian form dipertahankan.
3. Tahun awal mengikuti tanggal saat ini di zona organisasi. Libur nasional hari ini/mendatang yang belum tercatat dipilih awal. Cuti bersama tidak dipilih awal. Tanggal lampau terkunci. Tanggal yang sudah ada, termasuk tanggal manual, tidak ditimpa atau digandakan.
4. Periksa kategori, tanggal, sumber SKB, dan jumlah pratinjau. **Tambahkan ke form** hanya mengubah draft lokal. Isian resmi dari katalog tidak dapat diubah tanggal/namanya. Gunakan **Tambah libur organisasi** untuk tanggal manual.
5. Jika revisi terbaru berbeda dari tanggal katalog lama, pemilih menampilkan rincian perbedaannya. Kalender tidak diselaraskan otomatis. Untuk mengganti tanggal mendatang yang telah ada, hapus tanggal itu pada form, buka pemilih kembali, dan tinjau penggantinya. Tanggal lampau tetap tidak dapat diubah.
6. **Simpan kalender** memvalidasi dan menyimpan seluruh kalender dalam satu transaksi, termasuk asal tanggal, version check, audit dan receipt retry. Gagal menyimpan mempertahankan form. Versi usang memerlukan muat ulang, bukan penimpaan data orang lain.
7. Pilih kalender pada jadwal, kemudian pilih **Libur mengikuti kalender** atau **Tetap bekerja sesuai jadwal**. Tetapkan jadwal secara eksplisit kepada Pegawai. Tidak ada pewarisan berdasarkan agama, role, lokasi atau unit. Perubahan khusus pada tanggal tetap memiliki prioritas resolver existing.

Snapshot jadwal yang telah menjadi bukti tidak ditulis ulang. Katalog hanya dipakai saat menyalin tanggal ke kalender, bukan sumber runtime resolver absensi.

## Kontrak API

Semua respons memakai envelope SITOU, `private, no-store`, session server dan pesan aman. Mutation memakai origin guard, pembatasan payload/rate, schema strict, transaksi dan audit.

- `GET /api/system/holiday-catalogs?year=2027&page=1&pageSize=20` (tambahkan `view=history` untuk semua revisi dan draft): Superadmin saja. Tahun opsional; pagination maksimal 100. Mengembalikan revisi beserta tanggal, versi, sumber, status, penerbit dan jumlah. `search` kosong dan `status=all` diterima untuk kompatibilitas hook daftar bersama.
- `POST /api/system/holiday-catalogs/source`: Superadmin saja, body strict `{year:2026,id?:string,revisionOf?:string}`. Mengembalikan `{year,decisionNumber,sourceUrl,days,provider,providerUrl,fetchedAt,digest}` dalam envelope SITOU tanpa menulis draft/publikasi. `HOLIDAY_YEAR_UNAVAILABLE` (422) berarti penyedia belum memiliki data, `HOLIDAY_SOURCE_UNAVAILABLE` (503) berarti sumber tidak dapat dihubungi, dan `HOLIDAY_SOURCE_INVALID` (502) berarti respons tidak lolos pemeriksaan. Ketiganya mempertahankan data yang sudah ada. API simpan draft tetap memvalidasi isi hasil yang dipilih Admin dan tidak mempercayai provenance klien sebagai bukti resmi.
- `POST /api/system/holiday-catalogs`: `{operation:"save"|"publish"|"edit_published",requestKey:UUID,id?:string,version?:number,year:number,decisionNumber:string,sourceUrl:string,days:[{date:"YYYY-MM-DD",name:string,category:"national"|"joint_leave"}]}`. Tanpa id membuat draft tahun baru. `edit_published` menerima id dan versi katalog terbit terbaru dan langsung membuat versi terbit baru secara atomik. Edit/publikasi wajib versi sesuai. Publikasi memerlukan id dan isi yang persis sama dengan draft tersimpan. RequestKey terikat pelaku dan hash payload; retry sama mengembalikan hasil lama, payload berbeda 409. Lock per tahun mencegah draft/revisi ganda.
- `GET /api/holiday-catalogs?organizationId=ID&year=2027`: Superadmin/HRD berizin Kalender Libur, Absensi aktif. HRD dikunci ke organisasi session. Tahun opsional mengikuti hari ini organisasi. Data `{today,year,catalog:null|{id,year,revision,decision_number,source_url,published_at,days}}`; setiap tanggal memiliki id string, date, name, category. Tahun kosong bukan error dan tidak menghasilkan perkiraan tanggal.
- `POST /api/work-calendars`: kontrak existing ditambah `days[].catalogDayId?:string|null`. Date/name tetap wajib. ID diverifikasi terhadap tanggal katalog terbit dan harus cocok date/name. Category/revision/source tidak diterima dari klien; response daftar memperoleh metadata dari referensi server. Payload lama tetap sah, termasuk penyimpanan tanpa perubahan sumber pada tanggal existing. Tanggal manual lama tetap manual. Batas 366, optimistic version, no-past-change, receipt serta perlindungan histori existing tetap berlaku.

`VERSION_CONFLICT`, `DRAFT_EXISTS`, `PUBLISHED_IMMUTABLE`, `INVALID_CATALOG_SOURCE` menyatakan konflik yang perlu ditinjau pengguna. Kegagalan menulis audit/receipt membatalkan seluruh mutation.

## Penyimpanan dan penerapan

Migration `20261101_069_holiday_catalog.sql` menambah tiga tabel global referensi: `holiday_catalogs`, `holiday_catalog_days`, `holiday_catalog_requests`. Pengecualian lintas organisasi ini khusus katalog platform; bukan tabel operasional organisasi. `work_calendar_days.catalog_day_id` nullable mereferensikan snapshot katalog terbit. Nama/tanggal tetap tersimpan pada kalender organisasi beserta organization_id existing. FK katalog mempertahankan sumber; metadata kategori dan revisi diperoleh melalui join. Tidak ada perubahan ledger cuti, penetapan Pegawai atau snapshot existing.

Bootstrap `sitou_schema_v3.sql` memuat schema akhir dan seed sama. Database berjalan memakai migration 069, bukan menjalankan bootstrap kembali. Tidak menjalankan ulang 063–068, tidak mengaktifkan modul/grant otomatis, dan tidak melakukan deployment VPS.

## Dasar rancangan

Pemisahan jenis hari libur mengikuti [Talenta Calendar](https://help-center.talenta.co/hc/en-us/articles/11903599156889-How-to-Manage-Calendar-Sub-Menu). Pemilihan referensi dan penambahan manual mengikuti [Zoho People Holidays](https://help.zoho.com/portal/en/kb/people/administrator-guide/leave/operations/articles/managing-holidays). SITOU tetap memakai persetujuan eksplisit organisasi, source resmi dan alur saldo cuti terpisah sesuai keputusan produk.

## Opsi kedua: unggah PDF SKB

Unggah PDF SKB menyediakan pembacaan lokal melalui worker Tesseract/Poppler, pratinjau dengan sumber halaman, koreksi dan peninjauan eksplisit. PDF asli disimpan privat per revisi, dapat dilihat Admin serta HRD berizin setelah terbit. PDF bertahun berbeda tidak dapat dipakai. Pengambilan API/manual tetap tersedia. Kontrak save juga menerima pdfImportId dan pdfReviewed; sourceUrl boleh kosong hanya dengan PDF sah. Langkah development, migration 070, pemasangan VPS, keamanan, API, backup dan diagnosis dijelaskan lengkap di [Panduan PDF SKB](holiday-pdf-import.md).

## Penghapusan permanen — migration 071–072

Hanya Admin SITOU yang dapat menghapus satu revisi katalog atau satu kalender organisasi. Berlaku juga untuk katalog bawaan dan kalender yang dibuat HRD. Tidak ada penghapusan massal. Data pengguna existing tidak dihapus oleh migration.

1. Pilih Aksi → Hapus permanen. Sistem memeriksa penggunaan, versi dan dokumen.
2. Jika pernah dipakai, tampilkan alasan beserta nama dan jumlah referensi; tombol konfirmasi tidak tersedia. Katalog dianggap digunakan setelah tanggalnya disimpan ke kalender, walaupun kalender tersebut belum dipakai jadwal. Kalender dianggap digunakan setelah dipilih pada pola/kelompok jadwal, termasuk histori nonaktif. Melepas referensi atau menghapus kalender percobaan tidak menghapus bukti penggunaan katalog.
3. Data lama memerlukan rantai versi audit yang lengkap. Migration 072 membaca versi sebelum perubahan dari payload audit lama karena hasil save legacy hanya berisi ID. Ketidakpastian tetap diblokir; tidak ada tombol reset bukti penggunaan.
4. Untuk data belum digunakan, konfirmasi menjelaskan identitas, organisasi, dampak revisi dan PDF. Jika revisi terbaru dihapus, revisi terbit sebelumnya tersedia kembali; jika tidak ada, tahun tampil belum tersedia. Seed tidak diulang saat GET atau restart.
5. Penghapusan header/tanggal, audit minimal, tombstone receipt serta antrean pembersihan PDF satu transaksi. Histori operasional dan audit lama tidak dihapus. Retry save lama terhadap tombstone menghasilkan ALREADY_DELETED.
6. PDF bersama tetap disimpan. PDF terakhir ditandai tidak tersedia, lalu worker:holiday-pdf menghapus byte, catatan impor dan stored_files. Status sementara: Data berhasil dihapus. Pembersihan dokumen masih diproses. Receipt pembersihan dipantau di latar belakang selama halaman aktif, tanpa mempertahankan modal sukses. Periksa status dalam dialog tetap tersedia jika hasil request penghapusan belum pasti. Jika storage gagal, worker mencoba ulang setelah 30 detik. Audit dan receipt minimal tetap tersimpan setelah pembersihan.

### Kontrak API penghapusan

- GET/POST /api/system/holiday-catalogs/:id/deletion: khusus Admin SITOU, tanpa organizationId.
- GET/POST /api/work-calendars/:id/deletion: khusus Admin SITOU, organizationId wajib dan diverifikasi; Absensi serta organisasi aktif tetap diperiksa.
- GET biasa menghasilkan eligible, code/message, version, name, organization, usages (maksimal 20), usageCount, document dan revisionEffect. GET dengan requestKey UUID membaca receipt: state not_found atau deleted, cleanupPending dan message. Tidak mengirim path privat.
- POST menerima JSON strict version positif, requestKey UUID, serta organizationId khusus kalender. Origin wajib dan diperiksa, maksimum 2 KiB, maksimum 10 percobaan per menit per akun/IP pada bucket penghapusan bersama. Preview bukan otorisasi final; service memeriksa ulang dalam transaksi dengan parent lock yang juga dipakai trigger referensi baru.
- Respons private/no-store dan nosniff. Error internal hanya kode aman serta ID referensi. Request key sama dengan payload berbeda ditolak. Jika koneksi putus, periksa receipt sebelum mencoba ulang dengan key yang sama.

| Kode                          | Arti dan tindakan                                                          |
| ----------------------------- | -------------------------------------------------------------------------- |
| CATALOG_USED / CALENDAR_USED  | Pernah digunakan; lihat referensi, data tidak dapat dihapus.               |
| HISTORY_UNVERIFIED            | Riwayat penggunaan perlu diperiksa; penghapusan diblokir.                  |
| DOCUMENT_BUSY                 | Dokumen masih diproses; tunggu lalu coba lagi.                             |
| VERSION_CONFLICT              | Data berubah; muat ulang dan tinjau kembali.                               |
| ALREADY_DELETED               | Data sudah dihapus; perbarui daftar.                                       |
| FORBIDDEN / SESSION_EXPIRED   | Tidak berizin atau sesi berakhir; masuk kembali dengan akun berwenang.     |
| RATE_LIMITED / INVALID_ORIGIN | Tunggu sebentar atau muat ulang dari aplikasi.                             |
| DELETE_FAILED                 | Transaksi belum berhasil; coba lagi dengan ID referensi untuk penelusuran. |

Pembersihan PDF tertunda bukan kegagalan penghapusan database. Saat hasil request belum diketahui, UI tidak mengizinkan konfirmasi ulang sebelum status diperiksa.

DOCUMENT_QUARANTINED memblokir penghapusan bila dokumen dikarantina/terinfeksi; selesaikan penanganan keamanan melalui prosedur storage. DOCUMENT_UNSAFE memblokir pemilik/kategori/backend dokumen yang tidak sesuai. Penghapusan katalog tidak melewati karantina. DELETE_STATUS_UNKNOWN meminta pemeriksaan receipt ketika koneksi database terputus dan hasil commit belum dapat dipastikan.

Pratinjau penghapusan juga diaudit (holiday_catalog.delete_preview / holiday_calendar.delete_preview), termasuk pemeriksaan lintas organisasi oleh Admin SITOU. Audit mencatat kelayakan, kode penolakan dan jumlah referensi tanpa menyalin seluruh detail penggunaan.

### Verifikasi lokal 2 November 2026

Migration 071–072 development dan bootstrap kosong cocok. QA sintetis 40 assertion bootstrap serta 43 assertion upgrade, 39 pemeriksaan API dan delapan skenario error tambahan lulus. Uji HTTP respons hilang setelah commit, retry, dump/restore beserta hash PDF, render 320/375/1280 dan keyboard lulus. Lint/build/preflight OCR lulus. Tidak menguji penghentian PostgreSQL tepat saat COMMIT atau ClamAV production nyata. Hasil lengkap dan batas pemeriksaan dicatat pada CHANGELOG.md; artefak QA sementara dibersihkan.

## Presentasi kalender dan penghapusan

Menu aksi katalog/kalender memakai ikon outline sesuai fungsi. Konfirmasi hapus menjelaskan dampak secara langsung tanpa AppNotice. Setelah berhasil, modal ditutup dan snackbar bersama menampilkan hasil; pembersihan PDF yang masih berjalan disebutkan secara eksplisit dan dipantau saat tab terlihat. Form kalender memisahkan identitas, tanggal katalog, tanggal organisasi dan penggunaan; aksi impor/tambah/hapus memakai tombol ikon berlabel/tooltip dan EmptyState per kelompok. Isian tetap utuh saat berpindah tahap katalog atau request gagal.
