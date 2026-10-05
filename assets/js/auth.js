import * as api from "./api.js";
import * as session from "./session.js";

// Memastikan ada token; bila tidak, pindah ke halaman masuk. Mengembalikan true bila lanjut.
export function requireLogin() {
  if (session.isLoggedIn()) return true;
  api.goReplace("/login/");
  return false;
}

// Halaman admin: harus masuk dan berperan admin. Cache pengguna bisa basi (peran baru diubah), jadi bila
// cache bukan admin, peran disegarkan dari /me sebelum menyingkirkan pengguna. Penegakan sebenarnya
// tetap di backend (RequireAdmin menjawab 403); ini hanya agar bukan-admin tidak melihat kerangka halaman.
export async function requireAdmin() {
  if (!requireLogin()) return false;
  let user = session.getUser();
  if (!user || user.role !== "admin") {
    try { user = (await loadMe({ noFollow: true })).user; } catch { user = null; }
  }
  if (user && user.role === "admin") return true;
  api.goReplace("/modul/?slug=beranda");
  return false;
}

// Halaman tamu (login, daftar): bila sudah punya token, kirim ke tujuan yang ditentukan backend.
export async function redirectIfLoggedIn() {
  if (!session.isLoggedIn()) return false;
  try {
    const me = await api.get("/me", { noFollow: true });
    session.setUser(me.user);
    api.goReplace(api.safePath(me.redirect) || "/modul/?slug=beranda");
    return true;
  } catch {
    session.clear(); // token tidak berlaku lagi
    return false;
  }
}

// Menyimpan sesi dari respons login atau daftar lalu menuju `redirect` dari backend.
export function startSession(resp) {
  session.setSession(resp.token, resp.user);
  api.go(api.safePath(resp.redirect) || "/modul/?slug=beranda");
}

export async function logout() {
  try { await api.post("/logout"); } catch { /* sisi server stateless */ }
  session.clear();
  api.go("/login/");
}

// Memuat /me (menyegarkan cache pengguna). Penegakan tetap di backend.
export async function loadMe(opts) {
  const me = await api.get("/me", opts);
  if (me && me.user) session.setUser(me.user);
  return me;
}
