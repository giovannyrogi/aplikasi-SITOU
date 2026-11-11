# Proses desain dan verifikasi

## Interaksi, responsivitas dan pemeriksaan

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

## Proses perancangan UI/UX sebelum pengembangan frontend

1. Pahami tugas pengguna, perannya, data yang dibutuhkan dan hasil akhirnya. Baca aturan root/folder, alur fitur, pedoman UI/UX dan katalog komponen sebelum menulis perubahan frontend.

2. Audit layar dan komponen existing. Tentukan hierarki judul/field/aksi, kelompok informasi, istilah pengguna, serta satu aksi utama. Tuliskan keputusan desain singkat dalam pembaruan pekerjaan; tidak perlu meminta persetujuan tambahan untuk pilihan rutin yang sudah masuk lingkup tugas.

3. Untuk pola baru atau perbaikan UX yang belum memiliki acuan SITOU, periksa sumber profesional primer yang relevan, lalu catat tautan, tanggal pemeriksaan dan penerapannya di pedoman. Untuk penerapan pola existing, gunakan keputusan yang sudah didokumentasikan agar visual tetap konsisten.

4. Rancang alur desktop/mobile dan state kosong, terisi, loading, gagal, berhasil, read-only serta terkunci sebelum implementasi. Tentukan perilaku keyboard, fokus, nama aksesibel, teks panjang dan layout layar pendek. Periksa risiko hilangnya isian atau perubahan makna data.

5. Susun fondasi reusable. Form berkelompok memakai FormSection; aksi ikon memakai IconActionButton dengan label/tooltip dan target 44×44 px. Item menu aksi tetap memiliki ikon outline sesuai fungsi beserta teks. Footer/header modal tetap dari AppModal.

6. Verifikasi render dan keyboard pada breakpoint yang terdampak, proses CRUD dan pemulihan kegagalan; catat hasil aktual beserta batas pemeriksaan di CHANGELOG. Bersihkan artefak QA sementara. Jangan menyatakan desain selesai hanya berdasarkan lint/build.

## Dasar keputusan desain, diperiksa 2 November 2026

- [Ant Design DatePicker](https://ant.design/components/date-picker/) dan [Collapse](https://ant.design/components/collapse/): gunakan picker tahun/read-only input/disabledDate untuk seleksi tahun; Collapse forceRender mempertahankan field yang ditutup. SITOU menambahkan pembukaan panel dan fokus saat validasi serta pembatasan ukuran popup, bukan mengubah kontrak tahun numerik atau membuat modal bertumpuk. Ini referensi API komponen, bukan alasan membatasi pembacaan histori.

- [Scottish Government — Form design](https://designsystem.gov.scot/guidance/forms/form-design) dan [Form spacing](https://designsystem.gov.scot/guidance/forms/form-spacing): kelompokkan field berdasarkan tugas, dekatkan label dengan input, dan bedakan jarak antarkelompok. SITOU menerapkannya melalui FormSection, urutan identitas → tanggal katalog → tanggal organisasi → penggunaan, satu kolom mobile dan state kosong per sumber tanggal.

- [NN/g — Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/): konfirmasi destruktif menyebut objek serta konsekuensi dengan bahasa singkat dan label aksi spesifik. SITOU memakai isi paragraf langsung dalam ConfirmDialog, tanpa panel peringatan berulang.

- [GNOME HIG — Toasts](https://developer.gnome.org/hig/patterns/feedback/toasts.html): feedback kejadian singkat tidak perlu menghentikan alur. SITOU mempertahankan Notification snackbar existing untuk hasil CRUD; status jangka panjang tidak ditampilkan sebagai modal sukses. Posisi dan visual snackbar tetap mengikuti komponen SITOU.

- [W3C — Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): ukuran/jarak target membantu akses pointer. SITOU mempertahankan standar proyek 44×44 px, dengan label aksesibel dan tooltip keyboard pada aksi ikon. Ini keputusan proyek, bukan klaim bahwa minimum WCAG AA adalah 44 px atau bahwa seluruh aplikasi sudah tersertifikasi.
