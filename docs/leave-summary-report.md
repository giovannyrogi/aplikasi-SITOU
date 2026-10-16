# Rekap Cuti & Izin

Menu **Laporan → Rekap Cuti & Izin** memakai ikon dokumen bertanda centang. Menu **Kepegawaian → Cuti & Izin** tetap untuk administrasi per kejadian. Rekap tidak membuat atau mengubah keputusan, saldo, maupun data pegawai.

## Isi

- Filter nama/NIP sebelum tahun, lokasi, Divisi & Unit, jenis, serta organisasi eksplisit untuk Superadmin. Dropdown pilihan memakai `AsyncSelect` dengan pencarian label; tahun memakai input kalender tahun.
- Halaman hanya menampilkan filter, keterangan singkat, dan tabel rekap. Kartu ringkasan/grafik berada di Dashboard; tidak diulang pada halaman laporan. Agregat jenis/bulan tetap tersedia untuk Excel empat sheet.
- Satu baris per pasangan pegawai–jenis: jumlah disetujui, durasi, pembatalan, hak disesuaikan, terpakai bersih, dan sisa saldo. Pasangan dengan entitlement tanpa pengajuan juga tampil.
- Pegawai memakai pas foto profil yang sama dengan Kepegawaian melalui ID file privat; klik atau Enter pada avatar membuka ImagePreviewModal. File yang dihapus/tidak tersedia memakai inisial. Grant laporan hanya mengizinkan preview pas foto pada scope pegawai yang sama, bukan KTP, dokumen pribadi, atau perubahan file.
- Pada desktop, Saldo tahun pilihan dikelompokkan menjadi tiga kolom **Hak**, **Terpakai**, **Sisa**. Angka dan satuan tampil utuh; Sisa memakai CompactInfoChip: tersedia hijau, menipis kuning ketika positif dan maksimal 25% hak, habis merah pada nol, saldo negatif merah. Indikator ini hanya tampilan dan tidak memengaruhi persetujuan. Seluruh header dan sel tabel memakai garis pembatas tipis, termasuk setiap subkolom Hak/Terpakai/Sisa. Tooltip judul menerangkan hak dengan saldo bawaan/koreksi dan pemakaian bersih. Mobile memakai tiga nilai berlabel melalui LeaveBalanceFields. Tanpa entitlement tampil Saldo belum tersedia; jenis tanpa saldo menampilkan Tidak menggunakan saldo.
- Ikon mata membuka Rincian rekap cuti & izin: identitas pegawai dan penempatan saat ini, ringkasan Disetujui/Durasi cuti/izin/Dibatalkan, saldo tahun pilihan, serta daftar kartu kejadian berisi nomor, status, periode, dan durasi. Daftar memakai keyset lima data per halaman, tanpa tabel bersarang atau modal administrasi satu kejadian. Pembatalan tidak masuk jumlah/durasi disetujui. Loading, kosong, dan error dibedakan. Tanpa alasan pribadi, catatan medis, dokumen, atau tautan administrasi berizin lain.
- Excel memuat empat sheet: Rekap pegawai, Rincian cuti izin, Rekap jenis, Rekap bulanan. Header rekap dua tingkat dengan Saldo tahun pilihan menaungi Hak/Terpakai/Sisa, dan label Durasi cuti/izin sama dengan UI. Rincian memuat data modal report-only dari cohort dan snapshot SQL yang sama. Rekap dan rincian masing-masing maksimal 5.000 baris; kelebihan ditolak tanpa pemotongan. PDF menampilkan Coming soon melalui komponen bersama.

## Perhitungan

Tahun mengikuti **tanggal mulai** cuti/izin pada zona waktu organisasi. Contoh: mulai 31 Desember 2026 dan selesai Januari 2027 tetap masuk rekap 2026 dengan seluruh durasi persetujuannya. Ini rekap keputusan/penggunaan tercatat, bukan rekap kehadiran atau jumlah hari kalender dalam bulan.

Status `approved` masuk jumlah dan durasi disetujui. `cancelled` hanya masuk pembatalan. Draft, menunggu, dan ditolak tidak dihitung. Riwayat resmi pegawai berstatus final tetap tersedia selama profil belum dihapus logis.

Cakupan pegawai dan filter lokasi/unit mengikuti **penempatan utama yang berlaku pada tanggal organisasi saat laporan dibaca**; tanpa penempatan tidak masuk scope HRD selected. Pengaturan ini sama untuk kartu, jenis, bulan, baris, rincian, dan Excel. Penempatan historis pada awal kejadian masih dapat dilihat pada halaman operasional sesuai izin terpisah.

Saldo mengambil entitlement dengan tahun `period_start` sesuai pilihan, sebagaimana ringkasan saldo pada detail pegawai. Semua transaksi ledger entitlement dijumlahkan:

- Hak disesuaikan = grant + carryover + adjustment.
- Terpakai bersih = negatif dari usage + restoration.
- Sisa = seluruh ledger, tanpa menimpa saldo atau menghitung ulang kalender.

Saldo adalah posisi terkini entitlement tahun terpilih pada `asOf`, bukan snapshot akhir tahun. Tanpa entitlement tampil Belum ada saldo, bukan angka nol dari annual allowance. Jenis tanpa saldo ditandai Tanpa saldo. Durasi yang disetujui dan pemakaian ledger dapat berbeda untuk jenis tanpa saldo atau saldo yang dikoreksi; keduanya diberi label berbeda.

## API dan akses

- `GET /api/reports/leave-summary`: filter `year`, `organizationId`, `search`, `employeeId`, `leaveTypeId`, `locationId`, `organizationUnitId`, `pageSize`, `cursor`. Default tahun organisasi. Respons private/no-store berisi summary, types, months, rows, total, filter options, nextCursor.
- `view=details` wajib `employeeId` dan `leaveTypeId`; mengembalikan rincian resmi berizin dengan keyset pagination.
- `GET /api/reports/leave-summary/export`: filter sama, view pegawai, pagination diabaikan; detail_rows/detail_total hanya diminta untuk export dalam statement yang sama; XLSX private/no-store/nosniff, audit `report.export` dengan entity `leave-summary` sebelum dikirim.
- Menu `leave-summary-report` bersifat read-only dan terpisah dari `leave-requests`. HRD terdelegasi wajib mendapat grant laporan eksplisit. Grant laporan tidak membuka administrasi cuti, alasan, lampiran, saldo mutation, atau profil lengkap. Admin HRD penuh, Pimpinan, dan Superadmin mengikuti aturan role yang ada.
- Backend memeriksa session, menu HRIS, permission role `leave_requests.read`, organisasi session, dan scope lokasi. Superadmin memilih satu organisasi. Cursor terikat filter, organisasi, scope, dan tanggal acuan.
- Setiap respons laporan dibangun dari satu statement SQL: kartu, grafik, saldo, total, dan baris memakai snapshot yang sama. Tidak ada N+1.
- Migration `058` mendaftarkan menu read-only tanpa memberikan grant baru kepada HRD terdelegasi. Bootstrap mencerminkan seed yang sama. Tidak ada tabel bisnis baru.

## Pemeriksaan

Gunakan database sintetis terpisah. Bandingkan kartu/jenis/bulan/baris/Excel, ledger grant–pemakaian–pembatalan–koreksi, hari/jam, jenis nol/nonaktif, batas tahun organisasi, periode lintas tahun, saldo tanpa pengajuan, keyset, hak laporan saja dan operasional saja, isolasi organisasi/lokasi, batas export, audit, modal, keyboard, layar 320–1920px, serta query plan. File dan database uji sementara wajib dibersihkan.
