import "../common.js";
import * as api from "../api.js";
import * as auth from "../auth.js";
import { enrollmentBadge, h, icon, setBusy, showFormError } from "../ui.js";

const IKON = { dasar: "flask", terapan: "wrench" };

if (auth.requireLogin()) {
  const list = document.getElementById("list");
  const errBox = document.getElementById("error");
  try {
    const [me, enr] = await Promise.all([auth.loadMe(), api.get("/api/enrollments")]);
    if (enr.enrollments.length === 0) {
      api.goReplace("/enroll/");
    } else {
      const current = me.user.selected_skema;
      list.replaceChildren(
        ...enr.enrollments.map((e) => {
          const btn = h("button", {
            type: "button",
            class: "btn btn-primary btn-sm",
            text: e.skema === current ? "Lanjutkan" : "Pilih",
            on: {
              click: async () => {
                showFormError(errBox, "");
                setBusy(btn, true, "Memproses...");
                try {
                  const res = await api.post("/api/skema/pilih", { skema: e.skema });
                  api.go(api.safePath(res.redirect) || "/modul/?slug=beranda");
                } catch (err) {
                  showFormError(errBox, err.message);
                  setBusy(btn, false);
                }
              },
            },
          });
          return h("div", { class: "card flex flex-wrap items-center gap-4 p-4" },
            h("span", { class: "grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300" }, icon(IKON[e.skema] || "layers", "size-5")),
            h("div", { class: "min-w-0 flex-1" },
              h("p", { class: "font-display text-xl font-medium leading-tight", text: e.skema_judul }),
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
