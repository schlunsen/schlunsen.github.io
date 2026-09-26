// career.js: Rasmus Schlünsen, a 60-second painted career reel. See STORYBOARD.md.
// Every shot is a pure function of time. Backgrounds are baked once (still, no boil); object linework boils at
// PROJECT.boil (4×/s) with small jitter, and watercolour fills use still seeds so they never re-randomise.
(() => {
  const P = PAL;
  const WIPE = {
    open: [P.clayDk, P.clay], security: [P.indigo, P.violet], unity: [P.violet, P.sky], agency: [P.teal, P.sap],
    orbiscada: [P.sap, P.sky], clovr: [P.ochre, P.clay], n0: [P.indigo, P.teal], workshop: [P.rose, P.ochre], end: [P.clayDk, P.clay],
  };

  // ---------- helpers ----------
  const popIn = (t, t0, d = .45) => t < t0 ? 0 : backOut(seg(t, t0, t0 + d));
  const J = 1.4;                                   // default point jitter (px): gentle boil
  function scaled(x, y, sx, sy, fn) { if (sx <= .001 || sy <= .001) return; push(); translate(x, y); scale(sx, sy); fn(); pop(); }
  // prefix of a polyline by arc length, k = 0..1
  function partial(Pts, k) {
    if (k >= 1) return Pts; if (k <= 0) return [];
    let L = 0; const d = [0]; for (let i = 1; i < Pts.length; i++) { L += Math.hypot(Pts[i][0] - Pts[i - 1][0], Pts[i][1] - Pts[i - 1][1]); d.push(L); }
    const tgt = L * k, out = [Pts[0]];
    for (let i = 1; i < Pts.length; i++) {
      if (d[i] <= tgt) out.push(Pts[i]);
      else { const f = (tgt - d[i - 1]) / (d[i] - d[i - 1] || 1); out.push([lerp(Pts[i - 1][0], Pts[i][0], f), lerp(Pts[i - 1][1], Pts[i][1], f)]); break; }
    }
    return out;
  }
  const lineK = (a, b, k) => [a, [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]];
  function drawLine(Pts, k, sw, col = P.ink, br = 'ink', curv = .5) {
    const q = partial(Pts, k); if (q.length < 2) return;
    let L = 0; for (let i = 1; i < q.length; i++) L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    if (L > 3) inkLine(q, sw, col, br, curv);
  }
  // measure lettering width
  function tw(txt, size) { const c = letG.drawingContext; c.font = `${size}px "Permanent Marker", cursive`; return c.measureText(txt).width; }
  // A hand-lettered headline line: pops in with overshoot (screen space, so it holds still while the camera moves).
  function head(txt, x, y, size, t, t0, col = P.ink, o = {}) {
    if (t < t0) return;
    letter(txt, x, y, size, col, { pop: (t - t0) * 2.4, align: o.align || 'left', rot: o.rot ?? -.015, screen: true, ink: o.ink ?? (col !== P.ink), alpha: o.alpha });
  }
  // painted underline swash that draws on under a headline
  function swash(x0, y, w, t, t0, col, d = .5, key = 'sw') {
    const k = easeOut(seg(t, t0, t0 + d)); if (k <= 0) return;
    const pts = []; for (let i = 0; i <= 12; i++) pts.push([x0 + w * i / 12, y + Math.sin(i * .7) * 4 - i * .6]);
    const q = partial(pts, k); if (q.length < 2) return;
    boilSeed(key); paint(ribbon(q, 13, 5), { wash: col, ink: null });
  }
  // A baked, still background drawn in screen space with a small parallax drift (s >= 1.03 hides the edges).
  function bg(img, dx = 0, dy = 0, s = 1.04) { push(); translate(W / 2 + dx, H / 2 + dy); scale(s); image(img, -W / 2, -H / 2, W, H); pop(); }
  const FULL = () => rectPts(-40, -40, W + 80, H + 80);
  // chapter seams: brush wipe in (drag-off) and out (cover), in screen space, over the lettering
  function seams(lt, dur, cin, cout) {
    flushLetters();
    if (cin && lt < .3) brushWipe(.5 + lt / .6, cin);
    if (cout && lt > dur - .3) brushWipe((lt - (dur - .3)) / .6, cout);
  }
  // a block: rounded rect with a darker side band for flat 2D depth
  function block(x, y, w, h, col, sw = 1.1) {
    paint(rrPts(x - w / 2, y - h, w, h, 10, J), { wash: col, ink: P.ink, sw });
    paint(rrPts(x - w / 2 + 6, y - h * .28, w - 12, h * .22, 6, .6), { wash: mixCol(col, P.ink, .22), washOp: 110, ink: null });
  }
  // "n0" logotype: Permanent Marker is all caps, so paint the zero (narrow, slashed) so it never reads "NO".
  // (x, y) = centre of the mark, rot = rotation, k = pop scale.
  function n0mark(x, y, size, col, k = 1, rot = 0, o = {}) {
    if (k <= 0) return;
    const nW = tw('N', size), zw = size * .44, total = nW + size * .12 + zw, c = Math.cos(rot), sn = Math.sin(rot);
    const at = d => [x + c * (d - total / 2), y + sn * (d - total / 2)];
    const [nx, ny] = at(nW / 2);
    letter('N', nx, ny, size * k, col, { align: 'center', ink: false, rot, screen: o.screen });
    const [zx, zy] = at(nW + size * .12 + zw / 2), rx = zw / 2 * k, ry = size * .34 * k;
    boilSeed('n0' + x);
    push(); translate(zx, zy); rotate(rot);
    paint(ellPts(0, 0, rx, ry, 22, .4), { ink: col, sw: size / 55 });
    inkLine([[-rx * .75, ry * .62], [rx * .75, -ry * .62]], size / 75, col, 'ink', 0);
    pop();
  }
  function orbitLogo(cx, cy, r, t, k = 1, o = {}) {
    // circle + two turning ellipses + dot (the site's mark)
    const ring = ellPts(cx, cy, r, r, 48, 0);
    ring.push(ring[0]);
    drawLine(ring, k, o.sw || 1.3, o.col || P.clayDk, 'ink', .5);
    const e1 = ellPts(cx, cy, r * .55, r * .95, 40, 0, .6 + t * .2); e1.push(e1[0]);
    const e2 = ellPts(cx, cy, r * .8, r * .95, 40, 0, -.5 - t * .15); e2.push(e2[0]);
    drawLine(e1, k * 1.1 - .1, (o.sw || 1.3) * .8, o.col || P.clayDk, 'ink', .5);
    drawLine(e2, k * 1.2 - .2, (o.sw || 1.3) * .8, o.col || P.clayDk, 'ink', .5);
    const dk = popIn(k, .9, .1);
    if (dk > 0) paint(ellPts(cx - r * .3, cy, r * .07 * dk, r * .07 * dk, 14), { wash: o.dot || P.clay, ink: null });
  }

  // =====================================================================================================
  // OPEN 0–6: a tower of blocks stacks up, the orbit ring draws on around it
  // =====================================================================================================
  const BLOCKS = [[400, 140, P.indigo, .35], [330, 128, P.teal, .7], [270, 116, P.ochre, 1.05], [210, 104, P.clay, 1.4]];
  function drop(t, t0, h = 700, d = .32) {
    if (t < t0) return null;
    if (t < t0 + d) { const k = easeIn(seg(t, t0, t0 + d)); return { dy: -h * (1 - k), sq: -.08 * k }; }
    const a = t - t0 - d; return { dy: 0, sq: .22 * Math.exp(-7 * a) * Math.cos(18 * a) };
  }
  function shotOpen(t, lt, dur) {
    const bgi = bake('open', () => {
      paint(ellPts(1400, 560, 700, 460, 40, 0), { fill: P.clay, fillOp: 60, bleed: .25, tex: .5, ink: null });
      paint(ellPts(1650, 300, 360, 260, 30, 0), { fill: P.ochre, fillOp: 55, bleed: .3, tex: .5, ink: null });
      paint(ellPts(300, 900, 520, 240, 30, 0), { fill: P.sky, fillOp: 35, bleed: .3, tex: .5, ink: null });
    });
    bg(bgi, -8 * lt, 0, 1.05);
    camBegin(960 + 14 * Math.sin(lt * .5), 540, 1 + .06 * ease(lt / dur));
    const cx = 1470, gy = 900;
    boilSeed('shadow'); paint(ellPts(cx, gy + 6, 290, 30, 24, 1), { wash: P.ink, washOp: 40, ink: null });
    // orbit back half (behind the tower)
    const ok = ease(seg(t, 3.3, 4.6)), orb = (rx, ry, rot, a0, a1) => { const p = []; for (let i = 0; i <= 30; i++) { const a = lerp(a0, a1, i / 30); p.push([cx + Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * ry * Math.sin(rot), 650 + Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * ry * Math.cos(rot)]); } return p; };
    boilSeed('orbB'); drawLine(orb(390, 118, -.16, Math.PI, TAU), ok, 1.2, P.clayDk);
    const planetA = t * 1.3, pp = orb(390, 118, -.16, planetA, planetA)[0], behind = Math.sin(planetA) < 0;
    const pk = popIn(t, 4.3, .5);
    const planet = () => { if (pk > 0) { boilSeed('planet'); paint(ellPts(pp[0], pp[1], 20 * pk, 20 * pk, 16, .8), { wash: P.ochre, ink: P.ink, sw: .9 }); } };
    if (behind) planet();
    // tower
    let y = gy;
    BLOCKS.forEach(([w, h, col, t0], i) => {
      const d = drop(t, t0); const yy = y; y -= h;
      if (!d) return;
      boilSeed('blk' + i);
      scaled(cx, yy + d.dy, 1 + d.sq, 1 - d.sq, () => block(0, 0, w, h, col));
    });
    // the spark on top: "what's next"
    const sk = popIn(t, 2.5, .5);
    if (sk > 0) { boilSeed('spark'); const r = 58 * sk * (1 + .06 * Math.sin(t * 5)); paint(starPts(cx, y - 60, r, .38, 4, t * .4), { wash: P.cream, ink: P.clayDk, sw: 1 }); }
    // orbit front half
    boilSeed('orbF'); drawLine(orb(390, 118, -.16, 0, Math.PI), ok, 1.4, P.clayDk);
    if (!behind) planet();
    camEnd();
    head('Fifteen years.', 130, 410, 124, t, 1.1);
    head("Building what's next.", 134, 550, 92, t, 2.2, P.clay);
    swash(140, 612, tw("Building what's next.", 92) * .96, t, 2.6, P.ochre);
    head('Software & systems, built to last.', 138, 700, 40, t, 3.6, P.teal, { ink: false });
    flushLetters();
    if (lt < .45) brushWipe(.5 + lt / .9, WIPE.open);
    seams(lt, dur, null, WIPE.security);
  }

  // =====================================================================================================
  // SECURITY 6–12: a key flies in, turns, the padlock springs open
  // =====================================================================================================
  const HEX = Array.from({ length: 34 }, (_, i) => ({ x: hash(i * 3.1) * W, y: hash(i * 7.7) * H, s: 26 + 20 * hash(i * 1.3), v: .15 + .3 * hash(i * 5.2) }));
  function shotSecurity(t, lt, dur) {
    const bgi = bake('security', () => {
      paint(FULL(), { wash: mixCol(P.indigo, P.ink, .25), ink: null });
      paint(ellPts(1250, 560, 620, 440, 36, 0), { fill: P.violet, fillOp: 80, bleed: .25, tex: .6, ink: null });
      paint(ellPts(260, 900, 500, 260, 30, 0), { fill: P.indigo, fillOp: 90, bleed: .3, tex: .5, ink: null });
    });
    bg(bgi, 0, -6 * lt, 1.05);
    // drifting hex bytes (faint)
    HEX.forEach((h, i) => {
      const yy = ((h.y - lt * 30 * h.v * 3) % (H + 100) + H + 100) % (H + 100) - 50;
      const v = Math.floor(hash(i * 9.1 + Math.floor(lt * 1.5 + hash(i) * 3)) * 255).toString(16).toUpperCase().padStart(2, '0');
      if (h.x < 820 && yy < 330) return;   // keep the headline clear
      letter(v, h.x, yy, h.s, mixCol(P.indigo, P.sky, .45), { screen: true, ink: false, alpha: .55 });
    });
    flushLetters();
    const push0 = ease(seg(lt, 0, dur));
    camBegin(lerp(960, 1120, push0), lerp(540, 600, push0), 1 + .1 * push0);
    const lx = 1250, ly = 600, open = t < 9.0 ? 0 : 1 - Math.exp(-(t - 9.0) * 7) * Math.cos((t - 9.0) * 16) * .6, jolt = spring(t, 9.0, 7, 22) * 10;
    // glow behind the lock when it opens
    if (t > 9.0) glow(lx, ly - 60, 330 * ease(seg(t, 9.0, 9.4)), '#FFD27A', .9 * (1 - .4 * seg(t, 9.6, 11.5)));
    // shackle: lifts and swings about its right leg
    boilSeed('shackle');
    push(); translate(lx + 115, ly - 40 + jolt * .3); rotate(-.55 * clamp(open, 0, 1.3)); translate(0, -70 * clamp(open, 0, 1.2));
    const sh = []; for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; sh.push([-115 + Math.cos(a) * 115, -40 + Math.sin(a) * 150]); }
    paint(ribbon([[-230, 60], ...sh, [0, 60]], 50, 50), { wash: mixCol(P.cream, P.sky, .35), ink: P.ink, sw: 1.2 });
    pop();
    // body
    boilSeed('lock');
    push(); translate(0, jolt);
    paint(rrPts(lx - 200, ly - 60, 400, 320, 44, J), { wash: P.ochre, ink: P.ink, sw: 1.3 });
    paint(rrPts(lx - 180, ly + 180, 360, 50, 20, .6), { wash: mixCol(P.ochre, P.clayDk, .45), washOp: 150, ink: null });
    paint(rrPts(lx - 170, ly - 40, 340, 26, 12, .6), { wash: P.cream, washOp: 90, ink: null });
    // keyhole
    paint(ellPts(lx, ly + 70, 34, 34, 20, .8), { wash: P.ink, ink: null });
    paint([[lx - 16, ly + 80], [lx + 16, ly + 80], [lx + 26, ly + 170], [lx - 26, ly + 170]], { wash: P.ink, ink: null });
    pop();
    // the key: arcs in, shrinks into the hole, then turns (a drawn turn: its head narrows to edge-on)
    const fk = ease(seg(t, 6.9, 8.0)), turnK = ease(seg(t, 8.3, 8.8));
    if (t > 6.8) {
      const [kx, ky] = arcPt([380, 980], [lx, ly + 40], 380, fk), sc = lerp(1.4, 1.15, fk), rot = lerp(-2.2, 0, easeOut(seg(t, 6.9, 7.9)));
      const ins = ease(seg(t, 7.9, 8.25)), sx = lerp(1, .4, turnK);
      boilSeed('key');
      push(); translate(kx, ky + ins * 20 + jolt); rotate(rot); scale(sc * sx, sc);
      const shaftLen = lerp(170, 60, ins);
      paint(rrPts(-13, 0, 26, shaftLen, 8, .8), { wash: P.cream, ink: P.ink, sw: 1 });
      if (ins < .8) paint([[13, shaftLen - 60], [44, shaftLen - 60], [44, shaftLen - 40], [30, shaftLen - 40], [30, shaftLen - 22], [13, shaftLen - 22]], { wash: P.cream, ink: P.ink, sw: .9 });
      paint(ellPts(0, -44, 62, 62, 28, J), { wash: P.clay, ink: P.ink, sw: 1.2 });
      paint(ellPts(0, -54, 20, 20, 16, .5), { wash: mixCol(P.indigo, P.ink, .25), ink: P.ink, sw: .8 });
      pop();
    }
    // sparks when it opens
    if (t > 9.0) for (let i = 0; i < 8; i++) {
      const q = seg(t, 9.0 + i * .03, 9.7 + i * .03), a = -Math.PI / 2 + (i - 3.5) * .38;
      if (q > 0 && q < 1) { boilSeed('spk' + i); paint(starPts(lx + 115 + Math.cos(a) * 300 * q, ly - 200 + Math.sin(a) * 240 * q, 26 * backOut(q) * (1 - q * .6), .3, 4, q * 2), { wash: P.cream, washOp: 255 * (1 - q * q), ink: null }); }
    }
    camEnd();
    head('It started with security.', 120, 170, 90, t, 6.35, P.cream);
    const bk = popIn(t, 7.0, .5);
    if (bk > 0) { boilSeed('badge'); scaled(205, 268, bk, bk, () => paint(rrPts(-82, -34, 164, 68, 30, 1), { wash: P.ochre, ink: P.ink, sw: 1 })); }
    head('2010', 205, 270, 48, t, 7.1, P.ink, { align: 'center', ink: false, rot: -.04 });
    seams(lt, dur, WIPE.security, WIPE.unity);
  }

  // =====================================================================================================
  // UNITY 12–17: final project in Unity3D. Grid floor, cube, ball, cone, and a graduation cap on the cube.
  // =====================================================================================================
  const IS = 62, GX = 1180, GY = 700;                   // iso unit and grid origin (screen)
  const iso = (u, v, z = 0) => [GX + (u - v) * IS * .866, GY + (u + v) * IS * .5 - z * IS];
  function shotUnity(t, lt, dur) {
    const bgi = bake('unity', () => {
      paint(FULL(), { wash: mixCol(P.paper, P.sky, .28), ink: null });
      paint(ellPts(1250, 760, 820, 330, 36, 0), { fill: P.violet, fillOp: 40, bleed: .3, tex: .5, ink: null });
      paint(ellPts(1600, 200, 420, 240, 30, 0), { fill: P.cream, fillOp: 90, bleed: .3, tex: .4, ink: null });
    });
    bg(bgi, -6 * lt, 0, 1.05);
    camBegin(960 + 12 * lt, 540 - 4 * lt, 1.02 + .02 * ease(lt / dur));
    // floor diamond and grid lines drawing on
    const gk = ease(seg(t, 12.3, 13.3)), N = 4;
    boilSeed('floor');
    paint([iso(-N, -N), iso(N, -N), iso(N, N), iso(-N, N)].map(([x, y]) => [x, y]), { wash: P.cream, washOp: 150 * gk, ink: null });
    for (let i = -N; i <= N; i++) {
      boilSeed('gu' + i); drawLine([iso(i, -N), iso(i, N)], seg(gk, (i + N) * .04, (i + N) * .04 + .6), .55, mixCol(P.ink, P.violet, .4), 'inkfine', 0);
      boilSeed('gv' + i); drawLine([iso(-N, i), iso(N, i)], seg(gk, (i + N) * .04 + .1, (i + N) * .04 + .7), .55, mixCol(P.ink, P.violet, .4), 'inkfine', 0);
    }
    // cone (back left)
    const ck = popIn(t, 13.5, .5);
    if (ck > 0) {
      const [bx, by] = iso(-2.2, .6); boilSeed('cone');
      paint(ellPts(bx, by + 8, 70, 22, 20, .6), { wash: P.ink, washOp: 40, ink: null });
      scaled(bx, by, ck, ck, () => {
        paint([[-66, 0], [0, -190], [66, 0]], { wash: P.ochre, ink: P.ink, sw: 1.1 });
        paint(ellPts(0, 0, 66, 20, 20, .6), { wash: mixCol(P.ochre, P.clayDk, .35), ink: P.ink, sw: 1 });
        paint([[8, -150], [0, -190], [30, -40]], { wash: P.cream, washOp: 90, ink: null });
      });
    }
    // cube (centre): drops and squashes
    const d = drop(t, 12.9, 800, .35);
    const cubePts = () => {
      const a = 1.4, top = [iso(-a, -a, 2 * a), iso(a, -a, 2 * a), iso(a, a, 2 * a), iso(-a, a, 2 * a)];
      const left = [iso(-a, a, 2 * a), iso(a, a, 2 * a), iso(a, a, 0), iso(-a, a, 0)];
      const right = [iso(a, -a, 2 * a), iso(a, a, 2 * a), iso(a, a, 0), iso(a, -a, 0)];
      return { top, left, right };
    };
    const base = iso(1.4, 1.4, 0);
    if (d) {
      boilSeed('cubeSh'); paint(ellPts(...iso(.2, .2), 190, 70, 24, 1), { wash: P.ink, washOp: 35, ink: null });
      boilSeed('cube');
      push(); translate(base[0], base[1] + d.dy); scale(1 + d.sq, 1 - d.sq); translate(-base[0], -base[1]);
      const c = cubePts();
      paint(c.left, { wash: P.violet, ink: P.ink, sw: 1.2 });
      paint(c.right, { wash: P.indigo, ink: P.ink, sw: 1.2 });
      paint(c.top, { wash: mixCol(P.sky, P.cream, .3), ink: P.ink, sw: 1.2 });
      // mortarboard drops on the top face
      const mk = t - 14.6;
      if (mk > 0) {
        const fall = easeIn(seg(mk, 0, .35)), sp = spring(t, 14.95, 6, 16);
        const [tx, ty] = iso(0, 0, 2.8);
        push(); translate(tx, ty - (1 - fall) * 700); rotate(sp * .12 + (1 - fall) * .5);
        boilSeed('cap');
        paint([[-60, 18], [60, 18], [56, 62], [-56, 62]].map(([x, y]) => [x, y - 40]), { wash: mixCol(P.ink, P.indigo, .3), ink: P.ink, sw: 1 });
        paint([[0, -80], [150, -8], [0, 60], [-150, -8]].map(([x, y]) => [x, y - 40]), { wash: mixCol(P.ink, P.indigo, .45), ink: P.ink, sw: 1.1 });
        const sw2 = Math.sin(t * 3) * 6 + sp * 30;
        inkLine([[0, -48], [95, -30], [110 + sw2 * .3, 30 + Math.abs(sw2) * .2]], 1, P.ochre, 'ink', .5);
        paint(ellPts(0, -48, 10, 8, 10), { wash: P.ochre, ink: null });
        paint(ellPts(112 + sw2 * .3, 44, 10, 18, 10), { wash: P.ochre, ink: P.ink, sw: .6 });
        pop();
      }
      pop();
    }
    // ball: bounces in from the right and settles
    if (t > 13.3) {
      const a = t - 13.3, x = lerp(1720, 1500, easeOut(seg(a, 0, 1.3))), gyy = iso(2.6, -1.8)[1];
      const hB = Math.abs(Math.sin(a * 6.5)) * 260 * Math.exp(-a * 2.2);
      const sqB = hB < 20 ? .18 * Math.exp(-a * 2) : -.05;
      boilSeed('ballSh'); paint(ellPts(x, gyy + 6, 70 * (1 - hB / 600), 18, 18, .6), { wash: P.ink, washOp: 40, ink: null });
      boilSeed('ball');
      scaled(x, gyy, 1 + sqB, 1 - sqB, () => {
        paint(ellPts(0, -72, 72, 72, 30, J), { wash: P.rose, ink: P.ink, sw: 1.1 });
        paint(ellPts(-24, -98, 20, 13, 12, .5, -.5), { wash: P.cream, washOp: 170, ink: null });
      });
    }
    camEnd();
    head('Final project: Unity3D.', 120, 170, 88, t, 12.35);
    swash(126, 228, tw('Final project: Unity3D.', 88) * .92, t, 12.8, P.violet);
    head('back when it was a small Danish startup.', 124, 300, 40, t, 13.3, P.violet, { ink: false });
    // sticker
    const stk = popIn(t, 15.4, .5);
    if (stk > 0) {
      const sw0 = tw('Unity: est. Copenhagen 2004', 36) / 2 + 40;
      boilSeed('sticker'); push(); translate(560, 870); rotate(-.06); scale(stk);
      paint(rrPts(-sw0, -48, sw0 * 2, 96, 40, 1), { wash: P.cream, ink: P.ochre, sw: 1.2 });
      pop();
      letter('Unity: est. Copenhagen 2004', 560, 872, 36, P.clayDk, { screen: true, ink: false, rot: -.06, pop: seg(t, 15.4, 15.8) * 1.4 });
    }
    seams(lt, dur, WIPE.unity, WIPE.agency);
  }

  // =====================================================================================================
  // AGENCY 17–22: browser, API, DB; packets race along the pipes, faster and faster
  // =====================================================================================================
  function shotAgency(t, lt, dur) {
    const bgi = bake('agency', () => {
      paint(FULL(), { wash: mixCol(P.paper, P.teal, .16), ink: null });
      paint(ellPts(1000, 640, 900, 360, 36, 0), { fill: P.teal, fillOp: 45, bleed: .3, tex: .5, ink: null });
      paint(ellPts(1700, 180, 380, 200, 30, 0), { fill: P.sap, fillOp: 40, bleed: .3, tex: .5, ink: null });
    });
    bg(bgi, -10 * lt, 0, 1.05);
    camBegin(lerp(900, 1030, ease(lt / dur)), 560, 1.02);
    const Y = 640;
    // pipes (two lanes each)
    const pk = ease(seg(t, 18.4, 19.0));
    const lanes = [[[840, Y - 18], [1060, Y - 18]], [[1060, Y + 18], [840, Y + 18]], [[1300, Y - 18], [1480, Y - 18]], [[1480, Y + 18], [1300, Y + 18]]];
    lanes.forEach((L, i) => { boilSeed('lane' + i); drawLine(i % 2 ? [L[1], L[0]] : L, pk, 1.1, mixCol(P.ink, P.teal, .3), 'ink', 0); });
    // packets
    if (t > 19.0) {
      const tau = t - 19.0, phase = .7 * tau + .42 * tau * tau;   // speeds up
      const cols = [P.clay, P.ochre, P.rose, P.cream];
      lanes.forEach((L, li) => {
        for (let j = 0; j < 3; j++) {
          const f = frac(phase + j / 3 + li * .17), x = lerp(L[0][0], L[1][0], f), y = L[0][1];
          const dir = Math.sign(L[1][0] - L[0][0]), sp = .7 + .84 * tau, sl = clamp(sp / 3);
          boilSeed('pk' + li + j);
          if (sl > .25) inkLine([[x - dir * (30 + 60 * sl), y], [x - dir * 26, y]], .6, mixCol(P.ink, P.paper, .4), 'inkfine', 0);
          paint(rrPts(x - 20, y - 10, 40, 20, 9, .6), { wash: cols[(li + j) % 4], ink: P.ink, sw: .7 });
        }
      });
    }
    // browser window
    const bk = popIn(t, 17.4, .5);
    if (bk > 0) {
      boilSeed('browser');
      scaled(530, 640, bk, bk, () => {
        paint(rrPts(-310, -240, 620, 480, 18, J), { wash: P.cream, ink: P.ink, sw: 1.3 });
        paint(rrPts(-310, -240, 620, 58, 16, .6), { wash: P.teal, ink: P.ink, sw: 1 });
        [P.rose, P.ochre, P.sap].forEach((c, i) => paint(ellPts(-270 + i * 34, -211, 10, 10, 10, .3), { wash: c, ink: P.ink, sw: .6 }));
        paint(rrPts(-180, -224, 420, 26, 12, .5), { wash: P.cream, ink: null });
        paint(rrPts(-270, -150, 540, 150, 12, .8), { wash: P.clay, ink: P.ink, sw: .9 });
        paint(ellPts(150, -80, 40, 40, 16, .6), { wash: P.ochre, ink: null });
        for (let i = 0; i < 3; i++) inkLine([[-270, 40 + i * 30], [lerp(120, -20, i / 2), 40 + i * 30]], .9, mixCol(P.ink, P.paper, .35), 'ink', 0);
        paint(rrPts(-270, 140, 160, 70, 10, .6), { wash: P.sky, ink: P.ink, sw: .7 });
        paint(rrPts(-90, 140, 160, 70, 10, .6), { wash: P.sap, ink: P.ink, sw: .7 });
        paint(rrPts(90, 140, 180, 70, 10, .6), { wash: P.violet, ink: P.ink, sw: .7 });
      });
    }
    // API box with a turning gear
    const ak = popIn(t, 18.1, .45);
    if (ak > 0) {
      boilSeed('api');
      scaled(1180, Y, ak, ak, () => {
        paint(rrPts(-120, -120, 240, 240, 26, J), { wash: P.ochre, ink: P.ink, sw: 1.2 });
        push(); rotate(t * (1.2 + 1.2 * seg(t, 19, 22)));
        paint(starPts(0, -14, 72, .78, 9, 0), { wash: P.cream, ink: P.ink, sw: 1 });
        paint(ellPts(0, -14, 24, 24, 16, .5), { wash: P.ochre, ink: P.ink, sw: .8 });
        pop();
      });
      letter('API', 1180, Y + 92, 40, P.ink, { ink: false, pop: seg(t, 18.3, 18.7) * 1.5 });
    }
    // DB cylinder
    const dk = popIn(t, 18.4, .45);
    if (dk > 0) {
      boilSeed('db');
      scaled(1600, Y + 120, dk, dk, () => {
        const body = [...ellPts(0, -240, 115, 34, 24, 0).filter(p => p[1] >= -240), [-115, 0]];
        paint([[-115, -240], [-115, 0], ...ellPts(0, 0, 115, 34, 24, 0).filter(p => p[1] > 0).sort((a, b) => a[0] - b[0]), [115, 0], [115, -240]], { wash: P.sap, ink: P.ink, sw: 1.2 });
        for (const yy of [-160, -80]) inkLine(ellPts(0, yy, 115, 34, 24, 0).filter(p => p[1] > yy).sort((a, b) => a[0] - b[0]), .9, P.ink, 'ink', .5);
        paint(ellPts(0, -240, 115, 34, 24, J * .5), { wash: mixCol(P.sap, P.cream, .45), ink: P.ink, sw: 1.1 });
      });
      letter('DB', 1600, Y + 196, 40, P.ink, { ink: false, pop: seg(t, 18.6, 19.0) * 1.5 });
    }
    camEnd();
    head('Full stack, full speed.', 120, 170, 92, t, 17.35);
    swash(126, 230, tw('Full stack, full speed.', 92) * .95, t, 17.8, P.teal);
    seams(lt, dur, WIPE.agency, WIPE.orbiscada);
  }

  // =====================================================================================================
  // ORBISCADA 22–33: one turbine in Denmark, then 1,500+ across four countries
  // =====================================================================================================
  function turbineBig(x, y, h, t, k, spinK) {
    // tower grows up from the ground (k), blades spin (spinK = angle)
    if (k <= 0) return;
    boilSeed('tw');
    const hh = h * k, hub = [x, y - hh];
    paint([[x - 18, y], [x - 7, y - hh], [x + 7, y - hh], [x + 18, y]], { wash: P.cream, ink: P.ink, sw: 1.1 });
    if (k < .98) return;
    paint(rrPts(x - 22, y - hh - 20, 70, 36, 12, .6), { wash: P.cream, ink: P.ink, sw: 1 });
    push(); translate(hub[0], hub[1]); rotate(spinK);
    for (let b = 0; b < 3; b++) { push(); rotate(b * TAU / 3); paint(ribbon([[0, 0], [60, -8], [180, -10], [255, -4]], 30, 6), { wash: P.cream, ink: P.ink, sw: 1 }); pop(); }
    paint(ellPts(0, 0, 18, 18, 14, .5), { wash: P.clay, ink: P.ink, sw: .9 });
    pop();
  }
  // map projection
  const MX = 60, MY = 220, MW = 1800, MH = MW * 142 / 360;
  const mp = (lon, lat) => [MX + (lon + 180) / 360 * MW, MY + (84 - lat) / 142 * MH];
  const DK = mp(10, 56);
  const SITES = [
    { name: 'Denmark', at: 27.1, dur: .6, label: [32, 67], areas: [[[9.5, 56], 3.4]] },
    { name: 'UK', at: 27.9, dur: .8, label: [-24, 62], areas: [[[-2.5, 53.5], 5.5]] },
    { name: 'USA', at: 28.8, dur: 1.8, label: [-102, 20], areas: [[[-99, 37], 11], [[-120, 38], 6], [[-78, 42], 6], [[-94, 45], 7]] },
    { name: 'Japan', at: 30.6, dur: .7, label: [152, 29], areas: [[[139, 37], 5.5], [[142.5, 43], 2.5]] },
  ];
  // WORLD_DOTS has two bogus full-width rows (lat -16 and 64): keep a dot there only if a neighbour row has land.
  const LAND = (() => {
    const d = window.WORLD_DOTS || [], has = new Set(d.map(([a, b]) => a + ',' + b));
    return d.filter(([lon, lat]) => (lat !== -16 && lat !== 64) || has.has(lon + ',' + (lat + 2.5)) || has.has(lon + ',' + (lat - 2.5)));
  })();
  const TURB = (() => {
    const out = [];
    LAND.forEach(([lon, lat], i) => {
      SITES.forEach((s, si) => {
        for (const [[rl, rt], rad] of s.areas) {
          const d = Math.hypot((lon - rl) * Math.cos(lat * Math.PI / 180), lat - rt);
          if (d < rad && (si !== 2 || hash(i * 1.37) < .4)) { out.push({ lon, lat, si, o: d + hash(i * 7.3) * 4 }); return; }
        }
      });
    });
    SITES.forEach((s, si) => { const g = out.filter(q => q.si === si).sort((a, b) => a.o - b.o); g.forEach((q, j) => q.at = s.at + (j / Math.max(1, g.length - 1)) * s.dur); });
    return out;
  })();
  function smallTurbine(x, y, s, a, k, key) {
    if (k <= 0) return;
    boilSeed(key);
    push(); translate(x, y); scale(k * s);
    inkLine([[0, 0], [0, -30]], .7, P.ink, 'inkfine', 0);
    push(); translate(0, -30); rotate(a);
    paint(starPts(0, 0, 17, .16, 3, 0), { wash: P.clay, ink: P.ink, sw: .35 });
    pop(); pop();
  }
  const fmt = n => n.toLocaleString('en-US');
  function counter(t, x, y, n, plus, t0) {
    head(fmt(n) + (plus ? '+' : ''), x, y, 120, t, t0, P.clay);
    head(n === 1 ? 'turbine' : 'turbines', x + tw(fmt(n) + (plus ? '+' : ''), 120) + 24, y + 22, 44, t, t0 + .1, P.ink, { ink: false });
  }
  function fieldBake() {
    return bake('field', () => {
      paint(FULL(), { wash: mixCol(P.paper, P.sky, .45), ink: null });
      paint(ellPts(1400, 260, 700, 260, 30, 0), { fill: P.cream, fillOp: 90, bleed: .3, tex: .4, ink: null });
      paint([[-40, 760], [400, 700], [900, 740], [1400, 690], [1960, 730], [1960, 1120], [-40, 1120]], { wash: mixCol(P.sap, P.cream, .25), ink: null, curv: .6 });
      paint([[-40, 840], [600, 800], [1200, 850], [1960, 800], [1960, 1120], [-40, 1120]], { wash: P.sap, fill: mixCol(P.sap, P.teal, .4), fillOp: 60, bleed: .1, tex: .6, ink: null, curv: .6 });
      inkLine([[-40, 842], [600, 802], [1200, 852], [1960, 802]], .8, mixCol(P.ink, P.sap, .4), 'ink', .6);
      for (let i = 0; i < 26; i++) { const x = hash(i + 50) * 1900, y = 880 + hash(i + 80) * 180; inkLine([[x, y], [x + 30, y - 4]], .5, mixCol(P.sap, P.ink, .5), 'inkfine', .3); }
    });
  }
  function shotTurbine(t, lt, dur) {
    bg(fieldBake(), -6 * lt, 0, 1.04 + .01 * lt);
    // clouds drifting
    for (let i = 0; i < 3; i++) {
      const cx = ((300 + i * 700 + lt * (18 + i * 6)) % 2300) - 200, cy = 180 + i * 90;
      stillSeed('cloud' + i);
      paint(ellPts(cx, cy, 130 + 30 * i, 38, 20, 0), { wash: P.cream, washOp: 200, ink: null });
      paint(ellPts(cx + 40, cy - 26, 70, 36, 16, 0), { wash: P.cream, washOp: 200, ink: null });
    }
    const pz = ease(seg(lt, 0, dur));
    camBegin(lerp(1000, 1180, pz), lerp(560, 520, pz), 1 + .08 * pz);
    const rise = backOut(seg(t, 22.4, 23.2)), spin = t < 23.2 ? 0 : (t - 23.2) * 1.1 + .6 * (t - 23.2) ** 2 * .3;
    boilSeed('twSh'); paint(ellPts(1250, 868, 90 * clamp(rise), 12, 16, .5), { wash: P.ink, washOp: 40, ink: null });
    turbineBig(1250, 866, 470, t, clamp(rise, 0, 1.08), spin);
    camEnd();
    head('OrbiSCADA.', 120, 180, 120, t, 22.35);
    swash(126, 250, tw('OrbiSCADA.', 120) * .95, t, 22.8, P.sap);
    head('wind turbine SCADA · freelance, five years', 124, 320, 38, t, 23.1, P.teal, { ink: false });
    if (t > 24.0) {
      counter(t, 120, 930, 1, false, 24.0);
      head('Denmark', 1330, 400, 44, t, 24.4, P.ink, { ink: false, rot: -.03 });
    }
    seams(lt, dur, WIPE.orbiscada, [P.sky, P.sap]);
  }
  function mapBake() {
    return bake('map', () => {
      paint(FULL(), { wash: mixCol(P.paper, P.sky, .22), ink: null });
      paint(ellPts(960, 560, 1000, 480, 40, 0), { fill: P.sky, fillOp: 40, bleed: .3, tex: .5, ink: null });
      const land = mixCol(P.sap, P.cream, .35);
      LAND.forEach(([lon, lat], i) => {
        const [x, y] = mp(lon, lat), r = 5.2 + hash(i) * 1.2;
        paint(ellPts(x, y, r, r, 8, .4), { wash: mixCol(land, P.sap, hash(i * 3) * .5), ink: null });
      });
    });
  }
  function shotMap(t, lt, dur) {
    const img = mapBake();
    const zk = ease(seg(lt, .1, 1.6)), z = lerp(2.4, 1, zk);
    camBegin(lerp(DK[0], 960, zk), lerp(DK[1], 540, zk), z * (1 + .025 * seg(lt, 1.5, dur)));
    image(img, 0, 0, W, H);
    // the field shrinks into Denmark
    const spin = t * 3;
    TURB.forEach((q, i) => {
      const [x, y] = mp(q.lon, q.lat);
      smallTurbine(x + 2, y + 4, 1, spin + hash(i) * 6, popIn(t, q.at, .35), 'tb' + i);
    });
    // Denmark pin (the first turbine) stays marked
    const pk = popIn(t, 26.6, .4);
    if (pk > 0) { boilSeed('dkpin'); paint(ellPts(DK[0], DK[1] - 2, 16 * pk / Math.max(1, z * .5), 16 * pk / Math.max(1, z * .5), 16, .4), { wash: null, ink: P.clay, sw: .9 / Math.max(1, z * .6) }); }
    camEnd();
    // country tags
    SITES.forEach((s, si) => {
      if (t < s.at + .1) return;
      const [x, y] = toScreen(...mp(...s.label), LAST_CAM);
      head(s.name, x, y, 40, t, s.at + .1, P.ink, { ink: false, align: 'center', rot: -.03 });
    });
    const ck = seg(t, 27.0, 31.4), n = t < 27 ? 1 : Math.max(1, Math.round(Math.pow(1500, ease(ck))));
    head('OrbiSCADA.', 120, 130, 84, t, 26.2 - 1);
    counter(t, 110, 900, n, t >= 31.4, 26.2 - 1);
    seams(lt, dur, [P.sky, P.sap], WIPE.clovr);
  }

  // =====================================================================================================
  // CLOVR 33–40: following the money through a wallet network
  // =====================================================================================================
  const NET = (() => {
    const nodes = [], cols = 7, rows = 4;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const i = c * rows + r, x = 250 + c * 236 + (hash(i * 3.3) - .5) * 100, y = 400 + r * 165 + (hash(i * 5.1) - .5) * 80;
      if (c < 4 && r === 0) continue;       // headline zone
      nodes.push({ c, r, x, y, s: 20 + 12 * hash(i * 2.2) });
    }
    const idx = (c, r) => nodes.findIndex(n => n.c === c && n.r === r);
    const edges = [];
    nodes.forEach((a, i) => nodes.forEach((b, j) => { if (j > i && Math.abs(a.c - b.c) <= 1 && Math.abs(a.r - b.r) <= 1 && hash(i * 13 + j) < .62) edges.push([i, j]); }));
    const rowsPath = [2, 1, 2, 3, 2, 1, 2], path = rowsPath.map((r, c) => idx(c, r));
    return { nodes, edges, path };
  })();
  function coin(x, y, r, col, k = 1) {
    paint(ellPts(x, y, r * k, r * k, 22, .8), { wash: col, ink: P.ink, sw: .9 });
    paint(ellPts(x, y, r * .62 * k, r * .62 * k, 18, .5), { wash: null, ink: mixCol(P.ink, col, .4), sw: .5 });
  }
  function shotClovr(t, lt, dur) {
    const bgi = bake('clovr', () => {
      paint(FULL(), { wash: mixCol(P.paper, P.ochre, .12), ink: null });
      paint(ellPts(1100, 650, 900, 380, 36, 0), { fill: P.ochre, fillOp: 40, bleed: .3, tex: .5, ink: null });
      paint(ellPts(300, 950, 420, 200, 30, 0), { fill: P.clay, fillOp: 35, bleed: .3, tex: .5, ink: null });
    });
    bg(bgi, -8 * lt, 0, 1.05);
    const { nodes, edges, path } = NET, hops = path.length - 1, T0 = 34.8, T1 = 38.4;
    const hp = clamp((t - T0) / (T1 - T0)) * hops, hi = Math.min(hops - 1, Math.floor(hp)), hf = hp - hi;
    const A = nodes[path[hi]], B = nodes[path[hi + 1]], head0 = t < T0 ? [nodes[path[0]].x, nodes[path[0]].y] : [lerp(A.x, B.x, ease(hf)), lerp(A.y, B.y, ease(hf))];
    camBegin(lerp(960, head0[0], .12), lerp(560, head0[1], .1), 1.02 + .025 * ease(lt / dur));
    const nk = ease(seg(t, 33.3, 34.4));
    edges.forEach(([i, j], e) => { boilSeed('e' + e); drawLine([[nodes[i].x, nodes[i].y], [nodes[j].x, nodes[j].y]], seg(nk, hash(e) * .5, hash(e) * .5 + .5), .6, mixCol(P.ink, P.paper, .5), 'inkfine', 0); });
    // traced path
    for (let h = 0; h < hops; h++) {
      const a = nodes[path[h]], b = nodes[path[h + 1]], k = t < T0 ? 0 : clamp(hp - h);
      if (k <= 0) continue;
      boilSeed('tr' + h);
      const q = lineK([a.x, a.y], [b.x, b.y], ease(k)); if (Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) > 6) paint(ribbon(q, 12, 12), { wash: P.clay, ink: null });
    }
    // wallets
    nodes.forEach((n, i) => {
      const pi = path.indexOf(i), reached = pi >= 0 && t >= T0 && hp >= pi - .02;
      const k = popIn(t, 33.3 + hash(i * 1.7) * .8, .4) * (reached ? 1 + .25 * Math.exp(-(hp - pi) * 4) : 1);
      if (k <= 0) return;
      boilSeed('n' + i); coin(n.x, n.y, n.s, reached ? P.clay : mixCol(P.ochre, P.cream, .35), k);
    });
    // found: final ring
    const fin = nodes[path[hops]], fk = popIn(t, T1 + .1, .5);
    if (fk > 0) { boilSeed('found'); for (const rr of [1.9, 2.6]) paint(ellPts(fin.x, fin.y, fin.s * rr * fk, fin.s * rr * fk, 28, 1), { wash: null, ink: P.clayDk, sw: 1.4 }); }
    // travelling coin + magnifying glass trailing
    if (t > T0 - .3 && t < T1 + .05) { boilSeed('mover'); coin(head0[0], head0[1] - 2, 16, P.ochre); }
    const gl = t < T0 ? head0 : (() => { const hp2 = clamp((t - T0 - .25) / (T1 - T0)) * hops, i2 = Math.min(hops - 1, Math.floor(hp2)), f2 = hp2 - i2, a = nodes[path[i2]], b = nodes[path[i2 + 1]]; return [lerp(a.x, b.x, ease(f2)), lerp(a.y, b.y, ease(f2))]; })();
    const gk = popIn(t, 34.3, .5);
    if (gk > 0) {
      const away = ease(seg(t, T1 + .05, T1 + .6)), gx = gl[0] + 70 * away, gy = gl[1] - 90 * away, bob = Math.sin(t * 3) * 6;
      boilSeed('glass');
      push(); translate(gx + 40, gy - 40 + bob); scale(gk); rotate(-.2);
      paint(ribbon([[60, 60], [150, 150]], 30, 26), { wash: P.clayDk, ink: P.ink, sw: 1 });
      paint(ellPts(0, 0, 84, 84, 32, J), { wash: P.sky, washOp: 70, ink: P.ink, sw: 1.8 });
      paint(ellPts(0, 0, 70, 70, 28, .5), { wash: null, ink: mixCol(P.ink, P.sky, .5), sw: .6 });
      paint(ellPts(-30, -34, 20, 10, 10, .5, -.7), { wash: P.cream, washOp: 160, ink: null });
      pop();
    }
    camEnd();
    head('Following the money.', 120, 170, 92, t, 33.35);
    swash(126, 230, tw('Following the money.', 92) * .95, t, 33.8, P.ochre);
    head('Clovr Labs · crypto forensic analytics', 124, 300, 38, t, 34.0, P.clayDk, { ink: false });
    seams(lt, dur, WIPE.clovr, WIPE.n0);
  }

  // =====================================================================================================
  // N0 40–45: the workspace of the future. People, agents and apps fly into one window.
  // =====================================================================================================
  const WX = 620, WY = 330, WWd = 1080, WHt = 600;
  const SLOTS = (() => {
    const s = [];
    for (let i = 0; i < 3; i++) s.push({ kind: 'person', x: WX + 290, y: WY + 150 + i * 130, col: [P.rose, P.ochre, P.sap][i], at: 41.2 + i * .18, from: [WX - 500, WY + 700 - i * 200] });
    for (let i = 0; i < 3; i++) s.push({ kind: 'agent', x: WX + 560, y: WY + 150 + i * 130, col: [P.clay, P.violet, P.teal][i], at: 41.8 + i * .18, from: [WX + 560 + (i - 1) * 300, -200] });
    for (let i = 0; i < 4; i++) s.push({ kind: 'app', x: WX + 800 + (i % 2) * 130, y: WY + 190 + Math.floor(i / 2) * 150, col: [P.teal, P.violet, P.ochre, P.rose][i], at: 42.4 + i * .15, from: [W + 300, WY + 100 + i * 180] });
    return s;
  })();
  function token(s, x, y, k, t) {
    scaled(x, y, k, k, () => {
      if (s.kind === 'person') {
        paint(ellPts(0, 0, 50, 50, 24, J), { wash: s.col, ink: P.ink, sw: 1 });
        paint(ellPts(0, -12, 15, 15, 14, .5), { wash: P.cream, ink: null });
        paint([[-28, 30], [-20, 12], [0, 6], [20, 12], [28, 30], [0, 38]], { wash: P.cream, ink: null, curv: .6 });
      } else if (s.kind === 'agent') {
        paint(ellPts(0, 0, 50, 50, 24, J), { wash: P.cream, ink: P.ink, sw: 1 });
        paint(starPts(0, 0, 34 * (1 + .08 * Math.sin(t * 5 + s.x)), .3, 4, 0), { wash: s.col, ink: P.ink, sw: .7 });
      } else {
        paint(rrPts(-50, -50, 100, 100, 22, J), { wash: s.col, ink: P.ink, sw: 1 });
        paint(rrPts(-24, -24, 48, 48, 10, .5), { wash: P.cream, washOp: 200, ink: null });
      }
    });
  }
  function shotN0(t, lt, dur) {
    const bgi = bake('n0', () => {
      paint(FULL(), { wash: mixCol(P.paper, P.indigo, .1), ink: null });
      paint(ellPts(1160, 620, 800, 420, 36, 0), { fill: P.teal, fillOp: 40, bleed: .3, tex: .5, ink: null });
      paint(ellPts(300, 900, 400, 200, 30, 0), { fill: P.indigo, fillOp: 30, bleed: .3, tex: .5, ink: null });
    });
    bg(bgi, -6 * lt, 0, 1.05);
    camBegin(lerp(980, 1080, ease(lt / dur)), 590, 1.0 + .05 * ease(lt / dur));
    const wk = popIn(t, 40.35, .55);
    if (wk > 0) {
      boilSeed('win');
      scaled(WX + WWd / 2, WY + WHt / 2, wk, wk, () => {
        const x = -WWd / 2, y = -WHt / 2;
        paint(rrPts(x + 14, y + 16, WWd, WHt, 24, .8), { wash: P.ink, washOp: 60, ink: null });
        paint(rrPts(x, y, WWd, WHt, 24, J), { wash: P.cream, ink: P.ink, sw: 1.4 });
        paint(rrPts(x, y, WWd, 64, 22, .6), { wash: P.indigo, ink: P.ink, sw: 1 });
        paint(rrPts(x, y + 64, 150, WHt - 64, 18, .6), { wash: mixCol(P.teal, P.cream, .55), ink: null });
        for (let i = 0; i < 4; i++) paint(rrPts(x + 30, y + 110 + i * 70, 90, 34, 10, .5), { wash: mixCol(P.teal, P.cream, .15), ink: null });
      });
      n0mark(WX + 80, WY + 33, 44, P.cream, backOut(seg(t, 40.5, 40.9)));
    }
    // links: everything connected, once all are in
    const lk = ease(seg(t, 43.1, 43.7));
    if (lk > 0) SLOTS.forEach((s, i) => { if (s.kind === 'app') return; const o = SLOTS[i + 3] || SLOTS[6 + (i % 4)]; boilSeed('lk' + i); drawLine([[s.x + 50, s.y], [o.x - 50, o.y]], lk, .7, mixCol(P.ink, P.teal, .4), 'inkfine', 0); });
    const pulseAll = spring(t, 43.4, 5, 16) * .12;
    SLOTS.forEach((s, i) => {
      if (t < s.at) return;
      const k = seg(t, s.at, s.at + .5), p = arcPt(s.from, [s.x, s.y], 160, easeOut(k)), sc = (k < 1 ? lerp(.6, 1, k) : 1 + spring(t, s.at + .5, 7, 20) * .15) + pulseAll;
      boilSeed('tok' + i); token(s, p[0], p[1], sc, t);
    });
    camEnd();
    [['people', WX + 290], ['agents', WX + 560], ['apps', WX + 865]].forEach(([w, x], i) => {
      const [sx, sy] = toScreen(x, WY + WHt - 42, LAST_CAM); head(w, sx, sy, 32, t, 41.6 + i * .6, P.indigo, { ink: false, align: 'center', rot: 0 });
    });
    head('The workspace of the future.', 120, 170, 86, t, 40.35);
    swash(126, 228, tw('The workspace of the future.', 86) * .95, t, 40.8, P.teal);
    const [ux, uy] = toScreen(WX + WWd / 2, WY + WHt + 70, LAST_CAM);
    head('nzero.pro', ux, uy, 46, t, 42.9, P.indigo, { ink: false, align: 'center' });
    seams(lt, dur, WIPE.n0, WIPE.workshop);
  }

  // =====================================================================================================
  // WORKSHOP 45–53: nine project cards pinned to a cork board
  // =====================================================================================================
  const CARDS = ['n0', 'Claude Agent SDK Go', 'Gource Viewer', 'Gitilla', 'Codex SDK Go', 'wee.cat', 'Donna', 'The Agentic Crew', 'Hefty'];
  const CCOL = [P.indigo, P.clay, P.teal, P.violet, P.sap, P.rose, P.ochre, P.clayDk, P.sky];
  const BX = 110, BY = 270, BW = 1700, BH = 740;
  function shotWorkshop(t, lt, dur) {
    const bgi = bake('workshop', () => {
      paint(FULL(), { wash: mixCol(P.paper, P.ochre, .08), ink: null });
      paint(rrPts(BX - 26, BY - 26, BW + 52, BH + 52, 20, 0), { wash: mixCol(P.clayDk, P.ink, .2), ink: P.ink, sw: 1.2 });
      paint(rrPts(BX, BY, BW, BH, 8, 0), { wash: mixCol(P.ochre, P.clay, .35), fill: mixCol(P.clay, P.clayDk, .3), fillOp: 50, bleed: .08, tex: .8, border: .4, ink: P.ink, sw: .8 });
      for (let i = 0; i < 260; i++) { const x = BX + 10 + hash(i * 1.1) * (BW - 20), y = BY + 10 + hash(i * 2.9) * (BH - 20), r = 1.5 + hash(i * 4.4) * 2.5; paint(ellPts(x, y, r, r, 6, 0), { wash: hash(i) < .5 ? mixCol(P.clayDk, P.ink, .2) : P.cream, washOp: 110, ink: null }); }
    });
    bg(bgi, -8 * lt, -3 * lt, 1.04);
    camBegin(lerp(940, 990, ease(lt / dur)), 590, 1 + .03 * ease(lt / dur));
    const cw = 470, ch = 170;
    CARDS.forEach((name, i) => {
      const c = i % 3, r = Math.floor(i / 3), at = 46.2 + i * .5;
      if (t < at) return;
      const px = BX + 300 + c * 560 + (hash(i * 3) - .5) * 40, py = BY + 70 + r * 230 + (hash(i * 5) - .5) * 20;
      const fall = easeIn(seg(t, at, at + .28)), rot0 = (hash(i * 7) - .5) * .09, sw = spring(t, at + .28, 3.2, 9) * .22 + rot0;
      const dy = -(1 - fall) * 520;
      boilSeed('card' + i);
      push(); translate(px, py + dy); rotate(sw + (1 - fall) * .3);
      paint(rrPts(-cw / 2 + 10, 14, cw, ch, 10, .6), { wash: P.ink, washOp: 50, ink: null });
      paint(rrPts(-cw / 2, 0, cw, ch, 10, J), { wash: P.cream, ink: P.ink, sw: 1 });
      paint(rrPts(-cw / 2 + 12, 12, cw - 24, 26, 8, .6), { wash: CCOL[i], ink: null });
      pop();
      // pin (lands with the card)
      boilSeed('pin' + i);
      paint(ellPts(px, py + dy + 12, 17, 17, 16, .6), { wash: CCOL[(i + 3) % 9], ink: P.ink, sw: .9 });
      paint(ellPts(px - 5, py + dy + 7, 5, 4, 8, .3), { wash: P.cream, washOp: 200, ink: null });
      // name, placed through the card's transform
      const size = Math.min(52, (cw - 50) / (tw(name, 52) / 52));
      const a = sw + (1 - fall) * .3, ox = 0, oy = 100, lx = px + ox * Math.cos(a) - oy * Math.sin(a), ly = py + dy + ox * Math.sin(a) + oy * Math.cos(a);
      if (name === 'n0') n0mark(lx, ly, 60, P.ink, 1, a); else letter(name, lx, ly, size, P.ink, { rot: a, ink: false, align: 'center' });
    });
    camEnd();
    head('Always building. Always shipping.', 120, 160, 84, t, 45.35);
    swash(126, 218, tw('Always building. Always shipping.', 84) * .95, t, 45.8, P.rose);
    seams(lt, dur, WIPE.workshop, WIPE.end);
  }

  // =====================================================================================================
  // END 53–60: Serious code. Clear thinking.
  // =====================================================================================================
  function shotEnd(t, lt, dur) {
    const bgi = bake('end', () => {
      paint(ellPts(1480, 460, 520, 420, 40, 0), { fill: P.clay, fillOp: 55, bleed: .25, tex: .5, ink: null });
      paint(ellPts(1780, 180, 260, 200, 30, 0), { fill: P.ochre, fillOp: 50, bleed: .3, tex: .5, ink: null });
      paint(ellPts(360, 980, 600, 180, 30, 0), { fill: P.sky, fillOp: 30, bleed: .3, tex: .5, ink: null });
    });
    bg(bgi, -5 * lt, 0, 1.05);
    camBegin(960 + 10 * Math.sin(lt * .4), 540, 1 + .04 * ease(lt / dur));
    // sun
    const sk = popIn(t, 55.2, .6);
    if (sk > 0) {
      boilSeed('sun'); const sx = 1270, sy = 170;
      paint(ellPts(sx, sy, 50 * sk, 50 * sk, 22, J), { wash: P.ochre, ink: P.ink, sw: 1 });
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + t * .15; inkLine([[sx + Math.cos(a) * 66 * sk, sy + Math.sin(a) * 66 * sk], [sx + Math.cos(a) * 88 * sk, sy + Math.sin(a) * 88 * sk]], .9, P.clayDk, 'ink', 0); }
    }
    // logo
    const lk = ease(seg(t, 54.6, 56.2)), cx = 1560, cy = 440, r = 230;
    if (lk > 0) {
      boilSeed('logofill'); paint(ellPts(cx, cy, r * ease(seg(t, 54.6, 55.3)), r * ease(seg(t, 54.6, 55.3)), 48, J), { wash: P.cream, washOp: 190, ink: null });
      boilSeed('logo'); orbitLogo(cx, cy, r, lt, lk, { sw: 2, col: P.clayDk, dot: P.clay });
    }
    // sea waves (Barcelona)
    const wk = ease(seg(t, 56.2, 57.0));
    for (let j = 0; j < 3; j++) {
      const pts = []; for (let i = 0; i <= 16; i++) pts.push([1250 + i * 36, 800 + j * 34 + Math.sin(i * .9 + t * 2 + j) * 8]);
      boilSeed('wave' + j); drawLine(pts, seg(wk, j * .15, j * .15 + .7), 1, mixCol(P.teal, P.indigo, j * .3), 'ink', .5);
    }
    // rule under the headline
    boilSeed('rule'); drawLine([[120, 700], [1080, 698]], ease(seg(t, 55.8, 56.6)), 1, P.ink, 'ink', 0);
    camEnd();
    head('Serious code.', 110, 360, 136, t, 53.35);
    head('Clear thinking.', 116, 530, 136, t, 53.9, P.clay);
    swash(124, 610, tw('Clear thinking.', 136) * .9, t, 54.4, P.ochre, .6);
    head('Rasmus Schlünsen', 120, 800, 76, t, 56.2);
    head('Barcelona', 124, 890, 46, t, 56.6, P.teal, { ink: false });
    flushLetters();
    if (lt < .3) brushWipe(.5 + lt / .6, WIPE.end);
    if (lt > dur - .6) brushWipe((lt - (dur - .6)) / 1.2, WIPE.open);
  }

  shots([[0, shotOpen], [6, shotSecurity], [12, shotUnity], [17, shotAgency], [22, shotTurbine], [26.2, shotMap],
    [33, shotClovr], [40, shotN0], [45, shotWorkshop], [53, shotEnd]]);
})();
