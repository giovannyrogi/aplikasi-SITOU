# SITOU — aturan kerja

Aturan ini berlaku untuk seluruh repositori, kecuali aturan folder yang lebih spesifik. Instruksi pengguna terbaru didahulukan. Sumber kebijakan terperinci dan panduan operasional dipetakan pada [indeks dokumentasi](docs/README.md). Jangan menafsirkan pemindahan dokumen sebagai penghapusan aturan.

## Baca sesuai tugas

1. Pada awal tugas, baca file ini dan bagian indeks yang cocok dengan perubahan. Periksa aturan folder sasaran bila ada. Jangan membuka seluruh docs atau katalog komponen sekaligus.
2. Sebelum perintah berikutnya, gunakan aturan relevan yang sudah dibaca. Baca ulang hanya bila file aturan berubah, cakupan berpindah, konteks tidak lagi memuatnya, atau rujukan yang dibutuhkan belum dibaca. Pemeriksaan metadata/perubahan file cukup untuk memastikan kebaruan. Jangan mengulang isi penuh hanya karena menjalankan perintah baru.
3. Baca hanya dokumen/potongan yang diperlukan untuk keputusan saat ini. Tugas teks tidak memerlukan panduan OCR, backup atau migration kecuali cakupannya memang menyentuhnya. Saat menelusuri, cari heading/simbol lebih dulu dengan rg.
4. Bila cakupan berubah ke mobile atau repositori lain, baca AGENTS.md repositori tujuan. Jangan memakai asumsi path mesin lama; temukan checkout yang benar. Perubahan lintas proyek mengikuti aturan keduanya.

## Pengaman yang selalu berlaku

- Kerjakan hanya lingkup yang diotorisasi. Pertahankan perubahan pengguna dan data nyata. Deployment/VPS bukan bagian otomatis dari perubahan lokal.
- Jangan mengurangi keamanan, isolasi organisasi, histori, validasi atau audit untuk mempersingkat pekerjaan. Detail kontrol dibaca dari dokumen bidang yang relevan.
- Periksa implementasi aktual; bedakan kebutuhan/rencana dari perilaku yang telah tersedia. Perubahan schema melalui migration baru dan sinkronisasi bootstrap, bukan SQL produksi manual.
- Jalankan QA sesuai risiko dan laporkan hasil aktual serta batasannya mengikuti [aturan kualitas](docs/rules/quality.md). Untuk tugas dokumentasi, verifikasi tautan, cakupan aturan, duplikasi, dan diff; tidak perlu tes aplikasi yang tidak terdampak.

## Rute bacaan

| Tugas | Sumber utama |
| --- | --- |
| Tujuan, batas produk | [Produk](docs/rules/product.md) |
| Struktur kode, batas lapisan | [Arsitektur](docs/rules/architecture.md) |
| Database, query, migration | [Aturan data](docs/rules/data.md), lalu [peta database](docs/database-schema.md); SQL hanya bila perlu detail |
| API, auth, organisasi, keamanan | [API dan keamanan](docs/rules/api-security.md), [akses](docs/rules/access.md); kontrak fitur sesuai tugas |
| Frontend | [UI/UX](docs/ui-ux-guidelines.md) pada bagian relevan dan [indeks komponen](app/components/README.md); detail fitur dari indeks |
| Pegawai, kontrak, penempatan | [Pegawai](docs/rules/employees.md) |
| Jadwal, kalender dan absensi | [Indeks dokumentasi](docs/README.md#jadwal-kalender-dan-absensi) |
| Cuti/izin, disiplin, laporan | [Indeks domain](docs/README.md#pegawai-cuti-disiplin-dan-laporan) |
| Inventaris dan dashboard | [Inventaris](docs/rules/inventory.md), [dashboard](docs/rules/dashboard.md), hanya salah satu/section terkait |
| File, backup, OCR, worker, deployment | [Indeks operasional](docs/README.md#operasional), jangan dibaca untuk tugas lain |

## Pemeliharaan aturan dan skill

Setiap aturan mempunyai satu sumber aktif. Tambahkan koreksi ke dokumen pemiliknya, lalu tautkan dari indeks bila perlu. Jangan menyalin ketentuan ke AGENTS, skill, katalog komponen, dan panduan operasional sekaligus. Katalog mendeskripsikan API/komposisi komponen; panduan operasional menyimpan langkah menjalankan sistem; changelog adalah histori, bukan aturan aktif. Referensi ulang cukup berupa tautan. Jika ada konflik historis, pertahankan keputusan pengguna terbaru dan catat penggantian yang jelas.

Skill UI/UX proyek: [sitou-ui-ux](docs/skills/sitou-ui-ux/SKILL.md). Skill hanya alur penerapan, bukan sumber aturan kedua. Rujukan lokal adalah jalur relatif terhadap checkout, tidak bergantung drive/nama folder satu komputer.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
