// Inisialisasi bersama semua halaman: tombol tema dan penanda tahun. Diimpor oleh modul halaman.
import { icon } from "./ui.js";
import * as auth from "./auth.js";

const THEME_KEY = "pdk_theme";

function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch { /* abaikan */ }
  syncToggles();
  // Grafik (canvas) tidak ikut berganti tema lewat CSS; halaman yang punya grafik mendengarkan ini.
  document.dispatchEvent(new CustomEvent("pdk:theme"));
}

// Dipanggil juga oleh komponen yang membuat tombol tema setelah muat (mis. navigasi admin).
export function syncToggles() {
  const dark = document.documentElement.classList.contains("dark");
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
    b.setAttribute("aria-pressed", String(dark));
    b.setAttribute("aria-label", dark ? "Beralih ke tema terang" : "Beralih ke tema gelap");
    b.replaceChildren(icon(dark ? "sun" : "moon", "size-4"));
  });
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-theme-toggle]")) applyTheme(!document.documentElement.classList.contains("dark"));
});
syncToggles();

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-logout]")) auth.logout();
});
