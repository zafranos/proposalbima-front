// Menyusun dist/: menyalin halaman HTML dan assets/ (kecuali sumber CSS), lalu
// mengganti penanda __API_ORIGIN__ dengan origin API. CSS dibangun terpisah
// oleh `npm run build:css`, dan vendor oleh scripts/vendor.mjs.
//
//   PDK_API_ORIGIN=https://... npm run build
//
// Origin API ikut masuk ke CSP (connect-src) dan ke config.js. Di CI
// (PDK_REQUIRE_API_ORIGIN=1) build gagal bila PDK_API_ORIGIN kosong, supaya
// situs produksi tidak pernah terbit menunjuk ke localhost.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";

const OUT = "dist";
const SKIP = new Set(["node_modules", OUT, ".git", ".github", "scripts"]);

let origin = (process.env.PDK_API_ORIGIN || "").trim().replace(/\/+$/, "");
if (!origin) {
  if (process.env.PDK_REQUIRE_API_ORIGIN === "1") {
    console.error("PDK_API_ORIGIN wajib diisi pada build produksi (mis. https://...run.app).");
    process.exit(1);
  }
  origin = "http://localhost:8080";
}
if (!/^https?:\/\/[^\s/]+$/.test(origin)) {
  console.error(`PDK_API_ORIGIN harus berupa origin tanpa path, bukan: ${origin}`);
  process.exit(1);
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
        writeFileSync(dest, readFileSync(path, "utf8").replaceAll("__API_ORIGIN__", origin));
      } else {
        cpSync(path, dest);
      }
    }
  }
}
walk(".");
for (const f of ["CNAME", ".nojekyll"]) if (existsSync(f)) cpSync(f, join(OUT, f));
console.log(`dist/ disusun; API origin = ${origin}`);
