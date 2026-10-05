// Aksi admin atas satu enrollment, dipakai halaman Pendaftaran dan Detail pengguna.
// Semua aksi mengembalikan promise<boolean>: true = data berubah (pemanggil memuat ulang).
import * as api from "../api.js";
import { h, toast } from "../ui.js";
import { BTN, BTN_DANGER, INPUT, field } from "./kit.js";
import { confirmDialog, modal } from "./dialog.js";

const DEFAULT_TRIAL = 7;

export function approve(e, nama) {
  return confirmDialog({
    title: "Setujui pendaftaran?",
    message: `${nama} akan mendapat akses penuh ke skema ${e.skema_judul} tanpa batas waktu.`,
    confirmLabel: "Setujui",
    onConfirm: async () => {
      await api.post(`/admin/enrollments/${encodeURIComponent(e.id)}/approve`);
      toast(`Pendaftaran ${nama} disetujui.`);
    },
  });
}

export function revoke(e, nama) {
  return confirmDialog({
    title: "Cabut akses?",
    message: `Pendaftaran ${nama} pada skema ${e.skema_judul} kembali ke menunggu persetujuan, sehingga hanya pratinjau yang terbuka.`,
    confirmLabel: "Cabut akses",
    danger: true,
    onConfirm: async () => {
      await api.post(`/admin/enrollments/${encodeURIComponent(e.id)}/revoke`);
      toast(`Akses ${nama} dicabut.`);
    },
  });
}

export function setTrial(e, nama) {
  const days = h("input", { type: "number", min: "1", max: "365", step: "1", value: String(DEFAULT_TRIAL), inputmode: "numeric", class: INPUT });
  return modal({
    title: "Atur trial",
    description: `${nama} mendapat akses penuh ke skema ${e.skema_judul} selama beberapa hari, dihitung mulai sekarang.`,
    content: field("trial-days", "Lama trial (hari)", days, "Bilangan bulat 1 sampai 365."),
    confirmLabel: "Atur trial",
    onSubmit: async () => {
      const n = Number(days.value);
      if (!Number.isInteger(n) || n < 1 || n > 365) throw new Error("Lama trial harus bilangan bulat 1 sampai 365.");
      await api.post(`/admin/enrollments/${encodeURIComponent(e.id)}/set-trial`, { days: n });
      toast(`Trial ${nama} diatur ${n} hari.`);
    },
  });
}

// Tombol aksi sesuai status. onChange dipanggil setelah data berubah.
export function actionsFor(e, nama, onChange) {
  const run = (fn) => async () => { if (await fn(e, nama)) onChange(); };
  const btn = (cls, text, fn) => h("button", { type: "button", class: cls, on: { click: run(fn) }, text });
  const out = [];
  if (e.status !== "approved") out.push(btn(BTN, "Setujui", approve));
  if (e.status === "pending") out.push(btn(BTN, "Beri trial", setTrial));
  if (e.status === "trial") out.push(btn(BTN, "Ubah trial", setTrial));
  if (e.status !== "pending") out.push(btn(BTN_DANGER, "Cabut", revoke));
  return h("div", { class: "flex flex-wrap gap-2" }, out);
}
