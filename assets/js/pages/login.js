import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { setBusy, showFormError } from "../ui.js";
import { initAsciiLogo } from "../ascii-logo.js";

// Dipasang sebelum await tingkat modul apa pun, supaya animasi tidak menunggu jawaban API.
initAsciiLogo();

const notice = document.getElementById("notice");
if (new URLSearchParams(location.search).get("sesi") === "berakhir") {
  notice.textContent = "Sesi Anda berakhir. Silakan masuk lagi.";
  notice.classList.remove("hidden");
}

const form = document.getElementById("form");
const errBox = document.getElementById("form-error");
const btn = document.getElementById("submit");

// Dipasang SEBELUM await apa pun: backend yang baru bangun bisa butuh beberapa detik, dan Enter yang
// ditekan selama itu tidak boleh sempat mengirim form secara bawaan (kata sandi bisa masuk URL).
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

await auth.redirectIfLoggedIn();
