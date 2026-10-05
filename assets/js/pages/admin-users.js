import "../common.js";
import * as api from "../api.js";
import { badge, enrollmentBadge, formatDate, h, mount } from "../ui.js";
import { INPUT, debounce, emptyState, errorState, field, link, loadingState, orDash, readQuery, select, startAdmin, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";

// Semua const yang dipakai fungsi di bawah harus dideklarasikan SEBELUM `await` tingkat modul
// (kalau tidak, fungsi yang dipanggil saat await berjalan membaca const yang belum terinisialisasi).
const DEFAULTS = { q: "", role: "", aktif: "", page: "1" };
const METODE = { password: "Email", google: "Google" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const list = document.getElementById("list");
const pager = document.getElementById("pager");
let seq = 0;

if (await startAdmin("pengguna")) {
  if (!["", "user", "admin"].includes(query.role)) query.role = "";
  if (!["", "true", "false"].includes(query.aktif)) query.aktif = "";
  const qInput = h("input", { type: "search", class: INPUT, value: query.q, autocomplete: "off", placeholder: "Nama atau email" });
  const roleSel = select([["", "Semua"], ["user", "Peserta"], ["admin", "Admin"]], query.role);
  const aktifSel = select([["", "Semua"], ["true", "Aktif"], ["false", "Nonaktif"]], query.aktif);
  mount(document.getElementById("filters"),
    h("form", { role: "search", class: "grid gap-3 sm:grid-cols-3", on: { submit: (e) => e.preventDefault() } },
      field("f-q", "Cari", qInput), field("f-role", "Peran", roleSel), field("f-aktif", "Status akun", aktifSel)));

  const reload = () => { query.page = "1"; load(); };
  qInput.addEventListener("input", debounce(() => { query.q = qInput.value.trim(); reload(); }));
  roleSel.addEventListener("change", () => { query.role = roleSel.value; reload(); });
  aktifSel.addEventListener("change", () => { query.aktif = aktifSel.value; reload(); });
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ limit: "20", page: query.page });
  for (const k of ["q", "role", "aktif"]) if (query[k]) p.set(k, query[k]);
  try {
    const res = await api.get("/admin/users?" + p);
    if (mine !== seq) return; // jawaban usang: permintaan yang lebih baru sudah berjalan
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
  if (!res.users.length) {
    mount(list, emptyState("Tidak ada pengguna yang cocok."));
    mount(pager);
    return;
  }
  mount(list, table("Daftar pengguna", ["Nama", "Afiliasi", "Peran", "Akun", "Pendaftaran", "Terdaftar"],
    res.users.map((u) => [
      h("div", {}, link(`/admin/users-detail/?id=${encodeURIComponent(u.id)}`, u.name), h("div", { class: "text-xs text-muted-foreground-1", text: u.email })),
      orDash(u.affiliation),
      u.role === "admin" ? badge("Admin", "teal") : badge("Peserta"),
      h("div", { class: "space-y-1" },
        u.is_active ? badge("Aktif", "teal") : badge("Nonaktif", "red"),
        h("div", { class: "text-xs text-muted-foreground-1", text: (u.auth_methods || []).map((m) => METODE[m] || m).join(", ") })),
      u.enrollments.length
        ? h("div", { class: "space-y-1" }, u.enrollments.map((e) => h("div", { class: "flex flex-wrap items-center gap-1.5" }, h("span", { text: e.skema_judul }), enrollmentBadge(e))))
        : "—",
      formatDate(u.created_at),
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
