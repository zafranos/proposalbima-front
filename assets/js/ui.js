// Pembantu UI. Semua DOM dibangun dengan createElement dan textContent (tanpa innerHTML),
// kecuali isi materi dari server yang sudah dirender dan dilint di backend.
import { ICONS } from "./icons.js";

// h("div", {class: "x", "aria-label": "y", on: {click: fn}, data: {k: "v"}, text: "teks"}, ...anak)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "data") for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Pengganti replaceChildren untuk anak yang bisa null/false/undefined (replaceChildren mentah
// mengubah null menjadi teks "null"). Menerima larik bersarang.
export function mount(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

// ── Ikon: data ada di icons.js (dipakai bersama build statis). Dibuat sebagai elemen SVG, bukan string. ──
const SVG_NS = "http://www.w3.org/2000/svg";

export function icon(name, cls = "size-4") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "shrink-0 " + cls);
  for (const part of ICONS[name] || []) {
    if (typeof part === "string") {
      const p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", part);
      svg.append(p);
    } else if (part.rect) {
      const [x, y, w, hh, rx] = part.rect;
      const r = document.createElementNS(SVG_NS, "rect");
      for (const [k, v] of Object.entries({ x, y, width: w, height: hh, rx })) r.setAttribute(k, v);
      svg.append(r);
    } else if (part.circle) {
      const [cx, cy, rr] = part.circle;
      const c = document.createElementNS(SVG_NS, "circle");
      for (const [k, v] of Object.entries({ cx, cy, r: rr })) c.setAttribute(k, v);
      svg.append(c);
    }
  }
  return svg;
}

// Tanda merek (huruf P dengan garis stabilo di bawahnya), padanan partials/logo.html untuk komponen yang dibangun JS.
export function logoMark(cls = "brand-mark") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", cls);
  const add = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  };
  add("rect", { width: 32, height: 32, rx: 9, class: "fill-primary" });
  add("path", { class: "fill-white", "fill-rule": "evenodd", d: "M10 6h6.4a5.6 5.6 0 0 1 0 11.2H13.5v5.3H10zM13.5 9.1h2.7a2.5 2.5 0 0 1 0 5h-2.7z" });
  add("rect", { x: 8, y: 24.4, width: 16, height: 3, rx: 1.5, class: "fill-marker-strong" });
  return svg;
}

// Pesan dari backend diawali huruf kecil; di UI diawali huruf kapital.
export function sentence(msg) {
  const t = String(msg || "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

// ── Toast ──
// Wadah aria-live dibuat saat halaman dimuat (common.js), bukan bersamaan dengan toast pertama:
// pembaca layar baru mengumumkan perubahan pada wilayah live yang sudah ada lebih dulu.
export function toastHost() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = h("div", { id: "toast-host", role: "status", class: "pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4", "aria-live": "polite" });
    document.body.append(host);
  }
  return host;
}

const TOAST = {
  success: { icon: "check-circle", tone: "text-emerald-600 dark:text-emerald-400" },
  error: { icon: "alert-triangle", tone: "text-red-600 dark:text-red-400" },
  info: { icon: "info", tone: "text-primary-700 dark:text-primary-300" },
};

export function toast(message, type = "success") {
  const t = TOAST[type] || TOAST.info;
  const el = h("div", { role: type === "error" ? "alert" : "status", class: "card pointer-events-auto flex max-w-md items-start gap-3 px-4 py-3 text-sm shadow-lift animate-rise" },
    icon(t.icon, `mt-0.5 size-5 ${t.tone}`), h("span", { class: "font-medium", text: sentence(message) }));
  toastHost().append(el);
  setTimeout(() => { el.remove(); }, type === "error" ? 6000 : 3000);
}

// ── Tombol sibuk dan galat formulir ──
export function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.dataset.label || button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    if (busyLabel) button.textContent = busyLabel;
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}

// Galat formulir: kotak diisi, digulir ke tengah layar, dan diberi fokus. Tanpa itu, di ponsel galat muncul di
// atas viewport saat tombol di bawah form ditekan, sehingga tampak "tidak terjadi apa-apa".
export function showFormError(box, message) {
  if (!box) return;
  box.textContent = sentence(message);
  box.classList.toggle("hidden", !message);
  if (!message) return;
  box.setAttribute("tabindex", "-1");
  box.focus({ preventScroll: true });
  box.scrollIntoView({ block: "center" });
}

// Pembungkus yang bisa digulir mendatar. Hanya bila isinya benar-benar meluap ia menjadi wilayah yang bisa
// difokus (tabindex, role, nama), supaya pengguna papan ketik tidak berhenti di setiap tabel yang muat.
export function scrollRegion(el, label) {
  const sync = () => {
    const meluap = el.scrollWidth > el.clientWidth + 1;
    if (meluap) { el.tabIndex = 0; el.setAttribute("role", "region"); el.setAttribute("aria-label", label); }
    else { el.removeAttribute("tabindex"); el.removeAttribute("role"); el.removeAttribute("aria-label"); }
  };
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
  }
  sync();
  return el;
}

// ── Salin ke papan klip (dengan cadangan untuk konteks tanpa Clipboard API) ──
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h("textarea", { "aria-hidden": "true", tabindex: "-1", class: "fixed -left-[9999px] top-0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// "5 Okt 2026": singkat agar tidak membungkus di sel tabel.
export function formatDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatBytes(n) {
  if (n < 1024) return n + " B";
  return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
}

// Lencana status, dinamai menurut maknanya: pending = menunggu (stabilo), trial = petrol, ok = berhasil (hijau),
// danger = bermasalah, neutral = biasa.
const BADGE = {
  pending: "chip chip-dot chip-marker",
  trial: "chip chip-dot chip-primary",
  ok: "chip chip-dot chip-success",
  danger: "chip chip-dot chip-danger",
  neutral: "chip chip-neutral",
};
export function badge(text, tone = "neutral") {
  return h("span", { class: BADGE[tone] || BADGE.neutral, text });
}

// Lencana untuk satu enrollment (bentuk dari backend: status, trial_expired, trial_days_left, skema_judul).
export function enrollmentBadge(e) {
  if (e.status === "approved") return badge("Disetujui", "ok");
  if (e.status === "trial" && !e.trial_expired) return badge(`Trial, sisa ${e.trial_days_left} hari`, "trial");
  if (e.status === "trial") return badge("Trial berakhir", "pending");
  return badge("Menunggu persetujuan", "pending");
}
