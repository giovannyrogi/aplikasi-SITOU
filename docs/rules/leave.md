# Cuti dan izin

## Cuti dan izin

- Kartu mobile daftar Cuti & Izin memakai identitas pegawai dengan NIP berlabel, status/kategori terpisah, serta ReportCardFields untuk nomor, jenis, tanggal mulai/selesai, durasi bersatuan, penempatan dan jumlah lampiran. Jangan menggabungkan NIP/nomor atau periode/durasi dalam satu baris metadata. Aksi berada pada footer kartu melalui RowActionMenu berlabel dan selebar kartu; target tombol serta item menu minimal 44px. Bingkai, nomor urut, tipografi mobile dan pagination tetap dari ResponsiveDataView. Tabel desktop, data sumber, hak akses dan workflow persetujuan/pembatalan tidak berubah karena perbaikan tampilan.

- Identitas pada Rekap Cuti & Izin memakai ID pas foto profil aktif yang sama dengan Kepegawaian, melalui endpoint file privat dan ImagePreviewModal. Grant laporan boleh membaca pas foto pada organisasi/scope pegawai yang sama, tanpa membuka dokumen identitas, lampiran pribadi, atau mutation file. Saldo desktop memakai kolom terpisah Hak/Terpakai/Sisa; mobile memakai LeaveBalanceFields dengan label serta satuan yang sama. Jangan menyembunyikan Hak/Terpakai sebagai metadata kecil atau mengubah perhitungan ledger demi tampilan.

- Halaman Rekap Cuti & Izin berfokus pada filter dan tabel, tanpa kartu ringkasan atau grafik yang sudah tersedia di Dashboard. Filter Cari pegawai berada sebelum Tahun. Dataset agregat boleh tetap digunakan untuk Excel tiga sheet.

- Laporan **Rekap Cuti & Izin** (`leave-summary-report`) memiliki grant read-only terpisah dari menu operasional. Kartu, grafik jenis/bulan, baris pegawai–jenis, rincian, dan Excel memakai cohort berizin yang sama: penempatan utama saat ini, tanggal mulai pada tahun organisasi, status approved/cancelled terpisah, tanpa draft atau alasan/lampiran pribadi. Durasi penuh sesuai persetujuan; hari/jam tidak dijumlahkan. Saldo dari ledger entitlement tahun pilihan, posisi terkini; hak termasuk carryover/koreksi, pemakaian bersih setelah restoration, tanpa entitlement jangan mengarang saldo. Rincian melalui modal report-only. Batas Excel 5.000 baris, audit, no-store, dan cursor terikat scope wajib. Aturan rinci: `docs/leave-summary-report.md`.

- Export pada daftar Cuti & Izin memakai `GET /api/leave-requests/export`, permission `leave_requests.read`, filter dan scope lokasi yang sama dengan daftar. Excel memuat seluruh hasil maksimal 5.000 data tanpa pemotongan diam-diam; NIP berupa teks, durasi angka bulat beserta satuan. Alasan pribadi, data medis, dan lampiran tidak diekspor. Unduhan diaudit dan private/no-store. PDF memakai notifikasi Coming soon melalui TableExportMenu. Lihat `docs/leave-export.md`.

- Approval final hanya oleh role HRD aktif.

- Tahap sekarang HRD dapat mencatat izin langsung dengan `submission_source='hrd_entry'`.

- Tahap mobile Pegawai dapat submit; keputusan tetap HRD.

- Pimpinan hanya melihat sesuai permission.

- Jenis sakit dapat mewajibkan `required_attachment_category='medical_letter'`.

- Request tidak boleh menjadi approved jika lampiran wajib belum ada dan valid.

- Overlap izin, saldo, tanggal kontrak, hari libur, dan status pegawai harus divalidasi server.

- Keputusan, pembatalan, dan perubahan lampiran diaudit.

- `employees.employment_status` tidak boleh memakai nilai `leave`; cuti dan izin sementara hanya berasal dari `leave_requests` yang disetujui. Form profil, import, dashboard, dan login wajib mengikuti pemisahan ini.

- Saldo cuti berasal dari penjumlahan `leave_balance_transactions`. Dilarang menimpa angka saldo langsung atau menghapus transaksi ledger.

- Pencatatan approved tidak dapat diedit. Koreksi dilakukan melalui pembatalan beralasan yang mengembalikan saldo tepat satu kali, lalu membuat pencatatan baru bila diperlukan.

Rekap Cuti & Izin: label Durasi cuti/izin; seluruh header dan sel tabel dibatasi garis tipis, termasuk ketiga subkolom Hak/Terpakai/Sisa. Sisa memakai CompactInfoChip: hijau tersedia, kuning ketika positif maksimal 25% hak, merah saat nol/habis atau negatif. Ini indikator tampilan, bukan aturan persetujuan. Jenis tanpa saldo tidak diberi indikator saldo. Modal Rincian rekap menampilkan identitas, ringkasan angka dan saldo, serta daftar kartu kejadian dengan navigasi keyset lima data per halaman. Jangan memakai modal operasional satu kejadian atau tabel bersarang untuk rincian rekap. Excel memakai header saldo dua tingkat dan sheet rincian report-only dari snapshot/filter/scope yang sama, batas 5.000 masing-masing tanpa pemotongan.
