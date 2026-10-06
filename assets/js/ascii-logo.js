// Animasi ASCII logo ZafranOS pada <canvas>. Dipisah dari HTML karena CSP melarang
// skrip dan gaya inline. Dipakai di hero landing dan panel samping halaman masuk/daftar.
//
// Hemat daya: animasi berhenti saat kanvasnya keluar layar atau tabnya tidak aktif, dan
// pada prefers-reduced-motion hanya satu bingkai diam yang digambar.

const GRID = ["......................................................................................................................................................", "......................................................................................................................................................", "......................................................................................................................................................", "......................................................................................................................................................", "............................................................................................................................BCCDDDDCB.................", ".........................................................................................................................ACEFGGHHGGGGEB...............", ".....................................................................bbbcccccccbbb......................................DFGGHJJJIIHGGHGA..............", "............................................................bcdefgghhiiiiiiiiiiiiiiihggfecb...........................CFGGGIJHDBBBFHHHIC..............", ".......................................................bcefhhiiiiiiiiiiiiiiiiiiiiijjjjjjjjjihgecb...................BEGGGGGHH....BFHHIHA..............", "...................................................bdfghiiihhhhhhiiiiiiiiiiiiiiiiiiiijijjjjjjjjjihfdb..............CGGGGGGGGGFEFGHIIIHB...............", "................................................ceghhhhhhhhiiiiiiiijjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjheb.........BFGGGGGGGGHHHHHIIIHD.................", ".............................................cfhhhhhhhiiijjjjjjjjjjjjjjjjjjiiiihhhhhhhhhhiiijjjjjjjjjjjjgd.....ADGGGGGGGGGHHHHIIIGD...................", "..........................................beghhhhhiijjjjjjjjjjjjjihhgfeddcbbb.............abbcdefhijjjjjjjd...CFGGGGGGGGHHHHIIIGC.....................", "........................................cfhhhhiijjjjjjjjjjihgfdcba...AABCCDDDEEEFFFFFFFFEEEDDCB....bcehiifa.BEGGGGGGGHHHHHIIIFB.......................", "......................................cfhhiijjjjjjjjjjhgecb.....BCDEFFFFGGGGGGGGGGGGGHHHHGGFEDCB...........DGGGGGGGHHHHHIIIEB.........................", "....................................bfhiijjjjjjjjjigdb.....ACDFGGGGGGGGGGGGGGGGGGHHHGFECB................CFGGGGGHHHHHIIIHEA...........................", "...................................ehiijjjjjjjjigd....BF..ACCCBCCEGGGGGGGGGGGHHHHGECB..................BFGGGGGHHHHHIIIHD..............................", ".................................cgijjjjjjjjjhda.....BGGFA........DGGGGGGGHHHHFDB....................AEGGGGHHHHHHIIIGD................................", "................................dijjjjjjjjjgc....BEFFGGGHGHGDA...AFGGHHHHHHFDB......................CGHGGHHHHHHIIIGC..................................", "...............................fjjjjjjjjjgb.......ACGGHHHHEB....CGHHHHHHGDB.......................bFGGGGHHHHHIIIFB....................................", "..............................gjjjjjjjjhc....BDEFD.BHHGGHIC...CFHHHHHGEB..........................ijjiHHHIIIIIFB.CDC..................................", ".............................gjjjjjjjje...BDFGFDB..DEB..BDDADFHHHHHEC...........................bhiijjjjiIIIFB.BFGFFEB................................", "............................gjjjjjjjhb..BEGGFC...........BEHHIIHFC.............................eijijijjjjiFB...AEGFFFFC...............................", "...........................ejjjjjjjg...DGGFC..........BDGHIIHFC..............................eijiiijjjheb........EGFFFGD..............................", "..........................bjjjjjjjf..BFHGD.........BDFHIIHFC..............................beiiiiiijjhd............EGGGFGD.............................", "..........................hjjjjjjf..BGHFB.......ADFHIHGEC..............................bdgiiiiiijjid..............AFGGGGGC............................", ".........................cjjjjjjf..BHHD.......CFHHHFDB...................abccddeeefffghiiiiiijijjf.................CGGGGGFA...........................", ".........................fjjjjjg...GHB.....CFHHGECA.................bdeghhiiiiiiiiiiiiiiiiiijjjjd...................FGGGGGE...........................", ".........................hjjjji...EHA...BEGHGDBbcb................dgiiiiiiiiiiiiiiiiiiiiiiijjjjc....................DGGGGGGB..........................", ".........................hjjjjc..AF...CFHGDB.dgfb..............behiiiijjiiiiiiiiiiiiiiiiiijjijg.....................BGGGGGGE..........................", ".........................hjjjg...A..CGGEB.cfije..............cgiijjjjjhhiiiijjjjjjjjjjjjjjjjjjf......................GGGGGHG..........................", ".........................gjjjb....BFGDAAdhjjhb.............dhijjjjjjgb....abbccddeeffghijjjjjji......................FHHHHHHB.........................", ".........................djjf....EFC.BFhjjjf............behjjjjjjjjjgbb................cjjjjjjjf.....................FHHHHHHC.........................", "..........................ijc..BFD.CFHjjjjf...........bfijjjjjjjjjjjjjiiiihhhhgffedddcdgjjjjjjjjc....................GHHHHHHD.........................", "..........................ej..BDBCFHHjjjjh..........cgijjjjjjjjjjjjjjjjjjjihgeddejjjjjjjjjjjjjjjf...................BHHHHHHHD.........................", "...........................e.ABAEGHijjjjje........cgjjjjjjjjjjjjjjjjjigfdb......bhjjjjjjjjjjjjjjd........BA.........DHHHHHHHC.........................", "..............................BGGGijjjjjid......chjjjjjjjjjjjjjihgecb......cefhijjjjjjjjjjjjjjjf........BGF.........HHHHHHHHB.........................", ".............................BGGGHjjjjjjie.....cjjjjjjjjjjjigec......bceghijjjjjjjjjjjjjjjjjjid......CFFGGGGGFB....EIHHHHHIG..........................", ".............................EGGGjjjjjjjig.....bijjjjjjjjjjb....befhijjjjjjjjjjjjjjjjjjjjjjjhb........AGHHHID.....BIHHHIIHID..........................", ".............................FGGGjjjjjjjhid......fijjjjjjjjhffhiigedddeefgghhiijjjjjjjjjjjjf..........CGECEGD....AHIHIIIHIG...........................", ".............................DGGHjjjjjjjiihb......beijjjjjjjjjjjh...............bbdijjjjjic...........AB...AB....HIIIIIIIIC...........................", "..............................EGGjjjjjjjjhihb..CC....dhjjjjjjjjjjiihggffeedccbb...cijjjjf............BDD..BGD..AHJIIIIIIIE............................", "...............................FHjjjjjjjjiiiic..DEC....cfijjjjjjjjjjjjjjjjjjjjjiiijjjjic..........ACEFFA.CGFA.BHJIIIIIIIF.............................", "................................EHjjjjjjjjiiiif..BFFDB....cfhjjjjjjjjjjjjjjjjjjjjjjjje.........ACEFFGFA.DGFA.DIJIIIIIIIG..............................", ".................................Eijjjjjjjjiiiihd..CFGFDB....bdfhjjjjjjjjjjjjjjjjjjgb.......BCEFFFFGE..FHE..FJJIIIIIIIF...............................", "..................................Dijjjjjjjjjiiiihd..CFGGGFDCA...acdfghiijjjjjiigeb....ABDEFFGGFFGGC.CHGB.CHJIIIIIIIIE................................", "...................................bhjjijjjjjjiiiijifc.ADFHHHHGFEDCBBAA.BbbbbbBAABCDEEFGGGGGGGFGGEAAFHD.BGJJIIIIIIIHC.................................", ".....................................eijjjiiijjjjiijjjhfdbBCEGHHIIIHHHHGGGGGGGGGGGGGGGGGGGGGGGGGC.DFD..FIJIIIIIIIIFA..................................", ".......................................dhijjjjiiiijiijjjjihfecCDEEFGGHHHHHGGGGGGGGGGGGGGGGGGGGDA.CB.BFIJIIIIIIIIGC....................................", "........................................BDeghijjjjjjjjjjjjjjjjjjihhgfeCBCDDEFGGGGGGGGGGGGHHGDA....CGIJIIIIIIIIHD......................................", ".........................................BDFFEdefghhiiiiiiiihhggfeEEEEFGGHHHHHHHHHHGHHHHHFC....CEHJJIIIIIIIIGC........................................", "...........................................ADGIIHGFFFEEEEEEFFFFGGGHHHHHHHHHHHHHHHHHHHHFDA...CEHIIIIIIIIIIHEB..........................................", "..............................................BEHJJJJIIIIIIIIIIIIHHHHHHHHHHHHHHIHHGEC...BDFHIIIIIIIIIIHFC.............................................", ".................................................BDFGIIIIIIIIHHHHHHHHIIIIIIHHGFDCA..BDFGHIIIHIIIIIHGEB................................................", ".....................................................BCDEFGGHHHHHHHHGGFFEDCBBBBCDEGHHHHHHHHHHHGFDB....................................................", ".............................................................ABBBBBBBCCDDEEFGGHHHHHHGGGFFEDCB.........................................................", ".....................................................................ABBCCCCCCCCBBBBA.................................................................", "..............bfgggggggggggggggfc...................bdfgggfb..........................................BCDEEEEEDDB.........ACDDEEEEEDDBA...............", "..............hjjjjjjjjjjjjjjjjji..................dijjjjjjc.......................................BDFGGGGGGGGGGHGEC....AEGGGGGGGGHHHHGB..............", "..............bfgggggffhjjjiijjgc..................ijijgccb......................................AEGGGGGGFEEEFGHHHHHFB.AFGGGGECCCDEFGFB...............", "......................eijjjjjhd......ccdddcb.bba..cjjjjd.....b..ccb....bcdddcb........bcdddca...AFGGGGGDB.....ACGHHHHHBBHGGHGB........................", "...................bfijjjjjhd.....dgijjjjjjiiiiichjjjjjjjicgijiijji.dgijjjjjjjigb...fijjjjjjigc.DGGGGGB.........BGHHHIF.GHHHHHGGFEDCB.................", ".................bfijjjjjhd......gjjjigeefhjjjjjcehjjjjhgfhjjjjigfehjjjigeefijjjjd.gjjjieegjjjjcEGGGGE...........FIHHIG.AEGHIIIIIIIIIGD...............", "...............beijjjjjhd.......ejjjib.....fjjjjc.bjjjjc..hjjjh...fjjjib.....gjjjhbjjjjc...hjijeEGGGHGA.........BHIHHIF....BDEFGGHIIIIIF..............", "..............eijjjjjie.........fjjji......fjjjjc.cjjjjc..hjjje...hjjjh......gjjjhbjjjjc...hjjjeBGHHHHGC.......DHIIIIHB.CCA.......GIIIIIA.............", "............cijjjjjjjihiiihhhhhebjjjjieccehjjjjjc.cjjjjc..hjjjf...cjjjjheccehjjjjhbjjjjc...hjije.CGHHHHHGFEEFGHIIIIIGBBFIIHGFEDDDFIIIIJF..............", "............cjjjjjjjjjjjjjjjjjjh.bgijjjjjjjijjjjc.bjjjjc..hjjje....cgijjjjjjjijjjhajjjjc...gjjje...DGHIIIIIIIIIIIIGC..CGHIIIJJJJJJJJJHE...............", ".............acdddddddddddddddc....acdeeedb.cddc...cddc...bddd.......bcdeeedb.dddb.cddc....bddd......BDEFFGGGFFECA......BCEFFGGGGFEDB.................", "......................................................................................................................................................", "......................................................................................................................................................", "......................................................................................................................................................", "......................................................................................................................................................", "......................................................................................................................................................", "......................................................................................................................................................", "......................................................................................................................................................"];

const COLS = 150, ROWS = 75;
const RAMP = " .:-=+*#%@";
const BLUE = [[25, 95, 140], [10, 110, 170]], ORANGE = [[255, 130, 10], [255, 92, 10]];

// Huruf kecil = keluarga biru, huruf besar = keluarga jingga, "." = kosong.
const ink = new Float32Array(COLS * ROWS);
const warm = new Uint8Array(COLS * ROWS);
GRID.forEach((row, y) => [...row].forEach((ch, x) => {
  const i = y * COLS + x;
  if (ch === ".") return;
  warm[i] = ch < "a" ? 1 : 0;
  ink[i] = ((ch < "a" ? ch.charCodeAt(0) - 65 : ch.charCodeAt(0) - 97) + 1) / 10;
}));

const cx = COLS / 2, cy = ROWS / 2, maxR = Math.hypot(cx, cy * 2);
const R = new Float32Array(COLS * ROWS), A = new Float32Array(COLS * ROWS);
for (let y = 0; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    const dx = x - cx, dy = (y - cy) * 2;
    R[y * COLS + x] = Math.hypot(dx, dy);
    A[y * COLS + x] = Math.atan2(dy, dx);
  }
}

const noise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const malam = () => document.documentElement.classList.contains("dark");

// Cache warna: [gelap][hangat][papan catur][kilau 0-5] -> string css.
const STYLE = {};
function style(night, w, k, g) {
  const key = (night ? 1 : 0) | w << 1 | k << 2 | g << 3;
  if (STYLE[key]) return STYLE[key];
  const pal = (w ? ORANGE : BLUE)[k], m = g * 14;
  // Mode gelap memakai putih polos: dua keluarga warna merek sama-sama pudar menjadi abu kebiruan
  // di atas latar gelap sehingga saling menyamarkan (rasio 2,5-3,7), sedangkan putih mencapai 5,8
  // dan bentuk logonya lebih terbaca. Bentuknya tetap terbaca tanpa warna karena kerapatan huruf
  // pada ramp yang membedakan tiap bagian, termasuk kilau menyapu.
  // Mode terang tetap dua warna, tetapi dipekatkan: jingga apa adanya hanya mencapai rasio 1,8 di atas putih.
  const rgb = night ? [255, 255, 255] : pal.map((c) => Math.min(255, Math.round((c + m) * 0.72)));
  return STYLE[key] = `rgb(${rgb.join(",")})`;
}

export function mountAsciiLogo(cv) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, cw = 0, chh = 0;

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const dpr = Math.min(devicePixelRatio || 1, 2, 1100 / Math.max(r.width, 1)); // ASCII tidak butuh lebih
    W = cv.width = Math.round(r.width * dpr);
    H = cv.height = Math.round(r.height * dpr);
    cw = W / COLS; chh = H / ROWS;
    ctx.font = `${Math.floor(chh * 1.02)}px "SF Mono",Menlo,Consolas,monospace`;
    ctx.textBaseline = "top";
    return true;
  }

  const mouse = { x: -99, y: -99 };
  cv.addEventListener("pointermove", (e) => {
    const r = cv.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * COLS;
    mouse.y = (e.clientY - r.top) / r.height * ROWS;
  });
  cv.addEventListener("pointerleave", () => { mouse.x = mouse.y = -99; });

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const reveal = Math.min(t / 3.2, 1) * (maxR + 6);        // perkenalan radial
    const sweep = ((t * 0.18) % 1.6) * (COLS + ROWS) - 20;   // kilau menyapu diagonal
    const night = malam();
    let cur = "";
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ci = y * COLS + x, r = R[ci];
        if (r > reveal) continue;
        const twist = reduce ? 0 : 0.025 * Math.sin(t * 0.7) * (1 - Math.min(r / maxR, 1));
        const a = A[ci] + twist;
        let sx = cx + Math.cos(a) * r, sy = cy + Math.sin(a) * r / 2;
        if (!reduce) { sx += 0.5 * Math.sin(y * 0.22 + t * 1.6); sy += 0.25 * Math.sin(x * 0.12 + t * 1.2); }
        const md = Math.hypot(x - mouse.x, (y - mouse.y) * 2);
        if (md < 14) { const k = (1 - md / 14) * 2.2; sx += (x - mouse.x) / (md + 1) * k; sy += (y - mouse.y) / (md + 1) * k; }
        sx = Math.round(sx); sy = Math.round(sy);
        if (sx < 0 || sy < 0 || sx >= COLS || sy >= ROWS) continue;
        const i = sy * COLS + sx;
        if (ink[i] === 0) continue;
        let v = ink[i] + 0.10 * Math.sin(t * 2.4 + x * 0.3 + y * 0.2);
        if (reveal - r < 5 && !reduce) v *= noise(x + Math.floor(t * 18), y);
        const hl = Math.max(0, 1 - Math.abs(x + y - sweep) / 9);
        v = Math.min(1, v + hl * 0.5);
        const fs = style(night, warm[i], (x + y) & 1, Math.round(hl * 5));
        if (fs !== cur) ctx.fillStyle = cur = fs;
        ctx.fillText(RAMP[Math.max(1, Math.min(9, Math.round(v * 9)))], x * cw, y * chh);
      }
    }
  }

  // Satu bingkai diam bila pengguna meminta gerak dikurangi: gambarnya utuh, tanpa animasi.
  if (reduce) {
    const gambar = () => { if (resize()) draw(99); };
    new ResizeObserver(gambar).observe(cv);
    gambar();
    return;
  }

  let raf = 0, mulai = 0, jeda = 0, terlihat = false;
  function jalan() {
    if (raf || jeda || !terlihat || document.hidden) return;
    raf = requestAnimationFrame(tick);
  }
  function tick(ms) {
    raf = 0;
    if (!mulai) mulai = ms;
    draw((ms - mulai) / 1000);
    jalan();
  }
  function berhenti() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!jeda) jeda = performance.now();
  }
  function lanjut() {
    if (jeda) { mulai += performance.now() - jeda; jeda = 0; }
    jalan();
  }

  new ResizeObserver(() => { if (resize() && !raf) draw(((jeda || performance.now()) - mulai) / 1000); }).observe(cv);
  new IntersectionObserver((entries) => {
    terlihat = entries[0].isIntersecting;
    if (terlihat) { if (resize()) lanjut(); } else berhenti();
  }, { threshold: 0 }).observe(cv);
  document.addEventListener("visibilitychange", () => (document.hidden ? berhenti() : lanjut()));
}

// Pasang pada tiap kanvas bertanda data-ascii-logo.
export function initAsciiLogo(root = document) {
  root.querySelectorAll("canvas[data-ascii-logo]").forEach(mountAsciiLogo);
}
