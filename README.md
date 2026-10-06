# Proposal DIKTI: frontend

Situs statis untuk GitHub Pages, dibangun dengan Tailwind v4 dan Preline UI: HTML biasa dan modul ES,
tanpa framework JS dan tanpa CDN saat runtime. Situs ini adalah antarmuka akun dan pembaca materi; datanya
berasal dari API backend yang berada di repo terpisah.

## Perintah

```bash
npm install
npm run build        # dist/: HTML, CSS Tailwind, Chart.js dan font
npm run check        # aturan CSP dan tanpa CDN pada dist/
npm run dev          # build lalu sajikan dist/ di http://localhost:5173
npm run test:e2e     # uji peramban (Chrome terpasang + playwright-core)
npm run make:logo    # ikon merek, favicon, dan ikon layar utama dari assets/img/ZafranOS-logo3.png
npm run make:og      # gambar pratinjau tautan assets/img/og.png dari scripts/og.html
```

## Konfigurasi build

| Variabel | Fungsi |
|---|---|
| `PDK_API_ORIGIN` | Origin API backend (bawaan `http://localhost:8080`) |
| `PDK_BASE_PATH` | Awalan situs, mis. `/nama-repo`; kosong untuk akar domain atau domain kustom |
| `PDK_REQUIRE_API_ORIGIN` | `1` = build gagal bila origin API kosong |
| `PDK_SITE_URL` | Alamat publik situs tanpa path, mis. `https://contoh.id`. Mengisi canonical, Open Graph, `sitemap.xml`, dan baris `Sitemap` di `robots.txt`; kosong = tag beralamat absolut dibuang |

## Uji peramban

Uji ini menjalankan backend sungguhan: letakkan checkout repo backend di `../gocroot` dan jalankan MongoDB uji.

```bash
docker run -d --rm --name pdk-mongo-test -p 27018:27017 mongo:7
npm run test:e2e
E2E_BASE_PATH=/nama-repo npm run test:e2e    # situs disajikan sebagai situs proyek
```

## Struktur

```
partials/             potongan HTML bersama (head dengan CSP, logo, bilah aplikasi), disisipkan saat build
assets/css/           input.css (komponen) dan themes/tinta.css (token warna tema Preline)
assets/js/            modul bersama (session, api, auth, ui, icons, drawer, common)
assets/js/pages/      satu modul per halaman
assets/js/reader/     pembaca materi
assets/js/admin/      komponen panel admin (navigasi, dialog, paginasi, grafik, aksi pendaftaran)
assets/js/landing/    skema bidang landing yang dapat disunting dan penerapan isinya ke halaman
assets/img/           logo sumber, ikon turunan, dan gambar pratinjau tautan
admin/<halaman>/      panel admin: dashboard, users, users-detail, enrollments, invite-codes, progress, landing
<halaman>/index.html  halaman situs
```

## Landing yang dapat disunting

Teks landing (`index.html`) dapat disunting admin di `/admin/landing/`. HTML tetap memuat teks bawaan, yang dibaca
mesin pencari dan tampil tanpa JavaScript; isi dari API (`GET /api/landing`) hanya menimpa teks polos lewat `textContent`.

| Atribut | Arti |
|---|---|
| `data-edit="bagian.bidang"` | teks elemen dapat diganti |
| `data-list="bagian.daftar"` | anak-anaknya adalah butir daftar; butir pertama menjadi cetakan butir baru |
| `data-field="kunci"` | di dalam butir: elemen yang diisi dari butir itu (`data-optional` = disembunyikan bila kosong) |

Menambah bidang berarti memberi atribut di `index.html` **dan** mendaftarkannya di `assets/js/landing/schema.js`
(label dan batas panjang untuk editor). `npm run check` menggagalkan build bila keduanya tidak sama atau teks bawaan
melebihi batas. Editor hanya mengirim bidang yang berbeda dari bawaan, jadi bidang yang tidak disunting tetap
mengikuti `index.html`.

## Mesin pencari

Hanya landing yang boleh diindeks (`<!--@head:index-->`); semua halaman lain memakai `<!--@head-->` dan bertanda
`noindex`. `robots.txt` mengizinkan semuanya, sebab `noindex` hanya terbaca bila halamannya boleh diambil perayap.

## Konvensi

- Komponen dipakai lewat kelas semantik (`.btn`, `.card`, `.chip`, `.input`, ...) yang didefinisikan di `assets/css/input.css`, bukan menyalin utilitas panjang.
- Ikon berasal dari `assets/js/icons.js`: `icon()` di JS dan `<!--@icon nama | kelas-->` di HTML statis.
- CSP lewat tag meta, `script-src 'self'` dan `style-src 'self'`: tanpa skrip inline dan tanpa atribut `style`.
- DOM dibangun dengan `createElement` dan `textContent`, bukan `innerHTML`.
- Tautan internal memakai `api.go()`, `api.goReplace()`, dan `api.withBase()` agar awalan situs konsisten.
- Token disimpan di localStorage dan dikirim sebagai header Bearer.

## Deploy

`.github/workflows/pages.yml` membangun, memeriksa, dan mengunggah `dist/` ke GitHub Pages.

- Aktifkan Pages dengan sumber "GitHub Actions".
- Variabel repo `API_BASE_URL`: alamat API backend tanpa path. Selama kosong, deploy dilewati.
- Base path dihitung dari nama repo; variabel repo `PAGES_BASE_PATH` menimpa (`root` = akar domain, untuk domain kustom).
- Variabel repo `SITE_URL` (opsional): alamat publik situs, mis. `https://contoh.id`; mengisi canonical, Open Graph, dan sitemap.
- Origin situs harus terdaftar di `ALLOWED_ORIGINS` backend.
