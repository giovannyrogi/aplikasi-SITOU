# Jadwal kerja, hari libur dan absensi

Bagian terkait

- [Aturan domain absensi](#aturan-domain-absensi)
- [Katalog hari libur dan kalender organisasi](#katalog-hari-libur-dan-kalender-organisasi)
- [Titik Absensi dan akses tambahan](#titik-absensi-dan-akses-tambahan)
- [Rekap Absensi](#rekap-absensi-1)

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

Alur kamera, lokasi dan pencatatan absensi mobile mengikuti [kontrak absensi mobile](mobile-api.md#absensi-mobile-sitou). Endpoint absensi mendatang wajib memeriksa aktivasi attendance pada organisasi sesi serta permission self-service/objek dan kebijakan tulis yang berlaku. Gunakan gerbang bersama requireAttendanceModule dan urutan lock organisasi pada mutation, tanpa mempercayai flag perangkat. Login, cookie, mobile bearer, Homepage dan Cuti/izin tidak berubah. Mematikan fitur tidak menghapus data absensi yang kelak tersimpan.

## Alur yang tersedia

Kalender Libur mendukung pemilihan dari Katalog Hari Libur resmi dan tanggal manual organisasi. Katalog platform dikelola Admin SITOU melalui Draft → Tinjau → Terbitkan; HRD menyalin pilihan secara eksplisit dan menyimpan kalender atomik. Cuti bersama terpisah dan tidak mengurangi saldo cuti. Kalender lama serta snapshot tidak diubah otomatis. Prosedur lengkap, sumber SKB 2026–2027, revisi, izin dan kontrak API ada di `docs/work-schedules.md`.

Data Master → Jadwal Kerja menyediakan dua jenis jadwal. Isi Nama jadwal, lalu pilih **Jam kerja tetap** atau **Kerja shift** melalui dropdown Jenis jam kerja. Kedua field sejajar pada desktop dan bertumpuk selebar area pada ponsel. Pilihan jenis tidak diisi otomatis pada jadwal baru. URL menu dan hak akses existing tetap dipertahankan.

- **Jam kerja tetap**: pilih Hari kerja dan isi Jam kerja utama sekali. Misalnya Senin–Sabtu 09.00–17.00 dengan Minggu libur. Jam hari tertentu dapat dibedakan melalui panel Atur jam kerja per hari.
- **Kerja shift**: pilih Hari kerja, isi nama serta jam shift pertama, kemudian gunakan Tambah shift untuk pilihan berikutnya. Nama ditentukan HRD, misalnya Petugas awal, Petugas akhir atau Penjagaan khusus. Nama serta jam tidak dikunci sistem. Maksimal 16 pilihan per kelompok untuk membatasi payload dan pekerjaan dalam satu transaksi.

HRD menetapkan **satu pilihan shift** kepada setiap Pegawai. Membuat tiga pilihan shift tidak berarti Pegawai harus menjalani ketiganya. Pilihan penetapan menampilkan Nama jadwal — Nama shift. Tidak ada pergantian shift otomatis dari hari ke hari. Untuk memindahkan Pegawai ke shift lain, tetapkan pilihan dan tanggal berlakunya melalui Jadwal Pegawai.

Informasi Hari libur dan pilihan shift memakai AppNotice bersama. Hari yang tidak dipilih adalah Libur. Tidak ada pilihan Libur kedua atau tombol menambah jam kerja pada hari libur dalam form baru. Buat jadwal terpisah bagi kelompok dengan hari libur rutin berbeda. Jangan menentukan jadwal otomatis berdasarkan agama, role, divisi atau lokasi.

Daftar memakai dropdown **Jenis jam kerja** pada Filter data, menggantikan tab. Pilih Jam kerja tetap untuk jadwal mandiri existing atau Kerja shift untuk kelompok pilihan shift. Pencarian nama serta status mengikuti jenis yang dipilih. Perubahan jenis kembali ke halaman pertama. Atur ulang mengosongkan pencarian, memilih Semua status dan Jam kerja tetap, serta mempertahankan organisasi. Hanya endpoint jenis aktif yang dimuat, dengan pembatalan respons lama melalui hook bersama. Deskripsi filter ditampilkan di bawah judul.

## Mengisi jam dan aturan libur

1. Isi Jam masuk dan Jam pulang. Form tidak mengisi contoh nama, hari atau jam secara otomatis.
2. Aktifkan **Pulang hari berikutnya** bila melewati tengah malam. Contoh: masuk 22.00, pulang 06.00 besok. Urutan angka jam tidak mengaktifkan pilihan ini secara diam-diam.
3. Isi **Istirahat (menit)**, awalnya nol. Jika **Kurangi waktu istirahat dari durasi kerja** aktif, 09.00–17.00 dengan istirahat 60 menit dihitung 7 jam kerja. Jika nonaktif, tetap 8 jam. Ini aturan durasi jadwal, bukan pengakuan kehadiran atau perhitungan gaji.
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

Untuk satu Pegawai, pilih **Aksi → Ubah jadwal harian** pada barisnya. Untuk satu hingga 100 Pegawai, centang baris yang diperlukan dan gunakan **Ubah jadwal harian** di atas daftar. Keduanya membuka form yang sama. Pilihan checkbox bertahan saat pagination. Mengganti pencarian atau filter mengosongkan pilihan agar cakupan tidak tertukar.

Modal menampilkan avatar beberapa Pegawai, sisa jumlah dan total pilihan. Hanya bila lebih dari satu Pegawai, ringkasan dapat ditekan untuk membuka daftar bergulir berbatas tinggi dalam Collapse inline; form tetap terlihat dan terpelihara. Satu Pegawai menampilkan identitas statis. Tentukan rentang hari ini/mendatang maksimal 31 hari, tindakan Ganti/Tambah jam kerja, satu jadwal kerja (dan pilihan shift jika diperlukan), serta alasan minimal 5 karakter. **Tinjau perubahan** memeriksa seluruh target dan periode; **Simpan perubahan** baru menulis atomik. Pengaturan berlaku pada setiap tanggal dalam rentang, termasuk hari libur, tanpa mengubah pola rutin atau Pegawai lain. Pada Ganti, seluruh jam existing diganti setelah jumlah perubahan terdahulu ditampilkan. Pada Tambah, jam existing beserta tambahan terdahulu dipertahankan.

Tinjauan menampilkan periode dan jenis perubahan, lalu AppCollapse per Pegawai/rentang tanggal. Panel memuat jam kerja yang berlaku, jam tambahan atau pengganti, dan alasan perubahan. Tanggal berurutan pada halaman yang sama digabung bila Pegawai, rincian jam, dan sumber liburnya sama. Identitas Pegawai diulang per kelompok hanya saat memilih beberapa Pegawai. Gunakan pagination modal untuk hasil panjang. Perubahan sebelumnya ditampilkan terpisah melalui panel tanggal dengan alasan dari audit masing-masing; bukan mengganti alasan lama dengan isian terbaru. Maksimal 20 catatan audit terkait ditampilkan dan keterbatasan ini diberi keterangan.

Penanda libur pada pratinjau adalah nama hari libur kalender yang efektif pada tanggal tersebut atau Libur jadwal untuk hari tanpa jam dalam jadwal rutin. Jam kosong saja bukan bukti libur. Contoh: bila kalender organisasi berisi Libur Kerja pada 12 November dan mulai dipakai jadwal pada 11 November, tanggal 12 memang mengikuti libur kalender tersebut. Impor/perubahan tambahan tidak mengubah kalender diam-diam.

Pilihan massal diperiksa per Pegawai dan per tanggal. Jika A sudah memiliki jam tambahan pada 11 November sedangkan B hanya memiliki jadwal utama, penambahan lain pada 11–12 November mempertahankan jam masing-masing. Bila bertabrakan pada satu target, seluruh pengajuan ditolak tanpa menyimpan sebagian. Pegawai tanpa penetapan rutin pada tanggal pilihan tetap ditolak; ini berbeda dari Pegawai yang hanya belum memiliki jam tambahan.

Filter Lokasi, Divisi & Unit, Jabatan memakai penempatan utama yang berlaku pada tanggal organisasi; Jenis Kepegawaian memakai kontrak aktif dan menyediakan Tanpa kontrak aktif. Nilai opsi tetap terikat organisasi dan cakupan lokasi. Endpoint opsi Jadwal Pegawai menyediakan referensi minimum, sehingga hak Data Pegawai tidak diwajibkan untuk memakai filter ini.

API baru (session, origin, rate limit, scope organisasi/lokasi dan izin Kelola Jadwal Pegawai wajib):

- POST `/api/work-schedules/exceptions/bulk/preview`: `organizationId`, `employeeIds` (1–100 ID unik), `from`, `until` (inklusif, maksimal 31 hari), `mode` (`replace`/`add`), `patternId` (satu jadwal atau pola salah satu shift). Mengembalikan `previewHash`, `employeeCount`, `dayCount`, `changeCount`, `existingCount`, `timezone` dan `changes` (Pegawai/NIP/tanggal, sesi Sebelum/Sesudah, `dayOffLabel` berisi nama libur atau null). `previousAdjustments` opsional memuat `entries` (id, mode, from, until, employeeIds, reason) dan `limited`, hanya dari audit organisasi/target berizin pada rentang pilihan. Kontrak lama `shiftIds` (1–16 unik) tetap untuk replace, tidak boleh digabung dengan patternId. Pratinjau tidak menyimpan perubahan.
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

### Hapus permanen jadwal kerja

Admin SITOU memilih organisasi, membuka menu Aksi pada jadwal, lalu memilih **Hapus permanen**. Konfirmasi menyebut nama jadwal dan organisasi. Jadwal yang pernah ditetapkan, dipakai sebagai sumber perubahan harian, atau mempunyai riwayat revisi tetap tersimpan. Untuk kelompok shift, pemeriksaan mencakup pilihan aktif dan arsip. Jika data lama hanya mencatat ID jam bersama dan sumber jadwal tidak dapat dipastikan, penghapusan diblokir. Gunakan status Nonaktif untuk mencegah penetapan baru.

`/api/work-schedule-templates/:id/deletion` dan `/api/work-schedule-groups/:id/deletion` menerima GET dengan `organizationId` untuk pemeriksaan, dan POST dengan `organizationId`, `version` serta `requestKey` untuk konfirmasi. GET dengan `requestKey` yang sama memeriksa hasil setelah koneksi terputus. Server memeriksa peran, modul, organisasi, dan versi, kemudian menghapus master serta rincian pola dalam transaksi yang juga menyimpan audit dan receipt. Definisi jam internal dan revisinya tetap tersimpan. Jam privat kelompok yang tidak dirujuk diarsipkan agar nama kelompok dan pilihan shift dapat digunakan kembali. Bukti penggunaan memakai penetapan, audit, revisi dan snapshot yang sudah tersedia. Tidak ada migration baru.

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

## Batas kerja tambahan

Kirim absensi, termasuk alasan bila diwajibkan, mengikuti [kontrak API Mobile](mobile-api.md#absensi-mobile-sitou). Catatan terlambat dapat opsional sesuai kebijakan. Alasan absen pada hari libur atau di luar jadwal tidak memberi persetujuan lembur atau kompensasi. Pengakuan durasi kerja tambahan dan penggantian waktu belum dibangun. Rancang penggantian dengan tanggal atau rentang yang eksplisit, durasi yang disetujui setelah istirahat, dan perlindungan terhadap pemakaian ganda. Jangan memindahkannya otomatis ke hari berikutnya atau mengubah event absensi yang sudah tercatat.

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

Riwayat jadwal menampilkan lima penetapan per halaman sesuai urutan terbaru dari server. Nama jadwal, periode dan status Belum berlaku/Sedang berlaku/Sudah berakhir/Dibatalkan terlihat di header AppCollapse. Semua panel diawali tertutup dan hanya satu rincian dapat dibuka. Rincian memuat pelaku, waktu simpan menurut zona organisasi, serta alasan penetapan dan pembatalan. Pelaku/waktu yang tidak diberikan server ditampilkan Tidak tersedia. Batalkan penetapan hanya ditawarkan untuk jadwal mendatang yang belum dibatalkan sesuai kewenangan existing. Daftar kosong memakai EmptyState.

Perubahan ini hanya antarmuka dashboard. Tidak mengubah schema, endpoint, permission, histori database, pencatatan absensi atau source mobile.

Pada Ubah jadwal harian, Periksa jadwal membaca preview dan versi tanggal tanpa menyimpan. Pada lebar mulai 600 px, gunakan tombol ikon mata 44×44 px dengan tooltip dan nama aksesibel. Pada ponsel yang lebih sempit, tampilkan ikon dan teks Periksa jadwal. Tombol hapus tanggal pada kalender memakai ikon, tooltip, dan nama aksesibel per baris. Penghapusan baris baru disimpan saat Simpan kalender.

## Menghapus kalender libur

Aksi Hapus permanen khusus Admin SITOU dan hanya kalender yang belum pernah direferensikan oleh jadwal. Nonaktif atau referensi yang kemudian dilepas tidak menghapus bukti penggunaan. Penolakan menyebut nama/jumlah referensi. Kalender percobaan yang hanya memuat tanggal katalog boleh dihapus, tetapi katalog sumber tetap tercatat pernah digunakan. Lihat docs/work-schedules.md untuk API, error, receipt dan pembersihan PDF.

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

POST /api/work-schedules/exceptions/bulk/usage menerima organizationId, employeeIds (1–100 unik), from/until inklusif maksimal 31 hari. Endpoint read-only berizin Kelola Jadwal Pegawai, session/origin/rate limit, scope organisasi/lokasi dan fitur aktif yang sama. Periksa status Pegawai/tanggal bergabung/penetapan seluruh tanggal, lalu baca hasil resolver termasuk exception/snapshot. Respons memuat patternIds penetapan yang melintasi rentang dan days berisi date/shiftIds gabungan target, timezone, periods waktu absolut gabungan target beserta batas hari sebelumnya/berikutnya, serta revisions (id/shiftId/from/until/rules) yang berlaku pada rentang. Setiap period menambahkan targets berisi employeeId/date yang benar-benar memakai jam tersebut, hanya dari target berizin; tanggal adalah tanggal kerja asal meskipun jam melewati tengah malam. Tidak mengirim nama/alasan Pegawai atau mengubah jadwal. Snapshot batas hari tetap disertakan agar sesuai pemeriksaan server. Benturan memakai notice merah dan tindakan Lihat rincian yang menampilkan benturan pertama melalui tahap pada modal yang sama. Kembali mempertahankan isian; tinjauan dan simpan tetap memeriksa ulang di server.

Tambah mengunci pattern yang sudah ditetapkan pada rentang dengan label Sudah digunakan. Jadwal lain diperiksa berdasarkan waktu absolut, bukan ID jam internal; rentang yang tumpang tindih diberi label Jam kerja bertabrakan. Salinan dengan shift_id sama tetap pola berbeda. Satu target/tanggal memakai pilihan tersebut cukup untuk mengunci aksi massal, tanpa melewati target diam-diam. Shift kelompok diperiksa per pilihan; penambahan sebelumnya ikut dihitung meskipun pola sumbernya bukan penetapan utama. Pemakaian di luar rentang tidak mengunci. Metadata pilihan menambah shiftId pada choices kelompok; pilihan mingguan memakai days.sessions.shiftId existing. Ganti mengunci pola yang sedang ditetapkan pada salah satu target/tanggal dengan alasan Sudah digunakan, tetapi tidak mengunci pola lain hanya karena jamnya bertabrakan dengan jam yang akan diganti. Jadwal dengan ID berbeda maupun sama tetapi waktu bertabrakan dikunci sebagai konflik waktu; preview/simpan tetap mengulang pemeriksaan. Kesamaan ID shift pada pola lain menghasilkan SESSION_OVERLAP, bukan SCHEDULE_ALREADY_USED_FOR_ADDITION.

UI menunggu pemeriksaan, mengunci sumber/Tinjau jika gagal dan menyediakan Coba lagi; pergantian target/rentang membatalkan respons lama. Saat Jenis perubahan diganti, kosongkan scheduleId dan patternId beserta error field terkait; tanggal dan alasan tetap tersimpan. Saat rentang berubah saja, pilihan yang menjadi terpakai tetap terlihat dengan arahan memilih sumber lain. Preview dan simpan memeriksa ulang dari database (SCHEDULE_ALREADY_USED_FOR_ADDITION atau SCHEDULE_ALREADY_USED_FOR_REPLACEMENT, 422), bukan mempercayai metadata klien. Retry receipt tersimpan tetap mengembalikan hasil lama tanpa menambah dua kali. Tidak ada migration atau perubahan kategori master. Pemisahan Kegunaan utama/tambahan dari Jenis tetap/shift masih rekomendasi desain, bukan perilaku yang sudah aktif.

Klasifikasi waktu memakai revisi efektif tiap tanggal, bukan rules tampilan versi hari ini. Batas yang bersentuhan diperbolehkan; shift malam diperiksa terhadap tanggal sebelumnya dan sesudahnya. Kelompok yang semua pilihannya terkunci dengan sebab berbeda diberi alasan kelompok, tidak mengklaim seluruh kelompok sudah digunakan. Data lama days/shiftIds tetap dikembalikan demi kompatibilitas; tidak ada migration atau perubahan referensi master.

## Revisi pengaturan jadwal (073)

POST templates/patterns/groups menerima effectiveFrom (date-only) dan reason (5–1000 karakter). Perubahan struktur jadwal terpakai wajib berlaku paling cepat besok di zona organisasi dan setelah revisi terakhir. Nama/status saja tidak menambah revisi. UI tetap meminta tanggal/alasan pada edit jadwal terpakai agar dampaknya jelas. Pengubahan jenis tetap ke shift menggunakan jadwal baru; tidak mengonversi identitas penetapan.

work_schedule_definition_revisions menyimpan baseline sistem efektif -infinity saat revisi pertama dan definisi baru append-only (hari, referensi jam, kalender, kebijakan). Baseline tidak mengarang actor manusia. Header/pattern_days menyajikan pengaturan terbaru; resolver patternAt memilih versi berdasarkan tanggal setiap hari. Event, snapshot, ringkasan absensi, ledger cuti dan shift_assignments tidak diubah. Revisi referensi kalender ikut mencatat penggunaan permanen. Daftar master mengembalikan latestEffectiveFrom, opsi penetapan memuat versions untuk ringkasan sesuai tanggal mulai.

Kelompok shift mempertahankan patternId pilihan existing; perubahan jam memakai referensi shift baru, sehingga exception lama tetap utuh. Penghapusan pilihan terpakai ditolak, penambahan pilihan tetap diperbolehkan. Payload edit shifts menyertakan patternId untuk identitas tiap pilihan. Kalender baru wajib aktif dan satu organisasi. Perubahan khusus tetap mengalahkan jadwal rutin.

Semua simpan memakai lock organisasi, version check, receipt dan audit existing. Validasi menolak tanggal terpakai rekap/absensi pada periode baru, benturan sesi pada batas perubahan, penetapan berikutnya dan exception mendatang. Kegagalan membatalkan seluruh transaksi termasuk sesi baru/revisi. Tidak ada penulisan ulang absensi saat GET atau simpan master.

Development: jalankan npm run db:migrate -- database/migrations/20261103_073_work_schedule_definition_revisions.sql pada database existing, bukan bootstrap ulang. Bootstrap kosong dan pemeriksaan schema mencakup tabel baru. Backup database otomatis menyertakan versi definisi. VPS mengikuti prosedur deployment terpisah.

## Titik absensi

Modul Absensi juga mengatur titik di form Lokasi dan menu Akses Titik Absensi. Izin tersebut tersendiri dari Kalender Libur, Jadwal Kerja dan Jadwal Pegawai. Lihat docs/work-schedules.md.

## Konsumsi snapshot oleh absensi

Absensi versi 1 menyimpan penilaian per work_schedule_sessions dan membentuk rekap pasangan lengkap dalam transaksi. Jadwal lintas hari mengikuti work_date snapshot; tanggal kejadian tetap terpisah. Jangan mengubah snapshot yang sudah dipakai event/keputusan. Rekap multi-sesi mengecualikan jeda antarsesi dan tidak menyimpulkan durasi dari sesi tanpa pulang. Kontrak dan batas laporan di docs/mobile-api.md.
## Absen pada hari libur

Buka **Jadwal Kerja**, buat atau edit jadwal, lalu aktifkan **Izinkan absen pada hari libur** di bagian aturan hari libur. Satu pengaturan berlaku untuk seluruh pilihan dalam satu kelompok shift. Jadwal baru dan jadwal yang sudah ada mulai dengan opsi nonaktif. Perubahan jadwal terpakai mengikuti tanggal efektif, alasan, dan audit yang sama dengan perubahan aturan jadwal lainnya.

Opsi ini berlaku pada libur mingguan dan hari libur kalender bagi Pegawai dengan penetapan yang berlaku. Jadwal khusus berisi jam kerja yang ditetapkan HRD selalu dipakai lebih dulu dan dinilai sesuai jam tersebut. Tanpa jadwal khusus, Pegawai dapat mencatat satu pasangan absen masuk dan pulang dengan alasan pada setiap kiriman. Kelola Jadwal Kerja dan aktivasi modul Absensi tetap diperlukan. Lihat [kontrak absensi mobile](mobile-api.md#absensi-mobile-sitou).

API buat/edit jadwal reguler dan kelompok shift menerima boolean opsional `allowHolidayAttendance`. Saat edit, field yang tidak dikirim mempertahankan nilai tersimpan. Respons master mengembalikan `allow_holiday_attendance`.

### Prioritas jadwal untuk absensi

Jadwal khusus tetap menentukan sesi yang berlaku pada tanggal kerja. Backend hanya membuka sesi tambahan setelah sesi terjadwal terakhir berakhir dan sesi sebelumnya sudah ditutup. Sesi tambahan tidak mengubah jadwal Pegawai. Lihat [kontrak absensi](mobile-api.md#absen-di-luar-jadwal).

## Shift dan jadwal

- Tinjauan perubahan harian memakai AppCollapse per Pegawai/rentang dengan alasan di dalam setiap panel. Riwayat perubahan sebelumnya berasal dari audit terikat organisasi dan target berizin; jangan menganggap alasan terbaru berlaku pada perubahan lama. Penanda libur menyebut sumber kalender atau libur jadwal, bukan menyimpulkan libur dari ketiadaan jam saja. Benturan memakai AppNotice danger dengan ikon sejajar teks serta Lihat rincian sebagai tahap dalam AppModal yang sama, mempertahankan isian ketika kembali.

- Hapus permanen Jadwal Kerja khusus Admin SITOU pada organisasi dengan Absensi aktif. Periksa ulang versi dan seluruh riwayat, termasuk penetapan dibatalkan, perubahan harian, revisi, snapshot dan anggota shift yang diarsipkan. Jika bukti lama tidak dapat membedakan sumbernya, blokir penghapusan. Arahkan ke Nonaktif untuk jadwal terpakai. Gunakan konfirmasi, audit dan receipt dalam alur yang sama dengan penghapusan kalender.

- Form jadwal tetap/shift hanya meminta Kalender libur; jangan menampilkan dropdown Saat tanggal libur. Kalender terpilih otomatis memakai holidayPolicy=calendar, tanpa kalender memakai roster (libur mingguan dari jadwal). Data lama tidak dikonversi saat dibaca; edit terpakai mengikuti revisi bertanggal. Perubahan harian berizin tetap prioritas resolver dan kewajiban alasan absensi mobile bukan bagian otomatis dari perubahan form ini.

- Jadwal tetap/shift yang sudah digunakan tetap dapat diedit hari, jam dan kalender liburnya melalui versi bertanggal. Mulai berlaku wajib paling cepat besok di zona organisasi dan setelah versi terakhir; alasan wajib. Simpan baseline dan versi baru append-only di work_schedule_definition_revisions, tanpa mengubah penetapan lama, snapshot, event, rekap atau saldo cuti. Resolver memilih definisi sesuai tanggal, bukan header master terbaru. Periksa benturan lintas hari/perubahan khusus dan tolak periode yang sudah memiliki bukti absensi/rekap. Shift terpakai mempertahankan patternId; jangan menghapus pilihan shift yang masih memiliki histori. Jenis tetap/shift tidak dikonversi melalui edit metadata.

- Ganti jam kerja menonaktifkan pola jadwal/shift yang sedang ditetapkan pada salah satu target/tanggal; identitas pola menjadi acuan, bukan nama atau shift_id milik salinan. Pola pengganti lain tidak dikunci hanya karena jamnya sama. Periksa ulang pada preview/simpan. Saat Jenis perubahan diganti, kosongkan pilihan jadwal dan shift beserta error field terkait, tetapi pertahankan tanggal dan alasan. Perubahan rentang saja tetap mempertahankan pilihan dengan validasi ulang.

- Pada Tambah jam kerja, bedakan identitas jadwal dari referensi jam internal. Jadwal salinan tetap identitas tersendiri meskipun berbagi shift_id. Label Sudah digunakan hanya untuk pola yang ditetapkan pada target/rentang; jadwal lain yang waktunya tumpang tindih berlabel Jam kerja bertabrakan. Periksa jam absolut dengan revisi efektif tanggal target serta batas lintas hari, bukan kesamaan ID/nama jam.

- Pada Tambah jam kerja, jadwal/pilihan shift yang sudah dipakai salah satu Pegawai pada tanggal pilihan tidak dapat dipilih lagi. Periksa pemakaian dari server berdasarkan target/rentang, termasuk penambahan tersimpan, bukan nama jadwal atau seluruh histori. Kelompok tetap tersedia jika ada pilihan shift lain yang belum dipakai. Sumber lama terpilih yang menjadi tidak sah tetap terlihat dengan arahan memilih sumber lain; Tinjau diblokir selama pemeriksaan/gagal. Preview/simpan memeriksa ulang. Status Sudah digunakan harus terbaca pada dropdown mobile. Pengelompokan kegunaan master Utama/Tambahan belum diaktifkan oleh aturan ini.

- Ubah jadwal harian membedakan Ganti jam kerja (default) dan Tambah jam kerja melalui satu dropdown AsyncSelect. Petunjuk menyebut jam yang berlaku dan hasil tindakan dengan kalimat umum yang utuh, bukan frasa padat seperti jam kerja pada tanggal pilihan diganti. Pilih satu Jadwal kerja, lalu satu Pilihan shift bila jadwal memiliki beberapa alternatif. Jangan menampilkan identitas internal sesi sebagai pilihan bebas atau memilih semua shift dalam kelompok. Jadwal mingguan mengikuti jam masing-masing hari; hari tanpa jam pada sumber ditolak dengan alasan, bukan otomatis meliburkan. Tambah mempertahankan jam yang sedang berlaku termasuk perubahan terdahulu, Ganti mengganti seluruh jam pada tanggal pilihan. Tinjauan menampilkan jam kerja yang berlaku dan jam kerja tambahan atau pengganti per Pegawai/tanggal, dengan pagination bila diperlukan. Server menentukan sumber efektif, menggabungkan/memeriksa maksimal 16 periode hasil, benturan lintas hari, scope, versi, audit dan receipt secara atomik. Tidak ada opsi meliburkan, persetujuan lembur otomatis, atau perubahan saldo cuti. Endpoint single-date/kontrak shiftIds lama tetap khusus penggantian yang tervalidasi. Libur historis tetap terbaca. Lihat docs/work-schedules.md.

- Perubahan jadwal harian memerlukan penetapan rutin pada setiap tanggal target. Pilihan tanpa penetapan aktif/mendatang menonaktifkan aksi dengan alasan; pemberitahuan pilihan hanya menyebut jumlah tanpa daftar nama dan mengarahkan menetapkan jadwal agar jadwal harian bisa diubah atau menghapus centang. Filter Status jadwal menyediakan Semua/Sudah memiliki/Belum memiliki jadwal dengan acuan penetapan aktif/mendatang yang sama; pilihan campuran tidak boleh dilewati diam-diam. Server memeriksa seluruh tanggal pada preview dan simpan, termasuk endpoint single-date. Hari libur yang tercakup pola tetap boleh diubah; penetapan mendatang berlaku hanya sejak tanggal mulainya.

- Ubah jadwal harian tersedia pada Aksi per Pegawai dan toolbar untuk 1–100 Pegawai, dengan periode inklusif maksimal 31 hari. Keduanya memakai modal dan alur server yang sama. Aksi per baris mengambil Pegawai pada baris itu tanpa memakai pilihan toolbar. Gunakan ringkasan avatar bersama dan daftar Collapse inline hanya bila >1, dengan form tetap terpelihara. Tampilkan Periode dan Jenis perubahan, jam kerja, lalu Alasan perubahan di dalam satu ringkasan tinjauan. Preview server → tinjauan dampak → simpan atomik seluruh target/periode, tanpa commit sebagian. Periksa scope, fitur, status, tanggal bergabung, tanggal terpakai absensi/rekap, benturan lintas hari dan hash versi; audit serta receipt wajib. Kebijakan rutin, snapshot terpakai dan saldo cuti tidak diubah. Filter mengikuti penempatan utama/kontrak aktif organisasi. Ikuti `docs/work-schedules.md` untuk kontrak bulk dan batas.

- Daftar kategori katalog memakai Collapse pada detail, tinjauan, pratinjau sumber dan pemilih kalender; nama kategori, jumlah tanggal dan jumlah dipilih tetap terlihat saat ditutup. Isian tanggal manual tetap memakai panel per tanggal. Section Lihat jadwal tidak ditampilkan lagi pada Jadwal Pegawai/detail Pegawai; jangan membuat laporan jadwal pengganti sebelum diminta. Penetapan, histori dan resolver existing tetap dipertahankan.

- Form draft katalog wajib memiliki dua cara pengisian Ambil otomatis / Input manual + PDF. Gunakan FileUploadField langsung pada bagian Dokumen SKB dan pertahankan isian saat berpindah metode. Selesainya OCR tidak menimpa tanggal atau menyimpan draft otomatis; Tinjau hasil pembacaan → Gunakan hasil pembacaan hanya mengubah form, kemudian Simpan draft → Tinjau → Terbitkan. Validasi sumber, peninjauan, versi, receipt, audit dan izin backend tetap berlaku.

- Tahun katalog baru dipilih melalui AppYearPicker (tahun berjalan/mendatang, tahun lampau disabled), bukan input angka manual. Tahun pada draft/revisi existing tetap dipertahankan dan dikunci. Jangan menerapkan pembatasan ini pada filter laporan historis. Tanggal manual memakai Collapse per tanggal: judul tanggal terpilih, nama dan kategori tetap terbaca ketika ditutup; baris baru terbuka, isian terpelihara, validasi membuka panel dan memfokuskan field gagal. Data otomatis dijelaskan melalui AppNotice.

- Pengisian katalog tahunan boleh otomatis melalui tombol Ambil data terbaru khusus Admin SITOU. Fetch hanya dari endpoint penyedia tetap di server dengan timeout/batas byte, validasi tahun/tanggal/kategori/sumber SKB, rate limit dan audit pratinjau. Tampilkan perbedaan terhadap isian sebelum mengganti dan menyimpan draft secara eksplisit. Setelah penyimpanan otomatis berhasil, buka Tinjau katalog langsung dengan metode otomatis tetap terpilih. Data kosong/tidak valid/gagal diambil tidak boleh mengosongkan katalog atau menebak tanggal. Publikasi tetap memerlukan konfirmasi, dan kalender organisasi tidak ikut berubah. Jangan menambahkan panggilan sumber eksternal pada GET kalender/resolver. Lihat docs/work-schedules.md.

- Satu katalog terbit terbaru menjadi acuan setiap tahun, dan versi lama tampil sebagai Riwayat revisi. Periksa tahun sebelum fetch sumber dan ulangi di transaksi simpan/terbitkan. Daftar utama menampilkan satu katalog per tahun. Edit katalog terbit menyimpan versi terbit baru secara atomik berdasarkan ID dan versi acuan terbaru, tanpa draft baru yang terlihat. Tolak acuan usang atau isi identik. Riwayat dan draft lama tersedia melalui filter tampilan. Pertahankan histori. Pada editor kalender organisasi, tanggal resmi yang dipilih dikelompokkan dengan AppCollapse dan jumlah tetap terlihat saat tertutup. Pakai FormSettingSwitch dengan notice aktif/nonaktif di bagian bawah.

- Katalog Hari Libur adalah referensi global khusus Admin SITOU (Superadmin). Katalog terbit dan tanggalnya immutable; perubahan melalui revisi baru dengan audit. Seed resmi awal berpelaku sistem, tidak mengarang penerbit manusia. Data tahun kosong tidak ditebak. Kalender operasional tetap memiliki organization_id dan hanya berubah melalui pilihan/penyimpanan eksplisit pengguna berizin dengan Absensi aktif. Libur mingguan, nasional, cuti bersama dan libur organisasi dipisahkan. Memilih cuti bersama tidak menulis permohonan atau saldo cuti. Pemilihan katalog adalah tahap dalam AppModal kalender, bukan modal bertumpuk; preserve form, verifikasi sumber terbit di server, no-past-change, version/receipt/transaksi dan perlindungan snapshot wajib dipertahankan. Ikuti `docs/work-schedules.md` untuk pembaruan tahunan dan API.

Form jadwal baru memiliki dua jenis: Jam kerja tetap dan Kerja shift. Jam tetap memakai hari mingguan dengan jam utama serta pengecualian per hari. Kerja shift memuat pilihan bernama bebas, masing-masing satu rentang waktu pasti. HRD memilih satu pilihan untuk tiap Pegawai, bukan menetapkan seluruh pilihan sebagai waktu kerja Pegawai tersebut. Tidak mengaktifkan rotasi atau jam fleksibel pada form baru. Data lama tetap terbaca tanpa konversi diam-diam.

Resolusi saat ini: perubahan khusus pada tanggal → penetapan eksplisit Pegawai beserta kebijakan kalender → Jadwal belum diatur. Jangan mewariskan otomatis dari role, agama, divisi atau lokasi. Struktur penetapan divisi/lokasi lama tidak menjadi perilaku resolver saat ini.

Generator lama tetap tersedia untuk kompatibilitas snapshot employee_daily_schedules. Kalender dibaca otomatis tanpa generator atau mutation saat GET. Master tidak boleh menulis ulang bukti historis terpakai. Perubahan tanggal menyimpan alasan dan audit.

Untuk shift fixed:

- Terlambat = clock-in pertama setelah `scheduled_start_at + late_tolerance_minutes`.
- Pulang awal = clock-out terakhir sebelum `scheduled_end_at - early_leave_tolerance_minutes`.
- Pulang melewati jadwal hanya menghasilkan `overtime_candidate_minutes`.
- `approved_overtime_minutes` hanya terisi jika kebijakan otomatis mengizinkan atau HRD menyetujui. Pulang telat tidak selalu berarti lembur.

Untuk shift lintas tengah malam, kaitkan event ke `work_date` jadwal, bukan sekadar tanggal kalender event.

## Form dan fondasi jadwal kerja

- Nama jadwal dan dropdown Jenis jam kerja sejajar pada desktop serta bertumpuk full width di ponsel. Pilihan shift dapat dilipat dengan ringkasan nama/jam, isian dipertahankan, dan panel dengan error dibuka. Informasi hari libur/pilihan shift memakai AppNotice. Daftar menggunakan dropdown Jenis jam kerja dalam Filter data disertai deskripsi singkat, tanpa tab duplikat.

- Alur baru: Nama jadwal → Jenis jam kerja dengan pilihan Jam kerja tetap atau Kerja shift. Tidak memilih jenis, hari atau jam contoh otomatis. Jam tetap memakai Jam kerja utama dan panel Atur jam kerja per hari. Kerja shift memakai Tambah shift dengan nama bebas dan satu rentang waktu per pilihan. HRD memilih satu shift saat penetapan. Tidak menyediakan Rotasi, Jam fleksibel, jenis Libur kedua, Ikuti jam utama atau salin hari pada form baru. Hari yang tidak dipilih adalah Libur. Tolak benturan pilihan shift termasuk lintas tengah malam. Batas yang bersentuhan boleh. Status tetap paling bawah dan ringkasan menjadi konfirmasi sebelum request tulis.
- Kelompok shift menggunakan work_schedule_groups/work_schedule_group_items dari migration 067 dengan anggota pola/shift existing terikat organisasi. Jangan menyimpulkan kelompok dari format nama. Metadata mempertahankan ID. Susunan yang pernah digunakan harus disalin. API master lama tidak boleh mengubah atau memakai ulang shift kelompok secara terpisah. Pola lama tetap kompatibel, konfigurasi rotasi/fleksibel/beberapa waktu lama hanya dibaca pada form baru. Jangan mengubah histori, grant, kontrak patternId atau menjalankan ulang 063–066.
- Form baru hanya memuat field yang memiliki fungsi nyata bagi pengguna atau proses bisnis. Field Kode tidak ditambahkan secara default; gunakan hanya jika ada kebutuhan identifikasi bisnis, integrasi, atau operasional yang jelas. ID internal database tidak perlu ditampilkan sebagai isian pengguna. Jangan menghapus field kode modul existing lain secara massal.
- Jadwal mengikuti docs/work-schedules.md. Sumber aturan adalah revisi efektif dan snapshot sesi; histori terpakai tidak ditimpa. Hak work-schedules berdiri sendiri dari Data Pegawai. Profil dan jadwal awal harus satu transaksi.
- Dashboard jadwal memakai satu form Data Master → Jadwal Kerja dan penetapan Kepegawaian → Jadwal Pegawai. URL/grant existing dipertahankan. Form gabungan menyimpan sesi/pola atomik; kalender GET read-only dan tidak memerlukan susun manual. Langkah 4 Penempatan menyediakan pilihan Atur jadwal nanti. Jangan mengganti histori terpakai, menebak jadwal dari agama/role, atau mengaktifkan absensi mobile/kompensasi dari perubahan UI ini.

- Kalender Libur menempatkan status aktif/nonaktif paling bawah melalui FormSettingSwitch dan notice bersama. Tanggal dan nama dikelompokkan per hari; field manual dua kolom di desktop dan satu kolom di ponsel, dengan aksi hapus ikon pada header baris. Jadwal Pegawai menempatkan Tetapkan jadwal pada PageHeader, atau header panel saat tertanam pada detail Pegawai. Checkbox header hanya memilih halaman terlihat dengan status sebagian terpilih, batas 100 dan jumlah pilihan yang jelas. Batalkan semua pilihan bukan penghapusan data. Avatar/NIP mengikuti EmployeeAvatar dan pola Data Pegawai, foto tetap privat, berizin serta terbatas scope. Grant jadwal tidak membuka dokumen lain atau mutation file.

- Dialog Jadwal Pegawai memakai identitas berlabel dan komponen bersama AppNotice/InfoField/EmptyState. Penetapan baru pada workspace Jadwal Pegawai tanpa field tanggal akhir dan mengirim until:null, tanpa menulis ulang periode lama. Ubah jadwal harian memisahkan tanggal, pemeriksaan jadwal, pilihan Bekerja/Libur dan alasan. dayType hanya state UI, tidak masuk API. Riwayat memakai kartu status/periode/pelaku/waktu/alasan berlabel melalui ScheduleHistory, CompactInfoChip dan InfoFieldGrid. Tidak menebak data audit yang kosong.

## Aturan domain absensi

### Absensi tahap dashboard

Jangan memaksa HRD memasukkan ratusan pegawai satu per satu. Implementasikan urutan berikut:

1. Download template Excel/CSV dengan NIP, tanggal, jam masuk, jam pulang, status, dan catatan.

2. Upload ke file privat dan buat `attendance_import_batches`.

3. Parse ke `attendance_import_rows` tanpa langsung menulis event final.

4. Tampilkan preview dan error per baris: NIP tidak ada, duplikat, tanggal invalid, di luar organisasi, atau urutan jam salah.

5. Commit seluruh baris valid dalam transaksi/batch yang idempotent.

6. Buat event `source='import'`, hitung ulang rekap terkait, dan tulis audit.

Sediakan input manual hanya untuk koreksi kasus kecil. Setiap koreksi menyimpan alasan, actor, dan audit.

Web kiosk/PWA capture boleh ditambahkan sebagai jembatan, tetapi harus memanggil endpoint attendance yang sama dengan mobile masa depan. Jangan membuat database kedua.

### Kontrak mobile attendance

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

### Geofence, foto, dan validasi background

- `attendance_points` menyimpan koordinat, radius, batas akurasi, dan kebutuhan foto.

- `attendance_point_assignments` dapat menarget pegawai, divisi, atau lokasi dengan periode berlaku.

- Event menyimpan snapshot `distance_from_point_m` dan `allowed_radius_m`; perubahan radius tidak mengubah histori.

- Backend menghitung jarak dan tidak mempercayai boolean `inside_geofence` dari klien.

- Koordinat dan foto dianggap data sensitif dengan retention yang jelas.

- Foto wajib memiliki pemeriksaan MIME nyata, ukuran, dimensi, hash, dan malware scan bila tersedia.

- Validasi background/liveness adalah hasil verifikasi, bukan bukti absolut. Status meragukan masuk `needs_review`.

- Jangan menyimpan biometric embedding mentah tanpa keputusan hukum, keamanan, dan retention terpisah.

### Rekap absensi

`attendance_events` adalah bukti mentah. `attendance_daily_summaries` menyimpan:

- hadir, terlambat, tidak hadir, cuti, izin, sakit, dinas, libur, tidak lengkap, perlu tinjau;

- jam masuk pertama dan pulang terakhir;

- menit kerja, terlambat, pulang awal, kandidat lembur, dan lembur disetujui;

- versi kalkulasi dan waktu hitung.

Rekap harus mempertimbangkan jadwal, event valid, izin disetujui, hari libur, dan koreksi HRD. Perubahan aturan memicu recalculation terkontrol, bukan update event mentah.

Dashboard dan laporan rutin membaca rekap, bukan menghitung jutaan event setiap request.

## Katalog hari libur dan kalender organisasi

### Sumber dan pemisahan

Libur mingguan berasal dari hari kerja pada jadwal. Katalog platform menyediakan referensi tanggal **Libur nasional** dan **Cuti bersama**. HRD memilih tanggal yang berlaku pada kalender organisasi dan dapat menambah **Libur organisasi** secara manual. Kalender lama tidak berubah oleh instalasi katalog, publikasi, atau revisi. Memilih cuti bersama tidak membuat permohonan cuti dan tidak menulis ledger saldo.

Data bawaan migration 069 diverifikasi terhadap lampiran SKB pemerintah, bukan perkiraan kalender atau API eksternal:

- [SKB 2026, lampiran halaman 3–4](https://www.kemenkopmk.go.id/sites/default/files/pengumuman/2025-09/SKB%20Libur%20Nasional%20dan%20Cuti%20Bersama%20Tahun%202026.pdf): nomor 1497/2025, 2/2025, 5/2025; 17 tanggal nasional dan 8 cuti bersama.
- [SKB 2027, lampiran halaman 4–5](https://kemenkopmk.go.id/sites/default/files/pengumuman/2026-09/SKB%20Libur%20Nasional%20dan%20Cuti%20Bersama%20Tahun%202027.pdf): nomor 1205/2026, 3/2026, 2/2026; 18 tanggal nasional dan 8 cuti bersama. Dua Isra Mikraj pada 5 Januari dan 26 Desember tetap merupakan dua tanggal resmi.

Tahun Baru selalu tercantum 1 Januari; 31 Desember tidak ditambahkan sebagai libur nasional. Nama ditulis dengan ejaan UI yang konsisten tanpa mengubah tanggal atau kategori resmi. Publikasi awal berpelaku sistem (`system_seed`, actor audit NULL), bukan identitas manusia rekaan.

### Prosedur Admin SITOU

**Gunakan dan simpan draft** pada pengisian otomatis langsung membuka **Tinjau katalog** dari versi yang tersimpan, dengan metode otomatis tetap terpilih. Publikasi tetap memerlukan konfirmasi. Pengisian manual tetap menyimpan draft sebelum membuka tinjauan.

Pemeriksaan tahun dilakukan sebelum mengambil data dari sumber, lalu diulangi dalam transaksi simpan dan terbitkan. Jika draft sudah ada, buka draft tersebut. Jika tahun sudah terbit, gunakan **Edit katalog** pada katalog terbaru. Tanggal tersimpan tampil sebagai panel lipat per tanggal. Jika Ambil data terbaru dipilih saat mengedit, hasil langsung mengisi panel dan baru disimpan lewat aksi simpan. Buka panel untuk mengubah tanggal, nama atau kategori, atau gunakan ikon sampah di header untuk menghapus tanggal dari form. Perubahan daftar masuk ke versi baru saat disimpan. Pada tahap tinjauan, **Simpan perubahan** langsung menerbitkan versi baru dalam satu transaksi. Daftar utama menampilkan satu katalog per tahun. Pilih **Semua revisi dan draft** untuk melihat histori dan draft lama. Publikasi ditolak jika acuan berubah atau isi tanggal, kategori, nama, nomor keputusan dan URL sumber sama dengan katalog terbit terbaru. Revisi sebelumnya tetap terbaca sebagai **Riwayat revisi**. Draft lama tanpa acuan tidak dapat diterbitkan untuk tahun yang sudah terbit; salin koreksi yang masih diperlukan sebelum menghapus draft melalui alur resmi dan membuat revisi dari katalog terbaru.

Kelompok Libur nasional dan Cuti bersama pada detail/tinjauan katalog, hasil sumber API/OCR serta pemilih kalender memakai Collapse yang awalnya tertutup. Jumlah tanggal dan pilihan tetap terlihat pada header. Buka kategori untuk membaca tabel/kartu atau memilih tanggal; menutupnya tidak menghapus pilihan atau mengubah data.

Form draft dimulai dengan dua pilihan **Ambil otomatis** atau **Input manual + PDF**. Pilihan otomatis menampilkan tahun dan tindakan Ambil data terbaru. Pilihan manual menampilkan bagian Dokumen SKB (FileUploadField bersama), Identitas keputusan, Tanggal hari libur dan pemeriksaan PDF. Bagian tanggal memiliki keadaan kosong, penghitung batas 366, serta aksi tambah/hapus berikon dengan nama aksesibel. Pilihan metode tidak menghapus isian.

Tahun katalog menentukan tahun sumber yang diambil dan tahun seluruh tanggal pada revisi. Katalog baru memakai pemilih tahun saja: tahun berjalan dan mendatang dapat dipilih, tahun sebelumnya disabled. Tahun draft/revisi existing tetap ditampilkan dan dikunci agar histori tidak berpindah tahun. Ini pembatasan pilihan form, bukan penghapusan akses katalog lama. Entri manual dapat dilipat per tanggal; judul mengikuti tanggal yang dipilih beserta nama dan kategori. Baris baru terbuka, isian tertutup tetap disimpan dan divalidasi, serta panel gagal terbuka kembali. Penjelasan Data otomatis memakai AppNotice bersama.

PDF yang selesai dibaca tidak mengisi atau menyimpan tanggal secara otomatis. Admin boleh mengisi tanggal sendiri, atau Tinjau hasil pembacaan → Gunakan hasil pembacaan untuk mengganti isian setelah mencocokkan perbedaannya. Simpan draft tetap terpisah, lalu Tinjau katalog → Terbitkan. PDF sah menggantikan kewajiban tautan pemerintah; pengisian lewat tautan resmi lama tetap kompatibel. Rincian alur dan setup OCR: `scripts/README.md`.

1. Buka **Data Master → Katalog Hari Libur**, khusus Superadmin. Pilih tahun atau buat katalog baru. Tahun yang belum tersedia tidak diisi dari tahun sebelumnya.
2. Pilih **Ambil data terbaru** untuk mengisi satu tahun sekaligus dari Indonesian Holidays. Tahun, tanggal, nama, kategori, nomor keputusan dan tautan SKB diperiksa server. Tinjau tambahan/perubahan/penghapusan terhadap isian sekarang, lalu **Gunakan dan simpan draft**. Kembali ke draft mempertahankan isian sebelumnya. Pengambilan gagal atau tahun belum tersedia tidak menghapus isian maupun katalog tersimpan.
   Pengisian manual tetap tersedia: isi nomor keputusan, tautan HTTPS pemerintah berakhiran domain `.go.id`, tanggal, nama dan kategori. Satu tanggal hanya sekali, maksimal 366 tanggal per revisi, seluruhnya dalam tahun yang sama (2000–2200).
3. Cocokkan setiap tanggal, kategori dan nama dengan lampiran keputusan resmi. Tautan disimpan sebagai referensi; server tidak mengambil URL pengguna dan tidak melakukan sinkronisasi eksternal saat GET.
4. **Simpan draft**, kemudian **Tinjau katalog**. Perubahan belum disimpan memblokir publikasi. Kembali ke draft mempertahankan isian.
5. **Terbitkan katalog** meminta konfirmasi. Publikasi mengikat versi yang telah ditinjau, menyimpan pelaku/waktu/audit dan menjadi referensi baca HRD. Katalog terbit dan tanggalnya dilindungi trigger database dari perubahan. Penghapusan hanya melalui pemeriksaan belum pernah digunakan pada bagian Penghapusan permanen.
6. Jika SKB berubah, pilih **Edit katalog**, tinjau sumber dan tanggal, lalu pilih **Simpan perubahan**. Revisi lama tetap tersimpan. Draft lama yang identik dapat dipakai dalam transaksi simpan, sementara draft dengan perubahan perlu ditinjau secara eksplisit.

Pembaruan tahunan adalah tugas Admin SITOU melalui UI, dengan pengisian otomatis melalui tombol atau pengisian manual. Tidak memerlukan rilis aplikasi atau penulisan SQL manual. Tidak ada scheduler pengambilan otomatis pada tahap ini. Katalog belum tersedia ditampilkan jelas kepada HRD.

### Pengambilan data setahun

Sumber pihak ketiga adalah [Indonesian Holidays](https://github.com/ahrulsyamil/indonesian-holidays), endpoint tetap `https://indonesian-holidays.ahrulsyamil.com/holidays/{year}`. Sumber ini menyediakan kategori national_holiday/joint_leave dan metadata SKB. Sumber resmi keputusan tetap tautan pemerintah; data pihak ketiga wajib ditinjau Admin sebelum diterbitkan. Data 2026 berhasil diambil saat verifikasi implementasi, sedangkan respons penyedia 2027 masih kosong meskipun katalog bawaan SITOU 2027 sudah tersedia. Kekosongan penyedia tidak dianggap pembatalan keputusan dan tidak mengosongkan katalog SITOU.

Pengambilan hanya melalui POST Superadmin, maksimal 5 permintaan per menit per akun/IP. Browser mengirim tahun saja, tanpa URL bebas. Server memakai domain tetap, menolak redirect, batas waktu 15 detik dan respons maksimal 256 KiB. Validasi memeriksa JSON, tahun/count, kategori, konsistensi penanda nasional, tanggal valid dalam tahun yang sama, duplikasi, batas 366 dan sumber SKB HTTPS pemerintah. Data satu tanggal dengan beberapa kategori ditolak untuk peninjauan manual, bukan digabung/dihilangkan diam-diam.

Respons hanya mengisi tahap pratinjau dalam AppModal yang sama. Data lama tidak berubah sampai Admin memilih **Gunakan dan simpan draft**; tindakan ini mengganti seluruh tanggal dan metadata sumber draft melalui API simpan existing dengan optimistic version, receipt, transaksi dan audit. Pratinjau tanggal ditambah/diubah/dihapus memakai isian form saat pengambilan, termasuk perubahan yang belum disimpan. Setelah simpan otomatis, modal langsung membuka Tinjau. Publikasi tetap melalui konfirmasi Terbitkan, dan katalog terbit tetap immutable. Tidak ada pengambilan eksternal saat GET kalender, login, pergantian tahun atau resolusi jadwal.

Pengambilan berhasil diaudit sebagai `holiday_catalog.source_preview`, dengan pelaku, tahun, penyedia/URL tetap, waktu server, digest SHA-256, sumber SKB dan hasil normalisasi berstatus `preview_only`. Ini bukti pengambilan, bukan klaim hasil sudah disimpan atau sudah diverifikasi pemerintah. Simpan/publikasi tetap memiliki audit terpisah. Gagal mengaudit pratinjau membatalkan respons pengambilan; gagal menyimpan mempertahankan pratinjau dan isian agar dapat dicoba lagi. Riwayat tersimpan dapat digunakan ketika penyedia tidak tersedia.

### Prosedur HRD

1. Fitur Absensi organisasi harus aktif dan akun memiliki akses baca/kelola Kalender Libur. Admin HRD penuh tetap mengikuti gerbang fitur. Katalog global dapat dibaca hanya melalui konteks organisasi yang sah.
2. Buka Kalender Libur, buat atau edit kalender. Isi nama, lalu **Tambahkan dari katalog**. Ini tahap dalam AppModal yang sama, bukan modal bertumpuk; isian form dipertahankan.
3. Tahun awal mengikuti tanggal saat ini di zona organisasi. Libur nasional hari ini/mendatang yang belum tercatat dipilih awal. Cuti bersama tidak dipilih awal. Tanggal lampau terkunci. Tanggal yang sudah ada, termasuk tanggal manual, tidak ditimpa atau digandakan.
4. Periksa kategori, tanggal, sumber SKB, dan jumlah pratinjau. **Tambahkan ke form** hanya mengubah draft lokal. Isian resmi dari katalog tidak dapat diubah tanggal/namanya. Gunakan **Tambah libur organisasi** untuk tanggal manual.
5. Jika revisi terbaru berbeda dari tanggal katalog lama, pemilih menampilkan rincian perbedaannya. Kalender tidak diselaraskan otomatis. Untuk mengganti tanggal mendatang yang telah ada, hapus tanggal itu pada form, buka pemilih kembali, dan tinjau penggantinya. Tanggal lampau tetap tidak dapat diubah.
6. **Simpan kalender** memvalidasi dan menyimpan seluruh kalender dalam satu transaksi, termasuk asal tanggal, version check, audit dan receipt retry. Gagal menyimpan mempertahankan form. Versi usang memerlukan muat ulang, bukan penimpaan data orang lain.
7. Pilih kalender pada jadwal, kemudian pilih **Libur mengikuti kalender** atau **Tetap bekerja sesuai jadwal**. Tetapkan jadwal secara eksplisit kepada Pegawai. Tidak ada pewarisan berdasarkan agama, role, lokasi atau unit. Perubahan khusus pada tanggal tetap memiliki prioritas resolver existing.

Snapshot jadwal yang telah menjadi bukti tidak ditulis ulang. Katalog hanya dipakai saat menyalin tanggal ke kalender, bukan sumber runtime resolver absensi.

### Kontrak API

Semua respons memakai envelope SITOU, `private, no-store`, session server dan pesan aman. Mutation memakai origin guard, pembatasan payload/rate, schema strict, transaksi dan audit.

- `GET /api/system/holiday-catalogs?year=2027&page=1&pageSize=20` (tambahkan `view=history` untuk semua revisi dan draft): Superadmin saja. Tahun opsional; pagination maksimal 100. Mengembalikan revisi beserta tanggal, versi, sumber, status, penerbit dan jumlah. `search` kosong dan `status=all` diterima untuk kompatibilitas hook daftar bersama.
- `POST /api/system/holiday-catalogs/source`: Superadmin saja, body strict `{year:2026,id?:string,revisionOf?:string}`. Mengembalikan `{year,decisionNumber,sourceUrl,days,provider,providerUrl,fetchedAt,digest}` dalam envelope SITOU tanpa menulis draft/publikasi. `HOLIDAY_YEAR_UNAVAILABLE` (422) berarti penyedia belum memiliki data, `HOLIDAY_SOURCE_UNAVAILABLE` (503) berarti sumber tidak dapat dihubungi, dan `HOLIDAY_SOURCE_INVALID` (502) berarti respons tidak lolos pemeriksaan. Ketiganya mempertahankan data yang sudah ada. API simpan draft tetap memvalidasi isi hasil yang dipilih Admin dan tidak mempercayai provenance klien sebagai bukti resmi.
- `POST /api/system/holiday-catalogs`: `{operation:"save"|"publish"|"edit_published",requestKey:UUID,id?:string,version?:number,year:number,decisionNumber:string,sourceUrl:string,days:[{date:"YYYY-MM-DD",name:string,category:"national"|"joint_leave"}]}`. Tanpa id membuat draft tahun baru. `edit_published` menerima id dan versi katalog terbit terbaru dan langsung membuat versi terbit baru secara atomik. Edit/publikasi wajib versi sesuai. Publikasi memerlukan id dan isi yang persis sama dengan draft tersimpan. RequestKey terikat pelaku dan hash payload; retry sama mengembalikan hasil lama, payload berbeda 409. Lock per tahun mencegah draft/revisi ganda.
- `GET /api/holiday-catalogs?organizationId=ID&year=2027`: Superadmin/HRD berizin Kalender Libur, Absensi aktif. HRD dikunci ke organisasi session. Tahun opsional mengikuti hari ini organisasi. Data `{today,year,catalog:null|{id,year,revision,decision_number,source_url,published_at,days}}`; setiap tanggal memiliki id string, date, name, category. Tahun kosong bukan error dan tidak menghasilkan perkiraan tanggal.
- `POST /api/work-calendars`: kontrak existing ditambah `days[].catalogDayId?:string|null`. Date/name tetap wajib. ID diverifikasi terhadap tanggal katalog terbit dan harus cocok date/name. Category/revision/source tidak diterima dari klien; response daftar memperoleh metadata dari referensi server. Payload lama tetap sah, termasuk penyimpanan tanpa perubahan sumber pada tanggal existing. Tanggal manual lama tetap manual. Batas 366, optimistic version, no-past-change, receipt serta perlindungan histori existing tetap berlaku.

`VERSION_CONFLICT`, `DRAFT_EXISTS`, `PUBLISHED_IMMUTABLE`, `INVALID_CATALOG_SOURCE` menyatakan konflik yang perlu ditinjau pengguna. Kegagalan menulis audit/receipt membatalkan seluruh mutation.

### Penyimpanan dan penerapan

Migration `20261101_069_holiday_catalog.sql` menambah tiga tabel global referensi: `holiday_catalogs`, `holiday_catalog_days`, `holiday_catalog_requests`. Pengecualian lintas organisasi ini khusus katalog platform; bukan tabel operasional organisasi. `work_calendar_days.catalog_day_id` nullable mereferensikan snapshot katalog terbit. Nama/tanggal tetap tersimpan pada kalender organisasi beserta organization_id existing. FK katalog mempertahankan sumber; metadata kategori dan revisi diperoleh melalui join. Tidak ada perubahan ledger cuti, penetapan Pegawai atau snapshot existing.

Bootstrap `sitou_schema_v3.sql` memuat schema akhir dan seed sama. Database berjalan memakai migration 069, bukan menjalankan bootstrap kembali. Tidak menjalankan ulang 063–068, tidak mengaktifkan modul/grant otomatis, dan tidak melakukan deployment VPS.

### Dasar rancangan

Pemisahan jenis hari libur mengikuti [Talenta Calendar](https://help-center.talenta.co/hc/en-us/articles/11903599156889-How-to-Manage-Calendar-Sub-Menu). Pemilihan referensi dan penambahan manual mengikuti [Zoho People Holidays](https://help.zoho.com/portal/en/kb/people/administrator-guide/leave/operations/articles/managing-holidays). SITOU tetap memakai persetujuan eksplisit organisasi, source resmi dan alur saldo cuti terpisah sesuai keputusan produk.

### Opsi kedua: unggah PDF SKB

Unggah PDF SKB menyediakan pembacaan lokal melalui worker Tesseract/Poppler, pratinjau dengan sumber halaman, koreksi dan peninjauan eksplisit. PDF asli disimpan privat per revisi, dapat dilihat Admin serta HRD berizin setelah terbit. PDF bertahun berbeda tidak dapat dipakai. Pengambilan API/manual tetap tersedia. Kontrak save juga menerima pdfImportId dan pdfReviewed; sourceUrl boleh kosong hanya dengan PDF sah. Langkah development, migration 070, pemasangan VPS, keamanan, API, backup dan diagnosis dijelaskan lengkap di [Panduan PDF SKB](../scripts/README.md#unggah-pdf-skb-dan-operasional-ocr).

### Penghapusan permanen — migration 071–072

Hanya Admin SITOU yang dapat menghapus satu revisi katalog atau satu kalender organisasi. Berlaku juga untuk katalog bawaan dan kalender yang dibuat HRD. Tidak ada penghapusan massal. Data pengguna existing tidak dihapus oleh migration.

1. Pilih Aksi → Hapus permanen. Sistem memeriksa penggunaan, versi dan dokumen.
2. Jika pernah dipakai, tampilkan alasan beserta nama dan jumlah referensi; tombol konfirmasi tidak tersedia. Katalog dianggap digunakan setelah tanggalnya disimpan ke kalender, walaupun kalender tersebut belum dipakai jadwal. Kalender dianggap digunakan setelah dipilih pada pola/kelompok jadwal, termasuk histori nonaktif. Melepas referensi atau menghapus kalender percobaan tidak menghapus bukti penggunaan katalog.
3. Data lama memerlukan rantai versi audit yang lengkap. Migration 072 membaca versi sebelum perubahan dari payload audit lama karena hasil save legacy hanya berisi ID. Ketidakpastian tetap diblokir; tidak ada tombol reset bukti penggunaan.
4. Untuk data belum digunakan, konfirmasi menjelaskan identitas, organisasi, dampak revisi dan PDF. Jika revisi terbaru dihapus, revisi terbit sebelumnya tersedia kembali; jika tidak ada, tahun tampil belum tersedia. Seed tidak diulang saat GET atau restart.
5. Penghapusan header/tanggal, audit minimal, tombstone receipt serta antrean pembersihan PDF satu transaksi. Histori operasional dan audit lama tidak dihapus. Retry save lama terhadap tombstone menghasilkan ALREADY_DELETED.
6. PDF bersama tetap disimpan. PDF terakhir ditandai tidak tersedia, lalu worker:holiday-pdf menghapus byte, catatan impor dan stored_files. Status sementara: Data berhasil dihapus. Pembersihan dokumen masih diproses. Receipt pembersihan dipantau di latar belakang selama halaman aktif, tanpa mempertahankan modal sukses. Periksa status dalam dialog tetap tersedia jika hasil request penghapusan belum pasti. Jika storage gagal, worker mencoba ulang setelah 30 detik. Audit dan receipt minimal tetap tersimpan setelah pembersihan.

#### Kontrak API penghapusan

- GET/POST /api/system/holiday-catalogs/:id/deletion: khusus Admin SITOU, tanpa organizationId.
- GET/POST /api/work-calendars/:id/deletion: khusus Admin SITOU, organizationId wajib dan diverifikasi; Absensi serta organisasi aktif tetap diperiksa.
- GET biasa menghasilkan eligible, code/message, version, name, organization, usages (maksimal 20), usageCount, document dan revisionEffect. GET dengan requestKey UUID membaca receipt: state not_found atau deleted, cleanupPending dan message. Tidak mengirim path privat.
- POST menerima JSON strict version positif, requestKey UUID, serta organizationId khusus kalender. Origin wajib dan diperiksa, maksimum 2 KiB, maksimum 10 percobaan per menit per akun/IP pada bucket penghapusan bersama. Preview bukan otorisasi final; service memeriksa ulang dalam transaksi dengan parent lock yang juga dipakai trigger referensi baru.
- Respons private/no-store dan nosniff. Error internal hanya kode aman serta ID referensi. Request key sama dengan payload berbeda ditolak. Jika koneksi putus, periksa receipt sebelum mencoba ulang dengan key yang sama.

| Kode                          | Arti dan tindakan                                                          |
| ----------------------------- | -------------------------------------------------------------------------- |
| CATALOG_USED / CALENDAR_USED  | Pernah digunakan; lihat referensi, data tidak dapat dihapus.               |
| HISTORY_UNVERIFIED            | Riwayat penggunaan perlu diperiksa; penghapusan diblokir.                  |
| DOCUMENT_BUSY                 | Dokumen masih diproses; tunggu lalu coba lagi.                             |
| VERSION_CONFLICT              | Data berubah; muat ulang dan tinjau kembali.                               |
| ALREADY_DELETED               | Data sudah dihapus; perbarui daftar.                                       |
| FORBIDDEN / SESSION_EXPIRED   | Tidak berizin atau sesi berakhir; masuk kembali dengan akun berwenang.     |
| RATE_LIMITED / INVALID_ORIGIN | Tunggu sebentar atau muat ulang dari aplikasi.                             |
| DELETE_FAILED                 | Transaksi belum berhasil; coba lagi dengan ID referensi untuk penelusuran. |

Pembersihan PDF tertunda bukan kegagalan penghapusan database. Saat hasil request belum diketahui, UI tidak mengizinkan konfirmasi ulang sebelum status diperiksa.

DOCUMENT_QUARANTINED memblokir penghapusan bila dokumen dikarantina/terinfeksi; selesaikan penanganan keamanan melalui prosedur storage. DOCUMENT_UNSAFE memblokir pemilik/kategori/backend dokumen yang tidak sesuai. Penghapusan katalog tidak melewati karantina. DELETE_STATUS_UNKNOWN meminta pemeriksaan receipt ketika koneksi database terputus dan hasil commit belum dapat dipastikan.

Pratinjau penghapusan juga diaudit (holiday_catalog.delete_preview / holiday_calendar.delete_preview), termasuk pemeriksaan lintas organisasi oleh Admin SITOU. Audit mencatat kelayakan, kode penolakan dan jumlah referensi tanpa menyalin seluruh detail penggunaan.

### Presentasi kalender dan penghapusan

Menu aksi katalog/kalender memakai ikon outline sesuai fungsi. Konfirmasi hapus menjelaskan dampak secara langsung tanpa AppNotice. Setelah berhasil, modal ditutup dan snackbar bersama menampilkan hasil; pembersihan PDF yang masih berjalan disebutkan secara eksplisit dan dipantau saat tab terlihat. Form kalender memisahkan identitas, tanggal katalog, tanggal organisasi dan penggunaan; aksi impor/tambah/hapus memakai tombol ikon berlabel/tooltip dan EmptyState per kelompok. Isian tetap utuh saat berpindah tahap katalog atau request gagal.

### Penghapusan katalog dan kalender libur

- Hapus permanen hanya Admin SITOU melalui preview dan konfirmasi berizin. Katalog yang pernah disalin ke kalender dan kalender yang pernah dipakai jadwal tidak boleh dihapus, termasuk setelah referensinya dilepas. Bukti penggunaan append-only dan riwayat yang belum dapat dipastikan memblokir penghapusan. Tanggal lampau saja bukan penggunaan. Jangan menghapus histori atau menonaktifkan trigger untuk melewati perlindungan.
- Penghapusan database/audit/receipt/antrean PDF atomik. PDF bersama tetap disimpan; worker membersihkan byte dan metadata PDF tanpa referensi. Jangan menyatakan seluruh dokumen bersih sebelum antrean selesai. Pesan menyebut penyebab konkret: terpakai, riwayat belum pasti, dokumen diproses, versi berubah, atau kendala sistem dengan ID referensi. Koneksi terputus diperiksa melalui receipt sebelum retry. Lihat docs/work-schedules.md.

## Titik Absensi dan akses tambahan

Di Data Master → Lokasi, isi tanggal operasional lalu cari nama tempat atau alamat dengan **Cari** atau Enter. Pilih hasil dari dropdown di bawah kolom pencarian atau klik titik pada peta. Gunakan roda mouse di atas peta atau cubit dengan dua jari untuk memperbesar dan memperkecil. Dengan keyboard, fokuskan peta, geser dengan tombol panah, lalu tekan Enter untuk memilih titik tengah. Latitude dan Longitude tampil sebagai informasi baca-saja di bawah peta. Pilih titik lain untuk mengubah koordinat. Alamat diisi bila tersedia dan bisa dikoreksi manual. Lingkaran menampilkan radius jika sudah diisi. Leaflet dan ubin HTTPS OpenStreetMap memakai atribusi serta cache browser.

`POST /api/locations/geocode` menerima `{ query }` untuk maksimal lima hasil atau `{ latitude, longitude }` untuk mencari alamat titik terpilih. Endpoint memerlukan sesi HRD/Admin, izin Kelola Lokasi, origin yang valid dan memeriksa batas 30 permintaan per menit. Backend hanya meneruskan teks pencarian atau koordinat pilihan ke [layanan publik Photon](https://github.com/komoot/photon/blob/master/README.md). Ketersediaan dan kelengkapan alamat mengikuti layanan tersebut.

Di Pengaturan Organisasi → Akses Titik Absensi, pilih satu Pegawai, maksimal 25 titik, tanggal mulai dan akhir opsional. Akses tambahan berlaku bersama titik dasar dari penempatan. Cabut akses mengakhiri penetapan sekarang dan mempertahankan baris serta audit.

Master Lokasi memakai ID dan nama tanpa field Kode. Satu titik yang dikelola form Lokasi memakai kode internal LOCATION_<id> karena kolom code existing wajib. Koordinat tervalidasi disimpan ke lokasi dan titik dalam satu transaksi. Koordinat absensi adalah milik attendance_points. Payload Lokasi lama yang hanya berisi data administratif tidak mengubah titik. Penyimpanan titik membuat penetapan dasar untuk lokasi terkait. Penetapan tambahan memakai target Pegawai. Tanggal akses inklusif di zona organisasi.

Pada Tambah lokasi dan Edit lokasi, status Lokasi dan Titik absen berada dalam satu kelompok. Pilih organisasi terlebih dahulu bila form belum memiliki organisasi. Radius dan batas akurasi muncul saat titik absen diaktifkan. Pilih ikon tanda seru di samping field untuk membaca penjelasan. Titik baru bisa disimpan sekaligus dengan lokasi jika modul dan izin mengizinkan.

Titik absensi aktif dapat menjadi titik dasar bagi Pegawai yang penempatannya berlaku di lokasi tersebut, atau titik tambahan bagi Pegawai yang diberi akses. Titik nonaktif tetap dapat tercatat pada lokasi penempatan yang aktif, tetapi tidak dipakai untuk absen. Radius menentukan batas area absensi. Untuk absensi mobile di luar area, Pegawai wajib mengisi alasan setelah selfie dan server menyimpan status di luar radius. Batas akurasi GPS membatasi perkiraan meleset yang dilaporkan perangkat, sehingga posisi yang terlihat berada dalam radius bisa tetap perlu diambil ulang.

Modul Absensi harus aktif. Hak HRIS attendance-point-access Lihat/Kelola mengatur konfigurasi titik dan akses tambahan. Menulis lewat form Lokasi juga memerlukan Kelola Lokasi. HRD dengan cakupan terpilih hanya boleh mengelola Pegawai dan titik dalam cakupannya. Tidak ada grant delegasi otomatis.

- GET /api/attendance-point-access menerima organizationId, search, page, pageSize dan status untuk daftar. options=employees atau options=points memberi maksimal 50 opsi. configuration=1 dengan locationId opsional memberi konfigurasi pada form Lokasi.

- POST /api/attendance-point-access menerima organizationId, employeeId, pointIds, from dan until. Pencabutan menerima organizationId dan revokeId. Role, organisasi, modul, scope, origin, rate limit dan referensi diperiksa di server. Periode tumpang tindih ditolak atomik dengan 409. Pencabutan ulang tidak menambah audit. Jika hasil kirim belum diketahui, muat ulang daftar sebelum mengulang.

- POST /api/locations dan PATCH /api/locations/:id menyimpan nama serta data lokasi tanpa field `code`. Daftar dan opsi menggunakan ID serta nama. Kedua aksi simpan menerima attendancePoint opsional dengan enabled, radiusMeters dan maxAccuracyMeters. Saat diaktifkan, lokasi aktif, pasangan koordinat, radius 5–50000 meter dan akurasi 1–50000 meter wajib. PATCH tetap memakai version lokasi.

API self-service absensi mobile menggabungkan titik dasar dan tambahan, menyaring revoked_at, organisasi, status dan periode titik/lokasi, lalu mengirim ID, nama, koordinat, radius, dan batas akurasi. Backend memeriksa izin, jarak serta akurasi sebelum kamera dan saat kirim. Lihat [kontrak absensi mobile](mobile-api.md#absensi-mobile-sitou).

Migration 075 menambah revoked_at dan seed menu. Jalankan sesudah 074 pada database existing. Bootstrap sitou_schema_v3.sql memuat struktur akhir.

Acuan diperiksa 4 November 2026. [Leaflet](https://leafletjs.com/reference.html) · [Kebijakan ubin OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).

Rujukan: [Pemilih titik lokasi](ui-ux-guidelines.md#pemilih-titik-lokasi).

### Alur sederhana dan pengaturan titik absensi

- Mulai dari tugas pengguna dan letakkan pengaturan yang berkaitan di layar yang sudah dikenal. Pakai menu baru hanya bila tugas, pengguna, atau hak aksesnya memang berbeda. Isi data satu kali, tampilkan pengaturan lanjutan saat diperlukan, dan gunakan label yang mudah dipahami. Kesederhanaan antarmuka tetap menjaga validasi server, izin, dan histori.

- Rancangan absensi: konfigurasi titik dan radius berada di Data Master → Lokasi. Pengaturan Organisasi → Akses Titik Absensi menangani akses tambahan, termasuk beberapa titik dan periode penugasan. Satu alur pengisian koordinat memakai model titik absensi existing dan pemeriksaan izin tersendiri. API menyediakan koordinat, radius dalam meter, dan batas akurasi sesuai cakupan Pegawai. Backend menentukan kelayakan absensi.

- Implementasi dashboard mengikuti docs/work-schedules.md. Master Lokasi memakai ID internal tanpa kode. Template impor Pegawai mencocokkan pilihan lokasi ke ID dalam organisasi aktif. Form Lokasi menampilkan tanggal operasional, pencarian dan peta ringkas, koordinat baca-saja, lalu alamat. Pengguna mengubah koordinat dengan memilih titik pada peta atau hasil pencarian. Alamat dapat dikoreksi. Status Lokasi dan Titik absen berada dalam satu kelompok di form tambah maupun edit. Pengaturan titik dimuat setelah organisasi diketahui. Simpan tetap satu aksi tulis. Izin titik dan akses tambahan memakai attendance-point-access serta modul Absensi. Pencabutan menyimpan revoked_at dan audit.

- Hasil absensi self-service mengembalikan catatan dari event yang tersimpan. Retry memakai catatan event asli dan tetap memeriksa organisasi/Pegawai serta hash payload. Jangan mengganti lokasi absensi dengan lokasi penempatan pada respons hasil.

## Rekap Absensi

**Laporan → Rekap Absensi** menampilkan satu baris per Pegawai dan tanggal kerja yang memiliki rekap tersimpan. Daftar ini membaca hasil olahan `attendance_daily_summaries`. Tanggal tanpa rekap perlu rekonsiliasi jadwal, kalender, dan cuti/izin sebelum bisa ditampilkan sebagai tidak hadir.

- Halaman menempatkan filter bersama langsung di atas panel hasil. Desktop menampilkan tabel dan ponsel menampilkan kartu rincian per baris. Ringkasan metrik halaman tidak ditampilkan.
- Cari Pegawai tampil sebelum Rentang Tanggal. Tabel memisahkan Jadwal Kerja, Jam Masuk, Jam Pulang, Status, dan Indikator. Keterlambatan tampil bersama durasinya jika tersedia. Galeri rincian memuat foto yang dapat langsung ditekan serta keterangan untuk absen yang belum tercatat, absensi tanpa foto, atau foto yang gagal dimuat. Data waktu dan catatan tampil di atas galeri.
- Rentang awal mengikuti hari ini di zona waktu organisasi. Rentang maksimal 92 hari inklusif. Cari nama atau NIP, lalu saring berdasarkan lokasi, Divisi & Unit, jabatan, jenis kepegawaian, atau indikator. Penempatan utama dan kontrak dibaca menurut tanggal kerja.
- Indikator waktu berasal dari kategori yang tersimpan pada setiap bukti masuk dan pulang. Filter Tepat waktu mencocokkan masuk atau pulang tepat waktu. Status harian, geofence, kedekatan batas radius, dan konteks hari libur/di luar jadwal tetap terpisah. Bukti lama tanpa penilaian ditandai Waktu belum dinilai.
- Jam masuk pertama dan pulang terakhir ditampilkan bersama tanggal kerja. Jam setelah tengah malam menampilkan tanggal lokal tambahan. Durasi bersih menjumlahkan waktu pada pasangan masuk–pulang, dikurangi istirahat jika pengaturan jadwal mengaktifkan pengurangan. Hasil per sesi paling rendah nol menit. Durasi ditampilkan saat rekap menandai seluruh sesi lengkap. Modal menampilkan jam terjadwal serta setiap bukti masuk dan pulang. Foto yang tersedia dapat diperbesar melalui pratinjau gambar.
- Akses baca menu `attendance-summary-report` khusus HRD dan Admin SITOU. Fitur Absensi harus aktif. HRD terdelegasi memerlukan grant laporan. Admin SITOU memilih organisasi. Scope lokasi diterapkan pada penempatan tanggal kerja di daftar, Excel, detail, dan foto.
- Daftar menampilkan waktu masuk pertama dan pulang terakhir. Jadwal kerja ada di rincian. Rincian memisahkan jadwal dari kejadian yang tercatat, menandai pergantian tanggal dengan 00.00, dan menampilkan foto, lokasi, catatan, serta indikator pada masing-masing kejadian.
- Foto dan koordinat memerlukan `private_files.read_sensitive` serta mengikuti cakupan lokasi laporan. Endpoint mencocokkan foto profil aktif dengan Pegawai pada rekap, dan foto absensi dengan kejadiannya. Akses foto dan koordinat dicatat di audit tanpa menyimpan koordinat di log audit.
- Peta rincian memakai titik dan radius yang tersimpan saat absen, bersama posisi Pegawai untuk kejadian yang dipilih. Penyedia mengikuti pengaturan Organisasi, dengan OpenStreetMap sebagai bawaan. Untuk Google Maps di dashboard, atur `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` (kunci khusus browser dengan pembatasan domain dan Maps JavaScript API) dan `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` sebelum build. Bila belum dikonfigurasi, rincian tetap dapat dibuka dan peta menampilkan status konfigurasi. Lihat [panduan kunci Google Maps](https://developers.google.com/maps/documentation/javascript/get-api-key) dan [pengaturan Map ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).
- Excel menggunakan filter yang sama dengan daftar dan memuat hingga 5.000 baris lengkap. Ekspor lebih besar meminta penyempitan filter. NIP tetap teks. Foto, catatan Pegawai dan koordinat dikecualikan dari Excel. Aksi PDF menampilkan Coming soon.

Migration 083 mendaftarkan menu baca saja tanpa memberikan grant kepada HRD terdelegasi. Jalankan migration sebelum rilis.
