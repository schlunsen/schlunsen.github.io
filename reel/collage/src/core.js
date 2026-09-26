// core.js: constants, palette, timing and motion helpers, camera, geometry, full-frame effects and the render hooks.
// The medium itself (cut paper, brush lines, lettering, photos) lives in collage.js. Length and rhythm come from PROJECT
// in config.js.
const W = 1920, H = 1080;
// BOIL: redraws per second of the jittered geometry (jit/random). 0 = off (the default): every shape keeps one
// stable, hand-cut form for the whole shot. Cut paper doesn't boil: no re-drawn linework, no flicker.
const BPM = PROJECT.bpm, BEAT = 60 / BPM, OFF = PROJECT.offset || 0, BOIL = PROJECT.boil || 0, DUR = PROJECT.duration;
const TAU = Math.PI * 2;
// Palette: Miró's primaries, as sheets of coloured paper, plus the grounds. Any '#RRGGBB' works anywhere a colour
// is taken. The old names (clay, ink, cream, pink, ...) are kept, mapped onto paper colours, so Clawd and older scenes port.
const PAL = {
  red: '#D52B1E', yellow: '#F6C400', blue: '#1B4FA0', green: '#2E8B57', black: '#141414', white: '#FBF8F0',
  ground: '#EEE4CF', oatmeal: '#EEE4CF', night: '#15265E', sky: '#7FA7D6', orange: '#E8742A', pink: '#E77FA0',
  brown: '#7A4A2A', grey: '#9A958C', purple: '#6B3F8E', navy: '#15265E',
  // legacy names
  paper: '#EEE4CF', cream: '#FBF8F0', ink: '#141414', clay: '#D9772F', clayDk: '#A8501E', clayLt: '#EBA36B',
  indigo: '#2B3A7A', rose: '#E77FA0', ochre: '#D9A21E', sap: '#5E9A3A', teal: '#1F8A8A', violet: '#7E5AA8'
};

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const backOut = x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const bpOf = t => (t - OFF) / BEAT;
// Seeded per element by boilSeed(), so jittered geometry is stable (or re-drawn BOIL times a second if you turn boil on).
const jit = a => (random() * 2 - 1) * a;
// Each boil drawing holds for several frames, so whatever isn't moving must draw the same until the next one. But a moving
// thing uses a different amount of randomness each frame, which shifts the stream for everything drawn after it and makes
// that re-boil every frame (jitter). boilSeed(key) restarts the stream from the boil frame and a key (any string or
// number) that's the same every frame: call it before each separate element. clawd() does this for itself and its parts.
let BOILN = 0, CLAWD_N = 0;
const boilSeed = key => { let h = 2166136261; for (const c of key + '|' + BOILN) h = Math.imul(h ^ c.charCodeAt(0), 16777619); randomSeed(h >>> 0); };

// ---------- timing helpers (everything is a pure function of t; no state survives between frames) ----------
const seg = (t, a, b) => clamp((t - a) / (b - a));                 // 0..1 progress of t through [a, b]
const frac = x => x - Math.floor(x);
const beatN = t => Math.floor(bpOf(t));                            // integer beat index
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);          // 1 exactly on each beat, decays after
const pulse2 = (t, k = 6) => Math.exp(-frac(bpOf(t) * 2) * k);     // same on eighth notes
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
const easeIn = x => Math.pow(clamp(x), 3);
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
// keyframes: kf(t, [[t0, v0], [t1, v1], ...], easeFn). Values may be numbers or arrays of numbers.
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
// Mix two colours (any palette names or hex) in RGB.
function mixCol(a, b, k) {
  const A = hexRGB(colHex(a) || PAL.white), B = hexRGB(colHex(b) || PAL.white);
  return rgbHex(A.map((v, i) => lerp(v, B[i], clamp(k))));
}
// small deterministic camera shake, changes at 24 fps
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

// ---------- motion principles, as pure functions of t ----------
// Damped spring kicked at t0: 0 before, then a wobble that dies away. Use it for secondary motion and settles: a body
// after landing, a hat that jiggles, a stack that sways, a tail that drags. k = damping, w = wobble speed (rad/s).
const spring = (t, t0, k = 6, w = 18) => t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(w * (t - t0));
const ring = (t, evs, k = 6, w = 18) => evs.reduce((s, e) => s + spring(t, e, k, w), 0);    // one kick per event time
// Hold each drawing for two frames, stop-motion "on twos". Wrap a shot's t in it for cut-paper motion. Only the
// POSITIONS step: every piece's edge and grain are fixed, so nothing flickers.
// Follows the frame rate: 12 drawings a second at 24 fps, 15 at 30 fps, so every drawing holds exactly two frames.
const DRAWINGS = (PROJECT.fps || 24) / 2;
const onTwos = t => Math.floor(t * DRAWINGS + 1e-6) / DRAWINGS;
// nudge(key, t, amt): the tiny, deliberate stop-motion nudge of a hand-moved piece: a new offset (≤ amt px) per drawing,
// the same for both frames of a drawing. Use it on pieces that are MOVING, never on held ones (that would be flicker).
const nudge = (key, t, amt = .8) => { const n = Math.floor(t * DRAWINGS + 1e-6), s = seedOf(key); return [(h2(n, s) - .5) * 2 * amt, (h2(n, s + 1) - .5) * 2 * amt]; };
// Point on a thrown or jumping arc from p0 to p1, peaking h px above the straight line; k = 0..1 along the flight.
const arcPt = (p0, p1, h, k) => [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k) - h * 4 * k * (1 - k)];
// A hop that takes off at t0 and lands at t1, h body units high: crouch (anticipation), stretch on takeoff,
// round at the top, squash on landing and spring back. Returns { dy, sq } to spread into clawd().
function jump(t, t0, t1, h = 3) {
  if (t < t0 - .12) return { dy: 0, sq: 0 };
  if (t < t0) return { dy: 0, sq: .18 * ease(seg(t, t0 - .12, t0)) };
  if (t < t1) { const k = (t - t0) / (t1 - t0); return { dy: -h * 4 * k * (1 - k), sq: -.16 * Math.abs(1 - 2 * k) }; }
  const a = t - t1; return { dy: 0, sq: .22 * Math.exp(-8 * a) * Math.cos(20 * a) };
}
// A surprise "take" peaking at t0: a quick squash, then a big stretch up that springs back. amt scales it.
function take(t, t0, amt = 1) {
  if (t < t0 - .1) return { sq: 0, dy: 0 };
  if (t < t0) return { sq: .12 * amt * ease(seg(t, t0 - .1, t0)), dy: 0 };
  const a = t - t0; return { sq: -.26 * amt * Math.exp(-6 * a) * Math.cos(16 * a), dy: -1.2 * amt * Math.exp(-7 * a) * Math.max(0, Math.cos(9 * a)) };
}
// Walk from x0 to x1 (px) between t0 and t1, for a character of unit u: eases in and out, faces the way it's
// going in 3/4 view, and faces front when it stops. Returns { x, walk, view, flip, dy } for clawd().
function stroll(t, t0, t1, x0, x1, u) {
  const x = lerp(x0, x1, ease(seg(t, t0, t1))), d = Math.abs(x - x0) / (4 * u), moving = t > t0 && t < t1;
  return { x, walk: d, view: moving ? 'q' : 'front', flip: x1 < x0, dy: moving ? -Math.abs(Math.sin(d * Math.PI)) * .5 : 0 };
}

// ---------- camera ----------
// camBegin(cx, cy, zoom, rot): world point (cx, cy) lands at screen centre. Letters queued while a camera is
// active are placed through it automatically (pass {screen:true} to opt out). One level only: always pair with camEnd().
// LAST_CAM stays set after camEnd(), until the next frame: renderSheet's crops that follow a world point use it.
let CAM = null, LAST_CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) { push(); translate(W / 2, H / 2); rotate(rot); scale(zoom); translate(-cx, -cy); CAM = LAST_CAM = { cx, cy, zoom, rot }; }
function camEnd() { pop(); CAM = null; }
function toScreen(x, y, cam = CAM) {
  if (!cam) return [x, y];
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot), dx = (x - cam.cx) * cam.zoom, dy = (y - cam.cy) * cam.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}


// ---------- full-frame effects (call outside a camera, in screen space) ----------
// flash(k, colour): cover the frame with a sheet of a colour (default: the ground) at opacity k.
function flash(k, col = 'ground') { if (k > .01) cut(rectPts(-60, -60, W + 120, H + 120), col, { alpha: clamp(k), lift: 0 }); }
// Cover everything OUTSIDE a star-shaped hole (irises, mouth-shaped reveals, keyholes).
function irisShape(pts, col = PAL.ink, far = 4000) {
  const n = pts.length; let cx = 0, cy = 0; for (const p of pts) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
  const out = p => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [cx + dx / d * far, cy + dy / d * far]; };
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], ex = (b[0] - a[0]) * .06, ey = (b[1] - a[1]) * .06;
    const a2 = [a[0] - ex, a[1] - ey], b2 = [b[0] + ex, b[1] + ey];
    paint([a2, b2, out(b2), out(a2)], { fill: col });
  }
}
function iris(cx, cy, r, col = PAL.ink) { if (r < 4) paint(rectPts(-60, -60, W + 120, H + 120), { fill: col }); else irisShape(ellPts(cx, cy, r, r, 48), col); }

let T = 0, outC = null;

// ---------- geometry ----------
function rectPts(x, y, w, h, j = 0) {
  return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .5], [x + w + jit(j), y + jit(j)],
          [x + w + jit(j) * .5, y + h / 2], [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .5],
          [x + jit(j), y + h + jit(j)], [x + jit(j) * .5, y + h / 2]];
}
function ellPts(cx, cy, rx, ry, n = 28, j = 0, rot = 0) {
  const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p;
}
function rrPts(x, y, w, h, r, j = 0) {
  const p = [], seg = 5, corner = (cx, cy, a0) => { for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return p;
}
function starPts(cx, cy, r, inner = .38, n = 4, rot = -Math.PI / 2) {
  const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p;
}
// Smooth curve through the points (Catmull-Rom), n samples per span.
function through(P, n = 6) {
  if (P.length < 3) return P.slice();
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const u = k / n, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => .5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
// Tapered ribbon around a path (w0 wide at the start, w1 at the end), as one closed outline for cut().
// Tails, tentacles, noodly arms, painted glyphs: one shape with one outline, so nothing looks glued on.
function ribbon(P, w0, w1 = w0) {
  const C = through(P), n = C.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, w = lerp(w0, w1, i / Math.max(1, n - 1)) / 2;
    L.push([C[i][0] - dy / d * w, C[i][1] + dx / d * w]); R.push([C[i][0] + dy / d * w, C[i][1] - dx / d * w]);
  }
  return L.concat(R.reverse());
}


// ---------- frame ----------
async function setup() {
  outC = document.getElementById('out'); collageInit(outC);
  // the lettering faces (bundled in assets/fonts); if they can't load, type falls back to Impact / Arial Black
  try { await Promise.race([Promise.all([document.fonts.load('100px "Luckiest Guy"'), document.fonts.load('800 100px "Rubik"')]), new Promise(r => setTimeout(r, 6000))]); } catch (e) {}
  // assets a scene loads (images, video frames): set window.PRELOAD to a promise and rendering waits for it
  if (window.PRELOAD) await window.PRELOAD;
  window.ready = true;
  if (!location.search.includes('render')) devUI();
}
window.addEventListener('load', setup);
function draw() {
  CAM = LAST_CAM = null; resetMatrix(); MXS.length = 0;
  COL = { ...COLLAGE_DEFAULTS, ...(PROJECT.collage || {}) };
  collageClear();
  BOILN = BOIL ? Math.floor(T * BOIL) : 0; CLAWD_N = 0; boilSeed('frame');
  drawWorld(T);
}
window.renderAt = async (t, type = 'image/png', q = .92) => { T = t; draw(); return outC.toDataURL(type, q); };
// Contact sheet of several times, for visual checks: returns { url, ms[] }. crop = [x, y, w, h] fills each cell with just
// that region of the frame, at full resolution (for checking edges, grain, shadows, faces). at = [x, y, w, h]
// instead crops w × h around the WORLD point (x, y), wherever each frame's camera put it; x and y may be expressions
// evaluated in the page.
window.renderSheet = async (times, cols = 3, w = 640, crop = null, at = null) => {
  if (at) at = at.map((v) => typeof v === 'string' ? (0, eval)(v) : v);
  const [, , cw, ch] = at || crop || [0, 0, W, H], h = Math.round(w * ch / cw), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); T = times[i]; draw(); CTX.getImageData(0, 0, 1, 1); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    const [cx, cy] = at ? toScreen(at[0], at[1], LAST_CAM).map((v, j) => v - (j ? ch : cw) / 2) : crop || [0, 0];
    c.drawImage(outC, cx, cy, cw, ch, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 84, 24); c.fillStyle = '#fff'; c.font = '15px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 17);
  }
  return { url: sc.toDataURL('image/jpeg', .9), ms };
};
window.gpuInfo = () => { const gl = document.createElement('canvas').getContext('webgl'); if (!gl) return 'no WebGL (canvas 2D only)'; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };

function devUI() {
  const s = document.getElementById('scrub'), lab = document.getElementById('tt'); s.max = window.LOOP ? window.LOOP.len : DUR;
  let busy = false, want = null;
  const go = async () => { if (busy) return; busy = true; while (want != null) { const t = want; want = null; const t0 = performance.now(); await window.renderAt(t); lab.textContent = `${t.toFixed(2)}s  ·  ${Math.round(performance.now() - t0)} ms/frame`; } busy = false; };
  s.addEventListener('input', () => { want = +s.value; go(); });
  want = +(new URLSearchParams(location.search).get('t') || 0); s.value = want; go();
}
