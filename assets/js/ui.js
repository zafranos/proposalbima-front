// Pembantu UI. Semua DOM dibangun dengan createElement dan textContent (tanpa innerHTML),
// kecuali isi materi dari server yang sudah dirender dan dilint di backend.

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

// ── Ikon (garis 24px, gaya Lucide). Dibuat sebagai elemen SVG, bukan string. ──
const SVG_NS = "http://www.w3.org/2000/svg";
const ICONS = {
  x: ["M18 6 6 18", "m6 6 12 12"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  check: ["M20 6 9 17l-5-5"],
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
  info: [{ circle: [12, 12, 10] }, "M12 16v-4", "M12 8h.01"],
  "alert-triangle": ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
  "check-circle": [{ circle: [12, 12, 10] }, "m9 12 2 2 4-4"],
};

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

// Pesan dari backend diawali huruf kecil; di UI diawali huruf kapital.
export function sentence(msg) {
  const t = String(msg || "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

// ── Toast ──
function toastHost() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = h("div", { id: "toast-host", class: "pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4", "aria-live": "polite" });
    document.body.append(host);
  }
  return host;
}

const TOAST_STYLE = {
  success: "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-100",
  error: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
  info: "border-line-2 bg-layer text-layer-foreground",
};

export function toast(message, type = "success") {
  const el = h("div", { role: type === "error" ? "alert" : "status", class: `pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${TOAST_STYLE[type] || TOAST_STYLE.info}` },
    icon(type === "error" ? "alert-triangle" : "check-circle", "mt-0.5 size-4"), h("span", { text: sentence(message) }));
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

export function showFormError(box, message) {
  if (!box) return;
  box.textContent = sentence(message);
  box.classList.toggle("hidden", !message);
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

export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatBytes(n) {
  if (n < 1024) return n + " B";
  return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
}

// Lencana status enrollment dan sejenisnya.
const BADGE = {
  amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
  sky: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100",
  teal: "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-100",
  red: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
  gray: "border-line-3 bg-muted text-foreground",
};
export function badge(text, tone = "gray") {
  return h("span", { class: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE[tone] || BADGE.gray}`, text });
}

// Lencana untuk satu enrollment (bentuk dari backend: status, trial_expired, trial_days_left, skema_judul).
export function enrollmentBadge(e) {
  if (e.status === "approved") return badge("Disetujui", "teal");
  if (e.status === "trial" && !e.trial_expired) return badge(`Trial, sisa ${e.trial_days_left} hari`, "sky");
  if (e.status === "trial") return badge("Trial berakhir", "amber");
  return badge("Menunggu persetujuan", "amber");
}
