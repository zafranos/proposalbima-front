// Uji peramban (Chrome sungguhan lewat playwright-core) terhadap backend dan situs yang
// dinyalakan oleh run.mjs. Tiap tes memeriksa juga bahwa tidak ada pelanggaran CSP atau
// galat skrip di konsol. Tes berjalan berurutan dan berbagi satu peserta (userA).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
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

async function approve(email, skema) {
  const t = await adminToken();
  const list = await api(`/admin/enrollments?q=${encodeURIComponent(email)}&skema=${skema}`, { token: t });
  const e = list.data.enrollments[0].enrollment;
  const r = await api(`/admin/enrollments/${e.id}/approve`, { method: "POST", token: t });
  assert.equal(r.status, 200);
}

async function registerViaUI(page, { email, skema, code = "" }) {
  await page.goto(WEB + "/register/");
  await page.getByRole("radio", { name: new RegExp("^" + skema) }).waitFor();
  await page.fill("#name", "Peserta E2E");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.fill("#affiliation", "Universitas Uji");
  await page.getByRole("radio", { name: new RegExp("^" + skema) }).check();
  if (code) await page.fill("#invite_code", code);
  await page.click("#submit");
}

// Mengubah data pengguna langsung di MongoDB uji (container Docker) untuk menciptakan keadaan
// yang tak bisa dibuat lewat API, mis. akun tanpa afiliasi atau tanpa skema terpilih.
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
  await page.getByRole("radio").first().waitFor();
  await noPageOverflow(page, "daftar di 375px");
  await page.setViewportSize({ width: 1280, height: 900 });
  await registerViaUI(page, { email: userA.email, skema: "Dasar" });
  await page.waitForURL("**/pending-approval/");
  assert.match(await page.locator("#title").textContent(), /Menunggu persetujuan/);
  await shot(page, "01-menunggu");

  await page.getByRole("link", { name: "Buka materi pratinjau" }).click();
  await page.waitForURL("**/modul/?slug=beranda");
  await page.locator("#content h1").waitFor();
  assert.equal(await progressText(page), "0 dari 10 selesai");
  await noLeakyText(page, "beranda pratinjau");
  assert.match(await page.locator("#akses-badge").textContent(), /Mode pratinjau/);
  const locked = page.locator('#nav [aria-disabled="true"]');
  assert.ok((await locked.count()) >= 8, "modul penuh harus terkunci saat pratinjau");
  assert.ok((await locked.filter({ hasText: "Fase 1" }).count()) >= 1);
  assert.equal(await page.locator("#nav a", { hasText: "Fase 0" }).count(), 1, "Fase 0 terbuka saat pratinjau");
  await shot(page, "02-beranda-pratinjau");

  await page.goto(WEB + "/modul/?slug=fase-1");
  await page.locator("#content h1").waitFor();
  assert.equal(await page.locator("#content h1").textContent(), "Modul ini terkunci");
  await noLeakyText(page, "modul terkunci");
  userA.token = (await login(userA.email, userA.password)).token;
  noIssues();
  await context.close();
});

test("persetujuan admin membuka akses penuh; kartu disalin utuh; progres tersimpan", async () => {
  await approve(userA.email, "dasar");
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/modul/?slug=fase-2");
  await page.locator("[data-card]").first().waitFor();
  assert.equal(await page.locator("#akses-badge").textContent(), "Akses penuh");
  await noLeakyText(page, "fase-2");

  const card = page.locator("[data-card]").first();
  const marks = await card.locator("mark").count();
  assert.ok(marks > 0, "penanda isian [ISI...] harus disorot");
  await card.getByRole("button", { name: "Salin kartu" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const expected = await card.locator("pre").evaluate((el) => el.textContent.replace(/\n$/, ""));
  assert.equal(clip, expected, "isi papan klip harus sama dengan teks kartu");
  assert.ok(clip.includes("[ISI"), "penanda isian tidak boleh hilang dari salinan");
  assert.ok(clip.length > 200);
  await shot(page, "03-kartu");

  const done = page.getByRole("button", { name: /Tandai selesai/ });
  await done.click();
  await until(async () => (await progressText(page)) === "1 dari 10 selesai", "progres 1 dari 10");
  assert.equal(await page.locator("progress").evaluate((p) => p.value), 1);
  assert.equal(await page.getByRole("button", { name: /Selesai \(klik/ }).getAttribute("aria-pressed"), "true");

  await page.reload();
  await page.locator("[data-card]").first().waitFor();
  assert.equal(await progressText(page), "1 dari 10 selesai", "progres harus bertahan setelah muat ulang");
  await page.getByRole("button", { name: /Selesai \(klik/ }).click();
  await until(async () => (await progressText(page)) === "0 dari 10 selesai", "progres kembali 0");

  await page.goto(WEB + "/modul/?slug=beranda");
  await page.locator("#content h1").waitFor();
  assert.equal(await page.getByRole("button", { name: /Tandai selesai/ }).count(), 0, "Beranda bukan modul alur");
  noIssues();
  await context.close();
});

test("ponsel: sidebar menjadi laci yang bisa dibuka dan ditutup", async () => {
  const { context, page } = await authed(userA, { viewport: { width: 375, height: 800 } });
  await page.goto(WEB + "/modul/?slug=fase-2");
  await page.locator("#nav a").first().waitFor({ state: "attached" });
  const sidebar = page.locator("#sidebar");
  assert.equal(await sidebar.isVisible(), false, "sidebar tersembunyi di ponsel");
  await noPageOverflow(page, "pembaca di 375px");
  // Terlihat menurut Playwright belum berarti ada di layar: laci masih bisa sedang bergeser masuk.
  const onScreen = async () => { const b = await sidebar.boundingBox(); return !!b && b.x >= 0 && b.x < 375; };
  await page.getByRole("button", { name: "Buka daftar modul" }).click();
  await until(onScreen, "laci benar-benar masuk layar");
  assert.ok(await page.locator("#sidebar").getByRole("link", { name: /Fase 2/ }).isVisible());
  await shot(page, "04-ponsel-sidebar");
  await page.getByRole("button", { name: "Tutup daftar modul" }).click();
  await until(async () => !(await onScreen()), "laci keluar dari layar");
  await noLeakyText(page, "pembaca ponsel");
  noIssues();
  await context.close();
});

test("Terapan: tab varian dan dasar, callout rujukan, status trial", async () => {
  const admin = await adminToken();
  const code = (await api("/admin/invite-codes", { method: "POST", token: admin, body: { skema: "terapan" } })).data.kode.code;
  const email = `terapan-${uid()}@example.test`;
  const { context, page } = await newPage();
  await registerViaUI(page, { email, skema: "Terapan", code });
  await page.waitForURL("**/modul/?slug=beranda");
  await page.locator("#content h1").waitFor();
  assert.match(await page.locator("#akses-badge").textContent(), /Trial, sisa 7 hari/);

  await page.goto(WEB + "/modul/?slug=fase-3");
  const tabs = page.getByRole("tab");
  await tabs.first().waitFor();
  await noLeakyText(page, "fase-3 terapan");
  assert.equal(await tabs.count(), 2);
  assert.match(await tabs.nth(0).textContent(), /Varian Terapan/);
  assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
  assert.match((await page.locator("#panel-varian h2").first().getAttribute("id")) || "", /^varian--/);
  assert.equal(await page.locator("#panel-dasar").isHidden(), true);
  await shot(page, "05-terapan-tab");

  await tabs.nth(1).click();
  await until(() => page.locator("#panel-dasar").isVisible(), "panel dasar tampil");
  assert.equal(await page.locator("#panel-varian").isHidden(), true);
  assert.match(page.url(), /bagian=dasar/);
  await tabs.nth(1).press("ArrowLeft");
  await until(() => page.locator("#panel-varian").isVisible(), "panah kiri kembali ke varian");

  await page.goto(WEB + "/modul/?slug=fase-2");
  const note = page.getByRole("note");
  await note.waitFor();
  assert.match(await note.textContent(), /Kartu 3T\.1/);
  assert.match(await note.getByRole("link").getAttribute("href"), /slug=fase-3&bagian=varian/);
  noIssues();
  await context.close();
});

test("semua tautan internal membawa awalan situs dan navigasi tetap di dalamnya", async () => {
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/modul/?slug=lampiran-l2");
  await page.locator("#content h1").waitFor();
  await page.locator("#nav a").first().waitFor();
  const bad = await page.evaluate((base) => [...document.querySelectorAll("a[href]")]
    .map((a) => a.getAttribute("href"))
    .filter((h) => h.startsWith("/") && !h.startsWith("//") && !(base === "" || h === base || h.startsWith(base + "/") || h.startsWith(base + "?")))
    , BASE);
  assert.deepEqual(bad, [], `tautan tanpa awalan situs ${BASE}`);
  // Tautan di isi materi (dibuat backend relatif terhadap akar aplikasi) juga berawalan situs.
  const inContent = await page.locator('article a[href*="/modul/?slug="], article a[href*="/berkas/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  assert.ok(inContent.length > 0, "isi l2 memuat tautan ke modul atau berkas");
  assert.ok(inContent.every((h) => h.startsWith(BASE + "/")), `tautan isi tanpa awalan: ${inContent.find((h) => !h.startsWith(BASE + "/"))}`);
  await page.locator("#nav a", { hasText: "Fase 1" }).click();
  await page.waitForURL(/slug=fase-1/);
  assert.ok(new URL(page.url()).pathname.startsWith(BASE + "/modul/"), "tetap di bawah awalan situs: " + page.url());
  noIssues();
  await context.close();
});

test("salin instruksi proyek sama dengan teks di bawah garis", async () => {
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/modul/?slug=instruksi-proyek");
  await page.getByRole("button", { name: "Salin instruksi" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  const m = await api("/modul/instruksi-proyek", { token: userA.token });
  const want = m.data.bagian[0].salin_teks;
  assert.equal(clip, want);
  assert.ok(!clip.includes("Teks di bawah garis ditempel"), "kalimat pengantar tidak boleh ikut tersalin");
  assert.ok(clip.includes("**"), "markdown mentah (penebalan) dipertahankan");
  noIssues();
  await context.close();
});

test("unduhan lewat tombol dan lewat tautan di isi sama dengan sumber", async () => {
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const src = sha(readFileSync(resolve(SRC_MATERI, "lampiran/alat-cek-proposal.py")));
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/modul/?slug=lampiran-l2");
  await page.getByRole("button", { name: /alat-cek-proposal\.py/ }).waitFor();

  const [d1] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /alat-cek-proposal\.py/ }).click()]);
  assert.equal(d1.suggestedFilename(), "alat-cek-proposal.py");
  assert.equal(sha(readFileSync(await d1.path())), src, "isi unduhan harus sama dengan sumber");

  const link = page.locator('article a[href$="/berkas/alat-cek-py"]').first();
  await link.waitFor();
  const [d2] = await Promise.all([page.waitForEvent("download"), link.click()]);
  assert.equal(d2.suggestedFilename(), "alat-cek-proposal.py");
  assert.equal(sha(readFileSync(await d2.path())), src);
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

test("halaman skema: pilih dan tambah skema", async () => {
  const { context, page } = await authed(userA);
  await page.goto(WEB + "/select-skema/");
  await page.getByRole("button", { name: "Lanjutkan" }).waitFor();
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await page.waitForURL("**/modul/?slug=beranda");
  await page.goto(WEB + "/enroll/");
  await page.getByRole("radio", { name: /^Terapan/ }).check();
  await page.click("#submit");
  await page.waitForURL("**/pending-approval/**");
  noIssues();
  await context.close();
});

test("rantai pengalihan: profil belum lengkap, skema belum dipilih, lalu pulih", async () => {
  const email = `rantai-${uid()}@example.test`;
  const reg = await api("/register", { method: "POST", body: { name: "Rantai Uji", email, password: PASSWORD, affiliation: "Univ Uji", skema: "dasar" } });
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

  mongoEval(`users.updateOne({email:"${email}"},{$unset:{selected_skema:""}})`);
  await page.goto(WEB + "/modul/?slug=beranda");
  await page.waitForURL("**/select-skema/");
  await page.getByRole("button", { name: "Pilih" }).click();
  await page.waitForURL("**/pending-approval/");
  await shot(page, "09-rantai-pulih");
  noIssues();
  await context.close();
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

async function enrollmentOf(email, skema = "dasar") {
  const r = await api(`/admin/enrollments?q=${encodeURIComponent(email)}&skema=${skema}`, { token: await adminToken() });
  return r.data.enrollments[0]?.enrollment;
}

async function registerAPI(label) {
  const email = `${label}-${uid()}@example.test`;
  const r = await api("/register", { method: "POST", body: { name: `Peserta ${label}`, email, password: PASSWORD, affiliation: "Univ Uji", skema: "dasar" } });
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
  assert.equal(await page.locator("canvas").count(), 3, "tiga grafik");
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
  await dlg.getByLabel("Kode kustom (opsional)").fill("ab");
  await dlg.getByRole("button", { name: "Buat kode" }).click();
  assert.match(await dlg.locator('[role="alert"]').textContent(), /4 sampai 32/, "kode kustom pendek ditolak");
  await dlg.getByLabel("Kode kustom (opsional)").fill(code.toLowerCase());
  await dlg.getByLabel("Lama trial (hari)").fill("5");
  await dlg.getByLabel("Kuota pemakaian").fill("2");
  await dlg.getByLabel("Catatan (opsional)").fill("angkatan e2e");
  await dlg.getByRole("button", { name: "Buat kode" }).click();
  await dlg.waitFor({ state: "detached" });
  const row = page.getByRole("row", { name: new RegExp(code) });
  await row.waitFor();
  const text = await row.textContent();
  assert.match(text, /0 \/ 2/); assert.match(text, /5 hari/); assert.match(text, /Aktif/); assert.match(text, /angkatan e2e/);

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

test("admin: progres per skema memuat corong dan peserta sesuai API", async () => {
  const t = await adminToken();
  const res = (await api("/admin/progress?skema=dasar&limit=50", { token: t })).data;
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

  await page.getByLabel("Skema").selectOption("terapan");
  const ter = (await api("/admin/progress?skema=terapan&limit=50", { token: t })).data;
  await until(async () => (await page.getByRole("region", { name: "Corong modul alur" }).locator("tbody tr").count()) === ter.total_alur, "corong berganti ke skema Terapan");
  assert.ok(new URL(page.url()).searchParams.get("skema") === "terapan", "skema pilihan tersimpan di URL");
  await noLeakyText(page, "progres admin");
  noIssues();
  await context.close();
});

test("admin di ponsel: menu dapat dibuka dan halaman tidak bergulir ke samping", async () => {
  const { context, page } = await authed(ADMIN, { viewport: { width: 375, height: 800 } });
  for (const p of ["/admin/dashboard/", "/admin/users/", "/admin/enrollments/?status=all", "/admin/invite-codes/", "/admin/progress/"]) {
    await page.goto(WEB + p);
    await adminReady(page);
    await noPageOverflow(page, p);
    await noLeakyText(page, p);
  }
  const menu = page.locator("#admin-menu");
  assert.equal(await menu.isVisible(), false, "menu tertutup di awal");
  await page.getByRole("button", { name: "Buka menu admin" }).click();
  assert.equal(await menu.isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "Tutup menu admin" }).getAttribute("aria-expanded"), "true");
  await shot(page, "26-admin-menu-ponsel");
  await menu.getByRole("link", { name: "Pengguna" }).click();
  await page.waitForURL(`**${BASE}/admin/users/**`);
  noIssues();
  await context.close();
});

for (const scheme of ["light", "dark"]) {
  test(`aksesibilitas (axe) tanpa pelanggaran: tema ${scheme}`, async () => {
    const pages = [
      ["/login/", false], ["/register/", false], ["/forgot-password/", false],
      ["/modul/?slug=beranda", true], ["/modul/?slug=fase-2", true], ["/modul/?slug=lampiran-l3", true], ["/select-skema/", true], ["/profile/", true],
    ];
    const problems = [];
    for (const [path, auth] of pages) {
      const { context, page } = auth ? await authed(userA, { colorScheme: scheme }) : await newPage({ colorScheme: scheme });
      await page.goto(WEB + path);
      await page.waitForLoadState("networkidle");
      if (path.startsWith("/modul/")) await page.locator("#content h1, #content h2").first().waitFor();
      if (path === "/register/") await page.getByRole("radio").first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), scheme === "dark", "tema harus mengikuti preferensi sistem");
      if (path === "/modul/?slug=fase-2") await shot(page, `07-fase2-${scheme}`);
      if (path === "/login/") await shot(page, `08-login-${scheme}`);
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of res.violations) {
        problems.push(`${path} [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      }
      await context.close();
    }
    // Halaman admin (sebagai admin), termasuk dialog yang sedang terbuka.
    const adminId = (await login(ADMIN.email, ADMIN.password)).user.id;
    const adminPages = ["/admin/dashboard/", "/admin/users/", `/admin/users-detail/?id=${adminId}`, "/admin/enrollments/?status=all", "/admin/invite-codes/", "/admin/progress/"];
    for (const path of adminPages) {
      const { context, page } = await authed(ADMIN, { colorScheme: scheme });
      await page.goto(WEB + path);
      await adminReady(page);
      if (path === "/admin/dashboard/") { await until(() => canvasDrawn(page, 0), "grafik tergambar"); await shot(page, `27-admin-dasbor-${scheme}`); }
      if (path.startsWith("/admin/users-detail")) await page.getByRole("button", { name: "Nonaktifkan akun" }).waitFor();
      const analyze = async (label) => {
        const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        for (const v of res.violations) problems.push(`${label} [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
      };
      await analyze(path);
      if (path === "/admin/invite-codes/") {
        await page.getByRole("button", { name: "Buat kode" }).click();
        await page.locator("dialog[open]").waitFor();
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
