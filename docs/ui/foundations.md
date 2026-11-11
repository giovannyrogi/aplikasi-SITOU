# Fondasi visual dan komponen

## Koreksi pengguna yang wajib diperiksa sebelum implementasi

- Edit lokasi membuka peta pada koordinat tersimpan dan pencarian awalnya kosong untuk mencari lokasi baru. Pilihan pencarian tetap terbaca setelah hasil ditutup. Membuka form tidak mencari ulang atau mengganti alamat. Jangan tampilkan proses pencarian balik di bawah koordinat, kegagalan memakai notifikasi existing. Pusatkan peta pada titik tersimpan hanya saat pertama dibuka. Klik peta hanya memindahkan marker/radius tanpa mengubah pusat atau zoom. Hasil pencarian menggeser pusat tanpa mengganti zoom. Reset state ketika pindah lokasi/organisasi.

- Pemilihan Kalender libur pada jadwal tetap/shift langsung berarti mengikuti tanggal liburnya. Hilangkan dropdown Saat tanggal libur; payload diturunkan dari kalender terpilih, bukan field tersembunyi yang masih memerlukan validasi. Menghapus kalender mengembalikan aturan libur mingguan jadwal. Data lama tetap utuh sampai penyimpanan eksplisit/revisi bertanggal.

- Jadwal terpakai tetap dapat diedit hari, jam dan kalender. Form menampilkan Mulai berlaku perubahan, date picker paling cepat besok/setelah versi terakhir, alasan dan AppNotice rata kiri tentang perlindungan histori. Tinjauan wajib menyebut tanggal berlaku serta alasan; kembali/gagal mempertahankan isian. Jangan mengunci semua pengaturan karena sudah dipakai. Jenis tetap/shift tetap identitas struktur, tanpa konversi diam-diam. Hindari divider ganda pada pertemuan FormSection dan section existing.

- Mulai berlaku jadwal hanya hari ini/mendatang dalam zona organisasi, dan tidak sebelum tanggal bergabung paling akhir dari pilihan. DatePicker memblokir tanggal tersebut dan validasi form/server mengulang pemeriksaan. Jangan menerapkan pembatasan ini ke filter historis.

- Ringkasan banyak Pegawai memakai avatar privat/initial bersama, jumlah sisa dan total pilihan. Hanya jumlah >1 menjadi tombol pembuka daftar. Daftar dibuka inline melalui AppCollapse, dengan scroll lokal berbatas tinggi dan footer total data; form, judul dan footer tidak diganti. Hindari tombol foto bersarang di tombol ringkasan: avatar di dalamnya noninteraktif.

- Perubahan massal periode harus menjelaskan jumlah Pegawai, rentang, jumlah hari, pengaturan lama yang diganti dan dampak terhadap hari libur. Pisahkan Tinjau dari Simpan. Konflik/gagal menyimpan mempertahankan isian; sukses memakai snackbar bersama.

- Jarak section mengikuti FormSection: padding vertikal 24 px; `first` hanya pada section paling awal form. Jangan memakai `:first-of-type` untuk menghapus jarak karena wrapper kondisional/nested dapat membuat section tengah dianggap pertama. Periksa jarak nyata di kedua sisi divider, termasuk ketika metode pengisian berganti.

## Bahasa dan komponen

- Gunakan token theme untuk warna, border, radius dan permukaan. Informasi utama tetap berwarna teks normal. Hiasan tidak boleh mengurangi kontras atau menambah beban baca.

## UI/UX

- Setiap pekerjaan desain atau perombakan antarmuka wajib dilakukan dengan pendekatan UI/UX profesional: pahami tujuan pengguna dan data yang dibutuhkan, tinjau tampilan serta komponen yang tersedia, lalu susun hierarki informasi dan kelompok data sebelum implementasi. Bila diminta memakai referensi aplikasi lain, pelajari sumber resmi dan ambil prinsip yang relevan; sesuaikan dengan alur, izin, bahasa, serta tema SITOU. Jangan menyalin tampilan tanpa mempertimbangkan konteks pengguna.

- Utamakan keterbacaan dan kemudahan pemindaian: label terpisah dari nilai, data utama lebih menonjol, informasi terkait berada dalam kelompok yang jelas, dan teks panjang tetap terbaca utuh. Periksa kondisi data kosong, nama/alamat panjang, status akhir, akses keyboard, kontras, serta susunan desktop/tablet/mobile. Evaluasi hasil render dan perbaiki masalah yang ditemukan sebelum menyatakan desain selesai; perubahan visual tidak boleh mengubah arti data atau memperluas akses.

- Dropdown pilihan pada form, filter, dan pagination wajib memakai `AsyncSelect` atau adapter domain yang menyusun komponen tersebut. Pilihan harus dapat diketik/dicari berdasarkan label; jangan menambahkan `Select` tanpa pencarian. Pencarian server boleh memakai `onSearch` dan `filterOption={false}`. Menu aksi seperti Export tetap memakai komponen menu, bukan dropdown pilihan data.

- Locale tanggal dan waktu wajib dipasang terpusat melalui `app/components/approvider/AppProviders.jsx`. Seluruh DatePicker/Calendar AntD memakai locale `id_ID` dan Day.js locale `id`, sedangkan MUI date picker memakai adapter locale `id`; dilarang mengatur nama bulan, hari, placeholder, atau tombol kalender per halaman secara manual.

- Seluruh field tanggal, bulan, dan tahun pada form wajib memakai date picker dengan mode yang sesuai dari library UI yang sudah terpasang, bukan `Input` teks atau input angka manual. Gunakan date picker standar untuk tanggal, month picker untuk bulan, dan year picker untuk tahun. Nilai form menggunakan objek tanggal adapter dan hanya dinormalisasi ke format kontrak API pada batas request.

- Sebelum membuat komponen UI baru, periksa `app/components` dan gunakan komponen reusable yang sudah ada untuk fungsi/kebutuhan yang sama. Perluas API komponen yang ada bila masih dalam tanggung jawab yang sama; jangan membuat duplikat hanya karena dipakai pada halaman berbeda.

- Seluruh typography MUI wajib menggunakan reusable component `app/components/font-style/FontStyle.jsx`, bukan mengimpor `Typography` langsung pada halaman atau komponen fitur. Gunakan font weight normal `500`, medium `600`, dan bold maksimal `700`; dilarang memakai bobot di atas `700`.

- Keluarga font UI wajib bersumber dari `app/theme/typography.js`: pemuatan file lokal, APP_FONT_FAMILY, dan APP_FONT_WEIGHTS. CSS global, Material UI, Ant Design, serta grafik mengikuti konfigurasi yang sama. Jangan menulis nama font atau font stack langsung pada komponen fitur. FontStyle mengikuti theme, kontrol form native mengikuti font halaman. Panduan penggantian dan verifikasi: `docs/typography.md`.

- Implementasi UI/UX wajib mengikuti best practice React/Next.js: komponen terfokus, state minimal, aksesibilitas dasar, semantic HTML, serta styling responsif yang tidak mengandalkan ukuran layar tunggal.

- Saat memakai atau mengubah komponen library UI seperti AntD/MUI, periksa kontrak versi yang benar-benar terpasang pada type definition atau dokumentasi lokal. Dilarang menambahkan prop/API deprecated; khusus AntD 6 gunakan `Alert.title` bukan `Alert.message`, `Steps.titlePlacement` bukan `Steps.labelPlacement`, `Tabs.destroyOnHidden` bukan `destroyInactiveTabPane`, `Timeline.items.content` bukan `items.children`, dan `Space.Compact` untuk prefix/suffix field, bukan `Input.addonBefore`/`addonAfter` yang deprecated. AntD `List` juga tidak boleh dipakai karena telah deprecated; susun daftar dengan semantic HTML/reusable data view yang sesuai kebutuhan.

- Sebelum perubahan UI dianggap selesai, periksa console browser dan cari penggunaan API deprecated pada seluruh area terkait agar warning yang sama tidak berpindah ke halaman lain.

- SITOU menggunakan satu tema light yang konsisten. Jangan menambahkan dark mode, theme switcher, atau penyimpanan preferensi tema kecuali ada keputusan produk baru.

- Warna brand, status, feedback, state interaktif, dan permukaan UI wajib bersumber dari token terpusat di app/components/themeprovider/ThemeProvider.jsx. Dilarang menulis nilai hex, rgb/rgba, gradient, atau shadow berwarna langsung di halaman/komponen fitur bila token semantik yang sesuai dapat disediakan atau sudah tersedia.

- Gunakan theme.brand untuk identitas SITOU, theme.status untuk success/warning/info/danger/neutral, palette MUI untuk state komponen, dan theme.ui untuk kebutuhan visual reusable atau halaman khusus. Token AntD harus mengambil sumber warna yang sama agar MUI dan AntD konsisten.

- Warna aksi unduhan dan backup memakai `theme.action` / `ACTION_TONES`: detail biru, paket lengkap teal, ZIP database biru, ZIP seluruh file ungu, verifikasi hijau, dan hapus merah danger. Unduhan tidak memakai merah; merah brand tetap boleh untuk pembuatan data. Tombol AntD memakai `data-action-tone` dengan nilai `detail|download|database|files|verify|danger` agar hover dan fokus konsisten. Label/ikon tetap wajib; jangan mengandalkan warna saja.

- Informasi dan peringatan panjang memakai teks rata kiri-kanan dengan baris terakhir rata kiri, pembungkusan aman, ikon di awal, serta jarak yang cukup pada mobile.

- Ikon aksi wajib sesuai objek dan tindakan: database memakai ikon database, kumpulan file memakai folder/file, paket lengkap memakai unduhan/arsip, detail memakai mata, verifikasi memakai perisai/centang, dan hapus memakai tempat sampah. Jangan memakai ikon unduh generik yang sama untuk database dan kumpulan file. Ikon tetap disertai label atau tooltip serta aria-label yang jelas.

- Ikon dan teks di dalam tombol wajib disusun `inline-flex`, rata tengah secara horizontal dan vertikal, mempunyai baseline visual yang sejajar, serta jarak yang konsisten. Ikon tidak boleh membuat teks bergeser ke atas atau bawah; verifikasi juga pada state loading, disabled, tombol lebar penuh, dan viewport mobile.

- Responsive wajib diuji untuk desktop lebar, laptop, tablet, mobile besar, dan mobile kecil. Gunakan breakpoint yang stabil, hindari ukuran tetap yang membuat form/tabel terpotong, dan pastikan setiap halaman nyaman pada lebar 320px sampai desktop wide.

- Untuk setiap UI baru atau perubahan layout, verifikasi minimal pada viewport mobile 320/375px, tablet 768px, laptop 1024/1366px, dan desktop lebar. Pastikan tidak ada overflow horizontal, overlap, teks terpotong, atau tindakan utama yang sulit dijangkau.

- Asset logo resmi navbar memakai `public/logo-sitou-v2-transparent.png` dan teks HTML **SITOU** berwarna brand. Navbar desktop maupun mobile tidak menampilkan kepanjangan SITOU atau teks “by Perumda Pasar Manado”; aset raster lama dengan kepanjangan terdahulu tidak digunakan pada UI.

- Halaman login adalah entry awal aplikasi. Jangan menampilkan pilihan demo role; setelah login, server/client mengarahkan user berdasarkan role aktif.

- Proses paralel wajib memakai token/counter provider agar satu proses yang selesai tidak menutup backdrop milik proses lain. Gunakan loading lokal seperti skeleton, spinner tombol, atau loading select hanya untuk proses nonblocking yang terbatas pada komponen tersebut.

- Status tidak hanya disampaikan dengan warna; tambahkan label/ikon.

- Pada tampilan dan laporan absensi, gunakan komponen bersama dengan warna semantik, label dan ikon per kategori. Gunakan hijau untuk absensi normal, jingga untuk terlambat, emas tua untuk pulang lebih awal, hijau kebiruan untuk masuk lebih awal, biru untuk pulang lebih lambat, merah untuk di luar radius, dan abu kebiruan untuk bekerja saat libur. Tampilkan kondisi waktu dan lokasi secara terpisah jika keduanya berlaku. Ambil kategori dari data backend dan gunakan token tema terpusat.

- List umum memasking data sensitif.

- Pimpinan melihat ringkasan dan histori, bukan tombol edit.

- Form panjang memakai stepper, draft server yang aman, dan peringatan perubahan belum disimpan.

- Seluruh area pemilihan/upload Excel, PDF, gambar, dan dokumen wajib menyusun reusable `app/components/forms/FileUploadField.jsx`; jangan membuat dropzone atau daftar file terpilih sendiri pada halaman fitur.

- Wizard tambah pegawai memakai draft server privat selama tujuh hari. Maksimal satu draft aktif per actor dan organisasi; draft hanya ditulis saat pengguna menekan Lanjut, Kembali, Simpan draft & tutup, atau finalisasi, memakai optimistic concurrency, dan tidak boleh menyimpan NIK/payload ke log. Perubahan field dilarang mengirim request autosave per ketikan. Close harus menunggu penyimpanan terakhir berhasil.

- File draft memakai staging `org_{organizationId}/pegawai/drafts/draft_{draftId}/...`, hanya dapat diakses pembuat draft, lalu dialihkan ke kepemilikan pegawai saat finalisasi.

- Tindakan disiplin ditampilkan profesional tanpa mempermalukan pegawai.

## Fondasi reusable dan standar visual SITOU

- Seluruh filter daftar operasional, Data Master, Akun Organisasi, Organisasi, dan laporan wajib memakai satu komponen `OperationalFilterSection` sebagai section terpisah sebelum panel hasil. Pencarian, status, organisasi, tanggal, dan filter lain tidak boleh ditempatkan di header/toolbar tabel. Sesuaikan label, placeholder, dan pilihan dengan data serta parameter API yang benar-benar didukung; jangan memfilter hanya halaman hasil yang sedang dimuat. Gunakan props pencarian/status bersama untuk daftar sederhana dan `items` untuk kebutuhan domain. Dropdown wajib dapat dicari. Atur ulang mengembalikan filter dan pagination ke awal tanpa melepas konteks organisasi wajib atau memperluas scope akses. Fitur/menu baru mengikuti aturan ini.

- `OperationalFilterSection` memakai maksimal empat field per baris pada desktop (>=1200px), tiga pada tablet lebar (900-1199px), dua pada 600-899px, dan satu pada mobile (<600px). Field berikutnya mengalir ke baris baru; dilarang memadatkan lima atau lebih field dalam satu baris desktop. Gunakan padding dan jarak komponen terpusat, bukan override halaman.

- Katalog komponen berada di `app/components/README.md` dan wajib diperbarui setiap reusable component dibuat, dipindah, atau diubah kontraknya.

- Seluruh logo SITOU wajib memakai `app/components/branding/AppLogo.jsx`. Path aset hanya diubah melalui `APP_LOGO_ASSETS`; dilarang menulis path file logo langsung pada halaman atau komponen lain.

- Sebelum membuat komponen baru, cari fungsi yang sama di `app/components`. Jika sudah ada, perluas komponen tersebut dalam tanggung jawab yang sama; dilarang membuat duplikat.

- Reusable component diberi nama berdasarkan fungsi umum dan disimpan berdasarkan tanggung jawab, bukan berdasarkan nama menu pertama yang menggunakannya.

- Komponen hanya boleh dihapus setelah seluruh import, pemanggilan dinamis, route, dan dokumentasi diperiksa.

- Form panjang yang memakai tab, step, atau collapse wajib menampilkan `Notification` pada setiap kegagalan validasi/simpan, menandai section bermasalah dengan state error yang jelas, membuka section tersebut, lalu menggulir dan memfokuskan field error pertama. Error tidak boleh hanya terlihat pada field yang sedang tertutup atau gagal diam-diam; penanda section harus hilang setelah isian terkait valid.

- Breadcrumb halaman wajib bersumber dari konfigurasi menu melalui `AppBreadcrumbs`. Parent tanpa path tampil sebagai konteks nonklik, sedangkan route turunan mengikuti menu terdekat yang paling spesifik.

- Area daftar operasional wajib memeriksa dan memakai reusable `DataPanel` sebelum membuat wrapper baru. Tabel/card list dan pagination berada dalam satu paper tanpa nested panel. Filter berada pada section terpisah; header/toolbar panel hasil hanya untuk aksi hasil seperti export, muat ulang, atau seleksi data.

- Navigasi tab detail wajib memeriksa dan memakai `navigation/DetailTabs` sebelum membuat shell baru. Active state harus jelas, target sentuh minimal 44px, dapat dioperasikan dengan keyboard, dapat dipertahankan melalui URL bila relevan, dan tidak menyebabkan horizontal page overflow pada mobile.

- Ringkasan halaman detail wajib menyajikan setiap fakta satu kali; dilarang mengulang nomor, status, identitas, atau metadata yang sama pada beberapa section. Gabungkan profil dan identitas yang berasal dari sumber data yang sama, tampilkan bukti visual penting dekat konteksnya, dan pindahkan informasi administratif khusus ke tab tersendiri bila membuat ringkasan sulit dipindai.

- Aksi utama detail ditempatkan konsisten di kanan header section pada desktop dan menjadi mudah dijangkau atau lebar penuh pada mobile. Aksi tidak boleh bercampur di antara nilai data atau menggeser hierarchy informasi.

- Tab Dokumen pada detail pegawai hanya menjadi checklist kelengkapan tanpa upload, nama file, atau aksi file. Status tersedia wajib berasal dari record domain yang masih mereferensikan metadata file aktif; file yatim atau metadata yang sudah dilepas tidak boleh membuat dokumen terlihat tersedia. Pengelolaan dan satu-satunya aksi buka dokumen berada pada konteks domainnya: identitas di Profil Lengkap, kontrak di tab Kontrak, SK di tab Penempatan, serta ijazah/sertifikat di tab Pendidikan.

- Perubahan halaman detail wajib diuji untuk kemudahan pemindaian informasi, alignment, jarak aman, nama/teks panjang, data kosong, seluruh role, keyboard, zoom, dan viewport 320-1920px. Section harus informatif tanpa nested card berlebihan.

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

- UI wajib diuji pada viewport 320, 375, 768, 1024, 1366, dan 1920px, browser zoom, keyboard navigation, focus order, overflow, overlap, kontras, serta safe area/keyboard mobile.

- Dilarang memakai orb, bokeh, gradient dekoratif, nested card, shadow tebal, radius berlebihan, palette satu nada, padding ekstrem, atau dekorasi yang mengurangi keterbacaan.

- Komposisi jenis kelamin, status pegawai, masa kerja, jenis kepegawaian, lokasi, dan unit adalah snapshot kondisi saat ini tanpa filter tanggal. Kasus disiplin resmi dan aktivitas terbaru maksimal lima item tanpa batas rentang tanggal; prioritas maksimal lima item terpenting. Seluruh data tetap mengikuti role, organisasi, serta cakupan lokasi actor di backend.

- Grafik dinamika pegawai tidak boleh mengulang snapshot status aktif. Gunakan arus pegawai baru dan pegawai keluar per periode, sedangkan kondisi aktif, masa percobaan, dan cuti tetap berada pada visual Status Pegawai.

- Adapter ApexCharts wajib menormalkan kategori kosong dan nilai nonnumerik sebelum render. Label `NaN`, `undefined`, atau sumbu kategori kosong dilarang tampil kepada pengguna.

## Jarak informasi pada field

- Teks bantuan `Form.Item extra` memakai spacing terpusat: minimal 8px dari control,
  line-height 1.6, serta 4px padding bawah sebelum margin antar-field. PrerequisiteHint
  memakai gap 8px antara penjelasan dan tautan; target sentuh tetap minimal 44px.

- Jangan menempelkan teks bantuan ke border input/dropdown atau memberi margin negatif.
  Pertahankan jarak antar-field dan uji informasi panjang pada desktop/mobile.
  Gunakan token/style reusable; jangan menambah override spacing per halaman.
