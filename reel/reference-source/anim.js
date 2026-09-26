/* Rasmus Schlünsen — a 60-second reel, drawn in plain JavaScript on a canvas.
 * The look follows schlunsen.github.io: warm paper, near-black ink, a bronze
 * accent, Archivo headlines with Georgia italic, JetBrains Mono labels and
 * "FIG." captions, and the living-system mesh. drawFrame(ctx, t).
 */
(function (g) {
  const T = g.RST, W = T.W, H = T.H, S = T.S;
  const PAPER = '#f3f0e8', PAPER2 = '#faf7f2', INK = '#181614', BODY = '#5f5a52', FAINT = '#8a8478', DIM = '#a39c8e';
  const LINE = '#d5cdbe', BRONZE = '#a06b2c', BRONZE_L = '#c49a5e', SIGNAL = '#f74f39', GREEN = '#00874a', N0BLUE = '#2d5bff';
  const DISPLAY = "'Archivo', 'Inter', system-ui, sans-serif", BODYF = "'Inter', system-ui, sans-serif", MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace", SERIF = "Georgia, 'Times New Roman', serif";

  // ── helpers ──────────────────────────────────────────────────────────
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const expo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
  const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const e = (t, at, dur = 0.8) => expo(prog(t, at, at + dur));

  function font(ctx, spec, ls) { ctx.font = spec; try { ctx.letterSpacing = ls || '0px'; } catch (_) {} }
  function text(ctx, str, x, y, o = {}) {
    ctx.save();
    font(ctx, o.font || `400 24px ${BODYF}`, o.ls);
    ctx.fillStyle = o.color || INK;
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  /** A line of type that slides up out of a mask. */
  function riseLine(ctx, str, x, y, size, t, at, o = {}) {
    const k = e(t, at, o.dur ?? 0.9);
    if (k <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 20, y - size * 1.05, W, size * 1.35);
    ctx.clip();
    text(ctx, str, x, y + (1 - k) * size * 1.2, { ...o, alpha: (o.alpha ?? 1) });
    ctx.restore();
  }
  function stroke(ctx, pts, o = {}) {
    const p = o.p ?? 1;
    if (p <= 0 || pts.length < 2) return;
    let total = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    let left = total * p;
    ctx.save();
    ctx.strokeStyle = o.color || INK; ctx.lineWidth = o.w ?? 1.6; ctx.globalAlpha *= o.alpha ?? 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const d = seg[i - 1];
      if (left >= d) ctx.lineTo(pts[i][0], pts[i][1]);
      else { const f = left / d; ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); }
      left -= d;
    }
    if (o.closed && p >= 1) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function dot(ctx, x, y, r, color, alpha = 1) { ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  const arcPts = (cx, cy, rx, ry, a0, a1, n = 40) => { const p = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; };

  // ── the living-system mesh (Fibonacci sphere + nearest neighbours) ────
  const SPH = (() => {
    const n = 220, pts = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    const edges = [];
    pts.forEach((p, i) => {
      const d = pts.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 4);
      d.forEach(([j]) => { if (i < j) edges.push([i, j]); });
    });
    return { pts, edges };
  })();
  function sphere(ctx, cx, cy, R, t, o = {}) {
    const a = t * 0.18 + (o.phase || 0), b = 0.35;
    const P = SPH.pts.map(([x, y, z]) => {
      let X = x * Math.cos(a) + z * Math.sin(a), Z = -x * Math.sin(a) + z * Math.cos(a);
      const Y = y * Math.cos(b) - Z * Math.sin(b); Z = y * Math.sin(b) + Z * Math.cos(b);
      const squash = 1 + 0.06 * Math.sin(t * 0.8 + y * 3); // it breathes
      return [cx + X * R * squash, cy + Y * R * squash, Z];
    });
    const shown = o.p ?? 1, ne = Math.floor(SPH.edges.length * shown);
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.lineWidth = 1;
    for (let k = 0; k < ne; k++) {
      const [i, j] = SPH.edges[k], z = (P[i][2] + P[j][2]) / 2;
      ctx.strokeStyle = z > 0 ? 'rgba(24,22,20,0.30)' : 'rgba(24,22,20,0.10)';
      ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke();
    }
    P.forEach(([x, y, z], i) => { if (i < shown * P.length && i % 7 === 0 && z > -0.2) dot(ctx, x, y, 3.6, BRONZE, 0.55 + 0.45 * z); });
    // orbit ring
    stroke(ctx, arcPts(cx, cy, R * 1.25, R * 0.32, -0.3, Math.PI * 2 - 0.3, 80).map(([x, y]) => [x, y + Math.sin((x - cx) / R) * 20]), { color: LINE, w: 1.2, p: shown });
    ctx.restore();
  }

  // ── the frame around everything (header, rule, timeline) ─────────────
  const CHAPTERS = [['security', '2010'], ['unity', '3D'], ['agency', 'AGENCY'], ['orbiscada', 'ORBISCADA'], ['clovr', 'CLOVR LABS'], ['n0', 'N0'], ['workshop', 'WORKSHOP']];
  const TL0 = 96, TL1 = W - 96, TLY = 1004;
  const tlX = (t) => lerp(TL0, TL1, prog(t, S.security[0], S.workshop[1]));
  function frame(ctx, t) {
    const a = e(t, 0.2, 1.2);
    text(ctx, 'RASMUS SCHLÜNSEN / SOFTWARE & SYSTEMS', 96, 84, { font: `400 17px ${MONO}`, ls: '1.5px', color: INK, alpha: a });
    dot(ctx, W - 424, 78, 5, GREEN, a);
    text(ctx, 'Available for select projects', W - 96, 84, { font: `400 17px ${MONO}`, align: 'right', color: INK, alpha: a });
    stroke(ctx, [[96, 118], [W - 96, 118]], { color: INK, w: 1.2, p: e(t, 0.3, 1.4) });
    // career timeline, 2010 → now
    const ta = prog(t, 5.6, 6.4) * (1 - prog(t, 52.6, 53.3));
    if (ta > 0) {
      ctx.save(); ctx.globalAlpha *= ta;
      stroke(ctx, [[TL0, TLY], [TL1, TLY]], { color: LINE, w: 1.4 });
      stroke(ctx, [[TL0, TLY], [tlX(t), TLY]], { color: INK, w: 1.8 });
      CHAPTERS.forEach(([k, lab]) => {
        const x = tlX(S[k][0]), on = t >= S[k][0];
        stroke(ctx, [[x, TLY - 7], [x, TLY + 7]], { color: on ? INK : DIM, w: 1.4 });
        text(ctx, lab, x, TLY + 34, { font: `400 14px ${MONO}`, ls: '1px', color: on ? INK : DIM, align: x > TL1 - 40 ? 'right' : 'left' });
      });
      text(ctx, 'NOW', TL1, TLY + 34, { font: `400 14px ${MONO}`, ls: '1px', align: 'right', color: t > 40 ? INK : DIM });
      dot(ctx, tlX(t), TLY, 7, BRONZE);
      ctx.restore();
    }
  }

  // ── a chapter's left column ──────────────────────────────────────────
  function column(ctx, t, sc, o) {
    const [a, b] = sc, out = 1 - prog(t, b - 0.55, b - 0.05), lift = prog(t, b - 0.55, b - 0.05) * 24;
    ctx.save(); ctx.globalAlpha *= out; ctx.translate(0, -lift);
    const x = 96;
    text(ctx, o.index, x, 262, { font: `400 17px ${MONO}`, ls: '1.5px', color: BRONZE, alpha: e(t, a + 0.1, 0.6) });
    stroke(ctx, [[x + 96, 256], [x + 136, 256]], { color: BRONZE, w: 1.2, p: e(t, a + 0.2, 0.6) });
    text(ctx, o.kicker, x + 152, 262, { font: `400 17px ${MONO}`, ls: '1.5px', color: FAINT, alpha: e(t, a + 0.25, 0.6) });
    let y = 380;
    o.head.forEach((ln, i) => {
      const italic = ln.startsWith('_');
      const s = ln.replace(/^_/, ''), size = o.size || 96;
      riseLine(ctx, s, x - 4, y, size, t, a + 0.3 + i * 0.1, italic ? { font: `italic 400 ${size}px ${SERIF}`, ls: `${-size * 0.06}px` } : { font: `800 ${size}px ${DISPLAY}`, ls: `${-size * 0.045}px` });
      y += size * 1.02;
    });
    if (o.sub) text(ctx, o.sub, x, y + 34, { font: `400 30px ${BODYF}`, color: BODY, alpha: e(t, a + 0.9, 0.8) });
    ctx.restore();
    return y + 34;
  }
  function fig(ctx, t, sc, label) {
    const [a, b] = sc, al = e(t, a + 0.8, 0.8) * (1 - prog(t, b - 0.5, b - 0.05));
    text(ctx, label, W - 96, 930, { font: `400 15px ${MONO}`, ls: '1.5px', align: 'right', color: FAINT, alpha: al });
  }
  const fade = (t, sc) => clamp(prog(t, sc[0], sc[0] + 0.4)) * (1 - prog(t, sc[1] - 0.5, sc[1] - 0.05));

  // ── 00 · opening ─────────────────────────────────────────────────────
  function open(t) {
    const ctx = C;
    const sc = S.open;
    column(ctx, t, sc, { index: '00', kicker: 'A SHORT FILM', head: ['Fifteen years.', "_Building what's next."], size: 104, sub: 'Software & systems, built to last.' });
    ctx.save(); ctx.globalAlpha *= 1 - prog(t, sc[1] - 0.6, sc[1]);
    sphere(ctx, 1450, 560, 270, t, { p: e(t, 0.4, 3.2) });
    ctx.restore();
    fig(ctx, t, sc, 'FIG. 001 — A LIVING SYSTEM');
  }

  // ── 01 · security ────────────────────────────────────────────────────
  function security(t) {
    const ctx = C, sc = S.security, a = sc[0];
    column(ctx, t, sc, { index: '01 / 07', kicker: '2010 — FIRST JOB', head: ['It started', '_with security.'], sub: 'An internship at a security company.' });
    const al = fade(t, sc);
    ctx.save(); ctx.globalAlpha *= al;
    const cx = 1420, cy = 560;
    // shackle + body
    stroke(ctx, arcPts(cx, cy - 120, 120, 130, Math.PI, Math.PI * 2, 40).concat([[cx + 120, cy - 40]]), { w: 2.2, p: e(t, a + 0.4, 1.2) });
    stroke(ctx, [[cx - 120, cy - 120], [cx - 120, cy - 40]], { w: 2.2, p: e(t, a + 0.4, 1.2) });
    stroke(ctx, rectPts(cx - 190, cy - 40, 380, 300), { w: 2.2, p: e(t, a + 0.7, 1.4) });
    // a lattice inside the body
    const pts = [];
    for (let i = 0; i < 26; i++) pts.push([cx - 170 + hash(i * 3.1) * 340, cy - 20 + hash(i * 5.7) * 260]);
    const lk = e(t, a + 1.4, 1.6);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(24,22,20,0.22)';
    pts.forEach((p, i) => {
      if (i / pts.length > lk) return;
      pts.map((q, j) => [j, Math.hypot(p[0] - q[0], p[1] - q[1])]).filter(([j]) => j !== i).sort((x, y) => x[1] - y[1]).slice(0, 3)
        .forEach(([j]) => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); });
      dot(ctx, p[0], p[1], i % 4 ? 2.4 : 4, i % 4 ? INK : BRONZE, 0.8);
    });
    // keyhole
    dot(ctx, cx, cy + 90, 16 * e(t, a + 2.0, 0.6), INK);
    ctx.fillStyle = INK; ctx.globalAlpha *= e(t, a + 2.0, 0.6);
    ctx.beginPath(); ctx.moveTo(cx - 10, cy + 96); ctx.lineTo(cx + 10, cy + 96); ctx.lineTo(cx + 14, cy + 150); ctx.lineTo(cx - 14, cy + 150); ctx.fill();
    ctx.restore();
    // scan line + hex column
    ctx.save(); ctx.globalAlpha *= al;
    const sy = cy - 40 + ((t - a) * 110) % 300;
    stroke(ctx, [[cx - 230, sy], [cx + 230, sy]], { color: SIGNAL, w: 1.4, alpha: 0.7 * e(t, a + 1.6, 0.5) });
    for (let i = 0; i < 16; i++) {
      const v = Math.floor(hash(i * 9.1 + Math.floor((t - a) * 3)) * 0xffffffff).toString(16).padStart(8, '0');
      text(ctx, '0x' + v, 1770, 300 + i * 34, { font: `400 16px ${MONO}`, color: i === 7 ? SIGNAL : DIM, align: 'right', alpha: e(t, a + 1.0 + i * 0.05, 0.5) });
    }
    ctx.restore();
    fig(ctx, t, sc, 'FIG. 002 — WHERE IT STARTED');
  }

  // ── 02 · Unity3D ─────────────────────────────────────────────────────
  const ICO = (() => {
    const p = (1 + Math.sqrt(5)) / 2;
    const v = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
    const ed = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { const d = Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]); if (Math.abs(d - 2) < 0.01) ed.push([i, j]); }
    return { v, ed };
  })();
  function project3(x, y, z, cx, cy, s, ry, rx) {
    let X = x * Math.cos(ry) + z * Math.sin(ry), Z = -x * Math.sin(ry) + z * Math.cos(ry);
    const Y = y * Math.cos(rx) - Z * Math.sin(rx); Z = y * Math.sin(rx) + Z * Math.cos(rx);
    const f = 6 / (6 + Z);
    return [cx + X * s * f, cy + Y * s * f, Z];
  }
  function unity(t) {
    const ctx = C, sc = S.unity, a = sc[0];
    column(ctx, t, sc, { index: '02 / 07', kicker: 'A DETOUR', head: ['Then a detour', '_into 3D.'], sub: 'Game development with Unity3D.' });
    const al = fade(t, sc);
    ctx.save(); ctx.globalAlpha *= al;
    const cx = 1420, cy = 500, ry = t * 0.6, rx = 0.45;
    // floor grid in perspective
    for (let i = -5; i <= 5; i++) {
      const p0 = project3(i * 0.9, 2.6, -4.5, cx, cy, 90, 0.25, rx), p1 = project3(i * 0.9, 2.6, 4.5, cx, cy, 90, 0.25, rx);
      stroke(ctx, [p0, p1], { color: LINE, w: 1.1, p: e(t, a + 0.4 + (i + 5) * 0.03, 0.8) });
      const q0 = project3(-4.5, 2.6, i * 0.9, cx, cy, 90, 0.25, rx), q1 = project3(4.5, 2.6, i * 0.9, cx, cy, 90, 0.25, rx);
      stroke(ctx, [q0, q1], { color: LINE, w: 1.1, p: e(t, a + 0.5 + (i + 5) * 0.03, 0.8) });
    }
    const P = ICO.v.map(([x, y, z]) => project3(x, y, z, cx, cy - 10, 105, ry, rx));
    const k = e(t, a + 0.6, 1.8);
    ICO.ed.forEach(([i, j], n) => { if (n / ICO.ed.length < k) stroke(ctx, [P[i], P[j]], { w: 1.6, alpha: (P[i][2] + P[j][2]) / 2 < 0 ? 0.9 : 0.35 }); });
    P.forEach(([x, y, z]) => dot(ctx, x, y, 4, BRONZE, k * (z < 0 ? 1 : 0.5)));
    // a small cube in orbit
    const ca = t * 1.3;
    const cube = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
    const CP = cube.map(([x, y, z]) => project3(x * 0.32 + Math.cos(ca) * 2.7, y * 0.32 - 0.4, z * 0.32 + Math.sin(ca) * 2.7, cx, cy - 10, 105, ry * 0.2, rx));
    [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]].forEach(([i, j]) => stroke(ctx, [CP[i], CP[j]], { color: BRONZE, w: 1.6, alpha: e(t, a + 1.4, 0.8) }));
    ctx.restore();
    fig(ctx, t, sc, 'FIG. 003 — REAL-TIME 3D');
  }

  // ── 03 · agency ─────────────────────────────────────────────────────
  function agency(t) {
    const ctx = C, sc = S.agency, a = sc[0];
    column(ctx, t, sc, { index: '03 / 07', kicker: 'FULL STACK', head: ['Full stack,', '_full speed.'], sub: 'Front to back at a young agency.' });
    const al = fade(t, sc);
    ctx.save(); ctx.globalAlpha *= al;
    [[1060, 300], [1150, 380], [1240, 460]].forEach(([x, y], i) => {
      const at = a + 0.4 + i * 0.35, k = e(t, at, 0.9);
      if (k <= 0) return;
      const w = 520, h = 330;
      ctx.save(); ctx.translate(0, (1 - k) * 30); ctx.globalAlpha *= k;
      ctx.fillStyle = PAPER2; rrect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; rrect(ctx, x, y, w, h, 8); ctx.stroke();
      stroke(ctx, [[x, y + 40], [x + w, y + 40]], { w: 1.2 });
      [0, 1, 2].forEach((d) => dot(ctx, x + 22 + d * 18, y + 20, 5, d === 0 ? SIGNAL : LINE));
      ctx.strokeStyle = LINE; rrect(ctx, x + 90, y + 11, w - 120, 18, 9); ctx.stroke();
      // layout blocks
      const bl = [[20, 60, 180, 110], [215, 60, 285, 50], [215, 125, 135, 45], [365, 125, 135, 45], [20, 190, 480, 22], [20, 225, 380, 22], [20, 260, 440, 22]];
      bl.forEach(([bx, by, bw, bh], j) => { ctx.fillStyle = j === 0 ? 'rgba(160,107,44,0.16)' : 'rgba(24,22,20,0.07)'; ctx.fillRect(x + bx, y + by, bw * e(t, at + 0.3 + j * 0.06, 0.6), bh); });
      ctx.restore();
    });
    // front → API → DB
    const k = e(t, a + 1.8, 1.0);
    if (k > 0) {
      const nodes = [[1180, 850, '</>'], [1420, 850, 'API'], [1660, 850, 'DB']];
      nodes.forEach(([x, y, l], i) => {
        const kk = e(t, a + 1.8 + i * 0.25, 0.6);
        ctx.save(); ctx.globalAlpha *= kk;
        ctx.strokeStyle = INK; ctx.lineWidth = 1.6; rrect(ctx, x - 60, y - 28, 120, 56, 28); ctx.stroke();
        text(ctx, l, x, y + 8, { font: `500 22px ${MONO}`, align: 'center', color: i === 0 ? BRONZE : INK });
        ctx.restore();
        if (i) stroke(ctx, [[nodes[i - 1][0] + 60, y], [x - 60, y]], { w: 1.4, p: e(t, a + 2.0 + i * 0.25, 0.5), dash: [5, 6] });
      });
    }
    ctx.restore();
    fig(ctx, t, sc, 'FIG. 004 — FRONT TO BACK');
  }

  // ── 04 · OrbiSCADA ──────────────────────────────────────────────────
  const MAP = { x: 930, y: 250, w: 900, h: 450 };
  const mp = (lon, lat) => [MAP.x + (lon + 180) / 360 * MAP.w, MAP.y + (84 - lat) / 142 * MAP.h];
  const DK = [9.5, 56.2];
  // OrbiSCADA sites: Denmark first, then the UK, the USA and Japan
  const SITES = [
    { name: 'DENMARK', label: [9.5, 56.2], areas: [[[9.5, 56], 3.2]] },
    { name: 'UK', label: [-2.5, 54.5], areas: [[[-2.5, 54], 5.5]] },
    { name: 'USA', label: [-98, 12], areas: [[[-99, 37], 11], [[-120, 38], 6], [[-78, 42], 6], [[-94, 45], 7]] },
    { name: 'JAPAN', label: [138.5, 37], areas: [[[139, 37], 5.5], [[142.5, 43], 2.5]] },
  ];
  const TURBINES = (() => {
    const out = [];
    (g.WORLD_DOTS || []).forEach(([lon, lat], i) => {
      SITES.forEach((site, si) => {
        for (const [[rl, rt], rad] of site.areas) {
          const d = Math.hypot((lon - rl) * Math.cos(lat * Math.PI / 180), lat - rt);
          if (d < rad && (si !== 2 || hash(i * 1.37) < 0.7)) { out.push({ lon, lat, site: si, order: si * 1000 + d * 10 + hash(i * 7.3) * 30 }); return; }
        }
      });
    });
    out.sort((x, y) => x.order - y.order);
    return out;
  })();
  function turbine(ctx, x, y, s, t, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    stroke(ctx, [[x - 3 * s, y], [x - 1 * s, y - 60 * s], [x + 1 * s, y - 60 * s], [x + 3 * s, y]], { w: 1.8, closed: true });
    const hub = [x, y - 62 * s];
    for (let k = 0; k < 3; k++) {
      const a = t * 2.4 + k * Math.PI * 2 / 3;
      stroke(ctx, [hub, [hub[0] + Math.cos(a) * 42 * s, hub[1] + Math.sin(a) * 42 * s]], { w: 2.4, color: INK });
    }
    dot(ctx, hub[0], hub[1], 4 * s, BRONZE);
    ctx.restore();
  }
  function orbiscada(t) {
    const ctx = C, sc = S.orbiscada, a = sc[0];
    const y = column(ctx, t, sc, { index: '04 / 07', kicker: 'FREELANCE · FIVE YEARS', head: ['OrbiSCADA.'], size: 118, sub: 'I drove the SCADA system for wind' });
    const al = fade(t, sc);
    ctx.save(); ctx.globalAlpha *= al;
    text(ctx, 'turbines, as a freelancer.', 96, y + 42, { font: `400 30px ${BODYF}`, color: BODY, alpha: e(t, a + 1.0, 0.8) });
    // the counter
    const c0 = a + 3.4, c1 = a + 9.8;
    const k = prog(t, c0, c1), count = t < c0 ? 1 : Math.max(1, Math.round(Math.pow(1500, inOut(k))));
    const shown = t > a + 2.6;
    if (shown) {
      const ca = e(t, a + 2.6, 0.7);
      text(ctx, count.toLocaleString('en-US') + (k >= 1 ? '+' : ''), 92, 760, { font: `800 170px ${DISPLAY}`, ls: '-7px', color: INK, alpha: ca });
      text(ctx, k >= 1 ? 'WIND TURBINES · DENMARK · UK · USA · JAPAN' : count === 1 ? 'WIND TURBINE, IN DENMARK' : 'WIND TURBINES', 100, 815, { font: `400 18px ${MONO}`, ls: '1.5px', color: BRONZE, alpha: ca });
    }
    // the dotted world
    const wa = e(t, a + 0.5, 1.4);
    (g.WORLD_DOTS || []).forEach(([lon, lat], i) => {
      if (hash(i * 0.77) > wa * 1.1) return;
      const [x, yy] = mp(lon, lat);
      ctx.fillStyle = 'rgba(24,22,20,0.22)'; ctx.fillRect(x - 1.6, yy - 1.6, 3.2, 3.2);
    });
    // Denmark, turbine #1
    const [dx, dy] = mp(DK[0], DK[1]);
    if (t > a + 1.2) {
      const ka = e(t, a + 1.2, 0.8);
      dot(ctx, dx, dy, 5, SIGNAL, ka);
      const fa = 1 - prog(t, c0 + 1.6, c0 + 2.4);
      stroke(ctx, [[dx, dy], [dx + 50, dy + 110], [dx + 190, dy + 110]], { w: 1.2, p: ka, color: INK, alpha: fa });
            turbine(ctx, dx + 150, dy + 104, 1.1, t, ka * fa);
      text(ctx, 'DENMARK · #1', dx + 58, dy + 134, { font: `400 14px ${MONO}`, ls: '1px', color: INK, alpha: ka * fa });
    }
    // then the world
    const n = t < c0 ? 0 : Math.round(TURBINES.length * inOut(k));
    SITES.forEach((site, si) => {
      const first = TURBINES.findIndex((tb) => tb.site === si);
      if (first < 0 || n <= first || si === 0) return;
      const [lx, ly] = mp(site.label[0], site.label[1]);
      text(ctx, site.name, lx, ly - 22, { font: `500 15px ${MONO}`, ls: '1.5px', align: 'center', color: INK, alpha: clamp((n - first) / 8) });
    });
    for (let i = 0; i < n; i++) {
      const tb = TURBINES[i], [x, yy] = mp(tb.lon, tb.lat);
      const age = (i / TURBINES.length);
      dot(ctx, x, yy, 3.6, BRONZE, 0.9);
      if (i > n - 12) { const r = 4 + (n - i) * 1.3; ctx.save(); ctx.strokeStyle = BRONZE; ctx.globalAlpha *= 0.5 * (1 - (n - i) / 12); ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      void age;
    }
    ctx.restore();
    fig(ctx, t, sc, k >= 1 ? 'FIG. 005 — FROM 1 TO 1,500+ TURBINES, FOUR COUNTRIES' : 'FIG. 005 — ONE TURBINE IN DENMARK');
  }

  // ── 05 · Clovr Labs: crypto forensics ───────────────────────────────
  const GRAPH = (() => {
    const cols = 6, nodes = [];
    for (let c = 0; c < cols; c++) { const rows = [4, 6, 7, 7, 6, 4][c]; for (let r = 0; r < rows; r++) nodes.push({ c, r, x: 1000 + c * 158 + (hash(c * 9 + r) - 0.5) * 40, y: 250 + (r + 0.5) * (520 / rows) + (hash(c * 5 + r * 3) - 0.5) * 30 }); }
    const edges = [];
    nodes.forEach((n, i) => nodes.forEach((m, j) => { if (m.c === n.c + 1 && hash(i * 13 + j * 7) > 0.62) edges.push([i, j]); }));
    // a traced path through the columns
    const path = [];
    for (let c = 0; c < cols; c++) { const col = nodes.map((n, i) => [n, i]).filter(([n]) => n.c === c); path.push(col[Math.floor(hash(c * 31) * col.length)][1]); }
    for (let i = 1; i < path.length; i++) if (!edges.some(([a, b]) => a === path[i - 1] && b === path[i])) edges.push([path[i - 1], path[i]]);
    return { nodes, edges, path };
  })();
  function clovr(t) {
    const ctx = C, sc = S.clovr, a = sc[0];
    column(ctx, t, sc, { index: '05 / 07', kicker: 'CLOVR LABS', head: ['Following', '_the money.'], sub: 'Crypto forensic analytics.' });
    const al = fade(t, sc);
    ctx.save(); ctx.globalAlpha *= al;
    const k = e(t, a + 0.4, 1.4);
    GRAPH.edges.forEach(([i, j], n) => { if (n / GRAPH.edges.length < k) stroke(ctx, [[GRAPH.nodes[i].x, GRAPH.nodes[i].y], [GRAPH.nodes[j].x, GRAPH.nodes[j].y]], { color: 'rgba(24,22,20,0.2)', w: 1.1 }); });
    GRAPH.nodes.forEach((nd, i) => { if (i / GRAPH.nodes.length < k) { dot(ctx, nd.x, nd.y, 5, PAPER2); ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(nd.x, nd.y, 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } });
    // trace
    const P = GRAPH.path;
    for (let s = 1; s < P.length; s++) {
      const at = a + 2.2 + (s - 1) * 0.42, kk = e(t, at, 0.4);
      if (kk <= 0) continue;
      const A = GRAPH.nodes[P[s - 1]], B = GRAPH.nodes[P[s]];
      stroke(ctx, [[A.x, A.y], [B.x, B.y]], { color: SIGNAL, w: 3, p: kk });
      dot(ctx, A.x, A.y, 7, SIGNAL);
      if (kk >= 1) {
        dot(ctx, B.x, B.y, 7, SIGNAL);
        const addr = '0x' + Math.floor(hash(s * 17.7) * 0xffffff).toString(16).padStart(6, '0') + '…' + Math.floor(hash(s * 3.3) * 0xfff).toString(16).padStart(3, '0');
        text(ctx, addr, B.x, B.y - 16, { font: `400 13px ${MONO}`, align: 'center', color: INK, alpha: e(t, at + 0.3, 0.4) });
      }
    }
    const end = GRAPH.nodes[P[P.length - 1]];
    const fl = e(t, a + 4.6, 0.6);
    if (fl > 0) {
      ctx.save(); ctx.globalAlpha *= fl;
      ctx.strokeStyle = SIGNAL; ctx.lineWidth = 1.6; rrect(ctx, end.x - 75, end.y + 20, 150, 44, 22); ctx.stroke();
      text(ctx, 'FLAGGED', end.x, end.y + 49, { font: `500 17px ${MONO}`, ls: '1.5px', align: 'center', color: SIGNAL });
      ctx.restore();
    }
    ctx.restore();
    fig(ctx, t, sc, 'FIG. 006 — A TRACED TRANSACTION PATH');
  }

  // ── 06 · n0 ─────────────────────────────────────────────────────────
  function n0(t) {
    const ctx = C, sc = S.n0, a = sc[0];
    column(ctx, t, sc, { index: '06 / 07', kicker: 'NOW · CLOVR LABS', head: ['The workspace', '_of the future.'], sub: 'n0 — people, agents and apps, in one place.' });
    const al = fade(t, sc);
    ctx.save(); ctx.globalAlpha *= al;
    const x = 1000, y = 250, w = 824, h = 560, k = e(t, a + 0.3, 1.0);
    ctx.save(); ctx.globalAlpha *= k;
    ctx.fillStyle = PAPER2; rrect(ctx, x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; rrect(ctx, x, y, w, h, 14); ctx.stroke();
    stroke(ctx, [[x + 110, y], [x + 110, y + h]], { w: 1.2 });
    text(ctx, 'n0', x + 30, y + 58, { font: `500 36px ${MONO}`, ls: '-1px' });
    ctx.fillStyle = N0BLUE; ctx.fillRect(x + 74, y + 56, 22, 4);
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = i === 3 ? BRONZE : LINE; ctx.lineWidth = 1.6; rrect(ctx, x + 36, y + 110 + i * 78, 38, 38, 10); ctx.stroke(); }
    ctx.restore();
    // chat lines
    [[0, 'Maya', 360], [1, 'Home Agent', 470], [2, 'Tom', 300]].forEach(([i, who, len]) => {
      const kk = e(t, a + 0.9 + i * 0.35, 0.6);
      if (kk <= 0) return;
      const yy = y + 70 + i * 92;
      dot(ctx, x + 160, yy + 16, 14, i === 1 ? N0BLUE : LINE, kk);
      text(ctx, who, x + 186, yy + 10, { font: `600 18px ${BODYF}`, alpha: kk, color: i === 1 ? N0BLUE : INK });
      ctx.fillStyle = 'rgba(24,22,20,0.1)'; ctx.fillRect(x + 186, yy + 24, len * kk, 12);
    });
    // agents → apps
    const agents = [[x + 250, y + 420], [x + 400, y + 470], [x + 560, y + 410]], apps = [[x + 700, y + 330], [x + 740, y + 470]];
    agents.forEach(([ax, ay], i) => {
      const kk = e(t, a + 2.0 + i * 0.2, 0.6);
      apps.forEach(([px, py], j) => stroke(ctx, [[ax, ay], [px, py]], { color: LINE, w: 1.2, p: e(t, a + 2.3 + i * 0.2 + j * 0.1, 0.5) }));
      dot(ctx, ax, ay, 12, N0BLUE, kk); dot(ctx, ax, ay, 5, PAPER2, kk);
    });
    apps.forEach(([px, py], j) => { const kk = e(t, a + 2.8 + j * 0.2, 0.6); ctx.save(); ctx.globalAlpha *= kk; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; rrect(ctx, px - 36, py - 28, 72, 56, 10); ctx.stroke(); ctx.fillStyle = 'rgba(160,107,44,0.25)'; ctx.fillRect(px - 24, py - 6, 14, 20); ctx.fillRect(px - 5, py - 16, 14, 30); ctx.fillRect(px + 14, py + 2, 12, 12); ctx.restore(); });
    text(ctx, 'AGENTS', x + 400, y + 530, { font: `400 14px ${MONO}`, ls: '1.5px', align: 'center', color: FAINT, alpha: e(t, a + 2.4, 0.5) });
    text(ctx, 'APPS', x + 720, y + 530, { font: `400 14px ${MONO}`, ls: '1.5px', align: 'center', color: FAINT, alpha: e(t, a + 3.0, 0.5) });
    ctx.restore();
    fig(ctx, t, sc, 'FIG. 007 — NZERO.PRO');
  }

  // ── 07 · the workshop ───────────────────────────────────────────────
  const WORK = [['Gitilla', 'Visualization · Three.js'], ['Gource Viewer', 'Developer tools'], ['wee.cat', 'Consumer & data'], ['Wee Editor', 'AI & infrastructure'], ['Straw Draw', 'iPad · Swift'],
    ['Donna', 'Security · AI'], ['Claude Agent SDK Go', 'Go · AI · SDK'], ['Codex SDK Go', 'Go · AI · SDK'], ['The Agentic Crew', 'Books · AI'], ['Web Presenter', 'Three.js · Web'],
    ['Maperick', 'Networking · macOS'], ['Hefty', 'Rust · macOS'], ['Radio CLI', 'Rust · macOS']];
  function workshop(t) {
    const ctx = C, sc = S.workshop, a = sc[0], b = sc[1];
    const out = 1 - prog(t, b - 0.55, b - 0.05);
    ctx.save(); ctx.globalAlpha *= out;
    text(ctx, '07 / 07', 96, 212, { font: `400 17px ${MONO}`, ls: '1.5px', color: BRONZE, alpha: e(t, a + 0.1, 0.5) });
    text(ctx, 'IN THE WORKSHOP', 248, 212, { font: `400 17px ${MONO}`, ls: '1.5px', color: FAINT, alpha: e(t, a + 0.2, 0.5) });
    riseLine(ctx, 'Always building.', 92, 318, 92, t, a + 0.2, { font: `800 92px ${DISPLAY}`, ls: '-4px' });
    riseLine(ctx, 'Always shipping.', 850, 318, 92, t, a + 0.35, { font: `italic 400 92px ${SERIF}`, ls: '-6px' });
    const cols = 5, gw = 24, cw = (W - 192 - gw * (cols - 1)) / cols, ch = 150;
    WORK.forEach(([name, tag], i) => {
      const at = a + 1.0 + i * 0.22, k = e(t, at, 0.7);
      if (k <= 0) return;
      const c = i % cols, r = Math.floor(i / cols), x = 96 + c * (cw + gw), y = 400 + r * (ch + gw);
      ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, (1 - k) * 26);
      ctx.fillStyle = PAPER2; ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = LINE; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      text(ctx, String(i + 1).padStart(2, '0'), x + 22, y + 36, { font: `400 15px ${MONO}`, color: BRONZE });
      text(ctx, name, x + 22, y + 92, { font: `700 ${name.length > 16 ? 26 : 32}px ${DISPLAY}`, ls: '-1px' });
      text(ctx, tag.toUpperCase(), x + 22, y + 124, { font: `400 13px ${MONO}`, ls: '1px', color: FAINT });
      ctx.restore();
    });
    // Donna closes the loop back to 2010
    const dk = e(t, a + 4.4, 0.8);
    if (dk > 0) {
      const i = 5, c = i % cols, r = Math.floor(i / cols), x = 96 + c * (cw + gw), y = 400 + r * (ch + gw);
      ctx.save(); ctx.globalAlpha *= dk;
      ctx.strokeStyle = SIGNAL; ctx.lineWidth = 2; ctx.strokeRect(x - 5, y - 5, cw + 10, ch + 10);
      text(ctx, '↺ SECURITY, FULL CIRCLE', x + cw - 16, y + 36, { font: `500 13px ${MONO}`, ls: '1px', align: 'right', color: SIGNAL });
      ctx.restore();
    }
    ctx.restore();
  }

  // ── end card ─────────────────────────────────────────────────────────
  function logo(ctx, x, y, r, t) {
    ctx.save(); ctx.strokeStyle = BRONZE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    for (const [rx, rot] of [[0.55, 0.6 + t * 0.2], [0.8, -0.5 - t * 0.15]]) { ctx.beginPath(); ctx.ellipse(x, y, r * rx, r * 0.95, rot, 0, Math.PI * 2); ctx.stroke(); }
    dot(ctx, x - r * 0.3, y, 4, BRONZE);
    ctx.restore();
  }
  function end(t) {
    const ctx = C, a = S.end[0];
    riseLine(ctx, 'Serious code.', 88, 440, 170, t, a + 0.2, { font: `800 170px ${DISPLAY}`, ls: '-8px', dur: 1.1 });
    riseLine(ctx, 'Clear thinking.', 88, 618, 170, t, a + 0.5, { font: `italic 400 170px ${SERIF}`, ls: '-12px', dur: 1.1 });
    sphere(ctx, 1540, 470, 230, t, { p: e(t, a + 0.3, 2.4), phase: 1.2 });
    // signature
    const s = e(t, a + 2.4, 1.0);
    ctx.save(); ctx.globalAlpha *= s;
    stroke(ctx, [[96, 760], [W - 96, 760]], { color: INK, w: 1.2, p: s });
    logo(ctx, 150, 860, 48, t);
    text(ctx, 'Rasmus', 222, 838, { font: `italic 400 34px ${SERIF}` });
    text(ctx, 'Schlünsen', 218, 900, { font: `700 66px ${DISPLAY}`, ls: '-3px' });
    font(ctx, `700 66px ${DISPLAY}`, '-3px');
    const wdt = ctx.measureText('Schlünsen').width;
    text(ctx, '.', 218 + wdt, 900, { font: `700 66px ${DISPLAY}`, color: BRONZE });
    text(ctx, 'INDEPENDENT BY DESIGN · BASED IN BARCELONA', W - 96, 846, { font: `400 17px ${MONO}`, ls: '1.5px', align: 'right', color: FAINT });
    text(ctx, 'schlunsen.github.io', W - 96, 900, { font: `500 30px ${MONO}`, align: 'right', color: BRONZE, alpha: e(t, a + 3.0, 0.8) });
    ctx.restore();
  }

  // ── frame ────────────────────────────────────────────────────────────
  let C = null;
  function drawFrame(ctx, t) {
    C = ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    frame(ctx, t);
    if (t < S.open[1]) open(t);
    else if (t < S.security[1]) security(t);
    else if (t < S.unity[1]) unity(t);
    else if (t < S.agency[1]) agency(t);
    else if (t < S.orbiscada[1]) orbiscada(t);
    else if (t < S.clovr[1]) clovr(t);
    else if (t < S.n0[1]) n0(t);
    else if (t < S.workshop[1]) workshop(t);
    else end(t);
    // loop-friendly: rise from paper, settle back into paper
    const f = Math.max(1 - prog(t, 0, 0.5), prog(t, T.DUR - 0.8, T.DUR));
    if (f > 0) { ctx.fillStyle = `rgba(243,240,232,${f})`; ctx.fillRect(0, 0, W, H); }
  }
  g.drawFrame = drawFrame;
})(typeof window !== 'undefined' ? window : globalThis);
