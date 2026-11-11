# attendance access

### Aktivasi Fitur Absensi organisasi

OrganizationModulesModal memakai ORGANIZATION_MODULES terpusat untuk FormSettingSwitch Inventaris dan Absensi. GET view=all menunggu status asli sebelum menampilkan sakelar. AppNotice gagal/Coba lagi tidak menyamar sebagai status nonaktif. Isian tetap ada bila PATCH gagal. Hanya perubahan dikirim sebagai satu batch atomik beserta version tiap fitur, dan ConfirmDialog muncul sebelum penonaktifan. AppModal, label aksesibel, status teks selain warna, loading backdrop, timeout/abort serta dirty-close existing tetap digunakan. HrisAccessFields/AccountAccessSummary menjelaskan bahwa Admin HRD penuh mengikuti fitur aktif. EmployeeForm menampilkan AppNotice ketika jadwal dapat diatur nanti, termasuk alasan fitur Absensi belum aktif. Tidak ada komponen gaya baru atau dependency tambahan.

### Organisasi: kelompok dan fakta terpisah

- menuCatalog menyediakan sidebarGroup untuk presentasi yang berbeda dari access.kind. sidebarGroups membentuk kelompok unik setelah filter izin dan mempertahankan urutan item di dalam kelompok. Organisasi tetap platform-only meski tampil di Kepegawaian. Organisasi menjadi item pertama Data Master, Jadwal Kerja mengikuti master kepegawaian lain.
- OrganizationsPage memakai kolom Kode/Nama/Lokasi aktif/Akun HRD/Akses berakhir/Status akses dan satu kolom status per fitur dari ORGANIZATION_MODULES. active_features existing menjadi sumber konfigurasi modul, tidak ada request/API baru. Nama resmi, jenis dan detail periode tetap di OrganizationForm/SubscriptionModal. Kelola fitur memakai SettingOutlined outline, ukuran dari RowActionMenu.
- CompactInfoChip menerima wrap opsional, default false. Jika aktif, tinggi menyesuaikan, label boleh membungkus termasuk kata panjang, tanpa ellipsis. Pemakai existing mempertahankan tinggi/ellipsis lama. OrganizationsPage mengaktifkannya pada kode serta status akses/fitur.
- ReportCardFields menerima stacked opsional, default false. Jika aktif, label di atas nilai dengan satu kolom agar informasi tetap utuh pada ponsel/teks besar. Pemakai laporan existing mempertahankan pasangan dua kolom. Kartu Organisasi memakai stacked dan RowActionMenu fullWidth/buttonLabel pada footer.

Tanggal akhir pada daftar/kartu Organisasi mengikuti status server. Saat grace, tampilkan akhir masa tenggang yang tersedia. Jika tidak, gunakan akhir periode. Status dan pemeriksaan akses tetap kewenangan backend.

HrisAccessFields memakai ATTENDANCE_MENU_KEYS bersama untuk mengunci checkbox dan tingkat akses Absensi ketika attendanceEnabled bukan true. Pilih semua hanya mengubah menu yang tersedia dan mempertahankan grant lama yang terkunci. Pesan nonaktif berwarna merah menyebut Admin SITOU. Label pengguna untuk role platform mengikuti ROLE_LABELS; identifier superadmin tetap kontrak teknis.

## Titik absensi

LocationMapPicker memakai AsyncSelect untuk dropdown hasil pencarian dan menampilkan peta ringkas langsung dalam form AppModal Lokasi. Pilihan titik menampilkan koordinat baca-saja dan mengisi alamat yang tersedia. LocationPointFields memuat konfigurasi titik sesuai organisasi dan hak akses. Status Lokasi dan Titik absen memakai FormSettingSwitch dalam satu FormSettingsGroup. Akses Titik Absensi memakai filter, tabel/kartu, modal dan notifikasi bersama.

LocationMapPicker memakai onError untuk notifikasi kegagalan reverse geocode. Pencarian selalu kosong ketika dibuka, sedangkan field Alamat mempertahankan alamat tersimpan. LabelInValue terkontrol mempertahankan pilihan baru selama form terbuka. Pusat/zoom awal dipasang satu kali pada koordinat pertama yang sah. Klik peta dan perubahan radius/koordinat setelahnya hanya menggambar ulang marker/radius tanpa mengubah viewport. Hasil pencarian memakai panTo tanpa mengganti zoom. LocationForm memberi key per lokasi/organisasi agar state tidak bocor antar record. Kontrak API/payload tidak berubah.

Pemilihan titik pertama oleh pengguna juga menandai peta sudah digunakan sebelum koordinat digambar, sehingga lokasi tanpa koordinat tersimpan tidak memicu zoom awal ketika pengguna sudah menentukan zoom sendiri.
Form Jadwal Kerja memakai `FormSettingSwitch` dengan `notice.on/off` untuk Pulang hari berikutnya, Kurangi waktu istirahat dari durasi kerja, dan Izinkan absen pada hari libur. Di dalam `Form.List`, berikan `watchName` berisi jalur lengkap ke nilai form agar status notifikasi mengikuti switch yang tepat. Izin absen tetap satu switch di bagian Aturan hari libur, termasuk untuk kelompok shift. `HolidayAttendanceNotice` memakai `AppNotice` untuk menjelaskan status pada ringkasan dan detail jadwal.
