# Font aplikasi SITOU

## Satu tempat pengaturan

`app/theme/typography.js` adalah sumber font antarmuka aplikasi:

- `appFont` memuat file Poppins lokal dengan `next/font/local`.
- `APP_FONT_FAMILY` menentukan keluarga font dan font cadangan.
- `APP_FONT_WEIGHTS` menentukan bobot normal 500, medium 600, dan bold 700.

Untuk mengganti font, sediakan file font lokal berlisensi lalu ubah daftar `src` dalam `appFont` pada file tersebut. Path dihitung dari `app/theme/typography.js`. Sesuaikan bobot file yang tersedia; pertahankan nama variabel generik `--font-app`. Ubah `APP_FONT_FAMILY` hanya bila font cadangan perlu diganti. Jalankan ulang build setelah mengganti file font.

Jangan menambahkan `fontFamily` berisi nama font langsung pada komponen fitur. Ukuran, ketebalan, dan warna teks tetap mengikuti fungsi komponen dan token yang berlaku.

## Pemakaian

- `app/layout.js` memasang variabel font pada elemen html serta meneruskan keluarga font melalui `--sitou-font-family`.
- `app/globals.css` memakai variabel tersebut untuk halaman; kontrol form native mengikuti font parent.
- Theme Material UI dan ConfigProvider Ant Design membaca `APP_FONT_FAMILY` yang sama, termasuk komponen popup di body.
- `FontStyle` dan breadcrumb mengikuti theme Material UI; tidak menentukan nama font sendiri.
- Grafik mengikuti `theme.typography.fontFamily` melalui adapter grafik yang sudah ada.

Font disertakan dalam repo; development dan production tidak memerlukan unduhan Google Fonts. Lisensi berada di `app/fonts/poppins/OFL.txt`. Pengaturan ini untuk UI web; font dokumen Excel/PDF diatur pada generator masing-masing.

## Verifikasi

Periksa font yang benar-benar digunakan browser, bukan hanya nama dalam CSS: login, judul, label, tombol, input, tabel, dropdown portal, dan teks SVG grafik. Periksa Poppins berhasil dimuat, tidak ada request Google Fonts, console bersih, serta tidak muncul overflow pada mobile. Jalankan ESLint dan production build; file pengujian sementara wajib dibersihkan setelah selesai.
