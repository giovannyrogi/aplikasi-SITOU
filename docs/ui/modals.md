# Modal, header, footer dan scroll

## Koreksi pengguna yang wajib diperiksa sebelum implementasi

- Semua area bergulir di AppModal menyembunyikan scrollbar secara terpusat, termasuk isi panjang, header/pagination pada layar pendek dan region di dalamnya. Tetap gunakan overflow auto, roda/touch serta keyboard; body dapat difokuskan dengan Tab. Jangan memakai overflow hidden untuk menyembunyikan scrollbar.

- Penjelasan menetap tentang pengambilan data otomatis memakai AppNotice existing dengan kalimat pendek. Hasil sukses CRUD tetap snackbar. Unggah tetap FileUploadField. Header/footer tetap fondasi modal bersama.

## Modal yang konsisten

- Seluruh modal aplikasi memakai AppModal, termasuk form lama, form baru, detail, riwayat dan wrapper ConfirmDialog/ImagePreviewModal. Jangan membuat shell atau header/footer alternatif tanpa permintaan eksplisit pengguna.

- Baris utama header selalu ikon–judul–tutup. Deskripsi mobile berada di baris kedua selebar header. Di desktop, deskripsi sejajar kolom judul. Ukuran ikon, font, padding, divider dan target tombol tutup berasal dari AppModal.

- Header, pagination dan footer tetap terlihat, hanya isi yang bergulir. `contentResetKey` mengembalikan body ke atas ketika halaman berubah. Opsi `scrollHeaderWithContent` sudah dihapus dan tidak boleh dibuat kembali.

- Pada layar pendek atau teks diperbesar, area header dibatasi 40dvh dan dapat digulir secara lokal bila isinya terlalu panjang. Area pagination dapat menyusut dan digulir bila diperlukan. Ini fallback aksesibilitas bersama untuk menjaga footer tetap terjangkau, bukan varian layout per fitur atau alasan mengecilkan teks.

- Kelompokkan field menurut tugas pengguna. Pakai judul singkat, penjelasan seperlunya, divider dan spacing 24 atau 32 px antarbagian. Jangan menambah banyak kotak dekoratif atau divider di setiap pasangan label dan nilai.

- Pilihan shift boleh dilipat untuk merapikan form panjang. Tampilkan nama dan jam pada header, buka pilihan baru yang kosong dan pilihan dengan error, serta pertahankan isian ketika ditutup. Informasi operasional menetap menggunakan AppNotice. Filter jenis pada daftar memakai dropdown dalam OperationalFilterSection dengan deskripsi singkat, bukan tab yang mengulang fungsi filter.

- Melihat pengaturan tidak mengubah makna data. Membuka editor hari tidak langsung menjadikannya Jam khusus. Penanda berubah setelah pengguna mengubah isian. Menutup panel tidak menghapus nilai.

- Jika validasi menemukan kesalahan pada pengaturan yang terlipat, buka bagian dan hari yang terkait. Pertahankan isian dan beri pesan yang menyebut penyebab serta tindakan berikutnya. Ringkasan bukan penyimpanan sampai pengguna mengonfirmasi.

## Bahasa dan komponen

## Interaksi, responsivitas dan pemeriksaan

- Footer AppModal pada mobile (<600px) menyusun setiap tombol pada baris sendiri, selebar area, tinggi minimal 44px dan jarak 12px. Aturan berlaku juga untuk tombol dalam AntD Space. Desktop tetap sejajar. Gunakan footer bersama tanpa membuat susunan tombol per modal.

- Header panel harus dapat dioperasikan dengan Enter dan Space, mempunyai status terbuka/tertutup yang benar, serta urutan Tab yang jelas. Gunakan perilaku komponen library yang versinya sudah diperiksa. Jangan menyisipkan tombol interaktif ke dalam tombol header lain.

## Konfirmasi dan hasil CRUD

- Konfirmasi hapus memakai ConfirmDialog dengan penjelasan langsung: objek, konsekuensi permanen dan dampak dokumen. Tidak membungkus penjelasan atau penolakan hapus dalam AppNotice/Alert. Informasi referensi terpakai tetap terbaca sebagai isi dialog.

- Setelah CRUD berhasil, tutup modal terkait dan tampilkan Notification melalui useAppNotification (snackbar bersama). Jangan membuka atau mempertahankan modal untuk menyampaikan sukses CRUD. Kegagalan mempertahankan isian/konteks; validasi dan status yang belum pasti tetap dapat dijelaskan inline. AppNotice tetap untuk konteks operasional menetap, bukan hasil sukses CRUD.

- Penghapusan database yang sukses dengan PDF belum bersih menggunakan snackbar yang menyebut pembersihan sedang diproses. Pemantauan receipt hanya saat ada pekerjaan dan tab terlihat; selesaikan dengan snackbar, tanpa modal sukses. Ketidakpastian hasil request tetap memerlukan Periksa status sebelum retry.

## Konsistensi modal wajib

- Scrollbar modal disembunyikan melalui AppModal bersama untuk seluruh region di dalamnya. Scroll vertikal panjang tetap berfungsi melalui mouse/touch/keyboard; body dapat difokuskan. Jangan mematikan overflow atau menyalin styling scrollbar ke modal fitur.

- Sebelum pengembangan frontend, periksa bagian Koreksi pengguna di `docs/ui-ux-guidelines.md` dan terapkan keputusan yang relevan, bukan hanya tampilan contoh terakhir. Skill `sitou-ui-ux` bila tersedia merujuk dokumen proyek ini; dokumentasi tetap menjadi sumber kebenaran lintas komputer. Catat koreksi berulang sebagai aturan yang terukur tanpa menggeneralisasi pembatasan domain ke seluruh aplikasi.

- Semua modal baru maupun lama wajib menyusun `app/components/modals/AppModal.jsx`. Konfirmasi memakai `ConfirmDialog`, preview gambar memakai `ImagePreviewModal`, dan keduanya tetap menyusun AppModal. Dilarang membuat shell Modal/Dialog library, dialog HTML, backdrop, header, tombol tutup atau footer modal sendiri. Perubahan pola visual hanya atas permintaan eksplisit pengguna dan diterapkan pada komponen bersama.

- Header selalu memakai susunan ikon kiri, judul tengah, tombol tutup kanan. Di mobile, deskripsi berada pada baris berikutnya selebar area header. Header, pagination dan footer tetap terlihat; hanya body bergulir. Jangan mengaktifkan kembali `scrollHeaderWithContent` atau membuat varian tata letak header per fitur.

- Pengecualian responsif terpusat: pada teks diperbesar/layar pendek, area header maksimal 40dvh dan pagination boleh digulir lokal jika tidak muat agar footer tetap dapat diakses. Jangan mengecilkan teks atau mengubah susunan header untuk mengatasi keterbatasan ruang.

- Footer mobile menampilkan satu tombol per baris, full width, tinggi minimal 44px, jarak minimal 12px. Desktop tetap sejajar. Gunakan slot `footer` dan `pagination`, tanpa menyalin aturan layout ke modal domain.

- Isi modal memakai fondasi reusable sesuai fungsi: `FontStyle`, `AppNotice`, `CompactInfoChip`, `FormSettingSwitch`, `AsyncSelect`, `AppTimePicker`, `ResponsiveRangePicker`, `FileUploadField`, `ResponsiveDataView` dan `DataPagination`. Wrapper domain boleh menyusun fondasi tersebut untuk validasi/data khusus, bukan menduplikasi desain. Status/keterangan tetap berteks selain warna. Sesi kedaluwarsa boleh menonaktifkan tutup melalui props existing, tanpa shell lain.

## UI/UX

- Validasi gagal dan tampilan Notification dilarang me-reset, me-remount, atau memuat ulang nilai form yang sedang diisi. Efek inisialisasi modal/wizard wajib memakai dependency stabil dan hanya dijalankan ketika sesi form, organisasi, atau record yang diedit benar-benar berubah.

- Tombol aksi wajib memakai warna semantik yang tegas dari theme sesuai dampaknya: aksi utama memakai merah brand SITOU; hapus, batalkan proses, dan tindakan destruktif memakai danger merah; lihat, informasi, atau periksa ulang memakai info biru; unduh memakai token aksi sesuai jenisnya; pulihkan atau konfirmasi berhasil memakai success hijau; karantina dan tindakan yang memerlukan kewaspadaan memakai warning amber. Tombol sekunder netral dan tombol `Batal` yang hanya menutup dialog tanpa mengubah data tetap boleh netral. Dilarang memakai tint pucat pada tombol aksi utama atau destruktif; state disabled dikecualikan.

- Jarak aman wajib memakai skala 8/12/16/24/32px: minimal 12px antar tombol, 16px antar field atau fakta berbeda, dan 24px antar section serta antara informasi dan kelompok aksi. Pasangan label-nilai boleh 8px. Kartu mobile memakai padding minimal 16px, metadata berlabel, pemisah sebelum aksi, dan tombol lebar penuh bila aksi bertumpuk. Jangan merapatkan komponen untuk menghindari scroll; pastikan fokus keyboard tidak terpotong dan target sentuh minimal 44px. Header serta isi kolom Aksi harus rata tengah terhadap lebar sel yang sama, termasuk kelompok tombol.

- Login, perpindahan menu/halaman, pengambilan data halaman, dan seluruh proses CRUD wajib memakai reusable Backdrop.jsx melalui LoadingBackdropProvider. Backdrop dibuka tepat sebelum proses dimulai dan ditutup hanya setelah promise proses selesai; dilarang menambahkan delay atau durasi minimum buatan.

- Sediakan loading, skeleton, empty, no-result, validation error, server error, permission denied, session expired, dan confirmation dialog.

## Fondasi reusable dan standar visual SITOU

- Hanya ada satu modal shell umum, yaitu `app/components/modals/AppModal.jsx`. Modal khusus, preview, dan confirmation wajib menyusun `AppModal`.

- Form CRUD memakai dirty-state warning, validasi dekat field, mencegah submit ganda, dan menjelaskan dampak aksi berisiko.

- Gunakan `PageHeader`, `OperationalFilterSection`, `ResponsiveDataView`, `CompactInfoChip`, `RowActionMenu`, `ConfirmDialog`, select reusable, `Notification`, dan `LoadingBackdrop` sebelum membuat implementasi fitur sendiri. `CompactInfoChip` adalah satu-satunya chip untuk metadata dan status; dilarang membuat badge/chip reusable kedua dengan fungsi yang sama.

- Panel informasi yang menetap pada halaman, form, dan modal wajib memakai `app/components/data-display/AppNotice.jsx`, termasuk penjelasan izin. Gunakan `tone="info"` (biru), `warning` (kuning), `success` (hijau), atau `danger` (merah) sesuai makna; judul dan langkah berikutnya harus jelas. Isi paragraf `AppNotice` mengikuti aturan justify secara default; jika pesan utama memang perlu rata tengah, gunakan override `descriptionAlign="center"` secara eksplisit. Jangan menerapkan justify pada judul atau tombol. Jangan membuat kotak informasi ad hoc atau mencampur `Alert` Ant Design/MUI untuk fungsi ini. `Notification` tetap khusus pesan sementara dan validasi. Fitur yang nonaktif harus menyebut organisasi terdampak, pihak yang dapat mengaktifkan, dan lokasi pengaturannya bila tersedia.

- Seluruh daftar/tabel yang berpaginasi wajib memakai `app/components/data-display/DataPagination.jsx` pada desktop dan mobile, termasuk laporan dan ledger cursor. Footer konsisten menampilkan total hasil filter, Sebelumnya/Berikutnya, dan pilihan 10/20/50 baris per halaman bila ukuran halaman didukung API; daftar berukuran tetap tidak menampilkan pemilih yang tidak berfungsi. Jangan mengandalkan pagination bawaan AntD atau membuat footer duplikat pada fitur baru.

- `AppModal` harus mendukung ukuran `sm`, `md`, `lg`, `xl` atau custom width, header/footer tetap, konten scrollable, focus management, Escape/backdrop policy, form submit, dan hampir full-screen pada mobile.

- `ImagePreviewModal` hanya menerima URL endpoint privat, blob, atau file lokal; jangan pernah mengirim `object_key` ke browser.

- Seluruh aksi melihat gambar, termasuk pas foto, KTP, Kartu Keluarga, BPJS, NPWP, ijazah, sertifikasi, serta gambar fitur berikutnya, wajib memakai reusable `app/components/modals/ImagePreviewModal.jsx`. Dilarang membuka gambar langsung melalui tab browser, `window.open`, modal baru, atau preview shell khusus fitur; dokumen non-gambar tetap mengikuti viewer/unduh berizin sesuai jenis file.

- Gunakan spacing scale `4, 8, 12, 16, 24, 32px`: ikon-teks 8-12px, antar-control 8-12px, antar-field 16-20px, panel/modal 16px mobile dan 20-24px desktop, halaman 16/24/32px, serta antar-section 24-32px.

- Wadah scroll internal pada kartu, panel grafik, dan daftar ringkas wajib menyembunyikan scrollbar melalui CSS lokal (`scrollbar-width: none` dan `::-webkit-scrollbar`), tanpa menonaktifkan scroll mouse, trackpad, sentuhan, atau keyboard. Pertahankan batas tinggi, nama aksesibel, serta indikator fokus untuk wadah yang menerima fokus. Jangan memakai `overflow: hidden` untuk memotong data atau menyembunyikan scrollbar halaman utama secara global. Terapkan aturan pada komponen reusable agar seluruh pemakainya konsisten.
