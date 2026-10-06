// Pembaca materi: sidebar modul dengan progres, isi (dengan tab untuk varian Terapan),
// daftar isi, unduhan, tandai selesai, dan navigasi sebelumnya/berikutnya.
import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import * as session from "../session.js";
import { setupDrawer } from "../drawer.js";
import { badge, formatBytes, formatDate, h, icon, mount, toast } from "../ui.js";
import { enhanceContent } from "../reader/enhance.js";
import { renderTabs } from "../reader/tabs.js";
import { buildToc } from "../reader/toc.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const slug = params.get("slug") || "beranda";

const GROUPS = [["beranda", null], ["alur", "Alur penyusunan"], ["referensi", "Referensi"], ["lampiran", "Lampiran"]];
const PROSE = "article"; // tipografi isi materi: lihat .article di input.css
// Penanda di kiri butir hanya menyatakan STATUS (selesai, terkunci, aktif); jenisnya (ikon) hanya untuk non-alur.
const GRUP_IKON = { beranda: "home", referensi: "book-open", lampiran: "file-text" };

let home = null;

// Laci daftar modul di layar sempit (di layar lebar sidebar selalu tampil).
setupDrawer({
  panel: $("sidebar"), toggles: [$("sidebar-toggle")], closers: [$("sidebar-close"), $("sidebar-backdrop")], label: "Daftar modul",
  inertTargets: () => [$("topbar"), $("page-main"), $("skip-link")],
});

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
    if (err.status === 404) return showMessage("Modul tidak ditemukan", "Modul yang Anda buka tidak ada.", [["Ke Beranda", "/modul/?slug=beranda"]]);
    return showMessage("Tidak dapat memuat modul", err.message);
  }
  paintModul(modul);
}

function showMessage(title, text, links = []) {
  const box = $("content");
  mount(box,
    h("h1", { class: "font-display text-4xl font-medium tracking-tight", text: title }),
    h("p", { class: "mt-3 text-muted-foreground-1", text }),
    links.length ? h("p", { class: "mt-6 flex gap-3" }, ...links.map(([t, href]) => h("a", { href: api.withBase(href), class: "btn btn-primary", text: t }))) : null,
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
  const box = $("akses-badge");
  if (home.akses === "preview") {
    mount(box, badge(home.trial && home.trial.habis ? "Trial berakhir: mode pratinjau" : "Mode pratinjau", "pending"));
  } else if (home.trial && !home.trial.habis) {
    mount(box, badge(`Trial, sisa ${home.trial.sisa_hari} hari`, "trial"));
  } else {
    mount(box, badge("Akses penuh", "ok"));
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
      h("summary", { class: "flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground-1 hover:bg-muted-hover" },
        h("span", { text: label }), icon("chevron-down", "size-4 transition-transform group-open:rotate-180")),
      h("div", { class: "mt-1" }, list));
  }));
}

// Judul modul berbentuk "Modul 3: Menyusun pustaka" atau "A. Aturan ...": kode di depan dijadikan
// label kecil dan sisanya judul, agar daftar mudah dipindai.
function splitTitle(judul) {
  const m = /^([^:]{1,14}):\s+(.+)$/.exec(judul) || /^([A-D])\.\s+(.+)$/.exec(judul);
  return m ? { code: m[1], title: m[2] } : { code: "", title: judul };
}

function navItem(m) {
  const { code, title } = splitTitle(m.judul);
  const text = h("span", { class: "min-w-0" },
    code ? h("span", { class: "block text-[11px] font-semibold uppercase tracking-wider opacity-70", text: code }) : null,
    h("span", { class: "block", text: title }));
  if (m.terkunci) {
    return h("span", { class: "nav-item", "aria-disabled": "true", title: "Terbuka setelah akun disetujui admin" },
      h("span", { class: "nav-dot" }, icon("lock", "size-3")), text, h("span", { class: "sr-only", text: "(terkunci)" }));
  }
  const on = m.slug === slug;
  const dot = m.selesai
    ? h("span", { class: "nav-dot nav-dot-done" }, icon("check", "size-3"))
    : h("span", { class: "nav-dot" }, GRUP_IKON[m.grup] ? icon(GRUP_IKON[m.grup], "size-3") : null); // alur: cincin kosong = belum selesai
  return h("a", { href: api.withBase("/modul/?slug=" + encodeURIComponent(m.slug)), "aria-current": on ? "page" : null, class: "nav-item" },
    dot, text, m.selesai ? h("span", { class: "sr-only", text: "(selesai)" }) : null);
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
    groupLabel ? h("p", { class: "eyebrow mb-3 flex", text: groupLabel }) : null,
    rv ? h("aside", { class: "alert alert-info mb-6 flex gap-3", role: "note" },
      icon("info", "mt-0.5 size-4"),
      h("p", {}, rv.teks + " ", h("a", { class: "font-medium underline", href: api.withBase(`/modul/?slug=${encodeURIComponent(rv.modul)}&bagian=${encodeURIComponent(rv.bagian)}`), text: "Buka bagian itu" }), ".")) : null,
    tabs ? tabs.el : null,
    ...parts.map((b) => panels[b.kunci]),
    downloadsBlock(modul),
    completeBlock(modul),
    pagerBlock(modul),
    h("p", { class: "mt-12 border-t border-line-2 pt-5 text-xs text-muted-foreground-1", text: `Materi per ${formatDate(modul.content_version.tanggal)}. Sumber aturan: ${modul.content_version.sumber}.` }),
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
  return h("section", { class: "mt-12", "aria-labelledby": "unduhan-judul" },
    h("h2", { id: "unduhan-judul", class: "font-display text-2xl font-medium tracking-tight", text: "Berkas unduhan" }),
    h("ul", { class: "mt-4 space-y-2" }, ...modul.unduhan.map((f) =>
      h("li", {}, h("button", {
        type: "button", class: "btn btn-outline w-full justify-between sm:w-auto sm:min-w-80",
        on: { click: () => downloadFile(f.id, f.nama) },
      }, h("span", { class: "inline-flex items-center gap-2" }, icon("download", "size-4"), h("span", { text: f.nama })),
        h("span", { class: "text-xs text-muted-foreground-1", text: formatBytes(f.ukuran) }))))));
}

function completeBlock(modul) {
  if (modul.grup !== "alur") return null;
  if (!modul.dapat_selesai) {
    return h("p", { class: "alert alert-info mt-12", text: "Progres hanya tersimpan setelah akun Anda disetujui admin." });
  }
  let done = modul.selesai;
  const btn = h("button", { type: "button", class: "btn" });
  const paint = () => {
    // Keadaan ada di teks tombol; aria-pressed bersama teks yang berubah akan terbaca ganda.
    btn.dataset.label = "";
    btn.replaceChildren(icon(done ? "check-circle" : "check", "size-4"), h("span", { text: done ? "Selesai (klik untuk membatalkan)" : "Tandai selesai" }));
    btn.className = `btn btn-lg ${done ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100" : "btn-primary"}`;
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
  return h("div", { class: "mt-12" }, btn);
}

function pagerBlock(modul) {
  const link = (m, dir) => {
    if (!m) return h("span", {});
    const body = [dir === "prev" ? icon("chevron-left", "size-4") : null, h("span", { class: "min-w-0" }, h("span", { class: "block text-xs text-muted-foreground-1", text: dir === "prev" ? "Sebelumnya" : "Berikutnya" }), h("span", { class: "block truncate text-sm font-medium", text: m.judul })), dir === "next" ? icon("chevron-right", "size-4") : null];
    const cls = "card flex min-w-0 items-center gap-3 p-4 transition-colors";
    return m.terkunci
      ? h("span", { class: `${cls} cursor-not-allowed text-muted-foreground-1`, "aria-disabled": "true" }, ...body, icon("lock", "size-3.5"))
      : h("a", { href: api.withBase("/modul/?slug=" + encodeURIComponent(m.slug)), class: `${cls} hover:bg-muted-hover ${dir === "next" ? "justify-end text-end" : ""}` }, ...body);
  };
  return h("nav", { class: "mt-8 grid gap-3 sm:grid-cols-2", "aria-label": "Navigasi modul" }, link(modul.prev, "prev"), link(modul.next, "next"));
}
