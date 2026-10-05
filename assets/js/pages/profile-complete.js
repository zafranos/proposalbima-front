import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import * as session from "../session.js";
import { setBusy, showFormError } from "../ui.js";

if (auth.requireLogin()) {
  const form = document.getElementById("form");
  const errBox = document.getElementById("form-error");
  const btn = document.getElementById("submit");
  const cached = session.getUser() || {};
  form.name.value = cached.name || "";
  form.affiliation.value = cached.affiliation || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormError(errBox, "");
    const body = { name: form.name.value.trim(), affiliation: form.affiliation.value.trim() };
    if (body.name.length < 2) return showFormError(errBox, "Nama minimal 2 karakter.");
    if (body.affiliation.length < 2) return showFormError(errBox, "Afiliasi atau institusi wajib diisi.");
    setBusy(btn, true, "Menyimpan...");
    try {
      const res = await api.post("/me/profile", body);
      session.setUser(res.user);
      window.location.assign(api.safePath(res.redirect) || "/select-skema/");
    } catch (err) {
      showFormError(errBox, err.message);
      setBusy(btn, false);
    }
  });
}
