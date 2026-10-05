import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { setBusy, showFormError } from "../ui.js";

const notice = document.getElementById("notice");
if (new URLSearchParams(location.search).get("sesi") === "berakhir") {
  notice.textContent = "Sesi Anda berakhir. Silakan masuk lagi.";
  notice.classList.remove("hidden");
}

if (!(await auth.redirectIfLoggedIn())) {
  const form = document.getElementById("form");
  const errBox = document.getElementById("form-error");
  const btn = document.getElementById("submit");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormError(errBox, "");
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return showFormError(errBox, "Email dan kata sandi wajib diisi.");
    setBusy(btn, true, "Memproses...");
    try {
      auth.startSession(await api.post("/login", { email, password }));
    } catch (err) {
      showFormError(errBox, err.message);
      setBusy(btn, false);
    }
  });
}
