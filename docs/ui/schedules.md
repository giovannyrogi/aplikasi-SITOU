# Koreksi UI jadwal Pegawai dan jam kerja

## Koreksi pengguna yang wajib diperiksa sebelum implementasi

- Pada Tinjau perubahan jadwal, urutkan Periode dan Jenis perubahan, lalu panel tanggal berisi jam kerja dan Alasan perubahan. Tampilkan jam sebagai label dan nilai dalam ringkasan yang sama. Gunakan Jam kerja yang berlaku dan Jam kerja tambahan atau Jam kerja pengganti. Jam yang tetap berlaku tidak diulang pada penambahan. Gabungkan tanggal berurutan dengan jam dan sumber libur yang sama untuk Pegawai yang sama dalam satu halaman. Tanggal tetap menjadi judul setiap panel agar dikenali ketika tertutup. Pertahankan identitas per kelompok untuk pilihan banyak Pegawai, keterangan hari berikutnya bila relevan, pagination bersama, dan peringatan saat perubahan sebelumnya akan diganti.

- Pada Riwayat jadwal Pegawai, nama, periode dan status tetap terbaca saat AppCollapse tertutup. Buka satu rincian dalam satu waktu. Tampilkan lima penetapan per halaman dan gunakan slot DataPagination AppModal bila ada halaman berikutnya. Pelaku, waktu simpan, alasan dan aksi pembatalan berada di dalam rincian.

- Ganti jam kerja juga menonaktifkan jadwal/pilihan shift yang sedang ditetapkan pada salah satu Pegawai dan tanggal pilihan. Gunakan identitas pola, bukan nama atau shift_id bersama milik salinan. Jadwal pengganti berbeda tetap tersedia meskipun jamnya sama; pemeriksaan benturan penambahan tidak diterapkan pada penggantian. Server memeriksa ulang saat preview/simpan.

- Jadwal salinan tidak dianggap identik karena berbagi shift_id. Pada Tambah jam kerja, alasan harus spesifik: Sudah digunakan untuk pola yang ditetapkan, Jam kerja bertabrakan untuk pola lain dengan rentang waktu tumpang tindih, serta alasan ketersediaan jika sumber tidak memiliki aturan pada tanggal target. Jangan mengganti semua alasan menjadi Sudah digunakan. Nama dan alasan dua baris tetap terbaca di dropdown; pilihan campuran kelompok memakai alasan kelompok jika tiap shift gagal dengan sebab berbeda.

- Tambah jam kerja mengunci opsi jadwal/shift yang sudah dipakai pada salah satu target/tanggal, termasuk tambahan tersimpan. Tampilkan nama dan alasan Sudah digunakan sebagai dua baris yang tetap terbaca di popup mobile; pilihan jadwal dan shift dikosongkan ketika Jenis perubahan diganti, sedangkan tanggal dan alasan tetap tersimpan. Perubahan tanggal saja tidak menghapus pilihan; tandai jika pilihan tidak lagi tersedia. Data server diperiksa ulang saat target/rentang berubah, request usang dibatalkan, dan gagal menyediakan Coba lagi. Kelompok tidak dikunci seluruhnya jika ada alternatif shift yang tersedia. Ini tidak mengubah izin atau kategori master secara otomatis.

- Kolom Jadwal saat ini menampilkan nama jadwal langsung, tanpa awalan Jadwal berlaku. EmployeeScheduleSummary dipakai bersama pada tabel/kartu mobile: nama jelas dengan ikon kalender dekoratif, jadwal mendatang bertanda Belum mulai dan tanggal Mulai yang mudah dibaca, tanpa jadwal memakai chip Belum diatur. Jangan menganggap jadwal mendatang sudah berlaku atau menambah jam kerja yang tidak diberikan sumber. Nama panjang boleh membungkus.

- Pemberitahuan pilihan Pegawai tanpa jadwal hanya menyebut jumlah pada judul, tanpa nama dalam isi. Gunakan “Tetapkan jadwal terlebih dahulu agar jadwal harian bisa diubah, atau hapus centang pada Pegawai tersebut.” Filter Status jadwal memakai satu dropdown Semua Pegawai / Sudah memiliki jadwal / Belum memiliki jadwal, default semua; acuannya penetapan aktif/mendatang agar selaras dengan syarat aksi, bukan hari libur atau absensi.

- Petunjuk tindakan menyebut kondisi awal dan hasilnya dengan kalimat umum yang utuh. Hindari frasa padat seperti “Jam kerja pada tanggal pilihan diganti”. Gunakan “Jam kerja yang berlaku akan diganti dengan jam kerja yang Anda pilih.” Untuk penambahan: “Jam kerja yang berlaku tetap digunakan. Jam kerja yang Anda pilih akan ditambahkan.” Pada Ubah jadwal harian, Jenis perubahan memakai satu dropdown AsyncSelect, default Ganti jam kerja, bukan dua radio bertumpuk. Saat tindakan berubah, kosongkan pilihan jadwal dan shift beserta error field terkait; tanggal dan alasan tetap tersimpan.

- Sebelum menyelesaikan fitur/komponen, periksa semua teks yang dilihat pengguna: judul, label, tombol, petunjuk, validasi, keadaan kosong dan notifikasi. Gunakan kata umum, kalimat pendek, tindakan yang jelas dan istilah yang konsisten. Sebut objek konkret seperti jam kerja atau tanggal pilihan, bukan pengaturan yang maknanya samar. Jelaskan batas dan dampak dengan bahasa sehari-hari tanpa mengubah aturan bisnis. Arahan menetap tentang periode perubahan memakai AppNotice, tidak diulang sebagai deskripsi section.

- Form Ubah jadwal harian menawarkan Ganti jam kerja / Tambah jam kerja (default Ganti). Satu pilihan Jadwal kerja, lalu Pilihan shift bersyarat dengan nama dan jam aktual, tanpa multiple select sesi internal. Judul Jam kerja pengganti/tambahan mengikuti tindakan. Jam berbeda antarhari terlihat melalui ScheduleSummary Collapse. Tinjauan jam kerja yang berlaku dan yang ditambahkan atau menggantikan berasal dari hasil server per Pegawai/tanggal dan memakai pagination bersama bila melebihi satu halaman. Kembali/gagal mempertahankan isian. Tidak ada Jenis hari/Hari libur atau persetujuan lembur otomatis.

- Toolbar Daftar jadwal Pegawai tidak menampilkan teks jumlah Pegawai dipilih. Jika pilihan memuat Pegawai tanpa jadwal, tampilkan AppNotice warning terpisah di atas DataPanel, bukan paragraf di toolbar. Judul menyebut jumlah yang belum memiliki jadwal, isi tanpa nama, dengan arahan Tetapkan jadwal terlebih dahulu agar jadwal harian bisa diubah, atau hapus centang pada Pegawai tersebut. Jangan mengulang jumlah seluruh pilihan atau menonaktifkan tombol tanpa alasan yang terlihat.

- Nama hari pada header Collapse ringkasan jadwal memakai berat teks normal (400), tanpa bold. Terapkan melalui ScheduleSummary bersama.

- Gunakan AppCollapse untuk seluruh pelipatan konten; adapter region navigasi/accordion laporan berada pada fondasi yang sama. Nama hari, kategori/jumlah dan status tetap terlihat ketika tertutup. Pertahankan activeKey/onChange, isian terdaftar, panel error dan keyboard. Jangan membuat shell pelipatan per fitur atau mengimpor primitive library langsung. Header interaktif minimal 44px; field wajib utama tetap terlihat.

- Tetapkan jadwal langsung menyimpan setelah validasi, tanpa Lanjutkan dan modal konfirmasi tambahan. Ini khusus penetapan, bukan menghapus tahap tinjauan perubahan harian massal. Ringkasan dilipat per hari. Pilihan Pegawai memakai ringkasan avatar dan daftar Collapse inline bersama; foto daftar dapat dipreview, sedangkan avatar dalam tombol ringkasan tetap noninteraktif. Preview gambar menggantikan modal sumber sementara; menutup preview mempertahankan form/pagination dan status Collapse.

- Ubah jadwal harian memerlukan penetapan rutin. Jika ada pilihan tanpa penetapan aktif/mendatang, nonaktifkan aksi dan tampilkan jumlah tanpa nama serta arahan menetapkan jadwal agar jadwal harian bisa diubah, atau menghapus centang pada Pegawai tersebut. Jangan melewati Pegawai diam-diam. Server memeriksa cakupan penetapan pada seluruh tanggal; jadwal mendatang hanya bisa diubah sejak mulai berlaku, dan hari libur dalam pola tetap termasuk tanggal yang telah memiliki jadwal.

- Ubah jadwal harian pada menu Aksi membuka form untuk satu Pegawai pada baris tersebut. Aksi pada toolbar berada bersama Tetapkan jadwal dan memakai pilihan checkbox untuk 1–100 Pegawai. Keduanya memakai form yang sama dan dinonaktifkan jika target belum memiliki penetapan aktif atau mendatang. Filter lokasi/divisi/jabatan/jenis memakai fondasi filter bersama.

- Jadwal Pegawai berfokus pada penetapan dan histori. Section Lihat jadwal telah dihapus; jangan menambah kembali kalender pemantauan atau menu laporan jadwal sebelum diminta pengguna. Pemilihan Pegawai hanya untuk aksi Kelola, bukan kontrol tanpa hasil pada akses Lihat Saja.

## Modal yang konsisten

- Tampilkan kebutuhan utama terlebih dahulu. Pada jadwal, tampilkan Nama jadwal dan dropdown Jenis jam kerja dalam satu baris pada desktop, lalu susun full width pada ponsel. Pilihan Jam kerja tetap menampilkan Hari kerja dan Jam kerja utama. Pilihan Kerja shift menampilkan Hari kerja serta kartu nama/jam setiap shift. Hindari memaksa pengguna mempelajari struktur teknis sebelum mengisi form sederhana.

- Lipat pengaturan opsional yang tidak dibutuhkan semua pengguna. Judul harus menyebut isi, misalnya Atur jam kerja per hari. Ringkasan yang masih terlihat membantu pengguna memahami apa yang dapat diubah.

- Batasi pelipatan bertingkat. Alur utama tidak boleh membutuhkan beberapa pembukaan panel. Pada jadwal baru, satu hari khusus atau pilihan shift berisi satu rentang waktu. Jangan menambahkan pilihan jenis jam kerja, Libur atau daftar jam kerja lagi di dalamnya. Periksa apakah pengelompokan masih mudah ditemukan.

## Bahasa dan komponen

- Chip adalah penanda, bukan tombol. Label dan bentuk harus tetap menjelaskan makna ketika warna tidak dapat dibedakan. Pada jadwal, Hari kerja dan Jam utama memakai tone success (hijau), Hari libur dan Jam khusus memakai tone info (biru). Pemberitahuan libur tampil di bagian hari yang bersangkutan, berdasarkan jam kerja hari tersebut. Jangan menambahkan pemberitahuan libur umum di akhir ringkasan harian. Informasi kalender libur tambahan tetap ditampilkan bila dipilih.

## Interaksi, responsivitas dan pemeriksaan

- Ringkasan jadwal memisahkan setiap hari dengan garis dan padding 24px. Jam kerja, istirahat serta toleransi tampil sebagai fakta berlabel, dua kolom di desktop dan satu kolom di mobile. Hari libur ditandai teks. Hindari menggabungkan semua aturan menjadi paragraf metadata.

## Ganti dan tambah jam kerja — 3 November 2026

Satu tugas memakai satu istilah. Jadwal kerja adalah susunan/kelompok, Pilihan shift adalah satu alternatif jam di dalamnya. Jangan menggabungkan seluruh alternatif. Pilihan tunggal menggunakan AsyncSelect; Jenis perubahan pada form harian memakai satu dropdown AsyncSelect dengan nama aksesibel dan tinggi minimal 44px. Jam kerja tambahan mempertahankan jam yang berlaku; jam kerja pengganti menggantinya. Tinjauan berisi hasil nyata per Pegawai/tanggal.

Referensi primer diperiksa 3 November 2026: [Talenta — perubahan shift](https://help-center.talenta.co/hc/en-us/articles/12164556658585-How-to-Request-a-Shift-Change-as-Employee-Role) membedakan penggantian dan penambahan shift; SITOU menerapkannya sebagai tindakan eksplisit, bukan menyalin alur persetujuan ESS. Koreksi pengguna berikutnya menetapkan Jenis perubahan sebagai dropdown AsyncSelect bersama, bukan radio bertumpuk.

## Konsistensi modal wajib

- Ringkasan Pegawai pada Tetapkan jadwal dan Ubah jadwal harian membuka daftar inline melalui AppCollapse. Jangan mengganti judul, footer, atau form menjadi tahap Pegawai terpilih. Daftar tanpa header tabel atau pagination, tinggi maksimal min(360px, 40dvh), scroll lokal dan footer hanya total data. Satu Pegawai tetap identitas statis; foto daftar tetap memakai preview bersama.

- Tetapkan jadwal menyimpan langsung dari form melalui tombol Tetapkan jadwal, tanpa tahap Lanjutkan/konfirmasi tambahan. Ringkasan memakai SelectedEmployeesSummary dan Collapse inline SelectedEmployeesList bersama; foto daftar membuka ImagePreviewModal secara eksklusif, kembali mempertahankan isian. Mulai berlaku dinonaktifkan sebelum hari ini organisasi atau tanggal bergabung; server tetap memvalidasi ulang.

## Ketentuan modal khusus jadwal

- Tinjauan perubahan harian menggunakan AppCollapse per Pegawai dan rentang tanggal yang memiliki jam serta sumber libur sama. Header tanggal/status tetap terbaca saat tertutup, rincian jam dan alasan berada di dalam. Perubahan terdahulu ditampilkan terpisah dari perubahan yang akan disimpan dan memakai alasan dari audit masing-masing, bukan alasan form terbaru. Penanda libur menyebut nama kalender atau Libur jadwal. Benturan ditampilkan merah melalui AppNotice danger dengan centerContent; Lihat rincian membuka tahap pada AppModal yang sama dan Kembali mempertahankan isian. Rincian menyebut bahwa benturan pertama ditampilkan, berikut jam, Pegawai dan tanggal kerja terkait.

- Pada modal Buat/Edit Jadwal Kerja, Pulang hari berikutnya, Kurangi waktu istirahat dari durasi kerja, dan Izinkan absen pada hari libur memakai FormSettingSwitch dengan notice untuk kedua kondisi. Teks menjelaskan dampak pilihan, dan nama aksesibel switch tetap sama saat kondisinya berubah. Pada pengaturan istirahat, judul menyebut apakah waktu istirahat dikurangi dari atau termasuk dalam durasi kerja. Gunakan contoh jadwal yang sama pada kedua kondisi agar perbedaan perhitungannya jelas. Aturan jam berlaku juga di panel jam khusus per hari dan setiap pilihan shift.

- Ringkasan Pegawai di kedua modal jadwal: avatar kiri dengan label +N Pegawai lainnya, tanpa mengulang jumlah total di header, jarak antar elemen minimal 12px, arrow ujung kanan dan rata tengah. Hapus teks Lihat daftar Pegawai. Isi memakai baris identitas penuh tanpa nomor/header tabel/kartu bersarang/padding ganda. Daftar memiliki scroll lokal dengan tinggi maksimal min(360px, 40dvh); footer hanya total data, tanpa pagination. Jangan memperbesar batas pemilihan 100 Pegawai hanya untuk menguji daftar panjang.

- Cari komponen bersama sebelum membuat komponen baru. Form jadwal memakai AppModal, FontStyle, FormSettingSwitch, AsyncSelect dan CompactInfoChip. Jangan menyalin warna atau membuat chip/status ad hoc.
