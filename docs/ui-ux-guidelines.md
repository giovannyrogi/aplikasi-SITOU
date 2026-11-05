# Pedoman UI/UX dashboard SITOU

Pedoman ini melengkapi AGENTS.md dan katalog komponen existing. Baca aturan root, aturan folder sasaran, dokumen alur fitur dan pedoman ini sebelum mengubah UI. Instruksi pengguna terbaru tetap menjadi acuan utama.

## Urutan informasi dan pengaturan tambahan

### Koreksi pengguna yang wajib diperiksa sebelum implementasi

- Pada Katalog Hari Libur, aksi Gunakan dan simpan draft dari hasil otomatis langsung menampilkan Tinjau katalog dari versi yang berhasil disimpan. Jangan beralih ke Input manual + PDF. Konflik tahun menampilkan aksi Buka draft atau Lihat katalog terbit. Revisi terbaru berstatus Terbit, sementara versi lama berstatus Riwayat revisi. Saat mengedit katalog, Ambil data terbaru mengisi panel lipat yang dapat diedit tanpa tahap tabel atau penyimpanan otomatis. Katalog baru tetap memakai pratinjau sumber. Edit katalog terbit memakai panel lipat per tanggal di kedua cara pengisian. Panel memuat isian tanggal, nama dan kategori, dengan ikon hapus di header. Tinjauan mengelompokkan tahun, nomor SKB, dan tautan SKB resmi dalam ringkasan ringkas. Simpan perubahan pada tahap tinjauan langsung memproses penyimpanan. Tombol Batal pada form berada di kiri pada desktop.

- Pada Buat/Edit kalender libur, tanggal yang ditambahkan dari katalog dikelompokkan dengan AppCollapse. Kategori dan jumlah tanggal tetap terlihat saat tertutup. Saat dibuka, tampilkan nama, tanggal, asal revisi, dan aksi hapus ringkas dalam satu baris per tanggal. Tanggal lampau tetap terkunci sesuai aturan existing. Penggunaan kalender memakai FormSettingSwitch dengan notice aktif/nonaktif di bagian bawah.

- Pemilihan Kalender libur pada jadwal tetap/shift langsung berarti mengikuti tanggal liburnya. Hilangkan dropdown Saat tanggal libur; payload diturunkan dari kalender terpilih, bukan field tersembunyi yang masih memerlukan validasi. Menghapus kalender mengembalikan aturan libur mingguan jadwal. Data lama tetap utuh sampai penyimpanan eksplisit/revisi bertanggal.

- Jadwal terpakai tetap dapat diedit hari, jam dan kalender. Form menampilkan Mulai berlaku perubahan, date picker paling cepat besok/setelah versi terakhir, alasan dan AppNotice rata kiri tentang perlindungan histori. Tinjauan wajib menyebut tanggal berlaku serta alasan; kembali/gagal mempertahankan isian. Jangan mengunci semua pengaturan karena sudah dipakai. Jenis tetap/shift tetap identitas struktur, tanpa konversi diam-diam. Hindari divider ganda pada pertemuan FormSection dan section existing.

- Ganti jam kerja juga menonaktifkan jadwal/pilihan shift yang sedang ditetapkan pada salah satu Pegawai dan tanggal pilihan. Gunakan identitas pola, bukan nama atau shift_id bersama milik salinan. Jadwal pengganti berbeda tetap tersedia meskipun jamnya sama; pemeriksaan benturan penambahan tidak diterapkan pada penggantian. Server memeriksa ulang saat preview/simpan.

- Jadwal salinan tidak dianggap identik karena berbagi shift_id. Pada Tambah jam kerja, alasan harus spesifik: Sudah digunakan untuk pola yang ditetapkan, Jam kerja bertabrakan untuk pola lain dengan rentang waktu tumpang tindih, serta alasan ketersediaan jika sumber tidak memiliki aturan pada tanggal target. Jangan mengganti semua alasan menjadi Sudah digunakan. Nama dan alasan dua baris tetap terbaca di dropdown; pilihan campuran kelompok memakai alasan kelompok jika tiap shift gagal dengan sebab berbeda.

- Tambah jam kerja mengunci opsi jadwal/shift yang sudah dipakai pada salah satu target/tanggal, termasuk tambahan tersimpan. Tampilkan nama dan alasan Sudah digunakan sebagai dua baris yang tetap terbaca di popup mobile; pilihan jadwal dan shift dikosongkan ketika Jenis perubahan diganti, sedangkan tanggal dan alasan tetap tersimpan. Perubahan tanggal saja tidak menghapus pilihan; tandai jika pilihan tidak lagi tersedia. Data server diperiksa ulang saat target/rentang berubah, request usang dibatalkan, dan gagal menyediakan Coba lagi. Kelompok tidak dikunci seluruhnya jika ada alternatif shift yang tersedia. Ini tidak mengubah izin atau kategori master secara otomatis.

- Kolom Jadwal saat ini menampilkan nama jadwal langsung, tanpa awalan Jadwal berlaku. EmployeeScheduleSummary dipakai bersama pada tabel/kartu mobile: nama jelas dengan ikon kalender dekoratif, jadwal mendatang bertanda Belum mulai dan tanggal Mulai yang mudah dibaca, tanpa jadwal memakai chip Belum diatur. Jangan menganggap jadwal mendatang sudah berlaku atau menambah jam kerja yang tidak diberikan sumber. Nama panjang boleh membungkus.

- Pemberitahuan pilihan Pegawai tanpa jadwal hanya menyebut jumlah pada judul, tanpa nama dalam isi. Gunakan “Tetapkan jadwal terlebih dahulu agar jadwal harian bisa diubah, atau hapus centang pada Pegawai tersebut.” Filter Status jadwal memakai satu dropdown Semua Pegawai / Sudah memiliki jadwal / Belum memiliki jadwal, default semua; acuannya penetapan aktif/mendatang agar selaras dengan syarat aksi, bukan hari libur atau absensi.

- Petunjuk tindakan menyebut kondisi awal dan hasilnya dengan kalimat umum yang utuh. Hindari frasa padat seperti “Jam kerja pada tanggal pilihan diganti”. Gunakan “Jam kerja yang berlaku akan diganti dengan jam kerja yang Anda pilih.” Untuk penambahan: “Jam kerja yang berlaku tetap digunakan. Jam kerja yang Anda pilih akan ditambahkan.” Pada Ubah jadwal harian, Jenis perubahan memakai satu dropdown AsyncSelect, default Ganti jam kerja, bukan dua radio bertumpuk. Saat tindakan berubah, kosongkan pilihan jadwal dan shift beserta error field terkait; tanggal dan alasan tetap tersimpan.

- Audit istilah satu alur secara utuh, termasuk form, tinjauan, bantuan, placeholder, error API dan hasil proses. Satu konsep harus memakai istilah yang sama, bukan sinonim bergantian. Ubah jadwal harian memakai jam kerja pada seluruh state, jadwal utama untuk jadwal rutin, serta tanggal mulai dan selesai pada field tanggal. Judul bagian mengikuti tindakan: Jam kerja pengganti atau Jam kerja tambahan. Label sumber memakai Jadwal kerja dan Pilihan shift, bukan sesi internal. Periksa contoh istilah di komponen dan pesan server sebelum menyatakan bahasa sudah konsisten.

- Sebelum menyelesaikan fitur/komponen, periksa semua teks yang dilihat pengguna: judul, label, tombol, petunjuk, validasi, keadaan kosong dan notifikasi. Gunakan kata umum, kalimat pendek, tindakan yang jelas dan istilah yang konsisten. Sebut objek konkret seperti jam kerja atau tanggal pilihan, bukan pengaturan yang maknanya samar. Jelaskan batas dan dampak dengan bahasa sehari-hari tanpa mengubah aturan bisnis. Arahan menetap tentang periode perubahan memakai AppNotice, tidak diulang sebagai deskripsi section.

- Form Ubah jadwal harian menawarkan Ganti jam kerja / Tambah jam kerja (default Ganti). Satu pilihan Jadwal kerja, lalu Pilihan shift bersyarat dengan nama dan jam aktual, tanpa multiple select sesi internal. Judul Jam kerja pengganti/tambahan mengikuti tindakan. Jam berbeda antarhari terlihat melalui ScheduleSummary Collapse. Tinjauan Sebelum/Sesudah berasal dari server per Pegawai/tanggal, memakai ResponsiveDataView dan pagination bersama bila melebihi satu halaman. Kembali/gagal mempertahankan isian. Tidak ada Jenis hari/Hari libur atau persetujuan lembur otomatis.

- Toolbar Daftar jadwal Pegawai tidak menampilkan teks jumlah Pegawai dipilih. Jika pilihan memuat Pegawai tanpa jadwal, tampilkan AppNotice warning terpisah di atas DataPanel, bukan paragraf di toolbar. Judul menyebut jumlah yang belum memiliki jadwal, isi tanpa nama, dengan arahan Tetapkan jadwal terlebih dahulu agar jadwal harian bisa diubah, atau hapus centang pada Pegawai tersebut. Jangan mengulang jumlah seluruh pilihan atau menonaktifkan tombol tanpa alasan yang terlihat.

- Nama hari pada header Collapse ringkasan jadwal memakai berat teks normal (400), tanpa bold. Terapkan melalui ScheduleSummary bersama.

- Ringkasan Pegawai di kedua modal jadwal: avatar kiri dengan label +N Pegawai lainnya, tanpa mengulang jumlah total di header, jarak antar elemen minimal 12px, arrow ujung kanan dan rata tengah. Hapus teks Lihat daftar Pegawai. Isi memakai baris identitas penuh tanpa nomor/header tabel/kartu bersarang/padding ganda. Daftar memiliki scroll lokal dengan tinggi maksimal min(360px, 40dvh); footer hanya total data, tanpa pagination. Jangan memperbesar batas pemilihan 100 Pegawai hanya untuk menguji daftar panjang.

- Gunakan AppCollapse untuk seluruh pelipatan konten; adapter region navigasi/accordion laporan berada pada fondasi yang sama. Nama hari, kategori/jumlah dan status tetap terlihat ketika tertutup. Pertahankan activeKey/onChange, isian terdaftar, panel error dan keyboard. Jangan membuat shell pelipatan per fitur atau mengimpor primitive library langsung. Header interaktif minimal 44px; field wajib utama tetap terlihat.
- Tetapkan jadwal langsung menyimpan setelah validasi, tanpa Lanjutkan dan modal konfirmasi tambahan. Ini khusus penetapan, bukan menghapus tahap tinjauan perubahan harian massal. Ringkasan dilipat per hari. Pilihan Pegawai memakai ringkasan avatar dan daftar Collapse inline bersama; foto daftar dapat dipreview, sedangkan avatar dalam tombol ringkasan tetap noninteraktif. Preview gambar menggantikan modal sumber sementara; menutup preview mempertahankan form/pagination dan status Collapse.
- Mulai berlaku jadwal hanya hari ini/mendatang dalam zona organisasi, dan tidak sebelum tanggal bergabung paling akhir dari pilihan. DatePicker memblokir tanggal tersebut dan validasi form/server mengulang pemeriksaan. Jangan menerapkan pembatasan ini ke filter historis.

- Semua area bergulir di AppModal menyembunyikan scrollbar secara terpusat, termasuk isi panjang, header/pagination pada layar pendek dan region di dalamnya. Tetap gunakan overflow auto, roda/touch serta keyboard; body dapat difokuskan dengan Tab. Jangan memakai overflow hidden untuk menyembunyikan scrollbar.
- Ubah jadwal harian memerlukan penetapan rutin. Jika ada pilihan tanpa penetapan aktif/mendatang, nonaktifkan aksi dan tampilkan jumlah tanpa nama serta arahan menetapkan jadwal agar jadwal harian bisa diubah, atau menghapus centang pada Pegawai tersebut. Jangan melewati Pegawai diam-diam. Server memeriksa cakupan penetapan pada seluruh tanggal; jadwal mendatang hanya bisa diubah sejak mulai berlaku, dan hari libur dalam pola tetap termasuk tanggal yang telah memiliki jadwal.

- Aksi jadwal harian massal berada bersama Tetapkan jadwal pada toolbar daftar, tanpa teks jumlah pilihan, bukan dalam aksi per baris. Hilangkan tombol Batalkan semua pilihan; checkbox dan Atur ulang tetap tersedia. Filter lokasi/divisi/jabatan/jenis memakai fondasi filter bersama.
- Ringkasan banyak Pegawai memakai avatar privat/initial bersama, jumlah sisa dan total pilihan. Hanya jumlah >1 menjadi tombol pembuka daftar. Daftar dibuka inline melalui AppCollapse, dengan scroll lokal berbatas tinggi dan footer total data; form, judul dan footer tidak diganti. Hindari tombol foto bersarang di tombol ringkasan: avatar di dalamnya noninteraktif.
- Perubahan massal periode harus menjelaskan jumlah Pegawai, rentang, jumlah hari, pengaturan lama yang diganti dan dampak terhadap hari libur. Pisahkan Tinjau dari Simpan. Konflik/gagal menyimpan mempertahankan isian; sukses memakai snackbar bersama.

- Daftar tanggal katalog pada detail/tinjauan/pratinjau dan pemilih kalender dikelompokkan dalam Collapse kategori, bukan tabel panjang yang langsung terbuka. Header tetap memperlihatkan nama kategori, jumlah tanggal dan jumlah pilihan bila relevan. Menutup kategori tidak melepas pilihan; status terkunci, sumber dan keadaan kosong tetap tersedia ketika dibuka. Ini berbeda dari Collapse isian per tanggal manual.
- Jadwal Pegawai berfokus pada penetapan dan histori. Section Lihat jadwal telah dihapus; jangan menambah kembali kalender pemantauan atau menu laporan jadwal sebelum diminta pengguna. Pemilihan Pegawai hanya untuk aksi Kelola, bukan kontrol tanpa hasil pada akses Lihat Saja.

- Jarak section mengikuti FormSection: padding vertikal 24 px; `first` hanya pada section paling awal form. Jangan memakai `:first-of-type` untuk menghapus jarak karena wrapper kondisional/nested dapat membuat section tengah dianggap pertama. Periksa jarak nyata di kedua sisi divider, termasuk ketika metode pengisian berganti.
- Tahun katalog menentukan tahun sumber otomatis dan lingkup tanggal. Pilih melalui AppYearPicker, dengan tahun berjalan/mendatang yang dapat dipilih dan tahun lampau disabled. Input tidak diketik manual. Tahun existing/revisi tetap ditampilkan dan dikunci; filter pencarian historis tetap boleh memilih tahun lampau. Popup tahun harus muat viewport, termasuk 320 px, dengan target pilihan 44 px.
- Entri tanggal manual yang berulang dapat dilipat per tanggal. Judul menampilkan tanggal yang dipilih, bukan Tanggal 1/2; sertakan nama libur dan kategori. Tampilkan Pilih tanggal bila kosong. Baris baru/tidak lengkap dibuka; isian tetap terdaftar ketika tertutup. Validasi membuka panel yang salah dan memfokuskan field terkait. Jangan melipat section wajib utama lagi sehingga menjadi berlapis-lapis.
- Penjelasan menetap tentang pengambilan data otomatis memakai AppNotice existing dengan kalimat pendek. Hasil sukses CRUD tetap snackbar. Unggah tetap FileUploadField. Header/footer tetap fondasi modal bersama.
- Catat koreksi pengguna sebagai keputusan spesifik beserta konteksnya di pedoman ini dan katalog komponen; gunakan sebelum mengubah frontend berikutnya. Skill lokal `sitou-ui-ux` merujuk sumber ini agar aturan tidak disalin ke banyak tempat atau menggantikan instruksi pengguna terbaru.

### Modal yang konsisten

- Seluruh modal aplikasi memakai AppModal, termasuk form lama, form baru, detail, riwayat dan wrapper ConfirmDialog/ImagePreviewModal. Jangan membuat shell atau header/footer alternatif tanpa permintaan eksplisit pengguna.
- Baris utama header selalu ikon–judul–tutup. Deskripsi mobile berada di baris kedua selebar header. Di desktop, deskripsi sejajar kolom judul. Ukuran ikon, font, padding, divider dan target tombol tutup berasal dari AppModal.
- Header, pagination dan footer tetap terlihat, hanya isi yang bergulir. `contentResetKey` mengembalikan body ke atas ketika halaman berubah. Opsi `scrollHeaderWithContent` sudah dihapus dan tidak boleh dibuat kembali.
- Pada layar pendek atau teks diperbesar, area header dibatasi 40dvh dan dapat digulir secara lokal bila isinya terlalu panjang. Area pagination dapat menyusut dan digulir bila diperlukan. Ini fallback aksesibilitas bersama untuk menjaga footer tetap terjangkau, bukan varian layout per fitur atau alasan mengecilkan teks.
- Komponen isi mengikuti katalog reusable; wrapper domain hanya menangani kebutuhan data/validasi. Gunakan props ukuran dan slot existing, bukan override geometri header/footer. Footer mengikuti aturan mobile di bawah. ESLint menjadi pemeriksaan awal, bukan pengganti QA render/keyboard.

- Tampilkan kebutuhan utama terlebih dahulu. Pada jadwal, tampilkan Nama jadwal dan dropdown Jenis jam kerja dalam satu baris pada desktop, lalu susun full width pada ponsel. Pilihan Jam kerja tetap menampilkan Hari kerja dan Jam kerja utama. Pilihan Kerja shift menampilkan Hari kerja serta kartu nama/jam setiap shift. Hindari memaksa pengguna mempelajari struktur teknis sebelum mengisi form sederhana.
- Kelompokkan field menurut tugas pengguna. Pakai judul singkat, penjelasan seperlunya, divider dan spacing 24 atau 32 px antarbagian. Jangan menambah banyak kotak dekoratif atau divider di setiap pasangan label dan nilai.
- Lipat pengaturan opsional yang tidak dibutuhkan semua pengguna. Judul harus menyebut isi, misalnya Atur jam kerja per hari. Ringkasan yang masih terlihat membantu pengguna memahami apa yang dapat diubah.
- Batasi pelipatan bertingkat. Alur utama tidak boleh membutuhkan beberapa pembukaan panel. Pada jadwal baru, satu hari khusus atau pilihan shift berisi satu rentang waktu. Jangan menambahkan pilihan jenis jam kerja, Libur atau daftar jam kerja lagi di dalamnya. Periksa apakah pengelompokan masih mudah ditemukan.
- Pilihan shift boleh dilipat untuk merapikan form panjang. Tampilkan nama dan jam pada header, buka pilihan baru yang kosong dan pilihan dengan error, serta pertahankan isian ketika ditutup. Informasi operasional menetap menggunakan AppNotice. Filter jenis pada daftar memakai dropdown dalam OperationalFilterSection dengan deskripsi singkat, bukan tab yang mengulang fungsi filter.
- Melihat pengaturan tidak mengubah makna data. Membuka editor hari tidak langsung menjadikannya Jam khusus. Penanda berubah setelah pengguna mengubah isian. Menutup panel tidak menghapus nilai.
- Jika validasi menemukan kesalahan pada pengaturan yang terlipat, buka bagian dan hari yang terkait. Pertahankan isian dan beri pesan yang menyebut penyebab serta tindakan berikutnya. Ringkasan bukan penyimpanan sampai pengguna mengonfirmasi.

## Bahasa dan komponen

- Draft katalog menawarkan dua metode berlabel jelas: Ambil otomatis / Input manual + PDF. Unggah dokumen memakai FileUploadField langsung di bagian Dokumen SKB, bukan tombol tahap tersembunyi. Isian yang belum disimpan dipertahankan saat beralih metode atau kembali dari pratinjau. Hasil OCR hanya mengganti form setelah ditinjau dan diterapkan; penyimpanan tetap aksi terpisah. Bagian tanggal menyediakan keadaan kosong, jumlah/batas, dan aksi tambah/hapus berikon dengan label aksesibel. Jangan mengandalkan ikon atau warna tanpa konteks teks.

- Pengambilan katalog setahun menampilkan pratinjau dengan sumber SKB, waktu server dan tanggal ditambah/diubah/dihapus sebelum mengganti draft. Tetap satu AppModal dengan tahap pratinjau, footer bersama, loading backdrop dan pesan gagal yang mempertahankan form. Pengambilan dan penyimpanan draft tidak sama dengan penerbitan.

- Kalender membedakan Libur nasional (success), Cuti bersama (info) dan Libur organisasi (warning) dengan teks, bukan warna saja. Tahun awal dari tanggal organisasi server. Tanggal lampau terkunci dan duplikat diberi alasan. Pemilihan katalog serta pratinjau berada di dalam AppModal yang sama; kembali mempertahankan isian. Menambahkan ke form tidak menyimpan. Tanggal resmi readonly, perubahan revisi ditampilkan untuk ditinjau, dan penyimpanan kalender tetap eksplisit. Footer/loading/error memakai komponen bersama.

- Gunakan Bahasa Indonesia yang langsung dipahami, sentence case, label persisten, dan kalimat pendek tanpa titik koma pada teks UI. Pilih Jam kerja tetap, Kerja shift, Tambah shift, Jam kerja utama, Atur jam kerja per hari dan Jam khusus. Rotasi serta Jam fleksibel tidak menjadi pilihan form baru. Hindari Custom, Sesi, atau istilah struktur internal pada alur sederhana.
- Cari komponen bersama sebelum membuat komponen baru. Form jadwal memakai AppModal, FontStyle, FormSettingSwitch, AsyncSelect dan CompactInfoChip. Jangan menyalin warna atau membuat chip/status ad hoc.
- Chip adalah penanda, bukan tombol. Label dan bentuk harus tetap menjelaskan makna ketika warna tidak dapat dibedakan. Pada jadwal, Hari kerja dan Jam utama memakai tone success (hijau), Hari libur dan Jam khusus memakai tone info (biru). Pemberitahuan libur tampil di bagian hari yang bersangkutan, berdasarkan jam kerja hari tersebut. Jangan menambahkan pemberitahuan libur umum di akhir ringkasan harian. Informasi kalender libur tambahan tetap ditampilkan bila dipilih.
- Gunakan token theme untuk warna, border, radius dan permukaan. Informasi utama tetap berwarna teks normal. Hiasan tidak boleh mengurangi kontras atau menambah beban baca.

## Interaksi, responsivitas dan pemeriksaan

- Footer AppModal pada mobile (<600px) menyusun setiap tombol pada baris sendiri, selebar area, tinggi minimal 44px dan jarak 12px. Aturan berlaku juga untuk tombol dalam AntD Space. Desktop tetap sejajar. Gunakan footer bersama tanpa membuat susunan tombol per modal.
- Ringkasan jadwal memisahkan setiap hari dengan garis dan padding 24px. Jam kerja, istirahat serta toleransi tampil sebagai fakta berlabel, dua kolom di desktop dan satu kolom di mobile. Hari libur ditandai teks. Hindari menggabungkan semua aturan menjadi paragraf metadata.

- Header panel harus dapat dioperasikan dengan Enter dan Space, mempunyai status terbuka/tertutup yang benar, serta urutan Tab yang jelas. Gunakan perilaku komponen library yang versinya sudah diperiksa. Jangan menyisipkan tombol interaktif ke dalam tombol header lain.
- Target sentuh minimal 44 px untuk aksi. Chip informasi boleh lebih kecil karena tidak interaktif. Pertahankan fokus yang terlihat dan jangan memotong pesan validasi.
- Susun pasangan jam dalam dua kolom pada desktop dan satu kolom pada ponsel. Gunakan minmax(0, 1fr), pembungkusan aman dan ukuran fleksibel. Jangan mengurangi font atau memotong informasi penting untuk memaksakan layout.
- Verifikasi render pada 320/375/390, 768, 1024/1366 dan desktop lebar. Periksa teks 2×, keyboard, teks panjang, panel tertutup/terbuka, loading, gagal, coba lagi dan validasi tersembunyi sesuai risiko perubahan.
- Catat hasil aktual, batas pemeriksaan dan pembersihan artefak di changelog. Pemeriksaan kode tidak menggantikan pemeriksaan render. Jangan mengklaim riset pengguna atau kepatuhan penuh WCAG hanya karena memakai komponen library.

## Sumber dan penerapan

- [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) menjelaskan penundaan pilihan lanjutan agar alur utama lebih mudah dipelajari. Diterapkan pada pengaturan hari khusus dan toleransi waktu.
- [GOV.UK — Accordion](https://design-system.service.gov.uk/components/accordion/) menjelaskan risiko menyembunyikan konten, judul yang singkat, dan pentingnya menguji kegunaan accordion. Di SITOU, isian wajib utama tetap terlihat. Pelipatan dibatasi pada kebutuhan opsional berdasarkan masukan pemilik aplikasi, bukan diterapkan ke seluruh form secara otomatis.
- [W3C WAI — Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) menjadi acuan keyboard dan status aksesibel. Komponen existing tetap perlu diuji pada hasil render.

Referensi diperiksa 29 Oktober 2026. Ini pedoman implementasi yang disesuaikan dengan SITOU, bukan pemasangan skill pihak ketiga atau klaim sertifikasi aksesibilitas.

- Tombol ikon tetap memiliki nama aksesibel dan tooltip yang dapat muncul pada hover serta fokus keyboard. Gunakan AppIcon dan Tooltip existing, dengan target 44×44px. Bila teks disembunyikan di desktop, pertahankan teks pada ponsel ketika membantu memahami aksi. Label form dapat membungkus pada teks besar melalui API labelWrap existing, bukan dipotong.

## Daftar organisasi dan kelompok navigasi

- Kelompok sidebar adalah presentasi, bukan izin. Organisasi berada bersama Lokasi, Jenis Unit Organisasi, Divisi & Unit, Jabatan, Jenis Kepegawaian dan Jadwal Kerja dalam satu kelompok Kepegawaian pada Data Master. Izin Organisasi tetap platform khusus Superadmin. Jangan mengubah access.kind atau role untuk memindahkan letak menu. sidebarGroup dapat mengatur presentasi, dan label kelompok tidak diulang ketika item berselang.
- Daftar Organisasi memisahkan Kode, Nama organisasi, Lokasi aktif, Akun HRD, Akses berakhir, Status akses, Inventaris dan Absensi. Satu fakta utama per kolom. Nama resmi, jenis dan rincian periode tetap tersedia pada form terkait, tidak ditumpuk bersama nama/kode pada sel identitas. Angka lokasi/admin memakai arti DTO existing, bukan indikator kesiapan onboarding yang belum dihitung.
- Setiap fitur memiliki status Aktif/Nonaktif dengan CompactInfoChip existing beserta ikon dan teks. Status konfigurasi fitur berbeda dari status akses organisasi. Kode dan status panjang memakai wrap opsional agar utuh, termasuk saat teks diperbesar. Tabel boleh digulir horizontal secara lokal pada layar menengah, tanpa overflow halaman atau mengecilkan font.
- Kartu mobile memakai ReportCardFields stacked: label di atas nilai, fakta terpisah, dan aksi berlabel Aksi organisasi pada footer. Nama panjang boleh membungkus. RowActionMenu tetap menyediakan nama aksesibel yang menyebut organisasi.
- Aksi Kelola fitur memakai SettingOutlined dari keluarga outline yang sama dengan EditOutlined, SyncOutlined dan StopOutlined. Gaya navigasi bold duotone tidak disisipkan ke antara ikon aksi outline. Ukuran menu aksi mengikuti RowActionMenu bersama, bukan ukuran ad hoc per item.

Tanggal Akses berakhir memakai subscription_ends_on untuk periode biasa dan subscription_grace_ends_on ketika API menyatakan status grace. Tidak menghitung ulang status atau masa akses di browser. Tanggal kosong ditampilkan Belum diatur.

## Pratinjau PDF SKB

Pratinjau memakai tabel/kartu bersama yang memisahkan Libur nasional dan Cuti bersama. Tampilkan halaman sumber serta teks Perlu diperiksa, bukan warna saja. Gunakan Koreksi hasil pembacaan untuk membuka field; jangan langsung memenuhi pratinjau dengan semua input. Peninjauan direset setelah isian berubah, dokumen asli dibuka melalui endpoint privat. Progres antrean tidak mengunci halaman dengan backdrop selama OCR. Seluruh tahap tetap satu AppModal, footer mobile mengikuti fondasi bersama.

## Pesan penghapusan libur

Pisahkan penolakan karena pernah digunakan, riwayat belum pasti, pekerjaan dokumen aktif, perubahan versi, izin, sesi dan kendala sistem. Pada penolakan, tampilkan nama/jumlah referensi dan jangan tampilkan tombol destruktif atau kalimat yang menyatakan data akan terhapus. Sukses database dengan file tertunda diberi status pembersihan diproses, bukan gagal seluruhnya. Gangguan jaringan tidak dianggap bukti gagal: sediakan Periksa status sebelum konfirmasi ulang. Gunakan ConfirmDialog dengan penjelasan langsung, tanpa panel notifikasi di dalam konfirmasi hapus. Hasil sukses menutup modal dan memakai snackbar Notification bersama; footer mobile 44 px dan jarak 12 px.

## Proses perancangan UI/UX sebelum pengembangan frontend

1. Pahami tugas pengguna, perannya, data yang dibutuhkan dan hasil akhirnya. Baca aturan root/folder, alur fitur, pedoman UI/UX dan katalog komponen sebelum menulis perubahan frontend.
2. Audit layar dan komponen existing. Tentukan hierarki judul/field/aksi, kelompok informasi, istilah pengguna, serta satu aksi utama. Tuliskan keputusan desain singkat dalam pembaruan pekerjaan; tidak perlu meminta persetujuan tambahan untuk pilihan rutin yang sudah masuk lingkup tugas.
3. Untuk pola baru atau perbaikan UX yang belum memiliki acuan SITOU, periksa sumber profesional primer yang relevan, lalu catat tautan, tanggal pemeriksaan dan penerapannya di pedoman. Untuk penerapan pola existing, gunakan keputusan yang sudah didokumentasikan agar visual tetap konsisten.
4. Rancang alur desktop/mobile dan state kosong, terisi, loading, gagal, berhasil, read-only serta terkunci sebelum implementasi. Tentukan perilaku keyboard, fokus, nama aksesibel, teks panjang dan layout layar pendek. Periksa risiko hilangnya isian atau perubahan makna data.
5. Susun fondasi reusable. Form berkelompok memakai FormSection; aksi ikon memakai IconActionButton dengan label/tooltip dan target 44×44 px. Item menu aksi tetap memiliki ikon outline sesuai fungsi beserta teks. Footer/header modal tetap dari AppModal.
6. Verifikasi render dan keyboard pada breakpoint yang terdampak, proses CRUD dan pemulihan kegagalan; catat hasil aktual beserta batas pemeriksaan di CHANGELOG. Bersihkan artefak QA sementara. Jangan menyatakan desain selesai hanya berdasarkan lint/build.

### Konfirmasi dan hasil CRUD

- Konfirmasi hapus memakai ConfirmDialog dengan penjelasan langsung: objek, konsekuensi permanen dan dampak dokumen. Tidak membungkus penjelasan atau penolakan hapus dalam AppNotice/Alert. Informasi referensi terpakai tetap terbaca sebagai isi dialog.
- Setelah CRUD berhasil, tutup modal terkait dan tampilkan Notification melalui useAppNotification (snackbar bersama). Jangan membuka atau mempertahankan modal untuk menyampaikan sukses CRUD. Kegagalan mempertahankan isian/konteks; validasi dan status yang belum pasti tetap dapat dijelaskan inline. AppNotice tetap untuk konteks operasional menetap, bukan hasil sukses CRUD.
- Penghapusan database yang sukses dengan PDF belum bersih menggunakan snackbar yang menyebut pembersihan sedang diproses. Pemantauan receipt hanya saat ada pekerjaan dan tab terlihat; selesaikan dengan snackbar, tanpa modal sukses. Ketidakpastian hasil request tetap memerlukan Periksa status sebelum retry.

### Dasar keputusan desain, diperiksa 2 November 2026

- [Ant Design DatePicker](https://ant.design/components/date-picker/) dan [Collapse](https://ant.design/components/collapse/): gunakan picker tahun/read-only input/disabledDate untuk seleksi tahun; Collapse forceRender mempertahankan field yang ditutup. SITOU menambahkan pembukaan panel dan fokus saat validasi serta pembatasan ukuran popup, bukan mengubah kontrak tahun numerik atau membuat modal bertumpuk. Ini referensi API komponen, bukan alasan membatasi pembacaan histori.

- [Scottish Government — Form design](https://designsystem.gov.scot/guidance/forms/form-design) dan [Form spacing](https://designsystem.gov.scot/guidance/forms/form-spacing): kelompokkan field berdasarkan tugas, dekatkan label dengan input, dan bedakan jarak antarkelompok. SITOU menerapkannya melalui FormSection, urutan identitas → tanggal katalog → tanggal organisasi → penggunaan, satu kolom mobile dan state kosong per sumber tanggal.
- [NN/g — Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/): konfirmasi destruktif menyebut objek serta konsekuensi dengan bahasa singkat dan label aksi spesifik. SITOU memakai isi paragraf langsung dalam ConfirmDialog, tanpa panel peringatan berulang.
- [GNOME HIG — Toasts](https://developer.gnome.org/hig/patterns/feedback/toasts.html): feedback kejadian singkat tidak perlu menghentikan alur. SITOU mempertahankan Notification snackbar existing untuk hasil CRUD; status jangka panjang tidak ditampilkan sebagai modal sukses. Posisi dan visual snackbar tetap mengikuti komponen SITOU.
- [W3C — Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): ukuran/jarak target membantu akses pointer. SITOU mempertahankan standar proyek 44×44 px, dengan label aksesibel dan tooltip keyboard pada aksi ikon. Ini keputusan proyek, bukan klaim bahwa minimum WCAG AA adalah 44 px atau bahwa seluruh aplikasi sudah tersertifikasi.

### Kalender Libur

Form membedakan Identitas kalender, Libur dari katalog, Libur organisasi dan Penggunaan kalender. Setiap kelompok tanggal mempunyai aksi ikon bernama dan informasi ketika kosong. Field manual tetap tanggal/nama; tanggal resmi readonly dengan kategori dan asal katalog. Hapus baris memakai ikon tempat sampah dengan nama tanggal, penambahan memfokuskan input tanggal baru. Pembagian visual tidak mengubah indeks Form.List, asal sumber, validasi, tanggal lampau atau batas 366.

### Ganti dan tambah jam kerja — 3 November 2026

Satu tugas memakai satu istilah. Jadwal kerja adalah susunan/kelompok, Pilihan shift adalah satu alternatif jam di dalamnya. Jangan menggabungkan seluruh alternatif. Pilihan tunggal menggunakan AsyncSelect; Jenis perubahan pada form harian memakai satu dropdown AsyncSelect dengan nama aksesibel dan tinggi minimal 44px. Jam kerja tambahan mempertahankan jam yang berlaku; jam kerja pengganti menggantinya. Tinjauan berisi hasil nyata per Pegawai/tanggal.

Referensi primer diperiksa 3 November 2026: [Talenta — perubahan shift](https://help-center.talenta.co/hc/en-us/articles/12164556658585-How-to-Request-a-Shift-Change-as-Employee-Role) membedakan penggantian dan penambahan shift; SITOU menerapkannya sebagai tindakan eksplisit, bukan menyalin alur persetujuan ESS. Koreksi pengguna berikutnya menetapkan Jenis perubahan sebagai dropdown AsyncSelect bersama, bukan radio bertumpuk.


## Pemilih titik lokasi

Form Lokasi menempatkan Nama lokasi dan Jenis lokasi sejajar pada layar lebar dan bertumpuk pada ponsel. Koordinat baca-saja memakai teks redup dekat peta. Ikon bantuan radius dan akurasi memakai warna info. Pencarian dan peta ringkas tampil langsung dalam modal Lokasi, setelah tanggal operasional dan sebelum Latitude serta Longitude. Hasil pencarian muncul sebagai dropdown yang dapat dipilih dengan mouse, sentuhan, atau keyboard tanpa menggeser peta. Tombol Cari memakai warna utama SITOU dan tinggi kontrol yang sama dengan kolom pencarian. Pada layar sempit, kolom pencarian menyesuaikan ruang dan tombol tetap terbaca. Peta mendukung zoom dengan roda mouse dan cubit dua jari. Pilihan titik menampilkan koordinat baca-saja di bawah peta dan mengisi alamat jika tersedia. Pengguna bisa mengoreksi alamat. Enter pada peta yang terfokus memilih titik tengah. Simpan tetap satu aksi tulis. Radius dan akurasi ditampilkan ketika titik diaktifkan. Pisahkan pencarian dari peta dan letakkan dua nilai koordinat berjarak rapi tepat di bawah peta. Kelompokkan status Titik absen di atas Lokasi dengan FormSettingsGroup dan notice aktif/nonaktif, dengan garis pemisah di antara keduanya. Radius dan batas akurasi memakai lebar penuh grid form dan sejajar pada layar yang cukup lebar, bertumpuk di ponsel, dan memakai ikon bantuan yang dapat ditekan. Acuan penyedia peta dan pencarian alamat ada di docs/attendance-points.md.
