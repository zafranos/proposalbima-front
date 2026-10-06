import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { h } from "../ui.js";

if (auth.requireLogin()) {
  const title = document.getElementById("title");
  const message = document.getElementById("message");
  const actions = document.getElementById("actions");
  try {
    const me = await auth.loadMe();
    const e = me.enrollments[0];
    if (!e) {
      api.goReplace("/enroll/");
    } else if (e.status === "approved" || (e.status === "trial" && !e.trial_expired)) {
      api.goReplace("/modul/?slug=beranda");
    } else {
      const expired = e.status === "trial";
      title.textContent = expired ? "Masa trial berakhir" : "Menunggu persetujuan";
      message.textContent = expired
        ? "Masa trial Anda sudah berakhir. Materi pratinjau tetap dapat dibuka; modul lainnya terbuka kembali setelah admin menyetujui akun Anda."
        : "Akun Anda menunggu persetujuan admin. Sementara itu Anda dapat membuka materi pratinjau.";
      actions.replaceChildren(
        h("a", { href: api.withBase("/modul/?slug=beranda"), class: "btn btn-primary", text: "Buka materi pratinjau" }),
      );
    }
  } catch (err) {
    message.textContent = err.message;
  }
}
