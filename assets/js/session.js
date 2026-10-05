// Penyimpanan sesi di localStorage. Token PASETO dikirim sebagai Bearer; tidak ada cookie.
// Gagal menyimpan (mode privat, penyimpanan diblokir) tidak boleh merusak halaman.
import { config } from "./config.js";

const KEY_TOKEN = config.storagePrefix + "token";
const KEY_USER = config.storagePrefix + "user";

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* abaikan */ }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* abaikan */ }
}

export function getToken() { return read(KEY_TOKEN); }

export function getUser() {
  const raw = read(KEY_USER);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function setSession(token, user) {
  if (token) write(KEY_TOKEN, token);
  if (user) write(KEY_USER, JSON.stringify(user));
}

// Cache pengguna hanya untuk render awal; penegakan selalu di backend.
export function setUser(user) { if (user) write(KEY_USER, JSON.stringify(user)); }

export function clear() {
  remove(KEY_TOKEN);
  remove(KEY_USER);
}

export function isLoggedIn() { return !!getToken(); }
