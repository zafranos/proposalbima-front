// Klien API (fetch + JSON, tanpa pustaka). Perbedaan dari rujukan SLR:
//  - setelah mengalihkan halaman (401 atau `redirect`), mengembalikan promise yang tak pernah
//    selesai, bukan undefined, sehingga pemanggil tidak galat saat halaman berpindah
//  - 401 dari /login, /register, dan /auth/* TIDAK mengalihkan (itu galat biasa, mis. token Google ditolak)
//  - `redirect` dari backend hanya diikuti bila lolos safePath (regex SLR meloloskan "/\host")
import { config } from "./config.js";
import * as session from "./session.js";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Jalur internal yang aman: diawali satu "/" dan bukan "//" atau "/\".
export function safePath(p) {
  return typeof p === "string" && /^\/(?![/\\])/.test(p) ? p : null;
}

const NEVER = new Promise(() => {});

// Semua jalur internal ditulis relatif terhadap akar aplikasi ("/login/"); awalan situs
// (config.basePath) ditambahkan hanya di sini, saat membentuk URL atau berpindah halaman.
export function withBase(path) { return config.basePath + path; }
export function go(path) { window.location.assign(withBase(path)); }
export function goReplace(path) { window.location.replace(withBase(path)); }

function navigate(path) {
  go(path);
  return NEVER;
}

const NO_SESSION_REDIRECT = /^\/(login|register|auth\/)/;

async function parse(res) {
  const type = res.headers.get("Content-Type") || "";
  if (type.includes("application/json")) {
    try { return await res.json(); } catch { return null; }
  }
  return null;
}

export async function request(method, path, body, opts = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = session.getToken();
  if (token) headers.Authorization = "Bearer " + token;

  let res;
  try {
    res = await fetch(config.apiBase + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("Tidak dapat menjangkau server. Periksa koneksi Anda lalu coba lagi.", 0, null);
  }
  const data = await parse(res);

  if (res.status === 401 && !NO_SESSION_REDIRECT.test(path)) {
    session.clear();
    return navigate("/login/?sesi=berakhir");
  }
  if ((res.status === 403 || res.status === 409) && !opts.noFollow) {
    const target = safePath(data && data.redirect);
    if (target) return navigate(target);
  }
  if (!res.ok) {
    const err = new ApiError((data && data.message) || `Galat ${res.status}`, res.status, data);
    err.retryAfter = res.headers.get("Retry-After");
    throw err;
  }
  return data;
}

export const get = (path, opts) => request("GET", path, undefined, opts);
export const post = (path, body, opts) => request("POST", path, body === undefined ? {} : body, opts);
export const patch = (path, body, opts) => request("PATCH", path, body, opts);
export const del = (path, opts) => request("DELETE", path, undefined, opts);

// Unduhan butuh header Authorization, jadi tidak bisa lewat tautan biasa: ambil sebagai blob
// lalu picu penyimpanan lewat <a download>.
export async function download(path, filename) {
  const headers = {};
  const token = session.getToken();
  if (token) headers.Authorization = "Bearer " + token;
  let res;
  try {
    res = await fetch(config.apiBase + path, { headers });
  } catch {
    throw new ApiError("Tidak dapat menjangkau server.", 0, null);
  }
  if (!res.ok) {
    const data = await parse(res);
    if (res.status === 401) { session.clear(); return navigate("/login/?sesi=berakhir"); }
    const target = (res.status === 403 || res.status === 409) && safePath(data && data.redirect);
    if (target) return navigate(target);
    throw new ApiError((data && data.message) || `Galat ${res.status}`, res.status, data);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
