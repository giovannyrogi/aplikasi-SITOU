# Pedoman UI/UX SITOU Dashboard

Gunakan daftar isi untuk membuka bagian yang sesuai dengan perubahan. Mulai dari standar bersama, lalu baca ketentuan fitur jika alurnya terdampak. Ikuti [AGENTS.md](../AGENTS.md#baca-sesuai-tugas) untuk menentukan cakupan bacaan.

## Daftar isi

| Tugas | Baca bagian |
| --- | --- |
| Tema, tipografi, spacing, form, tabel dan komponen | [Fondasi visual dan komponen](#fondasi-visual-dan-komponen) |
| Modal, header, footer, konfirmasi dan feedback | [Modal dan feedback](#modal-dan-feedback) |
| Judul, label, petunjuk dan pesan | [Bahasa antarmuka](#bahasa-antarmuka) |
| Alur desain, aksesibilitas dan referensi | [Proses desain](#proses-desain) |
| Ketentuan khusus | [Jadwal](#jadwal-kerja-dan-jadwal-pegawai) · [Kalender](#katalog-dan-kalender-libur) · [Pegawai](#data-pegawai-dan-pendidikan) · [Inventaris](#inventaris) · [Organisasi dan akses](#organisasi-akses-dan-dashboard) · [Lokasi dan Rekap Absensi](#lokasi-dan-rekap-absensi) |

Katalog [komponen bersama](../app/components/README.md) menjelaskan cara memakai komponen. Lihat [QA tampilan dan interaksi](rules/quality.md#qa-tampilan-dan-interaksi) untuk ukuran layar dan skenario uji, [API dan keamanan](rules/api-security.md) untuk akses serta data privat, dan [indeks fitur](README.md) untuk aturan bisnis dan kontrak server. Simpan setiap ketentuan di sumber pemiliknya dan tautkan bila perlu.

## Fondasi visual dan komponen

### Tema dan warna

- Gunakan token theme untuk warna, border, radius dan permukaan. Informasi utama tetap berwarna teks normal. Hiasan tidak boleh mengurangi kontras atau menambah beban baca.

### Kontrol, tipografi dan tata letak

- Setiap pekerjaan desain atau perombakan antarmuka wajib dilakukan dengan pendekatan UI/UX profesional: pahami tujuan pengguna dan data yang dibutuhkan, tinjau tampilan serta komponen yang tersedia, lalu susun hierarki informasi dan kelompok data sebelum implementasi. Bila diminta memakai referensi aplikasi lain, pelajari sumber resmi dan ambil prinsip yang relevan; sesuaikan dengan alur, izin, bahasa, serta tema SITOU. Jangan menyalin tampilan tanpa mempertimbangkan konteks pengguna.

- Utamakan keterbacaan dan kemudahan pemindaian: label terpisah dari nilai, data utama lebih menonjol, informasi terkait berada dalam kelompok yang jelas, dan teks panjang tetap terbaca utuh. Periksa kondisi data kosong, nama/alamat panjang, status akhir, akses keyboard, kontras, serta susunan desktop/tablet/mobile. Evaluasi hasil render dan perbaiki masalah yang ditemukan sebelum menyatakan desain selesai; perubahan visual tidak boleh mengubah arti data atau memperluas akses.

- Dropdown pilihan pada form, filter, dan pagination wajib memakai `AsyncSelect` atau adapter domain yang menyusun komponen tersebut. Pilihan harus dapat diketik/dicari berdasarkan label; jangan menambahkan `Select` tanpa pencarian. Pencarian server boleh memakai `onSearch` dan `filterOption={false}`. Menu aksi seperti Export tetap memakai komponen menu, bukan dropdown pilihan data.

- Locale tanggal dan waktu wajib dipasang terpusat melalui `app/components/approvider/AppProviders.jsx`. Seluruh DatePicker/Calendar AntD memakai locale `id_ID` dan Day.js locale `id`, sedangkan MUI date picker memakai adapter locale `id`; dilarang mengatur nama bulan, hari, placeholder, atau tombol kalender per halaman secara manual.

- Seluruh field tanggal, bulan, dan tahun pada form wajib memakai date picker dengan mode yang sesuai dari library UI yang sudah terpasang, bukan `Input` teks atau input angka manual. Gunakan date picker standar untuk tanggal, month picker untuk bulan, dan year picker untuk tahun. Nilai form menggunakan objek tanggal adapter dan hanya dinormalisasi ke format kontrak API pada batas request.

- Sebelum membuat komponen UI baru, periksa `app/components` dan gunakan komponen reusable yang sudah ada untuk fungsi/kebutuhan yang sama. Perluas API komponen yang ada bila masih dalam tanggung jawab yang sama; jangan membuat duplikat hanya karena dipakai pada halaman berbeda.

- Seluruh typography MUI wajib menggunakan reusable component `app/components/font-style/FontStyle.jsx`, bukan mengimpor `Typography` langsung pada halaman atau komponen fitur. Gunakan font weight normal `500`, medium `600`, dan bold maksimal `700`; dilarang memakai bobot di atas `700`.

- Keluarga font UI wajib bersumber dari `app/theme/typography.js`: pemuatan file lokal, APP_FONT_FAMILY, dan APP_FONT_WEIGHTS. CSS global, Material UI, Ant Design, serta grafik mengikuti konfigurasi yang sama. Jangan menulis nama font atau font stack langsung pada komponen fitur. FontStyle mengikuti theme, kontrol form native mengikuti font halaman. Lihat [penggantian dan verifikasi font](#tipografi-dan-penggantian-font).

- Implementasi UI/UX wajib mengikuti best practice React/Next.js: komponen terfokus, state minimal, aksesibilitas dasar, semantic HTML, serta styling responsif yang tidak mengandalkan ukuran layar tunggal.

- Saat memakai atau mengubah komponen library UI seperti AntD/MUI, periksa kontrak versi yang benar-benar terpasang pada type definition atau dokumentasi lokal. Dilarang menambahkan prop/API deprecated; khusus AntD 6 gunakan `Alert.title` bukan `Alert.message`, `Steps.titlePlacement` bukan `Steps.labelPlacement`, `Tabs.destroyOnHidden` bukan `destroyInactiveTabPane`, `Timeline.items.content` bukan `items.children`, dan `Space.Compact` untuk prefix/suffix field, bukan `Input.addonBefore`/`addonAfter` yang deprecated. AntD `List` juga tidak boleh dipakai karena telah deprecated; susun daftar dengan semantic HTML/reusable data view yang sesuai kebutuhan.

- Sebelum perubahan UI dianggap selesai, periksa console browser dan cari penggunaan API deprecated pada seluruh area terkait agar warning yang sama tidak berpindah ke halaman lain.

- SITOU menggunakan satu tema light yang konsisten. Jangan menambahkan dark mode, theme switcher, atau penyimpanan preferensi tema kecuali ada keputusan produk baru.

- Warna brand, status, feedback, state interaktif, dan permukaan UI wajib bersumber dari token terpusat di app/components/themeprovider/ThemeProvider.jsx. Dilarang menulis nilai hex, rgb/rgba, gradient, atau shadow berwarna langsung di halaman/komponen fitur bila token semantik yang sesuai dapat disediakan atau sudah tersedia.

- Gunakan theme.brand untuk identitas SITOU, theme.status untuk success/warning/info/danger/neutral, palette MUI untuk state komponen, dan theme.ui untuk kebutuhan visual reusable atau halaman khusus. Token AntD harus mengambil sumber warna yang sama agar MUI dan AntD konsisten.

- Aksi yang sama pada tabel menggunakan komponen, varian, dan warna yang sama. Pakai tampilan bawaan TableExportMenu untuk ekspor tabel dan tombol ikon netral untuk membuka rincian dari baris. Gunakan ukuran serta warna teks yang seragam untuk data biasa. Warna semantik dipakai untuk status, indikator, dan umpan balik yang memerlukan pembeda.

- Aksi khusus unduhan dan backup memakai `theme.action` / `ACTION_TONES`. Pada alur backup, detail memakai biru, paket lengkap teal, ZIP database biru, ZIP seluruh file ungu, verifikasi hijau, dan hapus merah. Tombol AntD memakai `data-action-tone` dengan nilai `detail|download|database|files|verify|danger` agar hover dan fokus konsisten. Sertakan label aksesibel atau ikon sesuai fungsi.

- Informasi dan peringatan panjang memakai teks rata kiri-kanan dengan baris terakhir rata kiri, pembungkusan aman, ikon di awal, serta jarak yang cukup pada mobile.

- Ikon aksi wajib sesuai objek dan tindakan: database memakai ikon database, kumpulan file memakai folder/file, paket lengkap memakai unduhan/arsip, detail memakai mata, verifikasi memakai perisai/centang, dan hapus memakai tempat sampah. Jangan memakai ikon unduh generik yang sama untuk database dan kumpulan file. Ikon tetap disertai label atau tooltip serta aria-label yang jelas.

- Ikon dan teks di dalam tombol wajib disusun `inline-flex`, rata tengah secara horizontal dan vertikal, mempunyai baseline visual yang sejajar, serta jarak yang konsisten. Ikon tidak boleh membuat teks bergeser ke atas atau bawah; verifikasi juga pada state loading, disabled, tombol lebar penuh, dan viewport mobile.

- Gunakan breakpoint yang stabil dan hindari ukuran tetap yang membuat form atau tabel terpotong. Pastikan teks dan tindakan utama dapat dijangkau dari ponsel kecil sampai desktop lebar. Cakupan pengujian mengikuti [QA tampilan dan interaksi](rules/quality.md#qa-tampilan-dan-interaksi).

- Asset logo resmi navbar memakai `public/logo-sitou-v2-transparent.png` dan teks HTML **SITOU** berwarna brand. Navbar desktop maupun mobile tidak menampilkan kepanjangan SITOU atau teks “by Perumda Pasar Manado”; aset raster lama dengan kepanjangan terdahulu tidak digunakan pada UI.

- Halaman login adalah entry awal aplikasi. Jangan menampilkan pilihan demo role; setelah login, server/client mengarahkan user berdasarkan role aktif.

- Proses paralel wajib memakai token/counter provider agar satu proses yang selesai tidak menutup backdrop milik proses lain. Gunakan loading lokal seperti skeleton, spinner tombol, atau loading select hanya untuk proses nonblocking yang terbatas pada komponen tersebut.

- Pimpinan melihat ringkasan dan histori, bukan tombol edit.

- Form panjang memakai stepper, draft server yang aman, dan peringatan perubahan belum disimpan.

- Seluruh area pemilihan/upload Excel, PDF, gambar, dan dokumen wajib menyusun reusable `app/components/forms/FileUploadField.jsx`; jangan membuat dropzone atau daftar file terpilih sendiri pada halaman fitur.

- Wizard tambah pegawai memakai draft server privat selama tujuh hari. Maksimal satu draft aktif per actor dan organisasi; draft hanya ditulis saat pengguna menekan Lanjut, Kembali, Simpan draft & tutup, atau finalisasi, memakai optimistic concurrency, dan tidak boleh menyimpan NIK/payload ke log. Perubahan field dilarang mengirim request autosave per ketikan. Close harus menunggu penyimpanan terakhir berhasil.

- File draft memakai staging `org_{organizationId}/pegawai/drafts/draft_{draftId}/...`, hanya dapat diakses pembuat draft, lalu dialihkan ke kepemilikan pegawai saat finalisasi.

- Tindakan disiplin ditampilkan profesional tanpa mempermalukan pegawai.

### Pola tampilan dan komponen bersama

- Seluruh filter daftar operasional, Data Master, Akun Organisasi, Organisasi, dan laporan wajib memakai satu komponen `OperationalFilterSection` sebagai section terpisah sebelum panel hasil. Pencarian, status, organisasi, tanggal, dan filter lain tidak boleh ditempatkan di header/toolbar tabel. Sesuaikan label, placeholder, dan pilihan dengan data serta parameter API yang benar-benar didukung; jangan memfilter hanya halaman hasil yang sedang dimuat. Gunakan props pencarian/status bersama untuk daftar sederhana dan `items` untuk kebutuhan domain. Dropdown wajib dapat dicari. Atur ulang mengembalikan filter dan pagination ke awal tanpa melepas konteks organisasi wajib atau memperluas scope akses. Fitur/menu baru mengikuti aturan ini.

- `OperationalFilterSection` memakai maksimal empat field per baris pada desktop (>=1200px), tiga pada tablet lebar (900-1199px), dua pada 600-899px, dan satu pada mobile (<600px). Field berikutnya mengalir ke baris baru; dilarang memadatkan lima atau lebih field dalam satu baris desktop. Gunakan padding dan jarak komponen terpusat, bukan override halaman.

- Katalog komponen berada di `app/components/README.md` dan wajib diperbarui setiap reusable component dibuat, dipindah, atau diubah kontraknya.

- Seluruh logo SITOU wajib memakai `app/components/branding/AppLogo.jsx`. Path aset hanya diubah melalui `APP_LOGO_ASSETS`; dilarang menulis path file logo langsung pada halaman atau komponen lain.

- Reusable component diberi nama berdasarkan fungsi umum dan disimpan berdasarkan tanggung jawab, bukan berdasarkan nama menu pertama yang menggunakannya.

- Komponen hanya boleh dihapus setelah seluruh import, pemanggilan dinamis, route, dan dokumentasi diperiksa.

- Form panjang yang memakai tab, step, atau collapse wajib menampilkan `Notification` pada setiap kegagalan validasi/simpan, menandai section bermasalah dengan state error yang jelas, membuka section tersebut, lalu menggulir dan memfokuskan field error pertama. Error tidak boleh hanya terlihat pada field yang sedang tertutup atau gagal diam-diam; penanda section harus hilang setelah isian terkait valid.

- Breadcrumb halaman wajib bersumber dari konfigurasi menu melalui `AppBreadcrumbs`. Parent tanpa path tampil sebagai konteks nonklik, sedangkan route turunan mengikuti menu terdekat yang paling spesifik.

- Area daftar operasional wajib memeriksa dan memakai reusable `DataPanel` sebelum membuat wrapper baru. Tabel/card list dan pagination berada dalam satu paper tanpa nested panel. Filter berada pada section terpisah; header/toolbar panel hasil hanya untuk aksi hasil seperti export, muat ulang, atau seleksi data.

- Navigasi tab detail wajib memeriksa dan memakai `navigation/DetailTabs` sebelum membuat shell baru. Active state harus jelas, target sentuh minimal 44px, dapat dioperasikan dengan keyboard, dapat dipertahankan melalui URL bila relevan, dan tidak menyebabkan horizontal page overflow pada mobile.

- Ringkasan halaman detail wajib menyajikan setiap fakta satu kali; dilarang mengulang nomor, status, identitas, atau metadata yang sama pada beberapa section. Gabungkan profil dan identitas yang berasal dari sumber data yang sama, tampilkan bukti visual penting dekat konteksnya, dan pindahkan informasi administratif khusus ke tab tersendiri bila membuat ringkasan sulit dipindai.

- Aksi utama detail ditempatkan konsisten di kanan header section pada desktop dan menjadi mudah dijangkau atau lebar penuh pada mobile. Aksi tidak boleh bercampur di antara nilai data atau menggeser hierarchy informasi.

- Tab Dokumen pada detail pegawai hanya menjadi checklist kelengkapan tanpa upload, nama file, atau aksi file. Status tersedia wajib berasal dari record domain yang masih mereferensikan metadata file aktif; file yatim atau metadata yang sudah dilepas tidak boleh membuat dokumen terlihat tersedia. Pengelolaan dan satu-satunya aksi buka dokumen berada pada konteks domainnya: identitas di Profil Lengkap, kontrak di tab Kontrak, SK di tab Penempatan, serta ijazah/sertifikat di tab Pendidikan.

- Halaman detail harus mudah dipindai pada kondisi data kosong, nama panjang, dan informasi yang berbeda menurut role. Jaga perataan dan jarak antarkelompok. Section harus informatif tanpa nested card berlebihan.

- Setiap fungsi exported, resolver, transformasi data, lifecycle async, serta baris penting atau non-obvious wajib memiliki komentar singkat tentang tujuan atau alasan implementasinya. Komentar dilarang sekadar mengulang sintaks yang sudah jelas.

- AntD Table digunakan pada tablet/desktop. Mobile memakai card list dari data yang sama beserta loading, empty/error, dan pagination yang dapat dijangkau.

- Identitas dan status administratif organisasi disimpan pada `organizations`; masa akses tidak boleh disimpan kembali sebagai kolom tanggal pada tabel tersebut.

- Histori masa akses organisasi bersumber dari `organization_subscriptions` dengan `starts_on`, `ends_on`, `grace_ends_on`, dan status lifecycle. Perpanjangan selalu membuat record baru, tidak boleh menimpa histori, dan periode efektif tidak boleh overlap.

- Session organisasi selalu divalidasi ulang terhadap `users.is_active`, role aktif, `organizations.is_active`, dan status langganan efektif `active` atau `grace`. Login Admin/HRD tidak diblokir oleh lokasi scope selama organisasi dan langganan aktif; scope hanya membatasi data yang dapat dikelola. Pimpinan yang memiliki `user_location_scopes` wajib masih mempunyai lokasi efektif. Pegawai wajib memiliki profil `employees` aktif, penempatan utama efektif, lokasi administratif/operasional aktif, dan `organization_units` aktif. Status langganan tetap dihitung dari tanggal dan timezone organisasi walaupun job rekonsiliasi terlambat.

- Umur operasional lokasi memakai `operational_from` dan `operational_until`; nama `active_from`/`active_until` tidak digunakan pada `locations`.

- Peringatan maksimal 30 hari dan masa tenggang tampil di shell dengan tombol `Perpanjang`.

- UI harus modern, sederhana, elegan, profesional, user friendly, dan mudah dipahami pengguna nonteknis. Kreativitas diterapkan melalui hierarchy, komposisi, iconography, spacing, microinteraction, dan state, bukan dekorasi berlebihan.

- Merah SITOU hanya menjadi aksen, primary action, active state, dan status penting. Permukaan utama memakai putih/abu netral dan teks gelap dari theme/token.

- Kontras teks normal minimal 4.5:1; teks besar, ikon penting, border interaktif, dan focus indicator minimal 3:1. Status selalu memakai label/ikon selain warna.

- Target sentuh minimal 44x44px. Radius maksimal 8px kecuali avatar, status pill, dan elemen lingkaran. Shadow harus lembut dan tidak mendominasi.

- Teks harus terbaca, tidak bertumpuk dengan background/ikon, dan memakai wrap, ellipsis, atau tooltip sesuai konteks. Komponen tidak boleh berdempetan, overlap, keluar container, atau membuat horizontal page overflow.

- Kartu mobile wajib memakai track grid yang dapat menyusut (`minmax(0, 1fr)`) dan `min-width: 0` pada item flex/grid. Nama dan metadata panjang harus tetap terbaca tanpa mendorong tombol aksi keluar kartu. Uji batas elemen di dalam kartu dengan teks panjang termasuk tanpa spasi; sekadar menyembunyikan overflow halaman bukan perbaikan.

- Dilarang memakai orb, bokeh, gradient dekoratif, nested card, shadow tebal, radius berlebihan, palette satu nada, padding ekstrem, atau dekorasi yang mengurangi keterbacaan.

- Gunakan elevasi halus dari token tema untuk memperjelas hierarki, misalnya pada satu panel utama dalam modal. Pertahankan permukaan lain dengan pemisah atau border ringan agar informasi mudah dipindai pada layar sempit.

- Komposisi jenis kelamin, status pegawai, masa kerja, jenis kepegawaian, lokasi, dan unit adalah snapshot kondisi saat ini tanpa filter tanggal. Kasus disiplin resmi dan aktivitas terbaru maksimal lima item tanpa batas rentang tanggal; prioritas maksimal lima item terpenting. Seluruh data tetap mengikuti role, organisasi, serta cakupan lokasi actor di backend.

- Grafik dinamika pegawai tidak boleh mengulang snapshot status aktif. Gunakan arus pegawai baru dan pegawai keluar per periode, sedangkan kondisi aktif, masa percobaan, dan cuti tetap berada pada visual Status Pegawai.

- Adapter ApexCharts wajib menormalkan kategori kosong dan nilai nonnumerik sebelum render. Label `NaN`, `undefined`, atau sumbu kategori kosong dilarang tampil kepada pengguna.

### Jarak form dan bantuan field

- Jarak section mengikuti FormSection: padding vertikal 24 px; `first` hanya pada section paling awal form. Jangan memakai `:first-of-type` untuk menghapus jarak karena wrapper kondisional/nested dapat membuat section tengah dianggap pertama. Periksa jarak nyata di kedua sisi divider, termasuk ketika metode pengisian berganti.

- Gunakan AppCollapse untuk seluruh pelipatan konten; adapter region navigasi/accordion laporan berada pada fondasi yang sama. Nama hari, kategori/jumlah dan status tetap terlihat ketika tertutup. Pertahankan state terkontrol activeKey/onChange dan gunakan forceRender bila form membutuhkannya. Pertahankan isian terdaftar, panel error dan keyboard. Jangan membuat shell pelipatan per fitur atau mengimpor primitive library langsung. Header interaktif minimal 44px; field wajib utama tetap terlihat.

- Teks bantuan `Form.Item extra` memakai spacing terpusat: minimal 8px dari control,
  line-height 1.6, serta 4px padding bawah sebelum margin antar-field. PrerequisiteHint
  memakai gap 8px antara penjelasan dan tautan; target sentuh tetap minimal 44px.

- Jangan menempelkan teks bantuan ke border input/dropdown atau memberi margin negatif.
  Pertahankan jarak antar-field dan uji informasi panjang pada desktop/mobile.
  Gunakan token/style reusable; jangan menambah override spacing per halaman.

### Tipografi dan penggantian font

### Satu tempat pengaturan

`app/theme/typography.js` adalah sumber font antarmuka aplikasi:

- `appFont` memuat file Poppins lokal dengan `next/font/local`.
- `APP_FONT_FAMILY` menentukan keluarga font dan font cadangan.
- `APP_FONT_WEIGHTS` menentukan bobot normal 500, medium 600, dan bold 700.

Untuk mengganti font, sediakan file font lokal berlisensi lalu ubah daftar `src` dalam `appFont` pada file tersebut. Path dihitung dari `app/theme/typography.js`. Sesuaikan bobot file yang tersedia; pertahankan nama variabel generik `--font-app`. Ubah `APP_FONT_FAMILY` hanya bila font cadangan perlu diganti. Jalankan ulang build setelah mengganti file font.

Jangan menambahkan `fontFamily` berisi nama font langsung pada komponen fitur. Ukuran, ketebalan, dan warna teks tetap mengikuti fungsi komponen dan token yang berlaku.

### Pemakaian

- `app/layout.js` memasang variabel font pada elemen html serta meneruskan keluarga font melalui `--sitou-font-family`.
- `app/globals.css` memakai variabel tersebut untuk halaman; kontrol form native mengikuti font parent.
- Theme Material UI dan ConfigProvider Ant Design membaca `APP_FONT_FAMILY` yang sama, termasuk komponen popup di body.
- `FontStyle` dan breadcrumb mengikuti theme Material UI; tidak menentukan nama font sendiri.
- Grafik mengikuti `theme.typography.fontFamily` melalui adapter grafik yang sudah ada.

Font disertakan dalam repo; development dan production tidak memerlukan unduhan Google Fonts. Lisensi berada di `app/fonts/poppins/OFL.txt`. Pengaturan ini untuk UI web; font dokumen Excel/PDF diatur pada generator masing-masing.

### Verifikasi

Periksa font yang benar-benar digunakan browser, bukan hanya nama dalam CSS: login, judul, label, tombol, input, tabel, dropdown portal, dan teks SVG grafik. Periksa Poppins berhasil dimuat, tidak ada request Google Fonts, console bersih, serta tidak muncul overflow pada mobile. Jalankan ESLint dan production build; file pengujian sementara wajib dibersihkan setelah selesai.

## Modal dan feedback

### Susunan modal

- Semua area bergulir di AppModal menyembunyikan scrollbar secara terpusat, termasuk isi panjang, header/pagination pada layar pendek dan region di dalamnya. Tetap gunakan overflow auto, roda/touch serta keyboard; body dapat difokuskan dengan Tab. Jangan memakai overflow hidden untuk menyembunyikan scrollbar.

- Baris utama header selalu ikon–judul–tutup. Deskripsi mobile berada di baris kedua selebar header. Di desktop, deskripsi sejajar kolom judul. Ukuran ikon, font, padding, divider dan target tombol tutup berasal dari AppModal.

- Header, pagination dan footer tetap terlihat, hanya isi yang bergulir. `contentResetKey` mengembalikan body ke atas ketika halaman berubah. Opsi `scrollHeaderWithContent` sudah dihapus dan tidak boleh dibuat kembali.

- Pada layar pendek atau teks diperbesar, area header dibatasi 40dvh dan dapat digulir secara lokal bila isinya terlalu panjang. Area pagination dapat menyusut dan digulir bila diperlukan. Ini fallback aksesibilitas bersama untuk menjaga footer tetap terjangkau, bukan varian layout per fitur atau alasan mengecilkan teks.

- Kelompokkan field menurut tugas pengguna. Pakai judul singkat, penjelasan seperlunya, divider dan spacing 24 atau 32 px antarbagian. Jangan menambah banyak kotak dekoratif atau divider di setiap pasangan label dan nilai.

### Footer dan keyboard

- Footer AppModal pada mobile (<600px) menyusun setiap tombol pada baris sendiri, selebar area, tinggi minimal 44px dan jarak 12px. Aturan berlaku juga untuk tombol dalam AntD Space. Desktop tetap sejajar. Gunakan footer bersama tanpa membuat susunan tombol per modal.

- Header panel harus dapat dioperasikan dengan Enter dan Space, mempunyai status terbuka/tertutup yang benar, serta urutan Tab yang jelas. Gunakan perilaku komponen library yang versinya sudah diperiksa. Jangan menyisipkan tombol interaktif ke dalam tombol header lain.

### Konfirmasi dan hasil CRUD

- Konfirmasi hapus memakai ConfirmDialog dengan penjelasan langsung: objek, konsekuensi permanen dan dampak dokumen. Tidak membungkus penjelasan atau penolakan hapus dalam AppNotice/Alert. Informasi referensi terpakai tetap terbaca sebagai isi dialog.

- Setelah CRUD berhasil, tutup modal terkait dan tampilkan Notification melalui useAppNotification (snackbar bersama). Jangan membuka atau mempertahankan modal untuk menyampaikan sukses CRUD. Jika gagal, pertahankan isian dan konteks. Validasi dan status yang belum pasti tetap dapat dijelaskan inline.

- Penghapusan database yang sukses dengan PDF belum bersih menggunakan snackbar yang menyebut pembersihan sedang diproses. Pemantauan receipt hanya saat ada pekerjaan dan tab terlihat; selesaikan dengan snackbar, tanpa modal sukses. Ketidakpastian hasil request tetap memerlukan Periksa status sebelum retry.

### Komponen di dalam modal

- Semua modal baru maupun lama wajib menyusun `app/components/modals/AppModal.jsx`. Konfirmasi memakai `ConfirmDialog`, preview gambar memakai `ImagePreviewModal`, dan keduanya tetap menyusun AppModal. Dilarang membuat shell Modal/Dialog library, dialog HTML, backdrop, header, tombol tutup atau footer modal sendiri. Perubahan pola visual hanya atas permintaan eksplisit pengguna dan diterapkan pada komponen bersama.

- Isi modal memakai fondasi reusable sesuai fungsi: `FontStyle`, `AppNotice`, `CompactInfoChip`, `FormSettingSwitch`, `AsyncSelect`, `AppTimePicker`, `ResponsiveRangePicker`, `FileUploadField`, `ResponsiveDataView` dan `DataPagination`. Wrapper domain boleh menyusun fondasi tersebut untuk validasi/data khusus, bukan menduplikasi desain. Status/keterangan tetap berteks selain warna. Sesi kedaluwarsa boleh menonaktifkan tutup melalui props existing, tanpa shell lain.

### Aksi dan kondisi antarmuka

- Validasi gagal dan tampilan Notification dilarang me-reset, me-remount, atau memuat ulang nilai form yang sedang diisi. Efek inisialisasi modal/wizard wajib memakai dependency stabil dan hanya dijalankan ketika sesi form, organisasi, atau record yang diedit benar-benar berubah.

- Tombol aksi wajib memakai warna semantik yang tegas dari theme sesuai dampaknya: aksi utama memakai merah brand SITOU; hapus, batalkan proses, dan tindakan destruktif memakai danger merah; lihat, informasi, atau periksa ulang memakai info biru; unduh memakai token aksi sesuai jenisnya; pulihkan atau konfirmasi berhasil memakai success hijau; karantina dan tindakan yang memerlukan kewaspadaan memakai warning amber. Tombol sekunder netral dan tombol `Batal` yang hanya menutup dialog tanpa mengubah data tetap boleh netral. Dilarang memakai tint pucat pada tombol aksi utama atau destruktif; state disabled dikecualikan.

- Jarak aman wajib memakai skala 8/12/16/24/32px: minimal 12px antar tombol, 16px antar field atau fakta berbeda, dan 24px antar section serta antara informasi dan kelompok aksi. Pasangan label-nilai boleh 8px. Kartu mobile memakai padding minimal 16px, metadata berlabel, pemisah sebelum aksi, dan tombol lebar penuh bila aksi bertumpuk. Jangan merapatkan komponen untuk menghindari scroll; pastikan fokus keyboard tidak terpotong dan target sentuh minimal 44px. Header serta isi kolom Aksi harus rata tengah terhadap lebar sel yang sama, termasuk kelompok tombol.

- Login, perpindahan menu/halaman, pengambilan data halaman, dan seluruh proses CRUD wajib memakai reusable Backdrop.jsx melalui LoadingBackdropProvider. Backdrop dibuka tepat sebelum proses dimulai dan ditutup hanya setelah promise proses selesai; dilarang menambahkan delay atau durasi minimum buatan.

- Sediakan loading, skeleton, empty, no-result, validation error, server error, permission denied, session expired, dan confirmation dialog.

### Komponen feedback dan pratinjau

- Form CRUD memakai dirty-state warning, validasi dekat field, mencegah submit ganda, dan menjelaskan dampak aksi berisiko.

- Gunakan `PageHeader`, `OperationalFilterSection`, `ResponsiveDataView`, `CompactInfoChip`, `RowActionMenu`, `ConfirmDialog`, select reusable, `Notification`, dan `LoadingBackdrop` sebelum membuat implementasi fitur sendiri. `CompactInfoChip` adalah satu-satunya chip untuk metadata dan status; dilarang membuat badge/chip reusable kedua dengan fungsi yang sama.

- Panel informasi yang menetap pada halaman, form, dan modal wajib memakai `app/components/data-display/AppNotice.jsx`, termasuk penjelasan izin dan petunjuk singkat tentang pengambilan data otomatis. Gunakan `tone="info"` (biru), `warning` (kuning), `success` (hijau), atau `danger` (merah) sesuai makna; judul dan langkah berikutnya harus jelas. Isi paragraf `AppNotice` mengikuti aturan justify secara default; jika pesan utama memang perlu rata tengah, gunakan override `descriptionAlign="center"` secara eksplisit. Jangan menerapkan justify pada judul atau tombol. Jangan membuat kotak informasi ad hoc atau mencampur `Alert` Ant Design/MUI untuk fungsi ini. `Notification` tetap khusus pesan sementara dan validasi. Fitur yang nonaktif harus menyebut organisasi terdampak, pihak yang dapat mengaktifkan, dan lokasi pengaturannya bila tersedia.

- Seluruh daftar/tabel yang berpaginasi wajib memakai `app/components/data-display/DataPagination.jsx` pada desktop dan mobile, termasuk laporan dan ledger cursor. Footer konsisten menampilkan total hasil filter, Sebelumnya/Berikutnya, dan pilihan 10/20/50 baris per halaman bila ukuran halaman didukung API; daftar berukuran tetap tidak menampilkan pemilih yang tidak berfungsi. Jangan mengandalkan pagination bawaan AntD atau membuat footer duplikat pada fitur baru.

- `AppModal` harus mendukung ukuran `sm`, `md`, `lg`, `xl` atau custom width, header/footer tetap, konten scrollable, focus management, Escape/backdrop policy, form submit, dan hampir full-screen pada mobile.

- `ImagePreviewModal` hanya menerima URL endpoint privat, blob, atau file lokal; jangan pernah mengirim `object_key` ke browser.

- Seluruh aksi melihat gambar, termasuk pas foto, KTP, Kartu Keluarga, BPJS, NPWP, ijazah, sertifikasi, serta gambar fitur berikutnya, wajib memakai reusable `app/components/modals/ImagePreviewModal.jsx`. Dilarang membuka gambar langsung melalui tab browser, `window.open`, modal baru, atau preview shell khusus fitur; dokumen non-gambar tetap mengikuti viewer/unduh berizin sesuai jenis file.

- Gunakan spacing scale `4, 8, 12, 16, 24, 32px`: ikon-teks 8-12px, antar-control 8-12px, antar-field 16-20px, panel/modal 16px mobile dan 20-24px desktop, halaman 16/24/32px, serta antar-section 24-32px.

- Wadah scroll internal pada kartu, panel grafik, dan daftar ringkas wajib menyembunyikan scrollbar melalui CSS lokal (`scrollbar-width: none` dan `::-webkit-scrollbar`), tanpa menonaktifkan scroll mouse, trackpad, sentuhan, atau keyboard. Pertahankan batas tinggi, nama aksesibel, serta indikator fokus untuk wadah yang menerima fokus. Jangan memakai `overflow: hidden` untuk memotong data atau menyembunyikan scrollbar halaman utama secara global. Terapkan aturan pada komponen reusable agar seluruh pemakainya konsisten.

## Bahasa antarmuka

### Audit istilah

- Audit istilah satu alur secara utuh, termasuk form, tinjauan, bantuan, placeholder, error API dan hasil proses. Satu konsep harus memakai istilah yang sama, bukan sinonim bergantian. Ubah jadwal harian memakai jam kerja pada seluruh state, jadwal utama untuk jadwal rutin, serta tanggal mulai dan selesai pada field tanggal. Judul bagian mengikuti tindakan: Jam kerja pengganti atau Jam kerja tambahan. Label sumber memakai Jadwal kerja dan Pilihan shift, bukan sesi internal. Periksa contoh istilah di komponen dan pesan server sebelum menyatakan bahasa sudah konsisten.

- Gunakan Bahasa Indonesia yang langsung dipahami, sentence case, label persisten, dan kalimat pendek tanpa titik koma pada teks UI. Pilih Jam kerja tetap, Kerja shift, Tambah shift, Jam kerja utama, Atur jam kerja per hari dan Jam khusus. Rotasi serta Jam fleksibel tidak menjadi pilihan form baru. Hindari Custom, Sesi, atau istilah struktur internal pada alur sederhana.

### Aturan penulisan antarmuka

- Teks penjelasan/informasi memakai Bahasa Indonesia yang sederhana, singkat, dan langsung menjelaskan fungsi atau dampak aksi. Utamakan 1–3 kalimat. Hindari pengulangan, istilah teknis yang tidak diperlukan, dan paragraf bertele-tele. Jangan memakai tanda titik koma (`;`) pada label, bantuan, deskripsi, notifikasi, atau pesan validasi UI. Pisahkan penjelasan menjadi kalimat pendek atau daftar yang jelas. Aturan ini tidak melarang titik koma pada sintaks kode, SQL, atau format teknis yang membutuhkannya. Detail lanjutan ditempatkan pada dokumentasi atau konteks yang relevan.

- Panjang teks wajib mengikuti perannya. Judul menyebut tindakan/objek secara
  ringkas (utamakan 2–5 kata), bukan kalimat penjelasan panjang. Subjudul cukup
  satu kalimat pendek sebagai konteks, tanpa mengulang judul. Deskripsi boleh
  lebih rinci (umumnya 1–3 kalimat), tetapi tetap singkat, jelas, dan menjelaskan
  dampak serta informasi yang diperlukan pengguna untuk mengambil keputusan.
  Pakai kata umum yang mudah dipahami pengguna nonteknis; hindari istilah samar
  seperti "semula" bila acuannya tidak jelas. Sebut objek, tanggal, atau keadaan
  secara langsung, misalnya "Tanggal berakhirnya tidak berubah". Judul,
  subjudul, deskripsi, tombol, dan validasi harus menyampaikan makna yang
  konsisten; jangan menghilangkan dampak penting hanya agar teks lebih pendek.
  Periksa pembungkusan dan keterbacaan pada mobile tanpa memotong informasi.

- Paragraf penjelasan/informasi memakai alignment justify dengan baris terakhir mengikuti perilaku paragraf normal. Gunakan `FontStyle explanation` atau komponen deskripsi terpusat; jangan menerapkan justify pada judul, label field, angka, metadata, atau tabel. Penjelasan yang sengaja didesain center, seperti pesan utama modal hapus backup, tetap center melalui override eksplisit. Uji pada mobile agar kata, jarak, dan lebar paragraf tetap mudah dibaca.

- Satu konsep memakai satu istilah yang sama sepanjang alur: petunjuk, judul bagian, label, placeholder, pilihan, validasi frontend/API, tinjauan, loading, notifikasi dan pesan gagal harus selaras. Tentukan istilah sebelum menulis UI dan periksa ulang tiap state; jangan berganti sinonim tanpa perbedaan makna. Pada Ubah jadwal harian gunakan jam kerja, bukan bergantian jam kerja/waktu kerja, serta jadwal utama secara konsisten untuk penetapan rutin.

- Setiap pembuatan/perubahan fitur atau komponen wajib meninjau bahasa judul, label, tombol, bantuan, validasi, keadaan kosong dan notifikasi sebelum selesai. Gunakan kata yang umum dipakai, kalimat pendek, tindakan konkret, dan istilah konsisten dengan fitur sejenis. Sebut objek serta akibatnya dengan jelas, misalnya jam kerja berlaku untuk semua tanggal yang dipilih. Hindari istilah teknis, frasa kaku atau kata samar jika tersedia padanan sehari-hari; jangan menyederhanakan sampai makna aturan bisnis berubah. Masukkan pemeriksaan bahasa ke QA frontend bersama render dan keyboard.

- Gunakan nama kegiatan yang dikenal pengguna dalam judul, penjelasan, dan pesan kosong. Untuk daftar cuti/izin, gunakan “cuti dan izin” atau “riwayat cuti dan izin”, bukan “pencatatan”. Contoh: “Lihat lima cuti dan izin terbaru Anda.” Sesuaikan istilah dengan proses sebenarnya; jangan menyebut seluruh data sebagai “pengajuan” jika juga mencakup cuti/izin yang dimasukkan HRD. Istilah “pencatatan” tetap dapat dipakai ketika memang menjelaskan waktu, pelaku, atau proses audit.

- Label, judul, tombol, bantuan, dan pesan validasi wajib menyebut isi atau tindakan dengan bahasa kerja yang langsung dipahami pengguna, sesuai fungsi kontrolnya. Hindari istilah struktur data atau label abstrak seperti "Nama jenis", "Jenis aktif", dan kode teknis ketika pengguna sebenarnya diminta memberi nama pilihan atau menentukan apakah pilihan tersebut tersedia. Gunakan pola yang konsisten, misalnya "Nama cuti atau izin", "Kelompok", "Kurangi jatah pegawai", dan "Tersedia untuk digunakan". Istilah teknis tetap boleh dipakai pada schema, kode program, dan dokumentasi pengembang, tetapi tidak ditampilkan sebagai beban input pengguna.

- Untuk teks yang dibaca pengguna, sebut objek konkretnya: "cuti atau izin" untuk permintaan cuti/izin, "transaksi" untuk perubahan stok, dan "disimpan pada" untuk waktu penyimpanan. Jangan memakai "pencatatan" sebagai nama generik objek/aksi. "Catatan" tetap tepat bila field benar-benar berisi keterangan bebas. Jatah tahunan dari aturan harus dibedakan dari saldo resmi yang sudah masuk ledger.

- Kelola Profil Lengkap harus memuat dan menampilkan data profil yang telah tersimpan untuk diedit, sementara section tanpa data tetap kosong. Checkbox yang berkaitan dengan satu input ditempatkan berurutan tepat di bawah input tersebut; pilihan tingkat keahlian memakai dropdown istilah Bahasa Indonesia yang baku.

- Petunjuk import yang tampil di workbook, modal, dan dokumentasi wajib memakai satu definisi terpusat. Setiap sheet harus diberi label Wajib, Wajib bersyarat, atau Opsional beserta fungsi, kapan diisi, dan aturan penting dengan Bahasa Indonesia yang mudah dipahami.

### Konsistensi teks dan grafik

- Setiap pembuatan atau perubahan UI/UX wajib diperiksa kerapian alignment, baseline, hierarchy, lebar control, spacing, dan konsistensi antarhalaman yang memakai alur serta komponen sama. Breadcrumb, judul, deskripsi, toolbar, tabel, dan aksi tidak boleh tampak bergeser, berdempetan, terlalu melebar, atau berbeda struktur tanpa alasan produk yang jelas.

- Enum dan status backend yang dibaca pengguna wajib diterjemahkan ke Bahasa Indonesia. Data kosong memakai kalimat kontekstual seperti `Belum ditempatkan` atau `Belum diunggah`, bukan kode mentah atau tanda hubung yang ambigu.

- Grafik dashboard harus menjawab kebutuhan monitoring atau pengambilan keputusan, bukan menjadi dekorasi. Setiap grafik wajib memiliki judul, konteks, legend bila multi-seri, tooltip Bahasa Indonesia, tinggi stabil, serta state loading, kosong, dan error.

## Proses desain

### Interaksi dan aksesibilitas

- Target sentuh minimal 44 px untuk aksi. Chip informasi boleh lebih kecil karena tidak interaktif. Pertahankan fokus yang terlihat dan jangan memotong pesan validasi.

- Susun pasangan jam dalam dua kolom pada desktop dan satu kolom pada ponsel. Gunakan minmax(0, 1fr), pembungkusan aman dan ukuran fleksibel. Jangan mengurangi font atau memotong informasi penting untuk memaksakan layout.

- Catat hasil aktual, batas pemeriksaan dan pembersihan artefak di changelog. Pemeriksaan kode tidak menggantikan pemeriksaan render. Jangan mengklaim riset pengguna atau kepatuhan penuh WCAG hanya karena memakai komponen library.

### Acuan pelipatan konten

- [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) menjelaskan penundaan pilihan lanjutan agar alur utama lebih mudah dipelajari. Diterapkan pada pengaturan hari khusus dan toleransi waktu.

- [GOV.UK — Accordion](https://design-system.service.gov.uk/components/accordion/) menjelaskan risiko menyembunyikan konten, judul yang singkat, dan pentingnya menguji kegunaan accordion. Di SITOU, isian wajib utama tetap terlihat. Pelipatan dibatasi pada kebutuhan opsional berdasarkan masukan pemilik aplikasi, bukan diterapkan ke seluruh form secara otomatis.

- [W3C WAI — Accordion Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) menjadi acuan keyboard dan status aksesibel. Komponen existing tetap perlu diuji pada hasil render.

Referensi diperiksa 29 Oktober 2026. Ini pedoman implementasi yang disesuaikan dengan SITOU, bukan pemasangan skill pihak ketiga atau klaim sertifikasi aksesibilitas.

- Tombol ikon tetap memiliki nama aksesibel dan tooltip yang dapat muncul pada hover serta fokus keyboard. Gunakan AppIcon dan Tooltip existing, dengan target 44×44px. Bila teks disembunyikan di desktop, pertahankan teks pada ponsel ketika membantu memahami aksi. Label form dapat membungkus pada teks besar melalui API labelWrap existing, bukan dipotong.

### Alur kerja sebelum dan sesudah implementasi

1. Pahami tugas pengguna, perannya, data yang dibutuhkan dan hasil akhirnya. Baca aturan root/folder, alur fitur, pedoman UI/UX dan katalog komponen sebelum menulis perubahan frontend.

2. Audit layar dan komponen existing. Tentukan hierarki judul/field/aksi, kelompok informasi, istilah pengguna, serta satu aksi utama. Tuliskan keputusan desain singkat dalam pembaruan pekerjaan; tidak perlu meminta persetujuan tambahan untuk pilihan rutin yang sudah masuk lingkup tugas.

3. Untuk pola baru atau perbaikan UX yang belum memiliki acuan SITOU, periksa sumber profesional primer yang relevan, lalu catat tautan, tanggal pemeriksaan dan penerapannya di pedoman. Untuk penerapan pola existing, gunakan keputusan yang sudah didokumentasikan agar visual tetap konsisten.

4. Rancang alur desktop/mobile dan state kosong, terisi, loading, gagal, berhasil, read-only serta terkunci sebelum implementasi. Tentukan perilaku keyboard, fokus, nama aksesibel, teks panjang dan layout layar pendek. Periksa risiko hilangnya isian atau perubahan makna data.

5. Susun fondasi reusable. Form berkelompok memakai FormSection; aksi ikon memakai IconActionButton dengan label/tooltip dan target 44×44 px. Item menu aksi tetap memiliki ikon outline sesuai fungsi beserta teks. Footer/header modal tetap dari AppModal.

6. Verifikasi render dan keyboard pada breakpoint yang terdampak, proses CRUD dan pemulihan kegagalan; catat hasil aktual beserta batas pemeriksaan di CHANGELOG. Bersihkan artefak QA sementara. Jangan menyatakan desain selesai hanya berdasarkan lint/build.

### Referensi desain

- [Ant Design DatePicker](https://ant.design/components/date-picker/) dan [Collapse](https://ant.design/components/collapse/): gunakan picker tahun/read-only input/disabledDate untuk seleksi tahun; Collapse forceRender mempertahankan field yang ditutup. SITOU menambahkan pembukaan panel dan fokus saat validasi serta pembatasan ukuran popup, bukan mengubah kontrak tahun numerik atau membuat modal bertumpuk. Ini referensi API komponen, bukan alasan membatasi pembacaan histori.

- [Scottish Government — Form design](https://designsystem.gov.scot/guidance/forms/form-design) dan [Form spacing](https://designsystem.gov.scot/guidance/forms/form-spacing): kelompokkan field berdasarkan tugas, dekatkan label dengan input, dan bedakan jarak antarkelompok. SITOU menerapkannya melalui FormSection, urutan identitas → tanggal katalog → tanggal organisasi → penggunaan, satu kolom mobile dan state kosong per sumber tanggal.

- [NN/g — Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/): konfirmasi destruktif menyebut objek serta konsekuensi dengan bahasa singkat dan label aksi spesifik. SITOU memakai isi paragraf langsung dalam ConfirmDialog, tanpa panel peringatan berulang.

- [GNOME HIG — Toasts](https://developer.gnome.org/hig/patterns/feedback/toasts.html): feedback kejadian singkat tidak perlu menghentikan alur. SITOU mempertahankan Notification snackbar existing untuk hasil CRUD; status jangka panjang tidak ditampilkan sebagai modal sukses. Posisi dan visual snackbar tetap mengikuti komponen SITOU.

- [W3C — Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): ukuran/jarak target membantu akses pointer. SITOU mempertahankan standar proyek 44×44 px, dengan label aksesibel dan tooltip keyboard pada aksi ikon. Ini keputusan proyek, bukan klaim bahwa minimum WCAG AA adalah 44 px atau bahwa seluruh aplikasi sudah tersertifikasi.

## Ketentuan khusus per fitur

### Jadwal kerja dan jadwal Pegawai

#### Membuat, merevisi dan menetapkan jadwal

- Pemilihan Kalender libur pada jadwal tetap/shift langsung berarti mengikuti tanggal liburnya. Hilangkan dropdown Saat tanggal libur; payload diturunkan dari kalender terpilih, bukan field tersembunyi yang masih memerlukan validasi. Menghapus kalender mengembalikan aturan libur mingguan jadwal. Data lama tetap utuh sampai penyimpanan eksplisit/revisi bertanggal.

- Jadwal terpakai tetap dapat diedit hari, jam dan kalender. Form menampilkan Mulai berlaku perubahan, date picker paling cepat besok/setelah versi terakhir, alasan dan AppNotice rata kiri tentang perlindungan histori. Tinjauan wajib menyebut tanggal berlaku serta alasan; kembali/gagal mempertahankan isian. Jangan mengunci semua pengaturan karena sudah dipakai. Jenis tetap/shift tetap identitas struktur, tanpa konversi diam-diam. Hindari divider ganda pada pertemuan FormSection dan section existing.

- Mulai berlaku jadwal hanya hari ini/mendatang dalam zona organisasi, dan tidak sebelum tanggal bergabung paling akhir dari pilihan. DatePicker memblokir tanggal tersebut dan validasi form/server mengulang pemeriksaan. Jangan menerapkan pembatasan ini ke filter historis.

- Ringkasan banyak Pegawai memakai avatar privat/initial bersama, jumlah sisa dan total pilihan. Hanya jumlah >1 menjadi tombol pembuka daftar. Daftar dibuka inline melalui AppCollapse, dengan scroll lokal berbatas tinggi dan footer total data; form, judul dan footer tidak diganti. Hindari tombol foto bersarang di tombol ringkasan: avatar di dalamnya noninteraktif.

- Perubahan massal periode harus menjelaskan jumlah Pegawai, rentang, jumlah hari, pengaturan lama yang diganti dan dampak terhadap hari libur. Pisahkan Tinjau dari Simpan. Konflik/gagal menyimpan mempertahankan isian; sukses memakai snackbar bersama.

- Pilihan shift boleh dilipat untuk merapikan form panjang. Tampilkan nama dan jam pada header, buka pilihan baru yang kosong dan pilihan dengan error, serta pertahankan isian ketika ditutup. Informasi operasional menetap menggunakan AppNotice. Filter jenis pada daftar memakai dropdown dalam OperationalFilterSection dengan deskripsi singkat, bukan tab yang mengulang fungsi filter.

- Melihat pengaturan tidak mengubah makna data. Membuka editor hari tidak langsung menjadikannya Jam khusus. Penanda berubah setelah pengguna mengubah isian. Menutup panel tidak menghapus nilai.

- Jika validasi menemukan kesalahan pada pengaturan yang terlipat, buka bagian dan hari yang terkait. Pertahankan isian dan beri pesan yang menyebut penyebab serta tindakan berikutnya. Ringkasan bukan penyimpanan sampai pengguna mengonfirmasi.

#### Jadwal Pegawai dan perubahan harian

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

- Tetapkan jadwal langsung menyimpan setelah validasi, tanpa Lanjutkan dan modal konfirmasi tambahan. Ini khusus penetapan, bukan menghapus tahap tinjauan perubahan harian massal. Ringkasan dilipat per hari. Pilihan Pegawai memakai ringkasan avatar dan daftar Collapse inline bersama; foto daftar dapat dipreview, sedangkan avatar dalam tombol ringkasan tetap noninteraktif. Preview gambar menggantikan modal sumber sementara; menutup preview mempertahankan form/pagination dan status Collapse.

- Ubah jadwal harian memerlukan penetapan rutin. Jika ada pilihan tanpa penetapan aktif/mendatang, nonaktifkan aksi dan tampilkan jumlah tanpa nama serta arahan menetapkan jadwal agar jadwal harian bisa diubah, atau menghapus centang pada Pegawai tersebut. Jangan melewati Pegawai diam-diam. Server memeriksa cakupan penetapan pada seluruh tanggal; jadwal mendatang hanya bisa diubah sejak mulai berlaku, dan hari libur dalam pola tetap termasuk tanggal yang telah memiliki jadwal.

- Ubah jadwal harian pada menu Aksi membuka form untuk satu Pegawai pada baris tersebut. Aksi pada toolbar berada bersama Tetapkan jadwal dan memakai pilihan checkbox untuk 1–100 Pegawai. Keduanya memakai form yang sama dan dinonaktifkan jika target belum memiliki penetapan aktif atau mendatang. Filter lokasi/divisi/jabatan/jenis memakai fondasi filter bersama.

- Jadwal Pegawai berfokus pada penetapan dan histori. Section Lihat jadwal telah dihapus; jangan menambah kembali kalender pemantauan atau menu laporan jadwal sebelum diminta pengguna. Pemilihan Pegawai hanya untuk aksi Kelola, bukan kontrol tanpa hasil pada akses Lihat Saja.

#### Pengaturan jam tetap dan shift

- Tampilkan kebutuhan utama terlebih dahulu. Pada jadwal, tampilkan Nama jadwal dan dropdown Jenis jam kerja dalam satu baris pada desktop, lalu susun full width pada ponsel. Pilihan Jam kerja tetap menampilkan Hari kerja dan Jam kerja utama. Pilihan Kerja shift menampilkan Hari kerja serta kartu nama/jam setiap shift. Hindari memaksa pengguna mempelajari struktur teknis sebelum mengisi form sederhana.

- Lipat pengaturan opsional yang tidak dibutuhkan semua pengguna. Judul harus menyebut isi, misalnya Atur jam kerja per hari. Ringkasan yang masih terlihat membantu pengguna memahami apa yang dapat diubah.

- Batasi pelipatan bertingkat. Alur utama tidak boleh membutuhkan beberapa pembukaan panel. Pada jadwal baru, satu hari khusus atau pilihan shift berisi satu rentang waktu. Jangan menambahkan pilihan jenis jam kerja, Libur atau daftar jam kerja lagi di dalamnya. Periksa apakah pengelompokan masih mudah ditemukan.

#### Istilah dan chip jadwal

- Chip adalah penanda, bukan tombol. Label dan bentuk harus tetap menjelaskan makna ketika warna tidak dapat dibedakan. Pada jadwal, Hari kerja dan Jam utama memakai tone success (hijau), Hari libur dan Jam khusus memakai tone info (biru). Pemberitahuan libur tampil di bagian hari yang bersangkutan, berdasarkan jam kerja hari tersebut. Jangan menambahkan pemberitahuan libur umum di akhir ringkasan harian. Informasi kalender libur tambahan tetap ditampilkan bila dipilih.

#### Susunan ringkasan jadwal

- Ringkasan jadwal memisahkan setiap hari dengan garis dan padding 24px. Jam kerja, istirahat serta toleransi tampil sebagai fakta berlabel, dua kolom di desktop dan satu kolom di mobile. Hari libur ditandai teks. Hindari menggabungkan semua aturan menjadi paragraf metadata.

#### Ganti dan tambah jam kerja

Satu tugas memakai satu istilah. Jadwal kerja adalah susunan/kelompok, Pilihan shift adalah satu alternatif jam di dalamnya. Jangan menggabungkan seluruh alternatif. Pilihan tunggal menggunakan AsyncSelect; Jenis perubahan pada form harian memakai satu dropdown AsyncSelect dengan nama aksesibel dan tinggi minimal 44px. Jam kerja tambahan mempertahankan jam yang berlaku; jam kerja pengganti menggantinya. Tinjauan berisi hasil nyata per Pegawai/tanggal.

Referensi primer diperiksa 3 November 2026: [Talenta — perubahan shift](https://help-center.talenta.co/hc/en-us/articles/12164556658585-How-to-Request-a-Shift-Change-as-Employee-Role) membedakan penggantian dan penambahan shift; SITOU menerapkannya sebagai tindakan eksplisit, bukan menyalin alur persetujuan ESS. Koreksi pengguna berikutnya menetapkan Jenis perubahan sebagai dropdown AsyncSelect bersama, bukan radio bertumpuk.

#### Penetapan dan daftar Pegawai

- Ringkasan Pegawai pada Tetapkan jadwal dan Ubah jadwal harian membuka daftar inline melalui AppCollapse. Jangan mengganti judul, footer, atau form menjadi tahap Pegawai terpilih. Daftar tanpa header tabel atau pagination, tinggi maksimal min(360px, 40dvh), scroll lokal dan footer hanya total data. Satu Pegawai tetap identitas statis; foto daftar tetap memakai preview bersama.

- Tetapkan jadwal menyimpan langsung dari form melalui tombol Tetapkan jadwal, tanpa tahap Lanjutkan/konfirmasi tambahan. Ringkasan memakai SelectedEmployeesSummary dan Collapse inline SelectedEmployeesList bersama; foto daftar membuka ImagePreviewModal secara eksklusif, kembali mempertahankan isian. Mulai berlaku dinonaktifkan sebelum hari ini organisasi atau tanggal bergabung; server tetap memvalidasi ulang.

#### Modal jadwal dan tinjauan

- Tinjauan perubahan harian menggunakan AppCollapse per Pegawai dan rentang tanggal yang memiliki jam serta sumber libur sama. Header tanggal/status tetap terbaca saat tertutup, rincian jam dan alasan berada di dalam. Perubahan terdahulu ditampilkan terpisah dari perubahan yang akan disimpan dan memakai alasan dari audit masing-masing, bukan alasan form terbaru. Penanda libur menyebut nama kalender atau Libur jadwal. Benturan ditampilkan merah melalui AppNotice danger dengan centerContent; Lihat rincian membuka tahap pada AppModal yang sama dan Kembali mempertahankan isian. Rincian menyebut bahwa benturan pertama ditampilkan, berikut jam, Pegawai dan tanggal kerja terkait.

- Pada modal Buat/Edit Jadwal Kerja, Pulang hari berikutnya, Kurangi waktu istirahat dari durasi kerja, dan Izinkan absen pada hari libur memakai FormSettingSwitch dengan notice untuk kedua kondisi. Teks menjelaskan dampak pilihan, dan nama aksesibel switch tetap sama saat kondisinya berubah. Pada pengaturan istirahat, judul menyebut apakah waktu istirahat dikurangi dari atau termasuk dalam durasi kerja. Gunakan contoh jadwal yang sama pada kedua kondisi agar perbedaan perhitungannya jelas. Aturan jam berlaku juga di panel jam khusus per hari dan setiap pilihan shift.

- Ringkasan Pegawai di kedua modal jadwal: avatar kiri dengan label +N Pegawai lainnya, tanpa mengulang jumlah total di header, jarak antar elemen minimal 12px, arrow ujung kanan dan rata tengah. Hapus teks Lihat daftar Pegawai. Isi memakai baris identitas penuh tanpa nomor/header tabel/kartu bersarang/padding ganda. Daftar memiliki scroll lokal dengan tinggi maksimal min(360px, 40dvh); footer hanya total data, tanpa pagination. Jangan memperbesar batas pemilihan 100 Pegawai hanya untuk menguji daftar panjang.

- Cari komponen bersama sebelum membuat komponen baru. Form jadwal memakai AppModal, FontStyle, FormSettingSwitch, AsyncSelect dan CompactInfoChip. Jangan menyalin warna atau membuat chip/status ad hoc.

### Katalog dan kalender libur

Pedoman ini melengkapi AGENTS.md dan katalog komponen existing. Baca aturan root, aturan folder sasaran, dokumen alur fitur dan pedoman ini sebelum mengubah UI. Instruksi pengguna terbaru tetap menjadi acuan utama.

#### Katalog dan pemilihan tanggal

- Pada Katalog Hari Libur, aksi Gunakan dan simpan draft dari hasil otomatis langsung menampilkan Tinjau katalog dari versi yang berhasil disimpan. Jangan beralih ke Input manual + PDF. Konflik tahun menampilkan aksi Buka draft atau Lihat katalog terbit. Revisi terbaru berstatus Terbit, sementara versi lama berstatus Riwayat revisi. Saat mengedit katalog, Ambil data terbaru mengisi panel lipat yang dapat diedit tanpa tahap tabel atau penyimpanan otomatis. Katalog baru tetap memakai pratinjau sumber. Edit katalog terbit memakai panel lipat per tanggal di kedua cara pengisian. Panel memuat isian tanggal, nama dan kategori, dengan ikon hapus di header. Tinjauan mengelompokkan tahun, nomor SKB, dan tautan SKB resmi dalam ringkasan ringkas. Simpan perubahan pada tahap tinjauan langsung memproses penyimpanan. Tombol Batal pada form berada di kiri pada desktop.

- Pada Buat/Edit kalender libur, tanggal yang ditambahkan dari katalog dikelompokkan dengan AppCollapse. Kategori dan jumlah tanggal tetap terlihat saat tertutup. Saat dibuka, tampilkan nama, tanggal, asal revisi, dan aksi hapus ringkas dalam satu baris per tanggal. Tanggal lampau tetap terkunci sesuai aturan existing. Penggunaan kalender memakai FormSettingSwitch dengan notice aktif/nonaktif di bagian bawah.

- Daftar tanggal katalog pada detail/tinjauan/pratinjau dan pemilih kalender dikelompokkan dalam Collapse kategori, bukan tabel panjang yang langsung terbuka. Header tetap memperlihatkan nama kategori, jumlah tanggal dan jumlah pilihan bila relevan. Menutup kategori tidak melepas pilihan; status terkunci, sumber dan keadaan kosong tetap tersedia ketika dibuka. Ini berbeda dari Collapse isian per tanggal manual.

- Tahun katalog menentukan tahun sumber otomatis dan lingkup tanggal. Pilih melalui AppYearPicker, dengan tahun berjalan/mendatang yang dapat dipilih dan tahun lampau disabled. Input tidak diketik manual. Tahun existing/revisi tetap ditampilkan dan dikunci; filter pencarian historis tetap boleh memilih tahun lampau. Popup tahun harus muat viewport, termasuk 320 px, dengan target pilihan 44 px.

- Entri tanggal manual yang berulang dapat dilipat per tanggal. Judul menampilkan tanggal yang dipilih, bukan Tanggal 1/2; sertakan nama libur dan kategori. Tampilkan Pilih tanggal bila kosong. Baris baru/tidak lengkap dibuka; isian tetap terdaftar ketika tertutup. Validasi membuka panel yang salah dan memfokuskan field terkait. Jangan melipat section wajib utama lagi sehingga menjadi berlapis-lapis.

#### Pemakaian modal pada kalender

- Komponen isi mengikuti katalog reusable; wrapper domain hanya menangani kebutuhan data/validasi. Gunakan props ukuran dan slot existing, bukan override geometri header/footer. Footer mengikuti aturan mobile di bawah. ESLint menjadi pemeriksaan awal, bukan pengganti QA render/keyboard.

#### Pengisian dan sumber hari libur

- Draft katalog menawarkan dua metode berlabel jelas: Ambil otomatis / Input manual + PDF. Unggah dokumen memakai FileUploadField langsung di bagian Dokumen SKB, bukan tombol tahap tersembunyi. Isian yang belum disimpan dipertahankan saat beralih metode atau kembali dari pratinjau. Hasil OCR hanya mengganti form setelah ditinjau dan diterapkan; penyimpanan tetap aksi terpisah. Bagian tanggal menyediakan keadaan kosong, jumlah/batas, dan aksi tambah/hapus berikon dengan label aksesibel. Jangan mengandalkan ikon atau warna tanpa konteks teks.

- Pengambilan katalog setahun menampilkan pratinjau dengan sumber SKB, waktu server dan tanggal ditambah/diubah/dihapus sebelum mengganti draft. Tetap satu AppModal dengan tahap pratinjau, footer bersama, loading backdrop dan pesan gagal yang mempertahankan form. Pengambilan dan penyimpanan draft tidak sama dengan penerbitan.

- Kalender membedakan Libur nasional (success), Cuti bersama (info) dan Libur organisasi (warning) dengan teks, bukan warna saja. Tahun awal dari tanggal organisasi server. Tanggal lampau terkunci dan duplikat diberi alasan. Pemilihan katalog serta pratinjau berada di dalam AppModal yang sama; kembali mempertahankan isian. Menambahkan ke form tidak menyimpan. Tanggal resmi readonly, perubahan revisi ditampilkan untuk ditinjau, dan penyimpanan kalender tetap eksplisit. Footer/loading/error memakai komponen bersama.

#### Pratinjau PDF SKB

Pratinjau memakai tabel/kartu bersama yang memisahkan Libur nasional dan Cuti bersama. Tampilkan halaman sumber serta teks Perlu diperiksa, bukan warna saja. Gunakan Koreksi hasil pembacaan untuk membuka field; jangan langsung memenuhi pratinjau dengan semua input. Peninjauan direset setelah isian berubah, dokumen asli dibuka melalui endpoint privat. Progres antrean tidak mengunci halaman dengan backdrop selama OCR. Seluruh tahap tetap satu AppModal, footer mobile mengikuti fondasi bersama.

#### Pesan penghapusan libur

Pisahkan penolakan karena pernah digunakan, riwayat belum pasti, pekerjaan dokumen aktif, perubahan versi, izin, sesi dan kendala sistem. Pada penolakan, tampilkan nama/jumlah referensi dan jangan tampilkan tombol destruktif atau kalimat yang menyatakan data akan terhapus. Sukses database dengan file tertunda diberi status pembersihan diproses, bukan gagal seluruhnya. Gangguan jaringan tidak dianggap bukti gagal: sediakan Periksa status sebelum konfirmasi ulang. Gunakan ConfirmDialog dengan penjelasan langsung, tanpa panel notifikasi di dalam konfirmasi hapus. Hasil sukses menutup modal dan memakai snackbar Notification bersama; footer mobile 44 px dan jarak 12 px.

#### Kalender Libur

Form membedakan Identitas kalender, Libur dari katalog, Libur organisasi dan Penggunaan kalender. Setiap kelompok tanggal mempunyai aksi ikon bernama dan informasi ketika kosong. Field manual tetap tanggal/nama; tanggal resmi readonly dengan kategori dan asal katalog. Hapus baris memakai ikon tempat sampah dengan nama tanggal, penambahan memfokuskan input tanggal baru. Pembagian visual tidak mengubah indeks Form.List, asal sumber, validasi, tanggal lampau atau batas 366.

#### Pemeriksaan modal kalender

- Baca `docs/ui-ux-guidelines.md` dan katalog komponen sebelum mengubah modal. ESLint menolak import modal library di luar AppModal, dialog HTML/role ad hoc, dan atribut header lama. Periksa render desktop/mobile, keyboard, fokus, scroll, validasi serta state loading/error pada pemakai terkait sebelum menyatakan selesai.

### Data Pegawai dan pendidikan

#### Ringkasan, pendidikan dan onboarding

- Tab Ringkasan detail pegawai memakai EmployeeSummary dengan identitas/foto, NIP dan nama panggilan sebagai fakta berlabel yang jelas. Kelompokkan penempatan, hubungan kerja, data pribadi, kontak/alamat, dokumen identitas, keluarga, kontak darurat dan akun sosial; grid satu kolom mobile, dua kolom tablet, serta panel berdampingan bila ruang desktop cukup. Gunakan InfoField/SummarySection/VisualIdentity bersama dari EmployeeDetailSections dan varian panel ProfileSection, tanpa membuat sumber data baru. Kontrak terakhir serta detail akhir hubungan kerja tetap tersedia bagi status final; dokumen memakai endpoint privat dan ImagePreviewModal, gambar dokumen tidak dipotong atau diregangkan.

- Identitas pada Ringkasan tidak mengulang nama organisasi di bawah nama pegawai. Gradasi serta efek kedalaman memakai token employeeSummary terpusat dan tetap halus pada latar teks. TabSectionHeader mengelola divider bersama: jarak deskripsi ke divider 12px tanpa tombol, 24px dengan tombol; jangan memasang divider kedua di setiap tab. Jarak setelah divider tetap 24px agar konten dan aksi tidak berdesakan.

- Panel identitas Ringkasan memakai permukaan netral dengan aksen brand tipis dan bayangan ringan. Foto, nama berwarna gelap dan status menjadi kelompok utama; NIP serta nama panggilan berada di kelompok fakta dengan pemisah tipis. Desktop boleh berdampingan, tablet/mobile bertumpuk sesuai ruang. Hindari bidang merah besar, ornamen berlebihan, tinggi tetap yang memotong nama panjang, atau penambahan data sekadar mengikuti contoh desain.

- Tab Pendidikan memakai tiga kelompok Riwayat pendidikan, Keahlian, dan Sertifikasi. Riwayat pendidikan memakai linimasa vertikal dari tahun lulus paling awal; tahun kosong ditempatkan terakhir dan tahun yang sama mempertahankan urutan sumber. Urutkan salinan data, bukan mengubah profil asal. Gunakan ProfileSection dan InfoField/InfoFieldGrid dengan permukaan sederhana; hindari ikon berulang pada judul dan pesan kosong serta jangan membuat indikator persentase keahlian buatan. Label dan nilai dipisahkan, istilah Nomor sertifikat menggantikan kredensial di tampilan, khusus tab Pendidikan, tombol Lihat ijazah/sertifikat memakai warna utama brand SITOU (bukan biru), berikon mata dan berlabel dengan tinggi minimal 44px (selebar kartu di mobile). Bukti hanya dibuka melalui file ID privat dan ImagePreviewModal; jenjang tanpa detail tidak memunculkan sekolah/jurusan/tahun/ijazah palsu. Pesan kosong hanya menyebut Edit profil bila canEdit berlaku. Status sertifikat memakai organization_today dari server; tanggal akhir kosong berarti tidak dicatat, bukan bukti berlaku selamanya. Data sumber, hak akses backend, dan alur penyimpanan tetap sama.

- Metadata `key` dari render prop `Form.List` tidak boleh disebarkan ke beberapa elemen JSX. Pasang `key` hanya secara langsung pada wrapper baris dan berikan `name` field turunan secara eksplisit agar tidak menghasilkan duplicate key atau hydration warning React.

- Dropdown kategori pada data berulang yang bersifat satu-per-pegawai, seperti jenis identitas administratif dan platform akun sosial, wajib menonaktifkan pilihan yang sudah dipakai baris lain serta divalidasi ulang di backend. Nilai awal baris baru wajib berasal dari pilihan pertama yang masih tersedia, bukan nilai hardcoded; kategori yang secara bisnis boleh berulang tidak boleh ikut dikunci.

- Pada onboarding pegawai, upload KTP dan pas foto bersifat opsional serta ditempatkan berdekatan dengan field NIK. KTP dicatat sebagai `employee_documents.document_type='ktp'`, sedangkan pas foto direferensikan oleh `employees.profile_photo_file_id`. Kelola Profil Lengkap menyediakan pas foto sebagai pilihan pada dropdown Identitas administratif; pilihan ini hanya menampilkan upload gambar dan tidak dicatat sebagai nomor identitas. Saat jenis identitas diubah, seluruh nilai dan file khusus jenis sebelumnya wajib direset agar tidak terbawa ke jenis baru. Kontrak aktif wajib memiliki nomor kontrak dan PDF privat kategori `contract`. Penempatan baru melalui lifecycle resmi tetap meminta nomor SK dan PDF privat kategori `assignment_decree`; onboarding dan koreksi salah input boleh menyimpan keduanya sebagai data opsional. Pelepasan referensi dokumen pada koreksi harus eksplisit dan diaudit, sedangkan file histori tetap mengikuti retention; browser hanya menerima file ID.

#### Identitas pada detail Pegawai

- Ringkasan pegawai wajib memprioritaskan data inti saat pembuatan pegawai, kontak, penempatan aktif, hubungan kerja, keluarga, kontak darurat, dan akun sosial. Pas foto serta KTP ditampilkan sebagai visual privat yang dapat diperbesar, sedangkan BPJS ditempatkan pada tab Jaminan agar hierarchy informasi tetap jelas.

- Header detail pegawai hanya memakai pas foto pegawai atau avatar inisial sebagai fallback; logo aplikasi dilarang dipakai sebagai pengganti pas foto.

### Inventaris

#### Penamaan fitur dan tampilan stok

- Seluruh label/pesan yang dibaca pengguna untuk akses modul memakai istilah **Fitur**, **Akses fitur**, dan **Fitur dan izin**, bukan Paket. Aktivasi organisasi memakai **Fitur organisasi** dan label **Fitur Inventaris**; pilihan izin memakai **Fitur Inventaris — Lihat Saja/Pengelola Gudang/Pengelola Master Inventaris**. Identifier teknis seperti `packageCode`, `packageAccess`, tabel paket, serta kode permission tetap menjadi kontrak internal/API. Istilah paket backup tetap berlaku untuk arsip backup, karena merupakan domain berbeda.

- Daftar organisasi Superadmin menampilkan **Fitur aktif** dari konfigurasi server, termasuk pada kartu mobile. Belum ada aktivasi ditampilkan sebagai **Belum ada fitur tambahan**; jangan menebak dari role akun atau menyamakan aktivasi fitur dengan izin semua pengguna. Form akses fitur menjelaskan tempat membuat gudang: Data Master → Gudang.

- Warna brand dipakai secara selektif untuk identitas, aksi utama, state aktif, atau penekanan yang memang perlu; jangan mewarnai semua angka, ikon, dan panel hanya agar tampak ber-brand. Data utama seperti jumlah stok tetap memakai warna teks netral agar mudah dibaca. Warna lain tetap boleh dipakai sesuai makna status/aksi. Ikon dekoratif berlatar warna memakai reusable `AppIconTile` dengan intensitas latar yang konsisten antar-tone; jangan merakit ulang kotak latarnya di setiap fitur. Pada ringkasan stok awal, ikon **Stok awal** memakai biru dengan latar biru pastel, sedangkan ikon **Stok saat ini** memakai merah brand dengan latar merah pastel; kedua angka stok tetap netral.

#### Jarak panel izin

- Panel penjelasan izin `AccessExplanation` di bawah dropdown memakai jarak visual
  minimal 16px dari control pada HRIS maupun Inventaris. Atur melalui komponen
  reusable, bukan margin khusus per submenu; bantuan teks biasa tetap mengikuti 8px.

### Organisasi, akses dan dashboard

#### Daftar organisasi dan kelompok navigasi

- Kelompok sidebar adalah presentasi, bukan izin. Organisasi berada bersama Lokasi, Jenis Unit Organisasi, Divisi & Unit, Jabatan, Jenis Kepegawaian dan Jadwal Kerja dalam satu kelompok Kepegawaian pada Data Master. Izin Organisasi tetap platform khusus Superadmin. Pertahankan access.kind=platform, role, assignable, dan guard. Terapkan filter izin sebelum mengelompokkan menu dengan sidebarGroup. Tampilkan satu label Kepegawaian tanpa pemisah Platform atau Kepegawaian ganda.

- Daftar Organisasi memisahkan Kode, Nama organisasi, Lokasi aktif, Akun HRD, Akses berakhir, Status akses, Inventaris dan Absensi. Satu fakta utama per kolom. Nama resmi, jenis dan rincian periode tetap tersedia pada form terkait, tidak ditumpuk bersama nama/kode pada sel identitas. Angka lokasi/admin memakai arti DTO existing, bukan indikator kesiapan onboarding yang belum dihitung.

- Setiap fitur memiliki status Aktif/Nonaktif dengan CompactInfoChip existing beserta ikon dan teks. Status konfigurasi fitur berbeda dari status akses organisasi. Kode dan status panjang memakai wrap opsional agar utuh, termasuk saat teks diperbesar. Tabel boleh digulir horizontal secara lokal pada layar menengah, tanpa overflow halaman atau mengecilkan font.

- Kartu mobile memakai ReportCardFields stacked: label di atas nilai, fakta terpisah, dan aksi berlabel Aksi organisasi pada footer. Nama panjang boleh membungkus. RowActionMenu tetap menyediakan nama aksesibel yang menyebut organisasi. CompactInfoChip dengan wrap dan ReportCardFields stacked dipakai secara opt-in agar pemakai lain tetap kompatibel.

- Aksi Kelola fitur memakai SettingOutlined dari keluarga outline yang sama dengan EditOutlined, SyncOutlined dan StopOutlined. Gaya navigasi bold duotone tidak disisipkan ke antara ikon aksi outline. Ukuran menu aksi mengikuti RowActionMenu bersama, bukan ukuran ad hoc per item.

Tanggal Akses berakhir memakai subscription_ends_on untuk periode biasa dan subscription_grace_ends_on ketika API menyatakan status grace. Tidak menghitung ulang status atau masa akses di browser. Tanggal kosong ditampilkan Belum diatur.

#### Shell, login dan akun

- Saat logout dimulai, hentikan polling akses dan timer sesi, batalkan request akses yang masih berjalan, serta abaikan respons terlambat. Modal sesi berakhir/perubahan akses tidak boleh muncul selama logout. Jika logout gagal, pulihkan pemeriksaan sesi dan polling; kedaluwarsa sungguhan tetap mengikuti alur keamanan.

- Desktop: sidebar; mobile: drawer/bottom navigation dan tabel kompleks menjadi card list.

- Shell halaman terproteksi wajib memakai `app/components/navbar/LeftNavBar.jsx` sebagai sidebar permanen pada desktop (`lg` ke atas), `app/components/navbar/MobileLeftNavBar.jsx` sebagai drawer pada tablet/mobile (`lg` ke bawah), dan `app/components/navbar/TopMenu.jsx` sebagai topbar bersama. Keduanya wajib memakai sumber menu dan renderer sidebar yang sama agar hak akses, status aktif, dan tampilan tidak berbeda antar-device.

- Tombol notifikasi di `TopMenu` tetap ditampilkan sebagai placeholder sampai modul notifikasi SITOU dikembangkan, tetapi dilarang menambahkan polling, request API, badge jumlah, popover data, atau event notifikasi lama. SITOU tidak memakai tombol pengganti tema light/dark.

- Tombol akun TopMenu memakai avatar privat, nama depan dan belakang dari identitas lengkap (abaikan nama tengah), serta jabatan dari penempatan utama; fallback akun tanpa profil memakai username dan role. Pada mobile di bawah breakpoint sm (600px), tampilkan hanya avatar dan panah bawah; nama/jabatan tetap tersedia pada tooltip, nama akun tetap ada pada label aksesibel, dan teks tampil kembali mulai tablet. Target sentuh tetap minimal 44px. Pop-up tetap Profil/Keluar. Sidebar menampilkan organisasi dan lokasi penempatan sendiri; kartu masa akses di bawah sidebar/drawer menampilkan tanggal/status/sisa hari server dan Perpanjang akses dengan notifikasi Coming soon. Jangan mengubah lifecycle logout atau guard navigasi. Route /profile tetap memakai identitas terpusat.

- Form login SITOU hanya meminta username dan password. `users` khusus menyimpan kredensial dan metadata keamanan; nama, email, serta WhatsApp dilarang diduplikasi ke tabel atau form akun. Identitas organisasi berasal dari profil pegawai, identitas Superadmin berasal dari `platform_user_profiles`, dan akun tanpa profil memakai username sebagai fallback. Tautan lupa password tetap dipertahankan sampai OTP WhatsApp terverifikasi dikembangkan.

- Navigasi wajib memakai lifecycle navigasi provider: loading dimulai sebelum router push/replace dan baru dilepas setelah route tujuan terpasang. Bila halaman tujuan mengambil data, proses pengambilan data memiliki token loading sendiri sehingga backdrop tetap tampil sampai data selesai dimuat.

- Status berhasil atau gagal pada login, navigasi yang memerlukan feedback, dan CRUD wajib memakai reusable `app/components/Notifications/Notification.jsx`. Periksa komponen loading dan notifikasi yang ada sebelum membuat komponen baru.

- Schema checkpoint draft wajib menerima nilai parsial dari step yang belum diselesaikan dan tetap menolak key asing atau payload berlebihan. Kelengkapan field wajib divalidasi pada navigasi step dan diulang dengan schema final saat submit; kegagalan API wajib dipetakan kembali ke field/step terkait tanpa menghapus isian pengguna.

#### Navigasi, ikon dan tampilan dashboard

- Halaman detail wajib mempunyai hierarchy identitas, status, navigasi, section informasi, dan aksi yang jelas. Kelompokkan informasi berdasarkan kebutuhan pengguna, bukan mengikuti urutan kolom database atau menampilkan kumpulan label-nilai datar tanpa struktur.

- Sidebar desktop harus tetap setinggi viewport dan memiliki scroll navigasi internal sendiri ketika menu atau konten halaman memanjang.

- Penolakan login wajib memakai kode stabil dan pesan spesifik: masalah akun/profil/penempatan/lokasi/divisi mengarahkan pengguna ke Admin organisasi, sedangkan organisasi nonaktif atau masa berlaku tidak efektif mengarahkan pengguna ke Admin SITOU.

- Ikon navigasi dan aksi akun di topbar (notifikasi, Profil, Keluar) wajib memakai Iconify offline melalui `AppIcon` (`@iconify/react/dist/offline`) dengan ID semantik dan data SVG lokal yang dibundel dari `navigationIconSources.mjs`; jangan memakai nama ikon Iconify yang diunduh dari API saat runtime, URL eksternal, atau font ikon CDN. Untuk mengganti ikon, ubah hanya nama Iconify di sebelah kanan ID semantik pada file tersebut. `npm run dev` membuat data SVG lokal saat mulai dan memperbaruinya otomatis ketika sumber diubah; `npm run build` membuat ulang sebelum kompilasi; `npm run icons:check` memeriksa kesesuaian tanpa mengubah file untuk CI/review. Nama ikon salah wajib gagal dengan pesan jelas tanpa menimpa data lama. Seluruh ikon sudah tersedia sejak HTML awal dan tetap tampil ketika klien tidak terhubung ke internet. Seluruh ikon menu dan aksi akun topbar memakai Solar bold-duotone (two-tone terisi) yang sesuai objek/menu. Ikon Dashboard utama boleh beranimasi skala halus secara terus-menerus sebagai pengecualian, berhenti saat hover/fokus, dan wajib menjadi statis untuk `prefers-reduced-motion`; ikon menu lain tidak beranimasi. Ikon lama di luar navigasi dan aksi akun topbar boleh dipertahankan sampai dimigrasikan; jangan menambah ikon navigasi atau aksi akun topbar AntD/MUI baru.

- Dashboard visual wajib memakai komponen reusable pada `app/components/dashboard` dan adapter ApexCharts terpusat. Dilarang mendefinisikan ulang konfigurasi theme, format tooltip Indonesia, responsive breakpoint, atau reduced motion pada setiap halaman.

- Dashboard tidak memakai filter tanggal global. Enam indikator organisasi menampilkan kondisi saat ini dan tidak menjadi tautan; semua memakai hover halus yang menghormati reduced motion. Tren pegawai dan kontrak memakai 12 bulan kalender termasuk bulan berjalan hingga hari ini, sesuai timezone organisasi. Kontrak segera berakhir tetap 30 hari ke depan; proyeksi pensiun tetap 12 bulan ke depan.

- Dashboard tidak boleh terasa polos ataupun berlebihan. Kekayaan visual dibangun dari hierarchy, komposisi grid, iconography, status tint, microtrend, dan spacing; hindari gradient dekoratif, animasi terus-menerus selain pengecualian ikon Dashboard utama di sidebar, data label yang ramai, dan kartu bertingkat.

- Dataset dashboard wajib difilter berdasarkan role, organisasi, dan cakupan lokasi di backend. Data draft atau sensitif yang tidak berhak dilihat role dilarang dikirim ke browser hanya untuk disembunyikan di UI.

- Query agregasi dashboard wajib dikelompokkan tanpa N+1, memakai parameter SQL, cache singkat bila sesuai, dan diuji pada dataset representatif sebelum optimasi melalui index atau materialized view.

- Dataset Dashboard dengan kewenangan yang sama ditampilkan konsisten untuk HRD dan Pimpinan. HRD terbatas hanya menerima domain/submenu yang diberikan; organisasi, cakupan lokasi, draft dan data sensitif tetap diperiksa di backend.

- Item prioritas disiplin wajib menavigasi ke detail pegawai pada tab Disiplin melalui LoadingBackdrop dan mempertahankan scope organisasi Superadmin. Chip prioritas ditempatkan dekat nama data dengan jarak aman, sedangkan aksi detail memakai ikon mata, tooltip, dan aria-label yang jelas. Data tindakan draft tetap tidak boleh dikirim kepada Pimpinan.

#### Pemulihan loading navigasi

- Bedakan token proses simpan/upload/autentikasi dari token navigasi. Pembatalan stream RSC, Back/Forward, atau perpindahan yang tidak selesai tidak boleh meninggalkan overlay navigasi permanen.

- Loading navigasi memiliki deadline terpusat 30 detik dan pemberitahuan pemulihan; timer lama dibatalkan saat selesai/diganti. Hanya token navigasi dilepas, bukan proses upload/simpan aktif. Jangan menekan console error framework secara global untuk menutupi masalah.

Pemulihan navigasi sidebar: selesaikan token loading saat transisi router selesai, termasuk redirect ke pathname asal. Setelah 30 detik, href internal yang sudah melewati guard isian dapat dibuka via request dokumen baru agar router RSC tertahan tidak menggagalkan perpindahan. Validasi origin wajib; jangan memakai reload otomatis untuk proses upload/simpan atau melewati konfirmasi isian. Tanpa href pemulihan valid, pertahankan notifikasi dan pelepasan token navigasi saja.

### Lokasi dan Rekap Absensi

#### Pemilih titik lokasi

Form Lokasi menempatkan Nama lokasi dan Jenis lokasi sejajar pada layar lebar dan bertumpuk pada ponsel. Koordinat baca-saja memakai teks redup dekat peta. Ikon bantuan radius dan akurasi memakai warna info. Pencarian dan peta ringkas tampil langsung dalam modal Lokasi, setelah tanggal operasional dan sebelum Latitude serta Longitude. Hasil pencarian muncul sebagai dropdown yang dapat dipilih dengan mouse, sentuhan, atau keyboard tanpa menggeser peta. Tombol Cari memakai warna utama SITOU dan tinggi kontrol yang sama dengan kolom pencarian. Pada layar sempit, kolom pencarian menyesuaikan ruang dan tombol tetap terbaca. Peta mendukung zoom dengan roda mouse dan cubit dua jari. Pilihan titik menampilkan koordinat baca-saja di bawah peta dan mengisi alamat jika tersedia. Pengguna bisa mengoreksi alamat. Enter pada peta yang terfokus memilih titik tengah. Simpan tetap satu aksi tulis. Radius dan akurasi ditampilkan ketika titik diaktifkan. Pisahkan pencarian dari peta dan letakkan dua nilai koordinat berjarak rapi tepat di bawah peta. Kelompokkan status Titik absen di atas Lokasi dengan FormSettingsGroup dan notice aktif/nonaktif, dengan garis pemisah di antara keduanya. Radius dan batas akurasi memakai lebar penuh grid form dan sejajar pada layar yang cukup lebar, bertumpuk di ponsel, dan memakai ikon bantuan yang dapat ditekan. Acuan penyedia peta dan pencarian alamat ada di docs/work-schedules.md.

Saat Edit lokasi dibuka, peta berpusat satu kali pada koordinat tersimpan dan kolom pencarian kosong untuk mencari lokasi baru. Klik titik hanya memindahkan marker dan radius sambil mempertahankan pusat dan zoom. Memilih hasil pencarian menggeser pusat tanpa mengganti zoom, dan label tetap terbaca setelah dropdown ditutup. Membuka form tidak memanggil geocoding atau mengubah alamat. Alamat tersimpan tetap tampil pada field Alamat. Proses pencarian balik berjalan tanpa teks status di bawah koordinat. Bila gagal, gunakan notifikasi bersama dan tetap izinkan pengisian alamat manual. Reset state ketika lokasi atau organisasi berubah.

#### Indikator absensi

Gunakan komponen status bersama pada daftar, detail dan laporan. Ambil kategori dari backend dan gunakan token tema terpusat. Setiap indikator memiliki label teks yang menjelaskan kondisi. Ikon dapat membantu mengenali kategori pada tampilan lain. Pada Rekap Absensi, gunakan chip teks dan warna tanpa ikon di tabel, kartu, panel +N, dan modal rincian. Gunakan hijau untuk absensi normal, jingga untuk terlambat, emas tua untuk pulang lebih awal, hijau kebiruan untuk masuk lebih awal, biru untuk pulang lebih lambat, merah untuk di luar radius, dan abu kebiruan untuk bekerja saat libur. Tampilkan status waktu dan lokasi secara terpisah jika keduanya berlaku. Pulang lebih lambat tetap dibedakan dari lembur yang disetujui. Penanda dekat batas radius merupakan informasi tinjauan terpisah dari status di luar radius.

Absen di luar jadwal memakai penanda merah tua dan teks yang berbeda dari Di luar radius. Gunakan outsideSchedule atau work_context=outside_schedule dari backend. Rekap sesi tambahan dapat ditinjau tanpa menampilkan persetujuan lembur yang belum ada.

#### Kepadatan Rekap Absensi

Tampilkan satu indikator prioritas pada daftar. Tombol +N membuka indikator lainnya lewat panel ringkas agar jumlah indikator tidak menambah tinggi baris. Utamakan kejadian yang perlu perhatian, seperti di luar radius, di luar jadwal, dan terlambat. Di desktop gunakan tabel ringkas. Di tablet dan ponsel tampilkan jam masuk dan pulang berdampingan di kartu. Nama pada daftar tampil satu baris dengan inisial nama tengah bila panjang. Nama lengkap tampil di rincian.

Kolom Status dan modal rincian menyebut absen masuk atau pulang yang belum tercatat berdasarkan rekap sesi. Jika keduanya belum lengkap, sebutkan keduanya. Bila belum ada bukti untuk menentukan arah, tampilkan status harian yang tersedia. Pertahankan keterangan Perlu tinjau atau hari libur bila berlaku.

Gunakan judul dan deskripsi modal standar. Urutkan isi mulai dari identitas Pegawai, Jadwal kerja, Absensi tercatat, lalu Peta absensi. Pisahkan identitas dari tanggal kerja dengan divider. Foto identitas berbentuk kotak dengan sudut membulat dan memakai ikon orang bila foto tidak tersedia. Garis waktu absensi menempatkan Masuk di kiri dan Pulang di kanan. Letakkan tanggal di pita atas, lalu titik, jam, dan chip arah dalam satu baris. Slot kosong menampilkan Belum ada catatan. Gunakan garis putus-putus sebagai pembatas dan penanda 00.00 saat lintas tengah malam. Kartu foto memakai bingkai responsif dengan `object-fit: contain` dan keterangan tekan untuk memperbesar. Tampilkan catatan Pegawai sebagai daftar sederhana di bawah foto. Letakkan indikator berikon di bawah peta bersama informasi lokasi. Indikator per kejadian mengikuti pilihan absen dan indikator harian diberi label Rekap harian. Di peta gunakan titik dan lingkar radius merah serta avatar Pegawai. Tulis jarak di bawah satu kilometer dalam meter dan jarak yang lebih panjang dalam kilometer dengan sisa meter bila ada.

Pada hari libur, tampilkan nama libur atau Libur jadwal di panel Jadwal kerja. Jika hari libur tidak memiliki absen tercatat, tampilkan satu keterangan di panel Absensi tercatat. Jika ada kejadian, pertahankan rincian dan peta seperti hari kerja. Gunakan gradasi serta elevasi halus pada panel, ikon, dan bingkai. Terapkan gerak angkat foto hanya saat perangkat mendukung hover dan pengguna mengizinkan animasi.

Referensi ditinjau 11 November 2026. [Carbon Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) menjadi acuan penyajian ringkas dengan rincian sesuai kebutuhan. [MDN object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit) menjelaskan cara mempertahankan seluruh gambar dalam bingkai.
