import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { setBusy, showFormError } from "../ui.js";

const form = document.getElementById("form");
const errBox = document.getElementById("form-error");
const btn = document.getElementById("submit");

// Listener dipasang sebelum await apa pun (lihat catatan di login.js).
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormError(errBox, "");
  const body = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    affiliation: form.affiliation.value.trim(),
    invite_code: form.invite_code.value.trim(),
  };
  if (body.name.length < 2) return showFormError(errBox, "Nama minimal 2 karakter.");
  if (body.password.length < 8 || body.password.length > 72) return showFormError(errBox, "Kata sandi harus 8 sampai 72 karakter.");
  if (body.affiliation.length < 2) return showFormError(errBox, "Afiliasi atau institusi wajib diisi.");
  setBusy(btn, true, "Memproses...");
  try {
    auth.startSession(await api.post("/register", body));
  } catch (err) {
    showFormError(errBox, err.message);
    setBusy(btn, false);
  }
});

await auth.redirectIfLoggedIn();
