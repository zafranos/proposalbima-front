// Uji peramban (Chrome sungguhan lewat playwright-core) terhadap backend dan situs yang
// dinyalakan oleh run.mjs. Tiap tes memeriksa juga bahwa tidak ada pelanggaran CSP atau
// galat skrip di konsol. Tes berjalan berurutan dan berbagi satu peserta (userA).
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const API = process.env.E2E_API, WEB = process.env.E2E_WEB, TMP = process.env.E2E_TMP;
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const here = dirname(fileURLToPath(import.meta.url));
const DB = process.env.E2E_DB;
const ASSISTANT = process.env.E2E_ASSISTANT;
// Pengganti skrip asisten pihak ketiga di semua tes: tanpa jaringan luar, dan widget asli tidak ikut diperiksa axe.
const ASSISTANT_STUB = "window.__assistantStub = { src: document.currentScript && document.currentScript.src, path: location.pathname };";
const SRC_MATERI = resolve(here, "../../../gocroot/content/materi");
const PASSWORD = "kata-sandi-e2e-123";
// Awalan jalur situs ("" di akar domain, "/proposalbima-front" di situs proyek), dari URL dasar uji.
const BASE = new URL(WEB).pathname.replace(/\/+$/, "");
const uid = () => randomBytes(3).toString("hex");

let browser;
const issues = [];
const userA = { email: `peserta-${uid()}@example.test`, password: PASSWORD, token: "" };

before(async () => {
  mkdirSync(resolve(TMP, "shots"), { recursive: true });
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await browser?.close(); });

// ── Pembantu ──
async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function login(email, password) {
  const r = await api("/login", { method: "POST", body: { email, password } });
  assert.equal(r.status, 200, "login API " + email);
  return r.data;
}

async function newPage({ viewport = { width: 1280, height: 900 }, colorScheme = "light", session } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  await context.route(ASSISTANT, (route) => route.fulfill({ contentType: "application/javascript", body: ASSISTANT_STUB }));
  if (session) {
    await context.addInitScript(([t, u]) => {
      localStorage.setItem("pdk_token", t);
      localStorage.setItem("pdk_user", JSON.stringify(u));
    }, [session.token, session.user]);
  }
  const page = await context.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (/content security policy|violates the following/i.test(t)) issues.push("[CSP] " + t.slice(0, 220));
  });
  page.on("pageerror", (e) => issues.push("[galat skrip] " + e.message));
  return { context, page };
}

async function authed(user, opts = {}) {
  const s = await login(user.email, user.password);
  return newPage({ ...opts, session: { token: s.token, user: s.user } });
}

async function until(fn, label, ms = 10000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch { /* ulangi */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.fail(`batas waktu menunggu: ${label}`);
}

const shot = (page, name) => page.screenshot({ path: resolve(TMP, "shots", name + ".png"), fullPage: false });
function noIssues() { assert.deepEqual(issues.splice(0), [], "tidak boleh ada pelanggaran CSP atau galat skrip"); }

async function adminToken() { return (await login(ADMIN.email, ADMIN.password)).token; }

async function approve(email) {
  const t = await adminToken();
  const list = await api(`/admin/enrollments?q=${encodeURIComponent(email)}`, { token: t });
  const e = list.data.enrollments[0].enrollment;
  const r = await api(`/admin/enrollments/${e.id}/approve`, { method: "POST", token: t });
  assert.equal(r.status, 200);
}

async function registerViaUI(page, { email, code = "" }) {
  await page.goto(WEB + "/register/");
  await page.locator("#name").waitFor();
  await page.fill("#name", "Peserta E2E");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.fill("#affiliation", "Universitas Uji");
  if (code) await page.fill("#invite_code", code);
  await page.click("#submit");
}

// Mengubah data pengguna langsung di MongoDB uji (container Docker) untuk menciptakan keadaan
// yang tak bisa dibuat lewat API, mis. akun tanpa afiliasi.
function mongoEval(js) {
  return execFileSync("docker", ["exec", "pdk-mongo-test", "mongosh", "--quiet", "--eval", `db.getSiblingDB("${DB}").${js}`], { encoding: "utf8" });
}

const progressText = (page) => page.locator("#progress-text").textContent();

// Teks bocor dari bug JS ("null", "undefined", "[object ...]") tidak boleh tampil di halaman.
async function noLeakyText(page, label) {
  const text = await page.evaluate(() => document.body.innerText);
  assert.doesNotMatch(text, /(^|[^\p{L}\p{N}_])(null|undefined|NaN)([^\p{L}\p{N}_]|$)|\[object /u, `teks bocor di ${label}`);
}

// Tidak boleh ada gulir horizontal pada halaman (kecuali di dalam pembungkus yang memang dapat digulir).
async function noPageOverflow(page, label) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(w[0] <= w[1], `${label}: lebar dokumen ${w[0]} melebihi viewport ${w[1]}`);
}

// ── Tes ──

test("daftar, menunggu persetujuan, pratinjau, modul terkunci", async () => {
  const { context, page } = await newPage();
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(WEB + "/register/");
  await page.locator("#name").waitFor();
  await noPageOverflow(page, "daftar di 375px");
  await page.setViewportSize({ width: 1280, height: 900 });
  await registerViaUI(page, { email: userA.email });
  await page.waitForURL("**/pending-approval/");
  assert.match(await page.locator("#title").textContent(), /Menunggu persetujuan/);
  await shot(page, "01-menunggu");

  await page.getByRole("link", { name: "Buka materi pratinjau" }).click();
  await page.waitForURL("**/modul/?slug=beranda");
  await page.locator("#content h1").waitFor();
  assert.equal(await progressText(page), "0 dari 9 selesai");
  await noLeakyText(page, "beranda pratinjau");
  assert.match(await page.locator("#akses-badge").textContent(), /Mode pratinjau/);
  const locked = page.locator('#nav [aria-disabled="true"]');
  assert.ok((await locked.count()) >= 7, "modul penuh harus terkunci saat pratinjau");
  assert.ok((await locked.filter({ hasText: "Modul 2" }).count()) >= 1);
  assert.equal(await page.locator("#nav a", { hasText: "Modul 0" }).count(), 1, "Modul 0 terbuka saat pratinjau");
  await shot(page, "02-beranda-pratinjau");

  await page.goto(WEB + "/modul/?slug=modul-2");
  await page.locator("#content h1").waitFor();
  assert.equal(await page.locator("#content h1").textContent(), "Modul ini terkunci");
  await noLeakyText(page, "modul terkunci");
  userA.token = (await login(userA.email, userA.password)).token;
  noIssues();
  await context.close();
});

test("persetujuan admin membuka akses penuh; kartu disalin utuh; progres tersimpan", async () => {
  await approve(userA.email);
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/modul/?slug=modul-2");
  await page.locator("[data-card]").first().waitFor();
  assert.equal(await page.locator("#akses-badge").textContent(), "Akses penuh");
  await noLeakyText(page, "modul-2");

  const card = page.locator("[data-card]").first();
  await card.getByRole("button", { name: "Salin prompt" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const expected = await card.locator("pre").evaluate((el) => el.textContent.replace(/\n$/, ""));
  assert.equal(clip, expected, "isi papan klip harus sama dengan teks kartu");
  assert.ok(clip.length > 200);
  await shot(page, "03-kartu");

  const done = page.getByRole("button", { name: /Tandai selesai/ });
  await done.click();
  await until(async () => (await progressText(page)) === "1 dari 9 selesai", "progres 1 dari 9");
  assert.equal(await page.locator("progress").evaluate((p) => p.value), 1);
  assert.equal(await page.getByRole("button", { name: /Selesai \(klik/ }).count(), 1, "keadaan selesai terbaca dari teks tombol");

  await page.reload();
  await page.locator("[data-card]").first().waitFor();
  assert.equal(await progressText(page), "1 dari 9 selesai", "progres harus bertahan setelah muat ulang");
  await page.getByRole("button", { name: /Selesai \(klik/ }).click();
  await until(async () => (await progressText(page)) === "0 dari 9 selesai", "progres kembali 0");

  await page.goto(WEB + "/modul/?slug=beranda");
  await page.locator("#content h1").waitFor();
  assert.equal(await page.getByRole("button", { name: /Tandai selesai/ }).count(), 0, "Beranda bukan modul alur");
  noIssues();
  await context.close();
});

test("isian peserta pada prompt disorot, diberi petunjuk, dan tetap utuh saat disalin", async () => {
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/modul/?slug=modul-1");
  const card = page.locator("[data-card]").first();
  await card.waitFor();
  assert.ok((await card.locator("mark").count()) >= 3, "baris isian peserta harus disorot");
  assert.match(await card.locator("mark").first().textContent(), /^\[ISI:/);
  assert.equal(await card.getByText("Ganti dulu bagian yang disorot").count(), 1, "kartu berisian memberi petunjuk");

  await card.getByRole("button", { name: "Salin prompt" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(clip.includes("[ISI: nama lengkap sesuai PDDIKTI]"), "penanda isian tidak boleh hilang dari salinan");
  assert.equal(await card.locator("pre").evaluate((el) => el.textContent.replace(/\n$/, "")), clip, "sorotan tidak boleh mengubah teks");

  // Prompt modul lain tidak punya isian peserta: tanda seperti [sebutkan] adalah bentuk jawaban
  // yang diminta dari AI, jadi tidak disorot dan petunjuk isian tidak muncul.
  await page.goto(WEB + "/modul/?slug=modul-6");
  await page.locator("[data-card]").first().waitFor();
  assert.equal(await page.locator("[data-card] mark").count(), 0, "tanda milik AI tidak boleh disorot");
  assert.equal(await page.getByText("Ganti dulu bagian yang disorot").count(), 0);
  noIssues();
  await context.close();
});

test("ponsel: sidebar menjadi laci yang bisa dibuka dan ditutup", async () => {
  const { context, page } = await authed(userA, { viewport: { width: 375, height: 800 } });
  await page.goto(WEB + "/modul/?slug=modul-2");
  await page.locator("#nav a").first().waitFor({ state: "attached" });
  const sidebar = page.locator("#sidebar");
  assert.equal(await sidebar.isVisible(), false, "sidebar tersembunyi di ponsel");
  await noPageOverflow(page, "pembaca di 375px");
  // Terlihat menurut Playwright belum berarti ada di layar: laci masih bisa sedang bergeser masuk.
  const onScreen = async () => { const b = await sidebar.boundingBox(); return !!b && b.x >= 0 && b.x < 375; };
  const toggle = page.getByRole("button", { name: "Daftar modul", exact: true }); // "Tutup daftar modul" juga mengandung kata itu
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  await toggle.click();
  await until(onScreen, "laci benar-benar masuk layar");
  assert.ok(await page.locator("#sidebar").getByRole("link", { name: /Modul 2/ }).isVisible());
  // Laci terbuka = modal sungguhan: aria-expanded benar, role dialog, halaman belakang inert, fokus di dalam.
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  assert.equal(await sidebar.getAttribute("aria-modal"), "true");
  assert.equal(await page.locator("#page-main").evaluate((el) => el.inert), true, "isi halaman dikunci saat laci terbuka");
  assert.equal(await page.evaluate(() => document.getElementById("sidebar").contains(document.activeElement)), true, "fokus pindah ke dalam laci");
  // Tab berputar di dalam laci (tidak bocor ke belakang) dan <summary> grup dapat dijangkau keyboard.
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => ({ inside: document.getElementById("sidebar").contains(document.activeElement), tag: document.activeElement.tagName, text: document.activeElement.textContent.trim().slice(0, 20) }));
    // Setelah butir terakhir, Tab boleh keluar dari dokumen ke antarmuka peramban (activeElement = BODY), tetapi tidak
    // boleh mendarat di isi halaman yang terkunci.
    assert.ok(info.inside || info.tag === "BODY", `Tab tidak boleh mendarat di luar laci (jatuh di <${info.tag}> "${info.text}")`);
    seen.add(info.tag);
  }
  assert.ok(seen.has("SUMMARY"), "grup Alur dan Referensi (<summary>) harus terjangkau lewat Tab di laci");
  await shot(page, "04-ponsel-sidebar");
  // Esc menutup dan mengembalikan fokus ke tombol pembuka.
  await page.keyboard.press("Escape");
  await until(async () => !(await onScreen()), "laci keluar dari layar lewat Esc");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.activeElement.id), "sidebar-toggle", "fokus kembali ke tombol pembuka");
  assert.equal(await page.locator("#page-main").evaluate((el) => el.inert), false, "kunci dilepas setelah laci ditutup");
  await toggle.click();
  await until(onScreen, "laci terbuka lagi");
  await page.getByRole("button", { name: "Tutup daftar modul" }).click();
  await until(async () => !(await onScreen()), "laci keluar dari layar");
  // Jalan ke profil tersedia di ponsel (tombol nama pengguna tersembunyi di bawah lebar sm).
  await toggle.click();
  assert.ok(await sidebar.getByRole("link", { name: /Profil/ }).isVisible(), "tautan profil di laci ponsel");
  await page.keyboard.press("Escape");
  await noLeakyText(page, "pembaca ponsel");
  noIssues();
  await context.close();
});

test("Terapan: daftar dengan kode langsung disetujui; materi satu bagian tanpa tab", async () => {
  const admin = await adminToken();
  const code = (await api("/admin/invite-codes", { method: "POST", token: admin, body: {} })).data.kode.code;
  const email = `terapan-${uid()}@example.test`;
  const { context, page } = await newPage();
  await registerViaUI(page, { email, code });
  await page.waitForURL("**/modul/?slug=beranda");
  await page.locator("#content h1").waitFor();
  // kode undangan = persetujuan: akses penuh sejak detik pertama, tanpa masa trial dan tanpa halaman menunggu
  assert.match(await page.locator("#akses-badge").textContent(), /Akses penuh/);
  assert.doesNotMatch(await page.locator("#akses-badge").textContent(), /[Tt]rial/);
  const mine = (await api("/me", { token: (await login(email, PASSWORD)).token })).data.enrollments;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, "approved");
  assert.equal(mine[0].used_invite_code, code);

  await page.goto(WEB + "/modul/?slug=modul-2");
  await page.locator("[data-card]").first().waitFor();
  await noLeakyText(page, "modul-2 terapan");
  // Satu naskah modul untuk semua peserta: tidak ada tab, dan ketentuan khusus skema
  // ada di dalam modul yang sama.
  assert.equal(await page.getByRole("tab").count(), 0, "materi tidak bercabang");
  assert.equal(await page.locator("#panel-utama").count(), 1, "hanya satu panel isi");
  assert.equal(await page.locator("#content h2", { hasText: "Yang perlu diperhatikan menurut skema" }).count(), 1);
  await shot(page, "05-terapan-modul");
  noIssues();
  await context.close();
});

test("semua tautan internal membawa awalan situs dan navigasi tetap di dalamnya", async () => {
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/modul/?slug=aturan-c");
  await page.locator("#content h1").waitFor();
  await page.locator("#nav a").first().waitFor();
  const bad = await page.evaluate((base) => [...document.querySelectorAll("a[href]")]
    .map((a) => a.getAttribute("href"))
    .filter((h) => h.startsWith("/") && !h.startsWith("//") && !(base === "" || h === base || h.startsWith(base + "/") || h.startsWith(base + "?")))
    , BASE);
  assert.deepEqual(bad, [], `tautan tanpa awalan situs ${BASE}`);
  await page.locator("#nav a", { hasText: "Modul 1" }).click();
  await page.waitForURL(/slug=modul-1/);
  assert.ok(new URL(page.url()).pathname.startsWith(BASE + "/modul/"), "tetap di bawah awalan situs: " + page.url());
  noIssues();
  await context.close();
});

test("unduhan muncul di modul pemiliknya dan isinya sama dengan sumber", async () => {
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const sumber = (rel) => sha(readFileSync(resolve(SRC_MATERI, "01-pustaka-aturan", rel)));
  const unduh = (page) => page.locator('section[aria-labelledby="unduhan-judul"] button');
  const { context, page } = await authed(userA);

  await page.goto(WEB + "/modul/?slug=modul-6");
  const rab = page.getByRole("button", { name: /template-rab-penelitian\.xlsx/ });
  await rab.waitFor();
  assert.equal(await unduh(page).count(), 1, "Modul 6 hanya menyediakan template RAB");
  const [d1] = await Promise.all([page.waitForEvent("download"), rab.click()]);
  assert.equal(d1.suggestedFilename(), "template-rab-penelitian.xlsx");
  assert.equal(sha(readFileSync(await d1.path())), sumber("template-rab-penelitian.xlsx"), "isi unduhan harus sama dengan sumber");

  await page.goto(WEB + "/modul/?slug=modul-8");
  const surat = page.getByRole("button", { name: /template-surat-pernyataan-kesanggupan-dan-pakta-integritas\.docx/ });
  await surat.waitFor();
  assert.equal(await unduh(page).count(), 2, "Modul 8 menyediakan isian substansi dan surat pernyataan");
  const [d2] = await Promise.all([page.waitForEvent("download"), surat.click()]);
  assert.equal(d2.suggestedFilename(), "template-surat-pernyataan-kesanggupan-dan-pakta-integritas.docx");
  assert.equal(sha(readFileSync(await d2.path())), sumber("Template Surat Pernyataan Kesanggupan dan Pakta Integritas Penelitian 2026__78636547.docx"));
  await shot(page, "05-unduhan");
  noIssues();
  await context.close();
});

test("login, galat, keluar, dan sesi rusak", async () => {
  const { context, page } = await newPage();
  await page.goto(WEB + "/login/");
  await page.fill("#email", userA.email);
  await page.fill("#password", "salah-total-123");
  await page.click("#submit");
  const err = page.locator("#form-error");
  await until(() => err.isVisible(), "pesan galat login");
  assert.match(await err.textContent(), /salah/);
  await shot(page, "06-login-galat");

  await page.fill("#password", userA.password);
  await page.click("#submit");
  await page.waitForURL("**/modul/?slug=beranda");
  assert.ok(await page.evaluate(() => !!localStorage.getItem("pdk_token")));

  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("**/login/");
  assert.equal(await page.evaluate(() => localStorage.getItem("pdk_token")), null);
  await page.goto(WEB + "/modul/?slug=beranda");
  await page.waitForURL("**/login/");

  await page.evaluate(() => localStorage.setItem("pdk_token", "v4.public.rusak"));
  await page.goto(WEB + "/modul/?slug=beranda");
  await page.waitForURL("**/login/?sesi=berakhir");
  await until(() => page.locator("#notice").isVisible(), "pemberitahuan sesi berakhir");
  assert.equal(await page.evaluate(() => localStorage.getItem("pdk_token")), null, "token rusak dibersihkan");
  noIssues();
  await context.close();
});

test("profil: ubah nama, tersimpan dan tampil di bilah atas", async () => {
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/profile/");
  await page.locator("#name").waitFor();
  await until(async () => (await page.inputValue("#name")) !== "", "nama terisi");
  await page.fill("#name", "Nama Baru E2E");
  await page.click("#submit");
  await page.getByText("Profil disimpan.").waitFor();
  await page.goto(WEB + "/modul/?slug=beranda");
  await until(async () => (await page.locator("#user-link").textContent()) === "Nama Baru E2E", "nama baru di bilah atas");
  noIssues();
  await context.close();
});

test("halaman daftar pelatihan: akun tanpa pendaftaran dapat mendaftar dengan kode", async () => {
  const admin = await adminToken();
  const code = (await api("/admin/invite-codes", { method: "POST", token: admin, body: {} })).data.kode.code;
  const email = `tanpa-daftar-${uid()}@example.test`;
  const { context, page } = await newPage();
  await registerViaUI(page, { email });
  await page.waitForURL("**/pending-approval/");
  // Akun yang sudah terdaftar diberi tahu, bukan diminta mendaftar lagi.
  await page.goto(WEB + "/enroll/");
  await until(async () => /sudah terdaftar/i.test(await page.locator("#intro").textContent()), "pesan sudah terdaftar");
  assert.equal(await page.locator("#form").isHidden(), true, "formulir disembunyikan bila sudah terdaftar");

  // Akun tanpa pendaftaran (mis. hasil seed-admin) mendaftar sendiri; kode membuka akses penuh.
  mongoEval(`enrollments.deleteMany({user_id: db.getSiblingDB("${DB}").users.findOne({email:"${email}"})._id})`);
  await page.goto(WEB + "/modul/?slug=beranda");
  await page.waitForURL("**/enroll/");
  await page.fill("#invite_code", code);
  await page.click("#submit");
  await page.waitForURL("**/modul/?slug=beranda");
  assert.equal(await page.locator("#akses-badge").textContent(), "Akses penuh");
  noIssues();
  await context.close();
});

test("rantai pengalihan: profil belum lengkap, lalu pulih", async () => {
  const email = `rantai-${uid()}@example.test`;
  const reg = await api("/register", { method: "POST", body: { name: "Rantai Uji", email, password: PASSWORD, affiliation: "Univ Uji" } });
  assert.equal(reg.status, 201);
  mongoEval(`users.updateOne({email:"${email}"},{$set:{affiliation:""}})`);

  const { context, page } = await authed({ email, password: PASSWORD });
  // Pembaca memanggil /home; backend menjawab 409 + redirect, klien harus mengikutinya.
  await page.goto(WEB + "/modul/?slug=beranda");
  await page.waitForURL("**/profile-complete/");
  await page.fill("#affiliation", "x");
  await page.click("#submit");
  assert.match(await page.locator("#form-error").textContent(), /Afiliasi/);
  await page.fill("#affiliation", "Institut Rantai");
  await page.click("#submit");
  await page.waitForURL("**/pending-approval/");

  await shot(page, "09-rantai-pulih");
  noIssues();
  await context.close();
});

test("daftar: Enter mengirim lewat JS, bukan sebagai GET yang membocorkan kata sandi ke URL", async () => {
  const { context, page } = await newPage();
  await page.goto(WEB + "/register/", { waitUntil: "domcontentloaded" });
  await page.fill("#name", "Peserta Cepat");
  await page.fill("#email", `cepat-${uid()}@example.test`);
  await page.fill("#password", "rahasia-cepat-123");
  await page.fill("#affiliation", "Universitas Uji");
  await page.press("#password", "Enter");
  await page.waitForURL("**/pending-approval/");
  assert.equal(new URL(page.url()).search, "", "form tidak boleh dikirim secara bawaan (GET) ke URL");
  assert.doesNotMatch(page.url(), /password|rahasia/i);
  noIssues();
  await context.close();
});

test("kata sandi: tombol tampil/sembunyi mengubah jenis kolom dan keadaannya terbaca", async () => {
  const { context, page } = await newPage();
  await page.goto(WEB + "/login/");
  const toggle = page.getByRole("button", { name: "Tampilkan kata sandi" });
  assert.equal(await page.locator("#password").getAttribute("type"), "password");
  assert.equal(await toggle.getAttribute("aria-pressed"), "false");
  await page.fill("#password", "abc12345");
  await toggle.click();
  assert.equal(await page.locator("#password").getAttribute("type"), "text");
  assert.equal(await toggle.getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#password").inputValue(), "abc12345", "isi tidak hilang saat jenis kolom berganti");
  await toggle.click();
  assert.equal(await page.locator("#password").getAttribute("type"), "password");
  noIssues();
  await context.close();
});

test("halaman publik tidak melebar ke samping di ponsel kecil (360 dan 390 px)", async () => {
  for (const width of [360, 390]) {
    for (const path of ["/", "/login/", "/register/", "/forgot-password/"]) {
      const { context, page } = await newPage({ viewport: { width, height: 760 } });
      await page.goto(WEB + path);
      await page.waitForLoadState("networkidle");
      await noPageOverflow(page, `${path} di ${width}px`);
      await noLeakyText(page, `${path} di ${width}px`);
      await context.close();
    }
  }
  noIssues();
});

test("lupa dan reset kata sandi: tampilan, validasi, dan token salah", async () => {
  const { context, page } = await newPage();
  await page.goto(WEB + "/forgot-password/");
  await page.fill("#email", `siapa-${uid()}@example.test`);
  await page.click("#submit");
  await until(() => page.locator("#result").isVisible(), "hasil generik");
  assert.match(await page.locator("#result").textContent(), /Jika email terdaftar/);

  await page.goto(WEB + "/reset-password/");
  assert.equal(await page.locator("#form").isHidden(), true, "tanpa token: formulir disembunyikan");
  await page.goto(WEB + "/reset-password/?token=tebakan");
  await page.fill("#password", "sandi-baru-123");
  await page.fill("#password2", "sandi-lain-456");
  await page.click("#submit");
  assert.match(await page.locator("#form-error").textContent(), /harus sama/);
  await page.fill("#password2", "sandi-baru-123");
  await page.click("#submit");
  await until(async () => /tidak valid|kedaluwarsa/.test(await page.locator("#form-error").textContent()), "token salah ditolak");
  noIssues();
  await context.close();
});

// ── Panel admin ──
// Halaman admin siap bila kerangka navigasi terpasang dan keadaan "Memuat..." sudah hilang.
async function adminReady(page) {
  await page.locator("#admin-nav header").waitFor();
  try {
    await until(async () => (await page.locator("#state").textContent()).trim() === "", "halaman admin selesai memuat");
  } catch (e) {
    // Sertakan apa yang tampil di halaman: tanpa ini kegagalan hanya berbunyi "batas waktu".
    const shown = (await page.locator("#state").textContent().catch(() => "(tak terbaca)")).trim();
    throw new Error(`${e.message}; url=${page.url()}; #state="${shown}"; masalah konsol=${JSON.stringify(issues.slice(-3))}`);
  }
}

// Canvas Chart.js benar-benar tergambar (ada piksel berwarna), bukan kosong.
async function canvasDrawn(page, index = 0) {
  return page.evaluate((i) => {
    const c = document.querySelectorAll("canvas")[i];
    if (!c || !c.width || !c.height) return false;
    return c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some((v, k) => k % 4 === 3 && v !== 0);
  }, index);
}

async function enrollmentOf(email) {
  const r = await api(`/admin/enrollments?q=${encodeURIComponent(email)}`, { token: await adminToken() });
  return r.data.enrollments[0]?.enrollment;
}

async function registerAPI(label) {
  const email = `${label}-${uid()}@example.test`;
  const r = await api("/register", { method: "POST", body: { name: `Peserta ${label}`, email, password: PASSWORD, affiliation: "Univ Uji" } });
  assert.ok(r.status < 300, "daftar lewat API " + email);
  return { email, token: r.data.token, id: r.data.user.id };
}

test("admin: akses dibatasi, navigasi bekerja, dasbor sesuai API dan grafik tergambar", async () => {
  { // peserta biasa disingkirkan dari panel admin
    const { context, page } = await authed(userA);
    await page.goto(WEB + "/admin/dashboard/");
    await until(() => !page.url().includes("/admin/"), "peserta biasa disingkirkan dari panel admin");
    await context.close();
  }
  { // tanpa sesi -> halaman masuk
    const { context, page } = await newPage();
    await page.goto(WEB + "/admin/users/");
    await until(() => page.url().includes("/login/"), "tanpa sesi menuju halaman masuk");
    await context.close();
  }
  const { context, page } = await authed(ADMIN);
  await page.goto(WEB + "/admin/dashboard/");
  await adminReady(page);
  const d = (await api("/admin/dashboard", { token: await adminToken() })).data;
  for (const [label, n] of [["Total", d.users.total], ["Aktif", d.users.aktif], ["Admin", d.users.admin], ["Menunggu persetujuan", d.enrollments.pending], ["Disetujui", d.enrollments.disetujui]]) {
    await page.getByRole("link", { name: new RegExp(`^${label}\\s+${n}\\b`) }).first().waitFor({ timeout: 3000 });
  }
  await until(() => canvasDrawn(page, 0), "grafik status pendaftaran tergambar");
  await until(() => canvasDrawn(page, 1), "grafik akun tergambar");
  assert.equal(await page.locator("canvas").count(), 2, "dua grafik (kode undangan berupa kartu angka)");
  await shot(page, "20-admin-dasbor-light");
  await noLeakyText(page, "dasbor admin");
  await noPageOverflow(page, "dasbor admin");

  const nav = page.getByRole("navigation", { name: "Menu admin" });
  for (const [label, path] of [["Pengguna", "/admin/users/"], ["Pendaftaran", "/admin/enrollments/"], ["Kode undangan", "/admin/invite-codes/"], ["Progres", "/admin/progress/"], ["Dasbor", "/admin/dashboard/"]]) {
    await nav.getByRole("link", { name: label }).click();
    await page.waitForURL(`**${BASE}${path}**`);
    await adminReady(page);
    assert.equal(await page.getByRole("navigation", { name: "Menu admin" }).getByRole("link", { name: label }).getAttribute("aria-current"), "page", `menu aktif: ${label}`);
  }
  noIssues();
  await context.close();
});

test("admin: pendaftaran disetujui, diberi trial, dan dicabut lewat dialog", async () => {
  const b = await registerAPI("b");
  const { context, page } = await authed(ADMIN);
  await page.goto(WEB + "/admin/enrollments/");
  await adminReady(page);
  assert.equal(await page.getByLabel("Status").inputValue(), "pending", "bawaan menampilkan yang menunggu");
  await page.getByLabel("Cari peserta").fill(b.email);
  const row = page.getByRole("row", { name: new RegExp(b.email) });
  await row.waitFor();
  await until(async () => (await page.locator("tbody tr").count()) === 1, "satu baris hasil pencarian");
  await shot(page, "21-admin-pendaftaran-light");

  // Esc menutup dialog tanpa mengubah apa pun
  await row.getByRole("button", { name: "Setujui" }).click();
  let dlg = page.locator("dialog[open]");
  await dlg.waitFor();
  assert.match(await dlg.textContent(), /Setujui pendaftaran/);
  await page.keyboard.press("Escape");
  await dlg.waitFor({ state: "detached" });
  assert.equal((await enrollmentOf(b.email)).status, "pending", "batal tidak mengubah data");

  // setujui
  await row.getByRole("button", { name: "Setujui" }).click();
  dlg = page.locator("dialog[open]");
  await dlg.getByRole("button", { name: "Setujui" }).click();
  await dlg.waitFor({ state: "detached" });
  assert.equal((await enrollmentOf(b.email)).status, "approved");
  await until(() => page.getByText("Tidak ada pendaftaran yang cocok.").isVisible(), "baris hilang dari daftar menunggu");

  // semua status: cabut (dialog bahaya: fokus awal di Batal)
  await page.getByLabel("Status").selectOption("all");
  await row.waitFor();
  await row.getByRole("button", { name: "Cabut" }).click();
  dlg = page.locator("dialog[open]");
  assert.equal(await dlg.evaluate((d) => d.contains(document.activeElement) && document.activeElement.textContent), "Batal", "fokus awal dialog cabut di Batal");
  await dlg.getByRole("button", { name: "Cabut akses" }).click();
  await dlg.waitFor({ state: "detached" });
  assert.equal((await enrollmentOf(b.email)).status, "pending");

  // trial: nilai di luar batas ditolak di dalam dialog (dialog tetap terbuka), lalu nilai sah diterima
  await row.getByRole("button", { name: "Beri trial" }).click();
  dlg = page.locator("dialog[open]");
  await dlg.getByLabel("Lama trial (hari)").fill("400");
  await dlg.getByRole("button", { name: "Atur trial" }).click();
  await until(async () => /1 sampai 365/.test(await dlg.locator('[role="alert"]').textContent()), "galat batas trial tampil di dialog");
  assert.equal(await dlg.count(), 1, "dialog tetap terbuka saat galat");
  await dlg.getByLabel("Lama trial (hari)").fill("3");
  await dlg.getByRole("button", { name: "Atur trial" }).click();
  await dlg.waitFor({ state: "detached" });
  const e = await enrollmentOf(b.email);
  assert.equal(e.status, "trial");
  assert.equal(e.trial_days_left, 3);
  await until(() => row.getByText("Trial, sisa 3 hari").isVisible(), "lencana trial tampil");
  await noLeakyText(page, "pendaftaran admin");
  noIssues();
  await context.close();
});

test("admin: kode undangan dibuat, disalin, diubah, dan dinonaktifkan", async () => {
  const code = ("E2E" + uid()).toUpperCase();
  const { context, page } = await authed(ADMIN);
  await page.goto(WEB + "/admin/invite-codes/");
  await adminReady(page);

  await page.getByRole("button", { name: "Buat kode" }).click();
  let dlg = page.locator("dialog[open]");
  await shot(page, "22-admin-kode-dialog-light");
  assert.match(await dlg.textContent(), /langsung disetujui/, "dialog menjelaskan bahwa kode = persetujuan");
  assert.equal(await dlg.getByLabel(/trial/i).count(), 0, "tanpa isian trial");
  await dlg.getByLabel("Kode kustom (opsional)").fill("ab");
  await dlg.getByRole("button", { name: "Buat kode" }).click();
  assert.match(await dlg.locator('[role="alert"]').textContent(), /4 sampai 32/, "kode kustom pendek ditolak");
  await dlg.getByLabel("Kode kustom (opsional)").fill(code.toLowerCase());
  await dlg.getByLabel("Kuota pemakaian").fill("2");
  await dlg.getByLabel("Catatan (opsional)").fill("angkatan e2e");
  await dlg.getByRole("button", { name: "Buat kode" }).click();
  await dlg.waitFor({ state: "detached" });
  const row = page.getByRole("row", { name: new RegExp(code) });
  await row.waitFor();
  const text = await row.textContent();
  assert.match(text, /0 \/ 2/); assert.doesNotMatch(text, /hari/); assert.match(text, /Aktif/); assert.match(text, /angkatan e2e/);
  assert.equal(await page.getByRole("columnheader", { name: "Trial" }).count(), 0, "tabel kode tanpa kolom trial");

  // kode ganda ditolak backend dan galatnya tampil di dialog
  await page.getByRole("button", { name: "Buat kode" }).click();
  dlg = page.locator("dialog[open]");
  await dlg.getByLabel("Kode kustom (opsional)").fill(code);
  await dlg.getByRole("button", { name: "Buat kode" }).click();
  await until(async () => /sudah ada/i.test(await dlg.locator('[role="alert"]').textContent()), "kode ganda ditolak");
  await dlg.getByRole("button", { name: "Batal" }).click();
  await dlg.waitFor({ state: "detached" });

  // salin: isi papan klip sama dengan kode
  await row.getByRole("button", { name: `Salin kode ${code}` }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);

  // ubah: tanpa perubahan ditolak, lalu perubahan tersimpan
  await row.getByRole("button", { name: "Ubah" }).click();
  dlg = page.locator("dialog[open]");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await until(async () => /Tidak ada perubahan/.test(await dlg.locator('[role="alert"]').textContent()), "tanpa perubahan ditolak");
  await dlg.getByLabel("Catatan").fill("diubah");
  await dlg.getByLabel("Kuota pemakaian").fill("3");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await dlg.waitFor({ state: "detached" });
  const listed = async () => (await api("/admin/invite-codes?limit=100", { token: await adminToken() })).data.kode.find((k) => k.code === code);
  const k = await listed();
  assert.equal(k.notes, "diubah"); assert.equal(k.max_uses, 3);
  await until(() => row.getByText("diubah").isVisible(), "catatan baru tampil");

  // nonaktifkan lalu saring
  await row.getByRole("button", { name: "Nonaktifkan" }).click();
  await until(async () => (await listed()).state === "disabled", "kode nonaktif di backend");
  await page.getByLabel("Status").selectOption("disabled");
  await row.waitFor();
  assert.match(await row.textContent(), /Nonaktif/);
  await noLeakyText(page, "kode undangan admin");
  noIssues();
  await context.close();
});

test("admin: pengguna dicari dan disaring; detail menonaktifkan dan mengubah peran; akun sendiri terlindung", async () => {
  const c = await registerAPI("c");
  const { context, page } = await authed(ADMIN);
  await page.goto(WEB + "/admin/users/");
  await adminReady(page);

  await page.getByLabel("Cari").fill(c.email);
  const row = page.getByRole("row", { name: new RegExp(c.email) });
  await row.waitFor();
  await until(async () => (await page.locator("tbody tr").count()) === 1, "pencarian menyisakan satu pengguna");
  await shot(page, "23-admin-pengguna-light");
  // pencarian regex tidak ditafsirkan sebagai regex
  await page.getByLabel("Cari").fill(".*");
  await until(() => page.getByText("Tidak ada pengguna yang cocok.").isVisible(), "'.*' dicari sebagai teks biasa");
  await page.getByLabel("Cari").fill("");
  await page.getByLabel("Peran").selectOption("admin");
  await until(async () => {
    const rows = await page.locator("tbody tr").allTextContents();
    return rows.length > 0 && rows.every((t) => /Admin/.test(t));
  }, "filter peran admin hanya menampilkan admin");

  // detail: nonaktifkan lalu aktifkan
  await page.goto(WEB + `/admin/users-detail/?id=${c.id}`);
  await adminReady(page);
  await page.getByRole("heading", { name: "Peserta c", exact: true }).waitFor();
  await page.getByRole("button", { name: "Nonaktifkan akun" }).click();
  let dlg = page.locator("dialog[open]");
  await dlg.getByRole("button", { name: "Nonaktifkan" }).click();
  await dlg.waitFor({ state: "detached" });
  const detail = async () => (await api(`/admin/users/${c.id}`, { token: await adminToken() })).data.user;
  assert.equal((await detail()).is_active, false);
  assert.equal((await api("/me", { token: c.token })).status, 401, "sesi peserta nonaktif langsung berakhir");
  await page.getByRole("button", { name: "Aktifkan akun" }).click();
  dlg = page.locator("dialog[open]");
  await dlg.getByRole("button", { name: "Aktifkan" }).click();
  await dlg.waitFor({ state: "detached" });
  assert.equal((await detail()).is_active, true);

  // peran: jadikan admin lalu kembalikan
  await page.getByRole("button", { name: "Jadikan admin" }).click();
  dlg = page.locator("dialog[open]");
  await dlg.getByRole("button", { name: "Jadikan admin" }).click();
  await dlg.waitFor({ state: "detached" });
  assert.equal((await detail()).role, "admin");
  await page.getByRole("button", { name: "Jadikan peserta" }).click();
  dlg = page.locator("dialog[open]");
  await dlg.getByRole("button", { name: "Jadikan peserta" }).click();
  await dlg.waitFor({ state: "detached" });
  assert.equal((await detail()).role, "user");
  await shot(page, "24-admin-detail-light");

  // akun sendiri: tombol dikunci dan ada penjelasan
  const adminId = (await login(ADMIN.email, ADMIN.password)).user.id;
  await page.goto(WEB + `/admin/users-detail/?id=${adminId}`);
  await adminReady(page);
  await page.getByRole("button", { name: "Nonaktifkan akun" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Nonaktifkan akun" }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Jadikan peserta" }).isDisabled(), true);
  assert.match(await page.locator("main").textContent(), /akun Anda/);

  // id asing: pesan jelas, bukan kerangka rusak
  await page.goto(WEB + "/admin/users-detail/?id=tidak-ada");
  await until(() => page.getByText("Pengguna tidak ditemukan.").isVisible(), "id asing ditolak dengan pesan");
  await noLeakyText(page, "detail pengguna");
  noIssues();
  await context.close();
});

test("admin: progres memuat corong dan peserta sesuai API", async () => {
  const t = await adminToken();
  const res = (await api("/admin/progress?limit=50", { token: t })).data;
  const mine = res.peserta.find((p) => p.email === userA.email);
  assert.ok(mine, "userA ada di daftar progres");
  const { context, page } = await authed(ADMIN);
  await page.goto(WEB + "/admin/progress/");
  await adminReady(page);
  await page.getByLabel("Cari peserta").fill(userA.email);
  const row = page.getByRole("row", { name: new RegExp(userA.email) });
  await row.waitFor();
  assert.match(await row.textContent(), new RegExp(`${mine.selesai} / ${res.total_alur}`), "progres peserta sama dengan API");
  const funnelRows = await page.getByRole("region", { name: "Corong modul alur" }).locator("tbody tr").count();
  assert.equal(funnelRows, res.total_alur, "satu baris corong per modul alur");
  await until(() => canvasDrawn(page, 0), "grafik corong tergambar");
  await shot(page, "25-admin-progres-light");

  await noLeakyText(page, "progres admin");
  noIssues();
  await context.close();
});

// ── Landing: mesin pencari, footer, dan penyuntingan oleh admin ──
const lf = (page, path) => page.locator("#f-" + path.replace(/\./g, "-"));
const landingH1 = (page) => page.locator("main h1").first();
const toastText = (page) => page.locator("#toast-host").textContent();
const publicLanding = async () => (await api("/api/landing")).data;

test("landing boleh diindeks dan halaman lain tidak; footer lengkap dengan kredit; tanpa kata gratis", async () => {
  const { context, page } = await newPage();
  await page.goto(WEB + "/");
  await page.locator("#skema article").first().waitFor();
  assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /^index, follow/);
  assert.equal(await page.locator('link[rel="canonical"]').count(), 0, "tanpa PDK_SITE_URL canonical tidak dibuat (alamat relatif tidak sah)");

  const footer = page.getByRole("contentinfo");
  assert.equal(await footer.getByRole("link", { name: "mubaroqadb", exact: true }).getAttribute("href"), "https://github.com/mubaroqadb");
  assert.equal(await footer.getByRole("link", { name: "Akademi Digital Bandung", exact: true }).getAttribute("href"), "https://digitalbdg.ac.id");
  assert.match((await footer.textContent()).replace(/\s+/g, " "), /Dikembangkan oleh mubaroqadb, Akademi Digital Bandung/);
  for (const [name, href] of [["Cara kerja", "#cara"], ["Alur penyusunan", "#alur"], ["Cakupan", "#skema"], ["Tanya jawab", "#faq"], ["Masuk", BASE + "/login/"], ["Daftar", BASE + "/register/"]]) {
    assert.equal(await footer.getByRole("link", { name, exact: true }).getAttribute("href"), href, `tautan footer ${name}`);
  }
  assert.match(await footer.textContent(), /Acuan aturan: .+/);

  // logo ZafranOS: ikon merek termuat (bukan gambar rusak) di bilah atas dan footer; ikon tab ada; sumber 1 MB tidak terbit
  const logos = await page.locator("img.brand-mark").evaluateAll((imgs) => imgs.map((i) => i.complete && i.naturalWidth > 0));
  assert.deepEqual(logos, [true, true], "ikon merek termuat di bilah atas dan footer");
  assert.equal(await page.locator('link[rel="icon"]').getAttribute("href"), BASE + "/assets/img/favicon.png");
  for (const f of ["favicon.png", "apple-touch-icon.png", "logo-mark.png", "og.png"]) {
    const r = await fetch(`${WEB}/assets/img/${f}`);
    assert.equal(r.status, 200, f);
    assert.equal(r.headers.get("content-type"), "image/png", f);
  }
  assert.equal((await fetch(`${WEB}/assets/img/ZafranOS-logo3.png`)).status, 404, "logo sumber 1 MB tidak diterbitkan");
  assert.ok([400, 404].includes((await fetch(`${WEB}/%`)).status), "alamat berkode persen rusak ditolak, bukan mematikan server");
  assert.equal((await fetch(`${WEB}/`)).status, 200, "server tetap hidup sesudahnya");

  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /gratis|berbayar/i, "tidak ada konteks gratis di landing");
  await noLeakyText(page, "landing");

  // halaman lain tetap noindex; robots.txt tidak memblokir apa pun (noindex hanya terbaca bila halaman boleh diambil)
  for (const path of ["/login/", "/register/", "/forgot-password/"]) {
    await page.goto(WEB + path);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex", path);
  }
  const robots = await (await fetch(WEB + "/robots.txt")).text();
  assert.match(robots, /^User-agent: \*\nAllow: \/\n/);
  assert.doesNotMatch(robots, /Disallow/i);
  noIssues();
  await context.close();
});

test("admin: landing disunting, disimpan, diurutkan, konflik ditolak, riwayat dipulihkan, dikembalikan ke bawaan", async () => {
  const adminT = await adminToken();
  await api("/admin/landing", { method: "DELETE", token: adminT }); // mulai dari teks bawaan

  // Hanya admin yang boleh menyunting; publik hanya membaca.
  const peserta = await login(userA.email, userA.password);
  const body = { content: { fields: { "hero.title": "x" } } };
  assert.equal((await api("/admin/landing", { method: "POST", body })).status, 401);
  assert.equal((await api("/admin/landing", { method: "POST", body, token: peserta.token })).status, 403);
  assert.equal((await api("/admin/landing", { method: "DELETE", token: peserta.token })).status, 403);
  assert.equal((await publicLanding()).content, null, "belum disunting: content null");

  const { context, page } = await authed(ADMIN);
  page.on("dialog", (d) => d.accept()); // penjaga perubahan belum disimpan diuji terpisah di bawah
  await page.goto(WEB + "/admin/landing/");
  await adminReady(page);
  assert.equal((await page.locator('#admin-menu a[aria-current="page"]').textContent()).trim(), "Landing");
  assert.equal(await page.locator("#admin-menu img.brand-mark").evaluate((i) => i.complete && i.naturalWidth > 0), true, "logo di panel admin (dibangun JS, awalan situs) termuat");
  assert.equal(await lf(page, "hero.title").inputValue(), "Susun proposal DPPM sampai", "formulir memuat teks bawaan dari landing");
  assert.match(await lf(page, "hero.lead").inputValue(), /^Sembilan modul/);
  assert.equal(await page.locator('[role="group"][aria-label="Butir 1"]').count(), 1);
  const save = page.getByRole("button", { name: "Simpan perubahan" });
  assert.equal(await save.isDisabled(), true, "tanpa perubahan tombol simpan nonaktif");
  assert.match(await page.getByText(/perubahan sudah tersimpan/i).textContent(), /Semua perubahan sudah tersimpan/);
  await shot(page, "29-admin-landing-light");

  // 1. ubah satu bidang; yang dikirim hanya yang berbeda dari bawaan
  await lf(page, "hero.title").fill("Judul uji e2e");
  await page.getByText("Ada perubahan yang belum disimpan.").waitFor();
  assert.equal(await save.isEnabled(), true);
  await save.click();
  await until(async () => /Landing disimpan/.test(await toastText(page)), "toast simpan");
  let pub = await publicLanding();
  assert.equal(pub.version, 1);
  assert.deepEqual(pub.content.fields, { "hero.title": "Judul uji e2e" }, "hanya bidang yang berubah yang tersimpan");
  assert.deepEqual(pub.content.lists, {});
  assert.equal(await save.isDisabled(), true, "setelah simpan formulir bersih");
  await until(async () => (await page.getByRole("button", { name: "Kembalikan semua" }).isEnabled()), "kartu kembalikan-ke-bawaan menyegar tanpa muat ulang");

  // 2. validasi sisi klien, lalu tambah pertanyaan dan teks berisi tanda kurung sudut
  const faqAdd = page.getByRole("button", { name: "Tambah pertanyaan" });
  await faqAdd.click();
  assert.equal(await page.evaluate(() => document.activeElement.id), "l-faq-items-6-q", "fokus pindah ke butir baru");
  await page.locator("#l-faq-items-6-q").fill("Pertanyaan uji e2e?");
  await save.click();
  assert.match(await page.locator('[role="alert"]:not(.hidden)').textContent(), /Jawaban wajib diisi/);
  assert.equal((await publicLanding()).version, 1, "yang ditolak tidak menyimpan apa pun");
  await page.locator("#l-faq-items-6-a").fill("Jawaban uji e2e.");
  const xss = "<img src=x onerror=alert(1)> judul ajakan";
  await lf(page, "cta.title").fill(xss);
  await save.click();
  await until(async () => (await publicLanding()).version === 2, "versi 2 tersimpan");
  await page.getByRole("row", { name: /^Versi 1 / }).waitFor(); // riwayat menyegar tanpa muat ulang

  // 3. urutan: naikkan butir baru satu langkah; fokus mengikuti tombol yang sama
  await page.getByRole("button", { name: "Naikkan pertanyaan 7" }).click();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-label")), "Naikkan pertanyaan 6");
  await save.click();
  await until(async () => (await publicLanding()).version === 3, "versi 3 tersimpan");

  // 4. landing publik (konteks baru, tanpa cache) menampilkan semuanya sebagai TEKS
  const pub1 = await newPage();
  await pub1.page.goto(WEB + "/");
  await until(async () => /Judul uji e2e/.test(await landingH1(pub1.page).textContent()), "judul baru tampil");
  assert.match((await landingH1(pub1.page).textContent()).replace(/\s+/g, " "), /^Judul uji e2e siap submit$/);
  const faqs = await pub1.page.locator("#faq summary").allTextContents();
  assert.equal(faqs.length, 7);
  assert.equal(faqs[5].trim(), "Pertanyaan uji e2e?", "butir yang dinaikkan menempati urutan keenam");
  assert.equal(await pub1.page.locator("#faq details").nth(5).locator("p").textContent(), "Jawaban uji e2e.");
  assert.equal(await pub1.page.locator("section h2", { hasText: "judul ajakan" }).textContent(), xss, "tanda kurung sudut tampil sebagai teks");
  assert.equal(await pub1.page.locator("section h2 img").count(), 0, "tidak ada elemen yang disisipkan dari teks");
  assert.equal(await pub1.page.locator("#skema article").count(), 2, "kotak cakupan skema tetap tampil");
  await noLeakyText(pub1.page, "landing tersunting");
  noIssues();
  await pub1.context.close();

  // 5. dua penyunting: yang membuka versi lama ditolak dan tidak menimpa
  const other = await authed(ADMIN);
  other.page.on("dialog", (d) => d.accept());
  await other.page.goto(WEB + "/admin/landing/");
  await adminReady(other.page);
  await lf(page, "hero.title").fill("Judul A");
  await save.click();
  await until(async () => (await publicLanding()).version === 4, "versi 4 tersimpan");
  await lf(other.page, "hero.title").fill("Judul B");
  await other.page.getByRole("button", { name: "Simpan perubahan" }).click();
  await until(async () => /diubah oleh orang lain/.test(await other.page.locator('[role="alert"]:not(.hidden)').textContent()), "konflik ditolak");
  assert.match(await other.page.locator('[role="alert"]:not(.hidden)').textContent(), /Isian Anda masih ada/);
  assert.equal(await lf(other.page, "hero.title").inputValue(), "Judul B", "isian yang ditolak tidak dibuang");
  assert.equal((await publicLanding()).content.fields["hero.title"], "Judul A", "konflik tidak menimpa");
  await other.context.close();

  // 6. riwayat dan pemulihan: versi 1 hanya memuat judul uji (riwayat sudah disegarkan oleh simpan, tanpa muat ulang)
  const row1 = page.getByRole("row", { name: /^Versi 1 / });
  await row1.waitFor();
  assert.equal(await page.getByRole("row").count() - 1, 3, "riwayat memuat versi yang sudah digantikan (1 sampai 3); versi 4 masih aktif");
  await row1.getByRole("button", { name: "Pulihkan versi 1" }).click();
  const dlg = page.locator("dialog[open]");
  await dlg.getByRole("button", { name: "Pulihkan" }).click();
  await dlg.waitFor({ state: "detached" });
  await until(async () => (await publicLanding()).version === 5, "versi 5 (hasil pemulihan)");
  pub = await publicLanding();
  assert.deepEqual(pub.content.fields, { "hero.title": "Judul uji e2e" });
  assert.deepEqual(pub.content.lists, {});
  await until(async () => (await lf(page, "hero.title").inputValue()) === "Judul uji e2e", "formulir dimuat ulang setelah pemulihan");

  // 7. kembali ke bawaan lewat dialog bahaya
  await page.getByRole("button", { name: "Kembalikan semua" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Kembalikan", exact: true }).click();
  await until(async () => (await publicLanding()).content === null, "kembali ke bawaan");
  await until(async () => (await lf(page, "hero.title").inputValue()) === "Susun proposal DPPM sampai", "formulir kembali ke bawaan");
  assert.equal(await page.getByRole("button", { name: "Kembalikan semua" }).isDisabled(), true);
  const pub2 = await newPage();
  await pub2.page.goto(WEB + "/");
  await until(async () => /^Susun proposal DPPM sampai siap submit$/.test((await landingH1(pub2.page).textContent()).replace(/\s+/g, " ")), "landing kembali ke bawaan");
  assert.equal(await pub2.page.locator("#faq summary").count(), 6);
  await pub2.context.close();

  // 8. penjaga: menutup halaman dengan perubahan yang belum disimpan memicu konfirmasi
  const guard = await authed(ADMIN);
  await guard.page.goto(WEB + "/admin/landing/");
  await adminReady(guard.page);
  await lf(guard.page, "hero.chip").fill("Perubahan yang belum disimpan");
  let guarded = false;
  guard.page.on("dialog", async (d) => { guarded = d.type() === "beforeunload"; await d.dismiss(); });
  await guard.page.close({ runBeforeUnload: true });
  await until(() => guarded, "penjaga perubahan belum disimpan");
  await guard.context.close();

  noIssues();
  await context.close();
});

test("admin: ketikan saat menyimpan tetap belum tersimpan; konflik mempertahankan isian dan dapat ditimpa dengan sadar", async () => {
  const adminT = await adminToken();
  await api("/admin/landing", { method: "DELETE", token: adminT });
  const ver = async () => (await publicLanding()).version;
  const { context, page } = await authed(ADMIN);
  page.on("dialog", (d) => d.accept());
  await page.goto(WEB + "/admin/landing/");
  await adminReady(page);
  const save = page.getByRole("button", { name: "Simpan perubahan" });

  // Permintaan simpan ditunda supaya ada waktu mengetik selagi ia berjalan.
  await page.route(`${API}/admin/landing`, async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await lf(page, "hero.chip").fill("Chip terkirim");
  await save.click();
  await lf(page, "hero.lead").fill("Lead diketik saat menyimpan");
  await until(async () => /Landing disimpan/.test(await toastText(page)), "toast simpan");
  assert.deepEqual((await publicLanding()).content.fields, { "hero.chip": "Chip terkirim" }, "hanya yang sudah diketik sebelum kirim yang terkirim");
  await page.getByText("Ada perubahan yang belum disimpan.").waitFor();
  assert.equal(await save.isEnabled(), true, "ketikan susulan belum tersimpan, tombol simpan tetap aktif");
  await page.unroute(`${API}/admin/landing`);
  await save.click();
  await until(async () => (await publicLanding()).content.fields["hero.lead"] === "Lead diketik saat menyimpan", "ketikan susulan tersimpan");
  await page.getByText("Semua perubahan sudah tersimpan.").waitFor();

  // Konflik: isian yang ditolak dipertahankan; menekan simpan lagi menimpa dengan sadar, versi yang tertimpa ada di riwayat.
  const other = await authed(ADMIN);
  other.page.on("dialog", (d) => d.accept());
  await other.page.goto(WEB + "/admin/landing/");
  await adminReady(other.page);
  const v0 = await ver();
  await lf(page, "hero.title").fill("Judul A");
  await save.click();
  await until(async () => (await ver()) === v0 + 1, "judul A tersimpan");
  await lf(other.page, "hero.title").fill("Judul B");
  const otherSave = other.page.getByRole("button", { name: "Simpan perubahan" });
  await otherSave.click();
  await until(async () => /diubah oleh orang lain/.test(await other.page.locator('[role="alert"]:not(.hidden)').textContent()), "konflik ditolak");
  assert.equal(await lf(other.page, "hero.title").inputValue(), "Judul B");
  assert.equal(await ver(), v0 + 1, "konflik tidak menyimpan apa pun");
  await otherSave.click();
  await until(async () => (await ver()) === v0 + 2, "penimpaan sadar tersimpan");
  assert.equal((await publicLanding()).content.fields["hero.title"], "Judul B");
  const hist = (await api("/admin/landing/history", { token: adminT })).data.riwayat;
  assert.ok(hist.some((r) => r.version === v0 + 1), "versi yang tertimpa (Judul A) tersimpan di riwayat");
  await other.context.close();

  await api("/admin/landing", { method: "DELETE", token: adminT }); // kembali ke bawaan untuk uji berikutnya
  noIssues();
  await context.close();
});

test("landing dan editor admin: tampilan terang, gelap, dan ponsel tidak melebar atau memuat teks bocor", async () => {
  const sections = ["#cara", "#alur", "#skema", "#fitur", "#faq"];
  for (const [label, opts] of [["terang", { viewport: { width: 1280, height: 900 } }], ["gelap", { viewport: { width: 1280, height: 900 }, colorScheme: "dark" }], ["ponsel", { viewport: { width: 390, height: 800 } }]]) {
    const { context, page } = await newPage(opts);
    await page.goto(WEB + "/");
    await page.locator("#skema article").first().waitFor();
    await page.waitForLoadState("networkidle");
    await shot(page, `31-landing-atas-${label}`);
    for (const id of sections) {
      await page.locator(id).scrollIntoViewIfNeeded();
      await shot(page, `32-landing${id.slice(1)}-${label}`);
    }
    await page.locator("footer").scrollIntoViewIfNeeded();
    await shot(page, `33-landing-footer-${label}`);
    await noPageOverflow(page, `landing ${label}`);
    await noLeakyText(page, `landing ${label}`);
    await context.close();
  }
  // editor admin di ponsel: bagian atas dan daftar tanya jawab
  const { context, page } = await authed(ADMIN, { viewport: { width: 390, height: 800 } });
  await page.goto(WEB + "/admin/landing/");
  await adminReady(page);
  await shot(page, "34-editor-ponsel-atas");
  await page.locator("#sec-faq").scrollIntoViewIfNeeded();
  await shot(page, "35-editor-ponsel-faq");
  await page.locator("#h-riwayat").scrollIntoViewIfNeeded();
  await shot(page, "36-editor-ponsel-riwayat");
  await noPageOverflow(page, "editor admin di ponsel");
  await noLeakyText(page, "editor admin di ponsel");
  await context.close();
  noIssues();
});

// ── Asisten obrolan pihak ketiga: berjalan di origin yang sama dengan token login, jadi dibatasi keras ──
const cspOf = (page) => page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
const stubbed = (page) => page.evaluate(() => window.__assistantStub || null);

test("asisten obrolan: hanya di landing untuk pengunjung yang belum masuk; kelonggaran CSP hanya di landing", async () => {
  // belum masuk: skrip disuntikkan (document.currentScript tersedia) dan CSP landing memuat kelonggarannya
  const anon = await newPage();
  await anon.page.goto(WEB + "/");
  const stub = await until(() => stubbed(anon.page), "skrip asisten dimuat untuk pengunjung yang belum masuk");
  assert.equal(stub.src, ASSISTANT);
  const csp = await cspOf(anon.page);
  assert.match(csp, /script-src 'self' https:\/\/www\.thunderbolt\.com;/);
  assert.match(csp, /frame-src https:\/\/www\.thunderbolt\.com;/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.thunderbolt\.com /);
  assert.match(csp, /style-src 'self' 'unsafe-inline';/);
  // tanpa meta color-scheme di landing (iframe widget memakai color-scheme: normal; dengan meta itu muncul kotak putih di mode gelap)
  assert.equal(await anon.page.locator('meta[name="color-scheme"]').count(), 0, "landing dengan asisten tanpa meta color-scheme");
  noIssues();
  await anon.context.close();

  // sudah masuk: tidak diminta sama sekali (token login di localStorage tidak boleh terjangkau skrip pihak ketiga)
  const member = await authed(userA);
  const asked = [];
  member.context.on("request", (r) => { if (r.url().startsWith("https://www.thunderbolt.com/")) asked.push(r.url()); });
  await member.page.goto(WEB + "/");
  await member.page.locator("#cta a").waitFor();
  await member.page.waitForLoadState("networkidle");
  assert.deepEqual(asked, [], "pengguna yang sudah masuk tidak boleh memuat skrip pihak ketiga");
  assert.equal(await stubbed(member.page), null);
  await member.context.close();

  // halaman lain: CSP ketat, tidak ada permintaan ke vendor (halaman reset kata sandi memuat token di alamatnya)
  for (const [label, make, path] of [
    ["masuk", () => newPage(), "/login/"], ["daftar", () => newPage(), "/register/"], ["lupa kata sandi", () => newPage(), "/forgot-password/"],
    ["reset kata sandi", () => newPage(), "/reset-password/?token=abc"], ["materi", () => authed(userA), "/modul/?slug=beranda"], ["admin", () => authed(ADMIN), "/admin/dashboard/"],
  ]) {
    const { context, page } = await make();
    let touched = false;
    context.on("request", (r) => { if (/thunderbolt\.com/.test(r.url())) touched = true; });
    await page.goto(WEB + path);
    await page.waitForLoadState("networkidle");
    assert.doesNotMatch(await cspOf(page), /thunderbolt|frame-src|unsafe-inline/, `CSP ketat di halaman ${label}`);
    assert.equal(await page.locator('meta[name="color-scheme"]').count(), 1, `meta color-scheme tetap ada di halaman ${label}`);
    assert.equal(touched, false, `tidak ada permintaan ke vendor di halaman ${label}`);
    assert.equal(await stubbed(page), null, `skrip asisten tidak dijalankan di halaman ${label}`);
    await context.close();
  }
  noIssues();
});

test("build tanpa asisten: CSP ketat di semua halaman; vendor tak dikenal dan keluaran di luar .tmp ditolak", async () => {
  const root = resolve(here, "../..");
  const env = { ...process.env, PDK_API_ORIGIN: API, PDK_BASE_PATH: BASE };
  delete env.PDK_ASSISTANT_SRC;
  const build = (extra) => spawnSync("node", ["scripts/build-site.mjs"], { cwd: root, env: { ...env, ...extra }, encoding: "utf8" });
  const out = resolve(TMP, "build-tanpa-asisten");

  const ok = build({ PDK_OUT: out });
  assert.equal(ok.status, 0, ok.stderr);
  for (const f of ["index.html", "login/index.html", "admin/landing/index.html"]) {
    const policy = readFileSync(resolve(out, f), "utf8").match(/Content-Security-Policy" content="([^"]*)"/)[1];
    assert.doesNotMatch(policy, /thunderbolt|frame-src|unsafe-inline/, `CSP ketat tanpa asisten: ${f}`);
    assert.match(readFileSync(resolve(out, f), "utf8"), /<meta name="color-scheme" content="light dark">/, `meta color-scheme ada tanpa asisten: ${f}`);
  }
  assert.match(readFileSync(resolve(out, "assets/js/config.js"), "utf8"), /assistantSrc: ""/);

  for (const bad of ["https://evil.example/embed.js", "http://www.thunderbolt.com/gateway/api/v1/thunderbolt-ui/embed.js", `${ASSISTANT}?x=1`, "bukan url"]) {
    const r = build({ PDK_OUT: out, PDK_ASSISTANT_SRC: bad });
    assert.equal(r.status, 1, `ditolak: ${bad}`);
    assert.match(r.stderr, /vendor yang dikenal/);
  }
  const escape = build({ PDK_OUT: "../keluar-liar" });
  assert.equal(escape.status, 1);
  assert.match(escape.stderr, /PDK_OUT/);
  assert.equal(existsSync(resolve(root, "../keluar-liar")), false, "folder di luar .tmp tidak boleh dibuat atau dihapus");
});

test("admin di ponsel: menu dapat dibuka dan halaman tidak bergulir ke samping", async () => {
  const { context, page } = await authed(ADMIN, { viewport: { width: 375, height: 800 } });
  for (const p of ["/admin/dashboard/", "/admin/users/", "/admin/enrollments/?status=all", "/admin/invite-codes/", "/admin/progress/", "/admin/landing/"]) {
    await page.goto(WEB + p);
    await adminReady(page);
    await noPageOverflow(page, p);
    await noLeakyText(page, p);
  }
  const menu = page.locator("#admin-menu");
  assert.equal(await menu.isVisible(), false, "menu tertutup di awal");
  const menuToggle = page.getByRole("button", { name: "Menu admin" });
  assert.equal(await menuToggle.getAttribute("aria-expanded"), "false");
  await menuToggle.click();
  await menu.waitFor({ state: "visible" }); // laci bertransisi 200 ms: tunggu keadaan akhir, bukan membaca sesaat
  await until(async () => (await menu.boundingBox()).x >= 0, "laci masuk ke layar");
  assert.equal(await menuToggle.getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator("#main").evaluate((el) => el.inert), true, "isi halaman dikunci saat menu terbuka");
  await shot(page, "26-admin-menu-ponsel");
  await menu.getByRole("link", { name: "Pengguna" }).click();
  await page.waitForURL(`**${BASE}/admin/users/**`);
  noIssues();
  await context.close();
});

for (const scheme of ["light", "dark"]) {
  test(`aksesibilitas (axe) tanpa pelanggaran: tema ${scheme}`, async () => {
    const pages = [
      ["/", false], ["/login/", false], ["/register/", false], ["/forgot-password/", false],
      ["/modul/?slug=beranda", true], ["/modul/?slug=modul-2", true], ["/modul/?slug=aturan-c", true], ["/enroll/", true], ["/profile/", true],
    ];
    const problems = [];
    for (const [path, auth] of pages) {
      const { context, page } = auth ? await authed(userA, { colorScheme: scheme }) : await newPage({ colorScheme: scheme });
      await page.goto(WEB + path);
      await page.waitForLoadState("networkidle");
      if (path.startsWith("/modul/")) await page.locator("#content h1, #content h2").first().waitFor();
      if (path === "/") await page.locator("#skema article").first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), scheme === "dark", "tema harus mengikuti preferensi sistem");
      if (path === "/modul/?slug=modul-2") await shot(page, `07-modul2-${scheme}`);
      if (path === "/login/") await shot(page, `08-login-${scheme}`);
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of res.violations) {
        problems.push(`${path} [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      }
      await context.close();
    }
    // Halaman admin (sebagai admin), termasuk dialog yang sedang terbuka.
    const adminId = (await login(ADMIN.email, ADMIN.password)).user.id;
    const adminPages = ["/admin/dashboard/", "/admin/users/", `/admin/users-detail/?id=${adminId}`, "/admin/enrollments/?status=all", "/admin/invite-codes/", "/admin/progress/", "/admin/landing/"];
    for (const path of adminPages) {
      const { context, page } = await authed(ADMIN, { colorScheme: scheme });
      await page.goto(WEB + path);
      await adminReady(page);
      if (path === "/admin/dashboard/") { await until(() => canvasDrawn(page, 0), "grafik tergambar"); await shot(page, `27-admin-dasbor-${scheme}`); }
      if (path.startsWith("/admin/users-detail")) await page.getByRole("button", { name: "Nonaktifkan akun" }).waitFor();
      if (path === "/admin/landing/") await shot(page, `30-admin-landing-${scheme}`);
      const analyze = async (label) => {
        const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of res.violations) problems.push(`${label} [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      };
      await analyze(path);
      if (path === "/admin/invite-codes/") {
        await page.getByRole("button", { name: "Buat kode" }).click();
        await page.locator("dialog[open]").waitFor();
        // Dialog memudar masuk (opasitas < 1 menurunkan kontras terukur): periksa setelah transisi selesai.
        await until(() => page.evaluate(() => getComputedStyle(document.querySelector("dialog[open]")).opacity === "1"), "dialog selesai bertransisi");
        await shot(page, `28-admin-dialog-${scheme}`);
        await analyze(path + " (dialog terbuka)");
        await page.keyboard.press("Escape");
      }
      await context.close();
    }
    assert.deepEqual(problems, [], "pelanggaran axe");
    noIssues();
  });
}
