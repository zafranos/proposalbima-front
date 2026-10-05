// Runner uji peramban: menyalakan backend (DB uji unik di MongoDB lokal), situs statis dan admin,
// menjalankan tests/e2e/app.test.mjs dengan Chrome yang sudah terpasang (playwright-core, tanpa
// unduhan peramban), lalu membersihkan semuanya. Berkas sementara hanya di ./.tmp (TMPDIR).
//
//   docker run -d --rm --name pdk-mongo-test -p 27018:27017 mongo:7
//   npm run test:e2e
//   E2E_KEEP=1 npm run test:e2e        # simpan .tmp (tangkapan layar) setelah selesai
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const backend = resolve(root, "../gocroot");
const tmp = resolve(root, ".tmp");
const API_PORT = 18080, WEB_PORT = 5173;
const API = `http://localhost:${API_PORT}`, WEB = `http://localhost:${WEB_PORT}`;
const mongo = process.env.TEST_MONGOSTRING || "mongodb://localhost:27018";
const dbName = "pdk_e2e_" + randomBytes(3).toString("hex");
const adminEmail = "admin-e2e@example.test", adminPassword = "kata-sandi-admin-e2e-1";

const children = [];
let exitCode = 1;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} gagal:\n${r.stdout || ""}${r.stderr || ""}`);
  return r.stdout;
}

async function waitFor(url, label, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${label} tidak siap di ${url}`);
}

function stopAll() {
  for (const c of children) { try { process.kill(-c.pid, "SIGTERM"); } catch { /* sudah mati */ } }
}

async function main() {
  mkdirSync(resolve(tmp, "tmp"), { recursive: true });

  console.log("• build frontend (origin API " + API + ")");
  run("npm", ["run", "build"], { cwd: root, env: { ...process.env, PDK_API_ORIGIN: API } });
  run("npm", ["run", "check"], { cwd: root });

  const keys = Object.fromEntries(run("go", ["run", "./tools/genkeys"], { cwd: backend }).trim().split("\n").map((l) => l.split("=")));
  const env = {
    ...process.env, ...keys, PORT: String(API_PORT), MONGOSTRING: mongo, MONGODB_NAME: dbName,
    ALLOWED_ORIGINS: WEB, FRONTEND_BASE_URL: WEB, MAIL_SENDER_EMAIL: "noreply@example.test", MAIL_SENDER_NAME: "Proposal DIKTI Uji",
  };

  console.log("• seed admin di DB " + dbName);
  run("go", ["run", "./tools/seed-admin", "--email", adminEmail, "--name", "Admin E2E"], { cwd: backend, env, input: adminPassword + "\n" });

  console.log("• nyalakan backend dan situs");
  const be = spawn("go", ["run", "./run"], { cwd: backend, env, detached: true, stdio: ["ignore", "ignore", "ignore"] });
  const web = spawn("node", ["scripts/serve.mjs"], { cwd: root, env: { ...process.env, PORT: String(WEB_PORT) }, detached: true, stdio: "ignore" });
  children.push(be, web);
  await waitFor(API + "/", "backend");
  await waitFor(WEB + "/", "situs");

  console.log("• jalankan uji peramban\n");
  const r = spawnSync("node", ["--test", "--test-concurrency=1", "--test-timeout=120000", "tests/e2e/app.test.mjs"], {
    cwd: root, stdio: "inherit",
    env: { ...process.env, TMPDIR: resolve(tmp, "tmp"), E2E_API: API, E2E_WEB: WEB, E2E_DB: dbName, E2E_ADMIN_EMAIL: adminEmail, E2E_ADMIN_PASSWORD: adminPassword, E2E_TMP: tmp },
  });
  exitCode = r.status ?? 1;
}

try {
  await main();
} catch (e) {
  console.error(String(e.message || e));
} finally {
  stopAll();
  await new Promise((r) => setTimeout(r, 800));
  const drop = spawnSync("docker", ["exec", "pdk-mongo-test", "mongosh", "--quiet", "--eval", `db.getSiblingDB("${dbName}").dropDatabase().ok`], { encoding: "utf8" });
  if (drop.status !== 0) console.error(`(DB ${dbName} tidak terhapus otomatis: hapus manual bila perlu)`);
  if (process.env.E2E_KEEP !== "1") rmSync(tmp, { recursive: true, force: true });
  else console.log("E2E_KEEP=1: .tmp disimpan di " + tmp);
  process.exit(exitCode);
}
