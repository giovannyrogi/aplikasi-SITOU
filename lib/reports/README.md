# Laporan operasional

Kontrak dan pensiun menggunakan tanggal acuan organisasi dan perhitungan bersama pada `policy.mjs`, `query.mjs`, dan `service.js`. Dashboard, API daftar, serta Excel memakai service yang sama. Tidak ada migration struktur database untuk fitur ini.

## Akses dan penggunaan

- Menu Laporan → Kontrak Akan Berakhir: default hari ini sampai 30 hari mendatang, inklusif. Satu baris adalah satu kontrak; ringkasan juga menghitung pegawai unik.
- Menu Laporan → Proyeksi Pensiun: default hari ini sampai tanggal yang sama 12 bulan mendatang. Ulang tahun ke-58 adalah tanggal proyeksi, bukan keputusan pensiun otomatis. Kelahiran 29 Februari dijepit ke 28 Februari jika diperlukan.
- Tahun ini berarti 1 Januari–31 Desember. Kelompok sudah lewat secara default tidak membatasi tanggal awal. Kelompok tanggal lahir perlu diperiksa mengabaikan periode proyeksi.
- Filter tersimpan pada URL. Kartu dashboard menyertakan periode dan kelompok yang dihitung agar tautan membukakan hasil setara. Indikator ini memakai periode sendiri, terpisah dari rentang statistik dashboard lainnya.
- Pegawai aktif/probation/suspended yang tidak dihapus logis termasuk; status final dan draft dikecualikan. Proyeksi tidak mengubah status pegawai.
- Kontrak resmi dengan akhir terbatas termasuk, kecuali dibatalkan/terminated atau histori sudah digantikan. Kontrak renewed yang masih berlaku dan memiliki lanjutan terjadwal tetap ditampilkan; draft bukan bukti perpanjangan selesai.
- Superadmin memilih satu organisasi. HRD mengikuti organisasi dan cakupan lokasi; Pimpinan membaca organisasi sendiri. Pegawai ditolak. Kontrak memerlukan employees.read dan contracts.read, pensiun employees.read.

## API dan ekspor

GET `/api/reports/retirements` dan `/api/reports/expiring-contracts`, masing-masing mempunyai `/export`. Filter: organizationId, search, locationId, organizationUnitId, positionId, employmentTypeId, group, period, startDate, endDate, successor. Pagination menggunakan cursor opaque yang terikat filter, organisasi, scope, serta tanggal acuan. Ukuran halaman maksimum 50.

Ekspor mengabaikan halaman/cursor dan memuat semua hasil filter hingga 5.000 baris. Hasil lebih besar ditolak dengan pesan mempersempit filter. Workbook menyertakan organisasi, filter, acuan, dan waktu ekspor; seluruh teks pengguna berupa nilai literal, NIP dan nomor kontrak tidak dikonversi menjadi angka/formula. Tidak ada NIK atau dokumen privat. Respons no-store dan ekspor dicatat pada audit.

Tampilan layar memakai kolom terpisah dengan identitas foto/nama/NIP, mengikuti Data Pegawai.
Kartu mobile memakai divider dan baris label-nilai; informasi sekunder tersedia melalui detail.
Rentang sendiri yang belum lengkap/valid tidak mengirim request, ekspor, atau menampilkan hasil lama.
Periode berada setelah pencarian. Padding berasal dari shell dan komponen bersama, tanpa wrapper tambahan.
Definisi kolom Excel tetap lengkap. Respons daftar menyertakan organization_id dan
profile_photo_file_id aktif untuk avatar privat, tanpa object key. Foto tidak masuk Excel.
Dashboard mempertahankan enam indikator dan menyajikan retirementSummary dengan asOf,
upcoming, serta overdue; tiap kelompok memuat value, rows (maksimal lima), dan href laporan.
Kelompok diurutkan tanggal proyeksi naik, sesuai laporan. Panel menggantikan grafik kelengkapan.

## Verifikasi lokal

- `node --test tests/reports.test.mjs`: tanggal, perpindahan filter, dan workbook.
- `node scripts/test-reports-db.mjs`: fixture sintetis dalam transaksi yang di-rollback, periode, kontrak lanjutan, scope, pagination, dan EXPLAIN.
- `node scripts/test-reports-http.mjs`: memerlukan server development serta akun lokal per role; menguji izin, isolasi, dashboard dan Excel tanpa mencetak kredensial/data pribadi. Ekspor uji menghasilkan audit.
- `node scripts/test-reports-ui.mjs`: memerlukan Playwright/Chrome (opsional PLAYWRIGHT_MODULE_PATH dan CHROME_PATH), server lokal, akun HRD. Isi laporan dimock dengan data sintetis untuk screenshot 320–1920px dalam `.next/report-qa`.
- Jalankan `npm run lint` dan `npm run build`. Tema mengikuti provider aplikasi; provider saat ini menetapkan mode light, sehingga dark mode penuh memerlukan dukungan theme global, bukan warna khusus pada laporan.
