# Export Cuti & Izin

Pada Kepegawaian → Cuti & Izin, tombol Export berada di header Daftar cuti dan izin. Excel mengunduh semua hasil filter, bukan hanya halaman yang terlihat. Pilihan PDF menampilkan notifikasi Coming soon; belum membuat file PDF.

## API

`GET /api/leave-requests/export` menerima filter yang sama dengan `GET /api/leave-requests`: organisasi, pegawai, jenis, lokasi, Divisi & Unit, jabatan, status, kategori, periode, sumber, saldo, lampiran, status pegawai, tanggal, pencarian dan urutan. Pagination diabaikan saat export. Rentang tanggal memakai periode yang beririsan seperti daftar; durasi merupakan durasi penuh setiap cuti/izin, bukan durasi yang dipotong pada batas filter.

- Wajib session dan permission `leave_requests.read`; organisasi diperiksa server dan scope lokasi mengikuti penempatan pada awal cuti/izin seperti daftar.
- Maksimal 5.000 data. Hasil lebih banyak ditolak dengan `LEAVE_EXPORT_LIMIT`, HTTP 400, disertai arahan mempersempit filter.
- Data dan total dibaca dalam satu snapshot repeatable read. Workbook dibuat setelah transaksi baca selesai; ekspor dicatat sebagai audit `leave_request.export` sebelum dikirim.
- Respons XLSX memakai private/no-store, nosniff, dan nama `sitou-cuti-izin-YYYY-MM-DD.xlsx` menurut tanggal organisasi.
- Kolom: nomor cuti/izin, NIP, nama, jenis, kategori, tanggal mulai/akhir, durasi, satuan, lokasi, Divisi & Unit, jabatan, status.
- NIP/nomor tetap teks; durasi angka bulat tanpa titik tambahan. Nilai berawalan formula diperlakukan sebagai teks literal. Alasan pribadi, data medis, dokumen, dan URL file tidak disertakan.

## Verifikasi

Gunakan database sementara dan data sintetis: bandingkan seluruh hasil daftar dengan Excel meskipun daftar dipaginasi; uji filter tanggal/status/pegawai, scope lokasi, organisasi berbeda, tanpa izin, hasil kosong, batas 5.000, format NIP dan durasi, serta audit. Pada browser periksa unduhan Excel dan notifikasi PDF pada desktop/mobile. Hapus seluruh fixture dan skrip sementara setelah pengujian berhasil.
