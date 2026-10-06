// Peningkatan isi materi yang sudah dirender server (HTML dari backend; sudah dilint tanpa
// <script>, handler inline, atau atribut style). Semua perubahan lewat DOM; tidak ada innerHTML baru.
import { withBase } from "../api.js";
import { copyText, h, icon, scrollRegion, toast } from "../ui.js";

// Isian yang harus peserta ganti sebelum prompt ditempel, ditulis [ISI: ...] di dalam pagar kode.
// Disorot tanpa mengubah teks, jadi salinan tetap utuh. Tanda lain di dalam prompt, mis. [sebutkan]
// atau [BUTUH RUJUKAN], adalah bagian dari bentuk jawaban yang diminta dari AI, jadi tidak disorot.
const MARKER = /\[ISI[^\]\n]*\]/g;

const COPY_BTN = "btn btn-primary btn-sm";

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
    const wrap = h("div", { class: "my-6 overflow-x-auto rounded-xl border border-line-2", data: { tableWrap: "1" } });
    t.replaceWith(wrap);
    wrap.append(t);
    scrollRegion(wrap, "Tabel (dapat digulir)");
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
        frag.append(h("mark", { text: m[0] })); // gaya stabilo dari aturan mark di input.css
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.append(text.slice(last));
      node.replaceWith(frag);
    }
  });
}

function copyButton(getText, label = "Salin", accessibleName = "") {
  const btn = h("button", { type: "button", class: COPY_BTN, "aria-label": accessibleName || null }, icon("copy", "size-3.5"), h("span", { text: label }));
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

// Kartu salin-tempel: pagar kode pertama di bawah heading "Prompt ..." (sebelum heading setingkat
// atau lebih tinggi berikutnya) dibungkus dengan batang judul dan tombol Salin. Prompt perbaikan
// di bawah heading lain tetap dapat disalin, lewat tombol kecil dari copyOtherPre.
function cardify(root) {
  root.querySelectorAll("h2, h3").forEach((heading) => {
    if (!/^Prompt\b/.test(heading.textContent.trim())) return;
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
  const wrap = h("div", { class: isCard ? "code-card" : "code-block", data: { preWrap: "1" } });
  if (isCard) {
    // highlightMarkers sudah jalan sebelum cardify, jadi <mark> menandai prompt yang masih perlu diisi.
    const perluIsi = !!pre.querySelector("mark");
    wrap.append(h("div", { class: "code-card-head" },
      h("span", { class: "flex min-w-0 items-center gap-2 text-sm font-semibold text-primary-900 dark:text-primary-100" },
        icon("sparkles", "size-4 text-primary-700 dark:text-primary-300"), h("span", { class: "truncate", text: "Prompt untuk disalin" }),
        perluIsi ? h("span", { class: "hidden text-xs font-normal text-muted-foreground-1 sm:inline", text: "Ganti dulu bagian yang disorot" }) : null),
      copyButton(text, "Salin prompt", "Salin prompt untuk ditempel ke AI Anda")));
    wrap.dataset.card = title;
  } else {
    const btn = copyButton(text, "Salin");
    btn.classList.add("absolute", "right-3", "top-3");
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
  hr.after(h("div", { class: "alert alert-info my-6 flex flex-wrap items-center justify-between gap-3" },
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
