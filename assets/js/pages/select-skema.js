import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { enrollmentBadge, h, setBusy, showFormError } from "../ui.js";

if (auth.requireLogin()) {
  const list = document.getElementById("list");
  const errBox = document.getElementById("error");
  try {
    const [me, enr] = await Promise.all([auth.loadMe(), api.get("/api/enrollments")]);
    if (enr.enrollments.length === 0) {
      window.location.replace("/enroll/");
    } else {
      const current = me.user.selected_skema;
      list.replaceChildren(
        ...enr.enrollments.map((e) => {
          const btn = h("button", {
            type: "button",
            class: "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary-focus focus:ring-offset-2 disabled:opacity-50",
            text: e.skema === current ? "Lanjutkan" : "Pilih",
            on: {
              click: async () => {
                showFormError(errBox, "");
                setBusy(btn, true, "Memproses...");
                try {
                  const res = await api.post("/api/skema/pilih", { skema: e.skema });
                  window.location.assign(api.safePath(res.redirect) || "/modul/?slug=beranda");
                } catch (err) {
                  showFormError(errBox, err.message);
                  setBusy(btn, false);
                }
              },
            },
          });
          return h("div", { class: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-layer-line bg-layer p-4" },
            h("div", {},
              h("p", { class: "font-medium", text: e.skema_judul }),
              h("div", { class: "mt-1.5" }, enrollmentBadge(e))),
            btn);
        }),
      );
    }
  } catch (err) {
    showFormError(errBox, err.message);
    list.replaceChildren();
  }
}
