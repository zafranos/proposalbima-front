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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { iconMarkup } from "../assets/js/icons.js";

const OUT = "dist";
const SKIP = new Set(["node_modules", OUT, ".git", ".github", "scripts", "tests", "partials", ".tmp"]);

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

// Bagian <head> bersama (CSP, tema, CSS) disisipkan pada penanda di tiap halaman,
// supaya CSP hanya ditulis di satu tempat.
const HEAD_MARKER = "<!--@head-->";
const headPartial = readFileSync("partials/head.html", "utf8").trimEnd();

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
    } else if (r === "assets/css/input.css" || name === ".DS_Store") {
      continue;
    } else if (r.endsWith(".html") || r.startsWith("assets/")) {
      const dest = join(OUT, r);
      mkdirSync(join(dest, ".."), { recursive: true });
      if ([".html", ".js"].includes(extname(name))) {
        let text = readFileSync(path, "utf8");
        if (name.endsWith(".html")) {
          text = expandIncludes(text.replaceAll(HEAD_MARKER, headPartial));
          if (base) text = text.replace(/(\s(?:href|src))="\/(?!\/)/g, `$1="${base}/`);
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
console.log(`dist/ disusun; API origin = ${origin}; base path = "${base}"`);
