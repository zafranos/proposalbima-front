import "../common.js";
import * as api from "../api.js";
import { badge, copyText, formatDate, h, icon, mount, toast } from "../ui.js";
import { modal } from "../admin/dialog.js";
import { BTN, BTN_PRIMARY, INPUT, emptyState, errorState, field, loadingState, orDash, readQuery, select, startAdmin, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";

// Semua const yang dipakai fungsi di bawah dideklarasikan SEBELUM `await` tingkat modul.
const DEFAULTS = { state: "", page: "1" };
const STATES = [["", "Semua status"], ["active", "Aktif"], ["disabled", "Nonaktif"], ["expired", "Kedaluwarsa"], ["exhausted", "Kuota habis"]];
const STATE_BADGE = { active: ["Aktif", "ok"], disabled: ["Nonaktif", "neutral"], expired: ["Kedaluwarsa", "pending"], exhausted: ["Kuota habis", "pending"] };
const CODE_RE = /^[A-Z0-9]{4,32}$/;
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const list = document.getElementById("list");
const pager = document.getElementById("pager");
let seq = 0;

// Tanggal (YYYY-MM-DD, zona waktu lokal) <-> waktu RFC3339 untuk backend. Batas diset ke akhir hari itu.
const endOfDayISO = (d) => new Date(`${d}T23:59:59`).toISOString();
function toDateInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

if (await startAdmin("kode")) {
  if (!STATES.some(([v]) => v === query.state)) query.state = DEFAULTS.state;
  const stateSel = select(STATES, query.state);
  mount(document.getElementById("filters"),
    h("form", { role: "search", class: "grid gap-3 sm:grid-cols-2 lg:max-w-xl", on: { submit: (e) => e.preventDefault() } },
      field("f-state", "Status", stateSel)));
  mount(document.getElementById("actions"), h("button", { type: "button", class: BTN_PRIMARY, on: { click: openCreate }, text: "Buat kode" }));
  const reload = () => { query.page = "1"; load(); };
  stateSel.addEventListener("change", () => { query.state = stateSel.value; reload(); });
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ limit: "20", page: query.page });
  if (query.state) p.set("state", query.state);
  try {
    const res = await api.get("/admin/invite-codes?" + p);
    if (mine !== seq) return;
    if (res.meta.total_pages > 0 && res.meta.page > res.meta.total_pages) {
      query.page = String(res.meta.total_pages);
      return load();
    }
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function render(res) {
  if (!res.kode.length) {
    mount(list, emptyState("Belum ada kode undangan yang cocok."));
    mount(pager);
    return;
  }
  mount(list, table("Daftar kode undangan", ["Kode", "Status", "Pemakaian", "Kedaluwarsa", "Catatan", "Aksi"],
    res.kode.map((c) => {
      const [label, tone] = STATE_BADGE[c.state] || [c.state, "neutral"];
      return [
        h("div", { class: "flex items-center gap-2" },
          h("code", { class: "rounded-lg bg-marker-soft px-2 py-1 font-mono text-[13px] font-semibold tracking-wide text-marker-ink", text: c.code }),
          h("button", { type: "button", class: "inline-flex size-7 items-center justify-center rounded-md hover:bg-muted-hover", "aria-label": `Salin kode ${c.code}`,
            on: { click: async () => {
              const ok = await copyText(c.code);
              toast(ok ? `Kode ${c.code} disalin.` : "Gagal menyalin kode.", ok ? "success" : "error");
            } } }, icon("copy"))),
        badge(label, tone),
        `${c.used_count} / ${c.max_uses > 0 ? c.max_uses : "tak terbatas"}`,
        c.expires_at ? formatDate(c.expires_at) : "—",
        orDash(c.notes),
        h("div", { class: "flex flex-wrap gap-2" },
          h("button", { type: "button", class: BTN, on: { click: async () => { if (await openEdit(c)) load(); } }, text: "Ubah" }),
          h("button", { type: "button", class: BTN, on: { click: () => toggle(c) }, text: c.is_active ? "Nonaktifkan" : "Aktifkan" })),
      ];
    })));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}

async function toggle(c) {
  try {
    await api.post(`/admin/invite-codes/${encodeURIComponent(c.id)}/toggle`);
    toast(c.is_active ? `Kode ${c.code} dinonaktifkan.` : `Kode ${c.code} diaktifkan.`);
    load();
  } catch (e) {
    toast(e.message, "error");
  }
}

function numberInput(value, min, max) {
  return h("input", { type: "number", min: String(min), max: String(max), step: "1", value: String(value), inputmode: "numeric", class: INPUT });
}

async function openCreate() {
  const code = h("input", { type: "text", class: INPUT, maxlength: "32", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "Dibuat otomatis bila kosong" });
  const max = numberInput(0, 0, 100000);
  const exp = h("input", { type: "date", class: INPUT });
  const notes = h("input", { type: "text", class: INPUT, maxlength: "255", autocomplete: "off" });
  const ok = await modal({
    title: "Buat kode undangan",
    description: "Peserta yang mendaftar dengan kode ini langsung disetujui dan mendapat akses penuh, tanpa menunggu admin. Bagikan hanya kepada orang yang Anda setujui.",
    content: h("div", { class: "space-y-4" },
      field("kode-code", "Kode kustom (opsional)", code, "4 sampai 32 huruf atau angka; huruf kecil diubah menjadi huruf besar."),
      field("kode-max", "Kuota pemakaian", max, "Tiap pemakaian langsung menjadi persetujuan. 0 = tak terbatas: siapa pun yang tahu kode dapat mendaftar tanpa batas."),
      field("kode-exp", "Berlaku sampai (opsional)", exp, "Kode tidak dapat dipakai setelah akhir hari ini."),
      field("kode-notes", "Catatan (opsional)", notes)),
    confirmLabel: "Buat kode",
    onSubmit: async () => {
      const custom = code.value.trim().toUpperCase();
      if (custom && !CODE_RE.test(custom)) throw new Error("Kode kustom harus 4 sampai 32 huruf atau angka.");
      const body = { max_uses: Number(max.value), notes: notes.value.trim() };
      if (!Number.isInteger(body.max_uses) || body.max_uses < 0 || body.max_uses > 100000) throw new Error("Kuota harus bilangan bulat 0 sampai 100000.");
      if (custom) body.code = custom;
      if (exp.value) body.expires_at = endOfDayISO(exp.value);
      const res = await api.post("/admin/invite-codes", body);
      toast(`Kode ${res.kode.code} dibuat.`);
    },
  });
  if (ok) load();
}

function openEdit(c) {
  const notes = h("input", { type: "text", class: INPUT, maxlength: "255", autocomplete: "off", value: c.notes || "" });
  const max = numberInput(c.max_uses, 0, 100000);
  const initialDate = toDateInput(c.expires_at);
  const exp = h("input", { type: "date", class: INPUT, value: initialDate });
  return modal({
    title: `Ubah kode ${c.code}`,
    description: "Kode tidak dapat diubah. Pemakaian yang sudah terjadi tetap tercatat dan persetujuannya tidak dibatalkan.",
    content: h("div", { class: "space-y-4" },
      field("ubah-max", "Kuota pemakaian", max, `0 = tak terbatas. Sudah dipakai ${c.used_count}.`),
      field("ubah-exp", "Berlaku sampai", exp, "Kosongkan untuk menghapus batas waktu."),
      field("ubah-notes", "Catatan", notes)),
    confirmLabel: "Simpan",
    onSubmit: async () => {
      // Hanya bidang yang berubah yang dikirim: tanggal lama yang sudah lewat tidak boleh ikut terkirim
      // (backend menolak expires_at di masa lalu) sehingga catatan kode kedaluwarsa tetap bisa diubah.
      const body = {};
      if (notes.value.trim() !== (c.notes || "")) body.notes = notes.value.trim();
      if (Number(max.value) !== c.max_uses) body.max_uses = Number(max.value);
      if (exp.value !== initialDate) body.expires_at = exp.value ? endOfDayISO(exp.value) : null;
      if (!Object.keys(body).length) throw new Error("Tidak ada perubahan.");
      if ("max_uses" in body && (!Number.isInteger(body.max_uses) || body.max_uses < 0 || body.max_uses > 100000)) throw new Error("Kuota harus bilangan bulat 0 sampai 100000.");
      await api.patch(`/admin/invite-codes/${encodeURIComponent(c.id)}`, body);
      toast(`Kode ${c.code} diperbarui.`);
    },
  });
}
