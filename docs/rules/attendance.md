# Aturan domain absensi

## Absensi tahap dashboard

Jangan memaksa HRD memasukkan ratusan pegawai satu per satu. Implementasikan urutan berikut:

1. Download template Excel/CSV dengan NIP, tanggal, jam masuk, jam pulang, status, dan catatan.

2. Upload ke file privat dan buat `attendance_import_batches`.

3. Parse ke `attendance_import_rows` tanpa langsung menulis event final.

4. Tampilkan preview dan error per baris: NIP tidak ada, duplikat, tanggal invalid, di luar organisasi, atau urutan jam salah.

5. Commit seluruh baris valid dalam transaksi/batch yang idempotent.

6. Buat event `source='import'`, hitung ulang rekap terkait, dan tulis audit.

Sediakan input manual hanya untuk koreksi kasus kecil. Setiap koreksi menyimpan alasan, actor, dan audit.

Web kiosk/PWA capture boleh ditambahkan sebagai jembatan, tetapi harus memanggil endpoint attendance yang sama dengan mobile masa depan. Jangan membuat database kedua.

## Kontrak mobile attendance

- Sesi masuk yang masih terbuka diprioritaskan untuk pulang, termasuk setelah tengah malam. Selama sesi tersebut terbuka, server tidak menawarkan atau menerima masuk pada sesi/tanggal lain; pemeriksaan diulang dalam transaksi event setelah lock Pegawai. Identitas sesi adalah tanggal kerja dan nomor sesi, bukan nomor sesi saja. Data lama berstatus lupa pulang tidak ditulis ulang. Label mobile menyembunyikan akhiran sesi internal dan anotasi +1 hari; timestamp serta tanggal kerja pada API tetap utuh.

Mobile mengirim UUID `client_event_id` yang tetap sama saat retry. Server:

1. Autentikasi user dan petakan ke pegawai.

2. Buat/ambil `attendance_event_receipts` berdasarkan `(organization_id, client_event_id)`.

3. Jika receipt sudah `stored`, kembalikan hasil lama tanpa insert baru.

4. Ambil jadwal dan titik yang berlaku pada waktu kejadian.

5. Validasi waktu, koordinat, akurasi, radius, foto, perangkat, dan batas replay.

6. Simpan foto privat lebih dahulu secara aman, lalu event dan status receipt dalam transaksi terkoordinasi.

7. Jalankan rekap dan indikator secara asinkron/idempotent.

Event offline diperbolehkan sesuai kebijakan organisasi. Simpan `occurred_at`, `received_at`, timezone, serta flag offline. Jangan memakai jam perangkat tanpa pemeriksaan deviasi.

## Geofence, foto, dan validasi background

- `attendance_points` menyimpan koordinat, radius, batas akurasi, dan kebutuhan foto.

- `attendance_point_assignments` dapat menarget pegawai, divisi, atau lokasi dengan periode berlaku.

- Event menyimpan snapshot `distance_from_point_m` dan `allowed_radius_m`; perubahan radius tidak mengubah histori.

- Backend menghitung jarak dan tidak mempercayai boolean `inside_geofence` dari klien.

- Koordinat dan foto dianggap data sensitif dengan retention yang jelas.

- Foto wajib memiliki pemeriksaan MIME nyata, ukuran, dimensi, hash, dan malware scan bila tersedia.

- Validasi background/liveness adalah hasil verifikasi, bukan bukti absolut. Status meragukan masuk `needs_review`.

- Jangan menyimpan biometric embedding mentah tanpa keputusan hukum, keamanan, dan retention terpisah.

## Rekap absensi

`attendance_events` adalah bukti mentah. `attendance_daily_summaries` menyimpan:

- hadir, terlambat, tidak hadir, cuti, izin, sakit, dinas, libur, tidak lengkap, perlu tinjau;

- jam masuk pertama dan pulang terakhir;

- menit kerja, terlambat, pulang awal, kandidat lembur, dan lembur disetujui;

- versi kalkulasi dan waktu hitung.

Rekap harus mempertimbangkan jadwal, event valid, izin disetujui, hari libur, dan koreksi HRD. Perubahan aturan memicu recalculation terkontrol, bukan update event mentah.

Dashboard dan laporan rutin membaca rekap, bukan menghitung jutaan event setiap request.
