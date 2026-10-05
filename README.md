# Proposal DIKTI: frontend

Situs statis untuk GitHub Pages: Tailwind v4 + Preline UI, HTML biasa dan modul ES, tanpa framework
JS dan tanpa CDN saat runtime. Backend ada di `../gocroot/`. Rancangan lengkap:
`../../.plans/rancangan-webapp-proposal-dikti.md`.

## Status

Tahap 1 dan 5 selesai: kerangka, halaman masuk/daftar/lupa dan reset kata sandi, lengkapi profil,
pilih dan tambah skema, menunggu persetujuan, profil, dan pembaca materi. Panel admin, landing
yang utuh, serta halaman privasi dan ketentuan menyusul (tahap 6). Tombol "Masuk dengan Google"
belum ada: backend siap, tetapi UI-nya tidak bisa diuji tanpa client ID Google.

## Perintah

```bash
npm install
npm run build        # dist/: HTML + assets, CSS Tailwind, vendor Preline dan font
npm run check        # aturan CSP dan tanpa CDN pada dist/ (keluar 1 bila melanggar)
npm run dev          # build lalu sajikan dist/ di http://localhost:5173
npm run test:e2e     # uji peramban (Chrome terpasang + playwright-core); butuh MongoDB uji, lihat bawah
```

Backend lokal untuk `npm run dev`: lihat `../gocroot/README.md`; `ALLOWED_ORIGINS` harus memuat
`http://localhost:5173`. Origin API default `http://localhost:8080`; ganti dengan
`PDK_API_ORIGIN=http://localhost:18080 npm run build`.

## Uji peramban

```bash
docker run -d --rm --name pdk-mongo-test -p 27018:27017 mongo:7
npm run test:e2e                 # E2E_KEEP=1 menyimpan .tmp/ (tangkapan layar) setelah selesai
```

`tests/e2e/run.mjs` membangun situs, membuat DB uji unik, menyemai admin (`seed-admin`), menyalakan
backend dan situs, menjalankan `tests/e2e/app.test.mjs`, lalu membersihkan semuanya. Berkas sementara
hanya di `.tmp/` (dan `TMPDIR` diarahkan ke sana); `CHROME_PATH` mengganti lokasi Chrome. Yang diuji
termasuk: tanpa pelanggaran CSP di tiap halaman, isi papan klip sama dengan teks kartu, unduhan sama
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
- **Tautan berawalan `/`** mengharuskan situs berada di akar domain: repo `<owner>.github.io` atau domain
  kustom. Situs proyek (`<owner>.github.io/<repo>/`) merusak tautan ini.
- **Build produksi menolak origin API kosong** (`PDK_REQUIRE_API_ORIGIN=1` di CI).
- **Token** disimpan di localStorage dan dikirim sebagai Bearer; 401 membersihkan sesi dan mengalihkan ke
  masuk (kecuali untuk `/login`, `/register`, `/auth/*`); `redirect` dari backend hanya diikuti bila lolos `safePath`.

## Deploy

`.github/workflows/pages.yml` membangun, memeriksa, dan mengunggah `dist/`. **Belum pernah dijalankan.** Akun:
organisasi GitHub `zafranos`; repo situs organisasi harus bernama `zafranos.github.io` (alamat
`https://zafranos.github.io`, di akar domain sehingga tautan berawalan `/` bekerja). Dibutuhkan: variabel repo
`API_BASE_URL` (alamat fungsi GCF, belum ada) dan Pages diaktifkan dengan sumber "GitHub Actions". Peringatan npm tentang skrip instal `@parcel/watcher`
tidak relevan: paket itu hanya dipakai mode `--watch` Tailwind, bukan build.
