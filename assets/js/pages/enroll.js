import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { renderSkemaPicker } from "../skema-picker.js";
import { setBusy, showFormError } from "../ui.js";

if (auth.requireLogin()) {
  const form = document.getElementById("form");
  const errBox = document.getElementById("form-error");
  const btn = document.getElementById("submit");
  let getSkema = () => "";
  let skemaSiap = false;

  // Listener dipasang sebelum await apa pun (lihat catatan di login.js).
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormError(errBox, "");
    if (!skemaSiap) return showFormError(errBox, "Daftar skema masih dimuat. Coba lagi sebentar.");
    const skema = getSkema();
    if (!skema) return showFormError(errBox, "Pilih skema.");
    setBusy(btn, true, "Memproses...");
    try {
      const res = await api.post("/api/enroll", { skema, invite_code: form.invite_code.value.trim() });
      api.go(api.safePath(res.redirect) || "/select-skema/");
    } catch (err) {
      showFormError(errBox, err.message);
      setBusy(btn, false);
    }
  });

  try {
    const [sk, enr] = await Promise.all([api.get("/api/skema"), api.get("/api/enrollments")]);
    const have = enr.enrollments.map((e) => e.skema);
    if (have.length >= sk.skema.length) {
      form.classList.add("hidden");
      document.getElementById("intro").textContent = "Anda sudah mengikuti semua skema yang tersedia.";
    } else {
      getSkema = renderSkemaPicker(document.getElementById("skema-list"), sk.skema, {
        excluded: have,
        preselect: new URLSearchParams(location.search).get("skema") || "",
      });
      skemaSiap = true;
    }
  } catch (err) {
    showFormError(errBox, err.message);
  }
}
