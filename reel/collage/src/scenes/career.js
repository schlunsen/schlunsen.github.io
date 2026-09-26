// career.js: Rasmus Schlünsen, fifteen years, as a cut-paper collage in a Miró-inspired language. 60 s, nine chapters
// (see STORYBOARD.md). Every shot is a pure function of time, on twos (15 drawings/s). Pieces move by transforms only,
// so their scissor-cut edges and grain never change; held pieces are identical frame to frame. Every seam is a
// paper-native transition that covers the frame at its midpoint.
(() => {
  // ---------- helpers ----------
  const popIn = (t, t0, d = .45) => t < t0 ? 0 : backOut(seg(t, t0, t0 + d));
  function at(x, y, sx, sy, rot, fn) { if (sx <= .001 || sy <= .001) return; push(); translate(x, y); rotate(rot || 0); scale(sx, sy); fn(); pop(); }
  // a headline line: chunky cut letters popping in one after another from t0
  function head(txt, x, y, size, t, t0, col, o = {}) {
    if (t < t0) return;
    type(txt, x, y, size, col, { align: o.align || 'left', pop: seg(t, t0, t0 + (o.d ?? .55)), rot: o.rot ?? 0, stagger: o.stagger ?? .6, jig: o.jig ?? .06, key: o.key, lift: o.lift });
  }
  // small type on a paper strip, popping in at t0
  function strip(txt, x, y, size, t, t0, bg, col, o = {}) {
    if (t < t0) return;
    label(txt, x, y, size, col, { align: o.align || 'left', bg, pop: seg(t, t0, t0 + .35), rot: o.rot ?? 0, torn: o.torn });
  }
  const FULLG = col => cut(rectPts(-300, -300, W + 600, H + 600), col, { lift: 0, edge: 0 });

  // ---------- transitions (both halves of every seam) ----------
  const FLOOD = (cx, cy, cols) => ({ h: .45, f: p => flood(p, { cx, cy, cols }) });
  const SHEET = (cols, dir) => ({ h: .4, f: p => sheetSlide(p, cols, { dir }) });
  const CUTR = (cols, angle) => ({ h: .4, f: p => cutReveal(p, { cols, angle }) });
  const SWEEP = { h: .45, f: p => brushSweep(p) };
  function seams(lt, dur, tin, tout) {
    if (tin && lt < tin.h) tin.f(.5 + lt / (2 * tin.h));
    if (tout && lt > dur - tout.h) tout.f((lt - (dur - tout.h)) / (2 * tout.h));
  }

  // ---------- Rasmus with his orbit: the sun behind, a brushed orbit loop, a star, a moon and an eye circling him ----------
  const ellPt = (cx, cy, rx, ry, rot, a) => { const x = Math.cos(a) * rx, y = Math.sin(a) * ry, c = Math.cos(rot), s = Math.sin(rot); return [cx + x * c - y * s, cy + x * s + y * c]; };
  const ellArc = (cx, cy, rx, ry, rot, a0, a1, n = 60) => { const P = []; for (let i = 0; i <= n; i++) P.push(ellPt(cx, cy, rx, ry, rot, lerp(a0, a1, i / n))); return P; };
  function orbiter(i, x, y, s, t) {
    at(x, y, s, s, 0, () => {
      if (i === 0) star(0, 0, 46, 'yellow', { key: 'orb-star', rot: -Math.PI / 2 + t * .8 });
      else if (i === 1) moon(0, 0, 44, 'blue', { fat: .36, rot: -.5, key: 'orb-moon' });
      else eye(0, 0, 50, { iris: 'red', key: 'orb', look: [-.6, .2], blink: Math.max(0, 1 - Math.abs(frac(t / 3.1) - .5) / .025) });
    });
  }
  // part: 'back' draws the far half of the loop and the orbiters behind him; 'front' the rest. k: 0..1 how far it's painted
  function orbit(O, k, t, part, n = 3) {
    if (k <= 0) return;
    const [cx, cy, rx, ry, rot] = O;
    const kb = clamp(k * 2), kf = clamp(k * 2 - 1);
    if (part === 'back' && kb > 0) brush(ellArc(cx, cy, rx, ry, rot, Math.PI, Math.PI + Math.PI * kb), { w: 11, curv: 0, taper: .1, key: 'orb-b', press: .35 });
    if (part === 'front' && kf > 0) brush(ellArc(cx, cy, rx, ry, rot, 0, Math.PI * kf), { w: 11, curv: 0, taper: .1, key: 'orb-f', press: .35 });
    if (k < 1) return;
    for (let i = 0; i < n; i++) {
      const a = t * .55 + i * TAU / n, front = Math.sin(a) > 0;
      if ((part === 'front') !== front) continue;
      const [x, y] = ellPt(cx, cy, rx, ry, rot, a), s = popIn(t, 0, .01) * (1 + .12 * Math.sin(a));
      orbiter(i, x, y, s, t);
    }
  }
  const OPEN_X = 1380, END_X = 1450;

  // ======================================================= OPEN 0–6
  function shotOpen(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ seed: 3 });
    const cx = OPEN_X, O = [cx + 10, 745, 590, 150, -.12];
    at(cx + 10, 430, popIn(t, .2, .5), popIn(t, .2, .5), 0, () => dot(0, 0, 330, 'red', { key: 'sun' }));
    // his cutout slides up from below the frame and lands with a little bounce
    const up = t < .5 ? 0 : backOut(seg(t, .5, 1.15)), oc = seg(t, 3.3, 4.6), otime = t - 4.6;
    orbit(O, oc, otime, 'back');
    if (up > 0) { push(); translate(0, 900 * (1 - up)); pasteMe(lt + T0, cx, 1085, 900); pop(); }
    // the hills in front
    at(1880, 1120 + 420 * (1 - easeOut(seg(t, .75, 1.3))), 1, 1, 0, () => blob(0, 0, 420, 'green', { seed: 11, squash: .6, lumps: .15 }));
    at(1230, 1150 + 420 * (1 - easeOut(seg(t, .6, 1.15))), 1, 1, 0, () => blob(0, 0, 560, 'blue', { seed: 4, squash: .42, lumps: .14 }));
    orbit(O, oc, otime, 'front');
    // headline
    head('FIFTEEN', 100, 290, 176, t, 1.35, 'red', { rot: -.03 });
    head('YEARS.', 110, 470, 176, t, 1.75, 'blue', { rot: -.01 });
    strip("BUILDING WHAT'S NEXT.", 118, 640, 52, t, 2.7, 'yellow', 'black', { rot: -.02 });
    // a few stars and an asterisk on the ground around the words
    at(760, 150, popIn(t, 2.2), popIn(t, 2.2), .2, () => star(0, 0, 40, 'yellow', { key: 'o-s1' }));
    at(820, 520, popIn(t, 2.45), popIn(t, 2.45), 0, () => asterisk(0, 0, 34, { key: 'o-a1' }));
    at(210, 820, popIn(t, 3.0), popIn(t, 3.0), 0, () => spiral(0, 0, 60, { turns: 2.3, w: 9, k: ease(seg(t, 3.0, 3.8)) }));
    at(560, 900, popIn(t, 3.2), popIn(t, 3.2), 0, () => dot(0, 0, 24, 'red', { key: 'o-d1' }));
    seams(lt, dur, null, FLOOD(1400, 610));
  }

  // ======================================================= SECURITY 6–12 (night)
  const shackle = () => { const P = []; for (let i = 0; i <= 24; i++) { const a = Math.PI + i / 24 * Math.PI; P.push([Math.cos(a) * 118, Math.sin(a) * 118]); } return [[-118, 110], ...P, [118, 110]]; };
  function lock(x, y, t) {
    const open = t < 3.1 ? 0 : 1 - Math.exp(-6 * (t - 3.1)) * Math.cos(14 * (t - 3.1));
    // the shackle: a thick white paper hoop, hinged on its right leg; it lifts and swings when the lock opens
    at(x + 118, y - 150 - 70 * open, 1, 1, -.4 * open, () => { push(); translate(-118, 0); cut(ribbon(shackle(), 46), 'white', { key: 'shackle' }); pop(); });
    cut(rrPts(x - 230, y - 80, 460, 350, 40), 'yellow', { key: 'lockbody' });
    cut(rrPts(x - 230, y + 160, 460, 110, 40), 'red', { key: 'lockband', lift: .5 });
    dot(x, y + 40, 38, 'black', { key: 'kh', lift: .4 });
    cut([[x - 18, y + 60], [x + 18, y + 60], [x + 30, y + 140], [x - 30, y + 140]], 'black', { key: 'kh2', lift: .4 });
    return open;
  }
  function key(x, y, rot, s, turn) {
    at(x, y, s, s * Math.cos(turn * Math.PI), rot, () => {
      hoop(170, 0, 62, 30, 'red', { key: 'keybow' });
      cut(rectPts(-10, -16, 130, 32), 'red', { key: 'keyshaft' });
      cut(rectPts(20, 14, 22, 36), 'red', { key: 'keyt1' }); cut(rectPts(58, 14, 20, 26), 'red', { key: 'keyt2' });
      dot(170, 0, 10, 'yellow', { key: 'keydot', lift: .3 });
    });
  }
  function shotSecurity(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ ground: 'night', seed: 11 });
    scatter(16, [60, 40, 1800, 1000], 5, (x, y, i, h) => { if (x > 1050 && y > 200) return; at(x, y, popIn(t, .2 + h * .8), popIn(t, .2 + h * .8), h * 2, () => i % 3 ? dot(0, 0, 5 + 6 * h, 'white', { key: 'sd' + i, lift: .4 }) : star(0, 0, 14 + 10 * h, 'yellow', { key: 'ss' + i, lift: .6 })); });
    const LX = 1450, LY = 600;
    moon(LX + 330, 170, 70, 'yellow', { fat: .3, rot: -.6, key: 'sec-moon' });
    const open = lock(LX, LY, t);
    // the key flies in on an arc, slides home, turns (a flip about its shaft)
    const fly = easeOut(seg(t, 1.0, 1.9)), turn = ease(seg(t, 2.35, 2.85));
    if (t >= 1.0 && t < 3.2) {
      const p = arcPt([2300, 120], [LX - 60, LY + 100], 260, fly), slide = ease(seg(t, 1.95, 2.3));
      key(p[0] + 90 * (1 - slide), p[1], .7 * (1 - fly), 1, turn * .5);
    }
    // a burst of white asterisks and yellow stars when it opens
    const b = popIn(t, 3.1, .5);
    if (b > 0) for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * .42, r = 360 + 50 * b, x = LX + Math.cos(a) * r, y = LY - 60 + Math.sin(a) * r * .9;
      at(x, y, b, b, i * .4, () => i % 2 ? star(0, 0, 30, 'yellow', { key: 'bs' + i }) : asterisk(0, 0, 32, { col: 'white', key: 'ba' + i }));
    }
    head('IT STARTED', 100, 230, 124, t, .35, 'white', { rot: -.02 });
    head('WITH SECURITY.', 100, 370, 124, t, .6, 'yellow', { rot: -.01 });
    const st = popIn(t, 1.4, .4);
    if (st > 0) at(250, 540, st, st, -.06, () => { cut(rrPts(-150, -64, 300, 128, 18), 'red', { key: 'y2010' }); type('2010', 0, 6, 92, 'white', { key: '2010' }); });
    strip('FIRST JOB, WHILE STILL STUDYING:', 112, 700, 38, t, 2.0, 'white', 'black');
    strip('AN INTERNSHIP AT A SECURITY COMPANY.', 112, 782, 38, t, 2.25, 'yellow', 'black', { rot: -.01 });
    seams(lt, dur, FLOOD(1400, 610), SHEET(['yellow', 'red']));
  }

  // ======================================================= UNITY 12–17
  function cube(s) {
    const top = [[0, -s], [s * .87, -s * .5], [0, 0], [-s * .87, -s * .5]];
    const left = [[-s * .87, -s * .5], [0, 0], [0, s], [-s * .87, s * .5]];
    const right = [[0, 0], [s * .87, -s * .5], [s * .87, s * .5], [0, s]];
    cut(left, 'blue', { key: 'cl' }); cut(right, 'red', { key: 'cr' }); cut(top, 'yellow', { key: 'ct' });
  }
  function cap(s, sw) {
    cut([[-s * .5, -s * .18], [s * .5, -s * .18], [s * .46, s * .12], [-s * .46, s * .12]], 'black', { key: 'capband' });
    cut([[0, -s * .7], [s * 1.05, -s * .32], [0, s * .06], [-s * 1.05, -s * .32]], 'black', { key: 'capboard' });
    const tx = s * .62 + sw * 40, ty = -s * .1;
    brush([[0, -s * .32], [s * .62, -s * .36], [tx, ty + s * .3]], { w: 7, col: 'yellow', curv: .5, key: 'tassel' });
    dot(tx, ty + s * .36, 16, 'yellow', { key: 'tasseld' });
  }
  function shotUnity(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ seed: 17 });
    const X = 1380;
    // the cube drops and squashes, its paper shadow settling under it
    const d = seg(t, .55, .95), land = t - .95, sq = t > .95 ? .2 * Math.exp(-7 * land) * Math.cos(18 * land) : 0;
    const S = 250, cy = t < .55 ? -700 : t < .95 ? lerp(-500, 700, easeIn(d)) : 700;
    at(X, cy + S, 1 + sq, 1 - sq, 0, () => { push(); translate(0, -S); cube(S); pop(); });
    if (t > 1.9) {
      const cd = seg(t, 1.9, 2.3), capY = t < 2.3 ? lerp(-200, 540, easeIn(cd)) : 540 + 10 * spring(t, 2.3, 7, 20);
      at(X, capY, 1, 1, .04, () => cap(250, spring(t, 2.3, 3, 9)));
    }
    // a little star flies over the cube
    const sk = seg(t, 3.0, 3.9);
    if (sk > 0) { const p = arcPt([X - 420, 520], [X + 380, 400], 220, ease(sk)); at(p[0], p[1], 1, 1, sk * 4, () => star(0, 0, 38, 'yellow', { key: 'u-star', lift: 2 })); }
    head('FINAL PROJECT:', 100, 230, 88, t, .3, 'black');
    head('UNITY3D.', 96, 390, 190, t, .5, 'red', { rot: -.03 });
    strip('BUILT WHILE UNITY WAS', 112, 580, 40, t, 2.6, 'white', 'black');
    strip('A YOUNG DANISH STARTUP.', 112, 646, 40, t, 2.8, 'white', 'black', { rot: -.01 });
    strip('COMPUTER SCIENCE · 3 YEARS · BUSINESS ACADEMY WEST, ESBJERG', 112, 830, 28, t, 3.3, 'blue', 'white');
    const k = popIn(t, 3.2, .4);
    if (k > 0) at(1740, 290, k, k, .18, () => {
      dot(0, 0, 118, 'yellow', { key: 'cph' });
      type('CPH', 0, -26, 50, 'black', { key: 'cph', lift: .2 }); type('2004', 0, 30, 50, 'black', { key: '2004', lift: .2 });
      star(78, -84, 24, 'red', { key: 'cph-s' });
    });
    seams(lt, dur, SHEET(['yellow', 'red']), CUTR(['blue', 'red'], .12));
  }

  // ======================================================= AGENCY 17–22
  function gear(r, col, key) {
    const P = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, k = (i % 5 < 2) ? 1 : .78; P.push([Math.cos(a) * r * k, Math.sin(a) * r * k]); }
    cut(P, col, { key, hole: ellPts(0, 0, r * .3, r * .3, 20) });
  }
  function shotAgency(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ seed: 23 });
    const X = 1440, b1 = popIn(t, .45), b2 = popIn(t, .75), b3 = popIn(t, 1.05), rails = [X - 400, X + 400];
    if (t > 1.2) {
      const rk = ease(seg(t, 1.2, 1.6));
      for (const rx of rails) brush([[rx, 250], [rx, 880]], { w: 9, curv: 0, taper: .05, k: rk, key: 'rail' + rx });
      const ph = u => 1.2 * u + .9 * u * u, u = Math.max(0, t - 1.4);
      for (let i = 0; i < 6; i++) {
        const up = i % 2, k = frac(ph(u) * .55 + i / 6), y = up ? lerp(880, 250, k) : lerp(250, 880, k), rx = rails[up];
        at(rx, y, 1, 1, 0, () => dot(0, 0, 22, i % 3 === 0 ? 'red' : 'yellow', { key: 'pk' + (i % 3), lift: 1.6 }));
      }
    }
    at(X, 250, b1, b1, -.02, () => {
      cut(rrPts(-330, -150, 660, 300, 20), 'white', { key: 'brw' });
      cut(rrPts(-330, -150, 660, 56, 20), 'blue', { key: 'brbar', lift: .4 });
      ['red', 'yellow', 'green'].forEach((c, i) => dot(-292 + i * 34, -122, 11, c, { key: 'brd' + i, lift: .2 }));
      cut(rrPts(-290, -64, 240, 180, 10), 'yellow', { key: 'brimg', lift: .4 });
      dot(-170, 10, 42, 'red', { key: 'brsun', lift: .3 });
      for (let i = 0; i < 4; i++) brush([[-10, -40 + i * 46], [250 - i * 40, -40 + i * 46]], { w: 9, curv: 0, taper: .1, key: 'brl' + i });
    });
    at(X, 565, b2, b2, .015, () => {
      cut(rrPts(-330, -90, 660, 180, 20), 'red', { key: 'api' });
      at(-200, 0, 1, 1, t * 2.4, () => gear(64, 'yellow', 'g1'));
      at(-96, 36, 1, 1, -t * 3.9, () => gear(40, 'yellow', 'g2'));
      type('API', 150, 8, 96, 'white', { key: 'api', lift: .4 });
    });
    at(X, 880, b3, b3, -.01, () => {
      for (const [yy, k] of [[70, 'db3'], [0, 'db2'], [-70, 'db1']]) { cut(rrPts(-200, yy - 45, 400, 100, 30), 'green', { key: k + 'b' }); cut(ellPts(0, yy - 45, 200, 42, 40), 'green', { key: k, tone: .7 }); }
    });
    // speed lines once it's really going: short brush strokes streaming past
    const sp = seg(t, 3.0, 4.0);
    if (sp > 0) for (let i = 0; i < 6; i++) {
      const y = 380 + i * 80 + 20 * hash(i), x0 = 1000 - ((t * 900 + hash(i) * 700) % 700), len = 200 * (0.6 + .4 * hash(i + 3));
      at(x0, y, 1, 1, 0, () => brush([[0, 0], [len, 0]], { w: 8, curv: 0, taper: .6, key: 'spd' + i, k: sp }));
    }
    head('FULL STACK,', 100, 300, 124, t, .3, 'blue', { rot: -.02 });
    head('FULL SPEED.', 100, 450, 124, t, 1.4, 'red', { rot: -.01 });
    strip('AT A YOUNG AGENCY.', 112, 620, 46, t, 1.9, 'yellow', 'black');
    seams(lt, dur, CUTR(['blue', 'red'], .12), SWEEP);
  }

  // ======================================================= ORBISCADA 22–33
  function turbine(h, ang, key) {
    cut([[-h * .05, 0], [h * .05, 0], [h * .022, -h], [-h * .022, -h]], 'white', { key: key + 't' });
    at(0, -h, 1, 1, ang, () => {
      for (let i = 0; i < 3; i++) at(0, 0, 1, 1, i * TAU / 3, () => cut([[h * .02, -h * .04], [h * .2, -h * .07], [h * .6, 0], [h * .18, h * .045]], 'white', { key: key + 'b' + i }));
      dot(0, 0, h * .055, 'red', { key: key + 'hub', lift: .5 });
    });
  }
  const FIELDS = [['DENMARK', 6, 'red'], ['UK', 5, 'blue'], ['USA', 6, 'green'], ['JAPAN', 4, 'black']];
  const FX = i => 110 + i * 440, FY = 470, FW = 400, FH = 400;
  const slot = (f, j) => { const r = Math.floor(j / 3), c = j % 3; return [FX(f) + 75 + c * 125 + (r % 2) * 20, FY + 190 + r * 180]; };
  const fieldT = f => 1.4 + [0, 1.2, 2.1, 2.9][f];
  function shotOrbis(T0, lt, dur) {
    const t = onTwos(lt), tb = t - 4.2;   // part B starts 4.2 s in
    collage({ seed: 29 });
    const pull = ease(seg(tb, 0, 1.1));
    // part A: a green hill; it sinks away as the turbine shrinks into Denmark
    if (pull < 1) at(1110, 1180 + 500 * pull, 1, 1, 0, () => blob(0, 0, 640, 'green', { seed: 21, squash: .4, lumps: .12 }));
    FIELDS.forEach(([name, n, col], f) => {
      const k = popIn(tb, .6 + f * .12, .5); if (k <= 0) return;
      at(FX(f) + FW / 2, FY + FH, 1, k, (hash(f + 2) - .5) * .04, () => cut(rrPts(-FW / 2, -FH, FW, FH, 28), col, { key: 'field' + f, torn: f === 3 ? true : null }));
      strip(name, FX(f) + FW / 2, FY + FH + 62, 36, tb, .8 + f * .12, 'white', 'black', { align: 'center', rot: (hash(f) - .5) * .06 });
      for (let j = 0; j < n; j++) {
        if (f === 0 && j === 0) continue;
        const p = popIn(tb, fieldT(f) + j * (f === 0 ? .12 : .09), .35); if (p <= 0) continue;
        const [x, y] = slot(f, j);
        at(x, y, p, p, 0, () => turbine(118, tb * 4 + hash(j + f * 20) * 6, 'st'));
      }
    });
    // the big turbine rises (part A), then shrinks into its slot in Denmark (part B)
    const rise = popIn(t, .5, .6), [sx, sy] = slot(0, 0), bx = lerp(1110, sx, pull), by = lerp(900, sy, pull), sc = lerp(1, 118 / 560, pull) * rise;
    const spin = t < 1.1 ? 0 : 1.6 * (t - 1.1) + .35 * (t - 1.1) * (t - 1.1);
    if (sc > .01) at(bx, by, sc, sc, 0, () => turbine(560, spin + .3, pull > .5 ? 'st' : 'big'));
    head('ORBISCADA', 100, 170, 132, t, .3, 'blue', { rot: -.02 });
    strip('FREELANCE · 5 YEARS', 112, 290, 36, t, 1.0, 'yellow', 'black');
    strip('SCADA FOR WIND TURBINES', 112, 352, 36, t, 1.15, 'white', 'black');
    // the counter: 1 → 1,500+ (letters keyed by position, so each digit stays the same piece of paper)
    if (t > 1.8) {
      const v = tb < 1.2 ? 1 : Math.round(lerp(1, 1500, ease(seg(tb, 1.2, 5.2)))), done = tb > 5.2;
      const txt = (v >= 1000 ? Math.floor(v / 1000) + ',' + String(v % 1000).padStart(3, '0') : String(v)) + (done ? '+' : '');
      const bump = done ? 1 + .12 * spring(tb, 5.2, 6, 16) : 1;
      at(1820, 190, bump, bump, 0, () => head(txt, 0, 0, 170, t, 1.8, 'red', { align: 'right', key: 'counter', jig: .04, d: .3 }));
      strip(v === 1 ? 'TURBINE · DENMARK' : 'TURBINES · 4 COUNTRIES', 1815, 312, 32, t, 2.0, 'white', 'black', { align: 'right' });
    }
    // Børsen Gazelle 2018: a red rosette star is pasted on
    const r = popIn(tb, 5.1, .45);
    if (r > 0) at(1010, 190, r, r, -.1, () => {
      cut([[-40, 40], [-80, 180], [-40, 158], [-10, 192], [0, 50]], 'blue', { key: 'rib1' });
      cut([[40, 40], [80, 180], [40, 158], [10, 192], [0, 50]], 'blue', { key: 'rib2' });
      cut(starPts(0, 0, 118, .82, 16), 'red', { key: 'rosette' });
      dot(0, 0, 86, 'yellow', { key: 'ros-in', lift: .5 });
      type('GAZELLE', 0, -18, 30, 'black', { key: 'gz', lift: .2, face: 'rubik', jig: .02 }); type('2018', 0, 24, 46, 'black', { key: 'gz18', lift: .2 });
    });
    strip('ORBITAL · BØRSEN GAZELLE 2018', 1010, 350, 30, tb, 5.35, 'white', 'black', { align: 'center' });
    strip('MANUFACTURING · CENTRAL JUTLAND', 1010, 410, 26, tb, 5.5, 'yellow', 'black', { align: 'center', rot: .01 });
    seams(lt, dur, SWEEP, SHEET(['yellow', 'night']));
  }

  // ======================================================= CLOVR 33–40 (night)
  const NODES = [[700, 700], [930, 520], [960, 880], [1180, 690], [1160, 400], [1400, 540], [1380, 900], [1620, 700], [1600, 370], [1760, 540], [1700, 870], [520, 930], [1360, 240]];
  const EDGES = [[0, 1], [0, 2], [0, 11], [1, 3], [1, 4], [2, 3], [2, 6], [3, 5], [4, 5], [4, 12], [5, 8], [5, 7], [6, 7], [7, 9], [7, 10], [8, 9], [12, 8], [3, 6], [11, 2], [9, 10]];
  const PATH = [11, 0, 1, 3, 5, 7, 10], HOP = .58, TR0 = 1.8;
  function shotClovr(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ ground: 'night', seed: 37 });
    scatter(12, [700, 60, 1200, 200], 9, (x, y, i, h) => dot(x, y, 4 + 5 * h, 'white', { key: 'cs' + i, lift: .3 }));
    const hops = clamp((t - TR0) / HOP, 0, PATH.length - 1);
    EDGES.forEach(([a, b], i) => brush([NODES[a], NODES[b]], { w: 4, col: 'white', curv: 0, taper: .05, k: ease(seg(t, .4 + i * .03, .9 + i * .03)), key: 'e' + i, alpha: .8 }));
    // the trace, painted red hop by hop
    for (let h = 0; h < PATH.length - 1; h++) {
      const k = clamp(hops - h); if (k <= 0) break;
      brush([NODES[PATH[h]], NODES[PATH[h + 1]]], { w: 14, col: 'red', curv: 0, taper: .1, k, key: 'tr' + h });
    }
    NODES.forEach(([x, y], i) => {
      const k = popIn(t, .3 + hash(i) * .6, .4), onPath = PATH.indexOf(i), hit = onPath >= 0 && hops >= onPath;
      const s = k * (hit ? 1 + .25 * spring(t, TR0 + onPath * HOP, 6, 16) : 1);
      at(x, y, s, s, 0, () => { dot(0, 0, i % 3 ? 30 : 40, hit ? 'yellow' : 'white', { key: 'n' + (i % 3) }); hoop(0, 0, i % 3 ? 16 : 22, 6, hit ? 'red' : 'blue', { key: 'nh' + (i % 3), lift: .3 }); });
    });
    // a Miró eye rides the head of the trace, looking where it's going
    const hi = Math.min(PATH.length - 2, Math.floor(hops)), hk = hops - hi, A = NODES[PATH[hi]], B = NODES[PATH[hi + 1]];
    const mg = popIn(t, TR0 - .3, .4), found = t > TR0 + (PATH.length - 1) * HOP, tf = t - (TR0 + (PATH.length - 1) * HOP);
    if (mg > 0) {
      const ex = lerp(A[0], B[0], ease(hk)) + 20, ey = lerp(A[1], B[1], ease(hk)) - 110, dx = B[0] - A[0], dy = B[1] - A[1], dd = Math.hypot(dx, dy) || 1;
      at(ex, ey, mg, mg, 0, () => eye(0, 0, 78, { iris: 'blue', look: found ? [.2, .9] : [dx / dd, dy / dd], key: 'clv', blink: Math.max(0, 1 - Math.abs(t - 1.2) / .1) }));
    }
    if (found) {
      const [x, y] = NODES[PATH[PATH.length - 1]], k = popIn(tf, 0, .45);
      at(x, y, k, k, tf * .5, () => star(0, 0, 90, 'yellow', { key: 'found', lift: 1.6 }));
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3, r = 150 * k; at(x + Math.cos(a) * r, y + Math.sin(a) * r, k, k, 0, () => asterisk(0, 0, 22, { col: 'white', key: 'fa' + i })); }
    }
    head('FOLLOWING', 100, 190, 136, t, .3, 'yellow', { rot: -.02 });
    head('THE MONEY.', 100, 340, 136, t, .5, 'white', { rot: -.01 });
    strip('CLOVR LABS', 112, 480, 46, t, 1.1, 'yellow', 'black');
    strip('CRYPTO FORENSIC ANALYTICS', 112, 552, 34, t, 1.25, 'white', 'black', { rot: -.01 });
    seams(lt, dur, SHEET(['yellow', 'night']), SHEET(['yellow', 'blue'], 'left'));
  }

  // ======================================================= N0 40–45
  const WX = 720, WY = 360, WW = 1090, WH = 640, SLOTS = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) SLOTS.push([WX + 185 + c * 360, WY + 180 + r * 165]);
  const TOKENS = ['person', 'agent', 'app', 'app2', 'person', 'agent', 'agent', 'app', 'person'];
  function token(kind) {
    if (kind === 'person') { cut(blobPts(0, 44, 58, { seed: 2, lumps: .08, squash: .6 }), 'blue', { curv: true, key: 'pbody' }); dot(0, -22, 32, 'blue', { key: 'phead' }); }
    if (kind === 'agent') { star(0, 0, 66, 'yellow', { key: 'agent' }); dot(0, 4, 9, 'black', { key: 'agent-eye', lift: 0 }); }
    if (kind === 'app' || kind === 'app2') {
      cut(rrPts(-62, -54, 124, 108, 18), kind === 'app' ? 'red' : 'green', { key: kind });
      cut(rrPts(-40, -32, 34, 28, 6), 'white', { key: 'a1', lift: .2 }); cut(rrPts(6, -32, 34, 28, 6), 'white', { key: 'a2', lift: .2 }); cut(rrPts(-40, 6, 80, 26, 6), 'white', { key: 'a3', lift: .2 });
    }
  }
  function shotN0(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ seed: 41 });
    const wk = popIn(t, .5, .5);
    at(WX + WW / 2, WY + WH / 2, wk, wk, .01, () => {
      cut(rrPts(-WW / 2, -WH / 2, WW, WH, 24), 'white', { key: 'win' });
      cut(rrPts(-WW / 2, -WH / 2, WW, 70, 24), 'red', { key: 'winbar', lift: .4 });
      ['yellow', 'white', 'blue'].forEach((c, i) => dot(-WW / 2 + 42 + i * 36, -WH / 2 + 35, 12, c, { key: 'wd' + i, lift: .2 }));
      type('n0', WW / 2 - 64, -WH / 2 + 36, 50, 'white', { key: 'n0', lift: .3, face: 'rubik', jig: .02 });
    });
    const all = t > 3.4 ? 1 + .08 * spring(t, 3.4, 5, 16) : 1;
    TOKENS.forEach((kind, i) => {
      const t0 = 1.1 + i * .22, k = seg(t, t0, t0 + .45); if (k <= 0) return;
      const [x, y] = SLOTS[i], from = [i % 2 ? 2300 : -300, 100 + 900 * hash(i + 4)];
      const p = k < 1 ? arcPt(from, [x, y], 260, easeOut(k)) : [x, y];
      const s = (k < 1 ? .8 : 1 + .15 * spring(t, t0 + .45, 7, 18)) * all;
      push(); translate(p[0], p[1]); scale(s); rotate(k < 1 ? (1 - k) * (i % 2 ? -1 : 1) : 0); token(kind); pop();
    });
    // a cameo: Rasmus pops up in the corner of the workspace
    const mk = popIn(t, 3.0, .45);
    if (mk > 0) at(560, 1085, mk, mk, -.03, () => pasteMe(lt + T0, 0, 0, 470));
    head('THE WORKSPACE', 100, 160, 110, t, .3, 'blue', { rot: -.02 });
    head('OF THE FUTURE.', 100, 280, 110, t, .5, 'red', { rot: -.01 });
    strip('PEOPLE, AGENTS', 112, 440, 38, t, 1.3, 'white', 'black');
    strip('AND APPS IN', 112, 504, 38, t, 1.4, 'white', 'black');
    strip('ONE PLACE.', 112, 568, 38, t, 1.5, 'yellow', 'black');
    const u = popIn(t, 2.9, .4);
    if (u > 0) at(1810, 290, u, u, .04, () => label('nzero.pro', 0, 0, 44, 'white', { align: 'right', bg: 'blue' }));
    seams(lt, dur, SHEET(['yellow', 'blue'], 'left'), CUTR(['yellow', 'green'], -.1));
  }

  // ======================================================= WORKSHOP 45–53
  const PROJECTS = ['n0', 'Claude Agent SDK Go', 'Gource Viewer', 'Gitilla', 'Codex SDK Go', 'wee.cat', 'Donna', 'The Agentic Crew', 'Hefty'];
  const CARD = [['yellow', 'black'], ['red', 'white'], ['blue', 'white'], ['white', 'black'], ['green', 'white'], ['red', 'white'], ['white', 'black'], ['yellow', 'black'], ['blue', 'white']];
  function shotWorkshop(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ seed: 47 });
    PROJECTS.forEach((name, i) => {
      const r = Math.floor(i / 3), c = i % 3, x = 130 + c * 575 + 262, y = 352 + r * 232 + 100, t0 = 1.15 + i * .47;
      if (t < t0) return;
      // each tag is carried in, lifted high (big soft shadow), and pressed down onto the ground
      const k = seg(t, t0, t0 + .3), s = t < t0 + .3 ? lerp(1.35, 1, easeIn(k)) : 1 - .05 * spring(t, t0 + .3, 7, 20);
      const lift = t < t0 + .3 ? lerp(3, 1, easeIn(k)) : 1, bob = t > 5.9 ? .05 * pulse(t - 5.9 + i * .07, 5) * (i % 2 ? 1 : -1) : 0;
      const rot = (hash(i + 5) - .5) * .08 + bob, [bg, fg] = CARD[i];
      at(x, y, s, s, rot, () => {
        cut(rrPts(-262, -100, 524, 200, 18), bg, { key: 'card' + i, lift, torn: i === 3 || i === 7 ? [0] : null });
        type(String(i + 1).padStart(2, '0'), -224, -62, 28, fg, { align: 'left', key: 'num' + i, face: 'rubik', lift: .2, jig: .01 });
        const size = Math.min(60, 60 * 440 / textWidth(name, 60, {}));
        const face = name === 'n0' ? 'rubik' : undefined, sz = face ? size * 1.15 : size;
        type(name, 0, 18, sz, fg, { key: 'nm' + i, lift: .3, jig: .04, face });
        const h = hash(i * 3 + 1), mx = 214, my = -58;
        if (h < .33) star(mx, my, 20, fg === 'white' ? 'yellow' : 'red', { key: 'cs' + i, lift: .3 });
        else if (h < .66) dot(mx, my, 12, fg === 'white' ? 'yellow' : 'blue', { key: 'cd' + i, lift: .3 });
        else asterisk(mx, my, 18, { col: fg, key: 'ca' + i });
      });
    });
    head('ALWAYS BUILDING.', 100, 150, 110, t, .3, 'blue', { rot: -.02 });
    head('ALWAYS SHIPPING.', 100, 268, 110, t, .6, 'red', { rot: -.01 });
    seams(lt, dur, CUTR(['yellow', 'green'], -.1), FLOOD(960, 560));
  }

  // ======================================================= END 53–60
  function kite(x, y, r) {
    brush([[x, y + 70], [x - 60, y + 300], [x + 30, y + 560], [x - 40, y + 1000]], { w: 4, curv: .5, taper: .02, key: 'string' });
    for (let i = 0; i < 3; i++) at(x - 30 + i * 8, y + 180 + i * 90, 1, 1, .6 * (i % 2 ? 1 : -1), () => { const c = i % 2 ? 'yellow' : 'red'; cut([[-26, -14], [0, 0], [-26, 14]], c, { key: 'bowl' + i, lift: .6 }); cut([[26, -14], [0, 0], [26, 14]], c, { key: 'bowr' + i, lift: .6 }); });
    at(x, y, 1, 1, r, () => {
      cut([[0, -80], [56, 0], [0, 80]], 'red', { key: 'kiteR' });
      cut([[0, -80], [0, 80], [-56, 0]], 'yellow', { key: 'kiteL' });
      brush([[0, -80], [0, 80]], { w: 4, curv: 0, key: 'kx' }); brush([[-56, 0], [56, 0]], { w: 4, curv: 0, key: 'ky' });
    });
  }
  function guitar(s) {
    cut(rectPts(38, -150, 30, 150), 'brown', { key: 'neck' });
    cut(rectPts(30, -190, 46, 50), 'black', { key: 'head' });
    dot(52, 20, 70, 'blue', { key: 'gbody1' }); dot(52, -60, 52, 'blue', { key: 'gbody2' });
    dot(52, -20, 22, 'black', { key: 'ghole', lift: 0 });
    for (let i = 0; i < 3; i++) brush([[46 + i * 6, -180], [46 + i * 6, 60]], { w: 2, col: 'white', curv: 0, taper: 0, key: 'str' + i });
  }
  function note(x, y, s, key) {
    at(x, y, s, s, 0, () => { brush([[14, 0], [14, -70]], { w: 6, curv: 0, taper: .1, key: key + 's' }); brush([[14, -70], [40, -52]], { w: 6, curv: 0, taper: .3, key: key + 'f' }); cut(ellPts(0, 0, 18, 13, 20, 0, -.4), 'black', { key: key + 'h' }); });
  }
  function shotEnd(T0, lt, dur) {
    const t = onTwos(lt);
    collage({ seed: 5 });
    const cx = END_X, O = [cx + 10, 745, 580, 150, -.12];
    dot(cx + 10, 430, 330, 'red', { key: 'sun' });
    orbit(O, 1, t + 2, 'back');
    pasteMe(lt + T0, cx, 1085, 900);
    at(1900, 1120, 1, 1, 0, () => blob(0, 0, 420, 'green', { seed: 11, squash: .6, lumps: .15 }));
    at(1300, 1150, 1, 1, 0, () => blob(0, 0, 560, 'blue', { seed: 4, squash: .42, lumps: .14 }));
    orbit(O, 1, t + 2, 'front');
    head('SERIOUS CODE.', 100, 280, 112, t, .4, 'blue', { rot: -.02 });
    head('CLEAR THINKING.', 100, 410, 112, t, .9, 'red', { rot: -.01 });
    strip('RASMUS SCHLÜNSEN', 112, 570, 56, t, 2.2, 'black', 'white', { rot: -.015 });
    const b = popIn(t, 2.6, .4);
    if (b > 0) at(118, 668, b, b, 0, () => { dot(18, 0, 16, 'red', { key: 'bcn' }); type('BARCELONA', 50, 3, 48, 'black', { align: 'left', key: 'bcn', face: 'rubik', jig: .02, lift: .4 }); });
    // off the clock: a kite, a little guitar and some notes, among the stars
    const kk = popIn(t, 3.3, .5);
    if (kk > 0) at(1800, 120 + 8 * wob(t, .4), kk, kk, 0, () => kite(0, 0, .12 * wob(t, .3)));
    const gk = popIn(t, 3.6, .45);
    if (gk > 0) at(640, 930, gk * .85, gk * .85, -.5, () => guitar());
    for (let i = 0; i < 3; i++) { const tn = t - 3.9 - i * .5; if (tn > 0) note(760 + i * 70 + 20 * Math.sin(tn * 2 + i), 860 - 60 * Math.min(tn, 2.4) - i * 20, popIn(tn, 0, .35) * .7, 'nt' + i); }
    at(420, 860, popIn(t, 3.1), popIn(t, 3.1), .3, () => star(0, 0, 36, 'yellow', { key: 'e-s1' }));
    at(980, 520, popIn(t, 3.4), popIn(t, 3.4), 0, () => asterisk(0, 0, 30, { key: 'e-a1' }));
    seams(lt, dur, FLOOD(960, 560), null);
  }

  shots([[0, shotOpen], [6, shotSecurity], [12, shotUnity], [17, shotAgency], [22, shotOrbis], [33, shotClovr], [40, shotN0], [45, shotWorkshop], [53, shotEnd]]);
})();
