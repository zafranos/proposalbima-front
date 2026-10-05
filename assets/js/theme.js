// Tombol tema terang/gelap. Pilihan disimpan per-peramban; gagal menyimpan tidak fatal.
(function () {
  "use strict";
  function apply(dark) {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("pdk_theme", dark ? "dark" : "light"); } catch (e) { /* abaikan */ }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(dark));
    });
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-theme-toggle]");
    if (btn) apply(!document.documentElement.classList.contains("dark"));
  });
  document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
    b.setAttribute("aria-pressed", String(document.documentElement.classList.contains("dark")));
  });
})();
