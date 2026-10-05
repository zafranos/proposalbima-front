// Konfigurasi runtime. __API_ORIGIN__ diganti saat build (scripts/build-site.mjs) dan juga
// muncul di CSP connect-src (partials/head.html), jadi satu nilai untuk keduanya.
export const config = Object.freeze({
  apiBase: "__API_ORIGIN__",
  appName: "Proposal DIKTI",
  storagePrefix: "pdk_",
});
