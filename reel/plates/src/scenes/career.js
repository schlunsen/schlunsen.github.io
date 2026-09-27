// career.js: Rasmus Schlünsen, fifteen years, as plates from an illustrated treatise. 60 s, nine plates, hard cuts
// on the beat (see STORYBOARD.md). Every shot is a pure function of time.
(() => {
  const TOP = 64;                 // crop-mark margin (bookends only)
  const ME = { cx: 1330, bottom: 1110, h: 830 };           // Rasmus in the open and on the end card
  const HEAD = [1352, 640];                                  // roughly the centre of his face at that size
  const ORB = { cx: 1352, cy: 600, r: 372, rx: 470, ry: 136, tilt: .42 };

  // the site's orbit mark: a circle, two tilted ellipses, a dot. k = 0..1 drawn on (the spark is the pen).
  function orbitMark(t, k, o = {}) {
    const { cx, cy, r, rx, ry, tilt } = { ...ORB, ...o };
    const circ = arcPts(cx, cy, r, r, -Math.PI / 2, Math.PI * 1.5, 120);
    const e1 = arcPts(cx, cy, rx, ry, Math.PI, Math.PI * 3, 120, -tilt), e2 = arcPts(cx, cy, rx, ry, 0, TAU, 120, tilt);
    const parts = [[circ, 0, .4], [e1, .4, .7], [e2, .7, 1]];
    let head = null;
    for (const [P, a, b] of parts) {
      const kk = seg(k, a, b); if (kk <= 0) continue;
      const Q = partial(P, kk); fuse(Q, { w: o.w ?? 2, hot: kk < 1 ? 160 : 0, a: o.a ?? 1 });
      if (kk < 1) head = Q[Q.length - 1];
    }
    if (k >= 1 && (o.dot ?? true)) {   // the dot rides the first ellipse
      const a = t * 1.1, x = Math.cos(a) * rx, y = Math.sin(a) * ry, c = Math.cos(-tilt), s = Math.sin(-tilt);
      const px = cx + x * c - y * s, py = cy + x * s + y * c;
      X.fillStyle = C.signal; X.beginPath(); X.arc(px, py, 11, 0, TAU); X.fill();
      glow(g => { g.fillStyle = C.ember; g.beginPath(); g.arc(px, py, 16, 0, TAU); g.fill(); });
    }
    return head;
  }
  // bone hairline construction grid (major every 120 px)
  function grid(a, col = C.bone, o = {}) {
    if (a <= 0) return; const s = o.step || 24;
    X.save(); X.strokeStyle = col; X.lineWidth = 1;
    X.globalAlpha = a * (o.minor ?? .045); X.beginPath();
    for (let x = 0; x <= W; x += s) { X.moveTo(x + .5, 0); X.lineTo(x + .5, H); }
    for (let y = 0; y <= H; y += s) { X.moveTo(0, y + .5); X.lineTo(W, y + .5); }
    X.stroke();
    X.globalAlpha = a * (o.major ?? .12); X.beginPath();
    for (let x = 0; x <= W; x += s * 5) { X.moveTo(x + .5, 0); X.lineTo(x + .5, H); }
    for (let y = 0; y <= H; y += s * 5) { X.moveTo(0, y + .5); X.lineTo(W, y + .5); }
    X.stroke(); X.restore();
  }
  // a rubber stamp: signal box + type, slammed in at t0 (scale 1.6 → 1, slight rotation)
  function stamp(s, x, y, t, t0, o = {}) {
    if (t < t0) return 0;
    const k = seg(t, t0, t0 + .12), sc = lerp(1.7, 1, outCubic(k)), size = o.size || 38, rot = o.rot ?? -.06;
    X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc); X.globalAlpha = k * (o.a ?? 1);
    X.font = font(o.fam || F.black, size); X.letterSpacing = (o.track ?? size * .08) + 'px';
    const w = X.measureText(s).width, pw = size * .5, ph = size * .38;
    X.strokeStyle = o.col || C.signal; X.lineWidth = o.lw || 4; X.strokeRect(-w / 2 - pw, -size * .5 - ph, w + pw * 2, size + ph * 2);
    X.fillStyle = o.col || C.signal; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, 0, 2);
    X.restore();
    if (!o.noGlow) glow(g => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.globalAlpha *= .5 * k; g.font = font(o.fam || F.black, size); g.letterSpacing = (o.track ?? size * .08) + 'px'; g.fillStyle = C.signal; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 2); g.restore(); });
    return hit(t, t0 + .1, 14);   // a kick for camera shake
  }
  const shake = (amt, t) => [(hash(frameIdx(t) * 1.7) - .5) * 2 * amt, (hash(frameIdx(t) * 2.3 + 9) - .5) * 2 * amt];
  // a small mono label with a leader line to (px, py)
  function callout(s, x, y, px, py, t, t0, o = {}) {
    if (t < t0) return; const k = seg(t, t0, t0 + .35);
    hair(partial([[px, py], [x, y]], outCubic(k)), o.col || C.ash, 1);
    X.fillStyle = o.col || C.ash; X.beginPath(); X.arc(px, py, 3, 0, TAU); X.fill();
    txt(s, x + (o.dx ?? 8), y + (o.dy ?? -8), { fam: F.mono, size: o.size || 17, col: o.tc || C.ash, a: k, align: o.align });
  }
  // lines of the plate's "caption": a big karaoke headline in two lines, top left
  function headline(t, l1, l2, o = {}) {
    const x = o.x ?? 120, y = o.y ?? 250, size = o.size ?? 118, gap = o.gap ?? size * 1.02;
    sung(l1, x, y, t, { size, fam: o.fam1 || o.fam || F.black });
    if (l2) sung(l2, x, y + gap, t, { size: o.size2 || size, fam: o.fam2 || o.fam || F.black });
  }

  // ======================================================= OPEN 0–6 · construction sheet
  // The spark sits alone in the crop-mark frame (the loop point). On the first beat the grid ignites and the spark
  // engraves Rasmus top-down like a burin; the headline is set beside him; the spark plots the orbit mark around him.
  function shotOpen(T, lt) {
    const t = lt;
    const gridA = seg(t, .75, .9) * (1 + 1.4 * hit(t, .75, 5));
    grid(gridA);
    // engraving, burin scanning left↔right along the reveal line
    const rv = inOutCubic(seg(t, .75, 2.7)), top = ME.bottom - ME.h;
    const zoom = lerp(1, 1.035, smooth(seg(t, 0, 6)));
    X.save(); X.translate(W / 2, H / 2); X.scale(zoom, zoom); X.translate(-W / 2, -H / 2);
    if (rv > 0) engraveMe(T, ME.cx, ME.bottom, ME.h, { reveal: rv, rim: .0 });
    const w = ME.h / 1.25, scan = t => ME.cx + Math.sin((t - .75) * 9) * w * .42;
    const burinY = t => top + ME.h * inOutCubic(seg(t, .75, 2.7));
    let sp;
    if (t < .75) sp = [ME.cx, top];
    else if (t < 2.7) sp = [scan(t), burinY(t)];
    else sp = null;
    // the orbit mark, plotted 2.7 → 4.6
    const ok = seg(t, 2.7, 4.6), head = orbitMark(T, ok, { a: 1 });
    if (head) sp = head;
    if (!sp && ok < 1) sp = [ME.cx, ME.bottom];
    if (sp) spark(sp[0], sp[1], T, { head: tb => tb < .75 ? [ME.cx, top] : tb < 2.7 ? [scan(tb), burinY(tb)] : (() => { const kk = seg(tb, 2.7, 4.6); return kk >= 1 ? [ORB.cx, ORB.cy] : sp; })(), from: .75, rate: t < .75 ? 0 : 40, intensity: t < .75 ? .6 + .4 * Math.sin(t * 9) ** 2 : 1 });
    // annotations
    callout('r = 372', ORB.cx + 262, ORB.cy - 262 - 70, ORB.cx + 262, ORB.cy - 262, t, 3.1);
    callout('tilt ±24°', ORB.cx + 470, ORB.cy + 210, ORB.cx + 430, ORB.cy - 60, t, 3.8, { dy: 24 });
    X.restore();
    // listing, top left (the plotter's program)
    const L = ['> plate I · career.plot()', '  since   = 2010', '  years   = 15¹', '  status  = building'];
    L.forEach((s, i) => typed(s, 120, 130 + i * 28, t, .9 + i * .38, { size: 18, col: i ? C.ash : C.bone, cps: 40, caret: false }));
    // headline: beat 2 and 3
    headline(t, [['Fifteen', 1.5]], [['years.', 2.25, true]], { y: 470, size: 176, gap: 172 });
    sung([['Building', 3.0], ['what’s', 3.3], ['next.', 3.75, true]], 124, 760, t, { fam: F.med, size: 60, lead: .3 });
    footnote('¹ 2010 → 2026. Rounded down, out of modesty.', 124, 985, t, 4.6);
    // crop marks: in place from the loop point, flying out on the cut
    cropMarks(1 - seg(t, 5.6, 6.0));
  }

  // ======================================================= SECURITY 6–12 · the lock
  const HEX = '0123456789abcdef';
  function shotSecurity(T, lt) {
    const t = lt, lock = [1330, 640];
    const z = lerp(1, 1.07, smooth(seg(t, 0, 6))), open = seg(t, 3.0, 3.25);
    const kick = hit(t, 3.0, 7);
    POST.shake = shake(14 * kick, T); POST.flash = .22 * hit(t, 3.0, 10);
    cam(960 + 370 * (1 - 1 / z), 540, z);
    // hex dump behind the lock (scrolls up; after the unlock the bytes spell it out)
    const rows = 28, x0 = 900, y0 = -40, sc = t * 22, unlocked = t > 3.0;
    X.save(); X.font = font(F.mono, 19); X.letterSpacing = '1px';
    for (let r = 0; r < rows + 1; r++) {
      const ry = y0 + r * 40 - (sc % 40), row = r + Math.floor(sc / 40);
      X.fillStyle = C.graphite; X.globalAlpha = .55; X.fillText((0x7f3a00 + row * 16).toString(16).padStart(8, '0'), x0, ry);
      for (let b = 0; b < 16; b++) {
        const hsh = hash2(row, b + Math.floor(t * 3) * (unlocked ? 0 : 1)), by = HEX[Math.floor(hsh * 16)] + HEX[Math.floor(hash2(b, row) * 16)];
        const bx = x0 + 150 + b * 60, scanY = 540 + Math.sin(t * 1.3) * 380, near = Math.abs(ry - scanY) < 22;
        X.globalAlpha = unlocked ? .22 : near ? .95 : .28; X.fillStyle = near && !unlocked ? C.signal : C.ash;
        X.fillText(by, bx, ry);
      }
    }
    X.restore();
    // the lock: an engraved body, a tube shackle
    const bw = 380, bh = 320, bx = lock[0] - bw / 2, by = lock[1] - 40;
    const lift = open > 0 ? 96 * backOut(seg(t, 3.0, 3.4), 2.4) : 0, swing = open > 0 ? -.32 * outCubic(seg(t, 3.15, 3.8)) + .06 * spring(t, 3.8, 5, 14) : 0;
    X.save(); X.translate(lock[0] + 118, by - lift); X.rotate(swing); X.translate(-(lock[0] + 118), -(by - lift));
    const sh = arcPts(lock[0], by - lift, 118, 150, Math.PI, TAU, 60).concat([[lock[0] + 118, by - lift + 60]]);
    sh.unshift([lock[0] - 118, by - lift + 60]);
    line(X, sh, C.bone, 48); line(X, sh, C.ink, 42);
    X.save(); X.beginPath(); for (let i = 0; i < 26; i++) { const a = Math.PI + i / 25 * Math.PI; const px = lock[0] + Math.cos(a) * 118, py = by - lift + Math.sin(a) * 150; X.moveTo(px + Math.cos(a) * -20, py + Math.sin(a) * -20); X.lineTo(px + Math.cos(a) * 20, py + Math.sin(a) * 20); } X.strokeStyle = C.bone; X.lineWidth = 1.3; X.globalAlpha = .7; X.stroke(); X.restore();
    X.restore();
    const body = new Path2D(); body.roundRect(bx, by, bw, bh, 26);
    X.fillStyle = C.ink2; X.fill(body);
    hatch(body, { angle: -.9, gap: 8, w: 1.2, col: C.bone, a: .55, box: [bx, by, bw, bh] });
    // a lit band on the body's left third (cross-hatched darker on the right)
    const dark = new Path2D(); dark.rect(bx + bw * .62, by, bw * .38, bh); X.save(); X.clip(body); hatch(dark, { angle: .7, gap: 8, w: 1.2, col: C.bone, a: .45, box: [bx, by, bw, bh] }); X.restore();
    X.strokeStyle = C.bone; X.lineWidth = 2.4; X.stroke(body);
    // keyhole
    const kh = [lock[0], lock[1] + 90];
    X.fillStyle = C.ink; X.beginPath(); X.arc(kh[0], kh[1], 26, 0, TAU); X.moveTo(kh[0] - 14, kh[1] + 10); X.lineTo(kh[0] + 14, kh[1] + 10); X.lineTo(kh[0] + 9, kh[1] + 78); X.lineTo(kh[0] - 9, kh[1] + 78); X.closePath(); X.fill();
    X.strokeStyle = C.bone; X.lineWidth = 2; X.stroke();
    // the key is the spark: an arc in from the left, into the keyhole on beat 3 (8.25), a quarter turn, the unlock
    const path = catmull([[180, 860], [520, 980], [900, 820], [kh[0] - 180, kh[1] + 30], kh], 12), L = lengths(path);
    const fk = t => inOutCubic(seg(t, .35, 2.25));
    const head = tb => pointAt(path, fk(tb), L);
    if (t > .35) fuse(partial(path, fk(t), L), { w: 2, a: t < 2.8 ? 1 : 1 - seg(t, 2.8, 3.6) });
    const turn = seg(t, 2.35, 2.95);
    if (t > 2.3) {   // a protractor for the quarter turn
      const a0 = -Math.PI / 2, a1 = a0 + Math.PI / 2 * outCubic(turn);
      hair(arcPts(kh[0], kh[1], 64, 64, a0, a0 + Math.PI / 2, 30), C.graphite, 1);
      fuse(arcPts(kh[0], kh[1], 64, 64, a0, a1, 30), { w: 2.4, hot: 400 });
      txt(Math.round(90 * outCubic(turn)) + '°', kh[0] + 78, kh[1] - 52, { fam: F.mono, size: 18, col: C.ash });
    }
    const sp = t < 2.3 ? head(t) : [kh[0] + Math.cos(-Math.PI / 2 + Math.PI / 2 * outCubic(turn)) * 64, kh[1] + Math.sin(-Math.PI / 2 + Math.PI / 2 * outCubic(turn)) * 64];
    if (t > .1 && t < 3.1) spark(sp[0], sp[1], T, { head, from: 6.35, rate: t < 2.3 ? 38 : 12 });
    // the unlock: a burst of sparks from the shackle's foot
    if (t > 3.0 && t < 4.2) for (let i = 0; i < 26; i++) {
      const a = -Math.PI * hash(i * 3.3), v = 300 + 500 * hash(i * 7.1), age = t - 3.0, px = lock[0] + 118 + Math.cos(a) * v * age, py = by + Math.sin(a) * v * age + 900 * age * age, k = 1 - age / 1.2;
      line(X, [[px, py], [px - Math.cos(a) * 14, py - Math.sin(a) * 14]], C.ember, 2, k); glow(g => line(g, [[px, py], [px - Math.cos(a) * 14, py - Math.sin(a) * 14]], C.signal, 4, k));
    }
    callout('keyway', kh[0] - 250, kh[1] + 190, kh[0] - 10, kh[1] + 60, t, 1.3);
    callout(t < 3.0 ? 'shackle: engaged' : 'shackle: open', lock[0] + 300, by - 170, lock[0] + 130, by - lift - 40, t, 1.7, { tc: t < 3.0 ? C.ash : C.signal });
    camEnd();
    headline(t, [['It', .35], ['started', .6]], [['with', 1.15], ['security.', 1.5, true]], { y: 300, size: 112, gap: 118 });
    stamp('2010', 330, 520, t, 2.25, { size: 44, rot: -.08 });
    POST.shake = shake(14 * kick + 8 * hit(t, 2.35, 16), T);
    footnote('An internship at a security company.', 124, 900, t, 3.4, { size: 20, col: C.bone });
    footnote('No locks were harmed.', 124, 932, t, 4.1, { size: 20 });
  }

  // ======================================================= UNITY 12–17.25 · blueprint (inverted: bone paper, ink)
  function iso(c, a, b, h, s) { return [c[0] + (a - b) * .866 * s, c[1] + (a + b) * .5 * s - h * s]; }
  function shotUnity(T, lt) {
    const t = lt; POST.paper = 1; POST.bloom = .6; POST.vignette = .25;
    fillAll(C.bone); grid(1, C.ink, { minor: .06, major: .13 });
    const z = lerp(1.06, 1, outCubic(seg(t, 0, 1.2))) + .02 * smooth(seg(t, 1.2, 5.25));
    cam(1060, 560, z);
    const c = [1320, 740], s = 230;
    const P = (a, b, h) => iso(c, a, b, h, s);
    // the cube's edges, plotted by the pen in order; hidden edges dashed
    const E = [[[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 1, 0], [0, 1, 0]], [[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]], [[1, 1, 0], [1, 1, 1]], [[0, 1, 0], [0, 1, 1]],
      [[0, 0, 1], [1, 0, 1]], [[1, 0, 1], [1, 1, 1]], [[1, 1, 1], [0, 1, 1]], [[0, 1, 1], [0, 0, 1]]].map(([p, q]) => [P(p[0] - .5, p[1] - .5, p[2]), P(q[0] - .5, q[1] - .5, q[2])]);
    const draw0 = .3, per = .15;
    // faces tinted once drawn
    const fa = seg(t, draw0 + E.length * per, draw0 + E.length * per + .3);
    if (fa > 0) {
      const top = new Path2D(), right = new Path2D();
      [[-.5, -.5, 1], [.5, -.5, 1], [.5, .5, 1], [-.5, .5, 1]].forEach((p, i) => { const q = P(...p); i ? top.lineTo(...q) : top.moveTo(...q); }); top.closePath();
      [[.5, -.5, 0], [.5, .5, 0], [.5, .5, 1], [.5, -.5, 1]].forEach((p, i) => { const q = P(...p); i ? right.lineTo(...q) : right.moveTo(...q); }); right.closePath();
      X.save(); X.globalAlpha = fa; hatch(right, { angle: -1.05, gap: 7, w: 1, col: C.ink, a: .55, box: [c[0] - 300, c[1] - 400, 600, 600] }); hatch(top, { angle: .5, gap: 12, w: .8, col: C.ink, a: .3, box: [c[0] - 300, c[1] - 400, 600, 600] }); X.restore();
    }
    let pen = null;
    E.forEach(([p, q], i) => {
      const k = seg(t, draw0 + i * per, draw0 + (i + 1) * per); if (k <= 0) return;
      const Q = partial([p, q], k); hair(Q, C.ink, 2.2); if (k < 1) pen = Q[1];
    });
    // hidden edges, dashed
    if (t > draw0 + E.length * per) { X.save(); X.setLineDash([8, 8]); hair([P(-.5, .5, 0), P(-.5, -.5, 0)], C.ink, 1.2, .5); hair([P(-.5, .5, 0), P(.5, .5, 0)], C.ink, 1.2, .5); X.restore(); }
    // dimension line along the front-right edge
    const dk = seg(t, 2.1, 2.5);
    if (dk > 0) {
      const a = P(.5, -.5, 0), b = P(.5, .5, 0), off = [.5 * 60, .866 * 60], A = [a[0] + off[0], a[1] + off[1]], B = [b[0] + off[0], b[1] + off[1]];
      hair(partial([A, B], outCubic(dk)), C.ink, 1); hair([a, [A[0] + 8, A[1] + 12]], C.ink, .8, .6); hair([b, [B[0] + 8, B[1] + 12]], C.ink, .8, .6);
      X.save(); X.translate((A[0] + B[0]) / 2 + 26, (A[1] + B[1]) / 2 + 22); X.rotate(Math.atan2(B[1] - A[1], B[0] - A[0])); txt('1.000 u', 0, 0, { fam: F.mono, size: 17, col: C.ink, a: dk, align: 'center' }); X.restore();
    }
    // the mortarboard drops onto the cube on beat 3 (14.25), springs
    const capT = 2.25, capK = seg(t, capT - .45, capT);
    if (t > capT - .45) {
      const drop = (1 - inCubic(capK)) * -520, sq = spring(t, capT, 6, 20) * .08;
      const tc = P(0, 0, 1), cy = tc[1] + drop - 10, cx = tc[0];
      X.save(); X.translate(cx, cy); X.scale(1 + sq, 1 - sq); X.rotate(-.05 + spring(t, capT, 5, 13) * .06);
      // board: an iso square, the skull cap under it
      const bs = 150, bd = [[0, -bs * .5], [bs * .87, 0], [0, bs * .5], [-bs * .87, 0]];
      X.fillStyle = C.ink; X.beginPath(); X.ellipse(0, 26, 92, 34, 0, 0, Math.PI); X.lineTo(-92, 0); X.closePath(); X.fill();
      X.fillRect(-92, 0, 184, 26);
      X.beginPath(); bd.forEach((p, i) => i ? X.lineTo(p[0], p[1] - 6) : X.moveTo(p[0], p[1] - 6)); X.closePath(); X.fill();
      X.strokeStyle = C.bone; X.lineWidth = 1; X.globalAlpha = .5; X.beginPath(); for (let i = -6; i <= 6; i++) { X.moveTo(i * 22 - 40, -60); X.lineTo(i * 22 + 40, 60); } X.save(); X.beginPath(); bd.forEach((p, i) => i ? X.lineTo(p[0], p[1] - 6) : X.moveTo(p[0], p[1] - 6)); X.closePath(); X.clip(); X.beginPath(); for (let i = -8; i <= 8; i++) { X.moveTo(i * 20 - 40, -80); X.lineTo(i * 20 + 40, 80); } X.stroke(); X.restore(); X.globalAlpha = 1;
      // tassel, swinging
      const sw = spring(t, capT, 3, 9) * .9;
      const tas = [[0, -6], [bs * .87 * .9, -2], [bs * .87 * .9 + Math.sin(sw) * 90, 90 * Math.cos(sw)]];
      line(X, tas, C.signal, 3); glow(g => line(g, tas, C.signal, 4, .6));
      X.restore();
    }
    // plotter pen = the spark
    if (pen) spark(pen[0], pen[1], T, { scale: .8, rate: 0 });
    // title block, bottom right, like an engineering drawing
    const tb = seg(t, 2.8, 3.2);
    if (tb > 0) {
      const x = 1440, y = 900, w = 420, h = 112;
      X.save(); X.globalAlpha = tb; X.strokeStyle = C.ink; X.lineWidth = 1.5; X.strokeRect(x, y, w, h);
      hair([[x, y + 56], [x + w, y + 56]], C.ink, 1); hair([[x + 210, y + 56], [x + 210, y + h]], C.ink, 1);
      txt('DWG. FINAL-PROJECT-01', x + 14, y + 36, { fam: F.monoM, size: 19, col: C.ink });
      txt('ENGINE: UNITY', x + 14, y + 92, { fam: F.mono, size: 16, col: C.ink });
      txt('EST. CPH 2004', x + 224, y + 92, { fam: F.mono, size: 16, col: C.ink });
      X.restore();
    }
    camEnd();
    const inkWords = (w, t0, acc) => [w, t0, acc];
    X.save(); // headline in ink on the paper
    const sv = C.bone; C.bone = C.ink;
    headline(t, [inkWords('Final', .3), inkWords('project:', .6)], [['Unity3D.', 1.5, true]], { y: 290, size: 112, gap: 124 });
    typed('Built in Unity while it was a', 124, 520, t, 2.6, { size: 22, col: C.ink, cps: 44 });
    typed('small Danish startup.', 124, 552, t, 3.25, { size: 22, col: C.ink, cps: 44 });
    footnote('It has since grown a little.', 124, 604, t, 4.1, { col: C.graphite, size: 19 });
    C.bone = sv; X.restore();
  }

  // ======================================================= AGENCY 17.25–22.5 · schematic
  function shotAgency(T, lt) {
    const t = lt;
    const nodes = { web: [760, 640], api: [1200, 640], db: [1640, 640] };
    const z = lerp(1, 1.05, smooth(seg(t, 0, 5.25)));
    cam(lerp(1160, 1230, smooth(seg(t, 0, 5.25))), 600, z);
    const drawK = k => seg(t, k, k + .45);
    // browser
    const bk = drawK(.25);
    if (bk > 0) {
      const [x, y] = nodes.web, w = 300, h = 220;
      const R = rectP(x - w / 2, y - h / 2, w, h); hair(partial(R, outCubic(bk)), C.bone, 2);
      if (bk >= 1) { hair([[x - w / 2, y - h / 2 + 34], [x + w / 2, y - h / 2 + 34]], C.bone, 1.4); for (let i = 0; i < 3; i++) { X.strokeStyle = C.bone; X.lineWidth = 1.4; X.beginPath(); X.arc(x - w / 2 + 20 + i * 18, y - h / 2 + 17, 5, 0, TAU); X.stroke(); } for (let i = 0; i < 5; i++) hair([[x - w / 2 + 24, y - h / 2 + 64 + i * 26], [x - w / 2 + 24 + (180 - i * 22) * (.6 + .4 * hash(i)), y - h / 2 + 64 + i * 26]], C.ash, 5, .5); }
      txt('client', x, y + h / 2 + 40, { fam: F.mono, size: 18, col: C.ash, a: bk, align: 'center' });
    }
    // API: a box with a turning gear
    const ak = drawK(.85);
    if (ak > 0) {
      const [x, y] = nodes.api, w = 220, h = 220;
      hair(partial(rectP(x - w / 2, y - h / 2, w, h), outCubic(ak)), C.bone, 2);
      if (ak > .5) {
        const n = 12, r0 = 56, r1 = 72, rot = t * (1.2 + 3 * seg(t, 2, 5));
        const G = []; for (let i = 0; i <= n * 4; i++) { const a = rot + i / (n * 4) * TAU, r = (i % 4 < 2) ? r1 : r0; G.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
        hair(G, C.bone, 2, seg(ak, .5, 1)); X.strokeStyle = C.bone; X.lineWidth = 2; X.beginPath(); X.arc(x, y, 20, 0, TAU); X.stroke();
      }
      txt('api', x, y + h / 2 + 40, { fam: F.mono, size: 18, col: C.ash, a: ak, align: 'center' });
    }
    // DB cylinder
    const dk = drawK(1.35);
    if (dk > 0) {
      const [x, y] = nodes.db, rx = 110, ry = 30, h = 190, t0 = y - h / 2;
      const S = arcPts(x, t0, rx, ry, 0, TAU, 60).concat([[x + rx, t0], [x + rx, t0 + h]], arcPts(x, t0 + h, rx, ry, 0, Math.PI, 40), [[x - rx, t0]]);
      hair(partial(S, outCubic(dk)), C.bone, 2);
      if (dk >= 1) for (let i = 1; i < 3; i++) hair(arcPts(x, t0 + i * h / 3, rx, ry, 0, Math.PI, 40), C.bone, 1.2, .6);
      txt('db', x, y + h / 2 + 70, { fam: F.mono, size: 18, col: C.ash, a: dk, align: 'center' });
    }
    // pipes and packets
    const pk = seg(t, 1.8, 2.2);
    const pipes = [[[nodes.web[0] + 150, 628], [nodes.api[0] - 110, 628]], [[nodes.api[0] + 110, 628], [nodes.db[0] - 110, 628]]];
    const pipesB = pipes.map(([a, b]) => [[b[0], b[1] + 24], [a[0], a[1] + 24]]);
    if (pk > 0) [...pipes, ...pipesB].forEach(p => hair(partial(p, outCubic(pk)), C.graphite, 1.2));
    // speed: phase = ∫ v dt with v rising (so packets are a pure function of t)
    const ph = u => 0.9 * u + 0.55 * u * u + 0.09 * u * u * u;
    if (t > 2.1) {
      const u = t - 2.1, n = 5;
      [...pipes, ...pipesB].forEach((p, pi) => {
        for (let i = 0; i < n; i++) {
          const f = frac(ph(u) + i / n + pi * .13), q = pointAt(p, f), len = 16 + 30 * seg(u, 0, 3);
          const dir = p[1][0] > p[0][0] ? 1 : -1, tail = [q[0] - dir * len, q[1]];
          line(X, [tail, q], C.signal, 3); glow(g => line(g, [tail, q], C.ember, 5));
        }
      });
    }
    // latency readout, top right: 480 ms → 12 ms
    const lk = seg(t, 2.2, 4.8), ms = Math.round(lerp(480, 12, outExpo(lk)));
    if (t > 2.2) {
      txt('p95 latency', 1760, 380, { fam: F.mono, size: 18, col: C.ash, align: 'right' });
      txt(ms + ' ms', 1760, 440, { fam: F.cond, size: 58, col: ms < 60 ? C.signal : C.bone, align: 'right', glow: ms < 60 ? .6 : 0 });
    }
    camEnd();
    // headline; "speed." is set wide
    sung([['Full', .3], ['stack,', .6]], 120, 280, t, { size: 112, fam: F.cond });
    sung([['full', 1.5], ['speed.', 1.85, true]], 120, 400, t, { size: 112, fam: F.wide });
    footnote('At a young agency, where everything was due yesterday.', 124, 930, t, 3.0, { col: C.bone, size: 20 });
  }

  // ======================================================= ORBISCADA 22.5–33 · one turbine, then fifteen hundred
  const G = 540;   // grid pitch (world px)
  const ORDER = (() => {   // grid cells in order of distance from the first turbine (the field grows outward)
    const L = []; for (let j = -24; j <= 24; j++) for (let i = -30; i <= 30; i++) L.push([i, j, Math.hypot(i * 1.0, j * 1.25) + hash2(i, j) * .6]);
    L.sort((a, b) => a[2] - b[2]); return L;
  })();
  function turbine(ctx, x, y, s, rot, detail, col = C.bone) {
    // y = ground; s = scale (1 = 460 px tall hub height)
    const hub = [x, y - 460 * s];
    if (detail > .5) {
      const tower = new Path2D(); tower.moveTo(x - 16 * s, y); tower.lineTo(x - 7 * s, hub[1] + 8 * s); tower.lineTo(x + 7 * s, hub[1] + 8 * s); tower.lineTo(x + 16 * s, y); tower.closePath();
      ctx.fillStyle = C.ink; ctx.fill(tower); ctx.save(); ctx.clip(tower); ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.beginPath(); for (let k = -24; k <= 24; k++) { ctx.moveTo(x + k * 4 * s, y); ctx.lineTo(x + k * 4 * s, hub[1]); } ctx.globalAlpha = .6; ctx.stroke(); ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke(tower);
      for (let b = 0; b < 3; b++) {
        const a = rot + b * TAU / 3, c = Math.cos(a), sn = Math.sin(a), Lb = 250 * s, wb = 14 * s;
        const bl = new Path2D(); bl.moveTo(hub[0] + -sn * wb * .3, hub[1] + c * wb * .3); bl.quadraticCurveTo(hub[0] + c * Lb * .3 - sn * wb, hub[1] + sn * Lb * .3 + c * wb, hub[0] + c * Lb, hub[1] + sn * Lb);
        bl.quadraticCurveTo(hub[0] + c * Lb * .4 + sn * wb * .3, hub[1] + sn * Lb * .4 - c * wb * .3, hub[0] + sn * wb * .3, hub[1] - c * wb * .3); bl.closePath();
        ctx.fillStyle = C.ink; ctx.fill(bl); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke(bl);
        ctx.save(); ctx.clip(bl); ctx.beginPath(); for (let k = 0; k < 16; k++) { const d = k / 16 * Lb; ctx.moveTo(hub[0] + c * d - sn * 20 * s, hub[1] + sn * d + c * 20 * s); ctx.lineTo(hub[0] + c * d + sn * 20 * s, hub[1] + sn * d - c * 20 * s); } ctx.lineWidth = 1; ctx.globalAlpha = .6; ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(hub[0] + 8 * s, hub[1], 30 * s, 14 * s, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(hub[0], hub[1], 9 * s, 0, TAU); ctx.fillStyle = col; ctx.fill();
    } else {
      ctx.moveTo(x, y); ctx.lineTo(hub[0], hub[1]);
      for (let b = 0; b < 3; b++) { const a = rot + b * TAU / 3; ctx.moveTo(hub[0], hub[1]); ctx.lineTo(hub[0] + Math.cos(a) * 250 * s, hub[1] + Math.sin(a) * 250 * s); }
    }
  }
  const COUNTRIES = [['DENMARK', 0, 1], ['UK', 5.4, 340], ['USA', 6.4, 900], ['JAPAN', 7.25, 1512]];
  function countAt(t) {   // turbines standing at local time t
    if (t < 3.75) return 1;
    return Math.round(kf(t, [[3.75, 1], [4.5, 12], [5.4, 60, outCubic], [6.4, 340], [7.25, 900], [8.25, 1512]], inOutCubic));
  }
  function shotOrbis(T, lt) {
    const t = lt;
    const z = t < 3.75 ? lerp(1, 1.08, smooth(seg(t, 0, 3.75))) : kf(t, [[3.75, 1.08], [8.3, .031, inOutCubic]]);
    const base = [960, 900];
    // ground: engraved land lines (fade out as we pull back)
    const la = 1 - seg(t, 3.75, 4.8);
    cam(base[0] + 120 * (1 - seg(t, 3.75, 6)), base[1] - 300 * (t < 3.75 ? 1 : 1 - seg(t, 3.75, 5.5)) - 80, z);
    if (la > 0) {
      X.save(); X.globalAlpha = la;
      for (let i = 0; i < 26; i++) {
        const y = base[1] + 10 + i * (8 + i * 1.3), P = []; for (let x = -1400; x <= 3400; x += 40) P.push([x, y + Math.sin(x * .004 + i * .7) * (6 + i) + Math.sin(x * .0013 + i) * 20]);
        hair(P, C.bone, 1, .55 - i * .016);
      }
      X.restore();
    }
    const n = countAt(t), rise = backOut(seg(t, .3, 1.0), 1.2), rot0 = t * (0.6 + .9 * seg(t, .6, 3));
    // the first turbine, rising
    if (z > .25) {
      X.save(); X.translate(base[0], base[1]); X.scale(1, rise); X.translate(-base[0], -base[1]);
      turbine(X, base[0], base[1], 1, rot0, 1); X.restore();
    }
    // the field
    if (n > 1 || z <= .25) {
      const lw = 1.3 / z;
      const pathOld = new Path2D(), ctxP = { moveTo: (a, b) => pathOld.moveTo(a, b), lineTo: (a, b) => pathOld.lineTo(a, b) };
      const hot = [];
      for (let i = z > .25 ? 1 : 0; i < Math.min(n, ORDER.length); i++) {
        const [gi, gj] = ORDER[i], x = base[0] + gi * G + (hash2(gi, gj) - .5) * 120, y = base[1] + gj * G * .8;
        const born = i < 12 ? 3.75 + i * .06 : lerp(4.5, 8.25, (i - 12) / 1500);
        const r = rot0 + hash2(gj, gi) * TAU, age = t - born;
        if (z > .25) { turbine(X, x, y, 1, r, 1); continue; }
        if (age < .35) hot.push([x, y, r]); else turbine(ctxP, x, y, 1, r, 0);
      }
      X.strokeStyle = C.bone; X.lineWidth = lw; X.globalAlpha = .85; X.stroke(pathOld); X.globalAlpha = 1;
      if (hot.length) { const pH = new Path2D(), cH = { moveTo: (a, b) => pH.moveTo(a, b), lineTo: (a, b) => pH.lineTo(a, b) }; hot.forEach(([x, y, r]) => turbine(cH, x, y, 1, r, 0)); X.strokeStyle = C.signal; X.lineWidth = lw * 1.3; X.stroke(pH); glow(g => { g.strokeStyle = C.signal; g.lineWidth = lw * 2; g.stroke(pH); }); }
    }
    camEnd();
    { const sa = seg(t, 3.9, 4.6); if (sa > 0) { const g = X.createLinearGradient(0, 0, 0, 380); g.addColorStop(0, rgba(C.ink, .9 * sa)); g.addColorStop(1, rgba(C.ink, 0)); X.fillStyle = g; X.fillRect(0, 0, W, 380); } }
    // title
    sung([['OrbiSCADA.', .3, true]], 120, 250, t, { size: 124, fam: F.black });
    typed('SCADA for wind turbines · freelance, five years.', 124, 312, t, 1.0, { size: 22, col: C.bone, cps: 40 });
    // odometer: the count
    const cnt = countAt(t), s = cnt >= 1512 ? '1,500+' : cnt.toLocaleString('en-US');
    const ck = seg(t, 1.2, 1.6);
    if (ck > 0) {
      X.save(); X.globalAlpha = ck;
      X.fillStyle = C.ink; X.globalAlpha = ck * .82; X.fillRect(100, 720, 640, 250); X.globalAlpha = ck;
      txt(s, 120, 900, { fam: F.cond, size: 190, col: cnt >= 1512 ? C.signal : C.bone, glow: cnt >= 1512 ? .7 : 0, track: -2 });
      txt(cnt === 1 ? 'turbine · Denmark' : `turbines · ${COUNTRIES.filter(c => t >= c[1]).length} ${COUNTRIES.filter(c => t >= c[1]).length > 1 ? 'countries' : 'country'}`, 124, 950, { fam: F.mono, size: 20, col: C.ash });
      X.restore();
    }
    // country ledger, right
    COUNTRIES.forEach(([name, t0], i) => {
      if (t < Math.max(t0, 1.4)) return; const k = seg(t, Math.max(t0, 1.4), Math.max(t0, 1.4) + .25);
      const y = 680 + i * 50;
      X.fillStyle = C.ink; X.globalAlpha = .8 * k; X.fillRect(1480, y - 32, 330, 44); X.globalAlpha = 1;
      txt(name, 1500, y, { fam: F.monoM, size: 22, col: C.bone, a: k, track: 2 });
      txt(i === 0 ? '2010s' : '✓', 1790, y, { fam: F.mono, size: 20, col: C.signal, a: k, align: 'right' });
    });
    stamp('BØRSEN GAZELLE 2018', 1560, 250, t, 8.9, { size: 30, rot: .05 });
    footnote('Central Jutland. The wind does most of the work.', 1850, 312, t, 9.3, { align: 'right' });
    POST.shake = shake(10 * hit(t, 9.0, 12), T);
  }

  // ======================================================= CLOVR 33–39.75 · following the money
  const NODES = (() => {
    const N = []; let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) N.push([760 + r() * 1060, 170 + r() * 740, '0x' + Math.floor(r() * 65535).toString(16).padStart(4, '0') + '…' + Math.floor(r() * 255).toString(16).padStart(2, '0')]);
    return N;
  })();
  const EDGES = (() => { const E = []; NODES.forEach((a, i) => { const d = NODES.map((b, j) => [Math.hypot(a[0] - b[0], a[1] - b[1]), j]).sort((p, q) => p[0] - q[0]); for (let k = 1; k <= 3; k++) if (d[k][1] > i) E.push([i, d[k][1]]); }); return E; })();
  const TRACE = (() => {   // a path of 6 hops: nearest-first, moving right
    const P = [NODES.reduce((b, n, i) => n[0] < NODES[b][0] ? i : b, 0)];
    while (P.length < 7) { const a = NODES[P[P.length - 1]]; let best = -1, bd = 1e9; NODES.forEach((n, j) => { if (P.includes(j)) return; const d = Math.hypot(n[0] - a[0], n[1] - a[1]) - (n[0] - a[0]) * .6; if (d < bd) { bd = d; best = j; } }); P.push(best); }
    return P;
  })();
  function guilloche(cx, cy, R, t, a) {
    X.save(); X.globalAlpha = a; X.strokeStyle = C.graphite; X.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const P = [], Rr = R * (1 - k * .18), r = Rr * .31, d = Rr * .52;
      for (let i = 0; i <= 1400; i++) { const th = i / 1400 * TAU * 11 + t * .05 * (k + 1); P.push([cx + (Rr - r) * Math.cos(th) + d * Math.cos((Rr - r) / r * th), cy + (Rr - r) * Math.sin(th) - d * Math.sin((Rr - r) / r * th)]); }
      X.beginPath(); P.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.stroke();
    }
    X.restore();
  }
  function shotClovr(T, lt) {
    const t = lt, hop = .55, t0 = 1.1;
    guilloche(1320, 560, 470, t, .5);
    const k = seg(t, 0, t0 + 6 * hop);
    // follow the glass
    const hopK = t => clamp((t - t0) / hop, 0, 6);
    const pos = t => { const h = hopK(t), i = Math.min(5, Math.floor(h)), f = inOutCubic(h - i), a = NODES[TRACE[i]], b = NODES[TRACE[Math.min(6, i + 1)]]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; };
    const p = pos(t);
    const z = lerp(1, 1.12, smooth(seg(t, 0, 5)));
    cam(lerp(1290, p[0] * .35 + 1290 * .65, smooth(seg(t, .5, 2))), lerp(540, p[1] * .3 + 540 * .7, smooth(seg(t, .5, 2))), z);
    // edges and nodes
    const ea = seg(t, .1, .7);
    EDGES.forEach(([i, j], n) => { const kk = seg(t, .1 + n * .012, .5 + n * .012); if (kk > 0) hair(partial([NODES[i], NODES[j]], outCubic(kk)), C.graphite, 1, .9); });
    NODES.forEach(([x, y, id], i) => {
      const kk = seg(t, .2 + i * .02, .5 + i * .02); if (kk <= 0) return;
      X.fillStyle = C.ink; X.beginPath(); X.arc(x, y, 12 * backOut(kk), 0, TAU); X.fill(); X.strokeStyle = C.bone; X.lineWidth = 1.6; X.stroke();
      txt(id, x + 18, y + 6, { fam: F.monoL, size: 14, col: C.ash, a: kk * .8 });
    });
    // the trace, hop by hop, in signal
    const h = hopK(t);
    for (let i = 0; i < 6; i++) {
      const kk = clamp(h - i); if (kk <= 0) break;
      const a = NODES[TRACE[i]], b = NODES[TRACE[i + 1]];
      fuse([a, [lerp(a[0], b[0], inOutCubic(kk)), lerp(a[1], b[1], inOutCubic(kk))]], { w: 2.6, hot: kk < 1 ? 120 : 0 });
      X.fillStyle = C.signal; X.beginPath(); X.arc(a[0], a[1], 6, 0, TAU); X.fill();
    }
    const found = t0 + 6 * hop;   // 4.4 → 37.4
    if (t > t0 && t < found + .1) spark(p[0], p[1], T, { head: pos, from: T - lt + t0, scale: .8, rate: 26 });
    // magnifier following the coin
    if (t > t0 - .3) {
      const gk = seg(t, t0 - .3, t0), gx = p[0] + 40, gy = p[1] - 40, R = 74;
      X.save(); X.globalAlpha = gk; X.strokeStyle = C.bone; X.lineWidth = 3; X.beginPath(); X.arc(gx, gy, R, 0, TAU); X.stroke();
      X.lineWidth = 12; X.beginPath(); X.moveTo(gx + R * .72, gy + R * .72); X.lineTo(gx + R * 1.5, gy + R * 1.5); X.stroke();
      X.lineWidth = 1; X.globalAlpha = gk * .5; X.beginPath(); X.moveTo(gx - R, gy); X.lineTo(gx + R, gy); X.moveTo(gx, gy - R); X.lineTo(gx, gy + R); X.stroke(); X.restore();
    }
    // found: a ring pops on the last wallet
    const last = NODES[TRACE[6]];
    if (t > found) {
      const rk = backOut(seg(t, found, found + .3), 2.2);
      fuse(arcPts(last[0], last[1], 40 * rk, 40 * rk, 0, TAU, 60), { w: 3, hot: 0 });
      glow(g => { g.strokeStyle = C.signal; g.lineWidth = 8; g.beginPath(); g.arc(last[0], last[1], 40 * rk, 0, TAU); g.stroke(); });
    }
    camEnd();
    if (t > found) { const sp = [last[0], last[1]]; }
    headline(t, [['Following', .3]], [['the', .75], ['money.', 1.1, true]], { y: 260, size: 112, gap: 118 });
    // the ledger: one line per hop
    for (let i = 0; i < 6; i++) {
      const tt = t0 + (i + 1) * hop - .1; if (t < tt) break;
      const a = NODES[TRACE[i]][2], b = NODES[TRACE[i + 1]][2], amt = (2.5 - i * .31 + hash(i) * .05).toFixed(3);
      typed(`${String(i + 1).padStart(2, '0')}  ${a} → ${b}  ${amt}`, 124, 500 + i * 32, t, tt, { size: 18, col: i === 5 && t > found ? C.signal : C.ash, cps: 90, caret: false });
    }
    POST.shake = shake(12 * stamp('FOUND', 1500, 900, t, found + .1, { size: 46, rot: -.07 }), T);
    typed('Clovr Labs · crypto forensic analytics', 124, 760, t, 1.6, { size: 20, col: C.bone, cps: 50 });
    footnote('The money always went somewhere.', 124, 800, t, 2.4);
  }

  // ======================================================= N0 39.75–45 · the prompt, then the workspace
  const TOK = [['The', .15], [' workspace', .45], [' of', .75], [' the', .95], [' future', 1.6]];
  const DIST = [['future', .61], ['week', .12], ['month', .09], ['past', .07], ['meeting', .05]];
  function shotN0(T, lt) {
    const t = lt, enter = 2.25;   // ⏎ on beat 56 (42.0)
    // the prompt field; after ⏎ it opens into the workspace window
    const ok = outExpo(seg(t, enter, enter + .5));
    const fw = lerp(1080, 1320, ok), fh = lerp(96, 640, ok), fx = 960 - fw / 2, fy = lerp(560, 300, ok);
    POST.flash = .2 * hit(t, enter, 12); POST.zoom = 1 + .02 * hit(t, enter, 6);
    X.fillStyle = C.ink2; X.fillRect(fx, fy, fw, fh);
    X.strokeStyle = t < enter ? C.bone : C.graphite; X.lineWidth = 1.5; X.strokeRect(fx, fy, fw, fh);
    if (t < enter + .05) {
      // tokens typed in, each with a flicker of its next-token distribution
      let x = fx + 34;
      txt('>', x, fy + 62, { fam: F.mono, size: 34, col: C.signal }); x += 40;
      TOK.forEach(([w, t0], i) => {
        if (t < t0) return;
        const last = i === TOK.length - 1, col = last ? C.signal : C.bone;
        txt(w, x, fy + 62, { fam: F.mono, size: 34, col, glow: last ? .7 : 0 });
        const tw0 = tw(w, F.mono, 34);
        if (last && t < enter) {   // the readable distribution above the last token
          const dk = seg(t, 1.05, 1.25);
          DIST.forEach(([c, p], j) => {
            const y = fy - 190 + j * 34, sel = j === 0 && t > t0;
            txt(c, x + 20, y, { fam: F.mono, size: 20, col: sel ? C.signal : C.ash, a: dk });
            X.fillStyle = sel ? C.signal : C.graphite; X.globalAlpha = dk; X.fillRect(x + 150, y - 14, 220 * p * dk, 12); X.globalAlpha = 1;
            txt(p.toFixed(2), x + 150 + 220 * p + 12, y, { fam: F.mono, size: 16, col: C.ash, a: dk });
          });
          if (t > t0) txt('▸ sampled', x + 20, fy - 190 - 40, { fam: F.mono, size: 16, col: C.signal, a: seg(t, t0, t0 + .1) });
        } else if (!last && t < t0 + .3) {   // a brief flicker for the other tokens
          const fk = 1 - seg(t, t0 + .1, t0 + .3);
          for (let j = 0; j < 3; j++) { X.fillStyle = j ? C.graphite : C.bone; X.globalAlpha = fk; X.fillRect(x + 10, fy - 40 - j * 14, (60 - j * 18) * (1 + hash(i * 3 + j)), 8); }
          X.globalAlpha = 1;
        }
        x += tw0;
      });
      // caret + ⏎ key hint
      if (t > 1.7) txt('⏎', fx + fw - 60, fy + 62, { fam: F.mono, size: 34, col: frac(t * 2) < .5 ? C.bone : C.graphite });
      if (t < 1.6) { X.fillStyle = C.signal; X.fillRect(x + 4, fy + 34, 18, 34); }
    } else {
      // the workspace: a sidebar, a header, slots; people, agents and apps fly in and click into place
      const a = seg(t, enter + .2, enter + .5);
      X.save(); X.globalAlpha = a;
      hair([[fx + 240, fy], [fx + 240, fy + fh]], C.graphite, 1); hair([[fx, fy + 64], [fx + fw, fy + 64]], C.graphite, 1);
      txt('n0', fx + 30, fy + 44, { fam: F.black, size: 30, col: C.bone });
      txt('workspace', fx + 270, fy + 42, { fam: F.mono, size: 18, col: C.ash });
      ['# general', '# builds', '# research', '@ agents'].forEach((s, i) => txt(s, fx + 30, fy + 120 + i * 40, { fam: F.mono, size: 18, col: i === 3 ? C.signal : C.ash }));
      X.restore();
      const items = [];
      for (let i = 0; i < 12; i++) items.push({ kind: ['person', 'agent', 'app'][i % 3], i });
      items.forEach(({ kind, i }) => {
        const t0 = enter + .4 + i * .13, k = seg(t, t0, t0 + .42); if (k <= 0) return;
        const col = i % 4, row = Math.floor(i / 4), tx = fx + 330 + col * 250, ty = fy + 150 + row * 150;
        const ang = hash(i * 9.1) * TAU, fromX = 960 + Math.cos(ang) * 1300, fromY = 540 + Math.sin(ang) * 900;
        const e = outCubic(k), x = lerp(fromX, tx, e), y = lerp(fromY, ty, e) - Math.sin(e * Math.PI) * 120, land = hit(t, t0 + .42, 10);
        X.save(); X.translate(x, y); X.scale(1 + .15 * land, 1 + .15 * land);
        X.strokeStyle = C.bone; X.lineWidth = 2; X.fillStyle = C.ink;
        if (kind === 'person') { X.beginPath(); X.arc(0, 0, 36, 0, TAU); X.fill(); X.stroke(); X.beginPath(); X.arc(0, -8, 12, 0, TAU); X.stroke(); X.beginPath(); X.arc(0, 26, 20, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); }
        else if (kind === 'agent') { const S = []; for (let q = 0; q < 8; q++) { const r = q % 2 ? 12 : 38, aa = q / 8 * TAU - Math.PI / 2; S.push([Math.cos(aa) * r, Math.sin(aa) * r]); } X.beginPath(); S.forEach((p, q) => q ? X.lineTo(...p) : X.moveTo(...p)); X.closePath(); X.fillStyle = C.signal; X.fill(); glow(g => { g.save(); g.translate(x, y); g.fillStyle = C.signal; g.beginPath(); S.forEach((p, q) => q ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fill(); g.restore(); }); }
        else { X.beginPath(); X.roundRect(-34, -34, 68, 68, 12); X.fill(); X.stroke(); for (let q = 0; q < 4; q++) { X.strokeRect(-20 + (q % 2) * 22, -20 + Math.floor(q / 2) * 22, 16, 16); } }
        X.restore();
        txt(kind, tx + 56, ty + 8, { fam: F.monoL, size: 16, col: C.ash, a: seg(t, t0 + .4, t0 + .6) });
      });
      // all pulse together on beat 59 (44.25)
      const pu = hit(t, 4.5, 6);
      if (pu > .01) { X.strokeStyle = C.signal; X.globalAlpha = pu; X.lineWidth = 3; X.strokeRect(fx - 8 * (1 - pu) * 3, fy - 8 * (1 - pu) * 3, fw + 48 * (1 - pu), fh + 48 * (1 - pu)); X.globalAlpha = 1; }
      txt('People, agents and apps. One place.', 960, fy + fh + 64, { fam: F.med, size: 34, col: C.bone, a: seg(t, enter + 1.2, enter + 1.5), align: 'center' });
      txt('nzero.pro', 960, fy + fh + 104, { fam: F.mono, size: 20, col: C.signal, a: seg(t, enter + 1.5, enter + 1.8), align: 'center' });
    }
    if (t < enter) {
      sung([['The', .15], ['workspace', .45], ['of', .75], ['the', .95], ['future.', 1.6, true]], 120, 300, t, { size: 84, fam: F.black });
      footnote('p = 0.61. We took it.', 124, 800, t, 1.8);
    }
  }

  // ======================================================= WORKSHOP 45–53.25 · contact sheet (paper)
  const CARDS = [
    ['n0', 'the AI workspace for teams'], ['Claude Agent SDK Go', 'Claude agents, in Go'], ['Gource Viewer', 'repo history as a film'],
    ['Gitilla', 'your GitHub as a city'], ['Codex SDK Go', 'the Codex agent, in Go'], ['wee.cat', 'Catalan supermarket prices'],
    ['Donna', 'autonomous AI pentesting'], ['The Agentic Crew', 'three free books'], ['Hefty', 'what’s eating your disk'],
  ];
  function shotWorkshop(T, lt) {
    const t = lt; POST.paper = 1; POST.bloom = .7; POST.vignette = .25;
    fillAll(C.bone); grid(1, C.ink, { minor: .035, major: .08 });
    const sv = C.bone; C.bone = C.ink;
    sung([['Always', .25], ['building.', .6]], 120, 200, t, { size: 92, fam: F.black });
    sung([['Always', 1.5], ['shipping.', 1.85, true]], 120 + tw('Always building.', F.black, 92, -1.84) + 40, 200, t, { size: 92, fam: F.black });
    C.bone = sv;
    const x0 = 120, y0 = 300, cw = 540, ch = 200, gx = 30, gy = 26;
    let kick = 0;
    CARDS.forEach(([name, tag], i) => {
      const t0 = .9 + i * .375, k = seg(t, t0, t0 + .18); if (k <= 0) return;
      const c = i % 3, r = Math.floor(i / 3), x = x0 + c * (cw + gx), y = y0 + r * (ch + gy);
      const dy = (1 - outCubic(k)) * -40, bounce = hit(t, t0 + .18, 12) * 4;
      X.save(); X.translate(0, dy + bounce); X.globalAlpha = k;
      X.fillStyle = '#F7F3EB'; X.fillRect(x, y, cw, ch); X.strokeStyle = C.ink; X.lineWidth = 1.5; X.strokeRect(x, y, cw, ch);
      txt('No. ' + String(i + 1).padStart(2, '0'), x + 22, y + 36, { fam: F.mono, size: 16, col: C.graphite });
      txt(name, x + 22, y + 116, { fam: name.length > 14 ? F.cond : F.black, size: name.length > 14 ? 52 : 58, col: C.ink, track: -1 });
      txt(tag, x + 22, y + 164, { fam: F.mono, size: 18, col: C.graphite });
      X.restore();
      // SHIPPED, stamped across each card in a fast run after the last lands
      const st = 4.5 + i * .2;
      if (t > st) kick = Math.max(kick, stamp('SHIPPED', x + cw - 110, y + ch - 46, t, st, { size: 26, rot: -.12 + hash(i) * .1, lw: 3 }));
    });
    POST.shake = shake(9 * kick, T);
    footnote('Nine of them, anyway. The rest are on GitHub.', 1800, 1030, t, 6.6, { align: 'right', col: C.graphite });
  }

  // ======================================================= END 53.25–60 · end card, then back to the loop point
  function shotEnd(T, lt) {
    const t = lt, dur = 6.75;
    grid(.6 * (1 - seg(t, 5.6, 6.3)));
    const out = seg(t, 5.7, 6.55);        // un-engrave bottom-up, spark rides back to the top: the loop point
    const top = ME.bottom - ME.h;
    engraveMe(T, ME.cx, ME.bottom, ME.h, { reveal: 1 - inOutCubic(out), rim: 0, a: seg(t, 0, .35) });
    if (t < 5.7) orbitMark(T, seg(t, .9, 2.4));
    else { X.save(); X.globalAlpha = 1 - seg(t, 5.7, 6.1); orbitMark(T, 1); X.restore(); }
    // the spark: plotting the orbit, then parked, then riding the un-engraving up to the loop point
    const ok = seg(t, .9, 2.4);
    let sp = null;
    if (ok > 0 && ok < 1) { sp = null; }
    const w = ME.h / 1.25, burin = tt => [ME.cx + Math.sin((tt - 5.7) * 9) * w * .42 * (1 - seg(tt, 6.3, 6.55)), top + ME.h * (1 - inOutCubic(seg(tt, 5.7, 6.55)))];
    if (t >= 5.7) sp = burin(t);
    if (ok > 0 && ok < 1) { const hd = orbitMark(T, 0); }   // (the orbit pen head is drawn by orbitMark's fuse)
    if (sp) spark(sp[0], sp[1], T, { head: burin, from: T - lt + 5.7, rate: t < 6.55 ? 40 : 0 });
    else if (t >= 6.55) spark(ME.cx, top, T, { rate: 0 });
    // headline and name
    const txtA = 1 - seg(t, 5.4, 5.9);
    X.save(); X.globalAlpha = txtA;
    sung([['Serious', .3], ['code.', .7]], 120, 360, t, { size: 124, fam: F.black });
    sung([['Clear', 1.5], ['thinking.', 1.9, true]], 116, 500, t, { size: 150, fam: F.serifI6, track: 0 });
    const rk = seg(t, 2.6, 3.1);
    hair([[124, 580], [124 + 700 * outCubic(rk), 580]], C.bone, 1.4);
    txt('Rasmus Schlünsen', 124, 650, { fam: F.med, size: 52, col: C.bone, a: seg(t, 2.9, 3.3) });
    txt('Barcelona · schlunsen.com', 124, 700, { fam: F.mono, size: 22, col: C.ash, a: seg(t, 3.3, 3.7) });
    footnote('Plate IX of IX. Fin, for now.', 124, 985, t, 3.9);
    X.restore();
    // crop marks close back in (the loop point has them in place)
    cropMarks(seg(t, 4.6, 5.3));
  }

  shots([[0, shotOpen], [6, shotSecurity], [12, shotUnity], [17.25, shotAgency], [22.5, shotOrbis], [33, shotClovr], [39.75, shotN0], [45, shotWorkshop], [53.25, shotEnd]]);

  // standalone checks
  LOOPS.me = t => { grid(1); engraveMe(t, 960, 1080, 1000, {}); spark(400, 400, t, { head: tt => [400 + Math.sin(tt * 3) * 200, 400], rate: 40 }); };
  LOOPS.me.len = 4;
})();
