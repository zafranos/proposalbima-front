import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { applyContent, prepare, readCache, writeCache } from "../landing/hydrate.js";
import { formatDate, h, icon, mount } from "../ui.js";

// Teks landing dapat disunting admin. HTML sudah memuat teks bawaan (itu yang dibaca mesin pencari); di sini
// isi terakhir yang dikenal dari peramban langsung diterapkan, lalu disegarkan dari server. Tanpa API,
// teks bawaan tetap tampil.
prepare(document); // potret teks bawaan sebelum apa pun berubah
const cached = readCache();
if (cached) applyContent(document, cached);
const refreshLanding = api.get("/api/landing", { noFollow: true }).then((res) => {
  applyContent(document, res.content);
  writeCache(res.content);
}).catch(() => { /* tanpa API: isi yang tampil tetap */ });

// Pengguna yang sudah masuk melihat jalan pintas ke materi di tempat tombol daftar. Tombol itu (dan teks
// data-edit di dalamnya) terganti seluruhnya, jadi isi landing yang tiba belakangan tidak menimpanya.
if (session.isLoggedIn()) {
  const lanjut = (cls) => h("a", { href: api.withBase("/modul/?slug=beranda"), class: cls }, "Lanjutkan ke materi", icon("arrow-right", "size-5"));
  mount(document.getElementById("cta"), lanjut("btn btn-primary btn-lg"));
  mount(document.getElementById("cta-header"), h("a", { href: api.withBase("/modul/?slug=beranda"), class: "btn btn-primary btn-sm", text: "Ke materi" }));
  mount(document.getElementById("cta-bottom"), lanjut("btn btn-lg bg-white text-primary-900 hover:bg-primary-50"));
}

// Kartu skema dan sumber aturan diambil dari API publik supaya selalu sama dengan isi yang sebenarnya. Isi statis di HTML tetap sebagai cadangan bila API tak terjangkau.
const IKON = { dasar: "flask", terapan: "wrench" };
async function loadSkema() {
  try {
    const res = await api.get("/api/skema", { noFollow: true });
    const cards = document.getElementById("skema-cards");
    if (cards && Array.isArray(res.skema) && res.skema.length) {
      mount(cards, res.skema.map((s) =>
        h("article", { class: "card card-pad flex flex-col" },
          h("span", { class: "grid size-12 place-items-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300" }, icon(IKON[s.slug] || "layers", "size-6")),
          h("h3", { class: "mt-6 font-display text-3xl font-medium", text: s.judul }),
          h("p", { class: "mt-3 flex-1 text-[15px] leading-7 text-muted-foreground-1", text: s.ringkasan }),
          h("p", { class: "mt-4 flex items-center gap-2 text-sm font-medium" }, icon("list-checks", "size-4 text-primary-700 dark:text-primary-300"), `${s.jumlah_modul_alur} modul alur`),
          h("a", { href: api.withBase(`/register/?skema=${encodeURIComponent(s.slug)}`), class: "btn btn-outline mt-6 self-start" }, "Daftar dengan skema ini", icon("arrow-right")))));
    }
    const sumber = res.content_version && res.content_version.sumber;
    if (sumber) {
      const tgl = formatDate(res.content_version.tanggal);
      document.querySelectorAll("[data-sumber]").forEach((el) => { el.textContent = tgl ? `${sumber} (materi diperbarui ${tgl})` : sumber; });
    }
  } catch { /* tanpa API: isi statis tetap tampil */ }
}

await Promise.all([refreshLanding, loadSkema()]);
