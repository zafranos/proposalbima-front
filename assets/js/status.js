// Halaman contoh tahap 1: memanggil GET / pada backend dan menampilkan statusnya,
// untuk membuktikan jalur frontend -> API (CORS dan CSP connect-src) tersambung.
(function () {
  "use strict";
  var box = document.getElementById("api-status");
  if (!box) return;
  fetch(window.PDK.apiBase + "/", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      var b = res.body || {};
      box.textContent = res.ok
        ? "API terhubung. Basis data: " + b.db + ". Materi: " + b.materi + ". Versi materi: " + ((b.content_version || {}).tanggal || "-") + "."
        : "API menjawab dengan galat.";
      box.dataset.state = res.ok ? "ok" : "error";
    })
    .catch(function () {
      box.textContent = "API tidak dapat dijangkau (" + window.PDK.apiBase + "). Pastikan backend berjalan dan origin ini ada di ALLOWED_ORIGINS.";
      box.dataset.state = "error";
    });
})();
