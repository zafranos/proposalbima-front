// Pembungkus Chart.js (di-vendor sebagai window.Chart lewat <script src> terpisah). Warna dibaca dari token tema
// (assets/css/themes/tinta.css) setiap kali digambar, dan grafik digambar ulang saat tema berganti (canvas tidak ikut
// berubah lewat CSS). Tanpa animasi: menghormati preferensi gerak berkurang dan membuat uji stabil.

const live = new Set();

// Nilai token CSS (mis. "--primary-600") sebagai string warna yang dipahami canvas.
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Palet semantik grafik untuk tema aktif. Terang: deret gelap di atas kartu putih; gelap: deret terang di atas kartu
// gelap, sehingga tiap deret tetap >= 3:1 terhadap kartu (WCAG 1.4.11).
function palette(dark) {
  return {
    pending: token("--chart-marker"),
    trial: token(dark ? "--primary-300" : "--primary-500"),
    approved: token(dark ? "--primary-500" : "--primary-800"),
    active: token(dark ? "--primary-400" : "--primary-600"),
    neutral: token("--border-line-4"),
    danger: token("--destructive"),
  };
}

function themeColors() {
  const dark = document.documentElement.classList.contains("dark");
  return { text: getComputedStyle(document.body).color, grid: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)", dark, c: palette(dark) };
}

// build(tema) mengembalikan konfigurasi Chart.js; tema.c adalah palet semantik. Mengembalikan null bila Chart.js
// tidak termuat (halaman tetap menyajikan angkanya lewat tabel atau kartu).
export function makeChart(canvas, build) {
  if (!window.Chart) return null;
  const entry = { canvas, chart: null };
  entry.draw = () => {
    entry.chart?.destroy();
    const t = themeColors();
    window.Chart.defaults.color = t.text;
    window.Chart.defaults.borderColor = t.grid;
    window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    const cfg = build(t);
    cfg.options = { responsive: true, maintainAspectRatio: false, animation: false, ...cfg.options };
    entry.chart = new window.Chart(canvas, cfg);
  };
  entry.draw();
  live.add(entry);
  return entry;
}

// Membuang grafik yang tidak dipakai lagi (mis. sebelum halaman menggambar ulang dengan data baru).
export function disposeChart(entry) {
  if (!entry) return;
  entry.chart?.destroy();
  live.delete(entry);
}

document.addEventListener("pdk:theme", () => {
  for (const e of live) {
    if (e.canvas.isConnected) e.draw();
    else live.delete(e);
  }
});
