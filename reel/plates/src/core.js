// core.js: the plates engine. Canvas2D, 1920×1080, every frame a pure function of t.
//
// Look (after mexicat/pdoom-video's style bible): ink ground, bone type and hairlines, ONE signal colour (hazard
// orange) that is the only thing allowed to glow, film grain, a soft vignette. Scenes draw into X (the plate) and,
// for anything emissive, also into GX (the glow layer, half res), which post() blurs and adds on top.
//
// Globals scenes use: W H TAU DUR BEAT, X GX, C (palette), F (fonts), POST (per-frame post overrides), and the
// helpers below. Nothing may carry over between frames: frames render out of order.
const W = 1920, H = 1080, TAU = Math.PI * 2;
const DUR = PROJECT.duration, FPS = PROJECT.fps, BEAT = 60 / PROJECT.bpm, OFF = PROJECT.offset || 0;

const C = {
  ink: '#0A0A0B', ink2: '#151517', ink3: '#1E1E21', graphite: '#5E5B57', ash: '#9C978F', bone: '#EEE9DF',
  signal: '#FF4D12', ember: '#FF8A3D', blood: '#C21D0B',
};
const rgba = (hex, a = 1) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

// ---------- fonts (static instances of Archivo's width/weight axes, Cormorant Garamond, IBM Plex Mono) ----------
const FONT_FILES = {
  'A620-900': 'Archivo-w620-900', 'A750-900': 'Archivo-w750-900', 'A1000-900': 'Archivo-w1000-900', 'A1250-900': 'Archivo-w1250-900',
  'A1000-500': 'Archivo-w1000-500', 'A875-300': 'Archivo-w875-300', 'AI1000-800': 'ArchivoItalic-w1000-800',
  'Serif': 'Cormorant-400', 'SerifI': 'CormorantItalic-400', 'SerifI6': 'CormorantItalic-600',
  'Mono': 'IBMPlexMono-Regular', 'MonoM': 'IBMPlexMono-Medium', 'MonoL': 'IBMPlexMono-Light',
};
const F = {
  wide: 'A1250-900', black: 'A1000-900', tight: 'A750-900', cond: 'A620-900', med: 'A1000-500', light: 'A875-300', ital: 'AI1000-800',
  serif: 'Serif', serifI: 'SerifI', serifI6: 'SerifI6', mono: 'Mono', monoM: 'MonoM', monoL: 'MonoL',
};
const font = (fam, px) => `${px}px "${fam}"`;

// ---------- maths and time ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const frac = x => x - Math.floor(x);
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const outCubic = x => 1 - Math.pow(1 - clamp(x), 3);
const outExpo = x => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const inOutCubic = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const inCubic = x => Math.pow(clamp(x), 3);
const backOut = (x, s = 1.7) => { x = clamp(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash2 = (a, b) => hash(a * 57.31 + b * 113.9);
// a spring kicked at t0: 0 before, then a dying wobble
const spring = (t, t0, k = 7, w = 22) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
// beats: the lo-fi track runs at 80 bpm (a beat every 0.75 s, a bar every 3 s)
const beatAt = t => (t - OFF) / BEAT;
const onBeat = n => OFF + n * BEAT;
const hit = (t, t0, k = 9) => t < t0 ? 0 : Math.exp(-k * (t - t0));      // a decaying pulse from t0
const beatHit = (t, k = 7) => Math.exp(-frac(beatAt(t)) * k);             // 1 on every beat, decays
// keyframes: kf(t, [[t0, v0], [t1, v1, ease?], ...]); values numbers or arrays
function kf(t, keys, e = inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
    const [a, va] = keys[i - 1], [b, vb, ee] = keys[i], k = (ee || e)((t - a) / (b - a));
    return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
  }
  return keys[keys.length - 1][1];
}
const frameIdx = t => Math.floor(t * FPS + 1e-4);

// ---------- canvases ----------
const out = document.getElementById('out'), OX = out.getContext('2d');
const plate = document.createElement('canvas'); plate.width = W; plate.height = H;
const X = plate.getContext('2d');
const glowC = document.createElement('canvas'); glowC.width = W / 2; glowC.height = H / 2;
const GX = glowC.getContext('2d');
const blurC = document.createElement('canvas'); blurC.width = W / 4; blurC.height = H / 4;
const BX = blurC.getContext('2d');
let POST;
const POST0 = () => ({ shake: [0, 0], zoom: 1, flash: 0, fade: 0, bloom: 1, grain: .07, vignette: .45, paper: 0 });

// run fn on both the plate and the glow layer with the same transform (the glow layer is half res)
function both(fn) { fn(X, false); glow(g => fn(g, true)); }
// draw only into the glow layer, in the plate's current coordinates
function glow(fn) { const m = X.getTransform(); GX.save(); GX.setTransform(m.a / 2, m.b / 2, m.c / 2, m.d / 2, m.e / 2, m.f / 2); GX.globalAlpha = X.globalAlpha; fn(GX); GX.restore(); }

// ---------- camera: world point (cx, cy) at the frame centre ----------
function cam(cx, cy, z = 1, rot = 0) { X.save(); X.translate(W / 2, H / 2); X.rotate(rot); X.scale(z, z); X.translate(-cx, -cy); }
const camEnd = () => X.restore();

// ---------- drawing primitives ----------
function fillAll(col) { X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.fillStyle = col; X.fillRect(0, 0, W, H); X.restore(); }
function line(ctx, pts, col, w = 1.2, a = 1) {
  if (pts.length < 2) return; ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.restore();
}
const hair = (pts, col = C.bone, w = 1.2, a = 1) => line(X, pts, col, w, a);
// polyline length helpers: partial(pts, k) = the first k (0..1) of the path by length, plus its head point
function lengths(P) { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; }
function partial(P, k, L = lengths(P)) {
  const tot = L[L.length - 1], d = clamp(k) * tot, R = [P[0]];
  for (let i = 1; i < P.length; i++) {
    if (L[i] >= d) { const u = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); R.push([lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u)]); return R; }
    R.push(P[i]);
  }
  return R;
}
const pointAt = (P, k, L) => { const p = partial(P, k, L); return p[p.length - 1]; };
function arcPts(cx, cy, rx, ry, a0, a1, n = 64, rot = 0) {
  const P = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n), x = Math.cos(a) * rx, y = Math.sin(a) * ry; P.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return P;
}
const rectP = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
function catmull(P, n = 8) {
  if (P.length < 3) return P.slice(); const o = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const u = k / n, u2 = u * u, u3 = u2 * u; o.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3))); }
  }
  o.push(P[P.length - 1]); return o;
}

// Engraving: parallel hatch lines inside a clip path, width w (a number or a function of x,y giving 0..1 darkness)
function hatch(path, { angle = -.6, gap = 7, w = 1.1, col = C.bone, a = 1, box = [0, 0, W, H] } = {}) {
  X.save(); X.clip(path); X.strokeStyle = col; X.globalAlpha *= a; X.lineWidth = w; X.lineCap = 'butt';
  const [bx, by, bw, bh] = box, cx = bx + bw / 2, cy = by + bh / 2, R = Math.hypot(bw, bh) / 2 + gap;
  const c = Math.cos(angle), s = Math.sin(angle);
  X.beginPath();
  for (let d = -R; d <= R; d += gap) { X.moveTo(cx - c * R - s * d, cy - s * R + c * d); X.lineTo(cx + c * R - s * d, cy + s * R + c * d); }
  X.stroke(); X.restore();
}

// ---------- type ----------
// txt(): one run of type. o: { fam, size, col, align, base, track (px), a, glow (0..1: add to the glow layer) }
function txt(s, x, y, o = {}) {
  const ctx = o.ctx || X;
  ctx.save(); ctx.font = font(o.fam || F.black, o.size || 40); ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
  ctx.letterSpacing = (o.track || 0) + 'px'; ctx.fillStyle = o.col || C.bone; ctx.globalAlpha *= (o.a ?? 1);
  ctx.fillText(s, x, y); ctx.restore();
  if (o.glow && !o.ctx) glow(g => { g.font = font(o.fam || F.black, o.size || 40); g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic'; g.letterSpacing = (o.track || 0) + 'px'; g.fillStyle = o.col || C.signal; g.globalAlpha *= o.glow * (o.a ?? 1); g.fillText(s, x, y); });
}
function tw(s, fam, size, track = 0) { X.save(); X.font = font(fam, size); X.letterSpacing = track + 'px'; const w = X.measureText(s).width; X.restore(); return w; }

// Karaoke headline, the pdoom way: the line is shown dim ~0.4 s before its first word; each word lights at its time
// (a small upward snap), the accent word in signal. words: [[text, t0, accent?], ...]; they flow left to right.
// Returns the x after the last word.
function sung(words, x, y, t, o = {}) {
  const fam = o.fam || F.black, size = o.size || 96, sp = o.space ?? size * .26, track = o.track ?? -size * .02;
  const first = words[0][1], pre = seg(t, first - (o.lead ?? .4), first);
  if (pre <= 0) return x;
  let cx = x;
  for (const [w, t0, acc] of words) {
    const k = seg(t, t0, t0 + .16), snap = (1 - outCubic(k)) * size * .08 * (t >= t0 ? 1 : 0);
    const col = t < t0 ? C.bone : acc ? C.signal : C.bone, a = t < t0 ? .16 * pre : 1;
    const dy = t < t0 ? 0 : snap;
    txt(w, cx, y + dy, { fam, size, col, a, track, glow: acc && t >= t0 ? .9 : 0 });
    cx += tw(w, fam, size, track) + sp;
  }
  return cx - sp;
}
// Mono typed text: chars appear from t0 at cps chars/s, with a block caret while typing (and blinking after, if caret)
function typed(s, x, y, t, t0, o = {}) {
  if (t < t0) return 0;
  const cps = o.cps ?? 28, n = Math.min(s.length, Math.floor((t - t0) * cps)), size = o.size || 22, fam = o.fam || F.mono;
  const shown = s.slice(0, n);
  txt(shown, x, y, { fam, size, col: o.col || C.bone, a: o.a ?? 1, align: o.align, track: o.track || 0 });
  const done = n >= s.length, blink = frac((t - t0) * 1.6) < .5;
  if (o.caret !== false && (!done || (o.caret && blink))) {
    const cw = tw(shown, fam, size, o.track || 0);
    X.fillStyle = o.caretCol || C.signal; X.fillRect(x + cw + 3, y - size * .8, size * .55, size * .95);
  }
  return n / s.length;
}
// a tiny deadpan footnote: superscript mark + mono text
function footnote(s, x, y, t, t0, o = {}) {
  if (t < t0) return;
  const k = seg(t, t0, t0 + .3);
  txt(s, x, y, { fam: F.monoL, size: o.size || 17, col: o.col || C.ash, a: k * (o.a ?? 1), align: o.align, track: .3 });
}

// ---------- the spark: one orange point with a hot core, a tail and a few sputtering sparks ----------
// head(t) gives the head position at time t (so the particles are a pure function of time).
function spark(x, y, t, o = {}) {
  const s = o.scale || 1, I = o.intensity ?? 1;
  if (I <= 0) return;
  const flick = .85 + .15 * hash(frameIdx(t) * 3.1 + (o.seed || 0));
  // particles, born on a fixed clock so each one is the same across frames
  if (o.head && (o.rate ?? 34) > 0) {
    const rate = o.rate ?? 34, life = o.life ?? .55, n0 = Math.floor((t - life) * rate), n1 = Math.floor(t * rate);
    for (let i = n0; i <= n1; i++) {
      const tb = i / rate, age = t - tb; if (age < 0 || age > life || tb < (o.from ?? -1e9)) continue;
      const [hx, hy] = o.head(tb), a = hash(i * 1.37 + (o.seed || 0)) * TAU, v = (60 + 220 * hash(i * 2.11)) * s;
      const px = hx + Math.cos(a) * v * age, py = hy + Math.sin(a) * v * age + 380 * s * age * age;
      const k = 1 - age / life, len = 5 * s * k + 1;
      const dx = Math.cos(a) * len, dy = Math.sin(a) * len + 380 * s * age * .02;
      line(X, [[px - dx, py - dy], [px, py]], C.ember, 1.6 * s, k * I);
      glow(g => line(g, [[px - dx, py - dy], [px, py]], C.signal, 3 * s, k * I));
    }
  }
  const r = 7 * s * flick;
  X.save(); const g0 = X.createRadialGradient(x, y, 0, x, y, r * 4);
  g0.addColorStop(0, rgba('#FFF4E6', I)); g0.addColorStop(.18, rgba(C.ember, .95 * I)); g0.addColorStop(.45, rgba(C.signal, .35 * I)); g0.addColorStop(1, rgba(C.signal, 0));
  X.fillStyle = g0; X.beginPath(); X.arc(x, y, r * 4, 0, TAU); X.fill(); X.restore();
  glow(g => { const gr = g.createRadialGradient(x, y, 0, x, y, r * 9); gr.addColorStop(0, rgba(C.ember, I)); gr.addColorStop(.3, rgba(C.signal, .7 * I)); gr.addColorStop(1, rgba(C.signal, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 9, 0, TAU); g.fill(); });
}
// the line the spark drags behind it: a hairline in signal that glows near the head and cools to blood
function fuse(pts, o = {}) {
  if (pts.length < 2) return;
  const w = o.w ?? 2.2, L = lengths(pts), tot = L[L.length - 1], hot = o.hot ?? 220;
  line(X, pts, o.cold || C.signal, w, o.a ?? 1);
  // the hot end
  const i0 = L.findIndex(v => v >= tot - hot), tail = pts.slice(Math.max(0, i0 - 1));
  line(X, tail, C.ember, w * 1.2, o.a ?? 1);
  glow(g => { line(g, pts, C.signal, w * 2, .35 * (o.a ?? 1)); line(g, tail, C.ember, w * 3, o.a ?? 1); });
}

// ---------- the bookends' crop-mark frame (k = 1 in place, 0 flown out past the edges) ----------
function cropMarks(k, col = C.bone) {
  if (k <= 0) return;
  const m = lerp(-160, 64, outExpo(k)), L = 46, g = 16;
  X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.strokeStyle = col; X.lineWidth = 1.3; X.globalAlpha = clamp(k * 3);
  X.beginPath();
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx > 0 ? m : W - m, y = sy > 0 ? m : H - m;
    X.moveTo(x - sx * g, y); X.lineTo(x - sx * (g + L), y); X.moveTo(x, y - sy * g); X.lineTo(x, y - sy * (g + L));
  }
  // registration targets top and bottom centre
  for (const y of [m - 24, H - m + 24]) { X.moveTo(W / 2 - 22, y); X.lineTo(W / 2 + 22, y); X.moveTo(W / 2, y - 22); X.lineTo(W / 2, y + 22); X.moveTo(W / 2 + 12, y); X.arc(W / 2, y, 12, 0, TAU); }
  X.stroke(); X.restore();
}

// ---------- post: bloom from the glow layer, flash, vignette, grain ----------
let VIG = null, GRAIN = [];
function buildPost() {
  VIG = document.createElement('canvas'); VIG.width = W; VIG.height = H;
  const v = VIG.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .98);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); v.fillStyle = g; v.fillRect(0, 0, W, H);
  // grain: 6 full-frame noise plates (two scales mixed), picked per frame
  for (let n = 0; n < 6; n++) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), id = x.createImageData(W, H), d = id.data;
    let s = 1234567 + n * 7919; const rnd = () => ((s = Math.imul(s ^ s >>> 15, 1 | s) + 0x6D2B79F5 | 0, ((s ^ s >>> 14) >>> 0) / 4294967296));
    const coarse = new Float32Array((W / 2) * (H / 2)); for (let i = 0; i < coarse.length; i++) coarse[i] = rnd();
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = (y * W + xx) * 4, v2 = .6 * rnd() + .4 * coarse[(y >> 1) * (W / 2) + (xx >> 1)];
      const val = Math.round(clamp(v2) * 255); d[i] = d[i + 1] = d[i + 2] = val; d[i + 3] = 255;
    }
    x.putImageData(id, 0, 0); GRAIN.push(c);
  }
}
function post(t) {
  const p = POST;
  OX.save(); OX.setTransform(1, 0, 0, 1, 0, 0); OX.fillStyle = C.ink; OX.fillRect(0, 0, W, H);
  OX.translate(W / 2 + p.shake[0], H / 2 + p.shake[1]); OX.scale(p.zoom, p.zoom); OX.translate(-W / 2, -H / 2);
  OX.drawImage(plate, 0, 0);
  // bloom: the glow layer, blurred at two radii, added
  if (p.bloom > 0) {
    OX.globalCompositeOperation = 'lighter';
    OX.globalAlpha = .55 * p.bloom; OX.filter = 'blur(6px)'; OX.drawImage(glowC, 0, 0, W, H);
    BX.clearRect(0, 0, W / 4, H / 4); BX.drawImage(glowC, 0, 0, W / 4, H / 4);
    OX.globalAlpha = .9 * p.bloom; OX.filter = 'blur(26px)'; OX.drawImage(blurC, 0, 0, W, H);
    OX.globalAlpha = .45 * p.bloom; OX.filter = 'blur(70px)'; OX.drawImage(blurC, 0, 0, W, H);
    OX.filter = 'none'; OX.globalAlpha = 1; OX.globalCompositeOperation = 'source-over';
  }
  OX.restore();
  OX.save();
  if (p.flash > 0) { OX.globalAlpha = clamp(p.flash); OX.fillStyle = C.bone; OX.fillRect(0, 0, W, H); OX.globalAlpha = 1; }
  if (p.vignette > 0) { OX.globalAlpha = p.vignette * (p.paper ? .5 : 1); OX.drawImage(VIG, 0, 0); OX.globalAlpha = 1; }
  if (p.grain > 0) { OX.globalCompositeOperation = 'overlay'; OX.globalAlpha = p.grain * (p.paper ? 1.3 : 1) * 2.2; OX.drawImage(GRAIN[frameIdx(t) % GRAIN.length], 0, 0); OX.globalCompositeOperation = 'source-over'; OX.globalAlpha = 1; }
  if (p.fade > 0) { OX.globalAlpha = clamp(p.fade); OX.fillStyle = C.ink; OX.fillRect(0, 0, W, H); }
  OX.restore();
}

// ---------- timeline plumbing ----------
const SHOTS = [], LOOPS = {};
function shots(list) { SHOTS.push(...list); SHOTS.sort((a, b) => a[0] - b[0]); }
function draw(t) {
  POST = POST0();
  X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.filter = 'none';
  X.fillStyle = C.ink; X.fillRect(0, 0, W, H);
  GX.setTransform(1, 0, 0, 1, 0, 0); GX.clearRect(0, 0, W / 2, H / 2);
  if (window.LOOP) window.LOOP(t);
  else {
    let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
    const t0 = SHOTS[i][0], end = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : DUR;
    X.save(); SHOTS[i][1](t, t - t0, end - t0); X.restore();
  }
  post(t);
}

async function setup() {
  const faces = Object.entries(FONT_FILES).map(([fam, file]) => new FontFace(fam, `url(assets/fonts/${file}.ttf)`).load().then(f => document.fonts.add(f)).catch(e => console.error('font ' + file, e)));
  await Promise.all(faces);
  buildPost();
  if (window.PRELOAD) await window.PRELOAD;
  window.ready = true;
  if (!location.search.includes('render')) devUI();
}
window.addEventListener('load', setup);
window.renderAt = async (t, type = 'image/png', q = .92) => { draw(t); return out.toDataURL(type, q); };
window.renderSheet = async (times, cols = 3, w = 640, crop = null) => {
  const [, , cw, ch] = crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); draw(times[i]); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h, [cx, cy] = crop || [0, 0];
    c.drawImage(out, cx, cy, cw, ch, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 17);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => 'canvas2d';
function devUI() {
  const s = document.getElementById('scrub'), lab = document.getElementById('tt'); s.max = window.LOOP ? window.LOOP.len : DUR;
  const go = t => { const t0 = performance.now(); draw(t); lab.textContent = `${t.toFixed(2)}s · ${Math.round(performance.now() - t0)} ms/frame`; };
  s.addEventListener('input', () => go(+s.value));
  let playing = false, start = 0, base = 0;
  document.addEventListener('keydown', e => { if (e.code === 'Space') { playing = !playing; start = performance.now(); base = +s.value; e.preventDefault(); } });
  const tick = () => { if (playing) { const t = (base + (performance.now() - start) / 1000) % DUR; s.value = t; go(t); } requestAnimationFrame(tick); }; tick();
  const t = +(new URLSearchParams(location.search).get('t') || 0); s.value = t; go(t);
}
