// riso.js: the MEDIUM. Everything you paint lands on spot-ink layers (one per ink, like the masters of a risograph),
// and a WebGL compositor prints them onto paper: each layer is screened into halftone dots or grain at its own angle,
// shifted and rotated a few px out of register (drifting very slowly), given ink texture (uneven coverage, speckle,
// drop-outs, soft ragged edges, paper tooth) and multiplied onto the paper, so overlapping inks make new colours.
//
// Colours: anywhere a colour is taken you may pass
//   'pink'                      an ink name (see INKS), solid
//   { pink: 1, blue: .4 }       a RECIPE: a density 0..1 per ink (how riso colours are really specified)
//   '#D97757'                   any hex colour: it is SEPARATED into the active inks automatically (closest match)
//   [1, .4, 0]                  densities in RISO.inks order
// Density is TONE: anything below 1 prints as a halftone (or grain), never as a smooth tint.
//
// Stacking: by default a shape KNOCKS OUT the inks under it (it replaces every layer's density inside its outline, so
// z-order works as in normal painting). { over: true } OVERPRINTS instead: it only adds ink, so pink over blue makes
// purple. Overprinting is the heart of the look: use it on purpose.
//
// This file also provides the small slice of p5 the kit uses (push/pop/translate/rotate/scale/resetMatrix and a seeded
// random()), so there is no p5 or p5.brush dependency.

// ---------- the ink catalogue (real riso ink colours) ----------
const INKS = {
  pink:    { name: 'Fluorescent Pink', hex: '#FF48B0', angle: 75, op: .92 },
  blue:    { name: 'Blue',             hex: '#0078BF', angle: 15, op: .92 },
  yellow:  { name: 'Yellow',           hex: '#FFE800', angle: 0,  op: .95 },
  teal:    { name: 'Teal',             hex: '#00838A', angle: 45, op: .92 },
  orange:  { name: 'Orange',           hex: '#FF6C2F', angle: 60, op: .92 },
  federal: { name: 'Federal Blue',     hex: '#3D5588', angle: 30, op: .92 },
  black:   { name: 'Black',            hex: '#000000', angle: 45, op: .88 },
  red:     { name: 'Bright Red',       hex: '#F15060', angle: 60, op: .92 },
  green:   { name: 'Green',            hex: '#00A95C', angle: 45, op: .92 },
  purple:  { name: 'Purple',           hex: '#765BA7', angle: 30, op: .92 },
};

// ---------- print settings ----------
// Reset every frame to RISO_DEFAULTS + PROJECT.riso; a shot may call riso({...}) FIRST (before painting) to change them.
const RISO_DEFAULTS = {
  inks: ['pink', 'blue', 'yellow'],   // 1–6 inks, printed in this order (the order changes nothing: multiply commutes)
  paper: '#F4EFE6',                   // off-white stock
  cell: 9,                            // halftone cell in px (≈ 110 lpi across a 1920 frame viewed at 1080p)
  screens: {},                        // per ink: 'dot' (default) or 'grain', e.g. { yellow: 'grain' }
  angles: {},                         // per ink screen angle override in degrees (defaults in INKS)
  misreg: 3.2,                        // max registration offset per layer, px
  skew: .14,                          // max registration rotation per layer, degrees
  drift: 1.4,                         // slow wander of the registration, px
  driftPeriod: 14,                    // seconds per wander cycle (keep it slow: registration must not jitter)
  texture: 1,                         // ink texture strength 0..1 (uneven coverage, speckle, banding, tooth)
  seed: 1,                            // the "print run": fixes registration, grain and speckle. Change it per shot
  line: 1,                            // multiplier on outline weights (0 = no outlines at all)
  shift: {},                          // per ink extra offset [dx, dy] in px, e.g. { pink: [-400, 0] }: slide a whole
                                      // colour layer (the ink-layer slide-in); animate it as a pure function of t
};
let RISO = { ...RISO_DEFAULTS };
function riso(cfg = {}) {
  const inksChanged = cfg.inks && cfg.inks.join() !== RISO.inks.join();
  RISO = { ...RISO, ...cfg, screens: { ...RISO.screens, ...(cfg.screens || {}) }, angles: { ...RISO.angles, ...(cfg.angles || {}) }, shift: { ...RISO.shift, ...(cfg.shift || {}) } };
  if (inksChanged) risoClear();
  return RISO;
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

// ---------- colour → ink densities ----------
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const inkRGB = k => hexRGB((INKS[k] || INKS.black).hex);
// the printed colour of a density vector over the active inks (multiply model), relative to white paper
function printRGB(D, inks = RISO.inks) {
  const c = [1, 1, 1];
  inks.forEach((k, i) => { const d = clamp(D[i] || 0) * (INKS[k]?.op ?? .92), ic = inkRGB(k); for (let j = 0; j < 3; j++) c[j] *= 1 - d * (1 - ic[j]); });
  return c;
}
const SEP = new Map();
// Separation: the densities of the active inks whose overprint best matches a target colour. Cached.
function separate(hex) {
  const key = hex + '|' + RISO.inks.join();
  if (SEP.has(key)) return SEP.get(key);
  const t = hexRGB(hex), n = RISO.inks.length, paper = hexRGB(RISO.paper);
  const target = t.map((v, j) => Math.min(1, v / Math.max(.5, paper[j])));   // colour relative to the paper
  const err = D => { const c = printRGB(D); let e = 0; const w = [.3, .59, .11]; for (let j = 0; j < 3; j++) e += w[j] * (c[j] - target[j]) ** 2; return e + .0008 * D.reduce((s, d) => s + d, 0); };
  let best = new Array(n).fill(0), be = err(best);
  if (n <= 3) {   // grid search, then refine
    const S = 12, D = new Array(n).fill(0);
    const rec = i => { if (i === n) { const e = err(D); if (e < be) { be = e; best = D.slice(); } return; } for (let s = 0; s <= S; s++) { D[i] = s / S; rec(i + 1); } };
    rec(0);
  }
  for (let step = .1; step > .004; step *= .5) for (let it = 0; it < 6; it++) for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const D = best.slice(); D[i] = clamp(D[i] + s * step); const e = err(D); if (e < be) { be = e; best = D; }
  }
  SEP.set(key, best);
  return best;
}
// Any colour → densities in RISO.inks order (or null for "no colour").
function dens(C) {
  if (C == null || C === false) return null;
  const inks = RISO.inks;
  if (Array.isArray(C)) return inks.map((_, i) => clamp(C[i] || 0));
  if (typeof C === 'string') {
    if (C[0] === '#') return separate(C.length === 4 ? '#' + [...C.slice(1)].map(c => c + c).join('') : C.slice(0, 7));
    const i = inks.indexOf(C);
    if (i >= 0) return inks.map((_, j) => j === i ? 1 : 0);
    if (INKS[C]) return separate(INKS[C].hex);
    return null;
  }
  if (typeof C === 'object') {
    const keys = Object.keys(C);
    if (keys.every(k => inks.includes(k))) return inks.map(k => clamp(C[k] || 0));
    // a recipe using inks that aren't loaded: print its colour with the inks that are
    const all = [...new Set([...inks, ...keys])], c = printRGB(all.map(k => C[k] || 0), all);
    const h = '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
    return separate(h);
  }
  return null;
}
// tone(C, k): the same colour at k × the density (a lighter screen of it).
const tone = (C, k) => { const D = dens(C); return D && D.map(d => clamp(d * k)); };
// the colour a recipe prints as, as a hex string (for UI, previews, the dissolve's cover colour)
const printHex = C => { const D = dens(C) || [], c = printRGB(D), p = hexRGB(RISO.paper); return '#' + c.map((v, j) => Math.round(clamp(v * p[j]) * 255).toString(16).padStart(2, '0')).join(''); };

// ---------- ink layers ----------
// Density is stored inverted in RGB channels (255 = no ink), three inks per canvas, so one fill writes every ink at
// once. Knockout = source-over (replace all channels); overprint = 'darken' (per-channel max density; channels of inks
// the shape doesn't use get 255 and stay as they were).
let LAYERS = [];
function risoInit() {
  LAYERS = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d'); });
  glInit();
}
function risoClear() {
  for (const c of LAYERS) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); }
}
const chan = v => Math.round(255 * (1 - clamp(v)));
// CSS colour for canvas j from a density vector (untouched = 255)
function layerCSS(D, j, a = 1) {
  const v = [0, 1, 2].map(c => chan(D[3 * j + c] || 0));
  return a >= 1 ? `rgb(${v})` : `rgba(${v},${a})`;
}
const usedCanvases = () => RISO.inks.length > 3 ? [0, 1] : [0];
// Fill (or stroke) with density vector D on every layer canvas. o: { over, alpha, stroke: {w}, ramp }
function inkDo(D, draw, o = {}) {
  if (!D) return;
  const a = clamp(o.alpha ?? 1); if (a <= 0) return;
  for (const j of usedCanvases()) {
    if (o.over && !D.slice(3 * j, 3 * j + 3).some(d => d > 0)) continue;
    const c = LAYERS[j];
    c.setTransform(...MX);
    c.globalCompositeOperation = o.over ? 'darken' : 'source-over';
    c.globalAlpha = a;
    const style = o.ramp ? rampStyle(c, D, j, o.ramp) : layerCSS(D, j);
    draw(c, style);
  }
}
// ramp: { from: [x, y], to: [x, y] } linear, or { c: [x, y], r: R, r0 } radial; a → b are the tone at each end
// (default 1 → 0). fade: true fades the COVERAGE (alpha) instead, so the far end shows what's underneath.
function rampStyle(c, D, j, R) {
  const g = R.c ? c.createRadialGradient(R.c[0], R.c[1], R.r0 || 0, R.c[0], R.c[1], R.r) : c.createLinearGradient(R.from[0], R.from[1], R.to[0], R.to[1]);
  const a = R.a ?? 1, b = R.b ?? 0, n = R.fade ? 2 : 6;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), e = R.ease ? R.ease(k) : k;
    g.addColorStop(k, R.fade ? layerCSS(D.map(d => d * a), j, 1 - e * (1 - b)) : layerCSS(D.map(d => d * lerp(a, b, e)), j));
  }
  return g;
}

// ---------- painting ----------
// Closed smooth path through points (Catmull-Rom around the loop), n samples per span.
function throughClosed(P, n = 5) {
  const L = P.length; if (L < 3) return P.slice(); const out = [];
  for (let i = 0; i < L; i++) {
    const p0 = P[(i - 1 + L) % L], p1 = P[i], p2 = P[(i + 1) % L], p3 = P[(i + 2) % L];
    for (let k = 0; k < n; k++) { const u = k / n, u2 = u * u, u3 = u2 * u; out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3))); }
  }
  return out;
}
function pathOf(pts, closed = true, curv = 0) {
  const P = curv > 0 ? (closed ? throughClosed(pts) : through(pts)) : pts, p = new Path2D();
  P.forEach(([x, y], i) => { if (!isFinite(x) || !isFinite(y)) return; i ? p.lineTo(x, y) : p.moveTo(x, y); });
  if (closed) p.closePath();
  return p;
}
const LINE_PX = 5;   // outline weight sw = 1 → 5 px (at zoom 1)

// paint(pts, o): one printed shape. Options:
//   fill (or wash / col)   colour (ink name, recipe, hex, densities)
//   tone                   0..1 density multiplier (the halftone percentage)
//   over                   true = overprint (multiply onto what's there) instead of knocking out
//   ramp                   a tone gradient, printed as a halftone ramp (see rampStyle)
//   alpha                  0..1 coverage: blends the shape's densities with what's underneath (a knockout that fades)
//   ink, sw                optional outline colour and weight (default: no outline; RISO.line scales it)
//   curv                   0..1 smooth the outline through the points
//   hatch: { d, a, c, w }  parallel lines clipped to the shape (distance px, angle, colour, weight)
// Legacy p5.brush options map onto these: washOp/fillOp (0–255) → alpha, bleed/tex/border are ignored.
function paint(pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const path = pathOf(pts, true, o.curv || 0), col = o.col ?? o.wash ?? o.fill;
  const base = { over: !!o.over, ramp: o.ramp };
  if (o.wash != null && o.fill != null) {   // legacy: flat wash, then a partial fill layered on it
    inkDo(tone(o.wash, o.tone ?? 1), (c, s) => { c.fillStyle = s; c.fill(path); }, { ...base, alpha: (o.washOp ?? 255) / 255 * (o.alpha ?? 1) });
    inkDo(dens(o.fill), (c, s) => { c.fillStyle = s; c.fill(path); }, { over: !!o.over, alpha: (o.fillOp ?? 170) / 255 * .6 });
  } else if (col != null) {
    const op = o.wash != null ? (o.washOp ?? 255) / 255 : o.fill != null && o.fillOp != null ? o.fillOp / 255 : 1;
    inkDo(tone(col, o.tone ?? 1), (c, s) => { c.fillStyle = s; c.fill(path); }, { ...base, alpha: op * (o.alpha ?? 1) });
  }
  if (o.hatch) {
    const h = o.hatch, D = dens(h.c ?? PAL.ink), d = Math.max(3, h.d || 20);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2 + d, ca = Math.cos(h.a || 0), sa = Math.sin(h.a || 0);
    inkDo(D, (c, s) => {
      c.save(); c.clip(path); c.strokeStyle = s; c.lineWidth = (h.w || 1) * 2.5; c.beginPath();
      for (let k = -r; k <= r; k += d) { c.moveTo(cx + ca * -r - sa * k, cy + sa * -r + ca * k); c.lineTo(cx + ca * r - sa * k, cy + sa * r + ca * k); }
      c.stroke(); c.restore();
    }, { over: true });
  }
  if (o.ink != null && RISO.line > 0) {
    const w = (o.sw ?? 1) * LINE_PX * RISO.line;
    inkDo(dens(o.ink), (c, s) => { c.strokeStyle = s; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(path); }, { over: !!o.over });
  }
}
// inkLine(pts, sw, colour, brush, curvature): an open printed line with round caps. brush is accepted for
// compatibility: 'dry' prints it at 55% tone (broken up by the screen), 'inkfine' slightly thinner.
function inkLine(pts, sw = 1, col = PAL.ink, br = 'ink', curv = .5, o = {}) {
  if (!pts || pts.length < 2 || RISO.line <= 0 && !o.force) return;
  const path = pathOf(pts, false, curv > 0 && pts.length > 2 ? curv : 0);
  const w = sw * LINE_PX * (br === 'inkfine' ? .8 : 1) * (o.force ? 1 : RISO.line);
  inkDo(tone(col, br === 'dry' ? .55 : (o.tone ?? 1)), (c, s) => { c.strokeStyle = s; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(path); }, { over: !!o.over, alpha: o.alpha ?? 1 });
}
// A circular outline or arc, useful for geometric posters: arcLine(cx, cy, r, weight px, colour, { a0, a1, over })
function arcLine(cx, cy, r, w, col, o = {}) {
  const p = new Path2D(); p.arc(cx, cy, Math.max(.1, r), o.a0 ?? 0, o.a1 ?? TAU);
  inkDo(tone(col, o.tone ?? 1), (c, s) => { c.strokeStyle = s; c.lineWidth = w; c.lineCap = o.cap || 'butt'; c.stroke(p); }, { over: !!o.over });
}

// "Light" in print is LESS ink: glow() pulls every layer toward a colour (yellow by default) in a radial halftone ramp,
// so a lamp on a dark ground becomes a burst of dots. Draw it before whatever sits in front of the light.
function glow(x, y, r, col = 'yellow', a = 1) {
  if (a <= 0 || r < 1) return;
  const D = dens(col) || dens('yellow');
  inkDo(D, (c, s) => { c.fillStyle = s; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }, { ramp: { c: [x, y], r, a: 1, b: 0, fade: true, ease: k => Math.pow(k, .7) }, alpha: clamp(a) });
}

// ---------- pictures (a photo or a video frame, separated into the inks) ----------
// inkImage(src, x, y, w, h, sep, o): print a bitmap through the inks, the way a riso prints a photo: sep(r, g, b, D)
// gets each pixel (0..255) and writes its ink densities (0..1, RISO.inks order) into D. The result goes into the ink
// layers like any shape (knockout by default, o.over to overprint), so it halftones, misregisters, textures and
// multiplies with everything else. Never a bitmap composited on top.
//   o: { matte (same-size image, red channel: white = print), over, alpha, key (cache: same key + inks = reuse) }
const IMG_CACHE = new Map(); let IMG_SC = null;
function inkImage(src, x, y, w, h, sep, o = {}) {
  const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height, n = RISO.inks.length;
  const key = o.key != null ? o.key + '|' + RISO.inks.join() : null;
  let outs = key ? IMG_CACHE.get(key) : null;
  if (!outs) {
    if (!IMG_SC) IMG_SC = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const sc = IMG_SC; if (sc.canvas.width !== iw || sc.canvas.height !== ih) { sc.canvas.width = iw; sc.canvas.height = ih; }
    sc.clearRect(0, 0, iw, ih); sc.drawImage(src, 0, 0, iw, ih); const px = sc.getImageData(0, 0, iw, ih).data;
    let mp = null; if (o.matte) { sc.clearRect(0, 0, iw, ih); sc.drawImage(o.matte, 0, 0, iw, ih); mp = sc.getImageData(0, 0, iw, ih).data; }
    const nc = n > 3 ? 2 : 1, D = new Float32Array(6), data = [];
    for (let j = 0; j < nc; j++) data.push(new ImageData(iw, ih));
    const q = v => 255 - Math.round(255 * (v < 0 ? 0 : v > 1 ? 1 : v));
    for (let i = 0; i < px.length; i += 4) {
      const a = mp ? mp[i] : px[i + 3];
      if (a === 0) continue;   // fully transparent: leave the layers untouched there
      D.fill(0); sep(px[i], px[i + 1], px[i + 2], D);
      for (let j = 0; j < nc; j++) { const d = data[j].data; d[i] = q(D[3 * j]); d[i + 1] = q(D[3 * j + 1]); d[i + 2] = q(D[3 * j + 2]); d[i + 3] = a; }
    }
    outs = data.map(d => { const c = document.createElement('canvas'); c.width = iw; c.height = ih; c.getContext('2d').putImageData(d, 0, 0); return c; });
    if (key) { IMG_CACHE.set(key, outs); if (IMG_CACHE.size > 6) IMG_CACHE.delete(IMG_CACHE.keys().next().value); }
  }
  const al = clamp(o.alpha ?? 1); if (al <= 0) return;
  for (const j of usedCanvases()) {
    const c = LAYERS[j]; c.setTransform(...MX); c.globalCompositeOperation = o.over ? 'darken' : 'source-over'; c.globalAlpha = al;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(outs[j], x, y, w, h);
  }
}

// ---------- type (printed into the ink layers, so it registers, halftones and overprints like everything else) ----------
// type(txt, x, y, size, colour, { font, rot, pop, alpha, over, align, spacing, tone, stroke })
// Default face: Archivo Black (chunky display type). Use sparingly: see "Type" in ANIMATION_GUIDE.md.
const TYPE_FONT = '"Archivo Black", "Arial Black", Impact, sans-serif';
function type(txt, x, y, size, col = PAL.ink, o = {}) {
  const k = o.pop != null ? backOut(o.pop) : 1; if (k <= .01) return;
  push(); translate(x, y); rotate(o.rot || 0); scale(k);
  inkDo(tone(col, o.tone ?? 1), (c, s) => {
    c.font = o.font || `${size}px ${TYPE_FONT}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    if ('letterSpacing' in c) c.letterSpacing = (o.spacing ?? 0) * size + 'px';
    if (o.stroke) { c.strokeStyle = s; c.lineWidth = o.stroke; c.lineJoin = 'round'; c.strokeText(txt, 0, 0); } else { c.fillStyle = s; c.fillText(txt, 0, 0); }
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }, { over: !!o.over, alpha: o.alpha ?? 1 });
  pop();
}
// legacy names
function letter(txt, x, y, size, color, o = {}) { type(txt, x, y, size, color, o); }
function sfx(txt, x, y, size, color, age, o = {}) {
  const life = o.life ?? 1.2; if (age < 0 || age > life) return;
  type(txt, x, y, size, color, { pop: age * 5, rot: (o.rot ?? -.08) + Math.sin(age * 20) * .03 * (1 - age / life), alpha: 1 - seg(age, life - .25, life), ...o });
}
function flushLetters() {}   // type is printed immediately; kept so older scenes run

// ---------- registration ----------
// Per ink: [dx, dy, rotation in radians]. Fixed by the seed (the print run), plus a very slow drift over time.
// Pure function of t, and slow enough that consecutive frames differ by a fraction of a pixel: no jitter.
function registration(i, t) {
  const s = RISO.seed * 7.31 + i * 3.17, h = k => hash(s * 13 + k) * 2 - 1, sh = RISO.shift[RISO.inks[i]] || [0, 0];
  // the shader samples the layer at p + offset, so a layer SHOWN shifted by (dx, dy) needs offset (-dx, -dy)
  if (i === 0 && RISO.inks.length > 1) return [-sh[0], -sh[1], 0];   // the first ink is the key: the others drift around it
  const ph = hash(s + 9) * TAU, w = TAU * onTwos(t) / RISO.driftPeriod;   // steps with the drawings: held frames match exactly
  return [RISO.misreg * h(1) + RISO.drift * Math.sin(w + ph) - sh[0], RISO.misreg * h(2) + RISO.drift * Math.cos(w * .8 + ph * 1.3) - sh[1], RISO.skew * h(3) * Math.PI / 180];
}

// ---------- the dissolve cover (a big halftone that grows over the whole print, see dotDissolve) ----------
let COVER = null;   // { k, col, cx, cy, cell, ang, spread }

// ---------- WebGL compositor ----------
let GL = null, GLP = null, GLU = {}, GLT = [], glCanvas = null;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uL0, uL1;
uniform vec2 uRes; uniform int uN;
uniform vec3 uInk[6]; uniform float uOp[6]; uniform vec3 uReg[6]; uniform float uAng[6]; uniform float uMode[6];
uniform float uCell; uniform vec3 uPaper; uniform float uSeed; uniform float uTex;
uniform vec4 uCov; uniform vec2 uCovC; uniform vec3 uCovCol; uniform float uCovAng;
out vec4 fragColor;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return .5 * vn(p) + .3 * vn(p * 2.03 + 7.1) + .2 * vn(p * 4.1 + 13.7); }
mat2 R(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float density(int i, vec2 q) {
  // a few px past the edge repeat the edge (full bleed survives misregistration); further out is bare paper (shift)
  if (q.x < -12. || q.y < -12. || q.x > uRes.x + 12. || q.y > uRes.y + 12.) return 0.;
  vec2 uv = clamp(q / uRes, vec2(0.), vec2(1.));
  vec4 t = i < 3 ? texture(uL0, uv) : texture(uL1, uv);
  int c = i < 3 ? i : i - 3;
  return 1. - (c == 0 ? t.r : c == 1 ? t.g : t.b);
}
// amplitude-modulated round dot screen: round dots in the lights, a checkerboard at 50%, inverted dots in the darks
float screenDot(vec2 q, float ang, float cell, float d) {
  vec2 s = R(ang) * q / cell;
  float spot = .5 + .25 * (cos(6.2831853 * s.x) + cos(6.2831853 * s.y));
  float thr = 1. - d, w = 1.1 / cell;
  float cov = smoothstep(thr - w, thr + w, spot);
  cov = mix(cov, 1., smoothstep(.93, .985, d));
  return cov * smoothstep(.01, .045, d);
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y), C = uRes * .5;
  vec3 col = vec3(1.);
  float tooth = fbm(p * .55 + uSeed * 3.1);
  for (int i = 0; i < 6; i++) {
    if (i >= uN) break;
    float fi = float(i) * 31.7 + uSeed * 17.3;
    vec2 q = R(uReg[i].z) * (p - C) + C + uReg[i].xy;
    vec2 jq = q + (vec2(vn(p * .23 + fi), vn(p * .23 + fi + 50.)) - .5) * 1.5;   // soft, ragged edges
    float d = density(i, jq), cov;
    if (uMode[i] < .5) cov = screenDot(q, uAng[i], uCell, d);
    else { float n = .5 * h21(floor(q * .75) + fi) + .5 * vn(q * .42 + fi); n = .04 + .92 * n; cov = smoothstep(n - .07, n + .07, d) * smoothstep(.01, .04, d); cov = mix(cov, 1., smoothstep(.95, .99, d)); }
    // ink texture: uneven drum coverage, roller banding, clustered speckle and drop-outs, paper tooth
    float uneven = 1. - uTex * (.1 * smoothstep(.3, .85, fbm(p / 320. + fi)) + .08 * fbm(p / 45. + fi * 1.7));
    float band = 1. - uTex * .07 * vn(vec2(fi, p.y / 11.));
    float speck = step(.965, h21(floor(p / 1.7) + fi * 3.1)) * step(.5, vn(p / 60. + fi));
    float drop = step(.994, h21(floor(p / 2.6) + fi * 7.3));
    cov *= uneven * band * (1. - uTex * .92 * max(speck, drop));
    cov *= 1. - uTex * .38 * smoothstep(.45, .8, tooth);
    col *= mix(vec3(1.), uInk[i], clamp(cov * uOp[i], 0., 1.));
  }
  vec3 paper = uPaper * (1. - .05 * fbm(p / 2.2 + uSeed) * fbm(p / 40.) - .025 * fbm(p / 160. + 3.));
  vec3 outc = paper * col;
  if (uCov.x > 0.) {   // the dissolve: a coarse halftone of one colour growing over (knocking out) the whole print
    float dd = uCov.x * (1. + uCov.w) - uCov.w * length(p - uCovC) / length(uRes);
    float cov = screenDot(p - uCovC, uCovAng, uCov.y, clamp(dd, 0., 1.));
    float uneven = 1. - uTex * (.08 * smoothstep(.3, .9, fbm(p / 320. + 91.)) + .07 * fbm(p / 45. + 37.));
    vec3 cc = paper * mix(vec3(1.), uCovCol, uneven);
    outc = mix(outc, cc, cov);
  }
  fragColor = vec4(outc, 1.);
}`;
function glInit() {
  glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
  const gl = GL = glCanvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2 is required for the riso compositor');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  GLP = gl.createProgram();
  gl.attachShader(GLP, sh(gl.VERTEX_SHADER, `#version 300 es\nin vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`));
  gl.attachShader(GLP, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(GLP); if (!gl.getProgramParameter(GLP, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(GLP));
  gl.useProgram(GLP);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(GLP, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['uL0', 'uL1', 'uRes', 'uN', 'uInk', 'uOp', 'uReg', 'uAng', 'uMode', 'uCell', 'uPaper', 'uSeed', 'uTex', 'uCov', 'uCovC', 'uCovCol', 'uCovAng']) GLU[n] = gl.getUniformLocation(GLP, n);
  GLT = [0, 1].map(i => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; });
  gl.uniform1i(GLU.uL0, 0); gl.uniform1i(GLU.uL1, 1);
  gl.viewport(0, 0, W, H);
}
// Print the ink layers onto the paper (into glCanvas).
function risoPrint(t) {
  const gl = GL, inks = RISO.inks.slice(0, 6), n = inks.length;
  for (const j of usedCanvases()) { gl.activeTexture(gl.TEXTURE0 + j); gl.bindTexture(gl.TEXTURE_2D, GLT[j]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, LAYERS[j].canvas); }
  const ink = [], op = [], reg = [], ang = [], mode = [];
  for (let i = 0; i < 6; i++) {
    const k = inks[i], I = INKS[k] || INKS.black;
    ink.push(...(k ? inkRGB(k) : [1, 1, 1])); op.push(I.op); reg.push(...(k ? registration(i, t) : [0, 0, 0]));
    ang.push(((RISO.angles[k] ?? I.angle) * Math.PI) / 180); mode.push(RISO.screens[k] === 'grain' ? 1 : 0);
  }
  gl.uniform2f(GLU.uRes, W, H); gl.uniform1i(GLU.uN, n);
  gl.uniform3fv(GLU.uInk, ink); gl.uniform1fv(GLU.uOp, op); gl.uniform3fv(GLU.uReg, reg); gl.uniform1fv(GLU.uAng, ang); gl.uniform1fv(GLU.uMode, mode);
  gl.uniform1f(GLU.uCell, RISO.cell); gl.uniform3fv(GLU.uPaper, hexRGB(RISO.paper)); gl.uniform1f(GLU.uSeed, (RISO.seed * 0.137) % 97); gl.uniform1f(GLU.uTex, RISO.texture);
  const cv = COVER && COVER.k > 0 ? COVER : null;
  gl.uniform4f(GLU.uCov, cv ? cv.k : 0, cv ? cv.cell || 42 : 42, 0, cv ? cv.spread ?? .8 : 0);
  gl.uniform2f(GLU.uCovC, cv ? cv.cx ?? W / 2 : 0, cv ? cv.cy ?? H / 2 : 0);
  gl.uniform3fv(GLU.uCovCol, cv ? printRGB(dens(cv.col) || [1]) : [1, 1, 1]); gl.uniform1f(GLU.uCovAng, cv ? (cv.ang ?? 45) * Math.PI / 180 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return glCanvas;
}
