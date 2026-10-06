import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { setBusy, showFormError } from "../ui.js";

// Halaman ini untuk akun yang sudah ada tetapi belum terdaftar di pelatihan,
// misalnya akun yang dibuat lewat tools/seed-admin. Pendaftar biasa sudah
// terdaftar sejak membuat akun.
if (auth.requireLogin()) {
  const form = document.getElementById("form");
  const errBox = document.getElementById("form-error");
  const btn = document.getElementById("submit");

  // Listener dipasang sebelum await apa pun (lihat catatan di login.js).
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormError(errBox, "");
    setBusy(btn, true, "Memproses...");
    try {
      const res = await api.post("/api/enroll", { invite_code: form.invite_code.value.trim() });
      api.go(api.safePath(res.redirect) || "/modul/?slug=beranda");
    } catch (err) {
      showFormError(errBox, err.message);
      setBusy(btn, false);
    }
  });

  try {
    const enr = await api.get("/api/enrollments");
    if (enr.enrollments.length) {
      form.classList.add("hidden");
      document.getElementById("intro").textContent = "Anda sudah terdaftar di pelatihan ini.";
    }
  } catch (err) {
    showFormError(errBox, err.message);
  }
}
