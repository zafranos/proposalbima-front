// Pembantu bersama halaman admin: kelas gaya, tabel, bidang formulir, status di URL, dan daftar skema.
// Semua DOM dibangun dengan h() (createElement/textContent), tanpa innerHTML.
import * as api from "../api.js";
import * as auth from "../auth.js";
import { h, icon, scrollRegion } from "../ui.js";
import { renderAdminNav } from "./nav.js";

// Kelas komponen terpusat (lihat @layer components di input.css).
export const INPUT = "input";
export const BTN = "btn btn-outline btn-sm";
export const BTN_PRIMARY = "btn btn-primary";
export const BTN_DANGER = "btn btn-danger btn-sm";
export const BTN_DANGER_SOLID = "btn btn-danger-solid";
export const CARD = "card";
export const LINK = "link";

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
    h("label", { for: id, class: "label", text: label }),
    control,
    hint ? h("p", { id: id + "-hint", class: "hint", text: hint }) : null);
}

// options: [[nilai, teks], ...]
export function select(options, value, attrs = {}) {
  const el = h("select", { class: "select", ...attrs }, options.map(([v, t]) => h("option", { value: v, text: t })));
  if (value != null) el.value = value;
  return el;
}

// ── Tabel ──
// columns: [teks, ...]; rows: larik baris, tiap baris larik sel (simpul atau teks).
// Pembungkus yang dapat digulir wajib fokus-able dan berlabel (aksesibilitas gulir keyboard).
export function table(label, columns, rows) {
  return scrollRegion(h("div", { class: "card overflow-x-auto" },
    h("table", { class: "tbl" },
      h("caption", { class: "sr-only", text: label }),
      h("thead", {}, h("tr", {}, columns.map((c) => h("th", { scope: "col", text: c })))),
      h("tbody", {}, rows.map((r) => h("tr", {}, r.map((cell) => h("td", {}, cell))))))), label);
}

// ico: "search" untuk hasil pencarian kosong; "check-circle" untuk kosong yang menggembirakan (mis. antrean bersih).
export function emptyState(text, ico = "search") {
  return h("div", { class: "rounded-2xl border border-dashed border-line-3 px-6 py-14 text-center" },
    h("span", { class: "mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground-1" }, icon(ico, "size-5")),
    h("p", { class: "mt-4 text-sm text-muted-foreground-1", text }));
}

export function errorState(message, retry) {
  return h("div", { role: "alert", class: "alert alert-error flex flex-wrap items-center gap-3" },
    h("span", { text: message }),
    retry ? h("button", { type: "button", class: BTN, on: { click: retry }, text: "Coba lagi" }) : null);
}

export function loadingState(text = "Memuat...") {
  return h("p", { role: "status", class: "py-6 text-sm text-muted-foreground-1", text });
}

// Avatar inisial: warna dipilih dari nama sehingga orang yang sama selalu berwarna sama.
const AVATAR_TONES = [
  "bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-100",
  "bg-marker-soft text-marker-ink",
  "bg-muted text-foreground",
];
export function avatar(name, size = "size-9") {
  const words = String(name || "?").trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0] || "?")[0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return h("span", { class: `grid ${size} shrink-0 place-items-center rounded-full text-xs font-semibold ${AVATAR_TONES[hash % AVATAR_TONES.length]}`, "aria-hidden": "true", text: initials });
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
