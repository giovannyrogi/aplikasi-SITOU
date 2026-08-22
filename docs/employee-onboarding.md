# Wizard dan Draft Pegawai

## Alur Pengguna

Wizard tambah pegawai terdiri dari `Profil`, `Kontrak`, dan `Penempatan`. Setiap step hanya menampilkan field miliknya. Perubahan disimpan ke draft privat saat pengguna menekan `Lanjut`, `Kembali`, atau `Simpan draft & tutup`; pengetikan field tidak mengirim request ke server. Draft aktif dipulihkan ketika modal dibuka kembali, termasuk setelah refresh atau login ulang.

Draft berlaku tujuh hari dan hanya dapat dibaca atau diubah oleh pembuatnya pada organisasi yang sama. Tombol `Mulai ulang` menandai draft lama serta file staging sebagai terhapus, lalu membuat draft kosong.

KTP dan pas foto bersifat opsional. KTP menerima JPEG, PNG, WebP, atau PDF maksimal 5 MB; pas foto menerima JPEG, PNG, atau WebP maksimal 5 MB. Kontrak aktif wajib memiliki nomor dan PDF kontrak maksimal 10 MB. Penempatan aktif wajib memiliki nomor SK dan PDF SK maksimal 10 MB. MIME diperiksa dari isi byte dan browser hanya menerima ID metadata file.

## Endpoint

- `GET/POST /api/employees/drafts`: mengambil atau membuat draft aktif.
- `PATCH/DELETE /api/employees/drafts/:id`: menyimpan checkpoint draft dengan version check atau membuang draft.
- `POST /api/employees/drafts/:id/files`: upload staging KTP, pas foto, PDF kontrak, atau PDF SK.
- `DELETE /api/employees/drafts/:id/files/:fileId`: soft delete file staging.
- `POST /api/employees/drafts/:id/submit`: finalisasi idempotent menjadi pegawai.

Finalisasi memvalidasi ulang payload, organisasi, referensi master, dan file dalam backend. Profil, kontak, kontrak, penempatan, referensi pas foto, serta relasi dokumen KTP opsional dibuat dalam satu transaksi. File staging kemudian dialihkan ke pegawai tanpa pernah mengirim `object_key` ke browser.

## Operasional

Jalankan `npm run employee-drafts:expire` melalui scheduler harian. Proses hanya mengubah draft kedaluwarsa menjadi `expired` dan melakukan soft delete metadata staging; penghapusan byte fisik tetap mengikuti retention storage.
