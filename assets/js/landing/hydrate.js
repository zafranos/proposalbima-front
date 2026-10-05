// Menerapkan isi landing yang disunting admin ke halaman statis, dan membaca teks bawaan halaman itu.
//
// Halaman landing memuat teks bawaan langsung di HTML (itulah yang dibaca mesin pencari dan tampil tanpa
// JavaScript). Elemen yang boleh disunting diberi atribut:
//   data-edit="jalur"     teks elemen diganti (textContent, tidak pernah HTML)
//   data-list="jalur"     anak-anaknya adalah butir daftar; butir pertama menjadi cetakan untuk butir baru
//   data-field="kunci"    di dalam butir: elemen yang diisi dari butir itu (data-optional = disembunyikan bila kosong)
// Isi dari server hanya menimpa: jalur yang tidak ada di isi tetap memakai teks bawaan.
const CACHE_KEY = "pdk_landing";

const defaultText = new WeakMap(); // elemen data-edit -> teks bawaan
const defaultItems = new WeakMap(); // wadah data-list -> butir bawaan (salinan)
const appliedKey = new WeakMap(); // wadah data-list -> isi yang sedang tampil ("" = bawaan), untuk melewati tulis ulang

// Salinan butir untuk cetakan dan pemulihan: keadaan interaksi (mis. <details open>) tidak ikut terbawa.
function pristine(node) {
  const c = node.cloneNode(true);
  for (const el of [c, ...c.querySelectorAll("[open]")]) el.removeAttribute("open");
  return c;
}

// Memotret teks bawaan SEBELUM ada yang menyentuhnya. Panggil sekali di awal modul halaman: potret yang diambil
// belakangan (setelah API menjawab) bisa menangkap butir yang sudah dibuka pengunjung. Idempoten.
export function prepare(root) {
  for (const el of root.querySelectorAll("[data-edit]")) if (!defaultText.has(el)) defaultText.set(el, el.textContent);
  for (const box of root.querySelectorAll("[data-list]")) {
    if (!defaultItems.has(box)) { defaultItems.set(box, [...box.children].map(pristine)); appliedKey.set(box, ""); }
  }
}

function fillItem(node, item) {
  for (const el of node.querySelectorAll("[data-field]")) {
    const v = item[el.dataset.field];
    const text = typeof v === "string" ? v : "";
    el.textContent = text;
    if (el.hasAttribute("data-optional")) el.hidden = text === "";
  }
}

// Menerapkan content ({fields, lists} atau null) ke root. Aman dipanggil berulang: isi lama yang tidak ada lagi
// di content dikembalikan ke teks bawaan.
export function applyContent(root, content) {
  prepare(root);
  const fields = (content && content.fields) || {};
  const lists = (content && content.lists) || {};
  for (const el of root.querySelectorAll("[data-edit]")) {
    const v = fields[el.dataset.edit];
    const next = typeof v === "string" && v !== "" ? v : defaultText.get(el);
    if (el.textContent !== next) el.textContent = next;
  }
  for (const box of root.querySelectorAll("[data-list]")) {
    const base = defaultItems.get(box);
    const raw = lists[box.dataset.list];
    const items = Array.isArray(raw) ? raw.filter((it) => it && typeof it === "object") : [];
    const key = base.length && items.length ? JSON.stringify(items) : "";
    // Isi yang sama dengan yang sedang tampil tidak ditulis ulang: pengunjung yang sedang membuka butir FAQ atau
    // memfokuskannya tidak boleh kehilangan keadaan itu hanya karena jawaban API tiba.
    if (appliedKey.get(box) === key) continue;
    appliedKey.set(box, key);
    box.replaceChildren(...(key
      ? items.map((it) => { const node = pristine(base[0]); fillItem(node, it); return node; })
      : base.map(pristine)));
  }
}

// Teks bawaan sebuah dokumen yang BELUM dihidrasi (mis. hasil DOMParser atas HTML landing):
//   { fields: { jalur: teks }, lists: { jalur: [ { kunci: teks } ] } }
export function readDefaults(root) {
  const fields = {};
  for (const el of root.querySelectorAll("[data-edit]")) fields[el.dataset.edit] = collapse(el.textContent);
  const lists = {};
  for (const box of root.querySelectorAll("[data-list]")) {
    lists[box.dataset.list] = [...box.children].map((node) => {
      const item = {};
      for (const el of node.querySelectorAll("[data-field]")) {
        const t = collapse(el.textContent);
        if (t) item[el.dataset.field] = t;
      }
      return item;
    });
  }
  return { fields, lists };
}

// Spasi berulang dan baris baru tampil sebagai satu spasi di HTML; samakan agar perbandingan tidak terkecoh.
export function collapse(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

// ── Cache peramban: landing langsung tampil dengan isi terakhir yang dikenal, lalu disegarkan dari server. ──
export function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return c && typeof c === "object" && c.fields && c.lists ? c : null;
  } catch { return null; }
}

export function writeCache(content) {
  try {
    if (content) localStorage.setItem(CACHE_KEY, JSON.stringify(content));
    else localStorage.removeItem(CACHE_KEY);
  } catch { /* penyimpanan tak tersedia: abaikan */ }
}
