# Absensi mobile SITOU

Flutter memakai bearer mobile dan identitas Pegawai dari sesi. Hak profil dan penempatan sendiri, status akun, organisasi, modul Absensi, serta akses tulis untuk preflight/kirim diperiksa di server. Katalog jadwal dan titik tetap dikelola dari dashboard.

- GET `/api/mobile/attendance` mengembalikan `timezone`, `today`, `status`, sesi berisi tanggal kerja, urutan, jam UTC, absen aktual, tindakan, serta status lupa keluar. Titik berisi ID, nama, koordinat, radius dan batas akurasi. Pegawai ditangguhkan hanya mendapat status baca.
- POST `/api/mobile/attendance/preflight` menerima JSON `action`, `workDate`, `sessionNo`, `pointId`, `latitude`, `longitude`, `accuracy`. Respons berisi `proof` bertanda tangan dengan masa lima menit, jarak, status, pesan, `offerNote`, dan `requiresNote`. Bukti ini hanya berlaku pada sesi dan titik yang diperiksa.
- POST `/api/mobile/attendance/events` menerima multipart dengan satu bagian teks `data` (JSON preflight ditambah `proof`, UUID `clientEventId`, dan `note` maksimal 500 karakter, wajib bila posisi akhir di luar radius) serta satu `photo` maksimal 5 MiB. Backend memvalidasi ulang dan mengembalikan hasil dengan jam UTC, tanggal kerja, sesi, titik, dan zona waktu. Respons sukses juga berisi `note` string atau null dari catatan event yang tersimpan. Nilai telah dipangkas pada validasi input dan dibatasi 500 karakter. `pointName` berasal dari titik absensi yang dipakai, bukan profil/penempatan Pegawai. `occurredAt` dan `timezone` menentukan tanggal/jam kejadian; `workDate` tetap tanggal kerja sesi. UUID sama dan payload/foto sama mengembalikan hasil asli. Replay event lama melengkapi `note` dari `attendance_events.attendance_note` tanpa mengubah event atau receipt tersimpan. UUID dengan isi berbeda ditolak.
- Posisi di luar radius memakai titik yang berizin dan GPS yang memenuhi batas akurasi. Preflight mengembalikan `requiresNote: true`. Saat kirim, server menghitung ulang jarak dan menolak catatan kosong dengan HTTP 422 `OUTSIDE_NOTE_REQUIRED`. Event yang diterima menyimpan `geofence_status = outside` dan catatannya, dengan `validation_status = valid` sehingga urutan masuk/keluar tetap berjalan. Alur ini tidak memiliki tahap persetujuan. Klien lama menerima kontrak tambahan secara kompatibel, tetapi dapat gagal kirim di luar radius bila belum menyediakan isian catatan. Rilis aplikasi bersama perubahan API.
- Sesi tanpa aturan masuk khusus dibuka sejak awal tanggal kerja untuk sesi pertama. Sesi berikutnya dibuka setelah batas sesi sebelumnya bila tidak memiliki jendela khusus. Absen keluar mengacu ke sesi masuk terakhir yang belum ditutup. Memulai sesi lain meninggalkan sesi lama tanpa jam keluar. Shift malam mengikuti tanggal mulai. Waktu event online mengikuti server.
- Foto privat memakai kategori `attendance_photo`. Metadata dan event berada dalam transaksi. Gunakan ClamAV sesuai konfigurasi deployment dan aturan upload existing. Akses file mengikuti file ID berizin. Respons absensi tidak memuat URL, nama fisik atau path foto.

Pengaturan **Data Master → Organisasi → Peta absensi** hanya dapat disimpan Superadmin. `attendanceMapProvider` opsional pada API organisasi, dengan pilihan `openstreetmap` atau `google`. Default organisasi baru dan existing adalah OpenStreetMap. PATCH yang tidak mengirim pilihan mempertahankan nilai tersimpan. GET absensi mengirim `mapProvider` dari organisasi sesi. Tidak ada API key, URL tile, atau kredensial di API ini. Migration 078 wajib sebelum merilis kode baru.

Migration 077 menambahkan `schedule_session_id` dan `attendance_note` pada event, constraint komposit sesi, serta hash payload di receipt. Event lama masih bisa memiliki relasi sesi kosong. Sebelum merilis backend, terapkan migration dan restart aplikasi bersama rilisnya. Endpoint login, cookie web dan endpoint dashboard tetap memakai kontrak existing. Jangan terapkan skema bootstrap ke database existing.

## Susunan folder selfie baru

Contoh object key relatif terhadap UPLOAD_ROOT:

```text
org_1/absensi/2026/kantor-pusat-12/unit-operasional-5/11/10/budi-pulang-002523-<uuid>.png
```

- Tahun, bulan dan hari berasal dari tanggal kerja sesi. Foto pulang setelah tengah malam tetap berada bersama foto masuk pada tanggal kerja yang sama. Jam HHmmss berasal dari waktu server dalam zona organisasi.
- Lokasi dan divisi/unit memakai nama penempatan utama efektif pada tanggal kerja, terikat organisasi dan pegawai sesi. Akhiran ID menjaga nama hasil normalisasi tetap terpisah. Titik absen aktual tetap tercatat secara terpisah. Bila penempatan tidak tersedia pada tanggal kerja, folder memakai tanpa-penempatan dan tanpa-unit tanpa memperluas hak absen.
- Nama file memakai awalan nama depan, jenis absen, jam, dan UUID penuh buatan server. Server menormalisasi label ke huruf ASCII, angka dan tanda hubung, membatasi panjang dan memakai pegawai jika nama depan tidak dapat dibentuk dengan aman. Angka dikeluarkan dari nama depan. Ekstensi mengikuti MIME yang terdeteksi dari byte. Nama lengkap, NIP, NIK dan nama file klien tidak dipakai pada path.
- POST events memeriksa ulang izin, jadwal, titik, receipt dan bukti GPS sebelum menentukan folder. File ditulis sementara di folder tujuan dan dipublikasikan atomik tanpa timpa lewat hard link pada filesystem lokal. Gunakan volume UPLOAD_ROOT yang mendukung hard link. Kegagalan transaksi membersihkan file baru. Replay mengembalikan hasil sebelumnya tanpa menulis file lagi.
- Database memakai stored_files.object_key dan attendance_events.photo_file_id yang sudah ada. Pemeliharaan dan backup membaca object key tersimpan. File dari format terdahulu tetap dapat dibaca dari metadata bila ada. Struktur ini berlaku saat backend baru berjalan dan tidak membutuhkan migrasi database atau perubahan APK.

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
## Absen pada hari libur (migration 080)

Klien yang mendukung alur ini mengirim header `X-SITOU-Attendance-Version: 2` pada ketiga endpoint absensi. Klien lama tetap menerima sesi terjadwal dengan kontrak sebelumnya. Header hanya menyatakan kemampuan klien. Kelayakan tetap diperiksa dari sesi, modul, hak akses, penetapan dan revisi efektif di server.

- GET mengembalikan `holidayName` dan `allowHolidayAttendance` untuk hari berjalan. Sesi absen saat libur mengembalikan `holidayWork: true`, `holidayName` dan jam rencana null. Server menerbitkan aksi sesuai urutan absen. Shift malam yang belum ditutup tetap menggunakan tanggal kerja awal dan diselesaikan sebelum memulai absen tanpa jadwal pada hari libur.
- Preflight dan hasil simpan memisahkan `outsideRadius` dari `requiresNote`. Absen masuk dan pulang pada hari libur memerlukan alasan 1–500 karakter setelah trim. Kiriman kosong ditolak dengan `HOLIDAY_NOTE_REQUIRED`. Bukti foto, validasi titik/GPS, nonce permintaan, dan idempotensi tetap mengikuti alur yang sama.
- Event `holiday_work` memiliki `timing.version: 2` dan `category: not_applicable`. Acuan dan metrik penilaian waktu bernilai null. Rekap menyimpan tanggal dan status libur, penanda bekerja saat libur, serta durasi aktual setelah pasangan lengkap. Persetujuan lembur dan kompensasi tidak dibuat oleh alur ini.

Urutan rilis adalah migration 080 setelah 079, backend, lalu klien Flutter yang mendukung header baru.

## Bukti GPS dekat batas radius

Setelah sampel lolos batas akurasi, preflight dan hasil simpan mengembalikan nearRadiusBoundary berupa boolean. Server menandai jika nilai mutlak selisih jarak terhadap radius kurang dari atau sama dengan angka akurasi. Jarak dan akurasi dipakai sebelum pembulatan. Hasil simpan dihitung ulang dengan konfigurasi yang berlaku saat event disimpan dan menjadi bagian dari attendance_events.validation_details.result. Input tetap memakai allowlist yang sama. Penanda tidak mengubah geofence_status, aturan catatan, ataupun keputusan validasi event. Tinjau penanda bersama posisi, jarak dan akurasi, tanpa menyimpulkan manipulasi GPS hanya dari penanda tersebut.

Replay mengembalikan penanda event asli. Event lama tanpa penanda berarti belum dinilai dan tetap tidak diubah. Kolom JSONB existing sudah sesuai untuk bukti per event, sehingga tidak diperlukan tabel, kolom, index atau migration baru. Tampilan dan filter laporan ditunda. Pengaturan radius serta batas akurasi setiap lokasi dipertahankan.

## Absen di luar jadwal

Setelah semua sesi terjadwal pada hari kerja berakhir, backend menawarkan sesi tambahan apabila tidak ada sesi yang harus ditutup. Jadwal khusus diselesaikan oleh resolver existing dan mendapat prioritas yang sama dengan sesi terjadwal lainnya. Jika jadwal khusus berakhir lebih malam, sesi tambahan baru tersedia setelah jam akhirnya. Hari libur tetap memakai kebijakan absen saat libur. Hari tanpa jadwal tidak memperoleh sesi tambahan otomatis.

Sesi tambahan berisi waktu aktual dari server dan alasan wajib saat masuk dan pulang. Nomor 17–32 dicadangkan untuk pasangan sesi tambahan pada tanggal kerja, terpisah dari sesi terjadwal 1–16. Mulai sesi tambahan berikutnya setelah sesi sebelumnya ditutup. Absen pulang dapat dicatat setelah tengah malam memakai tanggal kerja asal selama sesi masih terbuka.

Klien versi 3 mengirim X-SITOU-Attendance-Version: 3 pada endpoint baca, preflight, dan events. Versi 2 tetap mendukung hari libur. Sesi tambahan hanya ditawarkan untuk versi 3. DTO sesi, preflight dan hasil memakai outsideSchedule. Lokasi di luar radius tetap memakai outsideRadius sehingga kedua penanda dapat muncul bersama. Pengiriman tanpa alasan ditolak dengan OUTSIDE_SCHEDULE_NOTE_REQUIRED. Backend memeriksa ulang sesi dan akses di bawah lock yang sama dengan absensi lain. Replay identik tetap mengembalikan event asli.

Migration 081 menambah outside_schedule_session_no pada attendance_events dan mengizinkan work_context=outside_schedule dengan penilaian versi 2, kategori not_applicable, dan tautan ke jadwal harian existing. Sesi tambahan tidak membuat shift fiktif. Rekap memasangkan nomor sesi dalam satu jadwal harian, menjumlahkan durasi aktual, dan menyimpan outsideScheduleSessions serta outsideScheduleWorkedMinutes dalam calculation_details. Hari dengan sesi tambahan ditandai needs_review. Durasi tambahan tidak mengisi kandidat atau persetujuan lembur. Absensi terjadwal yang terlewat tetap tercatat.

Urutan rilis adalah migration 081 setelah 080, backend, lalu APK dengan header versi 3. Sebelum memasang APK baru pada server lama yang memerlukan akses hari libur, naikkan versi backend agar versi 3 dikenali.
