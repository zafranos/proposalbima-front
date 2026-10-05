import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { renderSkemaPicker } from "../skema-picker.js";
import { setBusy, showFormError } from "../ui.js";

if (!(await auth.redirectIfLoggedIn())) {
  const form = document.getElementById("form");
  const errBox = document.getElementById("form-error");
  const btn = document.getElementById("submit");
  let getSkema = () => "";

  try {
    const res = await api.get("/api/skema");
    getSkema = renderSkemaPicker(document.getElementById("skema-list"), res.skema, {
      preselect: new URLSearchParams(location.search).get("skema") || "",
    });
  } catch (err) {
    showFormError(errBox, err.message);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormError(errBox, "");
    const body = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      password: form.password.value,
      affiliation: form.affiliation.value.trim(),
      skema: getSkema(),
      invite_code: form.invite_code.value.trim(),
    };
    if (body.name.length < 2) return showFormError(errBox, "Nama minimal 2 karakter.");
    if (body.password.length < 8 || body.password.length > 72) return showFormError(errBox, "Kata sandi harus 8 sampai 72 karakter.");
    if (body.affiliation.length < 2) return showFormError(errBox, "Afiliasi atau institusi wajib diisi.");
    if (!body.skema) return showFormError(errBox, "Pilih skema penelitian.");
    setBusy(btn, true, "Memproses...");
    try {
      auth.startSession(await api.post("/register", body));
    } catch (err) {
      showFormError(errBox, err.message);
      setBusy(btn, false);
    }
  });
}
