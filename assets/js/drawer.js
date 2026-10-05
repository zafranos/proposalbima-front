// Laci samping untuk layar sempit (sidebar pembaca dan admin); di layar lebar panel selalu tampil dan modul
// ini tidak berbuat apa-apa. Tanpa pustaka. Perilakunya mengikuti pola dialog modal:
//  - tombol pembuka memuat aria-expanded yang selalu mengikuti keadaan sebenarnya
//  - bagian halaman lain diberi `inert` selama laci terbuka (fokus Tab dan pembaca layar tidak "bocor" ke belakang
//    laci, tanpa jebakan Tab buatan; semua elemen di dalam laci, termasuk <summary>, tetap terjangkau)
//  - Esc menutup, fokus berpindah ke dalam laci saat dibuka, dan kembali ke tombol saat ditutup
//  - role="dialog" aria-modal hanya terpasang selama laci benar-benar modal (terbuka di layar sempit)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

// panel: elemen laci. toggles: tombol pembuka. closers: tombol/elemen penutup (tombol tutup, latar).
// inertTargets: fungsi yang mengembalikan elemen halaman yang harus dikunci saat laci terbuka.
// label: nama laci. query: lebar layar tempat panel selalu tampil.
export function setupDrawer({ panel, toggles, closers = [], inertTargets = () => [], label, query = "(min-width: 1024px)" }) {
  const wide = window.matchMedia(query);
  let isOpen = false;
  let opener = null;

  const apply = (open, restoreFocus) => {
    isOpen = open;
    panel.classList.toggle("is-open", open);
    panel.classList.toggle("invisible", !open);
    panel.classList.toggle("-translate-x-full", !open);
    toggles.forEach((t) => t.setAttribute("aria-expanded", String(open)));
    closers.forEach((c) => c.classList.toggle("hidden", !open && c.dataset.backdrop === "1"));
    inertTargets().forEach((el) => { if (el) el.inert = open; });
    if (open) {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", label);
      const first = panel.querySelector(FOCUSABLE);
      (first || panel).focus();
    } else {
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
      panel.removeAttribute("aria-label");
      if (restoreFocus && opener) opener.focus();
    }
  };

  toggles.forEach((t) => t.addEventListener("click", () => { opener = t; apply(!isOpen, true); }));
  closers.forEach((c) => c.addEventListener("click", () => apply(false, true)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen) { e.preventDefault(); apply(false, true); } });
  // Layar melebar saat laci terbuka: panel menjadi tetap, jadi buang keadaan modalnya.
  wide.addEventListener("change", () => { if (isOpen) apply(false, false); });
  apply(false, false);
  return { open: () => apply(true, false), close: () => apply(false, true), isOpen: () => isOpen };
}
