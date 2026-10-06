import "../common.js";
import * as api from "../api.js";
import { badge, enrollmentBadge, formatDateShort, h, mount } from "../ui.js";
import { actionsFor } from "../admin/enrollment-actions.js";
import { INPUT, avatar, debounce, emptyState, errorState, field, link, loadingState, orDash, readQuery, select, startAdmin, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";

// Bawaan "pending": pekerjaan utama halaman ini adalah meninjau pendaftar yang menunggu.
// "all" = semua status (tidak dikirim ke backend).
const DEFAULTS = { status: "pending", q: "", page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const list = document.getElementById("list");
const pager = document.getElementById("pager");
let seq = 0;

if (await startAdmin("pendaftaran")) {
  // Nilai filter di URL bisa ketikan manual: yang tidak dikenal dibuang agar tidak memicu galat 400.
  if (!["pending", "trial", "approved", "all"].includes(query.status)) query.status = DEFAULTS.status;
  const statusSel = select([["pending", "Menunggu persetujuan"], ["trial", "Trial"], ["approved", "Disetujui"], ["all", "Semua"]], query.status);
  const qInput = h("input", { type: "search", class: INPUT, value: query.q, autocomplete: "off", placeholder: "Nama atau email" });
  mount(document.getElementById("filters"),
    h("form", { role: "search", class: "grid gap-3 sm:grid-cols-3", on: { submit: (e) => e.preventDefault() } },
      field("f-status", "Status", statusSel), field("f-q", "Cari peserta", qInput)));

  const reload = () => { query.page = "1"; load(); };
  statusSel.addEventListener("change", () => { query.status = statusSel.value; reload(); });
  qInput.addEventListener("input", debounce(() => { query.q = qInput.value.trim(); reload(); }));
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ limit: "20", page: query.page });
  if (query.status !== "all") p.set("status", query.status);
  if (query.q) p.set("q", query.q);
  try {
    const res = await api.get("/admin/enrollments?" + p);
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
  if (!res.enrollments.length) {
    const antreanBersih = query.status === "pending" && !query.q;
    mount(list, emptyState(antreanBersih ? "Tidak ada pendaftaran yang menunggu persetujuan." : "Tidak ada pendaftaran yang cocok.", antreanBersih ? "check-circle" : "search"));
    mount(pager);
    return;
  }
  mount(list, table("Daftar pendaftaran", ["Peserta", "Afiliasi", "Skema", "Status", "Mendaftar", "Aksi"],
    res.enrollments.map(({ enrollment: e, user: u }) => [
      h("div", { class: "flex items-center gap-3" }, avatar(u.name), h("div", { class: "min-w-0" }, link(`/admin/users-detail/?id=${encodeURIComponent(u.id)}`, u.name), h("div", { class: "text-xs text-muted-foreground-1", text: u.email }),
        u.is_active ? null : h("div", { class: "mt-1" }, badge("Akun nonaktif", "danger")))),
      orDash(u.affiliation),
      h("div", { class: "space-y-1" }, enrollmentBadge(e),
        e.used_invite_code ? h("div", { class: "text-xs text-muted-foreground-1", text: `Kode ${e.used_invite_code}` }) : null),
      h("span", { class: "whitespace-nowrap", text: formatDateShort(e.enrolled_at) }),
      actionsFor(e, u.name, load),
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
