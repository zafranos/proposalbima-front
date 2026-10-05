import "../common.js";
import * as api from "../api.js";
import { ALL_FIELDS, ALL_LISTS, SECTIONS } from "../landing/schema.js";
import { collapse, readDefaults } from "../landing/hydrate.js";
import { formatDateTime, h, icon, mount, setBusy, showFormError, toast } from "../ui.js";
import { confirmDialog } from "../admin/dialog.js";
import { BTN, BTN_DANGER, BTN_PRIMARY, errorState, loadingState, startAdmin, table } from "../admin/kit.js";

// Editor teks landing. Formulir dibangun dari skema (landing/schema.js); teks bawaan dibaca dari HTML landing
// itu sendiri, jadi tidak ada dua salinan. Yang dikirim ke server hanya bidang yang BERBEDA dari bawaan.
// Semua const yang dipakai fungsi di bawah dideklarasikan SEBELUM `await` tingkat modul.
const state = document.getElementById("state");
const editor = document.getElementById("editor");
const status = h("p", { class: "text-sm", "aria-live": "polite" });
const errorBox = h("div", { role: "alert", class: "alert alert-error mt-6 hidden" });
const saveBtn = h("button", { type: "button", class: BTN_PRIMARY, text: "Simpan perubahan" });

let defaults = { fields: {}, lists: {} }; // teks bawaan halaman
let values = { fields: {}, lists: {} }; // isi yang sedang tampil di formulir
let version = 0;
let baseline = ""; // isi (hasil collect) saat terakhir dimuat atau disimpan
let dirty = false;
let metaEl = null;
let asideEl = null; // kartu riwayat dan kembalikan-ke-bawaan; disegarkan setelah setiap perubahan di server
let lastRiwayat = [];

const FIELD_ID = (path) => "f-" + path.replace(/\./g, "-");
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── Mengubah isi formulir menjadi isi yang dikirim ──
function cleanItems(list, items) {
  const out = [];
  for (const item of items || []) {
    const clean = {};
    for (const k of list.keys) {
      const v = collapse(item[k.key]);
      if (v) clean[k.key] = v;
    }
    if (Object.keys(clean).length) out.push(clean);
  }
  return out;
}

function collect() {
  const fields = {};
  for (const f of ALL_FIELDS) {
    const v = collapse(values.fields[f.path]);
    if (v && v !== defaults.fields[f.path]) fields[f.path] = v;
  }
  const lists = {};
  for (const l of ALL_LISTS) {
    const items = cleanItems(l, values.lists[l.path]);
    if (JSON.stringify(items) !== JSON.stringify(cleanItems(l, defaults.lists[l.path]))) lists[l.path] = items;
  }
  return { fields, lists };
}

// Galat yang dapat diketahui sebelum mengirim; selebihnya server yang menilai.
function validate() {
  for (const l of ALL_LISTS) {
    const items = values.lists[l.path] || [];
    if (!cleanItems(l, items).length) throw new Error(`${l.label}: isi minimal satu butir.`);
    items.forEach((item, i) => {
      const filled = l.keys.some((k) => collapse(item[k.key]));
      if (!filled) return; // butir kosong dibuang saat menyimpan
      for (const k of l.keys) if (!k.optional && !collapse(item[k.key])) throw new Error(`${l.label}, ${l.itemLabel.toLowerCase()} ${i + 1}: ${k.label} wajib diisi.`);
    });
  }
}

function adopt(res) {
  const c = res.content || { fields: {}, lists: {} };
  version = res.version || 0;
  values = {
    fields: Object.fromEntries(ALL_FIELDS.map((f) => [f.path, typeof c.fields[f.path] === "string" && c.fields[f.path] ? c.fields[f.path] : defaults.fields[f.path]])),
    lists: Object.fromEntries(ALL_LISTS.map((l) => [l.path, clone(Array.isArray(c.lists[l.path]) && c.lists[l.path].length ? c.lists[l.path] : defaults.lists[l.path])])),
  };
  for (const l of ALL_LISTS) values.lists[l.path] = values.lists[l.path].map((it) => Object.fromEntries(l.keys.map((k) => [k.key, it[k.key] || ""])));
  baseline = JSON.stringify(collect());
  dirty = false;
}

function updateMeta(res) {
  if (!metaEl) return;
  if (!res.content) { metaEl.textContent = "Landing memakai teks bawaan."; return; }
  const when = formatDateTime(res.updated_at);
  metaEl.textContent = `Versi ${res.version}${res.updated_by ? `, terakhir diubah oleh ${res.updated_by}` : ""}${when ? ` pada ${when}` : ""}.`;
}

function renderStatus() {
  const text = dirty ? "Ada perubahan yang belum disimpan." : "Semua perubahan sudah tersimpan.";
  if (status.textContent !== text) status.textContent = text;
  status.classList.toggle("font-medium", dirty);
  saveBtn.disabled = !dirty;
}

function touch() {
  dirty = JSON.stringify(collect()) !== baseline;
  renderStatus();
}

// ── Kontrol ──
function textControl({ id, label, max, rows, value, onInput, hintExtra }) {
  const multi = (rows || 1) > 1;
  const control = multi
    ? h("textarea", { class: "textarea", rows: String(rows), maxlength: String(max) })
    : h("input", { type: "text", class: "input", maxlength: String(max), autocomplete: "off" });
  control.id = id;
  control.value = value;
  const count = h("span", { text: "" });
  const sync = () => { count.textContent = `${[...control.value].length}/${max}`; if (hintExtra) hintExtra.sync(control); };
  control.setAttribute("aria-describedby", id + "-hint");
  control.addEventListener("input", () => { onInput(control.value); sync(); touch(); });
  sync();
  return {
    control, sync,
    el: h("div", { class: multi || max > 90 ? "sm:col-span-2" : "" },
      h("label", { for: id, class: "label", text: label }), control,
      h("p", { id: id + "-hint", class: "hint flex flex-wrap items-center gap-x-3" }, count, hintExtra ? hintExtra.el : null)),
  };
}

function fieldRow(f) {
  const reset = h("button", { type: "button", class: "link text-xs", hidden: true, text: "Pakai teks bawaan" });
  const tc = textControl({
    id: FIELD_ID(f.path), label: f.label, max: f.max, rows: f.rows, value: values.fields[f.path],
    onInput: (v) => { values.fields[f.path] = v; },
    hintExtra: { el: reset, sync: (control) => { reset.hidden = collapse(control.value) === defaults.fields[f.path]; } },
  });
  tc.sync();
  reset.addEventListener("click", () => {
    values.fields[f.path] = defaults.fields[f.path];
    tc.control.value = defaults.fields[f.path];
    tc.sync();
    touch();
    tc.control.focus();
  });
  return tc.el;
}

function listBlock(l) {
  const wrap = h("div", { class: "space-y-3" });
  const addBtn = h("button", { type: "button", class: BTN }, icon("plus", "size-4"), `Tambah ${l.itemLabel.toLowerCase()}`);
  const resetBtn = h("button", { type: "button", class: "link text-sm", hidden: true, text: "Kembalikan daftar ke bawaan" });
  const items = () => values.lists[l.path];
  const isDefault = () => JSON.stringify(cleanItems(l, items())) === JSON.stringify(cleanItems(l, defaults.lists[l.path]));

  const draw = (focusSel) => {
    const list = items();
    mount(wrap, list.map((item, i) => itemCard(item, i, list.length)));
    addBtn.disabled = list.length >= l.max;
    resetBtn.hidden = isDefault();
    if (focusSel) {
      const target = wrap.querySelector(focusSel);
      (target && !target.disabled ? target : addBtn).focus(); // tombol yang nonaktif tidak dapat menerima fokus
    }
  };

  const move = (i, to) => {
    const list = items();
    [list[i], list[to]] = [list[to], list[i]];
    draw(to === 0 ? `[data-act="down"][data-i="0"]` : to === list.length - 1 ? `[data-act="up"][data-i="${to}"]` : `[data-act="${to < i ? "up" : "down"}"][data-i="${to}"]`);
    touch();
  };

  function itemCard(item, i, total) {
    const btn = (act, ico, label, disabled, fn) => h("button", {
      type: "button", class: "icon-btn", "aria-label": `${label} ${l.itemLabel.toLowerCase()} ${i + 1}`, disabled: disabled || null, data: { act, i: String(i) }, on: { click: fn },
    }, icon(ico, "size-4"));
    return h("div", { class: "rounded-xl border border-line-2 bg-background-1 p-4", role: "group", "aria-label": `${l.itemLabel} ${i + 1}`, data: { item: String(i) } },
      h("div", { class: "mb-3 flex items-center justify-between gap-2" },
        h("p", { class: "text-sm font-semibold", text: `${l.itemLabel} ${i + 1}` }),
        h("div", { class: "flex gap-1.5" },
          btn("up", "chevron-up", "Naikkan", i === 0, () => move(i, i - 1)),
          btn("down", "chevron-down", "Turunkan", i === total - 1, () => move(i, i + 1)),
          btn("remove", "trash", "Hapus", total <= 1, () => {
            items().splice(i, 1);
            draw(`[data-act="remove"][data-i="${Math.min(i, total - 2)}"]`);
            touch();
          }))),
      h("div", { class: "grid gap-4 sm:grid-cols-2" },
        l.keys.map((k) => textControl({
          id: `l-${l.path.replace(/\./g, "-")}-${i}-${k.key}`, label: k.label, max: k.max, rows: k.rows, value: item[k.key] || "",
          onInput: (v) => { item[k.key] = v; resetBtn.hidden = isDefault(); },
        }).el)));
  }

  addBtn.addEventListener("click", () => {
    items().push(Object.fromEntries(l.keys.map((k) => [k.key, ""])));
    draw(`[data-item="${items().length - 1}"] .input, [data-item="${items().length - 1}"] .textarea`);
    touch();
  });
  resetBtn.addEventListener("click", () => {
    values.lists[l.path] = clone(defaults.lists[l.path]).map((it) => Object.fromEntries(l.keys.map((k) => [k.key, it[k.key] || ""])));
    draw();
    touch();
    addBtn.focus();
  });
  draw();
  const headId = "lst-" + l.path.replace(/\./g, "-");
  return h("div", { class: "sm:col-span-2", role: "group", "aria-labelledby": headId },
    h("h3", { id: headId, class: "mb-3 text-sm font-semibold", text: l.label }),
    wrap,
    h("div", { class: "mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" }, addBtn, h("span", { class: "text-xs text-muted-foreground-1", text: `Maksimal ${l.max}.` }), resetBtn));
}

function sectionCard(s) {
  return h("section", { id: "sec-" + s.id, class: "card card-pad scroll-mt-20", "aria-labelledby": "h-" + s.id },
    h("h2", { id: "h-" + s.id, class: "font-display text-2xl font-medium tracking-tight", text: s.title }),
    s.note ? h("p", { class: "mt-1 text-sm text-muted-foreground-1", text: s.note }) : null,
    h("div", { class: "mt-6 grid gap-5 sm:grid-cols-2" }, (s.fields || []).map(fieldRow), (s.lists || []).map(listBlock)));
}

// ── Riwayat dan pengembalian ──
function historyCard(riwayat) {
  const rows = riwayat.map((r) => [
    `Versi ${r.version}`,
    r.updated_by || "—",
    formatDateTime(r.updated_at) || "—",
    formatDateTime(r.archived_at) || "—",
    `${r.jumlah_bidang} bidang, ${r.jumlah_daftar} daftar`,
    h("button", { type: "button", class: BTN, on: { click: () => restore(r) }, "aria-label": `Pulihkan versi ${r.version}`, text: "Pulihkan" }),
  ]);
  return h("section", { class: "mt-10", "aria-labelledby": "h-riwayat" },
    h("h2", { id: "h-riwayat", class: "font-display text-2xl font-medium tracking-tight", text: "Riwayat versi" }),
    h("p", { class: "mb-4 mt-1 text-sm text-muted-foreground-1", text: "Dua puluh versi terakhir yang pernah digantikan. Memulihkan menjadikan versi itu yang terbaru; versi saat ini tetap tersimpan di riwayat." }),
    riwayat.length ? table("Riwayat versi landing", ["Versi", "Diubah oleh", "Dibuat", "Digantikan", "Isi", "Aksi"], rows)
      : h("p", { class: "rounded-2xl border border-dashed border-line-3 px-6 py-8 text-center text-sm text-muted-foreground-1", text: "Belum ada versi lama." }));
}

const LOSE = " Perubahan di formulir yang belum disimpan akan hilang.";

async function restore(r) {
  const ok = await confirmDialog({
    title: `Pulihkan versi ${r.version}?`,
    message: `Isi landing diganti dengan isi versi ${r.version}. Versi saat ini tetap tersimpan di riwayat.${dirty ? LOSE : ""}`,
    confirmLabel: "Pulihkan",
    onConfirm: async () => { await api.post(`/admin/landing/history/${encodeURIComponent(r.id)}/restore`, undefined, { noFollow: true }); },
  });
  if (ok) { toast(`Versi ${r.version} dipulihkan.`); await load(); }
}

async function resetAll() {
  const ok = await confirmDialog({
    title: "Kembalikan semua ke teks bawaan?",
    message: `Seluruh teks landing kembali ke teks bawaan halaman. Isi saat ini tetap tersimpan di riwayat.${dirty ? LOSE : ""}`,
    confirmLabel: "Kembalikan", danger: true,
    onConfirm: async () => { await api.del("/admin/landing", { noFollow: true }); },
  });
  if (ok) { toast("Landing kembali ke teks bawaan."); await load(); }
}

// Yang dikirim dicatat sebelum permintaan berangkat: ketikan selama permintaan berjalan tetap berstatus "belum disimpan".
async function save() {
  showFormError(errorBox, "");
  try { validate(); } catch (e) { showFormError(errorBox, e.message); return; }
  const sent = collect();
  setBusy(saveBtn, true, "Menyimpan...");
  try {
    const res = await api.post("/admin/landing", { content: sent, base_version: version }, { noFollow: true });
    version = res.version || 0;
    baseline = JSON.stringify(sent);
    updateMeta(res);
    toast("Landing disimpan.");
    refreshAside(res);
  } catch (e) {
    if (e.status === 409) await onConflict();
    else showFormError(errorBox, e.message);
  } finally {
    setBusy(saveBtn, false);
    touch();
  }
}

// Admin lain menyimpan lebih dulu. Isian di formulir TIDAK dibuang: versi terbaru diambil, dan admin memilih sendiri
// menimpa (versi mereka tetap ada di riwayat) atau memuat ulang halaman.
async function onConflict() {
  try {
    const cur = await api.get("/admin/landing");
    version = cur.version || 0;
    updateMeta(cur);
    refreshAside(cur);
    showFormError(errorBox, `Landing sudah diubah oleh orang lain${cur.updated_by ? ` (${cur.updated_by})` : ""}. Isian Anda masih ada di formulir. Tekan Simpan perubahan lagi untuk menimpanya (versi mereka tetap ada di riwayat), atau muat ulang halaman untuk melihat versi mereka dan membuang isian Anda.`);
  } catch (e) {
    showFormError(errorBox, e.message);
  }
}

async function fetchDefaults() {
  let res;
  try { res = await fetch(api.withBase("/"), { headers: { Accept: "text/html" }, cache: "no-cache" }); } catch { throw new Error("Tidak dapat membaca teks bawaan landing."); }
  if (!res.ok) throw new Error("Tidak dapat membaca teks bawaan landing.");
  const d = readDefaults(new DOMParser().parseFromString(await res.text(), "text/html"));
  for (const f of ALL_FIELDS) if (typeof d.fields[f.path] !== "string") throw new Error(`Halaman landing tidak memuat bidang ${f.path}; muat ulang halaman ini.`);
  for (const l of ALL_LISTS) if (!Array.isArray(d.lists[l.path])) throw new Error(`Halaman landing tidak memuat daftar ${l.path}; muat ulang halaman ini.`);
  return d;
}

// Kartu di bawah formulir: riwayat versi dan kembalikan-ke-bawaan. Dibangun ulang setiap kali isi di server berubah
// (simpan, konflik, pulihkan, kembalikan) supaya tidak menampilkan keadaan lama.
function renderAside(cur, riwayat) {
  const customized = !!cur.content;
  mount(asideEl,
    historyCard(riwayat),
    h("section", { class: "mt-10 card card-pad", "aria-labelledby": "h-reset" },
      h("h2", { id: "h-reset", class: "font-display text-2xl font-medium tracking-tight", text: "Kembalikan ke teks bawaan" }),
      h("p", { class: "mt-1 text-sm text-muted-foreground-1", text: customized ? "Menghapus semua penyuntingan sehingga landing memakai teks bawaan halaman. Isi saat ini tetap tersimpan di riwayat." : "Landing sudah memakai teks bawaan; belum ada yang perlu dikembalikan." }),
      h("button", { type: "button", class: BTN_DANGER + " mt-4", disabled: customized ? null : true, on: { click: resetAll }, text: "Kembalikan semua" })));
}

async function refreshAside(cur) {
  try { lastRiwayat = (await api.get("/admin/landing/history")).riwayat || []; } catch { /* tampilkan riwayat yang lama */ }
  renderAside(cur, lastRiwayat);
}

function render(cur, riwayat) {
  metaEl = h("p", { class: "text-sm text-muted-foreground-1" });
  asideEl = h("div");
  lastRiwayat = riwayat;
  updateMeta(cur);
  renderAside(cur, riwayat);
  mount(editor,
    metaEl,
    h("nav", { "aria-label": "Bagian landing", class: "mt-4 flex flex-wrap gap-2" },
      SECTIONS.map((s) => h("a", { href: "#sec-" + s.id, class: BTN, text: s.title }))),
    h("div", { class: "mt-6 space-y-6" }, SECTIONS.map(sectionCard)),
    errorBox,
    h("div", { class: "card sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-lift" }, status, saveBtn),
    asideEl);
  showFormError(errorBox, "");
  renderStatus();
}

async function load() {
  mount(state, loadingState());
  mount(editor);
  try {
    const [d, cur, hist] = await Promise.all([fetchDefaults(), api.get("/admin/landing"), api.get("/admin/landing/history")]);
    defaults = d;
    adopt(cur);
    mount(state);
    render(cur, hist.riwayat || []);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

saveBtn.addEventListener("click", save);
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

if (await startAdmin("landing")) {
  mount(document.getElementById("actions"),
    h("a", { href: api.withBase("/"), class: BTN, target: "_blank", rel: "noopener" }, "Buka landing", h("span", { class: "sr-only", text: " (tab baru)" }), icon("arrow-up-right")));
  await load();
}
