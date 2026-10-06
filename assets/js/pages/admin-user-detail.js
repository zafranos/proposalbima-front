import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { badge, enrollmentBadge, formatDate, formatDateTime, h, mount, toast } from "../ui.js";
import { confirmDialog } from "../admin/dialog.js";
import { actionsFor } from "../admin/enrollment-actions.js";
import { BTN, BTN_DANGER, CARD, avatar, errorState, link, loadingState, orDash, startAdmin, table } from "../admin/kit.js";

const METODE = { password: "Email dan kata sandi", google: "Google" };
const id = new URLSearchParams(location.search).get("id") || "";
const state = document.getElementById("state");
const content = document.getElementById("content");

if (await startAdmin("pengguna")) await load();

async function load() {
  if (!id) {
    mount(state, errorState("Pengguna tidak ditentukan."));
    return;
  }
  mount(state, loadingState());
  try {
    const res = await api.get("/admin/users/" + encodeURIComponent(id));
    mount(state);
    render(res);
  } catch (e) {
    mount(content);
    mount(state, errorState(e.status === 404 ? "Pengguna tidak ditemukan." : e.message, e.status === 404 ? null : load));
  }
}

function dl(rows) {
  return h("dl", { class: "grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2" }, rows.map(([k, v]) =>
    h("div", {}, h("dt", { class: "text-xs font-semibold uppercase tracking-wide text-muted-foreground-1", text: k }), h("dd", { class: "mt-0.5" }, v))));
}

function render({ user: u, progres, ringkasan_progres: ringkasan }) {
  const self = (session.getUser() || {}).id === u.id;
  const change = () => load();

  const toggleActive = () => confirmDialog({
    title: u.is_active ? "Nonaktifkan akun?" : "Aktifkan akun?",
    message: u.is_active
      ? `${u.name} langsung keluar dari semua sesi dan tidak dapat masuk sampai akunnya diaktifkan lagi.`
      : `${u.name} dapat masuk lagi.`,
    confirmLabel: u.is_active ? "Nonaktifkan" : "Aktifkan",
    danger: u.is_active,
    onConfirm: async () => {
      await api.post(`/admin/users/${encodeURIComponent(u.id)}/toggle-active`);
      toast(u.is_active ? `Akun ${u.name} dinonaktifkan.` : `Akun ${u.name} diaktifkan.`);
    },
  }).then((ok) => ok && change());

  const toAdmin = u.role !== "admin";
  const changeRole = () => confirmDialog({
    title: toAdmin ? "Jadikan admin?" : "Jadikan peserta?",
    message: toAdmin
      ? `${u.name} akan dapat mengelola pengguna, pendaftaran, dan kode undangan.`
      : `${u.name} kehilangan akses ke panel admin.`,
    confirmLabel: toAdmin ? "Jadikan admin" : "Jadikan peserta",
    danger: !toAdmin,
    onConfirm: async () => {
      await api.post(`/admin/users/${encodeURIComponent(u.id)}/change-role`, { role: toAdmin ? "admin" : "user" });
      toast(toAdmin ? `${u.name} sekarang admin.` : `${u.name} sekarang peserta.`);
    },
  }).then((ok) => ok && change());

  const enrollmentCard = (e) => {
    const p = ringkasan || { selesai: 0, total: 0 };
    return h("li", { class: `${CARD} p-4` },
      h("div", { class: "flex flex-wrap items-center justify-between gap-2" },
        h("h3", { class: "font-display text-xl font-medium", text: "Pelatihan penyusunan proposal" }), enrollmentBadge(e)),
      h("p", { class: "mt-1 text-sm text-muted-foreground-1", text: `Akses ${e.akses === "penuh" ? "penuh" : "pratinjau"}; mendaftar ${formatDate(e.enrolled_at)}${e.used_invite_code ? `; kode ${e.used_invite_code}` : ""}.` }),
      e.status === "trial" && e.trial_ends_at ? h("p", { class: "text-sm text-muted-foreground-1", text: `Trial sampai ${formatDate(e.trial_ends_at)}.` }) : null,
      e.status === "approved" && e.approved_at ? h("p", { class: "text-sm text-muted-foreground-1", text: `Disetujui ${formatDate(e.approved_at)}.` }) : null,
      p.total > 0
        ? h("div", { class: "mt-3" },
          h("div", { class: "flex items-baseline justify-between text-xs text-muted-foreground-1" }, h("span", { text: "Progres alur" }), h("span", { text: `${p.selesai} dari ${p.total} modul` })),
          h("progress", { class: "meter mt-1", value: String(p.selesai), max: String(p.total), "aria-label": `Progres: ${p.selesai} dari ${p.total} modul` }))
        : null,
      h("div", { class: "mt-4" }, actionsFor(e, u.name, change)));
  };

  const aktivitas = (progres || []).slice(0, 10);
  mount(content,
    h("section", { "aria-labelledby": "h-profil", class: `${CARD} p-5` },
      h("div", { class: "flex flex-wrap items-center justify-between gap-3" },
        h("div", { class: "flex items-center gap-4" }, avatar(u.name, "size-14 text-base"), h("h2", { id: "h-profil", class: "font-display text-3xl font-medium tracking-tight", text: u.name })),
        h("div", { class: "flex flex-wrap items-center gap-2" }, u.role === "admin" ? badge("Admin", "ok") : badge("Peserta"), u.is_active ? badge("Aktif", "ok") : badge("Nonaktif", "danger"))),
      h("div", { class: "mt-4" }, dl([
        ["Email", u.email],
        ["Afiliasi", orDash(u.affiliation)],
        ["Metode masuk", (u.auth_methods || []).map((m) => METODE[m] || m).join(", ") || "—"],
          ["Terdaftar", formatDateTime(u.created_at)],
        ["Diperbarui", formatDateTime(u.updated_at)],
      ])),
      h("div", { class: "mt-5 flex flex-wrap items-center gap-2 border-t border-layer-line pt-4" },
        h("button", { type: "button", class: u.is_active ? BTN_DANGER : BTN, disabled: self, on: { click: toggleActive }, text: u.is_active ? "Nonaktifkan akun" : "Aktifkan akun" }),
        h("button", { type: "button", class: toAdmin ? BTN : BTN_DANGER, disabled: self, on: { click: changeRole }, text: toAdmin ? "Jadikan admin" : "Jadikan peserta" }),
        self ? h("p", { class: "text-xs text-muted-foreground-1", text: "Ini akun Anda: status dan peran tidak dapat diubah dari sini." }) : null)),
    h("section", { "aria-labelledby": "h-enroll" },
      h("h2", { id: "h-enroll", class: "mb-3 font-display text-2xl font-medium tracking-tight", text: "Pendaftaran" }),
      u.enrollments.length
        ? h("ul", { class: "grid gap-3 md:grid-cols-2" }, u.enrollments.map(enrollmentCard))
        : h("p", { class: "text-sm text-muted-foreground-1", text: "Belum terdaftar." })),
    h("section", { "aria-labelledby": "h-aktivitas" },
      h("h2", { id: "h-aktivitas", class: "mb-3 font-display text-2xl font-medium tracking-tight", text: "Aktivitas modul terakhir" }),
      aktivitas.length
        ? table("Aktivitas modul terakhir", ["Modul", "Status", "Terakhir dibuka"],
          aktivitas.map((a) => [a.module_slug, a.completed ? badge("Selesai", "ok") : badge("Dibuka"), formatDateTime(a.last_visited_at)]))
        : h("p", { class: "text-sm text-muted-foreground-1", text: "Belum membuka modul." })));
}
