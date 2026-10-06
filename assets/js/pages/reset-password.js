import "../common.js";
import * as api from "../api.js";
import { setBusy, showFormError } from "../ui.js";
import { initAsciiLogo } from "../ascii-logo.js";

// Dipasang sebelum await tingkat modul apa pun, supaya animasi tidak menunggu jawaban API.
initAsciiLogo();

const form = document.getElementById("form");
const errBox = document.getElementById("form-error");
const result = document.getElementById("result");
const btn = document.getElementById("submit");
const token = new URLSearchParams(location.search).get("token") || "";

if (!token) {
  form.classList.add("hidden");
  showFormError(errBox, "Tautan reset tidak lengkap. Minta tautan baru.");
  errBox.classList.remove("hidden");
  form.before(errBox);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormError(errBox, "");
  const password = form.password.value;
  if (password.length < 8 || password.length > 72) return showFormError(errBox, "Kata sandi harus 8 sampai 72 karakter.");
  if (password !== form.password2.value) return showFormError(errBox, "Kedua kata sandi harus sama.");
  setBusy(btn, true, "Menyimpan...");
  try {
    const res = await api.post("/auth/reset-password", { token, password });
    result.textContent = res.message + " Mengalihkan ke halaman masuk...";
    result.classList.remove("hidden");
    form.classList.add("hidden");
    setTimeout(() => api.go("/login/"), 2000);
  } catch (err) {
    showFormError(errBox, err.message);
    setBusy(btn, false);
  }
});
