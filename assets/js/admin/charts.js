// Pembungkus Chart.js (di-vendor sebagai window.Chart lewat <script src> terpisah). Warna teks dan garis
// mengikuti tema, dan grafik digambar ulang saat tema berganti (canvas tidak ikut berubah lewat CSS).
// Tanpa animasi: menghormati preferensi gerak berkurang dan membuat uji stabil.

export const COLORS = { teal: "#0f766e", sky: "#0284c7", amber: "#d97706", slate: "#94a3b8", red: "#b91c1c" };

const live = new Set();

function themeColors() {
  const dark = document.documentElement.classList.contains("dark");
  return { text: getComputedStyle(document.body).color, grid: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)", dark };
}

// build(tema) mengembalikan konfigurasi Chart.js. Mengembalikan null bila Chart.js tidak termuat
// (halaman tetap menyajikan angkanya lewat tabel atau kartu).
export function makeChart(canvas, build) {
  if (!window.Chart) return null;
  const entry = { canvas, chart: null };
  entry.draw = () => {
    entry.chart?.destroy();
    const t = themeColors();
    window.Chart.defaults.color = t.text;
    window.Chart.defaults.borderColor = t.grid;
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
