# Jadwal kerja SITOU

## Aktivasi Fitur Absensi oleh Admin SITOU

Fitur organisasi dan izin akun adalah dua lapis yang berbeda. Sebelum HRD memakai jadwal, Admin SITOU membuka **Organisasi → Fitur organisasi**, mengaktifkan **Fitur Absensi**, lalu menyimpan. Jadwal Kerja, Kalender Libur dan Jadwal Pegawai memakai aktivasi yang sama. Setelah itu HRD tetap memerlukan hak baca/kelola menu terkait atau status Admin HRD penuh. Aktivasi tidak membuat grant baru. Cuti dan izin tetap terpisah.

Organisasi tanpa aktivasi dianggap nonaktif, termasuk organisasi lama. Saat dinonaktifkan, menu jadwal HRD serta API operasional ditutup pada request berikutnya. Jadwal, kalender, penetapan, audit dan grant lama tidak dihapus atau dibatalkan. Pengaktifan kembali memakai grant yang masih berlaku. Admin HRD penuh tidak melewati gerbang ini. Admin SITOU dapat mengatur aktivasi, tetapi API data jadwal juga memerlukan fitur organisasi aktif.

Sumber aktivasi adalah organization_modules dengan module_code attendance. Identitas organisasi tetap diverifikasi server. requireScheduleAccess memeriksa requireAttendanceModule sebelum membaca/menulis jadwal, termasuk penetapan pada transaksi pendaftaran. Mutation jadwal dan pengaturan fitur mengunci organisasi terlebih dahulu agar tidak ada penulisan yang lolos setelah penonaktifan selesai. GET kalender tetap tanpa mutation. Izin foto Pegawai dari menu jadwal mengikuti izin efektif dan scope yang sama. Izin foto melalui menu lain yang sah tidak ikut dicabut.

Snapshot akses memuat hris.attendanceEnabled dan grant efektif yang telah disaring. Grant tersimpan tetap ada pada assigned. Perubahan aktivasi masuk scopeRevision dan pembanding perubahan akses, sehingga halaman/sesi lama mengikuti hak terbaru. Browser bukan kontrol keamanan dan token tidak menyimpan keputusan aktivasi.

### Kontrak aktivasi organisasi

- GET /api/access/modules?organizationId=ID tetap mengembalikan data Inventaris {is_enabled,version} untuk kompatibilitas.
- GET /api/access/modules?organizationId=ID&view=all mengembalikan data {modules:{inventory:{is_enabled,version},attendance:{is_enabled,version}}}. Baris yang belum ada bernilai false, versi 0.
- PATCH /api/access/modules menerima bentuk lama {organizationId,isEnabled,version} khusus Inventaris, atau bentuk baru {organizationId,changes:[{moduleCode,isEnabled,version}]}. moduleCode hanya inventory/attendance, maksimal dua perubahan tanpa duplikasi. Respons batch berisi data.modules untuk fitur yang diubah.
- Kedua endpoint hanya untuk Admin SITOU berizin access.modules.manage. PATCH memakai origin guard, batas payload, schema strict, transaksi, audit access.module.change per fitur dan version check. Seluruh batch dibatalkan bila satu perubahan gagal. Versi usang menghasilkan 409 VERSION_CONFLICT. Retry setelah hasil jaringan tidak pasti harus memuat ulang versi, bukan mengirim ulang tanpa pemeriksaan. Tidak mengklaim batch ini sebagai mutation receipt jadwal.
- API jadwal mengembalikan 403 ketika fitur nonaktif, termasuk ATTENDANCE_DISABLED pada gerbang service. Guard menu HRD dapat menolak lebih dahulu sebagai FORBIDDEN. Tanpa sesi tetap 401. Mengaktifkan fitur tidak melampaui permission, scope Pegawai/lokasi atau batas organisasi.

Migration 068 hanya menambahkan katalog attendance pada access_modules. Tidak menambah tabel/kolom, mengaktifkan organisasi, memberi grant atau mengubah data jadwal. Bootstrap final memuat seed yang sama. Setelah upgrade, Admin SITOU menentukan organisasi yang akan diaktifkan secara eksplisit. Jangan mengulang 063–067 dan jangan memakai bootstrap untuk upgrade.

### Integrasi absensi berikutnya

Kamera, lokasi dan pencatatan absensi mobile belum dibangun oleh perubahan ini. Endpoint absensi mendatang wajib memeriksa aktivasi attendance pada organisasi sesi serta permission self-service/objek dan kebijakan tulis yang berlaku. Gunakan gerbang bersama requireAttendanceModule dan urutan lock organisasi pada mutation, tanpa mempercayai flag perangkat. Login, cookie, mobile bearer, Homepage dan Cuti/izin tidak berubah. Mematikan fitur tidak menghapus data absensi yang kelak tersimpan.

## Alur yang tersedia

Data Master → Jadwal Kerja menyediakan dua jenis jadwal. Isi Nama jadwal, lalu pilih **Jam kerja tetap** atau **Kerja shift** melalui dropdown Jenis jam kerja. Kedua field sejajar pada desktop dan bertumpuk selebar area pada ponsel. Pilihan jenis tidak diisi otomatis pada jadwal baru. URL menu dan hak akses existing tetap dipertahankan.

- **Jam kerja tetap**: pilih Hari kerja dan isi Jam kerja utama sekali. Misalnya Senin–Sabtu 09.00–17.00 dengan Minggu libur. Jam hari tertentu dapat dibedakan melalui panel Atur jam kerja per hari.
- **Kerja shift**: pilih Hari kerja, isi nama serta jam shift pertama, kemudian gunakan Tambah shift untuk pilihan berikutnya. Nama ditentukan HRD, misalnya Petugas awal, Petugas akhir atau Penjagaan khusus. Nama serta jam tidak dikunci sistem. Maksimal 16 pilihan per kelompok untuk membatasi payload dan pekerjaan dalam satu transaksi.

HRD menetapkan **satu pilihan shift** kepada setiap Pegawai. Membuat tiga pilihan shift tidak berarti Pegawai harus menjalani ketiganya. Pilihan penetapan menampilkan Nama jadwal — Nama shift. Tidak ada pergantian shift otomatis dari hari ke hari. Untuk memindahkan Pegawai ke shift lain, tetapkan pilihan dan tanggal berlakunya melalui Jadwal Pegawai.

Informasi Hari libur dan pilihan shift memakai AppNotice bersama. Hari yang tidak dipilih adalah Libur. Tidak ada pilihan Libur kedua atau tombol menambah waktu kerja pada hari libur dalam form baru. Buat jadwal terpisah bagi kelompok dengan hari libur rutin berbeda. Jangan menentukan jadwal otomatis berdasarkan agama, role, divisi atau lokasi.

Daftar memakai dropdown **Jenis jam kerja** pada Filter data, menggantikan tab. Pilih Jam kerja tetap untuk jadwal mandiri existing atau Kerja shift untuk kelompok pilihan shift. Pencarian nama serta status mengikuti jenis yang dipilih. Perubahan jenis kembali ke halaman pertama. Atur ulang mengosongkan pencarian, memilih Semua status dan Jam kerja tetap, serta mempertahankan organisasi. Hanya endpoint jenis aktif yang dimuat, dengan pembatalan respons lama melalui hook bersama. Deskripsi filter ditampilkan di bawah judul.

## Mengisi jam dan aturan libur

1. Isi Jam masuk dan Jam pulang. Form tidak mengisi contoh nama, hari atau jam secara otomatis.
2. Aktifkan **Pulang hari berikutnya** bila melewati tengah malam. Contoh: masuk 22.00, pulang 06.00 besok. Urutan angka jam tidak mengaktifkan pilihan ini secara diam-diam.
3. Isi **Istirahat (menit)**, awalnya nol. Jika **Kurangi durasi kerja dengan istirahat** aktif, 09.00–17.00 dengan istirahat 60 menit dihitung 7 jam kerja. Jika nonaktif, tetap 8 jam. Ini aturan durasi jadwal, bukan pengakuan kehadiran atau perhitungan gaji.
4. Buka **Toleransi waktu** bila diperlukan. Toleransi terlambat memberi kelonggaran setelah jam masuk. Toleransi pulang awal memberi kelonggaran sebelum jam pulang. Nol berarti tanpa kelonggaran. Pencatatan absensi mobile belum menggunakannya pada tahap ini.
5. Pada Jam kerja tetap, buka **Atur jam kerja per hari** jika ada hari berbeda. Ubah jam pada hari yang diperlukan. Hari lain mengikuti jam utama. Membuka editor tidak langsung mengubah status hari. Chip Jam utama dan Jam khusus memakai komponen bersama serta teks selain warna.
6. Pada Kerja shift, tiap pilihan dapat dibuka dan dilipat. Header tetap memperlihatkan nama serta jamnya. Shift baru yang kosong langsung terbuka, sedangkan pilihan existing yang bernama awalnya dilipat. Menutup panel mempertahankan isian. Validasi membuka shift dan panel toleransi yang perlu diperbaiki. Setiap pilihan memuat satu rentang waktu beserta istirahat dan toleransinya. Hapus shift hanya tersedia ketika ada lebih dari satu pilihan. Tidak ada pilihan Jam fleksibel, Rotasi atau beberapa waktu kerja untuk satu pilihan shift pada form baru.
7. **Kalender libur** opsional untuk libur nasional atau organisasi pada tanggal tertentu yang dimasukkan HRD melalui Kalender Libur. Jika dipilih, wajib memilih **Libur mengikuti kalender** atau **Tetap bekerja sesuai jadwal**. Tanpa kalender, libur mengikuti hari pada jadwal.
8. Switch **Jadwal aktif/nonaktif** berada paling bawah. Nonaktif menghilangkan pilihan dari penetapan baru, tanpa membatalkan jadwal Pegawai yang sudah berlaku.
9. **Simpan jadwal** membuka Ringkasan jadwal tanpa request tulis. Periksa seluruh pilihan, hari, jam, istirahat, toleransi, kalender dan status. Kembali ke form mempertahankan isian. Konfirmasi Simpan jadwal pada ringkasan baru mengirim satu request atomik. Kegagalan mempertahankan isian agar dapat dicoba lagi.

Rentang shift dalam satu kelompok tidak boleh bertumpuk, termasuk bagian shift malam yang masuk hari berikutnya. Contoh valid: 06.00–14.00, 14.00–22.00 dan 22.00–06.00 besok. Batas yang bersentuhan diperbolehkan. Contoh ditolak: 06.00–14.00 dan 13.00–21.00. Nama shift harus berbeda tanpa membedakan huruf besar dan spasi tepi. Gabungan Nama jadwal — Nama shift maksimal 100 karakter, mengikuti kapasitas identitas pola dan shift existing. Validasi dilakukan kembali di server.

## Penetapan dan pemantauan Pegawai

Kepegawaian → Jadwal Pegawai: pilih maksimal 100 Pegawai, pilih Tetapkan jadwal, jadwal tetap atau salah satu shift, tanggal berlaku dan alasan penggantian. Jadwal mulai hari ini atau mendatang, tidak sebelum tanggal bergabung. Pendahulu ditutup sehari sebelumnya. Penetapan mendatang tidak ditimpa. Pembatalan hanya untuk penetapan mendatang yang belum digunakan, dengan alasan dan konfirmasi. Pembatalan tidak mengaktifkan kembali pendahulu otomatis.

Filter Belum memiliki jadwal memeriksa hari ini menurut zona waktu organisasi, termasuk Pegawai yang baru memiliki jadwal mendatang. Lihat jadwal menampilkan kalender mingguan dan rentang maksimal 31 tanggal × 100 Pegawai, tanpa proses susun manual atau penulisan snapshot saat GET. Ubah jadwal pada tanggal tertentu memilih waktu kerja atau Libur dengan alasan wajib, tanpa mengubah jadwal rutin.

Pendaftaran tetap memakai Jadwal kerja pada langkah 4 Penempatan. Pilih Atur jadwal nanti atau pilih jadwal tetap/salah satu shift. Tanggal mulai mengikuti tanggal yang lebih akhir antara hari ini organisasi dan tanggal bergabung. Draft dipulihkan tanpa ditimpa. Hak Kelola Jadwal Pegawai tetap terpisah dari Data Pegawai. Profil dan penetapan disimpan dalam satu transaksi. Payload lama tanpa jadwal dan import tetap kompatibel.

## Data lama dan perubahan jadwal

Jadwal lama tetap dapat dibaca melalui daftar jadwal mandiri. Rotasi, jam fleksibel dan beberapa waktu kerja lama tidak dikonversi diam-diam. Form menampilkan pengaturannya sebagai ringkasan yang tidak dapat diubah, dengan nama/status tetap dapat diedit. Untuk memakai jenis baru, buat jadwal baru dan tetapkan mulai tanggal yang dipilih. Tanggal hari pertama putaran tetap tersedia ketika memilih pola rotasi lama pada penetapan, demi kompatibilitas.

Jadwal yang pernah ditetapkan, sudah memiliki rincian jadwal atau digunakan pada perubahan khusus hanya dapat diubah nama/statusnya. Gunakan Buat salinan jadwal untuk mengubah susunan. Penetapan dibatalkan sekalipun tetap dianggap histori. Pada kelompok shift yang belum digunakan, perubahan struktur mengarsipkan pilihan lama dan membuat pilihan baru dalam transaksi yang sama. ID lama tidak dipakai kembali. Penetapan bersamaan dengan pilihan lama ditolak bila perubahan lebih dulu selesai, atau perubahan struktur ditolak bila penetapan lebih dulu selesai. Nama/status saja mempertahankan ID pilihan. Kalender lama yang sudah nonaktif tetap dipertahankan saat metadata disimpan tanpa perubahan aturan. Pengaitan baru memerlukan kalender aktif.

Kelompok dan anggotanya disimpan eksplisit, tidak disimpulkan dari format nama. Setiap anggota mempunyai satu pola mingguan existing dan satu shift existing. Pola ini berisi satu shift pada hari kerja serta kosong pada hari libur. API master lama tidak dapat mengubah pola/shift milik kelompok atau memakai ulang shift kelompok secara terpisah. Tidak ada perubahan kontrak patternId penetapan, onboarding atau draft.

## API kelompok pilihan shift

GET/POST **/api/work-schedule-groups** memakai permission work-shifts baca/kelola yang sama, tanpa grant baru otomatis. GET menerima organizationId, page, pageSize maksimal 100, search dan status. Respons memuat id, name, working_days, calendar_id, calendar_name, holiday_policy, is_active, version, used, kind: shift serta shifts berisi name, patternId dan rules. Anggota arsip tidak menjadi pilihan baru.

POST memakai body strict berikut. rules tetap mengikuti schema aturan waktu existing, dengan type fixed untuk pilihan baru.

```json
{
  "organizationId": "1",
  "name": "Operasional",
  "isActive": true,
  "workingDays": [1, 2, 3, 4, 5, 6],
  "calendarId": null,
  "holidayPolicy": "roster",
  "shifts": [
    {
      "name": "Petugas awal",
      "rules": { "type": "fixed", "startTime": "06:00", "endTime": "14:00" }
    },
    {
      "name": "Petugas akhir",
      "rules": { "type": "fixed", "startTime": "14:00", "endTime": "22:00" }
    },
    {
      "name": "Penjagaan khusus",
      "rules": { "type": "fixed", "startTime": "22:00", "endTime": "06:00", "nextDay": true }
    }
  ],
  "requestKey": "00000000-0000-4000-8000-000000000001"
}
```

Nilai di atas hanya contoh kontrak, tidak diisi otomatis pada form. Edit menambah id dan version. Hari 1–7 berarti Senin–Minggu, wajib unik dan minimal satu. Respons simpan data berisi id dan patternIds. Perubahan struktur yang belum digunakan juga mengembalikan replacedUnusedPatternIds. Semua ID berupa string desimal. Nama/jam pilihan tidak dikirim sebagai otoritas saat penetapan, gunakan patternId yang diverifikasi server.

Receipt memakai operasi **shift-group.save**, terikat pelaku, organisasi, requestKey dan hash payload. Lock organisasi existing menserialkan penetapan/perubahan kelompok. Group, pola, shift, revisi, anggota, receipt dan audit berada dalam satu transaksi. Kegagalan salah satunya membatalkan seluruh perubahan. Konflik versi, histori atau payload key berbeda menghasilkan 409. Kalender di luar organisasi/tidak aktif ditolak. Akses organisasi lain serta role/grant yang tidak sesuai tetap ditolak server.

GET /api/work-schedule-templates tetap mengembalikan kontrak lama secara default, termasuk pola pilihan shift. Query opsional **standalone=true** mengecualikan pola milik kelompok, termasuk arsipnya, untuk daftar jadwal mandiri dashboard. Tidak mengubah respons default konsumen existing. Endpoint templates dan groups tetap berbeda untuk menghindari identitas ID kelompok disalahartikan sebagai patternId.

## Resolusi dan histori

Jadwal khusus Pegawai → pola Pegawai + kebijakan kalender → belum diatur (needs_review), bukan dianggap libur/masuk otomatis. Penetapan divisi/lokasi lama dipertahankan dalam schema, tetapi pewarisan belum dipakai resolver tahap ini. Tidak menyimpan shift_id permanen di profil.

work_shifts adalah identitas/status. Work_shift_revisions.rules adalah aturan efektif. Kolom jam lama dipertahankan untuk kompatibilitas, bukan sumber aturan baru. Revisi yang direferensikan pola/snapshot paling cepat besok, setelah revisi terakhir, dengan alasan. Revisi lama tidak ditimpa/dihapus. Susunan pola yang pernah ditetapkan harus diduplikasi untuk diganti. Nama/status tetap dapat diedit.

employee_daily_schedules tetap satu induk per organisasi/Pegawai/tanggal kerja. Work_schedule_sessions menyimpan urutan, shift/revisi, aturan, waktu UTC. Shift malam mengikuti tanggal mulai. Jam ditafsirkan menurut timezone IANA organisasi. Waktu lokal ambigu/tidak ada akibat DST ditolak. Rentang fleksibel mencadangkan seluruh jendela sampai batas selesai untuk deteksi benturan. Bukan pengakuan durasi kehadiran. Jeda antarsesi tidak dihitung bekerja.

Snapshot dengan attendance_events atau attendance_daily_summaries/keputusan HRD tidak ditimpa. Preview memakai snapshot asli dan generator melewatinya. Penetapan/pembatalan/jadwal khusus menolak mengubah bukti terpakai. Mutation mengunci organisasi lalu Pegawai terurut. Version check dan exclusion PostgreSQL menjaga periode/waktu dari overlap, termasuk hari sebelumnya. Seluruh batch atomik. Integrasi absensi mendatang wajib memakai locking Pegawai yang sama.

requestKey UUID terikat organisasi/pelaku/operasi/hash payload. Retry sama mengembalikan hasil. Payload berubah 409. Receipt belum diberi retention agar retry lama tidak menghasilkan mutation kedua. Pantau pertumbuhannya sebelum membuat kebijakan pembersihan.

## Kontrak API

Cookie web existing, role HRD/Admin SITOU, membership/masa akses aktif, grant HRIS terkini. Bearer mobile tidak membuka API administrasi. HRD terkunci organisasi sesi. Admin SITOU memilih organisasi eksplisit. Scope lokasi diperiksa pada daftar serta setiap target. Origin guard, rate limit mutation, JSON strict Zod, payload maksimal 256 KiB, audit, no-store berlaku. Respons {success,code,message,data,requestId,pagination?}, gagal fieldErrors bila diketahui. Tanggal YYYY-MM-DD, jam HH:mm, waktu absolut ISO 8601 UTC, ID string desimal.

| Endpoint                       | Metode   | Hak dan data                                                                                                                                                                                       |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /api/work-schedule-groups      | GET/POST | work-shifts baca/kelola. Kelompok pilihan shift, kontrak di bawah.                                                                                                                                 |
| /api/work-schedule-templates   | GET/POST | work-shifts baca/kelola. Identitas ID pola existing, POST name,isActive,patternType,cycleDays,calendarId,holidayPolicy,days:[{day,sessions:[{shiftId} atau {rules}]}], requestKey. Edit id/version |
| /api/work-schedules/calendar   | GET      | work-schedules baca. OrganizationId,employeeIds (ID dipisahkan koma, maksimal 100),from,until (maksimal 31 tanggal). Resolver read-only, tanpa requestKey/mutation                                 |
| /api/work-shifts               | GET/POST | work-shifts baca/kelola. Name,isActive,rules,effectiveFrom?,reason?                                                                                                                                |
| /api/shift-patterns            | GET/POST | work-shifts baca/kelola. Name,isActive,patternType,cycleDays,calendarId,holidayPolicy,days:[{day,shiftIds}]                                                                                        |
| /api/shift-patterns/options    | GET      | work-shifts baca. Referensi minimum shift/kalender                                                                                                                                                 |
| /api/work-calendars            | GET/POST | work-calendars baca/kelola. Name,isActive,days:[{date,name}]                                                                                                                                       |
| /api/work-schedules            | GET/POST | work-schedules baca/kelola. Daftar Pegawai atau employeeIds,patternId,from,until?,anchorDate?,reason,expectedVersions                                                                              |
| /api/work-schedules/options    | GET      | work-schedules baca. Referensi minimum pola/shift dan today organisasi                                                                                                                             |
| /api/work-schedules/preview    | POST     | work-schedules baca. EmployeeIds,from,until. Tanpa penulisan                                                                                                                                       |
| /api/work-schedules/generate   | POST     | work-schedules kelola. EmployeeIds,from,until,replace,expectedVersions,requestKey                                                                                                                  |
| /api/work-schedules/exceptions | POST     | work-schedules kelola. EmployeeId,date,shiftIds,reason,version,requestKey                                                                                                                          |
| /api/work-schedules/cancel     | POST     | work-schedules kelola. Id,version,reason,requestKey. Hanya mendatang belum terpakai                                                                                                                |

Semua body membawa organizationId yang diverifikasi server. Master POST memerlukan requestKey. Update juga id/version. GET daftar page/pageSize≤100/search/status/organizationId. Daftar Pegawai juga without=true/false dan employeeId. Opsi mendukung q/search dan maksimal 100 hasil per pencarian. Rules: type fixed/flexible/off, startTime/endTime atau windowStart/windowEnd/latestFinish, requiredMinutes,breakMinutes,deductBreak,nextDay,lateTolerance,earlyTolerance. Nilai menit integer 0–1440. Konsistensi rentang diperiksa backend. UI tidak meminta kode atau actor ID.

Preview memuat employeeId,date,status,isHoliday,holidayName,assignmentId,exceptionId,exceptionVersion,reason,patternName,sessions,version. Sesi: sessionNo,shiftId,revisionId,name,startsAt,endsAt,rules. ExpectedVersions penetapan key employeeId. Generator key employeeId:YYYY-MM-DD. Konflik versi/key/nama/overlap 409, validasi domain 422, izin 403.

GET templates memakai pagination/search/status existing. Setiap jadwal memuat days.sessions (shiftId,name,rules), used dan nama kalender. Opsi penetapan menambah ringkasan days, holiday_policy, calendar_name, today/timezone tanpa membuka izin mengelola master. POST sesi harus tepat salah satu shiftId atau rules. Backend memverifikasi organisasi, kelengkapan hari, aturan, overlap dan version. Sesi inline identik dalam request disimpan sekali, referensi lama tidak diubah. Idempotency memakai receipt existing dengan operasi template.save. Tanggal kalender GET memakai format date-only. Respons/envelope/error/timezone mengikuti preview existing. Generator lama tetap tersedia untuk kompatibilitas dan bukan prasyarat tampilan kalender baru.

## Batas tahap berikutnya

Rancangan absensi lanjutan: kamera → tinjau foto, jadwal, dan kondisi validasi → field alasan/catatan muncul pada form yang sama jika diperlukan → satu tombol Kirim absen masuk atau Kirim absen keluar. Catatan terlambat dapat opsional sesuai kebijakan. Sesi tambahan/hari libur wajib beralasan dan pengakuannya menunggu peninjauan HRD. Alasan bukan persetujuan. Titik/radius, foto, validasi server, mobile dan alur persetujuan tersebut belum diaktifkan oleh penyederhanaan dashboard ini.

Absensi mobile, persetujuan kerja tambahan dan penggantian waktu belum diintegrasikan. Kerja tambahan adalah sesi terpisah dengan waktu/durasi dinamis, bukan selalu malam atau dua jam (contoh uji 45/120/195 menit). Durasi diakui HRD setelah memperhitungkan istirahat. Penggantian harus menentukan tanggal/rentang, maksimal menit diakui, tanpa pemakaian ganda. Tidak otomatis ke besok. Alasan kejadian di luar jadwal bukan persetujuan. Tidak membuat saldo waktu/kompensasi, payroll, atau mengubah event absensi existing.

## Migration dan rollout

Fondasi 066 tetap diperlukan sesudah 065. Migration **20261029_067_work_schedule_shift_groups.sql** hanya menambahkan work_schedule_groups dan work_schedule_group_items, FK/constraint/index terkait. Tidak mengubah atau mengonversi data penetapan lama. Bootstrap sitou_schema_v3.sql memuat struktur akhir yang sama.

Sebelum kode baru digunakan pada environment existing, periksa keberadaan kedua tabel. Jika belum tersedia, jalankan hanya migration 067 setelah fondasi 066. Runner development belum memiliki ledger. Jangan menjalankan ulang 063–066 atau memakai bootstrap untuk memperbarui database existing. Jika hanya satu tabel tersedia, periksa kegagalan upgrade terlebih dahulu, jangan melanjutkan dengan asumsi schema lengkap.

Development: npm run db:migrate -- database/migrations/20261029_067_work_schedule_shift_groups.sql, lalu npm run db:verify-bootstrap. Production memerlukan otorisasi operasional, backup, staging dan runner sesuai environment. Urutan rollout: verifikasi upgrade/bootstrap → migration 067 → backend dan dashboard bersama → smoke/regresi. Migration baru tidak membuka permission/grant otomatis. Rollback kode dapat mempertahankan tabel tambahan. Jangan menghapus kelompok/pola/shift yang sudah memiliki histori untuk memaksakan rollback. Tidak ada deployment atau restart VPS otomatis.

Hasil pemeriksaan aktual dan status penerapan lokal dicatat di CHANGELOG.md. Suite sementara memakai database sintetis terisolasi, bukan data Pegawai produksi. Kamera, foto, upload, GPS, storage perangkat dan TLS mobile tidak berubah pada pekerjaan ini. Panduan risiko API tetap mengikuti aturan root dan [OWASP API Security](https://owasp.org/API-Security/editions/2023/en/0x11-t10/). Ini bukan klaim sertifikasi keamanan.

Form memakai AppModal, FontStyle, FormSettingSwitch, AsyncSelect, CompactInfoChip dan field jam bersama. Label persisten, divider antarbagian, dua kolom jam pada desktop dan satu kolom pada ponsel. Pemilih jam tidak menampilkan pintasan Sekarang. Status berada paling bawah. Header dan isi modal dapat digulir bersama, footer tetap dapat dicapai. Pedoman lintas fitur: [UI/UX dashboard SITOU](ui-ux-guidelines.md).

## Penyajian Kalender Libur dan Jadwal Pegawai

Kalender Libur memakai label Nama kalender, Tanggal dan Nama hari libur. Tambah tanggal libur menambahkan baris kosong. Hapus tanggal hanya melepas baris pada form, perubahan baru disimpan melalui Simpan kalender. Status Kalender aktif/nonaktif berada di bagian terakhir dengan FormSettingSwitch dan AppNotice. Pada desktop, tanggal, nama dan tombol hapus sejajar. Pada ponsel, kontrol disusun vertikal. Validasi tetap di dekat field dan isian dipertahankan bila gagal.

Tetapkan jadwal berada pada PageHeader. Pada tab detail Pegawai, aksi berada di header DataPanel karena tidak ada PageHeader kedua. Checkbox header memilih atau melepas pilihan pada halaman yang terlihat, bukan seluruh hasil pencarian. Pilihan dari halaman lain tetap tersimpan, maksimal 100 Pegawai. Status sebagian terpilih ditampilkan melalui checkbox indeterminate. Batalkan semua pilihan membersihkan seluruh pilihan tanpa menghapus data Pegawai atau jadwal. Pada ponsel, checkbox pilih halaman berada pada toolbar kartu. Pengguna baca saja tetap dapat memilih Pegawai untuk melihat kalender tanpa aksi penetapan.

Filter Jadwal hari ini menyediakan Semua Pegawai atau Belum memiliki jadwal hari ini. Pilihan kedua juga mencakup Pegawai yang baru memiliki jadwal mendatang. Atur ulang menghapus pencarian, filter jadwal dan pilihan Pegawai, sambil mempertahankan konteks organisasi. Identitas memakai EmployeeAvatar dan ImagePreviewModal existing, nama serta NIP tanpa awalan berulang, mengikuti Data Pegawai.

GET /api/work-schedules menambahkan organization_id dan profile_photo_file_id pada tiap Pegawai dalam scope existing. Keduanya berupa string ID, foto kosong berupa null. Tidak mengirim object_key atau data foto. Pembacaan foto melalui /api/uploads/:fileId?organizationId=... tetap memerlukan sesi, permission file existing, organisasi, scope Pegawai, status file tersedia dan audit/no-store. Grant baca Jadwal Pegawai mengizinkan kategori foto pada canUseHrisFile, tanpa membuka kategori dokumen lain atau mutation file. Tidak ada perubahan kontrak request, schema database, histori, penetapan atau akses mobile.

## Dialog penetapan, perubahan harian dan riwayat

Deskripsi tabel tidak memuat petunjuk Centang header. Pemilihan halaman melalui checkbox tetap tersedia.

Pada menu Jadwal Pegawai dan tab jadwal pada detail Pegawai, form Tetapkan jadwal hanya meminta Jadwal kerja, Mulai berlaku dan alasan penggantian bila diperlukan. Tanggal berakhir tidak ditampilkan. Penetapan baru mengirim until null melalui kontrak existing dan berlaku sampai diganti oleh penetapan berikutnya. Tanggal akhir pada histori lama tidak dihapus. WorkScheduleFields memakai allowEndDate=false pada workspace ini, sementara pemakai onboarding existing tetap mempertahankan field/draft lamanya agar tidak menghapus isian pengguna secara diam-diam.

Identitas Pegawai pada dialog memakai label Pegawai, EmployeeAvatar, nama dan NIP. Penetapan massal menyebut jumlah target, dengan seluruh nama tetap tersedia pada konfirmasi. Pilihan jadwal kosong atau gagal dimuat memakai AppNotice dan aksi Coba lagi bila gagal. Informasi berlaku sampai diganti memakai AppNotice. Lanjutkan membuka konfirmasi tanpa request simpan, lalu Tetapkan jadwal mengirim request dengan idempotency dan version check existing.

Ubah jadwal harian hanya berlaku pada satu tanggal. Pilih tanggal dan tekan Periksa jadwal untuk memuat aturan serta versi existing. Tanggal dan tombol sejajar pada desktop, bertumpuk di ponsel. Pilih Bekerja beserta Waktu kerja atau Libur, lalu isi alasan. Libur tidak menampilkan pemilih waktu kerja dan mengirim shiftIds kosong. Bekerja wajib memiliki waktu kerja. Field UI dayType tidak dikirim ke API strict existing. Ringkasan menggunakan hasil resolver, bukan flag isHoliday saja karena hari kalender libur masih dapat dijadwalkan bekerja sesuai kebijakan. Mengubah tanggal membatalkan hasil pemeriksaan lama. Simpan tidak tersedia sampai tanggal diperiksa. Kegagalan mempertahankan isian, alasan yang sedang ditulis tidak ditimpa saat pemeriksaan ulang.

Riwayat jadwal memakai ScheduleHistory dengan EmptyState bila belum ada penetapan. Kartu memakai CompactInfoChip, InfoField dan InfoFieldGrid: nama jadwal, status Belum berlaku/Sedang berlaku/Sudah berakhir/Dibatalkan, Mulai berlaku, Berlaku sampai, Ditetapkan oleh, Disimpan pada serta alasan penetapan/pembatalan. Waktu penyimpanan mengikuti zona organisasi. Pelaku/waktu yang tidak diberikan server ditampilkan Tidak tersedia, bukan ditebak dari akun saat ini. Batalkan penetapan hanya ditawarkan untuk jadwal mendatang sesuai kewenangan existing, keputusan akhir tetap diverifikasi backend.

Perubahan ini hanya antarmuka dashboard. Tidak mengubah schema, endpoint, permission, histori database, pencatatan absensi atau source mobile.

## Urutan penggunaan untuk HRD

1. Jika organisasi memiliki libur pada tanggal khusus, buka Pengaturan Organisasi → Kalender Libur. Buat kalender, tambahkan tanggal/nama hari libur dan simpan dalam status aktif. Langkah ini opsional. Libur rutin seperti Minggu diatur pada hari kerja, bukan diinput berulang ke kalender.
2. Buka Data Master → Jadwal Kerja, pilih Buat jadwal kerja, isi nama lalu pilih Jam kerja tetap atau Kerja shift. Jam tetap untuk hari mingguan dengan jam utama. Kerja shift menyediakan beberapa pilihan bernama bebas untuk dipilih per Pegawai.
3. Pilih hari kerja. Hari yang tidak dipilih adalah Libur. Buat jadwal terpisah bagi kelompok dengan hari libur rutin berbeda.
4. Atur jam masuk/pulang dan istirahat. Pada Kerja shift gunakan Tambah shift untuk setiap pilihan beserta nama/jamnya. Pulang hari berikutnya untuk jam yang melewati tengah malam. Pengurangan istirahat mengurangi durasi kerja, bukan memajukan jam pulang. Toleransi waktu serta Atur jam kerja per hari hanya diisi bila diperlukan.
5. Bila memakai kalender, pilih Libur mengikuti kalender atau Tetap bekerja sesuai jadwal. Aktifkan jadwal lalu Simpan jadwal, periksa Ringkasan jadwal dan konfirmasi simpan. Membuat jadwal belum menetapkannya ke Pegawai.
6. Buka Kepegawaian → Jadwal Pegawai. Pilih Pegawai (maksimal 100), tekan Tetapkan jadwal, pilih jadwal atau satu pilihan shift, isi Mulai berlaku, lanjutkan dan konfirmasi. Jadwal baru berlaku sampai diganti. HRD/Pimpinan yang memiliki profil Pegawai juga memerlukan penetapan eksplisit yang sama. Pegawai baru dapat memilih jadwal saat pendaftaran sesuai izin existing.
7. Pilih Pegawai untuk melihat kalender kerja/liburnya. Ubah jadwal harian untuk perubahan satu tanggal dengan alasan. Gunakan Tetapkan jadwal untuk mengganti aturan rutin mulai tanggal baru, dan Riwayat jadwal untuk menelusuri periode serta pelakunya.

Pada Ubah jadwal harian, tombol mata dengan tooltip Periksa jadwal pada tanggal yang dipilih memanggil preview baca existing agar aturan dan versi tanggal dimuat sebelum perubahan. Ini bukan penyimpanan. Pada lebar mulai 600px hanya ikon 44×44px. Di ponsel lebih kecil tampil ikon serta teks Periksa jadwal selebar area. Tooltip dapat muncul saat hover maupun fokus keyboard. Tombol tempat sampah pada Kalender Libur juga 44×44px dengan tooltip Hapus tanggal libur dan nama aksesibel per baris. Menghapus baris pada form tidak mengirim mutation sampai Simpan kalender.

Pada form hak akses HRD, tiga menu Absensi tetap terlihat saat fitur nonaktif. Checkbox dan tingkat akses terkunci dengan pesan merah yang meminta pengguna menghubungi Admin SITOU. Pilih semua hanya mengubah menu yang tersedia dan mempertahankan izin lama pada menu terkunci. Setelah fitur aktif, izin dapat diatur kembali.
