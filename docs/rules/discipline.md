# Disiplin dan sanksi

## Disiplin berdasarkan Peraturan Perusahaan

Rujukan yang sudah diverifikasi: Pasal 52-58 pada dokumen Kode Etik, Tata Tertib, Jenis Pelanggaran dan Sanksi.

Aturan utama:

- Pelanggaran ringan mencakup mangkir 1 hari, terlambat/pulang awal tanpa izin, dan tidak melakukan absensi.

- Ringan: teguran lisan; SP1 bila tidak membaik; SP2 bila mengulang setelah SP1; SP3 bila mengulang setelah SP2.

- Sedang mencakup mangkir 3 hari kerja berturut-turut dan pengulangan pelanggaran ringan dalam masa SP.

- Sedang: SP1, lalu SP2, lalu SP3; organisasi dapat langsung memberi SP2/SP3 dengan pertimbangan kesalahan dan dampak.

- Berat mencakup mangkir 5 hari kerja berturut-turut atau lebih, atau 9 hari kerja dalam 1 bulan, serta daftar pelanggaran berat lain dalam Pasal 58.

- Berat dapat berujung SP3, skorsing, penurunan jabatan, dan/atau PHK sesuai proses resmi.

- SP1, SP2, dan SP3 masing-masing berlaku 3 bulan sejak diterbitkan dan gugur bila tidak ada pelanggaran dalam masa berlaku.

- Pegawai dapat diberi kesempatan menjelaskan/membela diri sebelum sanksi berat, kecuali tertangkap tangan.

- Satu kasus disiplin hanya boleh memiliki satu tindakan resmi. Pelanggaran atau pengulangan berikutnya dicatat sebagai kasus baru; tindakan yang memiliki surat wajib menyediakan satu aksi unduh dokumen berizin.

- Tindakan berstatus `draft`, termasuk metadata dan suratnya, hanya boleh dikembalikan kepada HRD dan Superadmin. Pimpinan hanya menerima tindakan yang sudah menjadi histori resmi seperti aktif, berakhir, dicabut, atau diajukan banding; penyaringan wajib dilakukan di query/service dan endpoint file, bukan hanya di UI.

- Daftar kasus pada detail pegawai memakai kartu ringkas untuk pemindaian dan `AppModal` untuk uraian, pembelaan, tindakan, eskalasi, audit penerbit, serta surat. Kartu tindakan yang dicabut wajib menampilkan status, pelaku, waktu, dan ringkasan alasan maksimal dua baris; alasan utuh tetap berada di modal detail. Jangan memadatkan seluruh informasi sensitif di kartu atau membuat halaman/modal shell lain.

- Tindakan tertulis aktif wajib memiliki nomor surat dan satu PDF berizin. Teguran lisan tidak mewajibkan nomor maupun dokumen surat. Pimpinan hanya dapat membaca detail dan mengunduh surat sesuai permission; kontrol perubahan tetap khusus HRD/Superadmin.

- Tanggal tindakan wajib mengikuti tanggal kejadian <= tanggal terbit <= mulai
  berlaku, termasuk draft. Saat Aktif, tanggal terbit/mulai tidak boleh melewati
  hari ini di zona organisasi; tanggal mendatang hanya draft. Kalender menonaktifkan
  tanggal di luar batas, form memvalidasi ketergantungan field, dan service memeriksa
  ulang tanggal kejadian dari kasus yang dikunci saat create/edit/penerbitan draft.
  Jangan menyesuaikan tanggal pengguna diam-diam atau mengubah keputusan resmi lama.

Sistem hanya membentuk `discipline_indicators`. HRD harus:

1. Meninjau bukti.

2. Membuka `discipline_cases` bila layak.

3. Mencatat klasifikasi dan penjelasan pegawai.

4. Mengunggah surat untuk tindakan tertulis.

5. Menerbitkan `disciplinary_actions`.

Dilarang membuat job yang otomatis mengubah indikator menjadi SP/PHK. Direct SP2/SP3 wajib menyimpan `direct_escalation=true` dan alasan. Dokumen dan uraian kasus hanya boleh terlihat oleh role berwenang.

Lifecycle tindakan disiplin wajib mempertahankan histori: status `draft` masih dapat diedit dan boleh belum memiliki surat lengkap; perubahan ke `active` memvalidasi ulang nomor serta PDF tindakan tertulis. Tindakan `active` dilarang ditimpa atau dihapus. Pencabutan `revoked` wajib beralasan dengan pelaku/waktu/audit; penerbitan sanksi baru dapat mengubah keputusan aktif sebelumnya menjadi `superseded` dalam transaksi terkonfirmasi, sementara masa berlaku lewat menjadi `expired`. Seluruh data dan dokumen asal tetap tersimpan.
