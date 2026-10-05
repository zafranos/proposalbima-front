// Konfigurasi runtime. __API_ORIGIN__ diganti saat build (scripts/build-site.mjs)
// dan juga muncul di CSP connect-src, jadi satu nilai untuk keduanya.
(function () {
  "use strict";
  window.PDK = Object.freeze({
    apiBase: "__API_ORIGIN__",
    appName: "Proposal DIKTI",
    storagePrefix: "pdk_",
  });
})();
