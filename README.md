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
```

## Konfigurasi build

| Variabel | Fungsi |
|---|---|
| `PDK_API_ORIGIN` | Origin API backend (bawaan `http://localhost:8080`) |
| `PDK_BASE_PATH` | Awalan situs, mis. `/nama-repo`; kosong untuk akar domain atau domain kustom |
| `PDK_REQUIRE_API_ORIGIN` | `1` = build gagal bila origin API kosong |

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
admin/<halaman>/      panel admin: dashboard, users, users-detail, enrollments, invite-codes, progress
<halaman>/index.html  halaman situs
```

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
- Origin situs harus terdaftar di `ALLOWED_ORIGINS` backend.
