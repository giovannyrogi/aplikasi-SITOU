# Bahasa antarmuka

## Koreksi pengguna yang wajib diperiksa sebelum implementasi

- Audit istilah satu alur secara utuh, termasuk form, tinjauan, bantuan, placeholder, error API dan hasil proses. Satu konsep harus memakai istilah yang sama, bukan sinonim bergantian. Ubah jadwal harian memakai jam kerja pada seluruh state, jadwal utama untuk jadwal rutin, serta tanggal mulai dan selesai pada field tanggal. Judul bagian mengikuti tindakan: Jam kerja pengganti atau Jam kerja tambahan. Label sumber memakai Jadwal kerja dan Pilihan shift, bukan sesi internal. Periksa contoh istilah di komponen dan pesan server sebelum menyatakan bahasa sudah konsisten.

## Bahasa dan komponen

- Gunakan Bahasa Indonesia yang langsung dipahami, sentence case, label persisten, dan kalimat pendek tanpa titik koma pada teks UI. Pilih Jam kerja tetap, Kerja shift, Tambah shift, Jam kerja utama, Atur jam kerja per hari dan Jam khusus. Rotasi serta Jam fleksibel tidak menjadi pilihan form baru. Hindari Custom, Sesi, atau istilah struktur internal pada alur sederhana.

## UI/UX

- Teks penjelasan/informasi memakai Bahasa Indonesia yang sederhana, singkat, dan langsung menjelaskan fungsi atau dampak aksi. Utamakan 1–3 kalimat. Hindari pengulangan, istilah teknis yang tidak diperlukan, dan paragraf bertele-tele. Jangan memakai tanda titik koma (`;`) pada label, bantuan, deskripsi, notifikasi, atau pesan validasi UI. Pisahkan penjelasan menjadi kalimat pendek atau daftar yang jelas. Aturan ini tidak melarang titik koma pada sintaks kode, SQL, atau format teknis yang membutuhkannya. Detail lanjutan ditempatkan pada dokumentasi atau konteks yang relevan.

- Panjang teks wajib mengikuti perannya. Judul menyebut tindakan/objek secara
  ringkas (utamakan 2–5 kata), bukan kalimat penjelasan panjang. Subjudul cukup
  satu kalimat pendek sebagai konteks, tanpa mengulang judul. Deskripsi boleh
  lebih rinci (umumnya 1–3 kalimat), tetapi tetap singkat, jelas, dan menjelaskan
  dampak serta informasi yang diperlukan pengguna untuk mengambil keputusan.
  Pakai kata umum yang mudah dipahami pengguna nonteknis; hindari istilah samar
  seperti "semula" bila acuannya tidak jelas. Sebut objek, tanggal, atau keadaan
  secara langsung, misalnya "Tanggal berakhirnya tidak berubah". Judul,
  subjudul, deskripsi, tombol, dan validasi harus menyampaikan makna yang
  konsisten; jangan menghilangkan dampak penting hanya agar teks lebih pendek.
  Periksa pembungkusan dan keterbacaan pada mobile tanpa memotong informasi.

- Paragraf penjelasan/informasi memakai alignment justify dengan baris terakhir mengikuti perilaku paragraf normal. Gunakan `FontStyle explanation` atau komponen deskripsi terpusat; jangan menerapkan justify pada judul, label field, angka, metadata, atau tabel. Penjelasan yang sengaja didesain center, seperti pesan utama modal hapus backup, tetap center melalui override eksplisit. Uji pada mobile agar kata, jarak, dan lebar paragraf tetap mudah dibaca.

- Seluruh antarmuka Bahasa Indonesia dan dapat dipahami pengguna nonteknis.

- Satu konsep memakai satu istilah yang sama sepanjang alur: petunjuk, judul bagian, label, placeholder, pilihan, validasi frontend/API, tinjauan, loading, notifikasi dan pesan gagal harus selaras. Tentukan istilah sebelum menulis UI dan periksa ulang tiap state; jangan berganti sinonim tanpa perbedaan makna. Pada Ubah jadwal harian gunakan jam kerja, bukan bergantian jam kerja/waktu kerja, serta jadwal utama secara konsisten untuk penetapan rutin.

- Setiap pembuatan/perubahan fitur atau komponen wajib meninjau bahasa judul, label, tombol, bantuan, validasi, keadaan kosong dan notifikasi sebelum selesai. Gunakan kata yang umum dipakai, kalimat pendek, tindakan konkret, dan istilah konsisten dengan fitur sejenis. Sebut objek serta akibatnya dengan jelas, misalnya jam kerja berlaku untuk semua tanggal yang dipilih. Hindari istilah teknis, frasa kaku atau kata samar jika tersedia padanan sehari-hari; jangan menyederhanakan sampai makna aturan bisnis berubah. Masukkan pemeriksaan bahasa ke QA frontend bersama render dan keyboard.

- Gunakan nama kegiatan yang dikenal pengguna dalam judul, penjelasan, dan pesan kosong. Untuk daftar cuti/izin, gunakan “cuti dan izin” atau “riwayat cuti dan izin”, bukan “pencatatan”. Contoh: “Lihat lima cuti dan izin terbaru Anda.” Sesuaikan istilah dengan proses sebenarnya; jangan menyebut seluruh data sebagai “pengajuan” jika juga mencakup cuti/izin yang dimasukkan HRD. Istilah “pencatatan” tetap dapat dipakai ketika memang menjelaskan waktu, pelaku, atau proses audit.

- Label, judul, tombol, bantuan, dan pesan validasi wajib menyebut isi atau tindakan dengan bahasa kerja yang langsung dipahami pengguna, sesuai fungsi kontrolnya. Hindari istilah struktur data atau label abstrak seperti "Nama jenis", "Jenis aktif", dan kode teknis ketika pengguna sebenarnya diminta memberi nama pilihan atau menentukan apakah pilihan tersebut tersedia. Gunakan pola yang konsisten, misalnya "Nama cuti atau izin", "Kelompok", "Kurangi jatah pegawai", dan "Tersedia untuk digunakan". Istilah teknis tetap boleh dipakai pada schema, kode program, dan dokumentasi pengembang, tetapi tidak ditampilkan sebagai beban input pengguna.

- Untuk teks yang dibaca pengguna, sebut objek konkretnya: "cuti atau izin" untuk permintaan cuti/izin, "transaksi" untuk perubahan stok, dan "disimpan pada" untuk waktu penyimpanan. Jangan memakai "pencatatan" sebagai nama generik objek/aksi. "Catatan" tetap tepat bila field benar-benar berisi keterangan bebas. Jatah tahunan dari aturan harus dibedakan dari saldo resmi yang sudah masuk ledger.

- Kelola Profil Lengkap harus memuat dan menampilkan data profil yang telah tersimpan untuk diedit, sementara section tanpa data tetap kosong. Checkbox yang berkaitan dengan satu input ditempatkan berurutan tepat di bawah input tersebut; pilihan tingkat keahlian memakai dropdown istilah Bahasa Indonesia yang baku.

- Petunjuk import yang tampil di workbook, modal, dan dokumentasi wajib memakai satu definisi terpusat. Setiap sheet harus diberi label Wajib, Wajib bersyarat, atau Opsional beserta fungsi, kapan diisi, dan aturan penting dengan Bahasa Indonesia yang mudah dipahami.

## Fondasi reusable dan standar visual SITOU

- Setiap pembuatan atau perubahan UI/UX wajib diperiksa kerapian alignment, baseline, hierarchy, lebar control, spacing, dan konsistensi antarhalaman yang memakai alur serta komponen sama. Breadcrumb, judul, deskripsi, toolbar, tabel, dan aksi tidak boleh tampak bergeser, berdempetan, terlalu melebar, atau berbeda struktur tanpa alasan produk yang jelas.

- Enum dan status backend yang dibaca pengguna wajib diterjemahkan ke Bahasa Indonesia. Data kosong memakai kalimat kontekstual seperti `Belum ditempatkan` atau `Belum diunggah`, bukan kode mentah atau tanda hubung yang ambigu.

- Grafik dashboard harus menjawab kebutuhan monitoring atau pengambilan keputusan, bukan menjadi dekorasi. Setiap grafik wajib memiliki judul, konteks, legend bila multi-seri, tooltip Bahasa Indonesia, tinggi stabil, serta state loading, kosong, dan error.
