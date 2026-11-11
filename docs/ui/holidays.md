# Koreksi UI katalog dan kalender libur

Pedoman ini melengkapi AGENTS.md dan katalog komponen existing. Baca aturan root, aturan folder sasaran, dokumen alur fitur dan pedoman ini sebelum mengubah UI. Instruksi pengguna terbaru tetap menjadi acuan utama.

## Koreksi pengguna yang wajib diperiksa sebelum implementasi

- Pada Katalog Hari Libur, aksi Gunakan dan simpan draft dari hasil otomatis langsung menampilkan Tinjau katalog dari versi yang berhasil disimpan. Jangan beralih ke Input manual + PDF. Konflik tahun menampilkan aksi Buka draft atau Lihat katalog terbit. Revisi terbaru berstatus Terbit, sementara versi lama berstatus Riwayat revisi. Saat mengedit katalog, Ambil data terbaru mengisi panel lipat yang dapat diedit tanpa tahap tabel atau penyimpanan otomatis. Katalog baru tetap memakai pratinjau sumber. Edit katalog terbit memakai panel lipat per tanggal di kedua cara pengisian. Panel memuat isian tanggal, nama dan kategori, dengan ikon hapus di header. Tinjauan mengelompokkan tahun, nomor SKB, dan tautan SKB resmi dalam ringkasan ringkas. Simpan perubahan pada tahap tinjauan langsung memproses penyimpanan. Tombol Batal pada form berada di kiri pada desktop.

- Pada Buat/Edit kalender libur, tanggal yang ditambahkan dari katalog dikelompokkan dengan AppCollapse. Kategori dan jumlah tanggal tetap terlihat saat tertutup. Saat dibuka, tampilkan nama, tanggal, asal revisi, dan aksi hapus ringkas dalam satu baris per tanggal. Tanggal lampau tetap terkunci sesuai aturan existing. Penggunaan kalender memakai FormSettingSwitch dengan notice aktif/nonaktif di bagian bawah.

- Daftar tanggal katalog pada detail/tinjauan/pratinjau dan pemilih kalender dikelompokkan dalam Collapse kategori, bukan tabel panjang yang langsung terbuka. Header tetap memperlihatkan nama kategori, jumlah tanggal dan jumlah pilihan bila relevan. Menutup kategori tidak melepas pilihan; status terkunci, sumber dan keadaan kosong tetap tersedia ketika dibuka. Ini berbeda dari Collapse isian per tanggal manual.

- Tahun katalog menentukan tahun sumber otomatis dan lingkup tanggal. Pilih melalui AppYearPicker, dengan tahun berjalan/mendatang yang dapat dipilih dan tahun lampau disabled. Input tidak diketik manual. Tahun existing/revisi tetap ditampilkan dan dikunci; filter pencarian historis tetap boleh memilih tahun lampau. Popup tahun harus muat viewport, termasuk 320 px, dengan target pilihan 44 px.

- Entri tanggal manual yang berulang dapat dilipat per tanggal. Judul menampilkan tanggal yang dipilih, bukan Tanggal 1/2; sertakan nama libur dan kategori. Tampilkan Pilih tanggal bila kosong. Baris baru/tidak lengkap dibuka; isian tetap terdaftar ketika tertutup. Validasi membuka panel yang salah dan memfokuskan field terkait. Jangan melipat section wajib utama lagi sehingga menjadi berlapis-lapis.

- Catat koreksi pengguna sebagai keputusan spesifik beserta konteksnya di pedoman ini dan katalog komponen; gunakan sebelum mengubah frontend berikutnya. Skill lokal `sitou-ui-ux` merujuk sumber ini agar aturan tidak disalin ke banyak tempat atau menggantikan instruksi pengguna terbaru.

## Modal yang konsisten

- Komponen isi mengikuti katalog reusable; wrapper domain hanya menangani kebutuhan data/validasi. Gunakan props ukuran dan slot existing, bukan override geometri header/footer. Footer mengikuti aturan mobile di bawah. ESLint menjadi pemeriksaan awal, bukan pengganti QA render/keyboard.

## Bahasa dan komponen

- Draft katalog menawarkan dua metode berlabel jelas: Ambil otomatis / Input manual + PDF. Unggah dokumen memakai FileUploadField langsung di bagian Dokumen SKB, bukan tombol tahap tersembunyi. Isian yang belum disimpan dipertahankan saat beralih metode atau kembali dari pratinjau. Hasil OCR hanya mengganti form setelah ditinjau dan diterapkan; penyimpanan tetap aksi terpisah. Bagian tanggal menyediakan keadaan kosong, jumlah/batas, dan aksi tambah/hapus berikon dengan label aksesibel. Jangan mengandalkan ikon atau warna tanpa konteks teks.

- Pengambilan katalog setahun menampilkan pratinjau dengan sumber SKB, waktu server dan tanggal ditambah/diubah/dihapus sebelum mengganti draft. Tetap satu AppModal dengan tahap pratinjau, footer bersama, loading backdrop dan pesan gagal yang mempertahankan form. Pengambilan dan penyimpanan draft tidak sama dengan penerbitan.

- Kalender membedakan Libur nasional (success), Cuti bersama (info) dan Libur organisasi (warning) dengan teks, bukan warna saja. Tahun awal dari tanggal organisasi server. Tanggal lampau terkunci dan duplikat diberi alasan. Pemilihan katalog serta pratinjau berada di dalam AppModal yang sama; kembali mempertahankan isian. Menambahkan ke form tidak menyimpan. Tanggal resmi readonly, perubahan revisi ditampilkan untuk ditinjau, dan penyimpanan kalender tetap eksplisit. Footer/loading/error memakai komponen bersama.

## Pratinjau PDF SKB

Pratinjau memakai tabel/kartu bersama yang memisahkan Libur nasional dan Cuti bersama. Tampilkan halaman sumber serta teks Perlu diperiksa, bukan warna saja. Gunakan Koreksi hasil pembacaan untuk membuka field; jangan langsung memenuhi pratinjau dengan semua input. Peninjauan direset setelah isian berubah, dokumen asli dibuka melalui endpoint privat. Progres antrean tidak mengunci halaman dengan backdrop selama OCR. Seluruh tahap tetap satu AppModal, footer mobile mengikuti fondasi bersama.

## Pesan penghapusan libur

Pisahkan penolakan karena pernah digunakan, riwayat belum pasti, pekerjaan dokumen aktif, perubahan versi, izin, sesi dan kendala sistem. Pada penolakan, tampilkan nama/jumlah referensi dan jangan tampilkan tombol destruktif atau kalimat yang menyatakan data akan terhapus. Sukses database dengan file tertunda diberi status pembersihan diproses, bukan gagal seluruhnya. Gangguan jaringan tidak dianggap bukti gagal: sediakan Periksa status sebelum konfirmasi ulang. Gunakan ConfirmDialog dengan penjelasan langsung, tanpa panel notifikasi di dalam konfirmasi hapus. Hasil sukses menutup modal dan memakai snackbar Notification bersama; footer mobile 44 px dan jarak 12 px.

## Kalender Libur

Form membedakan Identitas kalender, Libur dari katalog, Libur organisasi dan Penggunaan kalender. Setiap kelompok tanggal mempunyai aksi ikon bernama dan informasi ketika kosong. Field manual tetap tanggal/nama; tanggal resmi readonly dengan kategori dan asal katalog. Hapus baris memakai ikon tempat sampah dengan nama tanggal, penambahan memfokuskan input tanggal baru. Pembagian visual tidak mengubah indeks Form.List, asal sumber, validasi, tanggal lampau atau batas 366.

## Konsistensi modal wajib

- Baca `docs/ui-ux-guidelines.md` dan katalog komponen sebelum mengubah modal. ESLint menolak import modal library di luar AppModal, dialog HTML/role ad hoc, dan atribut header lama. Periksa render desktop/mobile, keyboard, fokus, scroll, validasi serta state loading/error pada pemakai terkait sebelum menyatakan selesai.
