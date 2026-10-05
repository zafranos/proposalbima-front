// Navigasi bersama halaman admin (pola SLR: satu komponen, bukan salinan di tiap halaman).
// Layar lebar: menu mendatar. Ponsel: tombol menu membuka daftar di bawah bilah atas.
import * as api from "../api.js";
import * as session from "../session.js";
import { syncToggles } from "../common.js";
import { h, icon, mount } from "../ui.js";

const ITEMS = [
  ["dasbor", "/admin/dashboard/", "Dasbor"],
  ["pengguna", "/admin/users/", "Pengguna"],
  ["pendaftaran", "/admin/enrollments/", "Pendaftaran"],
  ["kode", "/admin/invite-codes/", "Kode undangan"],
  ["progres", "/admin/progress/", "Progres"],
];

const LINK_BASE = "rounded-lg px-3 py-2 text-sm hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary-focus";
const LINK_ACTIVE = "bg-muted font-semibold";

export function renderAdminNav(active) {
  const host = document.getElementById("admin-nav");
  if (!host) return;
  const user = session.getUser() || {};

  const menu = h("nav", { id: "admin-menu", "aria-label": "Menu admin", class: "order-last hidden w-full flex-col gap-1 border-t border-navbar-line py-2 lg:order-none lg:flex lg:w-auto lg:flex-row lg:border-0 lg:py-0" },
    ITEMS.map(([key, path, label]) =>
      h("a", { href: api.withBase(path), class: `${LINK_BASE} ${key === active ? LINK_ACTIVE : ""}`, "aria-current": key === active ? "page" : null, text: label })));

  const toggle = h("button", { type: "button", "aria-expanded": "false", "aria-controls": "admin-menu", "aria-label": "Buka menu admin",
    class: "inline-flex size-9 items-center justify-center rounded-lg border border-line-2 hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary-focus lg:hidden",
    on: { click: () => {
      const open = menu.classList.toggle("hidden") === false;
      menu.classList.toggle("flex", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Tutup menu admin" : "Buka menu admin");
      mount(toggle, icon(open ? "x" : "menu", "size-4"));
    } } }, icon("menu", "size-4"));

  mount(host,
    h("header", { class: "sticky top-0 z-40 border-b border-navbar-line bg-navbar" },
      h("div", { class: "mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5" },
        toggle,
        h("a", { href: api.withBase("/admin/dashboard/"), class: "rounded-lg px-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary-focus", text: "Panel Admin" }),
        menu,
        h("div", { class: "ms-auto flex items-center gap-1" },
          h("a", { href: api.withBase("/modul/?slug=beranda"), class: LINK_BASE, text: "Materi" }),
          h("span", { class: "hidden max-w-40 truncate px-2 text-sm text-muted-foreground-1 md:inline", text: user.name || "" }),
          h("button", { type: "button", "data-theme-toggle": "", class: "inline-flex size-9 items-center justify-center rounded-lg border border-line-2 hover:bg-muted-hover focus:outline-none focus:ring-2 focus:ring-primary-focus" }),
          h("button", { type: "button", "data-logout": "", class: LINK_BASE, text: "Keluar" })))));
  syncToggles();
}
