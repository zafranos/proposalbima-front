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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFormError(errBox, "");
  const email = form.email.value.trim();
  if (!email) return showFormError(errBox, "Email wajib diisi.");
  setBusy(btn, true, "Mengirim...");
  try {
    const res = await api.post("/auth/forgot-password", { email });
    result.textContent = res.message;
    result.classList.remove("hidden");
    form.classList.add("hidden");
  } catch (err) {
    showFormError(errBox, err.message);
    setBusy(btn, false);
  }
});
