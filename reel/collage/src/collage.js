// collage.js: the MEDIUM. Every frame is a cut-paper collage on a sheet of warm oatmeal paper (or a deep blue night
// ground): flat pieces of coloured paper with slightly irregular scissor-cut edges (or torn edges with a white fibrous
// rim), each with its own paper grain, casting a soft offset shadow so it sits ABOVE the ground like a real cutout;
// black lines brush-painted on (varying width, tapered ends); chunky hand-cut lettering pasted on; photos printed and
// cut out with a white border. The vocabulary is Miró's: stars, moons, suns, eyes, ladders, birds, blobs, spirals.
//
// Colours: anywhere a colour is taken you may pass a palette name ('red', 'yellow', 'blue', 'green', 'black',
// 'white', 'ground', 'night', ... see PAL in core.js) or any '#RRGGBB' hex.
//
// Stacking: pieces are drawn in call order, each one on top of what's already there, each casting its shadow on
// everything below it (so z-order is call order, exactly like gluing pieces down).
//
// Stability (the owner is very sensitive to flicker): every piece's edge shape and grain are a pure function of its
// OWN geometry and seed, never of time. A piece that moves by transform (translate/rotate/scale, at()) keeps exactly the
// same edge. Rebuild a piece's points every frame only if its shape really changes.
//
// This file also provides the small slice of p5 the kit uses (push/pop/translate/rotate/scale/resetMatrix and a seeded
// random()), so there is no p5 dependency.

// ---------- settings ----------
// Reset every frame to COLLAGE_DEFAULTS + PROJECT.collage; a shot may call collage({...}) FIRST to change them.
const COLLAGE_DEFAULTS = {
  ground: 'ground',     // the sheet everything is glued to: 'ground' (oatmeal), 'night' (deep blue), or any colour
  seed: 1,              // the "cutting session": fixes every edge and grain offset in the shot. Change it per shot
  edge: 1,              // scissor-cut irregularity (1 ≈ ±1.8 px facets on big pieces; 0 = perfectly clean vector edges)
  shadow: 1,            // shadow strength (0 = no shadows: pieces look printed, not cut)
  light: [6, 8],        // shadow offset in px at lift 1 (the light comes from the upper left)
  blur: 9,              // shadow softness in px at lift 1
  grain: 1,             // paper texture strength on every piece and the ground
  line: 1,              // multiplier on brush widths (0 = no brush lines)
};
let COL = { ...COLLAGE_DEFAULTS };
function collage(cfg = {}) {
  const relay = cfg.ground != null && colHex(cfg.ground === 'ground' ? PAL.ground : cfg.ground) !== colHex('ground');
  COL = { ...COL, ...cfg }; if (relay && CTX) ground(COL.ground);
  return COL;
}

// ---------- a tiny p5-compatible transform stack and seeded random ----------
let MX = [1, 0, 0, 1, 0, 0]; const MXS = [];
function push() { MXS.push(MX.slice()); }
function pop() { if (MXS.length) MX = MXS.pop(); }
function resetMatrix() { MX = [1, 0, 0, 1, 0, 0]; }
function translate(x, y) { const [a, b, c, d, e, f] = MX; MX[4] = e + a * x + c * y; MX[5] = f + b * x + d * y; }
function rotate(r) { const [a, b, c, d] = MX, cs = Math.cos(r), sn = Math.sin(r); MX[0] = a * cs + c * sn; MX[1] = b * cs + d * sn; MX[2] = c * cs - a * sn; MX[3] = d * cs - b * sn; }
function scale(sx, sy = sx) { MX[0] *= sx; MX[1] *= sx; MX[2] *= sy; MX[3] *= sy; }
let _rs = 1;
function randomSeed(n) { _rs = (n >>> 0) || 1; }
function random() { _rs |= 0; _rs = (_rs + 0x6D2B79F5) | 0; let t = Math.imul(_rs ^ (_rs >>> 15), 1 | _rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function noiseSeed() {}
const mxScale = () => Math.sqrt(Math.abs(MX[0] * MX[3] - MX[1] * MX[2])) || 1;

// ---------- colours ----------
const hexRGB = h => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16 & 255), (n >> 8 & 255), (n & 255)]; };
const rgbHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
// Any colour → '#rrggbb' (or null for "no colour"). Riso-era recipes ({ pink: 1 }) fall back to black.
function colHex(C) {
  if (C == null || C === false) return null;
  if (typeof C === 'string') {
    if (C[0] === '#') return C.length === 4 ? '#' + [...C.slice(1)].map(c => c + c).join('') : C.slice(0, 7);
    if (C === 'ground') return colHex(COL.ground === 'ground' ? PAL.ground : COL.ground);
    if (PAL[C]) return colHex(PAL[C]);
    return null;
  }
  if (Array.isArray(C)) return rgbHex(C);
  return PAL.black;
}
// tone(C, k): a paler sheet of the same colour (k = 1 full colour, 0 = white paper)
const tone = (C, k) => { const h = colHex(C); if (!h) return null; const c = hexRGB(h); return rgbHex(c.map(v => lerp(250, v, clamp(k)))); };

// ---------- noise (pure functions of their arguments) ----------
const h2 = (i, s) => hash(i * 1.618 + s * 57.31);
const pln = (x, s) => { const i = Math.floor(x), f = x - i; return lerp(h2(i, s), h2(i + 1, s), f) * 2 - 1; };          // linear: facets
const smn = (x, s) => { const i = Math.floor(x), f = x - i, e = f * f * (3 - 2 * f); return lerp(h2(i, s), h2(i + 1, s), e) * 2 - 1; };
const seedOf = (...a) => { let h = 2166136261; for (const c of a.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 97.3; };

// ---------- the paper: a grain tile (value noise, fibres, tooth), grey-balanced for soft-light ----------
let CTX = null, GRAIN = null, GRAIN_T = null;
function makeGrain(S = 512) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const img = x.createImageData(S, S), d = img.data;
  // periodic value noise so the tile repeats seamlessly
  const vn = (px, py, cell, s) => { const P = S / cell, gx = px / cell, gy = py / cell, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const g = (i, j) => hash(((i % P + P) % P) * 17.13 + ((j % P + P) % P) * 131.7 + s), ex = fx * fx * (3 - 2 * fx), ey = fy * fy * (3 - 2 * fy);
    return lerp(lerp(g(ix, iy), g(ix + 1, iy), ex), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), ex), ey) - .5; };
  for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
    const v = 128 + 22 * vn(X, y, 128, 1) + 16 * vn(X, y, 32, 2) + 10 * vn(X, y, 8, 3) + 14 * (hash(X * 7.1 + y * 913.3) - .5);
    const i = (y * S + X) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // fibres: short curly strands, a few lighter and a few darker, wrapped around the tile edges
  randomSeed(4242);
  for (let k = 0; k < 1400; k++) {
    const px = random() * S, py = random() * S, L = 5 + random() * 26, a = random() * TAU, bend = (random() - .5) * 1.4, lite = random() < .6;
    x.strokeStyle = lite ? `rgba(255,255,255,${.18 + .3 * random()})` : `rgba(0,0,0,${.12 + .2 * random()})`; x.lineWidth = .5 + random() * .9;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      x.beginPath(); x.moveTo(px + ox, py + oy);
      x.quadraticCurveTo(px + ox + Math.cos(a + bend) * L * .5, py + oy + Math.sin(a + bend) * L * .5, px + ox + Math.cos(a) * L, py + oy + Math.sin(a) * L); x.stroke();
    }
  }
  return c;
}
function grainPattern(ax, ay, s) {
  const m = new DOMMatrix(); m.translateSelf(ax + 311 * hash(s + 1), ay + 523 * hash(s + 2)); m.rotateSelf(360 * hash(s + 3));
  GRAIN.setTransform(m); return GRAIN;
}
// fill `path` (already set on the context's transform) with paper grain anchored at (ax, ay)
function grainOver(c, path, ax, ay, s, amt, rule) {
  if (amt <= 0) return;
  c.save(); c.shadowColor = 'transparent'; c.globalCompositeOperation = 'soft-light'; c.globalAlpha *= clamp(amt);
  c.fillStyle = grainPattern(ax, ay, s); c.fill(path, rule || 'nonzero'); c.restore();
}

function collageInit(canvas) {
  CTX = canvas.getContext('2d');
  GRAIN_T = makeGrain(); GRAIN = CTX.createPattern(GRAIN_T, 'repeat');
}
// the ground sheet, cached per colour (full frame, screen space)
const GROUNDS = new Map();
function groundCanvas(hex) {
  if (GROUNDS.has(hex)) return GROUNDS.get(hex);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = hex; x.fillRect(0, 0, W, H);
  const p = x.createPattern(GRAIN_T, 'repeat'); x.globalCompositeOperation = 'soft-light';
  x.globalAlpha = .85; x.fillStyle = p; x.fillRect(0, 0, W, H);
  const m = new DOMMatrix(); m.scaleSelf(2.3); m.rotateSelf(31); p.setTransform(m); x.globalAlpha = .5; x.fillRect(0, 0, W, H);
  // a very soft vignette, like light falling off across a real sheet
  x.globalCompositeOperation = 'multiply'; x.globalAlpha = 1;
  const g = x.createRadialGradient(W * .45, H * .4, H * .3, W / 2, H / 2, H * 1.15); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,95,70,.16)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  GROUNDS.set(hex, c); return c;
}
function collageClear() {
  const c = CTX; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.shadowColor = 'transparent'; c.filter = 'none';
  c.drawImage(groundCanvas(colHex('ground')), 0, 0);
}
// ground(col): re-lay the whole frame with a fresh sheet (e.g. a night ground for one shot). Screen space.
function ground(col = 'ground') {
  const c = CTX; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.shadowColor = 'transparent'; c.globalAlpha = 1; c.drawImage(groundCanvas(colHex(col)), 0, 0); c.restore();
}

// ---------- scissor-cut and torn outlines ----------
// Closed smooth path through points (Catmull-Rom around the loop), n samples per span.
function throughClosed(P, n = 5) {
  const L = P.length; if (L < 3) return P.slice(); const out = [];
  for (let i = 0; i < L; i++) {
    const p0 = P[(i - 1 + L) % L], p1 = P[i], p2 = P[(i + 1) % L], p3 = P[(i + 2) % L];
    for (let k = 0; k < n; k++) { const u = k / n, u2 = u * u, u3 = u2 * u; out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3))); }
  }
  return out;
}
// The outline a pair of scissors (or a tearing hand) makes of an ideal polygon: every edge is subdivided and pushed in
// or out along its normal by a noise that is a function of the distance ALONG the outline (normalised by the perimeter,
// so the facets stay put when the piece moves, and scale with it). Corners are kept, so stars stay pointy.
//   o: { torn (true, or an array of edge indices), inset (px, pushes the whole outline inwards), amp, seed }
function cutOutline(pts, o, seed) {
  const P = o.curv ? throughClosed(pts, 6) : pts, n = P.length;
  if (n < 3) return P;
  const len = [], tornSet = o.torn === true ? null : Array.isArray(o.torn) ? new Set(o.torn) : new Set();
  let L = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); len.push(l); L += l; }
  if (L < 6) return P;
  // winding: offsets are applied along the outward normal
  let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1, E = COL.edge * (o.edge ?? 1), inset = o.inset || 0;
  const K = Math.max(7, Math.round(L / 46)), facet = L / K;                 // scissor facets ≈ 46 px on big pieces
  const amp = E * Math.min(1.8, facet * .045);
  const out = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], l = len[i], torn = o.torn === true || (tornSet && tornSet.has(i));
    const step = torn ? 2.4 : 7, m = Math.max(1, Math.ceil(l / step));
    const nx = l > 0 ? sgn * (b[1] - a[1]) / l : 0, ny = l > 0 ? -sgn * (b[0] - a[0]) / l : 0;
    for (let j = 0; j < m; j++) {
      const f = j / m, sj = s + l * f, u = sj / L;
      let d = amp * pln(u * K, seed) - (inset && torn ? inset * (1 + (o.rimVar ?? 0) * smn(sj / 30, seed + 40)) + (o.rimVar ? 1.1 * (h2(Math.floor(sj / 2.4), seed + 77) - .5) : 0) : 0);
      if (torn) {
        const T = E * (o.tearAmp ?? 1);
        d += T * (3.2 * smn(sj / 26, seed + 3) + 1.7 * pln(sj / 5.5, seed + 5) + 1.0 * (h2(Math.floor(sj / 2.4), seed + 9) - .5));
      }
      out.push([a[0] + (b[0] - a[0]) * f + nx * d, a[1] + (b[1] - a[1]) * f + ny * d]);
    }
    s += l;
  }
  return out;
}
function polyPath(P, closed = true) {
  const p = new Path2D(); let first = true;
  for (const [x, y] of P) { if (!isFinite(x) || !isFinite(y)) continue; if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y); }
  if (closed) p.closePath(); return p;
}
const centroid = P => { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; };
const bbox = P => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1 - x0, y1 - y0]; };

// set the drop shadow for a piece at elevation `lift` (shadow offsets are in screen px, the light never turns)
function setShadow(c, lift = 1, k = 1) {
  const S = COL.shadow * k;
  if (S <= 0 || lift <= 0) { c.shadowColor = 'transparent'; return; }
  const dark = colHex('ground') && hexRGB(colHex('ground')).reduce((a, b) => a + b) < 250;   // on a dark ground, a deeper shadow
  c.shadowColor = `rgba(${dark ? '5,8,20' : '52,30,12'},${clamp((dark ? .5 : .34) * S * (lift > 1 ? 1 - .12 * Math.min(2, lift - 1) : 1), 0, .9)})`;
  const z = CAM ? CAM.zoom : 1;
  c.shadowOffsetX = COL.light[0] * lift * z; c.shadowOffsetY = COL.light[1] * lift * z; c.shadowBlur = COL.blur * (.6 + .4 * lift) * z;
}

// cut(pts, col, o): one piece of cut paper. Options:
//   torn      true (all edges) or [edge indices]: torn instead of cut, with a white fibrous rim
//   rim       torn rim width px (default 4), rimCol (default white paper)
//   lift      elevation: 1 = glued down (default), 2–3 = picked up / sliding (bigger, softer shadow), 0 = no shadow
//   tone      0..1 paler sheet;  alpha 0..1
//   curv      smooth the outline through the points (for blobs)
//   edge      0..1+ multiplier on the scissor irregularity (0 for a clean machine-cut piece)
//   grain     multiplier on the paper texture
//   seed/key  fixes the edge and grain (default: from the colour, point count and size, so a moving piece keeps its
//             edge, but two identical pieces differ only if you give them keys)
//   hole      a second list of points cut OUT of the piece (a ring, a frame)
function cut(pts, col, o = {}) {
  if (!pts || pts.length < 3) return;
  const hex = o.tone != null ? tone(col, o.tone) : colHex(col); if (!hex) return;
  const [bx, by, bw, bh] = bbox(pts);
  const seed = o.seed ?? seedOf(COL.seed, o.key ?? '', hex, pts.length, Math.round(bw / 24), Math.round(bh / 24));
  const c = CTX; c.save(); c.setTransform(...MX); c.globalAlpha = clamp(o.alpha ?? 1);
  const anchor = [bx + bw / 2, by + bh / 2], lift = o.lift ?? 1;
  const holePath = o.hole ? cutOutline(o.hole, { curv: o.curv }, seed + 21) : null;
  const addHole = p => { if (holePath) { const q = new Path2D(p); q.addPath(polyPath(holePath.slice().reverse())); return q; } return p; };
  if (o.torn) {
    // the torn sheet: a white fibrous core showing where the colour layer came away, then the colour inset
    const outer = addHole(polyPath(cutOutline(pts, { ...o, torn: o.torn }, seed)));
    setShadow(c, lift); c.fillStyle = colHex(o.rimCol || 'white'); c.fill(outer, 'evenodd');
    c.shadowColor = 'transparent';
    grainOver(c, outer, ...anchor, seed + 7, COL.grain * .9, 'evenodd');
    const inner = addHole(polyPath(cutOutline(pts, { ...o, torn: o.torn, inset: (o.rim ?? 5), rimVar: .75 }, seed)));
    c.fillStyle = hex; c.fill(inner, 'evenodd');
    grainOver(c, inner, ...anchor, seed, COL.grain * (o.grain ?? 1) * .75, 'evenodd');
  } else {
    const path = addHole(polyPath(cutOutline(pts, o, seed)));
    setShadow(c, lift, o.shadow ?? 1); c.fillStyle = hex; c.fill(path, 'evenodd');
    c.shadowColor = 'transparent';
    grainOver(c, path, ...anchor, seed, COL.grain * (o.grain ?? 1) * .75, 'evenodd');
  }
  c.restore();
}

// ---------- brush lines: black paint, pressure and tapered ends ----------
// brush(pts, o): a calligraphic line through the points (smoothed). Its width swells and thins along the stroke and
// tapers at the ends; its edges are a little ragged. Everything is a function of distance along the stroke, so a
// stroke drawn on over time (k) keeps exactly the shape it will have when finished.
//   o: { w (px, default 12), col (default black), k (0..1 drawn so far), from (0..1 lifted from the start),
//        taper (0..1, default .2), press (width variation, default .3), seed, curv (0 = straight segments),
//        closed, alpha, lift (0 default: paint has no shadow) }
function brush(pts, o = {}) {
  if (!pts || pts.length < 2 || COL.line <= 0) return;
  const w = (o.w ?? 12) * COL.line, hex = colHex(o.col ?? 'black'); if (!hex) return;
  let C = o.curv === 0 ? pts.slice() : o.closed ? throughClosed(pts, 8) : through(pts, 8);
  if (o.closed) C.push(C[0]);
  // resample by arc length (3 px)
  const cum = [0]; for (let i = 1; i < C.length; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
  const L = cum[cum.length - 1]; if (L < 1) return;
  const seed = o.seed ?? seedOf(COL.seed, o.key ?? '', Math.round(L / 20), pts.length);
  const s0 = clamp(o.from ?? 0) * L, s1 = clamp(o.k ?? 1) * L; if (s1 - s0 < 1) return;
  const step = 3, S = [];
  let j = 0;
  for (let s = s0; ; s += step) {
    const ss = Math.min(s, s1);
    while (j < cum.length - 2 && cum[j + 1] < ss) j++;
    const f = (ss - cum[j]) / ((cum[j + 1] - cum[j]) || 1), a = C[j], b = C[j + 1];
    S.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, ss]);
    if (ss >= s1) break;
  }
  if (S.length < 2) return;
  const tap = o.taper ?? .2, t0 = o.closed ? 0 : Math.min(tap * L * .6, 3 * w), t1 = o.closed ? 0 : Math.min(tap * L * 1.2, 6 * w), press = o.press ?? .3;
  const width = s => {
    let f = 1;
    if (t0 > 0 && s < t0) f *= .25 + .75 * Math.pow(s / t0, .5);
    if (t1 > 0 && L - s < t1) f *= .06 + .94 * Math.pow((L - s) / t1, .7);
    if (s1 < L && s1 - s < w * 1.2) f *= .2 + .8 * Math.sqrt((s1 - s) / (w * 1.2));   // the tip, while painting
    if (s0 > 0 && s - s0 < w * 1.2) f *= .2 + .8 * Math.sqrt((s - s0) / (w * 1.2));   // the tail, while lifting
    return w * f * (1 + press * smn(s / (w * 3 + 40), seed));
  };
  const Lf = [], Rt = [];
  for (let i = 0; i < S.length; i++) {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const s = S[i][2], hw = width(s) / 2, r = Math.min(3, .35 + w * .025), fq = Math.max(7, w * .4);
    const hl = hw + r * pln(s / fq, seed + 1), hr = hw + r * pln(s / fq, seed + 2);
    Lf.push([S[i][0] - dy / d * hl, S[i][1] + dx / d * hl]); Rt.push([S[i][0] + dy / d * hr, S[i][1] - dx / d * hr]);
  }
  const path = polyPath(Lf.concat(Rt.reverse()));
  // round-ish ends (filled separately: their winding may differ from the ribbon's)
  const caps = new Path2D();
  const cap = (p, s) => { const r = width(s) / 2 * .92; if (r > .6) { caps.moveTo(p[0] + r, p[1]); caps.arc(p[0], p[1], r, 0, TAU); } };
  if (!(s0 > 0)) cap(S[0], S[0][2]); if (!(s1 < L)) cap(S[S.length - 1], S[S.length - 1][2]);
  const c = CTX; c.save(); c.setTransform(...MX); c.globalAlpha = clamp(o.alpha ?? 1);
  if (o.lift) setShadow(c, o.lift, .7); else c.shadowColor = 'transparent';
  c.fillStyle = hex; c.fill(path); c.fill(caps);
  c.shadowColor = 'transparent';
  grainOver(c, path, S[0][0], S[0][1], seed, COL.grain * .45);
  c.restore();
}

// ---------- the kit's painting API, mapped onto paper ----------
// paint(pts, o): legacy name for a cut piece, so scenes (and Clawd) port. fill/wash/col → the paper colour;
// tone → paler sheet; over → a thin flat piece with a small shadow; ink + sw → a brush outline around it;
// fillOp/washOp → alpha; ramp/hatch/bleed/tex are ignored (no gradients in cut paper).
const LINE_PX = 5;   // outline weight sw = 1 → 5 px (at zoom 1)
function paint(pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const col = o.col ?? o.wash ?? o.fill;
  if (col != null) {
    const op = o.wash != null ? (o.washOp ?? 255) / 255 : o.fill != null && o.fillOp != null ? o.fillOp / 255 : 1;
    cut(pts, col, { tone: o.tone, alpha: op * (o.alpha ?? 1), curv: o.curv, lift: o.lift ?? (o.over ? .45 : 1), torn: o.torn, key: o.key, seed: o.seed, edge: o.edge, hole: o.hole });
  }
  if (o.ink != null && COL.line > 0) brush(pts, { closed: true, curv: o.curv ? .5 : 0, w: (o.sw ?? 1) * LINE_PX, col: o.ink, press: .2, key: o.key });
}
// inkLine(pts, sw, colour, brush, curvature): an open brush line. 'inkfine' is thinner, 'dry' lighter.
function inkLine(pts, sw = 1, col = 'black', br = 'ink', curv = .5, o = {}) {
  if (!pts || pts.length < 2) return;
  brush(pts, { w: sw * LINE_PX * (br === 'inkfine' ? .8 : 1), col, curv: curv > 0 && pts.length > 2 ? .5 : 0, alpha: (br === 'dry' ? .7 : 1) * (o.alpha ?? 1), taper: o.taper ?? .12, key: o.key, k: o.k, from: o.from });
}
// arcLine(cx, cy, r, w, col, { a0, a1 }): a brushed circle or arc
function arcLine(cx, cy, r, w, col = 'black', o = {}) {
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r / 14)), P = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  brush(P, { w, col, curv: 0, taper: Math.abs(a1 - a0) >= TAU - .01 ? .1 : .2, key: o.key, press: .25 });
}
// glow(): paper can't glow. A pale disc of paper behind a light (kept so older scenes run).
function glow(x, y, r, col = 'yellow', a = 1) { if (a > .05 && r > 2) cut(ellPts(x, y, r * .7, r * .7, 48), tone(col, .35), { lift: .4, alpha: clamp(a) }); }

// ---------- the Miró vocabulary ----------
// dot(x, y, r, col): a little cut circle.   hoop(x, y, r, w, col): a cut ring (a hole in the middle).
function dot(x, y, r, col = 'black', o = {}) { cut(ellPts(x, y, r, r, Math.max(14, Math.min(72, Math.round(r * .8)))), col, o); }
function hoop(x, y, r, w, col = 'black', o = {}) { const n = Math.max(24, Math.min(90, Math.round(r))); cut(ellPts(x, y, r, r, n), col, { ...o, hole: ellPts(x, y, r - w, r - w, n) }); }
// star(x, y, r, col, o): a cut 5-point star (o.points, o.inner, o.rot)
function star(x, y, r, col = 'yellow', o = {}) { cut(starPts(x, y, r, o.inner ?? .45, o.points ?? 5, o.rot ?? -Math.PI / 2), col, o); }
// asterisk(x, y, r, o): Miró's painted star: strokes crossing at a point, each tapering to both ends, and a dot
function asterisk(x, y, r, o = {}) {
  const n = o.n ?? 4, rot = o.rot ?? .2, w = o.w ?? Math.max(4, r * .16);
  for (let i = 0; i < n; i++) { const a = rot + i * Math.PI / n, c = Math.cos(a), s = Math.sin(a), rr = r * (i % 2 ? .78 : 1);
    brush([[x - c * rr, y - s * rr], [x + c * rr, y + s * rr]], { w, col: o.col ?? 'black', curv: 0, taper: .5, press: .15, key: (o.key ?? '') + 'a' + i, k: o.k }); }
  if (o.dot !== false) dot(x, y, w * .7, o.col ?? 'black', { lift: 0 });
}
// moon(x, y, r, col, o): a crescent (o.fat 0..1: 0 = a hairline, .5 = a half moon; o.rot)
function moon(x, y, r, col = 'yellow', o = {}) {
  const ph = o.fat ?? .3, rot = o.rot ?? -.4, P = [], n = 40;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI; P.push([Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = n - 1; i > 0; i--) { const a = -Math.PI / 2 + i / n * Math.PI; P.push([Math.cos(a) * r * (1 - 2 * ph), Math.sin(a) * r]); }
  const c = Math.cos(rot), s = Math.sin(rot);
  cut(P.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]), col, o);
}
// sun(x, y, r, col, o): a disc with painted rays (o.rays count, o.spin, o.rayCol)
function sun(x, y, r, col = 'red', o = {}) {
  const n = o.rays ?? 12, sp = o.spin ?? 0, rl = o.rayLen ?? r * .55;
  if (n > 0) for (let i = 0; i < n; i++) { const a = sp + i / n * TAU, c = Math.cos(a), s = Math.sin(a);
    brush([[x + c * (r + 14), y + s * (r + 14)], [x + c * (r + 14 + rl * (i % 2 ? .7 : 1)), y + s * (r + 14 + rl * (i % 2 ? .7 : 1))]], { w: o.rayW ?? Math.max(5, r * .09), col: o.rayCol ?? 'black', curv: 0, taper: .6, key: (o.key ?? '') + 'r' + i, k: o.k }); }
  dot(x, y, r, col, o);
}
// eye(x, y, r, o): a Miró eye: a white almond with a black outline, a coloured iris, a black pupil and lashes.
//   o: { iris (colour), look [-1..1, -1..1], blink 0..1, lashes (count), rot }
function eye(x, y, r, o = {}) {
  const bl = clamp(o.blink ?? 0), hgt = r * .62 * (1 - .92 * bl), P = [], n = 24, rot = o.rot ?? 0;
  push(); translate(x, y); rotate(rot);
  for (let i = 0; i <= n; i++) { const u = i / n * 2 - 1; P.push([u * r, -hgt * (1 - u * u)]); }
  for (let i = n - 1; i > 0; i--) { const u = i / n * 2 - 1; P.push([u * r, hgt * .85 * (1 - u * u)]); }
  cut(P, 'white', { key: 'eye' + (o.key ?? '') });
  if (bl < .8) {
    const lk = o.look || [0, 0], ix = lk[0] * r * .35, iy = lk[1] * hgt * .3;
    dot(ix, iy, r * .34 * (1 - bl), o.iris ?? 'blue', { lift: .3, key: 'iris' });
    dot(ix, iy, r * .15 * (1 - bl), 'black', { lift: 0, key: 'pupil' });
  }
  brush(P.slice(0, n + 1), { w: Math.max(4, r * .1), curv: 0, taper: .15, key: 'lid' + (o.key ?? '') });
  const nl = o.lashes ?? 5;
  for (let i = 0; i < nl; i++) { const u = (i + .5) / nl * 1.4 - .7, px = u * r, py = -hgt * (1 - u * u), a = -Math.PI / 2 + u * 1.1;
    brush([[px, py - 3], [px + Math.cos(a) * r * .32, py + Math.sin(a) * r * .32]], { w: Math.max(3, r * .07), curv: 0, taper: .6, key: 'lash' + i }); }
  pop();
}
// ladder(x0, y0, x1, y1, o): Miró's ladder: two brushed rails and rungs (o.rungs, o.width, o.k draws it on)
function ladder(x0, y0, x1, y1, o = {}) {
  const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, hw = (o.width ?? 60) / 2, n = o.rungs ?? Math.max(3, Math.round(L / 70)), w = o.w ?? 9, k = o.k ?? 1;
  for (const s of [-1, 1]) brush([[x0 - dy * hw * s, y0 + dx * hw * s], [x0 + (x1 - x0) * k - dy * hw * s, y0 + (y1 - y0) * k + dx * hw * s]], { w, curv: 0, taper: .08, key: 'rail' + s });
  for (let i = 1; i < n; i++) { const f = i / n; if (f > k) break; const cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f;
    brush([[cx - dy * hw * 1.1, cy + dx * hw * 1.1], [cx + dy * hw * 1.1, cy - dx * hw * 1.1]], { w: w * .8, curv: 0, taper: .3, key: 'rung' + i }); }
}
// blob(x, y, r, col, o): a biomorphic shape, soft and lumpy (o.lumps, o.seed, o.squash, o.rot)
function blobPts(x, y, r, o = {}) {
  const n = 14, s = o.seed ?? 1, lumps = o.lumps ?? .32, sq = o.squash ?? 1, rot = o.rot ?? 0, P = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (1 + lumps * (smn(i * .9, s) * .8 + .35 * Math.sin(a * 2 + s)));
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * sq; P.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]); }
  return P;
}
function blob(x, y, r, col = 'green', o = {}) { cut(blobPts(x, y, r, o), col, { ...o, curv: true }); }
// spiral(x, y, r, o): a brushed spiral (o.turns, o.w, o.k draws it on, o.rot)
function spiral(x, y, r, o = {}) {
  const t = o.turns ?? 2.6, P = [], n = Math.ceil(t * 28), rot = o.rot ?? 0;
  for (let i = 0; i <= n; i++) { const f = i / n, a = rot + f * t * TAU, rr = r * (.08 + .92 * f); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  brush(P, { w: o.w ?? Math.max(5, r * .09), curv: 0, taper: .15, k: o.k, col: o.col, key: o.key });
}
// wave(x0, y, x1, amp, o): a brushed wavy line (o.waves, o.w, o.k)
function wave(x0, y, x1, amp = 20, o = {}) {
  const n = o.waves ?? 4, P = [], m = n * 8;
  for (let i = 0; i <= m; i++) { const f = i / m; P.push([lerp(x0, x1, f), y + Math.sin(f * n * TAU + (o.ph ?? 0)) * amp]); }
  brush(P, { w: o.w ?? 8, curv: 0, taper: .15, k: o.k, col: o.col, key: o.key });
}
// bird(x, y, s, col, o): a Miró-like bird: a plump teardrop body, a black half-moon wing that flaps, a yellow beak, one
// big eye, a brushed forked tail and a stick leg. o: { flap 0..1 (wing up), flip, wingCol }
function bird(x, y, s, col = 'red', o = {}) {
  push(); translate(x, y); if (o.flip) scale(-1, 1); scale(s / 100);
  const fl = o.flap ?? 0;
  brush([[-58, 6], [-112, -26]], { w: 9, curv: 0, taper: .4, key: 'tail1' }); brush([[-58, 12], [-114, 28]], { w: 9, curv: 0, taper: .4, key: 'tail2' });
  dot(-116, -28, 7, 'black', { lift: 0, key: 'tt1' }); dot(-118, 30, 7, 'black', { lift: 0, key: 'tt2' });
  brush([[4, 30], [2, 74]], { w: 7, curv: 0, taper: .15, key: 'leg' }); brush([[2, 72], [22, 76]], { w: 6, curv: 0, taper: .3, key: 'toe' });
  cut([[48, -30], [102, -12], [50, 2]], 'yellow', { key: 'beak' });
  cut([[-68, 4], [-34, -34], [20, -44], [60, -16], [44, 22], [-16, 34]], col, { curv: true, key: 'bbody' });
  // the wing: a half moon hinged at its straight edge, which swings up when it flaps
  push(); translate(-4, -10); rotate(1.2 * fl); moon(-30, 0, 34, o.wingCol ?? 'blue', { fat: .5, rot: Math.PI / 2 + .35, key: 'wing', lift: .6 }); pop();
  dot(26, -18, 12, 'white', { lift: .3, key: 'bw' }); dot(29, -18, 5.5, 'black', { lift: 0, key: 'bp' });
  pop();
}
// comet(x, y, ang, len, col, o): a little comet, a disc with brushed trailing lines
function comet(x, y, ang, len = 160, col = 'red', o = {}) {
  const r = o.r ?? 18, c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c;
  for (let i = -1; i <= 1; i++) brush([[x - c * r * .6 + px * i * r * .55, y - s * r * .6 + py * i * r * .55], [x - c * len * (i ? .7 : 1) + px * i * r * 1.1, y - s * len * (i ? .7 : 1) + py * i * r * 1.1]], { w: i ? 4 : 6, curv: 0, taper: .7, key: 'tail' + i });
  dot(x, y, r, col, o);
}
// scatter(n, [x, y, w, h], seed, fn): call fn(x, y, i, h) at n seeded spots (for fields of stars and dots)
function scatter(n, [x, y, w, h], seed, fn) { for (let i = 0; i < n; i++) fn(x + hash(i * 3.1 + seed) * w, y + hash(i * 7.7 + seed + 40) * h, i, hash(i * 1.3 + seed + 90)); }

// ---------- lettering: chunky hand-cut letters pasted on ----------
// type(txt, x, y, size, col, o): each letter is its own cut piece: its own little tilt and baseline shift (fixed by the
// seed), its own grain and a drop shadow. Default face Luckiest Guy (chunky, hand-made); o.face 'rubik' for Rubik 800
// (cleaner, for small type). o: { rot, pop (0..1: letters pop in one after another), align, spacing, jig (tilt,
// default .07 rad), lift, alpha, outline (colour of a brushed-looking outline), face }
const TYPE_FONT = '"Luckiest Guy", "Rubik", Impact, sans-serif', SUB_FONT = '"Rubik", "Arial Black", sans-serif';
const fontOf = (size, face) => face === 'rubik' ? `800 ${size}px ${SUB_FONT}` : `${size}px ${TYPE_FONT}`;
const MEASURE = new Map();
function charW(ch, size, face) {
  const k = ch + '|' + face; if (!MEASURE.has(k)) { const c = CTX; c.save(); c.font = fontOf(100, face); MEASURE.set(k, c.measureText(ch).width / 100); c.restore(); }
  return MEASURE.get(k) * size;
}
function textWidth(txt, size, o = {}) { let w = 0; for (const ch of txt) w += charW(ch, size, o.face) + (o.spacing ?? .02) * size; return w - (o.spacing ?? .02) * size; }
function type(txt, x, y, size, col = 'black', o = {}) {
  const hex = colHex(col); if (!hex || !txt) return;
  const chars = [...txt], n = chars.length, sp = (o.spacing ?? .02) * size, face = o.face;
  const ws = chars.map(ch => charW(ch, size, face)), total = ws.reduce((a, b) => a + b, 0) + sp * (n - 1);
  let cx = o.align === 'left' ? 0 : o.align === 'right' ? -total : -total / 2;
  const jig = o.jig ?? .07, base = seedOf(COL.seed, o.key ?? txt), lift = o.lift ?? .8;
  const c = CTX; c.save(); c.globalAlpha = clamp(o.alpha ?? 1);
  push(); translate(x, y); rotate(o.rot || 0);
  c.font = fontOf(size, face); c.textAlign = 'center'; c.textBaseline = 'middle';
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  const stagger = o.stagger ?? .7;
  for (let i = 0; i < n; i++) {
    const ch = chars[i], lx = cx + ws[i] / 2; cx += ws[i] + sp;
    if (ch === ' ') continue;
    let k = 1;
    if (o.pop != null) { const f = clamp(o.pop * (1 + stagger) - stagger * i / Math.max(1, n - 1)); k = f <= 0 ? 0 : backOut(clamp(f * 1.6)); }
    if (k <= .01) continue;
    const r = (h2(i, base) - .5) * 2 * jig, dy = (h2(i, base + 3) - .5) * size * .06;
    push(); translate(lx, dy); rotate(r); scale(k); c.setTransform(...MX);
    if (o.outline) { setShadow(c, lift); c.lineJoin = 'round'; c.lineWidth = size * .14; c.strokeStyle = colHex(o.outline); c.strokeText(ch, 0, 0); c.shadowColor = 'transparent'; }
    else setShadow(c, lift);
    c.fillStyle = hex; c.fillText(ch, 0, 0);
    c.shadowColor = 'transparent'; c.globalCompositeOperation = 'soft-light';
    const ga = c.globalAlpha; c.globalAlpha = ga * .7 * COL.grain; c.fillStyle = grainPattern(0, 0, base + i); c.fillText(ch, 0, 0);
    c.globalAlpha = ga; c.globalCompositeOperation = 'source-over';
    pop();
  }
  pop(); c.restore();
}
// label(txt, x, y, size, col, o): a strip of cut paper with small type on it (o.bg strip colour, o.pad)
function label(txt, x, y, size, col = 'black', o = {}) {
  const w = textWidth(txt, size, { face: o.face ?? 'rubik', spacing: o.spacing ?? .03 }), pad = o.pad ?? size * .45, k = o.pop != null ? backOut(clamp(o.pop)) : 1;
  if (k <= .01) return;
  const ax = o.align === 'left' ? 0 : o.align === 'right' ? -w : -w / 2;
  push(); translate(x, y); rotate(o.rot ?? 0); scale(k);
  cut(rectPts(ax - pad, -size * .78, w + pad * 2, size * 1.56), o.bg ?? 'white', { torn: o.torn, key: 'lab' + txt, lift: o.lift ?? .8 });
  type(txt, ax + w / 2, size * .04, size, col, { face: o.face ?? 'rubik', jig: o.jig ?? .015, lift: .15, spacing: o.spacing ?? .03 });
  pop();
}
// legacy names
function letter(txt, x, y, size, color, o = {}) { type(txt, x, y, size, color, o); }
function sfx(txt, x, y, size, color, age, o = {}) {
  const life = o.life ?? 1.2; if (age < 0 || age > life) return;
  type(txt, x, y, size, color, { pop: age * 3, rot: (o.rot ?? -.08), alpha: 1 - seg(age, life - .25, life), ...o });
}
function flushLetters() {}

// ---------- photos, printed and cut out ----------
// pasteImage(img, x, y, w, h, o): print a photo (or a video frame) on paper and cut it out with scissors: a white cut
// border around the subject, the paper's grain over the print, and a drop shadow. With a matte the cut follows the
// subject; without one it's a rectangle with scissor-cut edges.
//   o: { matte (same-size image, white = keep), border (px in the IMAGE's pixels, default 14), key (cache: the same key
//        reuses the cutout), grade (CSS filter for the print, default a warm, slightly punchy print),
//        tornBottom (image-y where a torn edge crosses the bottom, e.g. to cut off the frame edge), lift, rot, alpha }
const CUT_CACHE = new Map(), WOBBLE = new Map();
// the border's scissor wobble: a width field fixed in image space (computed once per size)
function wobbleField(cw, ch, B) {
  const k = cw + 'x' + ch + 'x' + B; if (WOBBLE.has(k)) return WOBBLE.get(k);
  const F = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) F[y * cw + x] = B * (1 + .22 * pln((x * .7 + y * .3) / 60, 3) + .12 * pln((y - x * .4) / 23, 4));
  WOBBLE.set(k, F); return F;
}
function buildCutout(img, o) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, B = Math.round(o.border ?? 14), P = B + 8;
  const cw = iw + 2 * P, ch = ih + 2 * P;
  const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
  // 1. the subject's alpha, from the matte (red channel) or the image
  const tmp = mk(), tx = tmp.getContext('2d', { willReadFrequently: true });
  tx.drawImage(o.matte || img, P, P, iw, ih);
  const md = tx.getImageData(0, 0, cw, ch).data;
  // torn bottom: a jagged line across the image; everything under it is gone (the white rim sits just above it)
  const tornY = o.tornBottom != null ? X => P + o.tornBottom + 7 * smn(X / 38, 5) + 3 * pln(X / 7, 9) : null;
  // 2. the white border: a distance field (half resolution, chamfer 3-4) from the subject, thresholded at B, with a gentle
  // scissor wobble fixed in IMAGE space (so it doesn't swim as he moves)
  const s = 2, hw = Math.ceil(cw / s), hh = Math.ceil(ch / s), INF = 1e9, D = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { const i = ((y * s) * cw + x * s) * 4; D[y * hw + x] = (o.matte ? md[i] : md[i + 3]) > 110 ? 0 : INF; }
  const a = 3, b = 4;
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { const i = y * hw + x; let v = D[i]; if (v === 0) continue;
    if (x > 0) v = Math.min(v, D[i - 1] + a); if (y > 0) { v = Math.min(v, D[i - hw] + a); if (x > 0) v = Math.min(v, D[i - hw - 1] + b); if (x < hw - 1) v = Math.min(v, D[i - hw + 1] + b); } D[i] = v; }
  for (let y = hh - 1; y >= 0; y--) for (let x = hw - 1; x >= 0; x--) { const i = y * hw + x; let v = D[i]; if (v === 0) continue;
    if (x < hw - 1) v = Math.min(v, D[i + 1] + a); if (y < hh - 1) { v = Math.min(v, D[i + hw] + a); if (x < hw - 1) v = Math.min(v, D[i + hw + 1] + b); if (x > 0) v = Math.min(v, D[i + hw - 1] + b); } D[i] = v; }
  const bd = mk(), bx = bd.getContext('2d'), bimg = bx.createImageData(cw, ch), bp = bimg.data;
  const F = wobbleField(cw, ch, B), TY = tornY ? Float32Array.from({ length: cw }, (_, x) => tornY(x)) : null;
  for (let y = 0; y < ch; y++) {
    const fy = Math.min(hh - 1.001, y / s), iy = fy | 0, v = fy - iy;
    for (let x = 0; x < cw; x++) {
      const j = (y * cw + x) * 4, fx = Math.min(hw - 1.001, x / s), ix = fx | 0, u = fx - ix, i = iy * hw + ix;
      const d = (D[i] * (1 - u) * (1 - v) + D[i + 1] * u * (1 - v) + D[i + hw] * (1 - u) * v + D[i + hw + 1] * u * v) / 3 * s;   // px
      let al = F[y * cw + x] - d + .5; al = al < 0 ? 0 : al > 1 ? 1 : al;
      if (TY) { const e = TY[x] - y + .5; al *= e < 0 ? 0 : e > 1 ? 1 : e; }
      bp[j] = bp[j + 1] = bp[j + 2] = 255; bp[j + 3] = al * 255;
    }
  }
  bx.putImageData(bimg, 0, 0);
  // 3. the cutout: white paper, the graded photo inside the subject's matte, paper grain over all of it
  const out = mk(), ox = out.getContext('2d');
  ox.fillStyle = colHex(o.borderCol || 'white'); ox.fillRect(0, 0, cw, ch);
  ox.globalCompositeOperation = 'destination-in'; ox.drawImage(bd, 0, 0); ox.globalCompositeOperation = 'source-over';
  const ph = mk(), px = ph.getContext('2d');
  px.filter = o.grade ?? 'saturate(1.12) contrast(1.06) sepia(.06) brightness(1.02)'; px.drawImage(img, P, P, iw, ih); px.filter = 'none';
  px.globalCompositeOperation = 'destination-in';
  if (o.matte) {   // the matte as an alpha mask (red → alpha), choked a little so no background fringe survives at the edge
    const mm = mk(), mx = mm.getContext('2d'), mi = mx.createImageData(cw, ch), mp = mi.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const j = (y * cw + x) * 4; let al = md[j] / 255; al = al < .38 ? 0 : al > .85 ? 1 : (al - .38) / .47; if (TY) { const e = TY[x] - 5 - y + .5; al *= e < 0 ? 0 : e > 1 ? 1 : e; } mp[j + 3] = al * 255; }
    mx.putImageData(mi, 0, 0); px.drawImage(mm, 0, 0);
  } else px.fillRect(P, P, iw, ih);
  ox.drawImage(ph, 0, 0);
  ox.globalCompositeOperation = 'soft-light'; ox.globalAlpha = .55 * COL.grain; const pat = ox.createPattern(GRAIN_T, 'repeat'); ox.fillStyle = pat; ox.fillRect(0, 0, cw, ch);
  ox.globalCompositeOperation = 'destination-in'; ox.globalAlpha = 1; ox.drawImage(bd, 0, 0);
  return { canvas: out, P };
}
function pasteImage(img, x, y, w, h, o = {}) {
  if (!img || !(img.naturalWidth || img.width)) return;
  const key = o.key != null ? o.key + '|' + (o.border ?? 14) + '|' + (o.tornBottom ?? '') : null;
  let cutp = key ? CUT_CACHE.get(key) : null;
  if (!cutp) { cutp = buildCutout(img, o); if (key) { CUT_CACHE.set(key, cutp); if (CUT_CACHE.size > 8) CUT_CACHE.delete(CUT_CACHE.keys().next().value); } }
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, sx = w / iw, sy = h / ih;
  const c = CTX; c.save(); push(); translate(x + w / 2, y + h / 2); rotate(o.rot || 0); c.setTransform(...MX);
  c.globalAlpha = clamp(o.alpha ?? 1); setShadow(c, o.lift ?? 1.3);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(cutp.canvas, -w / 2 - cutp.P * sx, -h / 2 - cutp.P * sy, cutp.canvas.width * sx, cutp.canvas.height * sy);
  pop(); c.restore();
}
