import * as api from "./api.js";
import * as session from "./session.js";

// Memastikan ada token; bila tidak, pindah ke halaman masuk. Mengembalikan true bila lanjut.
export function requireLogin() {
  if (session.isLoggedIn()) return true;
  window.location.replace("/login/");
  return false;
}

// Halaman tamu (login, daftar): bila sudah punya token, kirim ke tujuan yang ditentukan backend.
export async function redirectIfLoggedIn() {
  if (!session.isLoggedIn()) return false;
  try {
    const me = await api.get("/me", { noFollow: true });
    session.setUser(me.user);
    window.location.replace(api.safePath(me.redirect) || "/modul/?slug=beranda");
    return true;
  } catch {
    session.clear(); // token tidak berlaku lagi
    return false;
  }
}

// Menyimpan sesi dari respons login atau daftar lalu menuju `redirect` dari backend.
export function startSession(resp) {
  session.setSession(resp.token, resp.user);
  window.location.assign(api.safePath(resp.redirect) || "/modul/?slug=beranda");
}

export async function logout() {
  try { await api.post("/logout"); } catch { /* sisi server stateless */ }
  session.clear();
  window.location.assign("/login/");
}

// Memuat /me (menyegarkan cache pengguna). Penegakan tetap di backend.
export async function loadMe(opts) {
  const me = await api.get("/me", opts);
  if (me && me.user) session.setUser(me.user);
  return me;
}
