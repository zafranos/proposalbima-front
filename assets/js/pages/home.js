import "../common.js";
import * as api from "../api.js";
import { config } from "../config.js";
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

// Asisten obrolan pihak ketiga (hanya bila dikonfigurasi saat build). Skrip pihak ketiga berjalan di origin yang sama
// dengan token login di localStorage, jadi hanya dimuat untuk pengunjung yang BELUM masuk, dan hanya di landing.
if (config.assistantSrc && !session.isLoggedIn()) {
  document.body.append(h("script", { src: config.assistantSrc, defer: true }));
}

// Pengguna yang sudah masuk melihat jalan pintas ke materi di tempat tombol daftar. Tombol itu (dan teks
// data-edit di dalamnya) terganti seluruhnya, jadi isi landing yang tiba belakangan tidak menimpanya.
if (session.isLoggedIn()) {
  const lanjut = (cls) => h("a", { href: api.withBase("/modul/?slug=beranda"), class: cls }, "Lanjutkan ke materi", icon("arrow-right", "size-5"));
  mount(document.getElementById("cta"), lanjut("btn btn-primary btn-lg"));
  mount(document.getElementById("cta-header"), h("a", { href: api.withBase("/modul/?slug=beranda"), class: "btn btn-primary btn-sm", text: "Ke materi" }));
  mount(document.getElementById("cta-bottom"), lanjut("btn btn-lg bg-white text-primary-900 hover:bg-primary-50"));
}

// Acuan aturan diambil dari API publik supaya selalu sama dengan materi yang sebenarnya disajikan.
// Teks statis di HTML tetap menjadi cadangan bila API tak terjangkau.
async function loadInfoMateri() {
  try {
    const res = await api.get("/api/materi", { noFollow: true });
    const sumber = res.content_version && res.content_version.sumber;
    if (sumber) {
      const tgl = formatDate(res.content_version.tanggal);
      document.querySelectorAll("[data-sumber]").forEach((el) => { el.textContent = tgl ? `${sumber} (materi diperbarui ${tgl})` : sumber; });
    }
  } catch { /* tanpa API: isi statis tetap tampil */ }
}

await Promise.all([refreshLanding, loadInfoMateri()]);
