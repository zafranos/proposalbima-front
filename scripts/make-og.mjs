// Membuat assets/img/og.png (1200x630, pratinjau tautan di media sosial dan hasil pencarian) dari scripts/og.html
// memakai Chrome yang sudah terpasang (playwright-core, tanpa unduhan peramban). Font di-embed sebagai data URI
// dan gambar ditulis langsung ke assets/img, jadi tidak ada berkas sementara. Jalankan ulang bila tampilan berubah:
//
//   npm run make:og                      # CHROME_PATH=... bila Chrome tidak di lokasi bawaan macOS
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const dataUri = (path) => `data:font/woff2;base64,${readFileSync(path).toString("base64")}`;
const html = readFileSync("scripts/og.html", "utf8")
  .replace("__NEWSREADER__", dataUri("node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2"))
  .replace("__LOGO__", "data:image/png;base64," + readFileSync("assets/img/logo-mark.png").toString("base64"))
  .replace("__INTER__", dataUri("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync("assets/img/og.png", await page.screenshot({ type: "png" }));
  console.log("assets/img/og.png dibuat (1200x630)");
} finally {
  await browser.close();
}
