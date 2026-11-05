# Absensi mobile SITOU

Flutter memakai bearer mobile dan identitas Pegawai dari sesi. Hak profil dan penempatan sendiri, status akun, organisasi, modul Absensi, serta akses tulis untuk preflight/kirim diperiksa di server. Katalog jadwal dan titik tetap dikelola dari dashboard.

- GET `/api/mobile/attendance` mengembalikan `timezone`, `today`, `status`, sesi berisi tanggal kerja, urutan, jam UTC, absen aktual, tindakan, serta status lupa keluar. Titik berisi ID, nama, koordinat, radius dan batas akurasi. Pegawai ditangguhkan hanya mendapat status baca.
- POST `/api/mobile/attendance/preflight` menerima JSON `action`, `workDate`, `sessionNo`, `pointId`, `latitude`, `longitude`, `accuracy`. Respons berisi `proof` bertanda tangan dengan masa lima menit, jarak, status, pesan, `offerNote`, dan `requiresNote`. Bukti ini hanya berlaku pada sesi dan titik yang diperiksa.
- POST `/api/mobile/attendance/events` menerima multipart dengan satu bagian teks `data` (JSON preflight ditambah `proof`, UUID `clientEventId`, dan `note` maksimal 500 karakter, wajib bila posisi akhir di luar radius) serta satu `photo` maksimal 5 MiB. Backend memvalidasi ulang dan mengembalikan hasil dengan jam UTC, tanggal kerja, sesi, titik, dan zona waktu. Respons sukses juga berisi `note` string atau null dari catatan event yang tersimpan. Nilai telah dipangkas pada validasi input dan dibatasi 500 karakter. `pointName` berasal dari titik absensi yang dipakai, bukan profil/penempatan Pegawai. `occurredAt` dan `timezone` menentukan tanggal/jam kejadian; `workDate` tetap tanggal kerja sesi. UUID sama dan payload/foto sama mengembalikan hasil asli. Replay event lama melengkapi `note` dari `attendance_events.attendance_note` tanpa mengubah event atau receipt tersimpan. UUID dengan isi berbeda ditolak.
- Posisi di luar radius memakai titik yang berizin dan GPS yang memenuhi batas akurasi. Preflight mengembalikan `requiresNote: true`. Saat kirim, server menghitung ulang jarak dan menolak catatan kosong dengan HTTP 422 `OUTSIDE_NOTE_REQUIRED`. Event yang diterima menyimpan `geofence_status = outside` dan catatannya, dengan `validation_status = valid` sehingga urutan masuk/keluar tetap berjalan. Alur ini tidak memiliki tahap persetujuan. Klien lama menerima kontrak tambahan secara kompatibel, tetapi dapat gagal kirim di luar radius bila belum menyediakan isian catatan. Rilis aplikasi bersama perubahan API.
- Sesi tanpa aturan masuk khusus dibuka sejak awal tanggal kerja untuk sesi pertama. Sesi berikutnya dibuka setelah batas sesi sebelumnya bila tidak memiliki jendela khusus. Absen keluar mengacu ke sesi masuk terakhir yang belum ditutup. Memulai sesi lain meninggalkan sesi lama tanpa jam keluar. Shift malam mengikuti tanggal mulai. Waktu event online mengikuti server.
- Foto privat memakai kategori `attendance_photo` pada `UPLOAD_ROOT/org_<id>/absensi/<tahun>/`. Metadata dan event berada dalam transaksi. Gunakan ClamAV sesuai konfigurasi deployment dan aturan upload existing. UUID bukan akses baca foto, dan respons absensi tidak mengandung URL foto.

Pengaturan **Data Master → Organisasi → Peta absensi** hanya dapat disimpan Superadmin. `attendanceMapProvider` opsional pada API organisasi, dengan pilihan `openstreetmap` atau `google`. Default organisasi baru dan existing adalah OpenStreetMap. PATCH yang tidak mengirim pilihan mempertahankan nilai tersimpan. GET absensi mengirim `mapProvider` dari organisasi sesi. Tidak ada API key, URL tile, atau kredensial di API ini. Migration 078 wajib sebelum merilis kode baru.

Migration 077 menambahkan `schedule_session_id` dan `attendance_note` pada event, constraint komposit sesi, serta hash payload di receipt. Event lama masih bisa memiliki relasi sesi kosong. Sebelum merilis backend, terapkan migration dan restart aplikasi bersama rilisnya. Endpoint login, cookie web dan endpoint dashboard tetap memakai kontrak existing. Jangan terapkan skema bootstrap ke database existing.

## Bukti terstruktur dan rekap (migration 079)

Event baru menyimpan assessment_version=1. timing_category membedakan on_time, early_check_in, late_check_in, early_check_out, late_check_out dan flexible_check_in. schedule_reference_at serta schedule_offset_seconds merekam acuan dan selisih bertanda; early_arrival_minutes, late_minutes, early_leave_minutes dan late_departure_minutes menjadi angka laporan. Menit dibulatkan ke bawah. Bila melewati toleransi, seluruh selisih dihitung mengikuti perilaku absensi existing; toleransi tidak dikurangi dari selisih. Selisih detik tetap tersedia untuk kejadian kurang dari satu menit. Check-in fleksibel tidak dinilai terlambat dari jam awal; acuan pulangnya adalah masuk aktual + target kerja + istirahat yang dikurangi.

Posisi Pegawai tetap latitude/longitude/accuracy_m. Bukti titik dibekukan pada point_location_id_snapshot, point_name_snapshot, point_latitude_snapshot, point_longitude_snapshot dan max_accuracy_m_snapshot; allowed_radius_m dan distance_from_point_m tetap menyimpan radius/jarak kejadian. organization_timezone_snapshot membekukan zona waktu. Perubahan master tidak mengubah bukti lama. Tidak menampilkan koordinat atau foto pada log.

Preflight menambahkan timing; hasil kirim menambahkan timing dan pointSnapshot (name, locationId, latitude, longitude, radiusMeters, maxAccuracyMeters). Semua angka berasal dari server, bukan input penilaian klien. Envelope/auth dan field existing tetap berlaku. Receipt lama boleh tidak berisi objek baru; jangan mengarang bukti atau menghitung ulang respons historis berdasarkan master terbaru.

lib/attendance-points/timing.mjs menjadi perhitungan bersama. summaries.mjs memperbarui attendance_daily_summaries dalam transaksi event/receipt/file yang sama. Lock organisasi lalu Pegawai menggunakan FOR NO KEY UPDATE, kompatibel dengan pemeriksaan FK metadata foto; snapshot/rekap dikunci sebelum upsert. Kegagalan rekap membatalkan event dan receipt. Lock serta pemeriksaan urutan melindungi request paralel; UUID tetap terikat hash payload.

Rekap menyimpan scheduled_minutes, worked_minutes, early_arrival_minutes, late_minutes, early_leave_minutes, late_departure_minutes, jumlah sesi terencana/lengkap/terbuka, missing_check_in_count, missing_check_out_count, unassessed_event_count dan outside_event_count. calculation_details versi 1 mencatat sumber event per sesi, detik kerja, sesi menunggu dan durationComplete. Durasi hanya menjumlahkan pasangan masuk/pulang valid, mengurangi istirahat per sesi dan mengecualikan jeda antarsesi. Sesi belum mulai bukan ketidakhadiran. Masuk sesi baru memperbarui sesi sebelumnya yang belum pulang tanpa membuat jam pulang.

overtime_candidate_minutes hanya kandidat dari pulang melewati acuan, bukan persetujuan lembur. Datang awal tetap metrik terpisah. approved_overtime_minutes, override manual serta keputusan leave/permission/sick/official_duty/off/holiday tidak ditimpa. Status incomplete/needs_review harus terlihat sebagai data belum final pada laporan mendatang; jangan membaca pesan UI sebagai kategori.

Batas tahap ini: rekap event-backed, belum rekonsiliasi hari tanpa event dengan cuti/izin/kalender atau proses koreksi HRD. Event lama tidak diubah; bukti baru tetap NULL. Rekap lama dapat memakai snapshot sesi untuk perkiraan waktu/durasi, tetapi wajib needs_review dan unassessed_event_count > 0. Bukti titik lama tidak bisa direkonstruksi dari titik sekarang.

### Operasional dan urutan rilis

Terapkan 079 setelah 077/078 menggunakan runner migration existing, lalu restart backend dan rilis mobile. Bootstrap hanya untuk database baru. Tidak ada deployment VPS otomatis.

Pembentukan ulang dibatasi satu organisasi, 31 hari dan 100 Pegawai; --employees opsional berisi ID dipisahkan koma. Tanpa --apply seluruh perubahan di-rollback. Commit per Pegawai, sehingga kegagalan batch setelah sebagian commit dapat dilanjutkan dengan perintah idempotent yang sama. Kredensial dibaca di backend melalui ENV_FILE, default .env.development; untuk server tetapkan ENV_FILE=.env.production secara eksplisit. Jangan menyalin environment ke Flutter.

Contoh dari folder backend (PowerShell/Windows gunakan node langsung):
```powershell
node scripts/rebuild-attendance-summaries.mjs --organization=1 --from=2026-11-05 --until=2026-11-05
node scripts/rebuild-attendance-summaries.mjs --organization=1 --from=2026-11-05 --until=2026-11-05 --apply
```
ID/tanggal contoh harus disesuaikan. Perintah hanya merekap snapshot berisi event dan mempertahankan keputusan HRD; bukan mengesahkan histori yang belum lengkap.
