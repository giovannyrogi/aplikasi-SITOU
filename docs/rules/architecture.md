# Arsitektur dan batas implementasi

## Stack dan struktur yang diharapkan

- Web/API: Next.js versi stabil dengan App Router dan TypeScript strict.

- Database: PostgreSQL 18.

- Validasi: schema bersama untuk request API, form, import, dan environment.

- File: penyimpanan privat melalui service abstraction; database hanya menyimpan metadata `stored_files`.

- Background job: antrean untuk import, rekap, indikator, export, notifikasi, dan outbox.

- Mobile: memakai API versi yang sama; tidak mengakses PostgreSQL secara langsung.

Pisahkan lapisan berikut:

1. `domain`: aturan bisnis murni dan tipe.

2. `application`: use case/transaksi.

3. `infrastructure`: database, storage, queue, email, dan integrasi.

4. `interfaces`: route handler, server action, worker, dan UI.

Route handler tidak boleh berisi query dan aturan bisnis panjang. Gunakan service/use case.

## Larangan untuk Codex/developer

- Jangan menghapus histori pegawai untuk “merapikan” data.

- Jangan menambahkan kolom `current_division`/`current_location` sebagai sumber kebenaran kedua.

- Jangan menghubungkan tabel lintas organisasi hanya dengan ID tanpa memeriksa organisasi.

- Jangan menjadikan setiap checkout lewat jam sebagai lembur otomatis.

- Jangan membuat sanksi otomatis dari indikator.

- Jangan mengizinkan pimpinan menyetujui izin bila aturan produk masih HRD-only.

- Jangan menyimpan foto/dokumen sebagai URL publik atau base64 di tabel transaksi.

- Jangan memanggil database langsung dari mobile.

- Jangan menjalankan export besar pada request web sinkron.

- Jangan menonaktifkan constraint/index demi melewati bug tanpa analisis dan migration resmi.
