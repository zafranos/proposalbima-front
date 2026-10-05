// Navigasi bersama halaman admin: sidebar tetap di layar lebar, laci geser di ponsel.
// Dirender ke <div id="admin-nav"> oleh startAdmin(); halaman memberi ruang lewat lg:ps-64 pada pembungkusnya.
import * as api from "../api.js";
import * as session from "../session.js";
import { syncToggles } from "../common.js";
import { setupDrawer } from "../drawer.js";
import { h, icon, logoMark, mount } from "../ui.js";
import { avatar } from "./kit.js";

const ITEMS = [
  ["dasbor", "/admin/dashboard/", "Dasbor", "layout-dashboard"],
  ["pengguna", "/admin/users/", "Pengguna", "users"],
  ["pendaftaran", "/admin/enrollments/", "Pendaftaran", "user-check"],
  ["kode", "/admin/invite-codes/", "Kode undangan", "key"],
  ["progres", "/admin/progress/", "Progres", "bar-chart"],
  ["landing", "/admin/landing/", "Landing", "globe"],
];

export function renderAdminNav(active) {
  const host = document.getElementById("admin-nav");
  if (!host) return;
  const user = session.getUser() || {};

  const aside = h("aside", {
    id: "admin-menu",
    class: "invisible fixed inset-y-0 start-0 z-50 flex w-64 -translate-x-full flex-col border-e border-sidebar-line bg-sidebar drawer lg:visible lg:translate-x-0",
  },
    h("div", { class: "flex h-14 shrink-0 items-center px-5" },
      h("a", { href: api.withBase("/"), class: "brand", "aria-label": "Proposal DIKTI, beranda" }, logoMark(), h("span", {}, "Proposal ", h("span", { class: "text-primary-700 dark:text-primary-300", text: "DIKTI" })))),
    h("p", { class: "px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground-1", text: "Panel admin" }),
    h("nav", { "aria-label": "Menu admin", class: "flex-1 space-y-1 overflow-y-auto px-3 pb-4" },
      ITEMS.map(([key, path, label, ico]) =>
        h("a", { href: api.withBase(path), class: "side-link", "aria-current": key === active ? "page" : null }, icon(ico, "size-[18px]"), label))),
    h("div", { class: "border-t border-sidebar-line p-3" },
      h("div", { class: "flex items-center gap-3 rounded-xl px-2 py-2" },
        avatar(user.name || "Admin"),
        h("div", { class: "min-w-0" },
          h("p", { class: "truncate text-sm font-semibold", text: user.name || "Admin" }),
          h("p", { class: "text-xs text-muted-foreground-1", text: "Administrator" }))),
      h("div", { class: "mt-1 grid gap-1" },
        h("a", { href: api.withBase("/modul/?slug=beranda"), class: "side-link" }, icon("book-open", "size-[18px]"), "Ke materi"),
        h("button", { type: "button", "data-logout": "", class: "side-link w-full text-start" }, icon("log-out", "size-[18px]"), "Keluar"))));

  const backdrop = h("div", { class: "fixed inset-0 z-40 hidden bg-black/45 backdrop-blur-[2px] lg:hidden", "aria-hidden": "true", data: { backdrop: "1" } });
  // Nama tetap ("Menu admin"); keadaannya hanya lewat aria-expanded (label yang ikut berubah akan terbaca ganda).
  const toggle = h("button", { type: "button", "aria-expanded": "false", "aria-controls": "admin-menu", "aria-label": "Menu admin", class: "icon-btn lg:hidden" }, icon("menu", "size-4"));
  const header = h("header", { class: "sticky top-0 z-30 border-b border-navbar-line bg-navbar/85 backdrop-blur-md lg:ps-64" },
      h("div", { class: "flex h-14 items-center gap-3 px-4 sm:px-6" },
        toggle,
        h("span", { class: "font-display text-lg font-semibold lg:hidden", text: "Panel Admin" }),
        h("p", { class: "hidden items-center gap-2 text-sm lg:flex" },
          h("span", { class: "text-muted-foreground-1", text: "Panel admin" }), icon("chevron-right", "size-3.5 text-muted-foreground-1"),
          h("span", { class: "font-medium", text: (ITEMS.find(([k]) => k === active) || [])[2] || "" })),
        h("div", { class: "ms-auto flex items-center gap-2" },
          h("button", { type: "button", "data-theme-toggle": "", class: "icon-btn" }))));

  mount(host, header, backdrop, aside);
  syncToggles();
  setupDrawer({
    panel: aside, toggles: [toggle], closers: [backdrop], label: "Menu admin",
    inertTargets: () => [header, document.getElementById("main"), document.querySelector('a[href="#main"]')],
  });
}
