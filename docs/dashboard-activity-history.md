# Riwayat aktivitas dashboard HRD

Tombol ikon di kanan atas Aktivitas terbaru membuka AppModal di tempat, tanpa
pindah halaman. Judul Riwayat aktivitas; baris memakai DashboardActivityRows
bersama dengan lima aktivitas dashboard. Waktu mengikuti timezone organisasi.
Riwayat default 10 aktivitas per halaman, dengan pilihan 10/20/50; DataPagination menyediakan
Sebelumnya dan Berikutnya. Menutup/membuka kembali dimulai dari halaman pertama.

GET /api/dashboard/activities menerima cursor opsional dan pageSize (10/20/50, default 10). Parameter berulang atau nilai lain ditolak.
Role HRD, sesi aktif dan sekurangnya satu bagian ringkasan berizin diperlukan.
Organisasi selalu dari sesi. Pegawai, Pimpinan, Superadmin, parameter organisasi
atau pegawai dari klien ditolak. Izin diperiksa ulang setiap request.

activityAccess.mjs dan buildOrganizationActivitySql merupakan sumber bersama
ringkasan dan riwayat: hanya pelaku HRD organisasi dengan membership yang berlaku
saat kejadian; login memerlukan snapshot role HRD. Platform dan role lain tidak
masuk. Jenis aktivitas, laporan, target akun serta lokasi mengikuti izin actor.
Draft/internal/file privat dikecualikan sesuai aturan feed yang sama.

DTO baris hanya id, label kegiatan, akun pelaku, ringkasan target publik, timezone, dan
waktu, serta ikon/tone semantik dari katalog bersama. Tidak mengirim before_data/after_data, catatan internal, surat atau path
file. Audit asli tetap append-only; membaca riwayat tidak membuat aktivitas baru.
Respons private/no-store dan tidak menggunakan cache bersama.

Keyset memakai occurred_at dan ID menurun. Cursor HMAC memakai namespace fitur,
berlaku 30 menit dan terikat akun, organisasi, fingerprint izin, daftar lokasi serta ukuran halaman.
Waktu mempertahankan enam digit mikrodetik agar halaman tidak melewatkan aktivitas
yang terjadi pada milidetik sama. Scope/izin berubah, cursor diubah, atau cursor
kedaluwarsa menghasilkan 400 dan meminta pengguna membuka kembali riwayat.

UI menyediakan skeleton, kosong, error dengan Coba lagi, kontrol 44px, tooltip dan
nama aksesibel. AppModal mengelola fokus, Escape dan scroll; useDashboardData
membatalkan fetch ketika halaman berganti atau modal ditutup serta mengabaikan
respons terlambat. Tidak memerlukan migration atau permission generik baru.

Verifikasi: lebih dari 20 aktivitas, timestamp sama dan berbeda mikrodetik,
keyset tanpa duplikasi, kesamaan lima data dengan ringkasan, lintas organisasi,
role lain, membership tidak berlaku, scope lokasi dan izin parsial/tercabut,
cursor palsu/berbeda akun/kedaluwarsa; browser desktop/mobile, keyboard, loading,
kosong, gagal/coba lagi dan tutup saat request masih berjalan.

Pagination memakai slot pagination AppModal di luar body yang bergulir, sama
dengan Kontrak Berakhir; footer hanya berisi Tutup. Mengubah ukuran halaman mereset cursor dan halaman.
DataPagination bersama pada mobile <600px menumpuk ringkasan, tombol Sebelumnya,
tombol Berikutnya, serta dropdown ukuran; tiap kontrol selebar area, minimal 44px
dan jarak 12px. Desktop tetap satu baris bila ruang cukup.

activityPresentation.mjs memetakan kode aksi ke ikon activity:* yang tersedia
secara lokal dan tone tema. Login memakai ikon masuk hijau, edit profil ikon edit
biru, persetujuan cuti kalender hijau, tindakan disiplin perisai warning, pencabutan
ikon urungkan secondary, dan impor/ekspor panah sesuai arah. Aktivitas, target,
akun dan waktu ditata terpisah; label tetap menjelaskan makna tanpa bergantung
pada warna. Tombol pembuka memakai ikon daftar, berbeda dari ikon judul.

ACTIVITY_PRESENTATION_VERSION membatasi versi snapshot visual pada kunci cache
server dan key komponen ringkasan client. Naikkan ketika kontrak ikon/tone berubah
agar snapshot yang telah terbuka dimuat ulang, tanpa polling. Respons ringkasan
menyertakan activityPresentationVersion. Verifikasi wajib membandingkan ikon/tone
aktivitas dengan ID yang sama pada API serta render ringkasan dan modal nyata.

Respons daftar menyertakan total seluruh aktivitas berizin. Total dan halaman
dihitung melalui CTE visible yang sama dalam satu query/snapshot PostgreSQL;
count tidak dipengaruhi cursor dan tidak mencakup data di luar izin/lokasi/role.
DataPagination menampilkan Total: N data dan Ditampilkan: M; M berasal dari
jumlah baris aktual, bukan ukuran halaman pilihan. Tidak mengarang total saat
memuat atau gagal. Slot pagination AppModal tidak ikut scroll; contentResetKey
mengembalikan body ke atas ketika halaman/ukuran berubah. Kontrak Berakhir
memakai pola dan komponen yang sama.
