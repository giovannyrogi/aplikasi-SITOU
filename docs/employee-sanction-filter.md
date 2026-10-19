# Filter sanksi pada Data Pegawai

Filter awal **Tanpa filter sanksi** tidak membatasi sanksi. Pilihan **Pernah mendapat
sanksi** mencari tindakan resmi nondraft, termasuk yang berakhir atau dicabut.
**Memiliki sanksi aktif** dan **Tidak memiliki sanksi aktif** mempertimbangkan status
active/appealed, tanggal mulai, dan tanggal akhir menurut timezone organisasi.
Tanggal awal/akhir bersifat inklusif. Draft tidak pernah dihitung.

**Jenis sanksi** memakai ID master organisasi. Memilih jenis saat status Tanpa
filter sanksi otomatis memilih Pernah mendapat sanksi. Memilih Tanpa filter sanksi atau
Atur ulang membersihkan jenis. Menghapus jenis kembali mencakup semua jenis
pada status pilihan. Jenis nonaktif berlabel nonaktif tetap tersedia bila ada
riwayat resmi dalam cakupan pengguna. Nama tidak menjadi kondisi query.

Status dan jenis harus cocok pada tindakan yang sama. EXISTS mencegah duplikasi
pegawai dengan banyak tindakan. Tidak memiliki sanksi aktif + jenis berarti tidak memiliki
sanksi aktif dari jenis tersebut. Filter digabung dengan pencarian, lokasi,
Divisi & Unit, jabatan, jenis kepegawaian, status pegawai, dan filter lainnya.

Parser bersama dipakai daftar dan Excel. Service listEmployees memakai kondisi
yang sama untuk data dan total; ekspor memanggil service tersebut tanpa pagination
layar, maksimal 5.000 pegawai. Workbook mencantumkan status serta jenis sanksi
terpilih. Urutan nama lalu ID menjaga pagination stabil untuk nama sama.

Permission employees.read, organisasi sesi, dan scope lokasi tetap berlaku.
Referensi hanya berisi ID, nama, dan status aktif jenis; tidak mengirim uraian,
catatan internal, draft, atau surat. Tidak ada schema atau migration baru.

Verifikasi memakai fixture sementara: default, riwayat/aktif/tanpa aktif,
jenis ganda, jenis nonaktif, draft, masa depan/berakhir/dicabut/dalam banding,
batas tanggal, isolasi organisasi/lokasi, total dan pagination tanpa duplikasi,
validasi ID, reset/pencarian dropdown, serta label filter Excel. Artefak uji
sementara dibersihkan setelah pemeriksaan berhasil.

Label filter adalah **Status sanksi**. Pilihan **Tanpa filter sanksi** berarti
tidak membatasi daftar berdasarkan sanksi, bukan berarti pegawai tidak memiliki
sanksi. **Tidak memiliki sanksi aktif** tetap dapat mencakup pegawai dengan
riwayat sanksi yang sudah berakhir. Pilihan awal filter harus menjelaskan bahwa
filter tidak diterapkan; hindari label umum yang dapat disalahartikan sebagai
kondisi seluruh hasil. Label pilihan dipusatkan bersama dengan ekspor.
