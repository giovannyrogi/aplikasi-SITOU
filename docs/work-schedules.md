# Jadwal kerja fleksibel

## Alur tahap pertama

1. Data Master → Shift & Pola Kerja: master bernama tanpa Kode. Jam tetap mendukung selesai hari berikutnya; jam fleksibel mempunyai rentang masuk, target menit, istirahat dan batas selesai. Istirahat dapat mengurangi durasi kerja bersih. Toleransi disimpan untuk penilaian absensi tahap berikutnya. Jenis field legacy tetap ada, pengaturan lapangan belum dibuka.
2. Pola mingguan berisi Senin–Minggu; rotasi 1–366 hari dengan tanggal acuan. Setiap hari 0–16 sesi; kosong berarti Libur. Pengaturan Organisasi → Kalender Libur mencatat tanggal/nama secara eksplisit. Pola memilih Libur mengikuti kalender atau Tetap mengikuti jadwal. Flag hari libur terpisah dari kewajiban bekerja.
3. Kepegawaian → Jadwal Kerja: pilih maksimal 100 Pegawai secara eksplisit. Isi pola, tanggal, acuan rotasi; periksa ringkasan dan konfirmasi. Penetapan dimulai hari ini/mendatang, menutup periode pendahulu sehari sebelum mulai. Penetapan masa depan existing tidak ditimpa; batalkan dengan alasan terlebih dahulu. Pembatalan tidak membuka kembali periode pendahulu otomatis; tetapkan pengganti sesuai kebutuhan. Filter Belum memiliki jadwal mengacu hari ini zona organisasi.
4. Periksa dan susun jadwal: maksimal 31 tanggal inklusif × 100 Pegawai. Preview tidak menulis. Susun jadwal setelah konfirmasi; perubahan belum terpakai memerlukan versi preview. Perubahan master/kalender tidak otomatis menulis ulang snapshot. Jadwal khusus per tanggal menyimpan sesi/alasan/version; kosong berarti libur. Riwayat ada di menu utama dan detail Pegawai.
5. Pendaftaran: Jadwal kerja awal opsional pada langkah 4 Penempatan, memerlukan hak Kelola Jadwal Kerja. Field terkait wajib lengkap ketika pola dipilih. Draft menyimpan/memulihkan pilihan. Profil dan penetapan disimpan atomik; payload lama tanpa jadwal tetap valid. Import belum diubah.

## Resolusi dan histori

Jadwal khusus Pegawai → pola Pegawai + kebijakan kalender → belum diatur (needs_review), bukan dianggap libur/masuk otomatis. Penetapan divisi/lokasi lama dipertahankan dalam schema, tetapi pewarisan belum dipakai resolver tahap ini. Tidak menyimpan shift_id permanen di profil.

work_shifts adalah identitas/status. work_shift_revisions.rules adalah aturan efektif; kolom jam lama dipertahankan untuk kompatibilitas, bukan sumber aturan baru. Revisi yang direferensikan pola/snapshot paling cepat besok, setelah revisi terakhir, dengan alasan. Revisi lama tidak ditimpa/dihapus. Susunan pola yang pernah ditetapkan harus diduplikasi untuk diganti; nama/status tetap dapat diedit.

employee_daily_schedules tetap satu induk per organisasi/Pegawai/tanggal kerja. work_schedule_sessions menyimpan urutan, shift/revisi, aturan, waktu UTC. Shift malam mengikuti tanggal mulai. Jam ditafsirkan menurut timezone IANA organisasi. Waktu lokal ambigu/tidak ada akibat DST ditolak. Rentang fleksibel mencadangkan seluruh jendela sampai batas selesai untuk deteksi benturan; bukan pengakuan durasi kehadiran. Jeda antarsesi tidak dihitung bekerja.

Snapshot dengan attendance_events atau attendance_daily_summaries/keputusan HRD tidak ditimpa; preview memakai snapshot asli dan generator melewatinya. Penetapan/pembatalan/jadwal khusus menolak mengubah bukti terpakai. Mutation mengunci organisasi lalu Pegawai terurut; version check dan exclusion PostgreSQL menjaga periode/waktu dari overlap, termasuk hari sebelumnya. Seluruh batch atomik. Integrasi absensi mendatang wajib memakai locking Pegawai yang sama.

requestKey UUID terikat organisasi/pelaku/operasi/hash payload. Retry sama mengembalikan hasil; payload berubah 409. Receipt belum diberi retention agar retry lama tidak menghasilkan mutation kedua; pantau pertumbuhannya sebelum membuat kebijakan pembersihan.

## Kontrak API

Cookie web existing, role HRD/Superadmin, membership/masa akses aktif, grant HRIS terkini. Bearer mobile tidak membuka API administrasi. HRD terkunci organisasi sesi; Superadmin memilih organisasi eksplisit. Scope lokasi diperiksa pada daftar serta setiap target. Origin guard, rate limit mutation, JSON strict Zod, payload maksimal 256 KiB, audit, no-store berlaku. Respons {success,code,message,data,requestId,pagination?}, gagal fieldErrors bila diketahui. Tanggal YYYY-MM-DD, jam HH:mm, waktu absolut ISO 8601 UTC, ID string desimal.

| Endpoint | Metode | Hak dan data |
| --- | --- | --- |
| /api/work-shifts | GET/POST | work-shifts baca/kelola; name,isActive,rules,effectiveFrom?,reason? |
| /api/shift-patterns | GET/POST | work-shifts baca/kelola; name,isActive,patternType,cycleDays,calendarId,holidayPolicy,days:[{day,shiftIds}] |
| /api/shift-patterns/options | GET | work-shifts baca; referensi minimum shift/kalender |
| /api/work-calendars | GET/POST | work-calendars baca/kelola; name,isActive,days:[{date,name}] |
| /api/work-schedules | GET/POST | work-schedules baca/kelola; daftar Pegawai atau employeeIds,patternId,from,until?,anchorDate?,reason,expectedVersions |
| /api/work-schedules/options | GET | work-schedules baca; referensi minimum pola/shift dan today organisasi |
| /api/work-schedules/preview | POST | work-schedules baca; employeeIds,from,until; tanpa penulisan |
| /api/work-schedules/generate | POST | work-schedules kelola; employeeIds,from,until,replace,expectedVersions,requestKey |
| /api/work-schedules/exceptions | POST | work-schedules kelola; employeeId,date,shiftIds,reason,version,requestKey |
| /api/work-schedules/cancel | POST | work-schedules kelola; id,version,reason,requestKey; hanya mendatang belum terpakai |

Semua body membawa organizationId yang diverifikasi server. Master POST memerlukan requestKey; update juga id/version. GET daftar page/pageSize≤100/search/status/organizationId; daftar Pegawai juga without=true/false dan employeeId. Opsi mendukung q/search dan maksimal 100 hasil per pencarian. rules: type fixed/flexible/off, startTime/endTime atau windowStart/windowEnd/latestFinish, requiredMinutes,breakMinutes,deductBreak,nextDay,lateTolerance,earlyTolerance. Nilai menit integer 0–1440; konsistensi rentang diperiksa backend. UI tidak meminta kode atau actor ID.

Preview memuat employeeId,date,status,isHoliday,holidayName,assignmentId,exceptionId,exceptionVersion,reason,patternName,sessions,version. Sesi: sessionNo,shiftId,revisionId,name,startsAt,endsAt,rules. expectedVersions penetapan key employeeId; generator key employeeId:YYYY-MM-DD. Konflik versi/key/nama/overlap 409, validasi domain 422, izin 403.

## Batas tahap berikutnya

Absensi mobile, persetujuan kerja tambahan dan penggantian waktu belum diintegrasikan. Kerja tambahan adalah sesi terpisah dengan waktu/durasi dinamis, bukan selalu malam atau dua jam (contoh uji 45/120/195 menit). Durasi diakui HRD setelah memperhitungkan istirahat. Penggantian harus menentukan tanggal/rentang, maksimal menit diakui, tanpa pemakaian ganda; tidak otomatis ke besok. Alasan kejadian di luar jadwal bukan persetujuan. Tidak membuat saldo waktu/kompensasi, payroll, atau mengubah event absensi existing.

## Migration dan rollout

066 sesudah 065; bootstrap final memuat struktur sama. Sebelum upgrade: backup, periksa dependency code shift/pola, nama duplikat case-insensitive/spasi, periode penetapan dan snapshot lama bertabrakan. Migration gagal tanpa CASCADE bila dependency masih ada; jangan menghapus histori untuk meloloskan migration. Kolom code modul lain tidak dihapus.

Development: npm run db:migrate -- database/migrations/20261028_066_work_schedule_foundation.sql lalu npm run db:verify-bootstrap. Runner belum memiliki ledger; cek work_schedule_sessions sebelum menjalankan dan jangan ulang file. Database existing di-upgrade satu migration, jangan menjalankan bootstrap. Production perlu runner operasional berizin, transaksi dan environment production. Urutan rollout: backup/staging → migration → kode → grant HRIS → smoke/regresi. Rollback penghapusan code harus direview/backup; jangan sekadar kembali ke kode lama. Tidak melakukan deployment VPS.

Acuan: [PostgreSQL range/exclusion](https://www.postgresql.org/docs/current/rangetypes.html), [OWASP API Security](https://owasp.org/API-Security/editions/2023/en/0x11-t10/). Bukti QA aktual dilaporkan dalam pekerjaan dan changelog mobile; bukan klaim sertifikasi keamanan.
