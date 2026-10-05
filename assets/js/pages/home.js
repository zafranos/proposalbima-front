import "../common.js";
import { withBase } from "../api.js";
import * as session from "../session.js";
import { h } from "../ui.js";

// Pengguna yang sudah masuk melihat jalan pintas ke materi.
if (session.isLoggedIn()) {
  document.getElementById("cta").replaceChildren(
    h("a", { href: withBase("/modul/?slug=beranda"), class: "inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2", text: "Lanjutkan ke materi" }),
  );
}
