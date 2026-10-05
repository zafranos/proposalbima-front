import "../common.js";
import * as api from "../api.js";
import { badge, formatDateTime, h, mount } from "../ui.js";
import { disposeChart, makeChart } from "../admin/charts.js";
import { CARD, INPUT, avatar, debounce, emptyState, errorState, field, link, loadSkema, loadingState, orDash, readQuery, select, startAdmin, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";

// Semua const yang dipakai fungsi di bawah dideklarasikan SEBELUM `await` tingkat modul.
const DEFAULTS = { skema: "", q: "", page: "1" };
const STATUS = { pending: ["Menunggu", "pending"], trial: ["Trial", "trial"], approved: ["Disetujui", "ok"] };
const trunc = (s, n = 34) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const funnelSection = document.getElementById("funnel-section");
const funnelBox = document.getElementById("funnel");
const list = document.getElementById("list");
const pager = document.getElementById("pager");
let seq = 0;
let funnelChart = null;
let defaultSkema = ""; // skema pertama: tidak perlu tampil di URL

if (await startAdmin("progres")) {
  let skema = [];
  try { skema = await loadSkema(); } catch { /* tanpa pilihan, backend memakai skema pertama */ }
  if (skema.length) {
    defaultSkema = skema[0].slug;
    if (!skema.some((s) => s.slug === query.skema)) query.skema = defaultSkema;
  }
  const skemaSel = select(skema.map((s) => [s.slug, s.judul]), query.skema);
  const qInput = h("input", { type: "search", class: INPUT, value: query.q, autocomplete: "off", placeholder: "Nama atau email" });
  mount(document.getElementById("filters"),
    h("form", { role: "search", class: "grid gap-3 sm:grid-cols-2 lg:max-w-xl", on: { submit: (e) => e.preventDefault() } },
      field("f-skema", "Skema", skemaSel), field("f-q", "Cari peserta", qInput)));
  const reload = () => { query.page = "1"; load(); };
  skemaSel.addEventListener("change", () => { query.skema = skemaSel.value; reload(); });
  qInput.addEventListener("input", debounce(() => { query.q = qInput.value.trim(); reload(); }));
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, { ...DEFAULTS, skema: defaultSkema });
  mount(state, loadingState());
  const p = new URLSearchParams({ limit: "20", page: query.page });
  for (const k of ["skema", "q"]) if (query[k]) p.set(k, query[k]);
  try {
    const res = await api.get("/admin/progress?" + p);
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
  disposeChart(funnelChart);
  funnelChart = null;
  const f = res.funnel || [];
  funnelSection.classList.toggle("hidden", !f.length);
  if (f.length) {
    const canvas = h("canvas", { role: "img", "aria-label": `Jumlah peserta yang membuka dan menyelesaikan tiap modul alur; angkanya ada di tabel di bawah grafik.` });
    mount(funnelBox,
      h("div", { class: `${CARD} p-4` }, h("div", { class: f.length > 12 ? "h-[36rem]" : "h-80" }, canvas)),
      table("Corong modul alur", ["Modul", "Dikunjungi", "Selesai"], f.map((m) => [m.judul, String(m.dikunjungi), String(m.selesai)])));
    funnelChart = makeChart(canvas, (t) => ({
      type: "bar",
      data: { labels: f.map((m) => trunc(m.judul)), datasets: [
        { label: "Dikunjungi", data: f.map((m) => m.dikunjungi), backgroundColor: t.c.trial, borderRadius: 4 },
        { label: "Selesai", data: f.map((m) => m.selesai), backgroundColor: t.c.approved, borderRadius: 4 },
      ] },
      options: { indexAxis: "y", scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
    }));
  }

  if (!res.peserta.length) {
    mount(list, emptyState("Belum ada peserta yang cocok pada skema ini."));
    mount(pager);
    return;
  }
  mount(list, table("Progres peserta", ["Peserta", "Status", "Progres alur", "Terakhir aktif"],
    res.peserta.map((x) => {
      const [label, tone] = STATUS[x.status] || [x.status, "neutral"];
      return [
        h("div", { class: "flex items-center gap-3" }, avatar(x.name), h("div", { class: "min-w-0" }, link(`/admin/users-detail/?id=${encodeURIComponent(x.user_id)}`, x.name), h("div", { class: "text-xs text-muted-foreground-1", text: x.email }))),
        badge(label, tone),
        res.total_alur > 0
          ? h("div", { class: "flex items-center gap-2" },
            h("progress", { class: "meter w-28", value: String(x.selesai), max: String(res.total_alur), "aria-label": `Progres ${x.name}: ${x.selesai} dari ${res.total_alur} modul` }),
            h("span", { class: "text-xs text-muted-foreground-1", text: `${x.selesai} / ${res.total_alur}` }))
          : "—",
        orDash(formatDateTime(x.terakhir)),
      ];
    })));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
