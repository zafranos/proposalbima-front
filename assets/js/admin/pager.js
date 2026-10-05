// Paginasi sisi server: backend mengirim meta {page, limit, total, total_pages}.
import { h, icon, mount } from "../ui.js";
import { BTN } from "./kit.js";

export function renderPager(el, meta, onPage) {
  if (!meta || !meta.total) {
    mount(el);
    return;
  }
  const { page, limit, total, total_pages: pages } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  mount(el, h("nav", { "aria-label": "Paginasi", class: "flex flex-wrap items-center justify-between gap-3 text-sm" },
    h("p", { class: "text-muted-foreground-1", text: `Menampilkan ${from}–${to} dari ${total}` }),
    h("div", { class: "flex items-center gap-2" },
      h("button", { type: "button", class: BTN, disabled: page <= 1, on: { click: () => onPage(page - 1) } }, icon("chevron-left"), "Sebelumnya"),
      h("span", { class: "px-1", text: `Halaman ${page} dari ${pages}` }),
      h("button", { type: "button", class: BTN, disabled: page >= pages, on: { click: () => onPage(page + 1) } }, "Berikutnya", icon("chevron-right")))));
}
