// Pustaka ikon (garis 24px, gaya Lucide, lisensi ISC). Satu sumber data untuk dua pemakai:
//  - ui.js: icon(nama) membangun elemen SVG di peramban
//  - scripts/build-site.mjs: <!--@icon nama | kelas--> disisipi SVG saat build (halaman statis)
// Modul ini hanya berisi data dan fungsi murni, tanpa DOM, sehingga bisa dimuat di Node.

// Setiap ikon: larik bagian. String = path "d"; {rect:[x,y,w,h,rx]}; {circle:[cx,cy,r]}.
export const ICONS = {
  x: ["M18 6 6 18", "m6 6 12 12"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  check: ["M20 6 9 17l-5-5"],
  plus: ["M5 12h14", "M12 5v14"],
  search: [{ circle: [11, 11, 8] }, "m21 21-4.3-4.3"],
  "arrow-right": ["M5 12h14", "m12 5 7 7-7 7"],
  "arrow-up-right": ["M7 7h10v10", "M7 17 17 7"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "chevron-left": ["m15 18-6-6 6-6"],
  lock: ["M7 11V7a5 5 0 0 1 10 0v4", { rect: [3, 11, 18, 11, 2] }],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  copy: ["M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1", { rect: [9, 9, 13, 13, 2] }],
  sun: [{ circle: [12, 12, 4] }, "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  "log-out": ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", { circle: [12, 7, 4] }],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", { circle: [9, 7, 4] }, "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  "user-check": ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", { circle: [9, 7, 4] }, "m16 11 2 2 4-4"],
  info: [{ circle: [12, 12, 10] }, "M12 16v-4", "M12 8h.01"],
  "alert-triangle": ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
  "check-circle": [{ circle: [12, 12, 10] }, "m9 12 2 2 4-4"],
  "book-open": ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"],
  layers: ["m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z", "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65", "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"],
  "list-checks": ["m3 17 2 2 4-4", "m3 7 2 2 4-4", "M13 6h8", "M13 12h8", "M13 18h8"],
  "shield-check": ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "m9 12 2 2 4-4"],
  "file-text": ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M10 9H8", "M16 13H8", "M16 17H8"],
  flask: ["M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2", "M8.5 2h7", "M7 16h10"],
  wrench: ["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"],
  clock: [{ circle: [12, 12, 10] }, "M12 6v6l4 2"],
  hourglass: ["M5 22h14", "M5 2h14", "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22", "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"],
  sparkles: ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z", "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3"],
  highlighter: ["m9 11-6 6v3h9l3-3", "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"],
  "graduation-cap": ["M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z", "M22 10v6", "M6 12.5V16a6 3 0 0 0 12 0v-3.5"],
  calendar: [{ rect: [3, 4, 18, 18, 2] }, "M16 2v4", "M8 2v4", "M3 10h18"],
  target: [{ circle: [12, 12, 10] }, { circle: [12, 12, 6] }, { circle: [12, 12, 2] }],
  home: ["m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
  eye: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0", { circle: [12, 12, 3] }],
  "eye-off": ["M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49", "M14.084 14.158a3 3 0 0 1-4.242-4.242", "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143", "m2 2 20 20"],
  "layout-dashboard": [{ rect: [3, 3, 7, 9, 1] }, { rect: [14, 3, 7, 5, 1] }, { rect: [14, 12, 7, 9, 1] }, { rect: [3, 16, 7, 5, 1] }],
  key: ["m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"],
  "bar-chart": ["M3 3v16a2 2 0 0 0 2 2h16", "M18 17V9", "M13 17V5", "M8 17v-3"],
  "trending-up": ["M16 7h6v6", "m22 7-8.5 8.5-5-5L2 17"],
  "panel-left": [{ rect: [3, 3, 18, 18, 2] }, "M9 3v18"],
  play: ["M6 3 20 12 6 21Z"],
  globe: [{ circle: [12, 12, 10] }, "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20"],
  "chevron-up": ["m18 15-6-6-6 6"],
  trash: ["M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"],
  "rotate-ccw": ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
};

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

// Markup SVG sebagai string (dipakai build untuk halaman statis). Kelas "shrink-0" selalu ada.
export function iconMarkup(name, cls = "size-4") {
  const parts = ICONS[name];
  if (!parts) throw new Error(`ikon tidak dikenal: ${name}`);
  const body = parts.map((p) => {
    if (typeof p === "string") return `<path d="${p}"/>`;
    if (p.rect) { const [x, y, w, h, rx] = p.rect; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`; }
    if (p.circle) { const [cx, cy, r] = p.circle; return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`; }
    throw new Error(`bagian ikon tidak dikenal pada ${name}`);
  }).join("");
  return `<svg ${SVG_ATTRS} class="shrink-0 ${cls}">${body}</svg>`;
}
