# Proposal DIKTI: frontend

Situs statis untuk GitHub Pages: Tailwind v4 + Preline UI, HTML biasa dan modul ES, tanpa framework
JS dan tanpa CDN saat runtime. Situs ini hanya antarmuka: akun, pilihan skema, dan materi disajikan oleh
API backend (Go + MongoDB, repo terpisah), dan semua materi berada di balik login.

## Cakupan

Halaman masuk, daftar, lupa dan reset kata sandi, lengkapi profil, pilih dan tambah skema, menunggu
persetujuan, profil, dan pembaca materi (daftar isi, tab, kartu salin, unduhan, progres). Belum tersedia:
panel admin, halaman privasi dan ketentuan, serta tombol "Masuk dengan Google" (backend mendukungnya, UI
menunggu client ID).

## Perintah

```bash
npm install
npm run build        # dist/: HTML + assets, CSS Tailwind, vendor Preline dan font
npm run check        # aturan CSP dan tanpa CDN pada dist/ (keluar 1 bila melanggar)
npm run dev          # build lalu sajikan dist/ di http://localhost:5173
npm run test:e2e     # uji peramban (Chrome terpasang + playwright-core); butuh backend dan MongoDB uji
npm run test:e2e:subpath   # sama, tetapi situs disajikan di /proposalbima-front (mode situs proyek)
```

`npm run dev` membutuhkan backend yang berjalan; `ALLOWED_ORIGINS` backend harus memuat
`http://localhost:5173`. Origin API bawaan `http://localhost:8080`; ganti dengan
`PDK_API_ORIGIN=http://localhost:18080 npm run build`.

## Uji peramban

Uji ini menjalankan backend sungguhan, jadi butuh checkout repo backend di folder sejajar bernama
`../gocroot` dan MongoDB uji:

```bash
docker run -d --rm --name pdk-mongo-test -p 27018:27017 mongo:7
npm run test:e2e                 # E2E_KEEP=1 menyimpan .tmp/ (tangkapan layar) setelah selesai
```

`tests/e2e/run.mjs` membangun situs, membuat database uji unik, menyemai akun admin uji, menyalakan
backend dan situs, menjalankan `tests/e2e/app.test.mjs`, lalu membersihkan semuanya. Berkas sementara
hanya di `.tmp/` (dan `TMPDIR` diarahkan ke sana); `CHROME_PATH` mengganti lokasi Chrome. Yang diuji
termasuk: kedua mode (akar dan subpath), semua tautan internal berawalan situs, tanpa pelanggaran CSP di tiap halaman, isi papan klip sama dengan teks kartu, unduhan sama
dengan sumber, laci sidebar di 375 px benar-benar masuk layar, rantai pengalihan 409, dan axe (WCAG 2
A/AA) pada terang dan gelap.

## Struktur

```
partials/head.html    <head> bersama (CSP, tema, CSS), disisipkan build pada <!--@head-->
assets/js/            config, session, api, auth, ui (h, icon, toast, mount), common (tema, keluar)
assets/js/pages/      satu modul per halaman
assets/js/reader/     enhance (kartu, sorotan penanda, tabel, unduhan), toc (scrollspy), tabs (ARIA)
<halaman>/index.html  login, register, forgot-password, reset-password, profile-complete,
                      select-skema, enroll, pending-approval, profile, modul (pembaca)
```

## Aturan yang dijaga

- **CSP lewat tag meta, `script-src 'self'` dan `style-src 'self'`.** Semua skrip adalah berkas luar (tanpa
  `<script>` inline atau `onclick=`) dan markup tidak memakai `style=""`. Progres memakai elemen `<progress>`,
  bukan lebar gaya inline. `npm run check` menegakkannya dan uji peramban menangkap pelanggaran di konsol.
- **DOM dibangun dengan `createElement` dan `textContent`**, tanpa `innerHTML`, kecuali isi materi dari
  backend yang sudah dirender dan dilint. Gunakan `mount(el, ...)` dari `ui.js`, bukan `replaceChildren`
  mentah: yang terakhir mengubah argumen `null` menjadi teks "null".
- **Tanpa CDN.** Font (Inter) dan Preline disalin ke `dist/assets/` oleh `scripts/vendor.mjs`.
- **Base path.** Situs proyek GitHub Pages dilayani di `/nama-repo/`, jadi jalur internal ditulis relatif
  terhadap akar aplikasi (`/login/`) dan awalan situs ditambahkan di satu tempat: build (`PDK_BASE_PATH`)
  untuk HTML, `withBase()` dan `go()` di `api.js` untuk JS, dan `enhance.js` untuk tautan di isi materi.
  `PDK_BASE_PATH` kosong = akar domain atau domain kustom. `npm run check` (dengan `PDK_BASE_PATH` yang sama)
  menolak `href`/`src` tanpa awalan. Gunakan `api.go()`, `api.goReplace()`, dan `api.withBase()`, jangan
  `location.assign("/...")` atau `href: "/..."` mentah.
- **Build produksi menolak origin API kosong** (`PDK_REQUIRE_API_ORIGIN=1` di CI).
- **Token** disimpan di localStorage dan dikirim sebagai Bearer; 401 membersihkan sesi dan mengalihkan ke
  masuk (kecuali untuk `/login`, `/register`, `/auth/*`); `redirect` dari backend hanya diikuti bila lolos `safePath`.

## Deploy

`.github/workflows/pages.yml` membangun, memeriksa (`npm run check`), dan mengunggah `dist/` ke GitHub Pages.
Yang dibutuhkan:

- Pages diaktifkan dengan sumber "GitHub Actions".
- Variabel repo `API_BASE_URL`: alamat API backend tanpa path. Selama kosong, deploy dilewati (bukan gagal).
- Base path dihitung dari nama repo (`/nama-repo`; repo `<org>.github.io` dilayani di akar). Variabel repo
  `PAGES_BASE_PATH` menimpa; nilai `root` = akar domain, dipakai bila Pages memakai domain kustom.
- Origin situs harus terdaftar di `ALLOWED_ORIGINS` backend (CORS), dan `FRONTEND_BASE_URL` backend harus
  menunjuk ke alamat situs ini (dipakai untuk tautan di email reset kata sandi).

Peringatan npm tentang skrip instal `@parcel/watcher` tidak relevan: paket itu hanya dipakai mode `--watch`
Tailwind, bukan build.
