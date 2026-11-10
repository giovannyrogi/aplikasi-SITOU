# Titik Absensi dan akses tambahan

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

API self-service absensi mobile menggabungkan titik dasar dan tambahan, menyaring revoked_at, organisasi, status dan periode titik/lokasi, lalu mengirim ID, nama, koordinat, radius, dan batas akurasi. Backend memeriksa izin, jarak serta akurasi sebelum kamera dan saat kirim. Lihat [kontrak absensi mobile](mobile-attendance.md).

Migration 075 menambah revoked_at dan seed menu. Jalankan sesudah 074 pada database existing. Bootstrap sitou_schema_v3.sql memuat struktur akhir.

Acuan diperiksa 4 November 2026. [Leaflet](https://leafletjs.com/reference.html) · [Kebijakan ubin OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).


Saat Edit lokasi dibuka, peta berpusat pada koordinat tersimpan dan kolom pencarian awalnya kosong untuk mencari lokasi baru. Klik titik mempertahankan pusat dan zoom pengguna, sementara pencarian baru hanya menggeser pusat tanpa mengganti zoom. Membuka form tidak memanggil geocoding atau mengubah alamat. Pilihan pencarian baru mempertahankan label selama form terbuka. Alamat tersimpan tetap tampil pada field Alamat, bukan kolom pencarian. Tidak ada pesan proses pencarian balik di bawah koordinat. Kegagalan pencarian balik memakai notifikasi existing dan alamat masih dapat diisi manual.
