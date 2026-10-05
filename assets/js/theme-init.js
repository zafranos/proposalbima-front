// Dimuat sinkron di <head> (berkas luar, bukan inline) agar tema terpasang
// sebelum cat pertama dan tidak berkedip. Tanpa penyimpanan = ikuti sistem.
(function () {
  var root = document.documentElement;
  root.setAttribute("data-theme", "theme-tinta"); // palet merek (assets/css/themes/tinta.css)
  try {
    var saved = localStorage.getItem("pdk_theme");
    var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", dark);
  } catch (e) { /* penyimpanan diblokir: pakai tema bawaan */ }
})();
