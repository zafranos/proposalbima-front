// Pembaca materi: sidebar modul dengan progres, isi (dengan tab untuk varian Terapan),
// daftar isi, unduhan, tandai selesai, dan navigasi sebelumnya/berikutnya.
import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import * as session from "../session.js";
import { badge, formatBytes, formatDate, h, icon, mount, toast } from "../ui.js";
import { enhanceContent } from "../reader/enhance.js";
import { renderTabs } from "../reader/tabs.js";
import { buildToc } from "../reader/toc.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const slug = params.get("slug") || "beranda";

const GROUPS = [["beranda", null], ["alur", "Alur penyusunan"], ["referensi", "Referensi"], ["lampiran", "Lampiran"]];
const PROSE = "prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary-700 dark:prose-a:text-primary-300 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal";
const BTN = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 disabled:opacity-50";

let home = null;

if (auth.requireLogin()) await main();

async function main() {
  paintUser(session.getUser());
  try {
    home = await api.get("/home");
  } catch (err) {
    return showMessage("Tidak dapat memuat materi", err.message);
  }
  paintTopbar();
  paintSidebar();
  auth.loadMe({ noFollow: true }).then((me) => paintUser(me.user)).catch(() => {});

  let modul = null;
  try {
    modul = await api.get("/modul/" + encodeURIComponent(slug), { noFollow: true });
  } catch (err) {
    const target = api.safePath(err.data && err.data.redirect);
    if ((err.status === 403 || err.status === 409) && target && !target.startsWith("/pending-approval")) {
      api.go(target);
      return;
    }
    if (err.status === 403) return showMessage("Modul ini terkunci", err.message, [["Lihat status akun", "/pending-approval/"]]);
    if (err.status === 404) return showMessage("Modul tidak ditemukan", "Modul yang Anda buka tidak ada untuk skema ini.", [["Ke Beranda", "/modul/?slug=beranda"]]);
    return showMessage("Tidak dapat memuat modul", err.message);
  }
  paintModul(modul);
}

function showMessage(title, text, links = []) {
  const box = $("content");
  mount(box,
    h("h1", { class: "text-2xl font-bold", text: title }),
    h("p", { class: "mt-3 text-muted-foreground-1", text }),
    links.length ? h("p", { class: "mt-5 flex gap-3" }, ...links.map(([t, href]) => h("a", { href: api.withBase(href), class: `${BTN} bg-primary text-primary-foreground hover:bg-primary-hover`, text: t }))) : null,
  );
  document.title = title + " | Proposal DIKTI";
  box.focus({ preventScroll: true });
}

// ── Bilah atas ──
function paintUser(user) {
  if (!user) return;
  const link = $("user-link");
  link.textContent = user.name || "Profil";
  $("admin-link").classList.toggle("hidden", user.role !== "admin");
}

function paintTopbar() {
  $("skema-name").textContent = `Skema ${home.skema.judul}`;
  $("skema-name-side").textContent = `Skema ${home.skema.judul}`;
  const box = $("akses-badge");
  if (home.akses === "preview") {
    mount(box, badge(home.trial && home.trial.habis ? "Trial berakhir: mode pratinjau" : "Mode pratinjau", "amber"));
  } else if (home.trial && !home.trial.habis) {
    mount(box, badge(`Trial, sisa ${home.trial.sisa_hari} hari`, "sky"));
  } else {
    mount(box, badge("Akses penuh", "teal"));
  }
}

// ── Sidebar ──
function paintSidebar() {
  const p = home.progres;
  $("progress-text").textContent = `${p.selesai} dari ${p.total} selesai`;
  const bar = $("progress-bar");
  bar.max = Math.max(p.total, 1);
  bar.value = p.selesai;

  const current = home.moduls.find((m) => m.slug === slug);
  mount($("nav"), GROUPS.map(([grup, label]) => {
    const items = home.moduls.filter((m) => m.grup === grup);
    if (!items.length) return null;
    const list = h("ul", { class: "space-y-0.5" }, ...items.map((m) => h("li", {}, navItem(m))));
    if (!label) return list;
    return h("details", { open: grup === "alur" || (current && current.grup === grup), class: "group" },
      h("summary", { class: "flex cursor-pointer list-none items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground-1 hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary-focus" },
        h("span", { text: label }), icon("chevron-down", "size-4 transition-transform group-open:rotate-180")),
      h("div", { class: "mt-1" }, list));
  }));
}

function navItem(m) {
  const base = "flex items-start gap-2 rounded-lg px-2.5 py-2 text-sm leading-snug";
  if (m.terkunci) {
    return h("span", { class: `${base} cursor-not-allowed text-muted-foreground-1`, "aria-disabled": "true", title: "Terbuka setelah akun disetujui admin" },
      icon("lock", "mt-0.5 size-3.5"), h("span", { text: m.judul }), h("span", { class: "sr-only", text: "(terkunci)" }));
  }
  const on = m.slug === slug;
  return h("a", {
    href: api.withBase("/modul/?slug=" + encodeURIComponent(m.slug)),
    "aria-current": on ? "page" : null,
    class: `${base} hover:bg-sidebar-nav-hover focus:outline-none focus:ring-2 focus:ring-primary-focus ${on ? "bg-primary-50 font-medium text-primary-900 dark:bg-primary-950 dark:text-primary-100" : "text-sidebar-nav-foreground"}`,
  }, m.selesai ? icon("check", "mt-0.5 size-3.5 text-teal-700 dark:text-teal-300") : h("span", { class: "mt-0.5 size-3.5 shrink-0" }),
    h("span", { text: m.judul }), m.selesai ? h("span", { class: "sr-only", text: "(selesai)" }) : null);
}

// ── Isi modul ──
function paintModul(modul) {
  document.title = `${modul.judul} | Proposal DIKTI`;
  const groupLabel = (GROUPS.find(([g]) => g === modul.grup) || [])[1];
  const box = $("content");
  const panels = {};
  const parts = modul.bagian;
  for (const b of parts) {
    const panel = h("div", { class: PROSE });
    panel.innerHTML = b.html; // HTML dari backend: dirender goldmark tanpa HTML mentah dan dilint saat sinkron
    enhanceContent(panel, { salinTeks: b.salin_teks, download: (id, nama) => downloadFile(id, nama) });
    panels[b.kunci] = panel;
  }

  const wanted = params.get("bagian");
  const initial = parts.some((b) => b.kunci === wanted) ? wanted : parts[0].kunci;
  let tabs = null;
  const showToc = (key) => buildToc(panels[key], $("toc-nav"), $("toc-nav-mobile"));
  if (parts.length > 1) {
    tabs = renderTabs(parts, panels, initial, (key) => {
      const u = new URL(location.href);
      u.searchParams.set("bagian", key);
      history.replaceState(null, "", u);
      showToc(key);
    });
  } else {
    panels[initial].id = "panel-" + initial;
  }

  const rv = modul.rujukan_varian;
  mount(box,
    groupLabel ? h("p", { class: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground-1", text: groupLabel }) : null,
    rv ? h("aside", { class: "mb-6 flex gap-3 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100", role: "note" },
      icon("info", "mt-0.5 size-4"),
      h("p", {}, rv.teks + " ", h("a", { class: "font-medium underline", href: api.withBase(`/modul/?slug=${encodeURIComponent(rv.modul)}&bagian=${encodeURIComponent(rv.bagian)}`), text: "Buka bagian itu" }), ".")) : null,
    tabs ? tabs.el : null,
    ...parts.map((b) => panels[b.kunci]),
    downloadsBlock(modul),
    completeBlock(modul),
    pagerBlock(modul),
    h("p", { class: "mt-10 border-t border-line-2 pt-4 text-xs text-muted-foreground-1", text: `Materi per ${formatDate(modul.content_version.tanggal)}. Sumber aturan: ${modul.content_version.sumber}.` }),
  );
  showToc(initial);

  // Tautan #heading ke bagian yang sedang tersembunyi: pindah tab dulu.
  if (location.hash && tabs) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const owner = target && parts.find((b) => panels[b.kunci].contains(target));
    if (owner && owner.kunci !== initial) { tabs.select(owner.kunci, true); }
  }
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

async function downloadFile(id, nama) {
  try {
    await api.download("/berkas/" + encodeURIComponent(id), nama);
  } catch (err) {
    toast(err.message, "error");
  }
}

function downloadsBlock(modul) {
  if (!modul.unduhan || !modul.unduhan.length) return null;
  return h("section", { class: "mt-10", "aria-labelledby": "unduhan-judul" },
    h("h2", { id: "unduhan-judul", class: "text-lg font-semibold", text: "Berkas unduhan" }),
    h("ul", { class: "mt-3 space-y-2" }, ...modul.unduhan.map((f) =>
      h("li", {}, h("button", {
        type: "button", class: `${BTN} w-full justify-between border border-line-3 bg-layer hover:bg-layer-hover sm:w-auto sm:min-w-80`,
        on: { click: () => downloadFile(f.id, f.nama) },
      }, h("span", { class: "inline-flex items-center gap-2" }, icon("download", "size-4"), h("span", { text: f.nama })),
        h("span", { class: "text-xs text-muted-foreground-1", text: formatBytes(f.ukuran) }))))));
}

function completeBlock(modul) {
  if (modul.grup !== "alur") return null;
  if (!modul.dapat_selesai) {
    return h("p", { class: "mt-10 rounded-lg border border-line-2 bg-layer p-4 text-sm text-muted-foreground-1", text: "Progres hanya tersimpan setelah akun Anda disetujui admin." });
  }
  let done = modul.selesai;
  const btn = h("button", { type: "button", class: BTN });
  const paint = () => {
    btn.setAttribute("aria-pressed", String(done));
    btn.dataset.label = "";
    btn.replaceChildren(icon(done ? "check-circle" : "check", "size-4"), h("span", { text: done ? "Selesai (klik untuk membatalkan)" : "Tandai selesai" }));
    btn.className = `${BTN} ${done ? "border border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-100" : "bg-primary text-primary-foreground hover:bg-primary-hover"}`;
  };
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const res = done ? await api.del(`/modul/${encodeURIComponent(modul.slug)}/complete`) : await api.post(`/modul/${encodeURIComponent(modul.slug)}/complete`);
      done = res.selesai;
      home.progres = res.progres;
      const item = home.moduls.find((m) => m.slug === modul.slug);
      if (item) item.selesai = done;
      paint();
      paintSidebar();
      toast(done ? "Modul ditandai selesai." : "Tanda selesai dibatalkan.");
    } catch (err) {
      toast(err.message, "error");
    }
    btn.disabled = false;
  });
  paint();
  return h("div", { class: "mt-10" }, btn);
}

function pagerBlock(modul) {
  const link = (m, dir) => {
    if (!m) return h("span", {});
    const body = [dir === "prev" ? icon("chevron-left", "size-4") : null, h("span", { class: "min-w-0" }, h("span", { class: "block text-xs text-muted-foreground-1", text: dir === "prev" ? "Sebelumnya" : "Berikutnya" }), h("span", { class: "block truncate text-sm font-medium", text: m.judul })), dir === "next" ? icon("chevron-right", "size-4") : null];
    const cls = "flex min-w-0 items-center gap-3 rounded-lg border border-line-2 p-3";
    return m.terkunci
      ? h("span", { class: `${cls} cursor-not-allowed text-muted-foreground-1`, "aria-disabled": "true" }, ...body, icon("lock", "size-3.5"))
      : h("a", { href: api.withBase("/modul/?slug=" + encodeURIComponent(m.slug)), class: `${cls} hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary-focus ${dir === "next" ? "justify-end text-end" : ""}` }, ...body);
  };
  return h("nav", { class: "mt-8 grid gap-3 sm:grid-cols-2", "aria-label": "Navigasi modul" }, link(modul.prev, "prev"), link(modul.next, "next"));
}
