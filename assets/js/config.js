// Konfigurasi runtime. __API_ORIGIN__ diganti saat build (scripts/build-site.mjs) dan juga
// muncul di CSP connect-src (partials/head.html), jadi satu nilai untuk keduanya.
export const config = Object.freeze({
  apiBase: "__API_ORIGIN__",
  // Awalan jalur situs: "" di akar domain atau domain kustom, "/nama-repo" di situs proyek GitHub Pages.
  basePath: "__BASE_PATH__",
  appName: "Proposal DIKTI",
  storagePrefix: "pdk_",
});
