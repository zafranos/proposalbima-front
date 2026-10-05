// Menyalin bundel pihak ketiga dari node_modules ke dist/assets/ supaya halaman
// memuatnya dari origin sendiri (tanpa CDN dan tanpa bundler).
import { cpSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const COPIES = [
  ["node_modules/chart.js/dist/chart.umd.min.js", "dist/assets/js/vendor/chart.umd.js"],
  ["node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", "dist/assets/fonts/inter-latin-wght-normal.woff2"],
  ["node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2", "dist/assets/fonts/inter-latin-ext-wght-normal.woff2"],
  ["node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2", "dist/assets/fonts/newsreader-latin-opsz-normal.woff2"],
  ["node_modules/@fontsource-variable/newsreader/files/newsreader-latin-ext-opsz-normal.woff2", "dist/assets/fonts/newsreader-latin-ext-opsz-normal.woff2"],
];
for (const [src, dest] of COPIES) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  console.log(`vendor: ${src} -> ${dest}`);
}
