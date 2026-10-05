// Pemeriksa statis untuk dist/ (kriteria penerimaan frontend):
//  - tanpa <script> inline, handler on*=, atau atribut style="" di markup
//    (CSP script-src 'self' / style-src 'self' memblokirnya)
//  - tanpa rujukan CDN atau font pihak ketiga
//  - setiap halaman punya meta CSP tanpa 'unsafe-inline' dan tanpa 'unsafe-eval'
// Keluar 1 bila ada pelanggaran.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = "dist";
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
  if (!csp) problems.push(`${f}: tanpa meta CSP`);
  else {
    if (/unsafe-inline|unsafe-eval/.test(csp[1])) problems.push(`${f}: CSP memuat unsafe-*`);
    if (!/script-src 'self'/.test(csp[1])) problems.push(`${f}: CSP tanpa script-src 'self'`);
    if (html.includes("<!--@head-->")) problems.push(`${f}: penanda <!--@head--> belum diganti`);
  if (/__API_ORIGIN__/.test(html)) problems.push(`${f}: penanda __API_ORIGIN__ belum diganti`);
  }
}
if (problems.length) {
  console.error(`GAGAL (${problems.length}):\n  - ` + problems.join("\n  - "));
  process.exit(1);
}
console.log(`OK: ${htmlFiles.length} halaman HTML memenuhi aturan CSP dan tanpa CDN`);
