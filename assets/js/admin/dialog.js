// Dialog modal dari elemen <dialog> bawaan peramban: fokus terkunci di dalamnya, Esc menutup, dan
// latar gelap lewat ::backdrop. Tanpa pustaka. Galat dari onSubmit tampil di dalam dialog (dialog
// tetap terbuka); sukses menutupnya.
import { h, setBusy, showFormError } from "../ui.js";
import { BTN, BTN_DANGER_SOLID, BTN_PRIMARY } from "./kit.js";

let seq = 0;

// Mengembalikan promise<boolean>: true bila dikirim dan berhasil, false bila dibatalkan.
export function modal({ title, description, content, confirmLabel = "Simpan", danger = false, onSubmit }) {
  return new Promise((resolve) => {
    const id = "dlg-" + ++seq;
    let done = false;
    const err = h("div", { role: "alert", class: "hidden rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100" });
    const cancel = h("button", { type: "button", class: BTN, text: "Batal" });
    const submit = h("button", { type: "submit", class: danger ? BTN_DANGER_SOLID : BTN_PRIMARY, text: confirmLabel });
    const form = h("form", { class: "space-y-4 p-6", novalidate: true },
      h("h2", { id: id + "-title", class: "text-lg font-semibold", text: title }),
      description ? h("p", { id: id + "-desc", class: "text-sm text-muted-foreground-1", text: description }) : null,
      content,
      err,
      h("div", { class: "flex justify-end gap-2 pt-2" }, cancel, submit));
    const dlg = h("dialog", {
      "aria-labelledby": id + "-title",
      "aria-describedby": description ? id + "-desc" : null,
      class: "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-layer-line bg-layer p-0 text-layer-foreground shadow-xl backdrop:bg-black/50",
    }, form);

    cancel.addEventListener("click", () => dlg.close());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showFormError(err, "");
      setBusy(submit, true, "Memproses...");
      try {
        if (onSubmit) await onSubmit(form);
        done = true;
        dlg.close();
      } catch (ex) {
        showFormError(err, ex.message || "Terjadi kesalahan.");
        setBusy(submit, false);
      }
    });
    dlg.addEventListener("close", () => { dlg.remove(); resolve(done); });

    document.body.append(dlg);
    dlg.showModal();
    // Dialog hapus/cabut: fokus awal ke Batal (aman); dialog isian: ke bidang pertama.
    (danger ? cancel : form.querySelector("input, select, textarea") || cancel).focus();
  });
}

export function confirmDialog({ title, message, confirmLabel = "Ya, lanjutkan", danger = false, onConfirm }) {
  return modal({ title, description: message, content: null, confirmLabel, danger, onSubmit: onConfirm });
}
