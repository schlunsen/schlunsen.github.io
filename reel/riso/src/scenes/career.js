// career.js: Rasmus Schlünsen, fifteen years, printed as a risograph run. 60 s, nine chapters (see STORYBOARD.md).
// Every shot is a pure function of time. Each chapter is its own print run (seed) with its own 2–3 inks; every seam is
// a print-native transition whose cover colour is an ink both chapters share (or bare paper), so the cut is invisible.
(() => {
  // ---------- helpers ----------
  const tw = (txt, size) => { const c = LAYERS[0]; c.font = `${size}px ${TYPE_FONT}`; if ('letterSpacing' in c) c.letterSpacing = '0px'; return c.measureText(txt).width; };
  // A two-ink headline line: the shadow ink knocks out, offset down-right; the face ink overprints it (the overlap is
  // the multiply of the two). Stamps in with an overshoot at t0.
  function head(txt, x, y, size, t, t0, A, B, o = {}) {
    if (t < t0) return;
    const k = seg(t, t0, t0 + .42), d = o.dx ?? Math.max(4, size * .05);
    if (B) type(txt, x + d, y + d, size, B, { align: o.align || 'left', pop: k, rot: o.rot || 0 });
    type(txt, x, y, size, A, { align: o.align || 'left', pop: k, over: o.over ?? !!B, rot: o.rot || 0 });
  }
  // small type that slides up into place
  function sub(txt, x, y, size, col, t, t0, o = {}) {
    if (t < t0) return;
    const k = easeOut(seg(t, t0, t0 + .35));
    type(txt, x, y + 30 * (1 - k), size, col, { align: o.align || 'left', alpha: k, over: o.over, spacing: o.spacing ?? .02 });
  }
  const popIn = (t, t0, d = .45) => t < t0 ? 0 : backOut(seg(t, t0, t0 + d));
  function at(x, y, sx, sy, rot, fn) { if (sx <= .001 || sy <= .001) return; push(); translate(x, y); rotate(rot || 0); scale(sx, sy); fn(); pop(); }
  const FULL = () => rectPts(-300, -300, W + 600, H + 600);
  const ellArc = (cx, cy, rx, ry, rot, a0, a1, n = 48) => { const P = [], c = Math.cos(rot), s = Math.sin(rot); for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n), x = Math.cos(a) * rx, y = Math.sin(a) * ry; P.push([cx + x * c - y * s, cy + x * s + y * c]); } return P; };

  // ---------- transitions (both halves of every seam) ----------
  const SLIDE = cols => ({ h: .35, f: p => inkSlide(p, cols) });
  const DOTS = (col, cx, cy) => ({ h: .45, f: p => dotDissolve(p, col, { cx, cy, cell: 46 }) });
  const FEED = { h: .45, f: p => paperFeed(p) };
  function seams(lt, dur, tin, tout) {
    if (tin && lt < tin.h) tin.f(.5 + lt / (2 * tin.h));
    if (tout && lt > dur - tout.h) tout.f((lt - (dur - tout.h)) / (2 * tout.h));
  }
  const FACE = [1360, 380];
  // the part of a disc below y = cy + d (for a tone laid over the lower half of the sun)
  const chord = (cx, cy, r, d) => { const a0 = Math.asin(clamp(d / r, -1, 1)), P = []; for (let i = 0; i <= 40; i++) { const a = lerp(a0, Math.PI - a0, i / 40); P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return P; };   // the dissolves in and out of the portrait shots grow from his face

  // ---------- the site's orbit mark around Rasmus: a tilted ring, the far half behind him, the near half in front ----------
  function orbit(cx, cy, rx, ry, rot, k, col, dotCol, t, part) {
    if (k <= 0) return;
    const a0 = part === 'back' ? Math.PI : 0, a1 = a0 + Math.PI * Math.min(1, k * 2 - (part === 'back' ? 0 : 1));
    if (a1 > a0 + .01) inkLine(ellArc(cx, cy, rx, ry, rot, a0, a1), 2.6, col, 'ink', 0, { over: true });
    const da = (t * .9) % TAU, inFront = Math.sin(da) > 0;
    if (k >= 1 && (part === 'front') === inFront) {
      const x = Math.cos(da) * rx, y = Math.sin(da) * ry, c = Math.cos(rot), s = Math.sin(rot);
      paint(ellPts(cx + x * c - y * s, cy + x * s + y * c, 26, 26, 28), { fill: dotCol });
    }
  }

  // ======================================================= OPEN 0–6
  function shotOpen(T0, lt, dur) {
    const t = onTwos(lt);
    const inK = (a, b) => 1 - backOut(seg(t, a, b));
    riso({ inks: ['pink', 'blue', 'yellow'], seed: 3, cell: 7, shift: { yellow: [0, -1300 * inK(.05, .6)], pink: [-2300 * inK(.3, .85), 0], blue: [2300 * inK(.55, 1.1), 0] } });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    const [cx, cy] = [1360, 470];
    // the sun behind him: a yellow disc with a halftone halo, a pink screen overprinted across its lower half
    paint(ellPts(cx, cy, 560, 560, 90), { fill: 'yellow', ramp: { c: [cx, cy], r0: 400, r: 560, a: .55, b: 0 } });
    paint(ellPts(cx, cy, 400, 400, 90), { fill: 'yellow' });
    paint(chord(cx, cy, 400, 40), { fill: 'pink', ramp: { from: [0, cy + 40], to: [0, cy + 400], a: 0, b: .6 }, over: true });
    const ok = seg(t, 3.4, 4.5);
    orbit(cx, cy - 40, 600, 150, -.2, ok, 'pink', 'blue', t, 'back');
    printMe(lt + T0, cx, 1085, 900);
    orbit(cx, cy - 40, 600, 150, -.2, ok, 'pink', 'blue', t, 'front');
    // headline
    head('FIFTEEN', 110, 300, 150, t, 1.35, 'blue', 'pink');
    head('YEARS.', 110, 455, 150, t, 1.55, 'blue', 'pink');
    const bar = easeOut(seg(t, 2.7, 3.05));
    if (bar > 0) paint(rectPts(96, 575, 820 * bar, 96), { fill: 'yellow' });
    head("BUILDING WHAT'S NEXT.", 120, 624, 60, t, 2.9, 'blue', null, { over: true });
    camEnd();
    seams(lt, dur, null, DOTS('blue', ...FACE));
  }

  // ======================================================= SECURITY 6–12
  function lock(x, y, t, lt) {
    // shackle springs open at 3.1 s (a hinge on the right leg)
    const open = t < 3.1 ? 0 : 1 - Math.exp(-6 * (t - 3.1)) * Math.cos(14 * (t - 3.1));
    push(); translate(x + 110, y - 150 - 60 * open); rotate(-.35 * open); translate(-(x + 110), -(y - 150));
    arcLine(x, y - 150, 110, 52, 'orange', { a0: Math.PI, a1: TAU });
    paint(rectPts(x - 136, y - 152, 52, 110), { fill: 'orange' });
    paint(rectPts(x + 84, y - 152, 52, 110), { fill: 'orange' });
    pop();
    paint(rrPts(x - 220, y - 70, 440, 340, 34), { fill: 'orange' });
    paint(rrPts(x - 220, y + 150, 440, 120, 34), { fill: 'blue', tone: .35, over: true });   // shading: brown
    paint(ellPts(x, y + 60, 36, 36, 30), { fill: 'blue' });
    paint([[x - 18, y + 80], [x + 18, y + 80], [x + 28, y + 160], [x - 28, y + 160]], { fill: 'blue' });
    return open;
  }
  // a flat key, bow on the right, tip at the origin pointing left; turn 0..1 flattens it (turning about its shaft)
  function key(x, y, rot, s, turn = 0) {
    at(x, y, s, s * lerp(1, .3, turn), rot, () => { scale(-1, 1);
      paint(ellPts(-190, 0, 62, 62, 40), { fill: PAL.paper });
      paint(ellPts(-190, 0, 24, 24, 24), { fill: 'blue' });
      paint(rectPts(-140, -15, 160, 30), { fill: PAL.paper });
      paint(rectPts(-40, 12, 22, 34), { fill: PAL.paper });
      paint(rectPts(-6, 12, 18, 24), { fill: PAL.paper });
    });
  }
  function shotSecurity(T0, lt, dur) {
    const t = onTwos(lt);
    riso({ inks: ['blue', 'orange'], seed: 11, cell: 9 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    paint(FULL(), { fill: 'blue' });
    // a hex dump drifting up behind everything: little byte bars in an orange screen (brown on the blue)
    for (let r = 0; r < 16; r++) for (let c = 0; c < 22; c++) {
      const h = hash(r * 31 + c * 7), y = ((r * 78 - t * 30) % 1248 + 1248) % 1248 - 90;
      if (h < .35) continue;
      paint(rrPts(60 + c * 86, y, 30 + 34 * hash(c + r * 3), 18, 9), { fill: 'orange', tone: .38, over: true });
    }
    const LX = 1450, LY = 580;
    paint(ellPts(LX, LY + 60, 420, 420, 80), { fill: 'orange', ramp: { c: [LX, LY + 60], r0: 0, r: 420, a: .3, b: 0 }, over: true });
    const open = lock(LX, LY, t, lt);
    // the key flies in on an arc, slides home, turns
    const fly = easeOut(seg(t, 1.0, 1.9)), turn = ease(seg(t, 2.35, 2.85));
    if (t >= 1.0 && t < 3.25) {
      const p = arcPt([2300, 120], [LX + 60, LY + 100], 260, fly);
      const slide = ease(seg(t, 1.95, 2.3));
      key(p[0] - 70 * slide, p[1], .7 * (1 - fly), 1, turn);
    }
    // burst when it opens
    const b = popIn(t, 3.1, .5), fade = 1 - seg(t, 4.3, 5.0);
    if (b > 0 && fade > 0) for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i - 4.5) * .3, r0 = 330, r1 = r0 + 120 * b;
      inkLine([[LX + Math.cos(a) * r0, LY - 60 + Math.sin(a) * r0], [LX + Math.cos(a) * r1, LY - 60 + Math.sin(a) * r1]], 3.2 * fade, 'orange', 'ink', 0);
    }
    head('IT STARTED', 110, 230, 112, t, .35, PAL.paper, 'orange', { over: false });
    head('WITH SECURITY.', 110, 364, 112, t, .55, PAL.paper, 'orange', { over: false });
    const st = popIn(t, 1.4, .4);
    if (st > 0) at(250, 540, st, st, -.06, () => { paint(rrPts(-150, -62, 300, 124, 16), { fill: 'orange' }); type('2010', 0, 4, 92, 'blue'); });
    sub('AN INTERNSHIP AT', 112, 690, 44, PAL.paper, t, 2.0);
    sub('A SECURITY COMPANY.', 112, 745, 44, PAL.paper, t, 2.15);
    camEnd();
    seams(lt, dur, DOTS('blue', ...FACE), SLIDE(['orange']));
  }

  // ======================================================= UNITY 12–17
  function cube(x, y, s, lid) {
    const top = [[x, y - s], [x + s * .87, y - s * .5], [x, y], [x - s * .87, y - s * .5]];
    const left = [[x - s * .87, y - s * .5], [x, y], [x, y + s], [x - s * .87, y + s * .5]];
    const right = [[x, y], [x + s * .87, y - s * .5], [x + s * .87, y + s * .5], [x, y + s]];
    paint(top, { fill: 'orange' });
    paint(left, { fill: 'teal' });
    paint(right, { fill: 'teal', tone: .55 });
    paint(right, { fill: 'orange', tone: .6, over: true });
  }
  function cap(x, y, s, sw) {
    // a mortarboard: a flat diamond board over a band, and a tassel that swings
    paint([[x - s * .5, y - s * .18], [x + s * .5, y - s * .18], [x + s * .46, y + s * .12], [x - s * .46, y + s * .12]], { fill: { teal: 1, orange: 1 } });
    paint([[x, y - s * .7], [x + s * 1.05, y - s * .32], [x, y + s * .06], [x - s * 1.05, y - s * .32]], { fill: { teal: 1, orange: .8 } });
    const tx = x + s * .62 + sw * 40, ty = y - s * .1;
    inkLine([[x, y - s * .32], [x + s * .62, y - s * .36], [tx, ty + s * .3]], 1.4, 'orange', 'ink', .4);
    paint(ellPts(tx, ty + s * .34, 16, 22, 16), { fill: 'orange' });
  }
  function shotUnity(T0, lt, dur) {
    const t = onTwos(lt);
    riso({ inks: ['teal', 'orange'], seed: 17, cell: 9 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    // a halftone disc behind, and the cube's shadow on the floor (it tightens as the cube lands)
    paint(ellPts(1360, 560, 420, 420, 80), { fill: 'teal', ramp: { c: [1360, 560], r0: 0, r: 420, a: .28, b: 0 } });
    const sh = t < .55 ? .3 : t < .95 ? lerp(.3, 1, seg(t, .55, .95)) : 1;
    paint(ellPts(1360, 930, 300 * sh, 70 * sh, 48), { fill: 'teal', tone: .5, over: true });
    // the cube drops and squashes
    const d = seg(t, .55, .95), land = t - .95, sq = t > .95 ? .2 * Math.exp(-7 * land) * Math.cos(18 * land) : 0;
    const S = 260, cy = t < .55 ? -700 : t < .95 ? lerp(-500, 670, easeIn(d)) : 670;
    at(1360, cy + S, 1 + sq, 1 - sq, 0, () => cube(0, -S, S));
    // the cap lands at 2.3 s and its tassel swings
    if (t > 1.9) {
      const cd = seg(t, 1.9, 2.3), capY = t < 2.3 ? lerp(-200, 520, easeIn(cd)) : 520 + 10 * spring(t, 2.3, 7, 20);
      cap(1360, capY, 250, spring(t, 2.3, 3, 9));
    }
    head('FINAL PROJECT:', 110, 250, 86, t, .3, 'teal', null);
    head('UNITY3D.', 104, 400, 170, t, .5, 'orange', 'teal', { over: false });
    head('UNITY3D.', 104, 400, 170, t, .5, 'orange', null, { over: false });
    sub('BUILT IN UNITY WHILE IT WAS', 112, 560, 40, 'teal', t, 2.6);
    sub('A YOUNG DANISH STARTUP.', 112, 612, 40, 'teal', t, 2.75);
    const sk = popIn(t, 3.2, .4);
    if (sk > 0) at(1720, 300, sk, sk, .18, () => {
      paint(ellPts(0, 0, 118, 118, 60), { fill: 'orange' });
      arcLine(0, 0, 100, 5, 'teal', { over: true });
      type('CPH', 0, -24, 44, 'teal', { over: true }); type('2004', 0, 28, 44, 'teal', { over: true });
    });
    camEnd();
    seams(lt, dur, SLIDE(['orange']), SLIDE(['teal']));
  }

  // ======================================================= AGENCY 17–22
  function gear(x, y, r, rot, col, o = {}) {
    const P = []; for (let i = 0; i < 40; i++) { const a = rot + i / 40 * TAU, k = (i % 5 < 2) ? 1 : .78; P.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]); }
    paint(P, { fill: col, over: o.over });
    paint(ellPts(x, y, r * .32, r * .32, 20), { fill: o.hole || PAL.paper });
  }
  function shotAgency(T0, lt, dur) {
    const t = onTwos(lt);
    riso({ inks: ['teal', 'pink'], seed: 23, cell: 9 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    const X = 1460;
    // three layers stack up: the browser, the API, the database
    const b1 = popIn(t, .45), b2 = popIn(t, .75), b3 = popIn(t, 1.05);
    // rails and racing packets between the layers (they get faster and faster)
    const rails = [X - 385, X + 385];
    if (t > 1.2) {
      const rk = ease(seg(t, 1.2, 1.6));
      for (const rx of rails) {
        inkLine([[rx, 250], [rx, lerp(250, 880, rk)]], 3, 'teal', 'ink', 0, { tone: .45 });
        for (const yy of [250, 560, 880]) inkLine([[rx, yy], [rx + (rx < X ? 55 : -55) * rk, yy]], 3, 'teal', 'ink', 0, { tone: .45 });
      }
      const ph = u => 1.2 * u + .9 * u * u;   // integrated speed: accelerating
      const u = Math.max(0, t - 1.4);
      for (let i = 0; i < 6; i++) {
        const up = i % 2, k = frac(ph(u) * .55 + i / 6), y = up ? lerp(880, 250, k) : lerp(250, 880, k), rx = rails[up];
        const sp = Math.min(1, u / 3.2), len = 40 + 90 * sp;
        paint(rrPts(rx - 20, up ? y : y - len, 40, len, 14), { fill: 'pink', over: true });
      }
    }
    at(X, 250, b1, b1, 0, () => {
      paint(rrPts(-330, -150, 660, 300, 22), { fill: 'teal' });
      paint(rrPts(-310, -100, 620, 230, 10), { fill: PAL.paper });
      paint(rrPts(-330, -150, 660, 50, 22), { fill: 'pink', over: true });
      for (let i = 0; i < 3; i++) paint(ellPts(-296 + i * 30, -125, 9, 9, 12), { fill: PAL.paper });
      paint(rrPts(-280, -70, 240, 170, 10), { fill: 'pink', tone: .45 });
      for (let i = 0; i < 4; i++) paint(rrPts(-10, -64 + i * 44, 270 - i * 40, 20, 10), { fill: 'teal', tone: .5 });
    });
    at(X, 560, b2, b2, 0, () => {
      paint(rrPts(-330, -90, 660, 180, 22), { fill: 'pink' });
      gear(-200, 0, 62, t * 2.4, 'teal', { over: true, hole: 'pink' });
      gear(-100, 38, 38, -t * 3.9, 'teal', { over: true, hole: 'pink' });
      type('API', 150, 4, 90, 'teal', { over: true });
    });
    at(X, 880, b3, b3, 0, () => {
      paint(rectPts(-200, -110, 400, 220), { fill: 'teal' });
      paint(ellPts(0, 110, 200, 50, 40), { fill: 'teal' });
      for (const yy of [-40, 30]) paint(ellPts(0, yy, 200, 50, 40, 0), { fill: 'pink', tone: .55, over: true });
      paint(ellPts(0, -110, 200, 50, 40), { fill: 'pink', tone: .7 });
      paint(ellPts(0, -110, 200, 50, 40), { fill: 'teal', tone: .4, over: true });
    });
    // speed lines once it's really going
    const sp = seg(t, 3.0, 4.0);
    if (sp > 0) for (let i = 0; i < 7; i++) {
      const y = 360 + i * 70 + 20 * hash(i), len = 260 * sp * (0.6 + .4 * hash(i + 3)), x0 = 980 - ((t * 900 + hash(i) * 700) % 700);
      inkLine([[x0, y], [x0 + len, y]], 1.2, 'pink', 'ink', 0, { over: true });
    }
    head('FULL STACK,', 110, 300, 112, t, .3, 'teal', 'pink');
    head('FULL SPEED.', 110, 440, 112, t, 1.4, 'teal', 'pink');
    sub('AT A YOUNG AGENCY.', 114, 600, 46, 'pink', t, 1.9);
    camEnd();
    seams(lt, dur, SLIDE(['teal']), FEED);
  }

  // ======================================================= ORBISCADA 22–33
  function turbine(x, by, h, ang, col = 'blue', fat = 1) {
    const hy = by - h, w0 = h * .045 * fat, w1 = h * .02 * fat;
    paint([[x - w0, by], [x + w0, by], [x + w1, hy], [x - w1, hy]], { fill: col });
    for (let i = 0; i < 3; i++) {
      const a = ang + i * TAU / 3, L = h * .6, c = Math.cos(a), s = Math.sin(a), pc = -s, ps = c, wb = h * .055 * fat;
      paint([[x + pc * wb * .35, hy + ps * wb * .35], [x + c * L * .22 + pc * wb, hy + s * L * .22 + ps * wb], [x + c * L, hy + s * L], [x + c * L * .2 - pc * wb * .15, hy + s * L * .2 - ps * wb * .15]], { fill: col });
    }
    paint(ellPts(x, hy, h * .05, h * .05, 18), { fill: col });
  }
  const FIELDS = [['DENMARK', 6], ['UK', 5], ['USA', 6], ['JAPAN', 4]];
  const FX = i => 110 + i * 440, FY = 470, FW = 400, FH = 400;
  function slot(f, j) { const r = Math.floor(j / 3), c = j % 3; return [FX(f) + 75 + c * 125 + (r % 2) * 20, FY + 190 + r * 180]; }
  const fieldT = f => 1.4 + [0, 1.2, 2.1, 2.9][f];   // (in shot-B time) when each country's turbines start popping
  function shotOrbis(T0, lt, dur) {
    const t = onTwos(lt), tb = t - 4.2;   // part B starts 4.2 s in
    riso({ inks: ['blue', 'yellow', 'pink'], seed: 29, cell: 8 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    const pull = ease(seg(tb, 0, 1.1));        // the landscape shrinks into the first Danish turbine
    // sky and land
    paint(FULL(), { fill: 'yellow', ramp: { from: [0, 900], to: [0, 150], a: .9, b: 0 } });
    if (pull < 1) {
      const al = 1 - pull;
      paint([[-300, 1400], [-300, 720], [300, 640], [700, 700], [1100, 610], [1500, 690], [2300, 620], [2300, 1400]], { fill: 'blue', tone: .45, over: true, alpha: al });
      paint([[-300, 1400], [-300, 860], [600, 820], [1300, 870], [2300, 800], [2300, 1400]], { fill: 'blue', tone: .8, over: true, alpha: al });
    }
    // fields per country (part B)
    FIELDS.forEach(([name, n], f) => {
      const k = popIn(tb, .6 + f * .12, .5); if (k <= 0) return;
      at(FX(f) + FW / 2, FY + FH, 1, k, 0, () => {
        paint(rrPts(-FW / 2, -FH, FW, FH, 26), { fill: 'yellow' });
        paint(rrPts(-FW / 2, -FH, FW, FH, 26), { fill: 'blue', tone: .5, over: true });
      });
      head(name, FX(f) + FW / 2, FY + FH + 58, 50, tb, .8 + f * .12, 'blue', 'pink', { align: 'center' });
      for (let j = 0; j < n; j++) {
        if (f === 0 && j === 0) continue;
        const tj = fieldT(f) + j * (f === 0 ? .12 : .09), p = popIn(tb, tj, .35); if (p <= 0) continue;
        const [x, y] = slot(f, j);
        at(x, y, p, p, 0, () => turbine(0, 0, 105, tb * 4 + hash(j + f * 20) * 6, 'blue', 1.5));
      }
    });
    // the big turbine rises (part A), then shrinks into its slot in Denmark (part B)
    const rise = popIn(t, .5, .6), [sx, sy] = slot(0, 0);
    const bx = lerp(1110, sx, pull), by = lerp(930, sy, pull), hh = lerp(560, 105, pull) * rise;
    const spin = t < 1.1 ? 0 : 1.6 * (t - 1.1) + .35 * (t - 1.1) * (t - 1.1);
    if (hh > 1) turbine(bx, by, hh, spin + .3, 'blue', lerp(1, 1.5, pull));
    // type
    head('ORBISCADA', 110, 170, 128, t, .3, 'blue', 'pink');
    sub('FREELANCE · 5 YEARS', 114, 285, 40, 'blue', t, 1.0);
    sub('SCADA FOR WIND TURBINES', 114, 335, 40, 'blue', t, 1.15);
    // the counter: 1 → 1,500+
    if (t > 1.8) {
      const v = tb < 1.2 ? 1 : Math.round(lerp(1, 1500, ease(seg(tb, 1.2, 5.2)))), done = tb > 5.2;
      const txt = (v >= 1000 ? Math.floor(v / 1000) + ',' + String(v % 1000).padStart(3, '0') : String(v)) + (done ? '+' : '');
      const bump = done ? 1 + .12 * spring(tb, 5.2, 6, 16) : 1;
      push(); translate(1810, 190); scale(bump); head(txt, 0, 0, 150, t, 1.8, 'blue', 'pink', { align: 'right' }); pop();
      sub(v === 1 ? 'TURBINE · DENMARK' : 'TURBINES · 4 COUNTRIES', 1810, 300, 36, 'blue', t, 2.0, { align: 'right' });
    }
    // Børsen Gazelle 2018: a little rosette stamps on
    const r = popIn(tb, 5.1, .45);
    if (r > 0) at(1110, 205, r * 1.05, r * 1.05, -.1, () => {
      paint([[-40, 40], [-80, 190], [-40, 165], [-10, 200], [0, 50]], { fill: 'pink' });
      paint([[40, 40], [80, 190], [40, 165], [10, 200], [0, 50]], { fill: 'pink' });
      paint(starPts(0, 0, 115, .84, 18), { fill: 'pink' });
      paint(ellPts(0, 0, 88, 88, 48), { fill: 'yellow' });
      type('GAZELLE', 0, -18, 28, 'blue', { over: true }); type('2018', 0, 22, 42, 'blue', { over: true });
    });
    sub('BØRSEN GAZELLE 2018 · CENTRAL JUTLAND', 114, 392, 30, 'pink', tb, 5.35);
    camEnd();
    seams(lt, dur, FEED, DOTS('yellow', 1110, 205));
  }

  // ======================================================= CLOVR 33–40
  const NODES = [[700, 700], [930, 520], [960, 880], [1180, 690], [1160, 400], [1400, 540], [1380, 900], [1620, 700], [1600, 370], [1760, 540], [1700, 870], [520, 930], [1360, 240]];
  const EDGES = [[0, 1], [0, 2], [0, 11], [1, 3], [1, 4], [2, 3], [2, 6], [3, 5], [4, 5], [4, 12], [5, 8], [5, 7], [6, 7], [7, 9], [7, 10], [8, 9], [12, 8], [3, 6], [11, 2], [9, 10]];
  const PATH = [11, 0, 1, 3, 5, 7, 10], HOP = .58, TR0 = 1.8;
  function shotClovr(T0, lt, dur) {
    const t = onTwos(lt);
    riso({ inks: ['purple', 'yellow'], seed: 37, cell: 9 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    paint(FULL(), { fill: 'purple' });
    const hops = clamp((t - TR0) / HOP, 0, PATH.length - 1);
    // the network appears
    EDGES.forEach(([a, b], i) => {
      const k = ease(seg(t, .4 + i * .03, .9 + i * .03)); if (k <= 0) return;
      const A = NODES[a], B = NODES[b];
      inkLine([A, [lerp(A[0], B[0], k), lerp(A[1], B[1], k)]], 1.1, 'yellow', 'ink', 0, { tone: .45 });
    });
    // the traced path, hop by hop
    for (let h = 0; h < PATH.length - 1; h++) {
      const k = clamp(hops - h); if (k <= 0) break;
      const A = NODES[PATH[h]], B = NODES[PATH[h + 1]];
      inkLine([A, [lerp(A[0], B[0], k), lerp(A[1], B[1], k)]], 3.4, 'yellow', 'ink', 0);
    }
    NODES.forEach(([x, y], i) => {
      const k = popIn(t, .3 + hash(i) * .6, .4); if (k <= 0) return;
      const onPath = PATH.indexOf(i), hit = onPath >= 0 && hops >= onPath, r = (i % 3 ? 34 : 44) * k * (hit ? 1 + .25 * spring(t, TR0 + onPath * HOP, 6, 16) : 1);
      paint(ellPts(x, y, r, r, 36), { fill: 'yellow', tone: hit ? 1 : .6 });
      arcLine(x, y, r * .62, 5, 'purple', { over: true, tone: hit ? .9 : .4 });
    });
    // the magnifier rides the head of the trace
    const hi = Math.min(PATH.length - 2, Math.floor(hops)), hk = hops - hi, A = NODES[PATH[hi]], B = NODES[PATH[hi + 1]];
    const mg = popIn(t, TR0 - .3, .4), found = t > TR0 + (PATH.length - 1) * HOP;
    if (mg > 0) {
      const mx = lerp(A[0], B[0], ease(hk)) + 70, my = lerp(A[1], B[1], ease(hk)) - 70;
      at(mx, my, mg, mg, 0, () => {
        paint(ellPts(0, 0, 80, 80, 48), { fill: 'yellow', tone: .3, over: true });
        arcLine(0, 0, 86, 18, PAL.paper);
        inkLine([[60, 60], [140, 140]], 5, PAL.paper, 'ink', 0);
      });
    }
    // found: a ring pops around the last wallet
    if (found) {
      const tf = t - (TR0 + (PATH.length - 1) * HOP), k = backOut(seg(tf, 0, .4)), [x, y] = NODES[PATH[PATH.length - 1]];
      arcLine(x, y, 80 * k, 12, PAL.paper);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r0 = 100 * k, r1 = r0 + 50 * k * (1 - seg(tf, .5, 1.1)); if (r1 > r0 + 2) inkLine([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 2.4, 'yellow', 'ink', 0); }
    }
    head('FOLLOWING', 110, 190, 130, t, .3, 'yellow', PAL.paper, { over: false });
    head('THE MONEY.', 110, 330, 130, t, .5, 'yellow', PAL.paper, { over: false });
    head('THE MONEY.', 110, 330, 130, t, .5, 'yellow', null, { over: false });
    head('FOLLOWING', 110, 190, 130, t, .3, 'yellow', null, { over: false });
    sub('CLOVR LABS', 114, 460, 48, PAL.paper, t, 1.1);
    sub('CRYPTO FORENSIC ANALYTICS', 114, 515, 36, 'yellow', t, 1.25);
    camEnd();
    seams(lt, dur, DOTS('yellow', 1110, 205), SLIDE(['purple']));
  }

  // ======================================================= N0 40–45
  const WX = 700, WY = 360, WW = 1110, WH = 640;
  const SLOTS = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) SLOTS.push([WX + 185 + c * 370, WY + 175 + r * 170]);
  const TOKENS = ['person', 'agent', 'app', 'app', 'person', 'agent', 'agent', 'app', 'person'];
  function token(kind, x, y, s, t) {
    at(x, y, s, s, 0, () => {
      if (kind === 'person' || kind === 'me') paint(ellPts(0, 0, 70, 70, 40), { fill: 'pink', tone: kind === 'me' ? .45 : 1 });
      if (kind === 'person') { paint(ellPts(0, -14, 24, 24, 24), { fill: 'purple', over: true }); paint([[-44, 50], [-38, 22], [0, 12], [38, 22], [44, 50]], { fill: 'purple', over: true, curv: .4 }); }
      if (kind === 'agent') { paint(rrPts(-68, -68, 136, 136, 30), { fill: 'purple' }); paint(starPts(0, 0, 50, .3, 4), { fill: 'pink', over: true }); }
      if (kind === 'app') { paint(rrPts(-70, -60, 140, 120, 18), { fill: 'pink', tone: .55 }); paint(rrPts(-46, -36, 40, 30, 8), { fill: 'purple', over: true }); paint(rrPts(6, -36, 40, 30, 8), { fill: 'purple', over: true, tone: .5 }); paint(rrPts(-46, 6, 92, 30, 8), { fill: 'purple', over: true }); }
    });
  }
  function shotN0(T0, lt, dur) {
    const t = onTwos(lt);
    riso({ inks: ['purple', 'pink'], seed: 41, cell: 7 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    const wk = popIn(t, .5, .5);
    at(WX + WW / 2, WY + WH / 2, wk, wk, 0, () => {
      paint(rrPts(-WW / 2, -WH / 2, WW, WH, 26), { fill: 'purple' });
      paint(rrPts(-WW / 2 + 16, -WH / 2 + 70, WW - 32, WH - 86, 14), { fill: PAL.paper });
      paint(rrPts(-WW / 2 + 16, -WH / 2 + 70, WW - 32, WH - 86, 14), { fill: 'pink', tone: .14, over: true });
      for (let i = 0; i < 3; i++) paint(ellPts(-WW / 2 + 42 + i * 34, -WH / 2 + 36, 11, 11, 14), { fill: 'pink' });
      type('n0', WW / 2 - 70, -WH / 2 + 36, 42, 'pink');
    });
    // people, agents and apps fly in on arcs and click into place; then all pulse together
    const all = t > 3.4 ? 1 + .08 * spring(t, 3.4, 5, 16) : 1;
    TOKENS.forEach((kind, i) => {
      const t0 = 1.1 + i * .22, k = seg(t, t0, t0 + .45); if (k <= 0) return;
      const [x, y] = SLOTS[i], from = [i % 2 ? 2300 : -300, 100 + 900 * hash(i + 4)];
      const p = k < 1 ? arcPt(from, [x, y], 260, easeOut(k)) : [x, y];
      const s = (k < 1 ? .8 : 1 + .15 * spring(t, t0 + .45, 7, 18)) * all;
      token(kind, p[0], p[1], s, t);
    });
    // a cameo: Rasmus leans into the corner of the workspace
    const mk = popIn(t, 3.0, .45);
    if (mk > 0) at(640, 1085, mk, mk, 0, () => printMe(lt + T0, 0, 0, 500));
    head('THE WORKSPACE', 110, 150, 104, t, .3, 'purple', 'pink');
    head('OF THE FUTURE.', 110, 262, 104, t, .5, 'purple', 'pink');
    sub('PEOPLE, AGENTS', 114, 470, 44, 'purple', t, 1.3);
    sub('AND APPS IN', 114, 522, 44, 'purple', t, 1.4);
    sub('ONE PLACE.', 114, 574, 44, 'purple', t, 1.5);
    const u = popIn(t, 2.9, .4);
    if (u > 0) at(114, 760, u, u, -.04, () => { paint(rrPts(-10, -44, 330, 88, 16), { fill: 'pink' }); type('nzero.pro', 12, 0, 50, 'purple', { align: 'left', over: true }); });
    camEnd();
    seams(lt, dur, SLIDE(['purple']), SLIDE(['pink']));
  }

  // ======================================================= WORKSHOP 45–53
  const PROJECTS = ['n0', 'Claude Agent SDK Go', 'Gource Viewer', 'Gitilla', 'Codex SDK Go', 'wee.cat', 'Donna', 'The Agentic Crew', 'Hefty'];
  const CARD_FILL = [{ yellow: 1 }, { pink: .55 }, { blue: .2 }, { yellow: 1, pink: .35 }, { blue: .35, yellow: .6 }, { pink: 1 }, { yellow: .7 }, { pink: .28 }, { pink: .4, yellow: 1 }];
  function shotWorkshop(T0, lt, dur) {
    const t = onTwos(lt);
    riso({ inks: ['pink', 'blue', 'yellow'], seed: 47, cell: 9 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    paint(FULL(), { fill: 'yellow', tone: .16 });
    PROJECTS.forEach((name, i) => {
      const r = Math.floor(i / 3), c = i % 3, x = 130 + c * 575 + 262, y = 352 + r * 232 + 100, t0 = 1.15 + i * .47;
      if (t < t0) return;
      const k = seg(t, t0, t0 + .3), s = t < t0 + .3 ? lerp(1.5, 1, easeIn(k)) : 1 - .06 * spring(t, t0 + .3, 7, 20) + .03 * (t > 5.9 ? pulse(t - 5.9, 5) : 0);
      const rot = (hash(i + 5) - .5) * .06;
      at(x, y, s, s, rot, () => {
        paint(rrPts(-262 + 10, -100 + 12, 524, 200, 16), { fill: 'blue', tone: .3, over: true });    // a halftone shadow
        paint(rrPts(-262, -100, 524, 200, 16), { fill: CARD_FILL[i] });
        type(String(i + 1).padStart(2, '0'), -226, -62, 26, 'pink', { align: 'left', over: true });
        const size = Math.min(56, 56 * 450 / tw(name, 56));
        type(name, 0, 14, size, 'blue', { over: true });
      });
    });
    head('ALWAYS BUILDING.', 110, 140, 104, t, .3, 'blue', 'pink');
    head('ALWAYS SHIPPING.', 110, 252, 104, t, .6, 'blue', 'pink');
    camEnd();
    seams(lt, dur, SLIDE(['pink']), DOTS('blue', ...FACE));
  }

  // ======================================================= END 53–60
  function shotEnd(T0, lt, dur) {
    const t = onTwos(lt);
    riso({ inks: ['pink', 'blue', 'yellow'], seed: 5, cell: 7 });
    camBegin(960, 540, 1.02);   // a locked-off camera: held areas print identically frame to frame (cheap to encode)
    const [cx, cy] = [1450, 470];
    paint(ellPts(cx, cy, 560, 560, 90), { fill: 'yellow', ramp: { c: [cx, cy], r0: 400, r: 560, a: .55, b: 0 } });
    paint(ellPts(cx, cy, 400, 400, 90), { fill: 'yellow' });
    paint(chord(cx, cy, 400, 40), { fill: 'pink', ramp: { from: [0, cy + 40], to: [0, cy + 400], a: 0, b: .6 }, over: true });
    arcLine(cx, cy, 410, 12, 'blue', { over: true, a0: -Math.PI / 2, a1: -Math.PI / 2 + TAU * ease(seg(t, 1.2, 2.2)) });
    orbit(cx, cy - 40, 520, 140, -.2 + .05 * Math.sin(t * .8), 1, 'pink', 'blue', t, 'back');
    printMe(lt + T0, cx, 1085, 900);
    orbit(cx, cy - 40, 520, 140, -.2 + .05 * Math.sin(t * .8), 1, 'pink', 'blue', t, 'front');
    head('SERIOUS CODE.', 110, 290, 92, t, .4, 'blue', 'pink');
    head('CLEAR THINKING.', 110, 400, 92, t, .9, 'blue', 'pink');
    const bar = easeOut(seg(t, 2.0, 2.4));
    if (bar > 0) paint(rectPts(110, 500, 640 * bar, 14), { fill: 'pink' });
    head('RASMUS SCHLÜNSEN', 110, 592, 64, t, 2.4, 'blue', null, { over: true });
    const b = popIn(t, 2.8, .4);
    if (b > 0) at(110, 680, b, b, 0, () => { paint(ellPts(22, 0, 20, 20, 24), { fill: 'yellow' }); paint(ellPts(22, 0, 20, 20, 24), { fill: 'pink', tone: .5, over: true }); type('BARCELONA', 60, 2, 44, 'pink', { align: 'left' }); });
    camEnd();
    seams(lt, dur, DOTS('blue', ...FACE), null);
    if (lt > dur - .95) paperFeed(seg(lt, dur - .95, dur - .05) * .63);   // a fresh sheet feeds in; its marks come to rest
  }

  shots([[0, shotOpen], [6, shotSecurity], [12, shotUnity], [17, shotAgency], [22, shotOrbis], [33, shotClovr], [40, shotN0], [45, shotWorkshop], [53, shotEnd]]);
})();
