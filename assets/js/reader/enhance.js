// Peningkatan isi materi yang sudah dirender server (HTML dari backend; sudah dilint tanpa
// <script>, handler inline, atau atribut style). Semua perubahan lewat DOM; tidak ada innerHTML baru.
import { withBase } from "../api.js";
import { copyText, h, icon, toast } from "../ui.js";

// Penanda isian yang disorot di dalam pagar kode (tanpa mengubah teks, jadi salinan tetap utuh).
// Huruf kecil seperti [judul kerja] dan penanda bukan-isian seperti [S1] atau [K001] tidak disorot.
const MARKER = new RegExp(
  "\\[(?:ISI[^\\]\\n]*|DATA-DIBUTUHKAN[^\\]\\n]*|VERIFIKASI|USUL|HARGA-PERLU-DIISI|KONFIRMASI LPPM|PERIKSA KESESUAIAN|KOSONG|DATA-KURANG[^\\]\\n]*|PERLU KLARIFIKASI|TIDAK DIBACA|KUNCI TIDAK ADA DI DAFTAR KUNCI[^\\]\\n]*)\\]",
  "g",
);

const PRE_CLASS = "m-0 overflow-x-auto whitespace-pre-wrap break-words bg-muted p-4 font-mono text-sm leading-relaxed text-foreground";
const COPY_BTN = "inline-flex items-center gap-1.5 rounded-md border border-line-3 bg-layer px-2.5 py-1 text-xs font-medium text-layer-foreground hover:bg-layer-hover focus:outline-none focus:ring-2 focus:ring-primary-focus";

export function enhanceContent(root, { salinTeks = "", download } = {}) {
  wrapTables(root);
  highlightMarkers(root);
  cardify(root);
  copyOtherPre(root);
  if (salinTeks) addInstructionCopy(root, salinTeks);
  // Urutan penting: tangkap id unduhan dari href asli SEBELUM href diberi awalan situs.
  interceptDownloads(root, download);
  prefixInternalLinks(root);
  root.querySelectorAll("h1,h2,h3,h4").forEach((el) => el.classList.add("scroll-mt-20"));
}

function wrapTables(root) {
  root.querySelectorAll("table").forEach((t) => {
    if (t.parentElement.dataset.tableWrap) return;
    const wrap = h("div", { class: "my-4 overflow-x-auto", data: { tableWrap: "1" }, role: "region", tabindex: "0", "aria-label": "Tabel (dapat digulir)" });
    t.replaceWith(wrap);
    wrap.append(t);
    t.classList.add("text-sm");
  });
}

function highlightMarkers(root) {
  root.querySelectorAll("pre code").forEach((code) => {
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      MARKER.lastIndex = 0;
      if (!MARKER.test(text)) continue;
      MARKER.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of text.matchAll(MARKER)) {
        if (m.index > last) frag.append(text.slice(last, m.index));
        frag.append(h("mark", { class: "rounded bg-amber-200 px-0.5 text-amber-950 dark:bg-amber-300 dark:text-amber-950", text: m[0] }));
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  });
}

function copyButton(getText, label = "Salin") {
  const btn = h("button", { type: "button", class: COPY_BTN }, icon("copy", "size-3.5"), h("span", { text: label }));
  btn.addEventListener("click", async () => {
    const ok = await copyText(getText());
    toast(ok ? "Tersalin ke papan klip." : "Gagal menyalin; pilih teksnya lalu salin manual.", ok ? "success" : "error");
    if (ok) {
      const span = btn.querySelector("span");
      span.textContent = "Tersalin";
      setTimeout(() => { span.textContent = label; }, 1800);
    }
  });
  return btn;
}

// Kartu salin-tempel: pagar kode pertama di bawah heading "Kartu ..." (sebelum heading setingkat
// atau lebih tinggi berikutnya) dibungkus dengan batang judul dan tombol Salin.
function cardify(root) {
  root.querySelectorAll("h2, h3").forEach((heading) => {
    if (!/^Kartu\s/.test(heading.textContent.trim())) return;
    const level = Number(heading.tagName[1]);
    for (let n = heading.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^H[1-6]$/.test(n.tagName) && Number(n.tagName[1]) <= level) break;
      if (n.tagName === "PRE") {
        wrapPre(n, true, heading.textContent.trim());
        break;
      }
    }
  });
}

function wrapPre(pre, isCard, title) {
  if (pre.parentElement.dataset.preWrap) return;
  const text = () => pre.textContent.replace(/\n$/, "");
  pre.className = PRE_CLASS;
  const wrap = h("div", { class: "not-prose my-4 overflow-hidden rounded-lg border border-line-2", data: { preWrap: "1" } });
  if (isCard) {
    wrap.append(h("div", { class: "flex items-center justify-between gap-2 border-b border-line-2 bg-layer px-3 py-2" },
      h("span", { class: "truncate text-xs font-medium text-muted-foreground-1", text: "Prompt untuk disalin" }),
      copyButton(text, "Salin kartu")));
    wrap.dataset.card = title;
  } else {
    wrap.classList.add("relative");
    const btn = copyButton(text, "Salin");
    btn.classList.add("absolute", "right-2", "top-2");
    wrap.append(btn);
  }
  pre.replaceWith(wrap);
  wrap.append(pre);
}

function copyOtherPre(root) {
  root.querySelectorAll("pre").forEach((pre) => wrapPre(pre, false));
}

// Instruksi proyek tidak memakai pagar kode: teks yang ditempel ada di bawah "---" pertama.
function addInstructionCopy(root, salinTeks) {
  const hr = root.querySelector("hr");
  if (!hr) return;
  hr.after(h("div", { class: "not-prose my-4 flex items-center justify-between gap-3 rounded-lg border border-line-2 bg-layer px-3 py-2" },
    h("span", { class: "text-sm", text: "Teks di bawah garis ini yang ditempel sebagai instruksi tetap." }),
    copyButton(() => salinTeks, "Salin instruksi")));
}

// Tautan /berkas/<id> butuh header Authorization, jadi diunduh lewat fetch (bukan navigasi biasa).
function interceptDownloads(root, download) {
  if (!download) return;
  root.querySelectorAll('a[href^="/berkas/"]').forEach((a) => {
    const id = decodeURIComponent(a.getAttribute("href").replace("/berkas/", ""));
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const label = a.textContent.trim();
      download(id, /\.[a-z0-9]{2,5}$/i.test(label) ? label : id);
    });
  });
}

// Tautan di isi materi dibuat backend relatif terhadap akar aplikasi ("/modul/?slug=...");
// beri awalan situs agar benar juga di situs proyek.
function prefixInternalLinks(root) {
  root.querySelectorAll('a[href^="/"]').forEach((a) => {
    const href = a.getAttribute("href");
    if (!href.startsWith("//")) a.setAttribute("href", withBase(href));
  });
}
