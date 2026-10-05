// Daftar isi dari heading h2/h3 hasil render (bukan dari markdown mentah, jadi isi pagar kode
// seperti templat ledger tidak pernah menjadi heading palsu) dengan penanda bagian aktif.
import { h } from "../ui.js";

let observer = null;

export function buildToc(panel, listEl, mobileListEl) {
  if (observer) { observer.disconnect(); observer = null; }
  const headings = [...panel.querySelectorAll("h2, h3")].filter((el) => el.id);
  const make = () => headings.map((el) =>
    h("a", {
      href: "#" + el.id,
      "data-toc": el.id,
      class: `block rounded px-2 py-1 text-sm text-muted-foreground-1 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary-focus ${el.tagName === "H3" ? "ms-3" : ""}`,
      text: el.textContent,
    }));
  const empty = () => h("p", { class: "text-xs text-muted-foreground-1", text: "Tidak ada heading." });
  for (const target of [listEl, mobileListEl]) {
    if (!target) continue;
    target.replaceChildren(...(headings.length ? make() : [empty()]));
  }
  const detail = mobileListEl && mobileListEl.closest("details");
  if (detail) detail.classList.toggle("hidden", headings.length === 0);

  if (!headings.length || !("IntersectionObserver" in window)) return;
  const links = new Map();
  document.querySelectorAll("[data-toc]").forEach((a) => {
    const arr = links.get(a.dataset.toc) || [];
    arr.push(a);
    links.set(a.dataset.toc, arr);
  });
  const setActive = (id) => {
    document.querySelectorAll("[data-toc]").forEach((a) => {
      const on = a.dataset.toc === id;
      a.classList.toggle("text-foreground", on);
      a.classList.toggle("font-medium", on);
      a.classList.toggle("bg-muted", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
  };
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length) setActive(visible[0].target.id);
  }, { rootMargin: "-72px 0px -65% 0px" });
  headings.forEach((el) => observer.observe(el));
}
