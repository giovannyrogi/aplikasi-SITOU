# Tampilan laporan Sanksi Pegawai

## Ringkasan

Kolom Pegawai desktop memiliki lebar dasar 400px. ReportIdentity menerima noWrap
khusus tabel ini; nama utuh tetap satu baris tanpa ellipsis, dan tabel memakai
scroll horizontal max-content agar nama lebih panjang tidak menimpa kolom lain.
Kartu mobile serta pemakai ReportIdentity lainnya tetap membungkus nama. Foto/NIP
dan akses pratinjau tetap mengikuti komponen bersama.

Satu baris tetap mewakili satu pegawai. Sanksi terbaru berasal dari hasil filter, sedangkan total sanksi mengikuti agregat resmi yang sudah disediakan server. Tabel memakai kolom Pegawai (foto, nama, NIP), Lokasi, Divisi & Unit, Jabatan, Sanksi terbaru, Status sanksi, Tanggal terbit, Total sanksi, dan Aksi. Total sanksi adalah seluruh tindakan resmi nondraft, termasuk berakhir, dicabut, digantikan atau dalam banding; bukan hanya hasil filter. Sesuai filter dan Aktif / banding dihapus dari tabel, kartu, ringkasan modal dan Excel karena bukan informasi utama. Nama sanksi berupa teks; chip dipakai untuk status. Tabel boleh digulir di dalam panel tanpa overflow halaman.

Nomor kasus/surat, tingkat, kejadian, periode berlaku, penerbit, uraian, pembelaan dan pencabutan tersedia pada rincian. Kartu mobile memisahkan identitas, sanksi terbaru, fakta dan ringkasan berlabel. Aksi desktop adalah mata dengan tooltip dan label aksesibel; mobile berupa ikon daftar disertai teks Lihat riwayat sanksi. Excel tetap memuat fakta rinci, dengan penamaan Total sanksi dan tanpa kedua kolom hitungan tambahan. Field API/agregat tetap kompatibel.

## Riwayat

AppModal bersama menampilkan lima sanksi per halaman, diurutkan tanggal terbit dan ID menurun. Endpoint histori existing masih mengembalikan seluruh histori resmi; pagination dilakukan pada presentasi browser, bukan request keyset baru. Ini membatasi panjang tampilan, bukan jumlah data yang diunduh. Tidak ada perubahan API/database/migration.

Setiap sanksi mula-mula tertutup, satu rincian dapat dibuka pada satu waktu. Header ringkas memuat nama sanksi, tanggal, nomor kasus dan status; status seluruh baris tetap terlihat termasuk histori lama. Rincian mempertahankan uraian lengkap, penjelasan pegawai, surat, alasan langsung serta pelaku/waktu/alasan pencabutan. Penempatan dan ringkasan pegawai langsung ditampilkan dalam section berjudul tanpa collapse, sehingga lokasi, Divisi & Unit, jabatan, status pegawai, dan total sanksi dapat dibaca tanpa klik tambahan. Pagination tetap di slot AppModal di luar body scroll, total dan jumlah tampil berdasarkan data aktual. Pergantian halaman kembali ke atas dan menutup rincian lama.

Daftar riwayat selalu seluruh tindakan resmi pegawai, tidak mengikuti filter tindakan pada laporan; keterangannya eksplisit. Loading, kosong, error/coba lagi, AbortController saat tutup/ganti target, Escape dan pengembalian fokus tetap berlaku. Draft disaring server; filter defensif UI tidak menggantikan authorization. Surat tetap endpoint privat berizin/audit. Menu detail pegawai hanya muncul jika grant Data Pegawai tersedia.

## Referensi desain

- OrangeHRM Discipline: https://orangehrm.com/solutions/culture/discipline — ringkasan dan rincian terpisah, histori tindakan dapat ditelusuri.
- Carbon Data Table: https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines — tabel ringkas dan rincian bertahap.

Referensi hanya untuk struktur informasi; warna, spacing, chip, tombol, modal serta pagination mengikuti komponen SITOU.

## Verifikasi perubahan

- npm run lint dan npm run build lulus.
- Browser Chrome produksi lokal: 320/375/768/1024/1366/1920px; tidak ada overflow halaman/dialog atau page error JavaScript.
- Endpoint laporan dan histori nyata dapat dibaca untuk Superadmin pada satu organisasi eksplisit; laporan no-store, histori officialOnly tidak memuat draft. Akses endpoint laporan untuk akun Pegawai diuji ditolak.
- Fixture browser 13 tindakan: 5/5/3 tanpa duplikasi, rincian tunggal, status histori, teks uraian panjang, pagination tetap saat scroll dan tombol bertumpuk pada mobile.
- Kosong, gagal/coba lagi, Escape, tutup saat request berjalan serta kembali ke daftar diuji. Fokus tombol retry dipindahkan ke dialog sebelum loading agar Escape tetap berfungsi saat tombol terlepas dari DOM.
- Fixture hanya pada respons browser; tidak ada perubahan data bisnis/database. Script, screenshot, dan server uji sementara dibersihkan setelah pemeriksaan.

Uraian kejadian dan Penjelasan pegawai berada pada grid fakta utama, berdampingan pada desktop dan bertumpuk pada mobile. Area setelah divider hanya muncul jika ada eskalasi/pencabutan, juga memakai dua kolom desktop. Status memakai ACTION_STATUS bersama: Aktif hijau, Berakhir/Belum mulai/Draft biru, Dicabut merah, Dalam banding/Digantikan kuning. Warna ini menjelaskan lifecycle, bukan tingkat pelanggaran.

Verifikasi penyesuaian lanjutan: lint/build, browser 320–1920px, lima warna status lifecycle, posisi uraian/penjelasan pada grid atas, dua kolom pencabutan, tidak ada divider bawah kosong, kolom penempatan/Total sanksi serta penghapusan kedua hitungan di UI dan workbook Excel (dibaca ulang di memori) lulus. Script/server uji dibersihkan.

Filter Status tindakan hanya menawarkan Aktif, Berakhir, Dicabut dan Digantikan. Dalam banding tidak ditawarkan karena workflow pengajuan/penyelesaiannya belum tersedia. DISCIPLINARY_FILTER_STATUSES memisahkan pilihan UI dari status histori/API sehingga data dan tautan lama tetap terbaca. Digantikan memang dihasilkan closePreviousActions saat sanksi baru diterbitkan untuk pegawai yang sama; sanksi lama yang sudah lewat tanggal akhir menjadi Berakhir, sedangkan yang masih aktif menjadi Digantikan. Seluruh perubahan tersebut diaudit. Pemeriksaan lint terarah dan daftar opsi lewat modul policy lulus.

## Bahasa status

Katalog DISCIPLINARY_ACTION_STATUS pada lib/discipline/presentation.mjs menjadi sumber label dan tone untuk UI serta Excel. Gunakan Sanksi Aktif, Sanksi Berakhir, Sanksi Dicabut, Sanksi Digantikan, Sanksi dalam Banding, Sanksi Belum Berlaku, dan Draft Sanksi. Status pegawai tetap menggunakan katalog pegawai (misalnya Aktif), sehingga kedua informasi tidak tertukar. Filter dan form memakai label Status sanksi; nilai teknis status/API tidak berubah.
