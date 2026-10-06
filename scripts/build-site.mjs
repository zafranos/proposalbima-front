// Menyusun dist/: menyalin halaman HTML dan assets/ (kecuali sumber CSS), lalu
// mengganti penanda __API_ORIGIN__ dengan origin API. CSS dibangun terpisah
// oleh `npm run build:css`, dan vendor oleh scripts/vendor.mjs.
//
//   PDK_API_ORIGIN=https://... PDK_BASE_PATH=/nama-repo npm run build
//
// PDK_BASE_PATH = awalan jalur situs: kosong di akar domain atau domain kustom (mis. repo
// <org>.github.io), "/nama-repo" di situs proyek GitHub Pages (<org>.github.io/nama-repo/).
// Atribut href/src berawalan "/" di HTML diberi awalan ini saat build; JS memakai
// config.basePath lewat withBase().
//
// Origin API ikut masuk ke CSP (connect-src) dan ke config.js. Di CI
// (PDK_REQUIRE_API_ORIGIN=1) build gagal bila PDK_API_ORIGIN kosong, supaya
// situs produksi tidak pernah terbit menunjuk ke localhost.
//
// Mesin pencari: hanya halaman yang memakai penanda <!--@head:index--> (landing) boleh diindeks; semua halaman
// lain (<!--@head-->) bertanda noindex. PDK_SITE_URL (mis. https://proposalbima.zafranos.work, tanpa path)
// mengisi __SITE_URL__ pada canonical dan Open Graph serta menghasilkan sitemap.xml dan baris Sitemap di
// robots.txt. Tanpa PDK_SITE_URL, tag yang memerlukan alamat absolut dibuang (alamat relatif tidak sah untuk itu).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
import { iconMarkup } from "../assets/js/icons.js";

// PDK_OUT hanya untuk uji build: build menghapus folder keluarannya, jadi hanya "dist" atau folder di dalam .tmp/ yang boleh.
const OUT = process.env.PDK_OUT || "dist";
if (OUT !== "dist" && !resolve(OUT).startsWith(resolve(".tmp") + sep)) {
  console.error(`PDK_OUT hanya boleh "dist" atau folder di dalam .tmp/, bukan: ${OUT}`);
  process.exit(1);
}
const SKIP = new Set(["node_modules", OUT, ".git", ".github", "scripts", "tests", "partials", ".tmp"]);
// Berkas di assets/ yang hanya bahan sumber: sumber CSS (dibangun terpisah) dan logo asli 1 MB (turunannya dibuat oleh
// scripts/make-logo.mjs).
const UNPUBLISHED = new Set(["assets/css/input.css", "assets/img/ZafranOS-logo3.png"]);

let origin = (process.env.PDK_API_ORIGIN || "").trim().replace(/\/+$/, "");
if (!origin) {
  if (process.env.PDK_REQUIRE_API_ORIGIN === "1") {
    console.error("PDK_API_ORIGIN wajib diisi pada build produksi (mis. https://...run.app).");
    process.exit(1);
  }
  origin = "http://localhost:8080";
}
let base = (process.env.PDK_BASE_PATH || "").trim().replace(/\/+$/, "");
if (!/^(\/[A-Za-z0-9._~-]+)*$/.test(base)) {
  console.error(`PDK_BASE_PATH harus kosong atau berbentuk /nama (tanpa garis miring akhir), bukan: ${base}`);
  process.exit(1);
}

if (!/^https?:\/\/[^\s/]+$/.test(origin)) {
  console.error(`PDK_API_ORIGIN harus berupa origin tanpa path, bukan: ${origin}`);
  process.exit(1);
}

let site = (process.env.PDK_SITE_URL || "").trim().replace(/\/+$/, "");
if (site && !/^https?:\/\/[^\s/]+$/.test(site)) {
  console.error(`PDK_SITE_URL harus berupa origin tanpa path, bukan: ${site}`);
  process.exit(1);
}
// Situs di domain kustom dilayani dari akar (base kosong). Alamat situs berhost kustom bersama base path berarti
// salah konfigurasi (mis. PAGES_BASE_PATH=root terlupa): canonical dan sitemap menunjuk /nama-repo/ yang 404 di
// domain itu, jadi build digagalkan alih-alih menerbitkan alamat yang salah.
if (site && base && !/\.github\.io$/i.test(new URL(site).hostname)) {
  console.error(`PDK_SITE_URL (${site}) berhost kustom tetapi PDK_BASE_PATH="${base}" tidak kosong. Domain kustom dilayani dari akar: kosongkan base path (di CI, variabel repo PAGES_BASE_PATH=root).`);
  process.exit(1);
}
const siteRoot = site ? site + base : ""; // alamat akar aplikasi (situs proyek memuat base path)
const year = String(new Date().getFullYear());

// Bagian <head> bersama (CSP, tema, CSS) disisipkan pada penanda di tiap halaman,
// supaya CSP hanya ditulis di satu tempat. Satu-satunya perbedaan antarvarian adalah meta robots.
const headPartial = readFileSync("partials/head.html", "utf8").trimEnd();
const indexHead = headPartial.replaceAll("__ROBOTS__", "index, follow, max-image-preview:large");
const HEADS = {
  "<!--@head-->": headPartial.replaceAll("__ROBOTS__", "noindex"),
  "<!--@head:index-->": indexHead,
};
// Tanpa alamat situs: tag beralamat absolut dibuang beserta keterangan gambarnya (og:image:*) agar tidak yatim.
const NEEDS_SITE = /^[ \t]*<(?:meta|link)\b[^>]*(?:__SITE_URL__|property="og:image:|name="twitter:card")[^>]*>[ \t]*\r?\n?/gm;

// <!--@include nama--> disisipi isi partials/nama.html (logo, tombol tema, dsb.), sehingga bagian yang
// dipakai banyak halaman ditulis sekali. Partial boleh memuat partial lain (maksimal tiga lapis).
const INCLUDE = /<!--@include ([a-z0-9-]+)-->/g;
// <!--@icon nama | kelas tailwind--> disisipi SVG dari assets/js/icons.js (sumber yang sama dengan icon() di JS).
const ICON = /<!--@icon ([a-z0-9-]+)(?: \| ([^>]*?))?-->/g;
function expandIncludes(text) {
  for (let pass = 0; pass < 3; pass++) {
    const next = text
      .replace(INCLUDE, (_, name) => readFileSync(join("partials", `${name}.html`), "utf8").trimEnd())
      .replace(ICON, (_, name, cls) => iconMarkup(name, cls || "size-4"));
    if (next === text) break;
    text = next;
  }
  return text;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

function walk(dir, rel = "") {
  for (const name of readdirSync(dir)) {
    if (rel === "" && SKIP.has(name)) continue;
    const path = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(path).isDirectory()) {
      walk(path, r);
    } else if (UNPUBLISHED.has(r) || name === ".DS_Store") {
      continue;
    } else if (r.endsWith(".html") || r.startsWith("assets/")) {
      const dest = join(OUT, r);
      mkdirSync(join(dest, ".."), { recursive: true });
      if ([".html", ".js"].includes(extname(name))) {
        let text = readFileSync(path, "utf8");
        if (name.endsWith(".html")) {
          for (const [marker, head] of Object.entries(HEADS)) text = text.replaceAll(marker, head);
          text = expandIncludes(text);
          if (base) text = text.replace(/(\s(?:href|src))="\/(?!\/)/g, `$1="${base}/`);
          text = (siteRoot ? text.replaceAll("__SITE_URL__", siteRoot) : text.replace(NEEDS_SITE, "")).replaceAll("__YEAR__", year);
        }
        writeFileSync(dest, text.replaceAll("__API_ORIGIN__", origin).replaceAll("__BASE_PATH__", base));
      } else {
        cpSync(path, dest);
      }
    }
  }
}
walk(".");
for (const f of ["CNAME", ".nojekyll"]) if (existsSync(f)) cpSync(f, join(OUT, f));

// robots.txt mengizinkan semuanya: halaman non-landing dijaga noindex, dan noindex hanya terbaca bila halamannya
// boleh diambil perayap (memblokirnya di sini justru dapat membuat alamatnya tetap tampil tanpa isi).
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n${siteRoot ? `\nSitemap: ${siteRoot}/sitemap.xml\n` : ""}`);
if (siteRoot) {
  const lastmod = new Date().toISOString().slice(0, 10);
  writeFileSync(join(OUT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteRoot}/</loc><lastmod>${lastmod}</lastmod></url>\n</urlset>\n`);
}
console.log(`${OUT}/ disusun; API origin = ${origin}; base path = "${base}"; situs = ${siteRoot || "(tanpa PDK_SITE_URL)"}`);
