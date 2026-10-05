// Inisialisasi bersama semua halaman: tema, wadah toast, tombol tampil kata sandi, dan tombol keluar.
// Diimpor oleh modul halaman.
import { h, icon, mount, toastHost } from "./ui.js";
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
// Nama tombol tetap ("Mode gelap") dan keadaannya lewat aria-pressed; label yang ikut berubah bersama
// aria-pressed akan dibaca ganda oleh pembaca layar.
export function syncToggles() {
  const dark = document.documentElement.classList.contains("dark");
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
    b.setAttribute("aria-pressed", String(dark));
    b.setAttribute("aria-label", "Mode gelap");
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

toastHost();

// Kolom kata sandi mendapat tombol tampil/sembunyi. Nama tombol tetap dan keadaannya lewat aria-pressed.
document.querySelectorAll('input[type="password"]').forEach((input) => {
  if (input.dataset.reveal) return;
  input.dataset.reveal = "1";
  const wrap = h("div", { class: "relative" });
  input.replaceWith(wrap);
  wrap.append(input);
  input.classList.add("pe-12");
  const btn = h("button", { type: "button", "aria-label": "Tampilkan kata sandi", "aria-pressed": "false",
    class: "absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-xl text-muted-foreground-1 hover:text-foreground" }, icon("eye", "size-[18px]"));
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", String(show));
    mount(btn, icon(show ? "eye-off" : "eye", "size-[18px]"));
  });
  wrap.append(btn);
});
