// Membuat ikon turunan dari logo sumber assets/img/ZafranOS-logo3.png (1254x1254, 1 MB, berlatar putih):
//   logo-mark.png        128x128  ikon merek di bilah atas, panel admin, dan gambar OG
//   favicon.png           96x96   ikon tab peramban dan hasil pencarian (kelipatan 48 px)
//   apple-touch-icon.png 180x180  ikon layar utama iOS
// Yang diambil hanya lambangnya (bulatan dan spatula): tulisan "ZafranOS" di bawahnya tidak terbaca pada ukuran ikon.
// Lambang diukur dari piksel (batas konten di atas celah putih terbesar sebelum tulisan), lalu hanya bagian itu yang
// digambar ke kanvas putih baru, sehingga tulisan tidak mungkin ikut. Berkas sumber tidak diubah.
//
//   npm run make:logo                    # CHROME_PATH=... bila Chrome tidak di lokasi bawaan macOS
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SOURCE = "assets/img/ZafranOS-logo3.png";
const OUTPUTS = [
  { file: "assets/img/logo-mark.png", size: 128, pad: 0.1 },
  { file: "assets/img/favicon.png", size: 96, pad: 0.03 }, // kelipatan 48 px, ukuran yang disarankan mesin pencari
  { file: "assets/img/apple-touch-icon.png", size: 180, pad: 0.12 },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  const src = "data:image/png;base64," + readFileSync(SOURCE).toString("base64");
  const results = await page.evaluate(async ({ src, outputs }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const probe = document.createElement("canvas");
    probe.width = W; probe.height = H;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    pctx.drawImage(img, 0, 0);
    const px = pctx.getImageData(0, 0, W, H).data;
    // "Tinta" = piksel buram yang tidak putih; piksel transparan (PNG berkanal alfa) bukan tinta.
    const inked = (x, y) => px[(y * W + x) * 4 + 3] > 16 && Math.min(px[(y * W + x) * 4], px[(y * W + x) * 4 + 1], px[(y * W + x) * 4 + 2]) < 235;

    // Baris yang berisi gambar, lalu celah putih terbesar: di atasnya lambang, di bawahnya tulisan.
    const rows = [];
    for (let y = 0; y < H; y++) { let any = false; for (let x = 0; x < W && !any; x++) any = inked(x, y); if (any) rows.push(y); }
    let gapAfter = -1, gapSize = 0;
    for (let i = 0; i < rows.length - 1; i++) if (rows[i + 1] - rows[i] > gapSize) { gapSize = rows[i + 1] - rows[i]; gapAfter = rows[i]; }
    if (gapSize < 5) throw new Error("celah antara lambang dan tulisan tidak ditemukan");
    const top = rows[0], bottom = gapAfter;
    let left = W, right = 0;
    for (let y = top; y <= bottom; y++) for (let x = 0; x < W; x++) if (inked(x, y)) { if (x < left) left = x; if (x > right) right = x; }
    const sw = right - left + 1, sh = bottom - top + 1;
    // Penjaga asumsi (logo bertulisan di bawah lambang): lambang yang terdeteksi harus menempati bagian besar gambar
    // dan kira-kira persegi; kalau tidak, logo sumber berbeda dari yang diasumsikan dan pemotongan tidak boleh diam-diam.
    if (sh < H * 0.5 || sw < W * 0.5 || sw / sh < 0.7 || sw / sh > 1.4) {
      throw new Error(`lambang terdeteksi ${sw}x${sh} px pada gambar ${W}x${H}: tidak sesuai asumsi (lambang di atas, tulisan di bawah); periksa logo sumber atau ubah skrip`);
    }

    // Kecilkan bertahap (setengah-setengah) supaya hasilnya tajam, lalu taruh di tengah kanvas putih persegi.
    let cur = document.createElement("canvas");
    cur.width = sw; cur.height = sh;
    cur.getContext("2d").drawImage(img, left, top, sw, sh, 0, 0, sw, sh);
    const shrink = (canvas, w, h) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(canvas, 0, 0, w, h);
      return c;
    };
    const out = {};
    for (const { file, size, pad } of outputs) {
      const inner = Math.round(size * (1 - 2 * pad));
      const scale = inner / Math.max(sw, sh);
      const tw = Math.max(1, Math.round(sw * scale)), th = Math.max(1, Math.round(sh * scale));
      let c = cur;
      while (c.width / 2 > tw) c = shrink(c, Math.round(c.width / 2), Math.round(c.height / 2));
      c = shrink(c, tw, th);
      const final = document.createElement("canvas");
      final.width = size; final.height = size;
      const f = final.getContext("2d");
      f.fillStyle = "#fff"; f.fillRect(0, 0, size, size);
      f.imageSmoothingEnabled = true; f.imageSmoothingQuality = "high";
      f.drawImage(c, Math.round((size - tw) / 2), Math.round((size - th) / 2));
      out[file] = final.toDataURL("image/png");
    }
    return { box: { left, top, right, bottom, gapAfter, gapSize }, out };
  }, { src, outputs: OUTPUTS });

  console.log("lambang pada", JSON.stringify(results.box));
  for (const [file, uri] of Object.entries(results.out)) {
    writeFileSync(file, Buffer.from(uri.split(",")[1], "base64"));
    console.log(file);
  }
} finally {
  await browser.close();
}
