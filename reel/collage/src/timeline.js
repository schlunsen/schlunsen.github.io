// timeline.js: the shot list, standalone loops, and the paper-native transitions (sheet slide, flood, cut reveal, brush sweep).
//
// shots([[t0, fn], [t1, fn], ...]) registers shots in time order. Each fn(t, lt, dur) is called with t = video time,
// lt = time since the shot started, dur = the shot's length. It paints the WHOLE frame, background included, and must be
// a pure function of t: frames render in parallel and out of order, so nothing may carry over from one frame to the next.

const SHOTS = [];
function shots(list) { SHOTS.push(...list); SHOTS.sort((a, b) => a[0] - b[0]); }

// Standalone loops (model sheets, GIFs, tests), outside the main timeline: window.LOOP = LOOPS[name] swaps the whole
// frame for that function, called with loop time. Give each a length: LOOPS.x = t => { ... }; LOOPS.x.len = 4;
const LOOPS = {};

function drawWorld(t) {
  if (window.LOOP) window.LOOP(t);
  else if (!SHOTS.length) placeholder(t);
  else {
    let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
    const t0 = SHOTS[i][0], end = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : DUR;
    SHOTS[i][1](t, t - t0, end - t0);
    CAM = null;
  }
  flushLetters();
}

function placeholder(t) {
  sun(820, 480, 220, 'red', { spin: t * .3 });
  moon(1180, 420, 160, 'yellow');
  clawd(960, 900, 20, feel('happy', t));
}

// ---------- transitions ----------
// Each one covers the frame completely at p = .5: cut to the next shot there, under full cover. Call it LAST in both
// shots, in screen space (after camEnd()):
//   end of shot A:   if (lt > dur - .4) sheetSlide((lt - (dur - .4)) / .8);
//   start of shot B: if (lt < .4) sheetSlide(.5 + lt / .8);
// All of them are made of paper and paint, with the same edges, grain and shadows as everything else, and all of them
// are pure functions of p (no per-frame randomness, so nothing flickers).

const _io = p => p < .5 ? .5 * easeOut(p * 2) : .5 + .5 * easeIn(p * 2 - 1);   // arrive, hold under the cut, leave

// Sheet slide: one or more big sheets of paper slide across the frame, each with a torn leading edge (and its white
// fibrous rim) and a big lifted shadow; the last one covers the frame at p = .5, then they carry on off the far side.
//   cols: colours, bottom sheet first.  o: { dir ('right' | 'left' | 'up' | 'down'), lag (stagger), tilt }
function sheetSlide(p, cols = ['yellow', 'red'], o = {}) {
  if (p <= 0 || p >= 1) return;
  if (!Array.isArray(cols)) cols = [cols];
  const n = cols.length, lag = o.lag ?? .1, dir = o.dir ?? 'right', vert = dir === 'up' || dir === 'down', sgn = dir === 'left' || dir === 'up' ? -1 : 1;
  const span = vert ? H : W, other = vert ? W : H;
  push(); resetMatrix(); translate(W / 2, H / 2); rotate(o.tilt ?? -.03); if (vert) rotate(Math.PI / 2 * sgn); else if (sgn < 0) rotate(Math.PI); translate(-span / 2, -other / 2);
  cols.forEach((col, i) => {
    // the sheet spans [left, left + S]; it travels from fully off the near side to fully off the far side. Lower sheets
    // run a little ahead (they arrive first and leave first); the top one covers the frame at p = .5.
    const S = span + 700, d = (n - 1 - i) * lag, k = _io(clamp(p + d * Math.sin(Math.PI * p)));
    const left = lerp(-S - 120, span + 120, k);
    const P = [[left, -300], [left + S, -300], [left + S, other + 300], [left, other + 300]];
    cut(P, col, { torn: [1, 3], lift: 3, key: 'sheet' + i, rim: 6, tearAmp: 2.2 });
  });
  pop();
}

// Flood: paper shapes (discs, stars, blobs) pop in, from (cx, cy) outwards, until they cover the frame (p = .5), then fly
// out and away in the same order, revealing the next shot. o: { cx, cy, cols, seed }
function flood(p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const cols = o.cols ?? ['red', 'yellow', 'blue', 'white', 'green', 'black'], cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, sd = o.seed ?? 3;
  const G = 280, items = [];
  for (let gy = -1; gy <= Math.ceil(H / G) + 1; gy++) for (let gx = -1; gx <= Math.ceil(W / G) + 1; gx++) {
    const x = gx * G + (gy % 2 ? G / 2 : 0) + (hash(gx * 13 + gy * 7 + sd) - .5) * 60, y = gy * G * .87 + (hash(gx * 5 + gy * 17 + sd) - .5) * 60;
    items.push({ x, y, d: Math.hypot(x - cx, y - cy) / Math.hypot(W, H), i: items.length });
  }
  const maxD = Math.max(...items.map(it => it.d));
  for (const it of items) {
    const h = hash(it.i * 3.3 + sd), col = cols[it.i % cols.length], del = it.d / maxD * .55;
    let s, dx = 0, dy = 0, r = 0;
    if (p < .5) { const f = clamp((p * 2 - del) / .45); s = backOut(f); if (s <= .01) continue; }
    else { const f = clamp(((p - .5) * 2 - del) / .45); s = 1; if (f >= 1) continue;
      const a = Math.atan2(it.y - cy, it.x - cx) + (h - .5), e = easeIn(f); dx = Math.cos(a) * 1400 * e; dy = Math.sin(a) * 1400 * e - 200 * e; r = (h - .5) * 3 * e; s = 1 - .3 * e; }
    push(); translate(it.x + dx, it.y + dy); rotate(r + h * TAU); scale(s);
    const R = G * .95, kind = it.i % 5;
    if (kind === 3) cut(starPts(0, 0, R * 1.25, .55, 5), col, { lift: 2, key: 'fs' + it.i });
    else if (kind === 1) cut(blobPts(0, 0, R * .95, { seed: it.i }), col, { curv: true, lift: 2, key: 'fb' + it.i });
    else cut(ellPts(0, 0, R, R, 40), col, { lift: 2, key: 'fd' + it.i });
    pop();
  }
}

// Cut reveal: two sheets slide in from opposite sides and meet along a scissor-cut zigzag (covering at p = .5), then part
// again the way they came, revealing the next shot. o: { cols [a, b], angle (radians, the cut's tilt), teeth }
function cutReveal(p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const [ca, cb] = o.cols ?? ['blue', 'red'], k = p < .5 ? easeOut(p * 2) : 1 - easeIn((p - .5) * 2), teeth = o.teeth ?? 7;
  push(); resetMatrix(); translate(W / 2, H / 2); rotate(o.angle ?? .12);
  const Hh = 1400, Z = []; for (let i = 0; i <= teeth * 2; i++) Z.push([(i % 2 ? 36 : -36) + 14 * (hash(i + 7) - .5), -Hh / 2 + i * Hh / (teeth * 2)]);
  const off = lerp(1500, 0, k);
  // left sheet: its right edge is the zigzag; right sheet: its left edge is the same zigzag (a clean cut in one sheet)
  cut([[-2200 - off, -Hh / 2], ...Z.map(([x, y]) => [x - off, y]), [-2200 - off, Hh / 2]], ca, { lift: 2.5, key: 'cutL', edge: .4 });
  cut([[2200 + off, Hh / 2], ...Z.slice().reverse().map(([x, y]) => [x + off, y]), [2200 + off, -Hh / 2]], cb, { lift: 2.5, key: 'cutR', edge: .4 });
  pop();
}

// Brush sweep: a huge loaded brush paints the frame in a few overlapping passes, back and forth, top to bottom (covering
// it at p = .5); then the paint lifts off again pass by pass in the same order. o: { col, passes, w }
function brushSweep(p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const n = o.passes ?? 4, w = o.w ?? 440, lag = .5 / n;
  push(); resetMatrix();
  for (let i = 0; i < n; i++) {
    const y = -10 + i * (H + 20) / (n - 1) + (hash(i + 3) - .5) * 30, ltr = i % 2 === 0;
    const P = ltr ? [[-360, y + 24], [W / 2, y - 12], [W + 360, y + 18]] : [[W + 360, y - 20], [W / 2, y + 14], [-360, y - 10]];
    // pass i paints during [i, i + 1] * lag of the first half, and lifts during the same slot of the second half
    const k = p < .5 ? ease(clamp((p * 2 - i * lag * 2) / (1 - (n - 1) * lag * 2))) : 1;
    const f = p < .5 ? 0 : ease(clamp(((p - .5) * 2 - i * lag * 2) / (1 - (n - 1) * lag * 2)));
    if (k > 0 && f < 1) brush(P, { w, col: o.col ?? 'black', k, from: f, taper: .02, press: .1, key: 'sweep' + i });
  }
  pop();
}

// Old names, so scenes written for the brush and riso kits still run.
function inkSlide(p, cols = ['yellow', 'red']) { sheetSlide(p, cols); }
function dotDissolve(p, col = 'red', o = {}) { flood(p, { ...o, cols: [col, 'yellow', 'white', 'blue'] }); }
function paperFeed(p, o = {}) { sheetSlide(p, [o.col ?? 'white'], { dir: 'up' }); }
function brushWipe(p) { brushSweep(p); }
