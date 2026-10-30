# Pedoman UI/UX dashboard SITOU

Pedoman ini melengkapi AGENTS.md dan katalog komponen existing. Baca aturan root, aturan folder sasaran, dokumen alur fitur dan pedoman ini sebelum mengubah UI. Instruksi pengguna terbaru tetap menjadi acuan utama.

## Urutan informasi dan pengaturan tambahan

- Tampilkan kebutuhan utama terlebih dahulu. Pada jadwal, tampilkan Nama jadwal dan dropdown Jenis jam kerja dalam satu baris pada desktop, lalu susun full width pada ponsel. Pilihan Jam kerja tetap menampilkan Hari kerja dan Jam kerja utama. Pilihan Kerja shift menampilkan Hari kerja serta kartu nama/jam setiap shift. Hindari memaksa pengguna mempelajari struktur teknis sebelum mengisi form sederhana.
- Kelompokkan field menurut tugas pengguna. Pakai judul singkat, penjelasan seperlunya, divider dan spacing 24 atau 32 px antarbagian. Jangan menambah banyak kotak dekoratif atau divider di setiap pasangan label dan nilai.
- Lipat pengaturan opsional yang tidak dibutuhkan semua pengguna. Judul harus menyebut isi, misalnya Atur jam kerja per hari. Ringkasan yang masih terlihat membantu pengguna memahami apa yang dapat diubah.
- Batasi pelipatan bertingkat. Alur utama tidak boleh membutuhkan beberapa pembukaan panel. Pada jadwal baru, satu hari khusus atau pilihan shift berisi satu rentang waktu. Jangan menambahkan pilihan jenis jam kerja, Libur atau daftar waktu kerja lagi di dalamnya. Periksa apakah pengelompokan masih mudah ditemukan.
- Pilihan shift boleh dilipat untuk merapikan form panjang. Tampilkan nama dan jam pada header, buka pilihan baru yang kosong dan pilihan dengan error, serta pertahankan isian ketika ditutup. Informasi operasional menetap menggunakan AppNotice. Filter jenis pada daftar memakai dropdown dalam OperationalFilterSection dengan deskripsi singkat, bukan tab yang mengulang fungsi filter.
- Melihat pengaturan tidak mengubah makna data. Membuka editor hari tidak langsung menjadikannya Jam khusus. Penanda berubah setelah pengguna mengubah isian. Menutup panel tidak menghapus nilai.
- Jika validasi menemukan kesalahan pada pengaturan yang terlipat, buka bagian dan hari yang terkait. Pertahankan isian dan beri pesan yang menyebut penyebab serta tindakan berikutnya. Ringkasan bukan penyimpanan sampai pengguna mengonfirmasi.

## Bahasa dan komponen

- Gunakan Bahasa Indonesia yang langsung dipahami, sentence case, label persisten, dan kalimat pendek tanpa titik koma pada teks UI. Pilih Jam kerja tetap, Kerja shift, Tambah shift, Jam kerja utama, Atur jam kerja per hari dan Jam khusus. Rotasi serta Jam fleksibel tidak menjadi pilihan form baru. Hindari Custom, Sesi, atau istilah struktur internal pada alur sederhana.
- Cari komponen bersama sebelum membuat komponen baru. Form jadwal memakai AppModal, FontStyle, FormSettingSwitch, AsyncSelect dan CompactInfoChip. Jangan menyalin warna atau membuat chip/status ad hoc.
- Chip adalah penanda, bukan tombol. Label dan bentuk harus tetap menjelaskan makna ketika warna tidak dapat dibedakan. Pada jadwal, Jam utama memakai tone neutral dan Jam khusus memakai tone info. Biru menandai konfigurasi khusus, bukan kesalahan atau persetujuan.
- Gunakan token theme untuk warna, border, radius dan permukaan. Informasi utama tetap berwarna teks normal. Hiasan tidak boleh mengurangi kontras atau menambah beban baca.

## Interaksi, responsivitas dan pemeriksaan

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
