import "../common.js";
import * as api from "../api.js";
import { formatDateShort, h, icon, mount } from "../ui.js";
import { makeChart } from "../admin/charts.js";
import { BTN, BTN_PRIMARY, CARD, avatar, errorState, link, loadingState, orDash, startAdmin, table } from "../admin/kit.js";

const state = document.getElementById("state");
const content = document.getElementById("content");

// Nada kartu: makna, bukan hiasan. marker = perlu tindakan, success = baik, primary/neutral = informasi.
const TONES = {
  primary: "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300",
  marker: "bg-marker-soft text-marker-ink",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  neutral: "bg-muted text-muted-foreground-1",
};

if (await startAdmin("dasbor")) await load();

async function load() {
  mount(state, loadingState());
  try {
    const [d, terbaru] = await Promise.all([api.get("/admin/dashboard"), api.get("/admin/users?limit=5")]);
    mount(state);
    content.classList.remove("hidden");
    render(d, terbaru.users);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

// Kartu angka; berupa tautan bila punya tujuan.
function stat(label, value, { href, hint, ico, tone = "neutral", urgent = false } = {}) {
  const body = [
    h("div", { class: "flex items-start justify-between gap-3" },
      h("p", { class: "text-sm font-medium text-muted-foreground-1", text: label }),
      h("span", { class: `grid size-9 shrink-0 place-items-center rounded-xl ${TONES[tone]}` }, icon(ico || "info", "size-[18px]"))),
    h("p", { class: "mt-3 font-display text-4xl font-medium leading-none tracking-tight", text: String(value) }),
    hint ? h("p", { class: "mt-2 text-xs text-muted-foreground-1", text: hint }) : null,
  ];
  const cls = `${CARD} block p-5 ${urgent ? "ring-2 ring-marker-line" : ""}`;
  return href
    ? h("a", { href: api.withBase(href), class: `${cls} transition-colors hover:bg-muted-hover` }, body)
    : h("div", { class: cls }, body);
}

function section(title, ...children) {
  return h("section", { "aria-label": title },
    h("h2", { class: "mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground-1", text: title }), ...children);
}

function chartBox(title, label) {
  const canvas = h("canvas", { role: "img", "aria-label": label });
  return { canvas, node: h("div", { class: `${CARD} min-w-0 p-5` }, h("h3", { class: "mb-3 text-sm font-semibold", text: title }), h("div", { class: "h-56" }, canvas)) };
}

function render(d, terbaru) {
  const u = d.users, e = d.enrollments, k = d.kode_undangan;

  const cUsers = chartBox("Akun", `Akun aktif ${u.aktif}, nonaktif ${u.nonaktif}`);
  const cEnroll = chartBox("Status pendaftaran", "Jumlah pendaftaran menunggu persetujuan, trial, dan disetujui; angkanya juga ada di kartu di atas.");

  mount(content,
    section("Perlu perhatian",
      h("div", { class: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" },
        stat("Menunggu persetujuan", e.pending, { href: "/admin/enrollments/?status=pending", ico: "hourglass", tone: "marker", urgent: e.pending > 0, hint: e.pending ? "Tinjau sekarang" : "Tidak ada antrean" }),
        stat("Trial berakhir", e.trial_habis, { href: "/admin/enrollments/?status=trial", ico: "alert-triangle", tone: "neutral" }),
        stat("Trial aktif", e.trial_aktif, { href: "/admin/enrollments/?status=trial", ico: "clock", tone: "primary" }),
        stat("Disetujui", e.disetujui, { href: "/admin/enrollments/?status=approved", ico: "check-circle", tone: "success" }))),
    section("Pengguna",
      h("div", { class: "grid gap-4 sm:grid-cols-2 lg:grid-cols-5" },
        stat("Total", u.total, { href: "/admin/users/", ico: "users", tone: "primary" }),
        stat("Aktif", u.aktif, { href: "/admin/users/?aktif=true", ico: "user-check", tone: "success" }),
        stat("Nonaktif", u.nonaktif, { href: "/admin/users/?aktif=false", ico: "x", tone: "danger" }),
        stat("Admin", u.admin, { href: "/admin/users/?role=admin", ico: "shield-check", tone: "primary" }),
        stat("Pendaftar 7 hari", d.pendaftar_7_hari, { ico: "trending-up", tone: "neutral" }))),
    section("Ringkasan visual",
      h("div", { class: "grid gap-4 md:grid-cols-2 xl:grid-cols-3" }, cEnroll.node, cUsers.node, kodeCard(k))),
    section("Pendaftar terbaru",
      terbaru.length
        ? table("Pendaftar terbaru", ["Nama", "Afiliasi", "Terdaftar"],
          terbaru.map((x) => [
            h("div", { class: "flex items-center gap-3" }, avatar(x.name), h("div", { class: "min-w-0" }, link(`/admin/users-detail/?id=${encodeURIComponent(x.id)}`, x.name), h("div", { class: "text-xs text-muted-foreground-1", text: x.email }))),
            orDash(x.affiliation), h("span", { class: "whitespace-nowrap", text: formatDateShort(x.created_at) })]))
        : h("p", { class: "text-sm text-muted-foreground-1", text: "Belum ada pengguna." })),
    h("div", { class: "flex flex-wrap gap-3" },
      h("a", { href: api.withBase("/admin/enrollments/?status=pending"), class: BTN_PRIMARY }, "Tinjau pendaftar menunggu", icon("arrow-right")),
      h("a", { href: api.withBase("/admin/invite-codes/"), class: "btn btn-outline" }, "Kelola kode undangan")));

  makeChart(cEnroll.canvas, (t) => ({
    type: "bar",
    data: { labels: ["Menunggu", "Trial", "Disetujui"], datasets: [{
      label: "Pendaftaran",
      data: [e.pending, e.trial_aktif + e.trial_habis, e.disetujui],
      backgroundColor: [t.c.pending, t.c.trial, t.c.approved],
      borderRadius: 4,
    }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
  }));
  makeChart(cUsers.canvas, (t) => ({
    type: "doughnut",
    data: { labels: ["Aktif", "Nonaktif"], datasets: [{ data: [u.aktif, u.nonaktif], backgroundColor: [t.c.active, t.c.danger], borderWidth: 0 }] },
    options: { cutout: "68%" },
  }));
}

// Kartu kode undangan: angka dan batang pemakaian (donut satu warna tidak memberi informasi apa pun).
function kodeCard(k) {
  return h("div", { class: `${CARD} flex min-w-0 flex-col p-5` },
    h("h3", { class: "text-sm font-semibold", text: "Kode undangan" }),
    h("p", { class: "mt-4 font-display text-5xl font-medium leading-none tracking-tight", text: String(k.dapat_dipakai) }),
    h("p", { class: "mt-2 text-sm text-muted-foreground-1", text: `dapat dipakai dari ${k.total} kode` }),
    k.total > 0 ? h("progress", { class: "meter mt-4", value: String(k.dapat_dipakai), max: String(k.total), "aria-label": `${k.dapat_dipakai} dari ${k.total} kode dapat dipakai` }) : null,
    h("a", { href: api.withBase("/admin/invite-codes/"), class: "link mt-auto pt-5 text-sm" }, "Kelola kode undangan"));
}
