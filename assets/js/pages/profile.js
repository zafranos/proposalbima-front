import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import * as session from "../session.js";
import { enrollmentBadge, h, setBusy, showFormError, toast } from "../ui.js";

if (auth.requireLogin()) {
  const form = document.getElementById("form");
  const errBox = document.getElementById("form-error");
  const btn = document.getElementById("submit");
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
      toast("Profil disimpan.");
    } catch (err) {
      showFormError(errBox, err.message);
    }
    setBusy(btn, false);
  });

  // Listener di atas dipasang sebelum await apa pun (lihat catatan di login.js); data dimuat setelahnya.
  try {
    const me = await auth.loadMe();
    document.getElementById("email").textContent = me.user.email;
    form.name.value = me.user.name || "";
    form.affiliation.value = me.user.affiliation || "";
    document.getElementById("enrollments").replaceChildren(
      ...me.enrollments.map((e) =>
        h("li", { class: "card flex flex-wrap items-center justify-between gap-3 px-5 py-4" },
          h("span", { class: "font-display text-xl font-medium", text: e.skema_judul }), enrollmentBadge(e))),
    );
  } catch (err) {
    showFormError(errBox, err.message);
  }
}
