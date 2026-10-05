import "../common.js";
import * as api from "../api.js";
import { formatDate, h, mount } from "../ui.js";
import { COLORS, makeChart } from "../admin/charts.js";
import { BTN, BTN_PRIMARY, CARD, errorState, link, loadSkema, loadingState, orDash, skemaTitle, startAdmin, table } from "../admin/kit.js";

const state = document.getElementById("state");
const content = document.getElementById("content");

if (await startAdmin("dasbor")) await load();

async function load() {
  mount(state, loadingState());
  try {
    const [d, skema, terbaru] = await Promise.all([api.get("/admin/dashboard"), loadSkema(), api.get("/admin/users?limit=5")]);
    mount(state);
    content.classList.remove("hidden");
    render(d, skema, terbaru.users);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

// Kartu angka; berupa tautan bila punya tujuan.
function stat(label, value, { href, hint } = {}) {
  const body = [
    h("p", { class: "text-sm text-muted-foreground-1", text: label }),
    h("p", { class: "mt-1 text-2xl font-bold", text: String(value) }),
    hint ? h("p", { class: "mt-1 text-xs text-muted-foreground-1", text: hint }) : null,
  ];
  return href
    ? h("a", { href: api.withBase(href), class: `${CARD} block p-4 hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary-focus` }, body)
    : h("div", { class: `${CARD} p-4` }, body);
}

function section(title, ...children) {
  return h("section", { "aria-label": title },
    h("h2", { class: "mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground-1", text: title }), ...children);
}

function chartBox(title, label) {
  const canvas = h("canvas", { role: "img", "aria-label": label });
  return { canvas, node: h("div", { class: `${CARD} p-4` }, h("h3", { class: "mb-2 text-sm font-semibold", text: title }), h("div", { class: "h-56" }, canvas)) };
}

function render(d, skema, terbaru) {
  const u = d.users, e = d.enrollments, k = d.kode_undangan;
  const perSkema = d.per_skema || [];

  const cUsers = chartBox("Akun", `Akun aktif ${u.aktif}, nonaktif ${u.nonaktif}`);
  const cKode = chartBox("Kode undangan", `Kode dapat dipakai ${k.dapat_dipakai} dari ${k.total}`);
  const cEnroll = chartBox("Status pendaftaran per skema", "Jumlah pendaftaran menunggu, trial, dan disetujui per skema; angkanya ada di tabel di bawah grafik.");

  mount(content,
    section("Pengguna",
      h("div", { class: "grid grid-cols-2 gap-3 md:grid-cols-5" },
        stat("Total", u.total, { href: "/admin/users/" }),
        stat("Aktif", u.aktif, { href: "/admin/users/?aktif=true" }),
        stat("Nonaktif", u.nonaktif, { href: "/admin/users/?aktif=false" }),
        stat("Admin", u.admin, { href: "/admin/users/?role=admin" }),
        stat("Pendaftar 7 hari", d.pendaftar_7_hari))),
    section("Pendaftaran dan akses",
      h("div", { class: "grid grid-cols-2 gap-3 md:grid-cols-5" },
        stat("Menunggu persetujuan", e.pending, { href: "/admin/enrollments/?status=pending" }),
        stat("Trial aktif", e.trial_aktif, { href: "/admin/enrollments/?status=trial" }),
        stat("Trial berakhir", e.trial_habis, { href: "/admin/enrollments/?status=trial" }),
        stat("Disetujui", e.disetujui, { href: "/admin/enrollments/?status=approved" }),
        stat("Kode undangan", k.dapat_dipakai, { href: "/admin/invite-codes/", hint: `dapat dipakai dari ${k.total}` }))),
    section("Ringkasan visual",
      h("div", { class: "grid gap-4 lg:grid-cols-3" },
        h("div", { class: "lg:col-span-2" }, cEnroll.node), h("div", { class: "grid gap-4" }, cUsers.node, cKode.node))),
    section("Pendaftaran per skema",
      perSkema.length
        ? table("Pendaftaran per skema", ["Skema", "Menunggu", "Trial", "Disetujui"],
          perSkema.map((r) => [skemaTitle(skema, r.skema), String(r.pending), String(r.trial), String(r.approved)]))
        : h("p", { class: "text-sm text-muted-foreground-1", text: "Belum ada pendaftaran." })),
    section("Pendaftar terbaru",
      terbaru.length
        ? table("Pendaftar terbaru", ["Nama", "Email", "Afiliasi", "Terdaftar"],
          terbaru.map((x) => [link(`/admin/users-detail/?id=${encodeURIComponent(x.id)}`, x.name), x.email, orDash(x.affiliation), formatDate(x.created_at)]))
        : h("p", { class: "text-sm text-muted-foreground-1", text: "Belum ada pengguna." })),
    h("div", { class: "flex flex-wrap gap-3" },
      h("a", { href: api.withBase("/admin/enrollments/?status=pending"), class: BTN_PRIMARY, text: "Tinjau pendaftar menunggu" }),
      h("a", { href: api.withBase("/admin/invite-codes/"), class: BTN, text: "Kelola kode undangan" })));

  const labels = perSkema.map((r) => skemaTitle(skema, r.skema));
  makeChart(cEnroll.canvas, () => ({
    type: "bar",
    data: { labels, datasets: [
      { label: "Menunggu", data: perSkema.map((r) => r.pending), backgroundColor: COLORS.amber },
      { label: "Trial", data: perSkema.map((r) => r.trial), backgroundColor: COLORS.sky },
      { label: "Disetujui", data: perSkema.map((r) => r.approved), backgroundColor: COLORS.teal },
    ] },
    options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } },
  }));
  makeChart(cUsers.canvas, () => ({
    type: "doughnut",
    data: { labels: ["Aktif", "Nonaktif"], datasets: [{ data: [u.aktif, u.nonaktif], backgroundColor: [COLORS.teal, COLORS.red], borderWidth: 0 }] },
  }));
  makeChart(cKode.canvas, () => ({
    type: "doughnut",
    data: { labels: ["Dapat dipakai", "Tidak dapat dipakai"], datasets: [{ data: [k.dapat_dipakai, k.total - k.dapat_dipakai], backgroundColor: [COLORS.teal, COLORS.slate], borderWidth: 0 }] },
  }));
}
