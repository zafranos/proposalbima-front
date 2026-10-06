// Server statis kecil untuk pengembangan lokal: menyajikan dist/ di :5173.
// Sama seperti GitHub Pages: direktori -> index.html, tak ketemu -> 404.html.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

const ROOT = "dist";
const PORT = Number(process.env.PORT || 5173);
// Meniru situs proyek GitHub Pages: BASE_PATH=/nama-repo menyajikan dist/ di bawah awalan itu saja.
const BASE = (process.env.BASE_PATH || "").replace(/\/+$/, "");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
};

async function resolveFile(urlPath) {
  if (BASE) {
    if (urlPath !== BASE && !urlPath.startsWith(BASE + "/")) return [join(ROOT, "404.html"), 404];
    urlPath = urlPath.slice(BASE.length) || "/";
  }
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return [join(ROOT, "404.html"), 400]; } // "%" sendirian bukan URL sah
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  let p = join(ROOT, clean);
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html");
    await stat(p);
    return [p, 200];
  } catch {
    return [join(ROOT, "404.html"), 404];
  }
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (BASE && path === BASE) { res.writeHead(301, { Location: BASE + "/" }).end(); return; }
  const [file, status] = await resolveFile(path);
  try {
    const body = await readFile(file);
    res.writeHead(status, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(body);
  } catch {
    res.writeHead(500).end("galat server");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`http://localhost:${PORT}${BASE}/ (menyajikan ${ROOT}/)`));
