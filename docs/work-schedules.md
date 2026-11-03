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

Kalender Libur mendukung pemilihan dari Katalog Hari Libur resmi dan tanggal manual organisasi. Katalog platform dikelola Admin SITOU melalui Draft → Tinjau → Terbitkan; HRD menyalin pilihan secara eksplisit dan menyimpan kalender atomik. Cuti bersama terpisah dan tidak mengurangi saldo cuti. Kalender lama serta snapshot tidak diubah otomatis. Prosedur lengkap, sumber SKB 2026–2027, revisi, izin dan kontrak API ada di `docs/holiday-catalogs.md`.

Data Master → Jadwal Kerja menyediakan dua jenis jadwal. Isi Nama jadwal, lalu pilih **Jam kerja tetap** atau **Kerja shift** melalui dropdown Jenis jam kerja. Kedua field sejajar pada desktop dan bertumpuk selebar area pada ponsel. Pilihan jenis tidak diisi otomatis pada jadwal baru. URL menu dan hak akses existing tetap dipertahankan.

- **Jam kerja tetap**: pilih Hari kerja dan isi Jam kerja utama sekali. Misalnya Senin–Sabtu 09.00–17.00 dengan Minggu libur. Jam hari tertentu dapat dibedakan melalui panel Atur jam kerja per hari.
- **Kerja shift**: pilih Hari kerja, isi nama serta jam shift pertama, kemudian gunakan Tambah shift untuk pilihan berikutnya. Nama ditentukan HRD, misalnya Petugas awal, Petugas akhir atau Penjagaan khusus. Nama serta jam tidak dikunci sistem. Maksimal 16 pilihan per kelompok untuk membatasi payload dan pekerjaan dalam satu transaksi.

HRD menetapkan **satu pilihan shift** kepada setiap Pegawai. Membuat tiga pilihan shift tidak berarti Pegawai harus menjalani ketiganya. Pilihan penetapan menampilkan Nama jadwal — Nama shift. Tidak ada pergantian shift otomatis dari hari ke hari. Untuk memindahkan Pegawai ke shift lain, tetapkan pilihan dan tanggal berlakunya melalui Jadwal Pegawai.

Informasi Hari libur dan pilihan shift memakai AppNotice bersama. Hari yang tidak dipilih adalah Libur. Tidak ada pilihan Libur kedua atau tombol menambah jam kerja pada hari libur dalam form baru. Buat jadwal terpisah bagi kelompok dengan hari libur rutin berbeda. Jangan menentukan jadwal otomatis berdasarkan agama, role, divisi atau lokasi.

Daftar memakai dropdown **Jenis jam kerja** pada Filter data, menggantikan tab. Pilih Jam kerja tetap untuk jadwal mandiri existing atau Kerja shift untuk kelompok pilihan shift. Pencarian nama serta status mengikuti jenis yang dipilih. Perubahan jenis kembali ke halaman pertama. Atur ulang mengosongkan pencarian, memilih Semua status dan Jam kerja tetap, serta mempertahankan organisasi. Hanya endpoint jenis aktif yang dimuat, dengan pembatalan respons lama melalui hook bersama. Deskripsi filter ditampilkan di bawah judul.

## Mengisi jam dan aturan libur

1. Isi Jam masuk dan Jam pulang. Form tidak mengisi contoh nama, hari atau jam secara otomatis.
2. Aktifkan **Pulang hari berikutnya** bila melewati tengah malam. Contoh: masuk 22.00, pulang 06.00 besok. Urutan angka jam tidak mengaktifkan pilihan ini secara diam-diam.
3. Isi **Istirahat (menit)**, awalnya nol. Jika **Kurangi durasi kerja dengan istirahat** aktif, 09.00–17.00 dengan istirahat 60 menit dihitung 7 jam kerja. Jika nonaktif, tetap 8 jam. Ini aturan durasi jadwal, bukan pengakuan kehadiran atau perhitungan gaji.
4. Buka **Toleransi waktu** bila diperlukan. Toleransi terlambat memberi kelonggaran setelah jam masuk. Toleransi pulang awal memberi kelonggaran sebelum jam pulang. Nol berarti tanpa kelonggaran. Pencatatan absensi mobile belum menggunakannya pada tahap ini.
5. Pada Jam kerja tetap, buka **Atur jam kerja per hari** jika ada hari berbeda. Ubah jam pada hari yang diperlukan. Hari lain mengikuti jam utama. Membuka editor tidak langsung mengubah status hari. Chip Jam utama dan Jam khusus memakai komponen bersama serta teks selain warna.
6. Pada Kerja shift, tiap pilihan dapat dibuka dan dilipat. Header tetap memperlihatkan nama serta jamnya. Shift baru yang kosong langsung terbuka, sedangkan pilihan existing yang bernama awalnya dilipat. Menutup panel mempertahankan isian. Validasi membuka shift dan panel toleransi yang perlu diperbaiki. Setiap pilihan memuat satu rentang waktu beserta istirahat dan toleransinya. Hapus shift hanya tersedia ketika ada lebih dari satu pilihan. Tidak ada pilihan Jam fleksibel, Rotasi atau beberapa jam kerja untuk satu pilihan shift pada form baru.
7. **Kalender libur** opsional untuk libur nasional atau organisasi pada tanggal tertentu yang dimasukkan HRD melalui Kalender Libur. Jika dipilih, jadwal otomatis mengikuti tanggal libur kalender tersebut, tanpa pilihan tambahan. Tanpa kalender, libur mengikuti hari pada jadwal.
8. Switch **Jadwal aktif/nonaktif** berada paling bawah. Nonaktif menghilangkan pilihan dari penetapan baru, tanpa membatalkan jadwal Pegawai yang sudah berlaku.
9. **Simpan jadwal** membuka Ringkasan jadwal tanpa request tulis. Periksa seluruh pilihan, hari, jam, istirahat, toleransi, kalender dan status. Kembali ke form mempertahankan isian. Konfirmasi Simpan jadwal pada ringkasan baru mengirim satu request atomik. Kegagalan mempertahankan isian agar dapat dicoba lagi.

Rentang shift dalam satu kelompok tidak boleh bertumpuk, termasuk bagian shift malam yang masuk hari berikutnya. Contoh valid: 06.00–14.00, 14.00–22.00 dan 22.00–06.00 besok. Batas yang bersentuhan diperbolehkan. Contoh ditolak: 06.00–14.00 dan 13.00–21.00. Nama shift harus berbeda tanpa membedakan huruf besar dan spasi tepi. Gabungan Nama jadwal — Nama shift maksimal 100 karakter, mengikuti kapasitas identitas pola dan shift existing. Validasi dilakukan kembali di server.

## Penetapan dan pemantauan Pegawai

Tetapkan jadwal memakai ringkasan avatar dan daftar Collapse inline Pegawai bersama seperti Ubah jadwal harian. Daftar hanya dapat dibuka bila >1, memakai scroll lokal berbatas tinggi tanpa header tabel/pagination serta foto yang dapat dipreview melalui ImagePreviewModal privat; hanya satu modal aktif dan kembali mempertahankan isian. Rincian dilipat per hari melalui AppCollapse, dengan nama/status tetap terlihat. Mulai berlaku hanya sejak hari ini organisasi atau tanggal bergabung paling akhir (mana yang lebih akhir); server tetap memvalidasi. Tombol Tetapkan jadwal langsung menyimpan setelah validasi field, tanpa Lanjutkan/modal konfirmasi tambahan. Konflik mempertahankan isian; sukses menutup modal dan memakai snackbar bersama. Tinjauan perubahan harian massal tetap berlaku.

### Ubah jadwal harian massal

Jumlah seluruh pilihan tidak ditampilkan sebagai teks di toolbar tabel. Bila ada pilihan tanpa jadwal, AppNotice warning terpisah di atas DataPanel menampilkan jumlah Pegawai yang belum memiliki jadwal tanpa daftar nama, serta arahan Tetapkan jadwal terlebih dahulu agar jadwal harian bisa diubah, atau hapus centang pada Pegawai tersebut. Tombol perubahan harian tetap dinonaktifkan sampai seluruh pilihan memenuhi syarat.

Perubahan harian memerlukan penetapan rutin terlebih dahulu. Tanpa penetapan aktif/mendatang, tombol Ubah jadwal harian dinonaktifkan; pilihan campuran tetap diblokir seluruhnya dengan jumlah Pegawai tanpa daftar nama dan arahan menetapkan jadwal terlebih dahulu atau menghapus centang. Tidak ada target yang dilewati otomatis. Penetapan mendatang tetap boleh dipilih, tetapi seluruh tanggal rentang wajib tercakup penetapan yang tidak dibatalkan. Hari libur mingguan/kalender tetap tercakup penetapan dan dapat diubah. Exception lama tanpa penetapan rutin bukan pengganti penetapan. Preview, simpan massal dan endpoint single-date memeriksa ulang dengan kode 409 BASE_SCHEDULE_REQUIRED, nama dan tanggal pertama yang belum tercakup; tidak ada perubahan parsial. Tetapkan jadwal dahulu atau sesuaikan pilihan/periode.

Pilih maksimal 100 Pegawai, lalu gunakan **Ubah jadwal harian** pada toolbar Daftar jadwal Pegawai, sejajar dengan Tetapkan jadwal pada desktop dan masing-masing satu baris pada mobile. Aksi harian tidak lagi berada di menu aksi per baris. Tombol Batalkan semua pilihan dihapus; pilihan dapat dilepas lewat checkbox atau Atur ulang. Pilihan bertahan saat pagination; mengganti pencarian/filter mengosongkan pilihan agar cakupan tidak tertukar.

Modal menampilkan avatar beberapa Pegawai, sisa jumlah dan total pilihan. Hanya bila lebih dari satu Pegawai, ringkasan dapat ditekan untuk membuka daftar bergulir berbatas tinggi dalam Collapse inline; form tetap terlihat dan terpelihara. Satu Pegawai menampilkan identitas statis. Tentukan rentang hari ini/mendatang maksimal 31 hari, tindakan Ganti/Tambah jam kerja, satu jadwal kerja (dan pilihan shift jika diperlukan), serta alasan minimal 5 karakter. **Tinjau perubahan** memeriksa seluruh target dan periode; **Simpan perubahan** baru menulis atomik. Pengaturan berlaku pada setiap tanggal dalam rentang, termasuk hari libur, tanpa mengubah pola rutin atau Pegawai lain. Pada Ganti, seluruh jam existing diganti setelah jumlah perubahan terdahulu ditampilkan. Pada Tambah, jam existing beserta tambahan terdahulu dipertahankan.

Filter Lokasi, Divisi & Unit, Jabatan memakai penempatan utama yang berlaku pada tanggal organisasi; Jenis Kepegawaian memakai kontrak aktif dan menyediakan Tanpa kontrak aktif. Nilai opsi tetap terikat organisasi dan cakupan lokasi. Endpoint opsi Jadwal Pegawai menyediakan referensi minimum, sehingga hak Data Pegawai tidak diwajibkan untuk memakai filter ini.

API baru (session, origin, rate limit, scope organisasi/lokasi dan izin Kelola Jadwal Pegawai wajib):

- POST `/api/work-schedules/exceptions/bulk/preview`: `organizationId`, `employeeIds` (1–100 ID unik), `from`, `until` (inklusif, maksimal 31 hari), `mode` (`replace`/`add`), `patternId` (satu jadwal atau pola salah satu shift). Mengembalikan `previewHash`, `employeeCount`, `dayCount`, `changeCount`, `existingCount`, `timezone` dan `changes` (Pegawai/NIP/tanggal, sesi Sebelum/Sesudah). Kontrak lama `shiftIds` (1–16 unik) tetap untuk replace, tidak boleh digabung dengan patternId. Pratinjau tidak menyimpan perubahan.
- POST `/api/work-schedules/exceptions/bulk`: payload pratinjau + `reason` (5–1000 karakter), `previewHash`, `requestKey` UUID. Semua Pegawai dikunci menurut ID yang terurut, sumber/versi diperiksa ulang, lalu seluruh exception dan sesi disimpan dalam satu transaksi bersama audit dan receipt `exception.bulk`. Hasil memuat jumlah Pegawai/hari/perubahan dan periode, tanpa data pribadi tambahan.
- Hash mencakup keadaan jadwal, versi penetapan, Pegawai dan definisi jam kerja. Konflik menghasilkan 409 `VERSION_CONFLICT`; kembali dan tinjau ulang. Retry payload sama memakai key yang sama dan tidak menggandakan audit/record. Payload berbeda pada key tersimpan ditolak. Gangguan koneksi mempertahankan tinjauan untuk retry key yang sama.
- Pegawai tidak aktif, tanggal sebelum bergabung/lampau, sumber shift tidak sah, benturan lintas hari, serta tanggal yang sudah digunakan absensi/rekap menggagalkan seluruh batch. Pesan konflik menyebut Pegawai/tanggal berizin yang relevan. Rekap tanpa snapshot jadwal juga dilindungi. Tidak menulis ulang snapshot, master, kontrak atau ledger cuti. Batas maksimum 3.100 perubahan per request.
- GET `/api/work-schedules` menambah `locationId`, `organizationUnitId`, `positionId`, `employmentTypeId` (ID atau `without_active_contract`). ID tidak sah ditolak; filter tidak melonggarkan scope. Endpoint single-date `/api/work-schedules/exceptions` juga mewajibkan jam kerja; tidak lagi menerima daftar kosong atau shift libur. Data libur historis tetap terbaca.

Tidak ada perubahan schema atau migration pada fitur ini; tabel exception, sesi, audit dan receipt existing digunakan kembali.

Kepegawaian → Jadwal Pegawai: pilih maksimal 100 Pegawai, pilih Tetapkan jadwal, jadwal tetap atau salah satu shift, tanggal berlaku dan alasan penggantian. Jadwal mulai hari ini atau mendatang, tidak sebelum tanggal bergabung. Pendahulu ditutup sehari sebelumnya. Penetapan mendatang tidak ditimpa. Pembatalan hanya untuk penetapan mendatang yang belum digunakan, dengan alasan dan konfirmasi. Pembatalan tidak mengaktifkan kembali pendahulu otomatis.

Filter Status jadwal memeriksa penetapan aktif/mendatang, sedangkan parameter API lama without tetap memeriksa jadwal hari ini menurut zona waktu organisasi. Section Lihat jadwal (kalender harian/mingguan) telah dihapus dari workspace Jadwal Pegawai, termasuk pada detail Pegawai. Halaman berfokus pada penetapan, status jadwal, histori, pembatalan dan perubahan tanggal; belum ada menu laporan jadwal pengganti. Pilihan massal hanya tampil untuk akses Kelola. API kalender/resolver tetap tersedia untuk kompatibilitas dan workflow existing, tanpa pengambilan kalender otomatis dari halaman ini. Ubah jadwal pada tanggal pilihan mengganti atau menambahkan jam kerja dengan alasan wajib, tanpa opsi Libur dan tanpa mengubah jadwal rutin.

Pendaftaran tetap memakai Jadwal kerja pada langkah 4 Penempatan. Pilih Atur jadwal nanti atau pilih jadwal tetap/salah satu shift. Tanggal mulai mengikuti tanggal yang lebih akhir antara hari ini organisasi dan tanggal bergabung. Draft dipulihkan tanpa ditimpa. Hak Kelola Jadwal Pegawai tetap terpisah dari Data Pegawai. Profil dan penetapan disimpan dalam satu transaksi. Payload lama tanpa jadwal dan import tetap kompatibel.

## Data lama dan perubahan jadwal

Jadwal lama tetap dapat dibaca melalui daftar jadwal mandiri. Rotasi, jam fleksibel dan beberapa jam kerja lama tidak dikonversi diam-diam. Form menampilkan pengaturannya sebagai ringkasan yang tidak dapat diubah, dengan nama/status tetap dapat diedit. Untuk memakai jenis baru, buat jadwal baru dan tetapkan mulai tanggal yang dipilih. Tanggal hari pertama putaran tetap tersedia ketika memilih pola rotasi lama pada penetapan, demi kompatibilitas.

Jadwal terpakai tetap dapat diedit hari, jam dan kalender melalui revisi bertanggal (lihat Revisi pengaturan jadwal). Penetapan dibatalkan sekalipun tetap dianggap histori. Pada kelompok shift yang belum digunakan, perubahan struktur mengarsipkan pilihan lama dan membuat pilihan baru dalam transaksi yang sama. ID lama tidak dipakai kembali. Penetapan bersamaan dengan pilihan lama ditolak bila perubahan lebih dulu selesai, atau perubahan memerlukan tanggal berlaku bila penetapan lebih dulu selesai. Nama/status saja mempertahankan ID pilihan. Kalender lama yang sudah nonaktif tetap dipertahankan saat metadata disimpan tanpa perubahan aturan. Pengaitan baru memerlukan kalender aktif.

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

Form memakai AppModal, FontStyle, FormSettingSwitch, AsyncSelect, CompactInfoChip dan field jam bersama. Label persisten, divider antarbagian, dua kolom jam pada desktop dan satu kolom pada ponsel. Pemilih jam tidak menampilkan pintasan Sekarang. Status berada paling bawah. Header dan footer tetap terlihat, hanya body bergulir melalui AppModal bersama. Pedoman lintas fitur: [UI/UX dashboard SITOU](ui-ux-guidelines.md).

## Penyajian Kalender Libur dan Jadwal Pegawai

Kalender Libur memakai label Nama kalender, Tanggal dan Nama hari libur. Tambah tanggal libur menambahkan baris kosong. Hapus tanggal hanya melepas baris pada form, perubahan baru disimpan melalui Simpan kalender. Status Kalender aktif/nonaktif berada di bagian terakhir dengan FormSettingSwitch dan AppNotice. Tanggal dan nama dikelompokkan per hari, dua kolom di desktop dan satu kolom di ponsel; tombol hapus ikon berada pada header baris. Validasi tetap di dekat field dan isian dipertahankan bila gagal.

Tetapkan jadwal berada pada PageHeader. Pada tab detail Pegawai, aksi berada di header DataPanel karena tidak ada PageHeader kedua. Checkbox header memilih atau melepas pilihan pada halaman yang terlihat, bukan seluruh hasil pencarian. Pilihan dari halaman lain tetap tersimpan, maksimal 100 Pegawai. Status sebagian terpilih ditampilkan melalui checkbox indeterminate. Batalkan semua pilihan membersihkan seluruh pilihan tanpa menghapus data Pegawai atau jadwal. Pada ponsel, checkbox pilih halaman berada pada toolbar kartu. Pengguna baca saja tetap dapat memilih Pegawai untuk melihat kalender tanpa aksi penetapan.

Filter Status jadwal menyediakan Semua Pegawai, Sudah memiliki jadwal dan Belum memiliki jadwal. Penetapan aktif/mendatang dihitung sebagai sudah memiliki jadwal; berakhir/dibatalkan tidak dihitung. Atur ulang menghapus pencarian, filter jadwal dan pilihan Pegawai, sambil mempertahankan konteks organisasi. Identitas memakai EmployeeAvatar dan ImagePreviewModal existing, nama serta NIP tanpa awalan berulang, mengikuti Data Pegawai.

GET /api/work-schedules menambahkan organization_id dan profile_photo_file_id pada tiap Pegawai dalam scope existing. Keduanya berupa string ID, foto kosong berupa null. Tidak mengirim object_key atau data foto. Pembacaan foto melalui /api/uploads/:fileId?organizationId=... tetap memerlukan sesi, permission file existing, organisasi, scope Pegawai, status file tersedia dan audit/no-store. Grant baca Jadwal Pegawai mengizinkan kategori foto pada canUseHrisFile, tanpa membuka kategori dokumen lain atau mutation file. Tidak ada perubahan kontrak request, schema database, histori, penetapan atau akses mobile.

## Dialog penetapan, perubahan harian dan riwayat

Deskripsi tabel tidak memuat petunjuk Centang header. Pemilihan halaman melalui checkbox tetap tersedia.

Pada menu Jadwal Pegawai dan tab jadwal pada detail Pegawai, form Tetapkan jadwal hanya meminta Jadwal kerja, Mulai berlaku dan alasan penggantian bila diperlukan. Tanggal berakhir tidak ditampilkan. Penetapan baru mengirim until null melalui kontrak existing dan berlaku sampai diganti oleh penetapan berikutnya. Tanggal akhir pada histori lama tidak dihapus. WorkScheduleFields memakai allowEndDate=false pada workspace ini, sementara pemakai onboarding existing tetap mempertahankan field/draft lamanya agar tidak menghapus isian pengguna secara diam-diam.

Identitas Pegawai pada dialog memakai label Pegawai, EmployeeAvatar, nama dan NIP. Penetapan massal menyebut jumlah target, dengan seluruh nama tetap tersedia pada konfirmasi. Pilihan jadwal kosong atau gagal dimuat memakai AppNotice dan aksi Coba lagi bila gagal. Informasi berlaku sampai diganti memakai AppNotice. Tetapkan jadwal langsung mengirim request setelah validasi dengan idempotency dan version check existing, tanpa konfirmasi tambahan.

Ubah jadwal harian kini memakai form massal dengan rentang maksimal 31 hari seperti kontrak di atas. Tidak ada pilihan Jenis hari, Hari kerja atau Hari libur. Pilih Ganti/Tambah jam kerja, satu jadwal beserta satu pilihan shift bila diperlukan, lalu isi alasan. Tinjau perubahan sebelum menyimpan; kegagalan mempertahankan isian. Endpoint single-date tetap tersedia dengan aturan jam kerja wajib yang sama. Hari libur diatur melalui jadwal rutin atau Kalender Libur; cuti/izin/sakit melalui Cuti & Izin.

Riwayat jadwal memakai ScheduleHistory dengan EmptyState bila belum ada penetapan. Kartu memakai CompactInfoChip, InfoField dan InfoFieldGrid: nama jadwal, status Belum berlaku/Sedang berlaku/Sudah berakhir/Dibatalkan, Mulai berlaku, Berlaku sampai, Ditetapkan oleh, Disimpan pada serta alasan penetapan/pembatalan. Waktu penyimpanan mengikuti zona organisasi. Pelaku/waktu yang tidak diberikan server ditampilkan Tidak tersedia, bukan ditebak dari akun saat ini. Batalkan penetapan hanya ditawarkan untuk jadwal mendatang sesuai kewenangan existing, keputusan akhir tetap diverifikasi backend.

Perubahan ini hanya antarmuka dashboard. Tidak mengubah schema, endpoint, permission, histori database, pencatatan absensi atau source mobile.

## Urutan penggunaan untuk HRD

1. Jika organisasi memiliki libur pada tanggal khusus, buka Pengaturan Organisasi → Kalender Libur. Buat kalender, tambahkan tanggal/nama hari libur dan simpan dalam status aktif. Langkah ini opsional. Libur rutin seperti Minggu diatur pada hari kerja, bukan diinput berulang ke kalender.
2. Buka Data Master → Jadwal Kerja, pilih Buat jadwal kerja, isi nama lalu pilih Jam kerja tetap atau Kerja shift. Jam tetap untuk hari mingguan dengan jam utama. Kerja shift menyediakan beberapa pilihan bernama bebas untuk dipilih per Pegawai.
3. Pilih hari kerja. Hari yang tidak dipilih adalah Libur. Buat jadwal terpisah bagi kelompok dengan hari libur rutin berbeda.
4. Atur jam masuk/pulang dan istirahat. Pada Kerja shift gunakan Tambah shift untuk setiap pilihan beserta nama/jamnya. Pulang hari berikutnya untuk jam yang melewati tengah malam. Pengurangan istirahat mengurangi durasi kerja, bukan memajukan jam pulang. Toleransi waktu serta Atur jam kerja per hari hanya diisi bila diperlukan.
5. Bila memakai kalender, jadwal otomatis mengikuti tanggal liburnya. Aktifkan jadwal lalu Simpan jadwal, periksa Ringkasan jadwal dan konfirmasi simpan. Membuat jadwal belum menetapkannya ke Pegawai.
6. Buka Kepegawaian → Jadwal Pegawai. Pilih Pegawai (maksimal 100), tekan Tetapkan jadwal, pilih jadwal atau satu pilihan shift, isi Mulai berlaku, lalu tekan Tetapkan jadwal. Jadwal baru berlaku sampai diganti. HRD/Pimpinan yang memiliki profil Pegawai juga memerlukan penetapan eksplisit yang sama. Pegawai baru dapat memilih jadwal saat pendaftaran sesuai izin existing.
7. Pilih Pegawai dan gunakan Ubah jadwal harian untuk mengganti atau menambahkan jam pada rentang maksimal 31 hari dengan alasan. Gunakan Tetapkan jadwal untuk mengganti aturan rutin mulai tanggal baru, dan Riwayat jadwal untuk menelusuri periode serta pelakunya.

Pada Ubah jadwal harian, tombol mata dengan tooltip Periksa jadwal pada tanggal yang dipilih memanggil preview baca existing agar aturan dan versi tanggal dimuat sebelum perubahan. Ini bukan penyimpanan. Pada lebar mulai 600px hanya ikon 44×44px. Di ponsel lebih kecil tampil ikon serta teks Periksa jadwal selebar area. Tooltip dapat muncul saat hover maupun fokus keyboard. Tombol tempat sampah pada Kalender Libur juga 44×44px dengan tooltip Hapus tanggal libur dan nama aksesibel per baris. Menghapus baris pada form tidak mengirim mutation sampai Simpan kalender.

Pada form hak akses HRD, tiga menu Absensi tetap terlihat saat fitur nonaktif. Checkbox dan tingkat akses terkunci dengan pesan merah yang meminta pengguna menghubungi Admin SITOU. Pilih semua hanya mengubah menu yang tersedia dan mempertahankan izin lama pada menu terkunci. Setelah fitur aktif, izin dapat diatur kembali.

PDF referensi katalog libur tersedia melalui alur unggah Admin SITOU pada docs/holiday-pdf-import.md. Impor/publikasi tidak mengubah kalender organisasi atau snapshot jadwal; HRD tetap meninjau dan menyimpan pilihan kalender secara eksplisit.

## Menghapus kalender libur

Aksi Hapus permanen khusus Admin SITOU dan hanya kalender yang belum pernah direferensikan oleh jadwal. Nonaktif atau referensi yang kemudian dilepas tidak menghapus bukti penggunaan. Penolakan menyebut nama/jumlah referensi. Kalender percobaan yang hanya memuat tanggal katalog boleh dihapus, tetapi katalog sumber tetap tercatat pernah digunakan. Lihat docs/holiday-catalogs.md untuk API, error, receipt dan pembersihan PDF.

Form Kalender Libur memakai FormSection untuk identitas, sumber katalog, libur organisasi dan penggunaan. Kelompok kosong memakai EmptyState.compact; impor/tambah/hapus memakai IconActionButton berlabel dan tooltip. Sumber resmi memakai InfoFieldGrid readonly. Hasil simpan/hapus memakai snackbar bersama setelah modal ditutup; konfirmasi hapus berisi penjelasan langsung. Proses perancangan frontend wajib mengikuti AGENTS.md dan docs/ui-ux-guidelines.md.

## Ganti dan tambah jam kerja pada tanggal pilihan

Form: Pegawai → Tanggal perubahan → dropdown Jenis perubahan (Ganti default/Tambah) → Jadwal kerja → Pilihan shift bila >1 → rincian jam → Alasan → Tinjau perubahan → Simpan perubahan. Gunakan AppModal yang sama, tanpa modal tambahan. Jadwal utama pada tanggal lain tetap berlaku. Shift kelompok berlaku pada setiap tanggal pilihan; jam tetap mingguan mengikuti hari masing-masing. Kalender pada sumber pilihan tidak disalin ke penetapan utama. Jika sumber mingguan tidak memiliki jam pada salah satu tanggal, server menolak seluruh request dengan tanggal dan arahan memilih sumber/tanggal lain. Tidak menebak satu jam utama dari beberapa sesi. Pola rotasi mandiri tidak ditawarkan karena form ini tidak meminta tanggal acuan rotasi.

GET options menambah adjustmentSchedules: ID presentasi pattern:/group:, nama, kind, choices dengan patternId, nama/rules/label jam atau days. ID kelompok bukan patternId. Sumber hanya aktif pada organisasi yang sah; anggota arsip dan kelompok nonaktif ditolak ulang server. Query pencarian menyertakan nama kelompok/shift. Definisi internal bernama sesi tidak muncul sebagai pilihan bebas. Aturan efektif ditentukan server pada setiap tanggal; jam yang ditampilkan sebelum tinjauan adalah ringkasan versi hari ini, tinjauan menampilkan versi tanggal target.

Tambah mengambil jam hasil resolver saat ini (termasuk exception terdahulu), menambahkan jam pilihan dan mengurutkannya. Ganti mengganti seluruh jam hari tersebut. Hasil maksimal 16 periode, tidak duplikat atau tumpang tindih; batas bersentuhan diperbolehkan. Benturan antarhari serta snapshot tetangga juga diperiksa. Satu pilihan dalam proses dapat berisi beberapa periode existing pada jadwal mingguan lama, bukan berarti semua alternatif shift dijalankan. Setiap periode hasil disimpan sebagai daftar lengkap exception/sesi per Pegawai/tanggal, bukan referensi dinamis untuk menambahkan ulang saat GET. Mode/pattern dan alasan dicatat dalam audit existing. Tidak diperlukan schema/migration baru; histori dan kontrak lama tetap terbaca.

PreviewHash mengikat mode, sumber dan seluruh hasil sumber/resolver sebelum simpan; simpan memeriksa ulang dalam lock organisasi/Pegawai. Receipt sama mengembalikan hasil tanpa menambahkan ulang. Perubahan sumber/versi mengharuskan tinjauan ulang. Jam tambahan tidak mengesahkan lembur, tidak mengubah saldo cuti dan tidak menulis event absensi. Batas minimum jeda/maksimum durasi organisasi belum memiliki konfigurasi khusus pada fondasi saat ini; jangan mengklaim pemeriksaan benturan sebagai validasi seluruh kebijakan durasi/lembur.

### Filter Status jadwal

Dropdown Status jadwal menggantikan Jadwal hari ini: Semua Pegawai (default), Sudah memiliki jadwal, Belum memiliki jadwal. GET /api/work-schedules memakai scheduleStatus=all|assigned|unassigned. Sudah memiliki jadwal berarti memiliki penetapan tidak dibatalkan yang masih berlaku atau akan berlaku, selaras dengan syarat awal tombol Ubah jadwal harian. Penetapan yang sudah berakhir/dibatalkan serta exception tanpa penetapan tidak dihitung. Hari libur dalam pola bukan berarti belum memiliki jadwal. Server tetap memeriksa setiap tanggal pada preview/simpan. Filter dan pagination dijalankan di server setelah scope organisasi/lokasi; perubahan filter mengosongkan pilihan dan kembali ke halaman pertama. Kontrak without=true/false lama tetap memeriksa jadwal hari ini; tidak dapat digabung dengan scheduleStatus. Pemberitahuan pilihan tidak memuat nama, hanya jumlah dan arahan singkat. Tidak ada migration baru.

### Tampilan jadwal pada daftar Pegawai

Kolom Jadwal saat ini dan kartu mobile memakai EmployeeScheduleSummary. Jadwal aktif menampilkan nama langsung tanpa awalan Jadwal berlaku. Jika belum aktif tetapi ada penetapan mendatang, tampilkan nama jadwal terdekat, chip Belum mulai dan tanggal Mulai dalam format D MMM YYYY. Jika tidak ada penetapan aktif/mendatang yang tidak dibatalkan, tampilkan Belum diatur. Nama panjang membungkus; informasi tidak bergantung pada warna saja. Tampilan menggunakan assignments dan today organisasi existing, tanpa perubahan resolver/API/histori.

### Pilihan yang sudah digunakan pada Tambah jam kerja

POST /api/work-schedules/exceptions/bulk/usage menerima organizationId, employeeIds (1–100 unik), from/until inklusif maksimal 31 hari. Endpoint read-only berizin Kelola Jadwal Pegawai, session/origin/rate limit, scope organisasi/lokasi dan fitur aktif yang sama. Periksa status Pegawai/tanggal bergabung/penetapan seluruh tanggal, lalu baca hasil resolver termasuk exception/snapshot. Respons memuat patternIds penetapan yang melintasi rentang dan days berisi date/shiftIds gabungan target, timezone, periods waktu absolut gabungan target beserta batas hari sebelumnya/berikutnya, serta revisions (id/shiftId/from/until/rules) yang berlaku pada rentang. Tidak mengirim nama/alasan Pegawai atau mengubah jadwal. Snapshot batas hari tetap disertakan agar sesuai pemeriksaan server.

Tambah mengunci pattern yang sudah ditetapkan pada rentang dengan label Sudah digunakan. Jadwal lain diperiksa berdasarkan waktu absolut, bukan ID jam internal; rentang yang tumpang tindih diberi label Jam kerja bertabrakan. Salinan dengan shift_id sama tetap pola berbeda. Satu target/tanggal memakai pilihan tersebut cukup untuk mengunci aksi massal, tanpa melewati target diam-diam. Shift kelompok diperiksa per pilihan; penambahan sebelumnya ikut dihitung meskipun pola sumbernya bukan penetapan utama. Pemakaian di luar rentang tidak mengunci. Metadata pilihan menambah shiftId pada choices kelompok; pilihan mingguan memakai days.sessions.shiftId existing. Ganti mengunci pola yang sedang ditetapkan pada salah satu target/tanggal dengan alasan Sudah digunakan, tetapi tidak mengunci pola lain hanya karena jamnya bertabrakan dengan jam yang akan diganti. Jadwal dengan ID berbeda maupun sama tetapi waktu bertabrakan dikunci sebagai konflik waktu; preview/simpan tetap mengulang pemeriksaan. Kesamaan ID shift pada pola lain menghasilkan SESSION_OVERLAP, bukan SCHEDULE_ALREADY_USED_FOR_ADDITION.

UI menunggu pemeriksaan, mengunci sumber/Tinjau jika gagal dan menyediakan Coba lagi; pergantian target/rentang membatalkan respons lama. Saat Jenis perubahan diganti, kosongkan scheduleId dan patternId beserta error field terkait; tanggal dan alasan tetap tersimpan. Saat rentang berubah saja, pilihan yang menjadi terpakai tetap terlihat dengan arahan memilih sumber lain. Preview dan simpan memeriksa ulang dari database (SCHEDULE_ALREADY_USED_FOR_ADDITION atau SCHEDULE_ALREADY_USED_FOR_REPLACEMENT, 422), bukan mempercayai metadata klien. Retry receipt tersimpan tetap mengembalikan hasil lama tanpa menambah dua kali. Tidak ada migration atau perubahan kategori master. Pemisahan Kegunaan utama/tambahan dari Jenis tetap/shift masih rekomendasi desain, bukan perilaku yang sudah aktif.

Klasifikasi waktu memakai revisi efektif tiap tanggal, bukan rules tampilan versi hari ini. Batas yang bersentuhan diperbolehkan; shift malam diperiksa terhadap tanggal sebelumnya dan sesudahnya. Kelompok yang semua pilihannya terkunci dengan sebab berbeda diberi alasan kelompok, tidak mengklaim seluruh kelompok sudah digunakan. Data lama days/shiftIds tetap dikembalikan demi kompatibilitas; tidak ada migration atau perubahan referensi master.


## Revisi pengaturan jadwal (073)

POST templates/patterns/groups menerima effectiveFrom (date-only) dan reason (5–1000 karakter). Perubahan struktur jadwal terpakai wajib berlaku paling cepat besok di zona organisasi dan setelah revisi terakhir. Nama/status saja tidak menambah revisi. UI tetap meminta tanggal/alasan pada edit jadwal terpakai agar dampaknya jelas. Pengubahan jenis tetap ke shift menggunakan jadwal baru; tidak mengonversi identitas penetapan.

work_schedule_definition_revisions menyimpan baseline sistem efektif -infinity saat revisi pertama dan definisi baru append-only (hari, referensi jam, kalender, kebijakan). Baseline tidak mengarang actor manusia. Header/pattern_days menyajikan pengaturan terbaru; resolver patternAt memilih versi berdasarkan tanggal setiap hari. Event, snapshot, ringkasan absensi, ledger cuti dan shift_assignments tidak diubah. Revisi referensi kalender ikut mencatat penggunaan permanen. Daftar master mengembalikan latestEffectiveFrom, opsi penetapan memuat versions untuk ringkasan sesuai tanggal mulai.

Kelompok shift mempertahankan patternId pilihan existing; perubahan jam memakai referensi shift baru, sehingga exception lama tetap utuh. Penghapusan pilihan terpakai ditolak, penambahan pilihan tetap diperbolehkan. Payload edit shifts menyertakan patternId untuk identitas tiap pilihan. Kalender baru wajib aktif dan satu organisasi. Perubahan khusus tetap mengalahkan jadwal rutin.

Semua simpan memakai lock organisasi, version check, receipt dan audit existing. Validasi menolak tanggal terpakai rekap/absensi pada periode baru, benturan sesi pada batas perubahan, penetapan berikutnya dan exception mendatang. Kegagalan membatalkan seluruh transaksi termasuk sesi baru/revisi. Tidak ada penulisan ulang absensi saat GET atau simpan master.

Development: jalankan npm run db:migrate -- database/migrations/20261103_073_work_schedule_definition_revisions.sql pada database existing, bukan bootstrap ulang. Bootstrap kosong dan pemeriksaan schema mencakup tabel baru. Backup database otomatis menyertakan versi definisi. VPS mengikuti prosedur deployment terpisah.
