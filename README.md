# Proposal DIKTI: frontend

Situs statis untuk GitHub Pages: Tailwind v4 + Preline UI, HTML biasa, tanpa framework
JS dan tanpa CDN saat runtime. Backend ada di `../gocroot/`. Rancangan lengkap:
`../../.plans/rancangan-webapp-proposal-dikti.md`.

## Status

Tahap 1 (kerangka): build, vendor, CSP, pemeriksa statis, dan satu halaman contoh yang
memanggil `GET /` backend. Halaman masuk, pembaca materi, dan panel admin belum ada
(tahap 5 dan 6).

## Perintah

```bash
npm install
npm run build        # dist/: HTML + assets, CSS Tailwind, vendor Preline dan font
npm run check        # aturan CSP dan tanpa CDN pada dist/ (keluar 1 bila melanggar)
npm run dev          # build lalu sajikan dist/ di http://localhost:5173
```

Backend lokal untuk halaman contoh: lihat `../gocroot/README.md`; `ALLOWED_ORIGINS` harus
memuat `http://localhost:5173`. Origin API default `http://localhost:8080`; ganti dengan
`PDK_API_ORIGIN=http://localhost:18080 npm run build`.

## Aturan yang dijaga

- **CSP lewat tag meta, `script-src 'self'` dan `style-src 'self'`.** Maka semua skrip adalah
  berkas luar (tidak ada `<script>` inline atau `onclick=`), dan markup tidak memakai
  atribut `style=""`. `npm run check` menegakkannya. `__API_ORIGIN__` diganti saat build
  dan muncul di `connect-src` dan `assets/js/config.js` sekaligus.
- **Tanpa CDN.** Font (Inter) dan Preline disalin ke `dist/assets/` oleh `scripts/vendor.mjs`.
- **Tautan berawalan `/`** (mis. `/login/`) mengharuskan situs berada di akar domain: repo
  `<owner>.github.io` atau domain kustom. Situs proyek (`<owner>.github.io/<repo>/`) merusak
  tautan ini.
- **Build produksi menolak origin API kosong** (`PDK_REQUIRE_API_ORIGIN=1` di CI), supaya situs
  tidak terbit menunjuk ke localhost.

## Deploy

`.github/workflows/pages.yml` membangun, memeriksa, dan mengunggah `dist/`. **Belum
pernah dijalankan** (akun GitHub untuk Pages belum ditentukan). Dibutuhkan: variabel repo
`API_BASE_URL` (alamat fungsi GCF) dan Pages diaktifkan dengan sumber "GitHub Actions".
Peringatan npm tentang skrip instal `@parcel/watcher` tidak relevan: paket itu hanya dipakai
mode `--watch` Tailwind, bukan build.
