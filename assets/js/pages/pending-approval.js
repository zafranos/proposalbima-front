import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { h } from "../ui.js";

const LINK_BTN = "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2";

if (auth.requireLogin()) {
  const title = document.getElementById("title");
  const message = document.getElementById("message");
  const actions = document.getElementById("actions");
  try {
    const me = await auth.loadMe();
    const e = me.enrollments.find((x) => x.skema === me.user.selected_skema);
    if (!e) {
      api.goReplace("/select-skema/");
    } else if (e.status === "approved" || (e.status === "trial" && !e.trial_expired)) {
      api.goReplace("/modul/?slug=beranda");
    } else {
      const expired = e.status === "trial";
      title.textContent = expired ? "Masa trial berakhir" : "Menunggu persetujuan";
      message.textContent = expired
        ? `Masa trial skema ${e.skema_judul} sudah berakhir. Materi pratinjau tetap dapat dibuka; modul lainnya terbuka kembali setelah admin menyetujui akun Anda.`
        : `Akun Anda untuk skema ${e.skema_judul} menunggu persetujuan admin. Sementara itu Anda dapat membuka materi pratinjau.`;
      actions.replaceChildren(
        h("a", { href: api.withBase("/modul/?slug=beranda"), class: `${LINK_BTN} bg-primary text-primary-foreground hover:bg-primary-hover`, text: "Buka materi pratinjau" }),
        h("a", { href: api.withBase("/select-skema/"), class: `${LINK_BTN} border border-line-3 hover:bg-muted-hover`, text: "Ganti skema" }),
      );
    }
  } catch (err) {
    message.textContent = err.message;
  }
}
