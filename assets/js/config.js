// Konfigurasi runtime. __API_ORIGIN__ diganti saat build (scripts/build-site.mjs) dan juga
// muncul di CSP connect-src (partials/head.html), jadi satu nilai untuk keduanya.
export const config = Object.freeze({
  apiBase: "__API_ORIGIN__",
  // Awalan jalur situs: "" di akar domain atau domain kustom, "/nama-repo" di situs proyek GitHub Pages.
  basePath: "__BASE_PATH__",
  // Skrip asisten obrolan pihak ketiga; kosong = tidak dipasang. Diisi saat build (PDK_ASSISTANT_SRC) dan hanya
  // dipakai landing (pages/home.js).
  assistantSrc: "__ASSISTANT_SRC__",
  appName: "Proposal DIKTI",
  storagePrefix: "pdk_",
});
