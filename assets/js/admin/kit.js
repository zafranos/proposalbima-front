// Pembantu bersama halaman admin: kelas gaya, tabel, bidang formulir, status di URL, dan daftar skema.
// Semua DOM dibangun dengan h() (createElement/textContent), tanpa innerHTML.
import * as api from "../api.js";
import * as auth from "../auth.js";
import { h } from "../ui.js";
import { renderAdminNav } from "./nav.js";

export const INPUT = "block w-full rounded-lg border border-line-3 bg-layer px-3 py-2 text-sm text-layer-foreground placeholder:text-muted-foreground-1 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50";
export const BTN = "inline-flex items-center justify-center gap-2 rounded-lg border border-line-2 bg-layer px-3 py-1.5 text-sm font-medium hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary-focus disabled:opacity-50";
export const BTN_PRIMARY = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 disabled:opacity-50";
export const BTN_DANGER = "inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-950";
export const BTN_DANGER_SOLID = "inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50";
export const CARD = "rounded-xl border border-layer-line bg-layer shadow-sm";
export const LINK = "font-medium text-primary-700 hover:underline dark:text-primary-300";

// Halaman admin dimulai dengan ini: memastikan peran admin lalu memasang navigasi. false = halaman berpindah.
export async function startAdmin(active) {
  if (!(await auth.requireAdmin())) return false;
  renderAdminNav(active);
  return true;
}

// ── Bidang formulir ──
export function field(id, label, control, hint) {
  control.id = id;
  if (hint) control.setAttribute("aria-describedby", id + "-hint");
  return h("div", {},
    h("label", { for: id, class: "mb-1.5 block text-sm font-medium", text: label }),
    control,
    hint ? h("p", { id: id + "-hint", class: "mt-1 text-xs text-muted-foreground-1", text: hint }) : null);
}

// options: [[nilai, teks], ...]
export function select(options, value, attrs = {}) {
  const el = h("select", { class: INPUT, ...attrs }, options.map(([v, t]) => h("option", { value: v, text: t })));
  if (value != null) el.value = value;
  return el;
}

// ── Tabel ──
// columns: [teks, ...]; rows: larik baris, tiap baris larik sel (simpul atau teks).
// Pembungkus yang dapat digulir wajib fokus-able dan berlabel (aksesibilitas gulir keyboard).
export function table(label, columns, rows) {
  return h("div", { class: "overflow-x-auto rounded-xl border border-layer-line bg-layer", tabindex: "0", role: "region", "aria-label": label },
    h("table", { class: "min-w-full divide-y divide-table-line text-sm" },
      h("caption", { class: "sr-only", text: label }),
      h("thead", { class: "bg-muted" }, h("tr", {}, columns.map((c) =>
        h("th", { scope: "col", class: "whitespace-nowrap px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground-1", text: c })))),
      h("tbody", { class: "divide-y divide-table-line" }, rows.map((r) =>
        h("tr", {}, r.map((cell) => h("td", { class: "px-4 py-3 align-top" }, cell)))))));
}

export function emptyState(text) {
  return h("p", { class: "rounded-xl border border-dashed border-line-3 px-4 py-10 text-center text-sm text-muted-foreground-1", text });
}

export function errorState(message, retry) {
  return h("div", { role: "alert", class: "flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100" },
    h("span", { text: message }),
    retry ? h("button", { type: "button", class: BTN, on: { click: retry }, text: "Coba lagi" }) : null);
}

export function loadingState(text = "Memuat...") {
  return h("p", { role: "status", class: "py-6 text-sm text-muted-foreground-1", text });
}

// ── Status di URL (dapat dibagikan, tombol kembali tetap benar) ──
export function readQuery(defaults) {
  const p = new URLSearchParams(location.search);
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) if (p.has(k)) out[k] = p.get(k);
  return out;
}

export function writeQuery(values, defaults) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== "" && v != null && v !== defaults[k]) p.set(k, v);
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Daftar skema (publik; dipakai untuk pilihan dan judul) ──
let skemaCache;
export async function loadSkema() {
  if (!skemaCache) {
    const res = await api.get("/api/skema");
    skemaCache = res.skema.map((s) => ({ slug: s.slug, judul: s.judul }));
  }
  return skemaCache;
}
export const skemaTitle = (list, slug) => (list.find((s) => s.slug === slug) || {}).judul || slug;

// Tautan internal bawaan situs (awalan situs ditambahkan di sini).
export function link(path, text, cls = LINK) {
  return h("a", { href: api.withBase(path), class: cls, text });
}

// Tanggal tanpa jam, atau tanda strip bila kosong.
export function orDash(text) { return text || "—"; }
