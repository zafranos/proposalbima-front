// Pemeriksa statis untuk dist/ (kriteria penerimaan frontend):
//  - tanpa <script> inline, handler on*=, atau atribut style="" di markup
//    (CSP script-src 'self' / style-src 'self' memblokirnya)
//  - tanpa rujukan CDN atau font pihak ketiga
//  - setiap halaman punya meta CSP tanpa 'unsafe-inline' dan tanpa 'unsafe-eval'
//  - semua penanda build (@head, @include, @icon, __API_ORIGIN__, __SITE_URL__, __YEAR__) sudah terganti
//  - bila PDK_BASE_PATH diisi, setiap href/src berawalan "/" memuat awalan situs itu
//  - hanya landing yang boleh diindeks mesin pencari; halaman lain wajib noindex
//  - teks publik tidak memuat kata "gratis" (merusak kepercayaan)
//  - bidang yang dapat disunting di landing (data-edit/data-list) sama persis dengan skema editor admin,
//    dan teks bawaannya muat dalam batas panjang bidang
// Keluar 1 bila ada pelanggaran.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ALL_FIELDS, ALL_LISTS } from "../assets/js/landing/schema.js";

const DIR = "dist";
const LANDING = join(DIR, "index.html");
const BASE = (process.env.PDK_BASE_PATH || "").trim().replace(/\/+$/, "");
const problems = [];
const htmlFiles = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith(".html")) htmlFiles.push(p);
  }
})(DIR);

if (htmlFiles.length === 0) problems.push("tidak ada HTML di dist/ (jalankan npm run build)");

for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\bsrc\s*=/.test(m[1])) problems.push(`${f}: <script> inline`);
  }
  if (/\son[a-z]+\s*=/i.test(html)) problems.push(`${f}: handler on*= inline`);
  if (/\sstyle\s*=/i.test(html)) problems.push(`${f}: atribut style=""`);
  if (/<style\b/i.test(html)) problems.push(`${f}: <style> inline`);
  if (/googleapis|gstatic|cdn\.|cdnjs|unpkg|jsdelivr/i.test(html)) problems.push(`${f}: rujukan CDN/pihak ketiga`);

  const csp = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i);
  if (!csp) {
    problems.push(`${f}: tanpa meta CSP`);
  } else {
    const policy = csp[1];
    // Tidak ada kelonggaran pihak ketiga di halaman mana pun.
    if (/frame-src/i.test(policy)) problems.push(`${f}: CSP memuat kelonggaran pihak ketiga`);
    if (!/<meta name="color-scheme"/.test(html)) problems.push(`${f}: tanpa meta color-scheme`);
    if (/unsafe-inline|unsafe-eval/.test(policy)) problems.push(`${f}: CSP memuat unsafe-*`);
    if (!/script-src 'self'/.test(policy)) problems.push(`${f}: CSP tanpa script-src 'self'`);
  }

  // Aset yang dirujuk halaman harus ada (mis. ikon, gambar, skrip); rujukan menggantung baru ketahuan di peramban.
  for (const m of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    if (m[1].startsWith("//") || !/\.[a-z0-9]+$/i.test(m[1])) continue; // hanya berkas, bukan alamat halaman
    const rel = BASE && m[1].startsWith(BASE + "/") ? m[1].slice(BASE.length) : m[1];
    if (!existsSync(join(DIR, rel))) problems.push(`${f}: aset tidak ada di dist/: ${m[1]}`);
  }

  if (BASE) {
    for (const m of html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      const ok = m[1] === BASE || m[1].startsWith(BASE + "/") || m[1].startsWith(BASE + "?") || m[1].startsWith(BASE + "#");
      if (!ok) problems.push(`${f}: tautan tanpa awalan situs ${BASE}: ${m[1]}`);
    }
  }

  if (/<!--@head(?::index)?-->/.test(html)) problems.push(`${f}: penanda <!--@head--> belum diganti`);
  if (/<!--@(include|icon) /.test(html)) problems.push(`${f}: penanda <!--@include/@icon ...--> belum diganti`);
  if (/__(API_ORIGIN|SITE_URL|YEAR|ROBOTS)__/.test(html)) problems.push(`${f}: penanda __...__ belum diganti`);

  const robots = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1];
  if (robots === undefined) problems.push(`${f}: tanpa meta robots`);
  else if (f === LANDING ? !/^index, follow/.test(robots) : robots !== "noindex") problems.push(`${f}: meta robots "${robots}" (hanya landing yang boleh diindeks)`);

  if (/gratis/i.test(html)) problems.push(`${f}: memuat kata "gratis"`);
}

// Dengan PDK_SITE_URL (CI produksi): canonical, Open Graph, robots.txt, dan sitemap.xml harus terisi benar.
const SITE = (process.env.PDK_SITE_URL || "").trim().replace(/\/+$/, "");
if (SITE && htmlFiles.includes(LANDING)) {
  const root = SITE + BASE;
  const html = readFileSync(LANDING, "utf8");
  for (const want of [`<link rel="canonical" href="${root}/">`, `<meta property="og:url" content="${root}/">`, `<meta property="og:image" content="${root}/assets/img/og.png">`]) {
    if (!html.includes(want)) problems.push(`${LANDING}: tidak memuat ${want}`);
  }
  try {
    if (!readFileSync(join(DIR, "robots.txt"), "utf8").includes(`Sitemap: ${root}/sitemap.xml`)) problems.push("robots.txt tanpa baris Sitemap");
    if (!readFileSync(join(DIR, "sitemap.xml"), "utf8").includes(`<loc>${root}/</loc>`)) problems.push("sitemap.xml tanpa alamat landing");
  } catch { problems.push("robots.txt atau sitemap.xml tidak ada di dist/"); }
}

// Landing: bidang yang dapat disunting harus sama dengan skema editor admin.
if (htmlFiles.includes(LANDING)) {
  const html = readFileSync(LANDING, "utf8");
  const collapse = (s) => s.replace(/\s+/g, " ").trim();
  const edits = new Map();
  // Isi elemen yang disunting harus teks polos: textContent menghapus anak elemen, jadi anak elemen (ikon, tautan)
  // di dalamnya akan hilang begitu admin menyunting.
  for (const m of html.matchAll(/data-edit="([^"]+)"[^>]*>([^<]*)<(\/?)/g)) {
    if (edits.has(m[1])) problems.push(`${LANDING}: data-edit ganda: ${m[1]}`);
    if (m[3] !== "/") problems.push(`${LANDING}: data-edit="${m[1]}" memuat elemen anak; harus teks polos`);
    edits.set(m[1], collapse(m[2]));
  }
  const schemaFields = new Map(ALL_FIELDS.map((f) => [f.path, f]));
  for (const [path, text] of edits) {
    const def = schemaFields.get(path);
    if (!def) problems.push(`${LANDING}: data-edit="${path}" tidak ada di skema (assets/js/landing/schema.js)`);
    else if (text.length > def.max) problems.push(`${LANDING}: teks bawaan ${path} ${text.length} karakter, batas ${def.max}`);
    else if (!text) problems.push(`${LANDING}: teks bawaan ${path} kosong`);
  }
  for (const path of schemaFields.keys()) if (!edits.has(path)) problems.push(`skema memuat ${path} tetapi ${LANDING} tidak punya data-edit itu`);

  const lists = [...html.matchAll(/data-list="([^"]+)"/g)].map((m) => m[1]);
  const schemaLists = new Map(ALL_LISTS.map((l) => [l.path, l]));
  for (const path of lists) if (!schemaLists.has(path)) problems.push(`${LANDING}: data-list="${path}" tidak ada di skema`);
  for (const path of schemaLists.keys()) if (!lists.includes(path)) problems.push(`skema memuat daftar ${path} tetapi ${LANDING} tidak punya data-list itu`);
  // Butir daftar diperiksa per daftar: tiap data-field milik daftar terdekat di atasnya (daftar tidak bersarang).
  const listPos = [...html.matchAll(/data-list="([^"]+)"/g)].map((m) => ({ path: m[1], at: m.index }));
  const owned = new Map(listPos.map((l) => [l.path, []]));
  for (const m of html.matchAll(/data-field="([^"]+)"[^>]*>([^<]*)<(\/?)/g)) {
    const owner = [...listPos].reverse().find((l) => l.at < m.index);
    if (!owner) { problems.push(`${LANDING}: data-field="${m[1]}" di luar data-list`); continue; }
    if (m[3] !== "/") problems.push(`${LANDING}: data-field="${m[1]}" pada ${owner.path} memuat elemen anak; harus teks polos`);
    owned.get(owner.path).push({ key: m[1], text: collapse(m[2]) });
  }
  for (const [path, found] of owned) {
    const def = schemaLists.get(path);
    if (!def) continue; // sudah dilaporkan di atas
    const keyDefs = new Map(def.keys.map((k) => [k.key, k]));
    const items = found.filter((f) => f.key === def.keys[0].key).length;
    if (items === 0) problems.push(`${LANDING}: daftar ${path} tidak punya butir bawaan`);
    if (items > def.max) problems.push(`${LANDING}: daftar ${path} punya ${items} butir bawaan, batas ${def.max}`);
    for (const f of found) {
      const k = keyDefs.get(f.key);
      if (!k) problems.push(`${LANDING}: data-field="${f.key}" tidak ada di skema daftar ${path}`);
      else if (f.text.length > k.max) problems.push(`${LANDING}: ${path}.${f.key} ${f.text.length} karakter, batas ${k.max}`);
      else if (!f.text && !k.optional) problems.push(`${LANDING}: ${path}.${f.key} wajib terisi tetapi kosong`);
    }
    // Setiap butir (termasuk cetakan: butir pertama) memuat semua kunci, kalau tidak butir hasil kloning kehilangan elemennya.
    for (const k of def.keys) {
      const n = found.filter((f) => f.key === k.key).length;
      if (n !== items) problems.push(`${LANDING}: ${path}: kunci "${k.key}" ada di ${n} dari ${items} butir bawaan`);
    }
  }
}
if (problems.length) {
  console.error(`GAGAL (${problems.length}):\n  - ` + problems.join("\n  - "));
  process.exit(1);
}
console.log(`OK: ${htmlFiles.length} halaman HTML memenuhi aturan CSP dan tanpa CDN`);
