# Koreksi UI Inventaris

## UI/UX

- Seluruh label/pesan yang dibaca pengguna untuk akses modul memakai istilah **Fitur**, **Akses fitur**, dan **Fitur dan izin**, bukan Paket. Aktivasi organisasi memakai **Fitur organisasi** dan label **Fitur Inventaris**; pilihan izin memakai **Fitur Inventaris — Lihat Saja/Pengelola Gudang/Pengelola Master Inventaris**. Identifier teknis seperti `packageCode`, `packageAccess`, tabel paket, serta kode permission tetap menjadi kontrak internal/API. Istilah paket backup tetap berlaku untuk arsip backup, karena merupakan domain berbeda.

- Daftar organisasi Superadmin menampilkan **Fitur aktif** dari konfigurasi server, termasuk pada kartu mobile. Belum ada aktivasi ditampilkan sebagai **Belum ada fitur tambahan**; jangan menebak dari role akun atau menyamakan aktivasi fitur dengan izin semua pengguna. Form akses fitur menjelaskan tempat membuat gudang: Data Master → Gudang.

- Warna brand dipakai secara selektif untuk identitas, aksi utama, state aktif, atau penekanan yang memang perlu; jangan mewarnai semua angka, ikon, dan panel hanya agar tampak ber-brand. Data utama seperti jumlah stok tetap memakai warna teks netral agar mudah dibaca. Warna lain tetap boleh dipakai sesuai makna status/aksi. Ikon dekoratif berlatar warna memakai reusable `AppIconTile` dengan intensitas latar yang konsisten antar-tone; jangan merakit ulang kotak latarnya di setiap fitur. Pada ringkasan stok awal, ikon **Stok awal** memakai biru dengan latar biru pastel, sedangkan ikon **Stok saat ini** memakai merah brand dengan latar merah pastel; kedua angka stok tetap netral.

## Jarak informasi pada field

- Panel penjelasan izin `AccessExplanation` di bawah dropdown memakai jarak visual
  minimal 16px dari control pada HRIS maupun Inventaris. Atur melalui komponen
  reusable, bukan margin khusus per submenu; bantuan teks biasa tetap mengikuti 8px.
