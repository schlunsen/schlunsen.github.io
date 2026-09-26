/**
 * Painted hills: a tiny watercolour + ink painter for the hero.
 *
 * - Watercolour washes (ridges, sun, sky) are baked once into an offscreen canvas.
 * - Ink linework keeps the same hand-drawn wobble every frame (no boil, no flicker);
 *   only the birds, a slow star twinkle and the odd shooting star move.
 */

const PAL = {
  paper: '#F3EBDC', ink: '#2B2233', clay: '#D97757', ochre: '#E8AA38', violet: '#7B5CA8',
  indigo: '#2F3C7A', teal: '#3A9C98', sky: '#8EC3E6', night: '#1F2550', rose: '#E27A92',
};

const FPS = 30;
const VARIANTS = 1;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function mix(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function noise1(seed: number) {
  const r = mulberry32(seed);
  const v = Array.from({ length: 256 }, () => r());
  return (x: number) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return v[i & 255] + (v[(i + 1) & 255] - v[i & 255]) * u;
  };
}
/** Ridged fbm: peaky, mountain-ish profile in 0..1. */
function ridgeFn(seed: number) {
  const n = [0, 1, 2, 3].map((o) => noise1(seed * 13 + o));
  return (x: number) => {
    let s = 0, a = 0.55, f = 1, m = 0;
    for (let o = 0; o < 4; o++) {
      const v = n[o](x * f);
      s += Math.pow(1 - Math.abs(2 * v - 1), 1.6) * a;
      m += a; a *= 0.5; f *= 2.1;
    }
    return s / m;
  };
}

interface Ridge { base: number; amp: number; freq: number; color: string; seed: number; hatch: number; }
const RIDGES: Ridge[] = [
  { base: 0.76, amp: 0.2, freq: 2.2, color: mix(PAL.violet, PAL.paper, 0.58), seed: 3, hatch: 0 },
  { base: 0.83, amp: 0.15, freq: 3.1, color: mix(PAL.indigo, PAL.paper, 0.5), seed: 7, hatch: 0.6 },
  { base: 0.9, amp: 0.11, freq: 4.2, color: mix(PAL.teal, PAL.paper, 0.35), seed: 11, hatch: 1 },
  { base: 0.97, amp: 0.07, freq: 5.6, color: mix(PAL.night, PAL.paper, 0.2), seed: 19, hatch: 0.8 },
];

/** Ridges from this index on are painted on the optional front canvas (in front of the portrait). */
const FRONT_FROM = 2;

export function paintHills(canvas: HTMLCanvasElement, avoid: string[] = [], frontCanvas?: HTMLCanvasElement | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const fctx = frontCanvas?.getContext('2d') ?? null;
  let frontWash: HTMLCanvasElement | null = null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let W = 0, H = 0, dpr = 1;
  let washes: HTMLCanvasElement[] = [];
  let profiles: ((x: number) => number)[] = [];
  let sun = { x: 0, y: 0, r: 0 };
  let stars: { x: number; y: number; s: number; k: number }[] = [];

  const yOf = (i: number, x: number) => {
    const R = RIDGES[i];
    return H * (R.base - R.amp * profiles[i]((x / Math.max(W, 1)) * R.freq + R.seed));
  };

  function layout() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (frontCanvas) { frontCanvas.width = canvas.width; frontCanvas.height = canvas.height; }
    profiles = RIDGES.map((R) => ridgeFn(R.seed));
    const narrow = W < 760;
    sun = narrow
      ? { x: W * 0.8, y: H * 0.13, r: Math.min(W, H) * 0.1 }
      : { x: W * 0.6, y: H * 0.2, r: Math.min(W, H) * 0.085 };
    // keep stars out of the text and the portrait
    const pad = 14;
    const boxes = avoid.flatMap((sel) => Array.from(document.querySelectorAll(sel))).map((el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left - rect.left - pad, t: b.top - rect.top - pad, r: b.right - rect.left + pad, b: b.bottom - rect.top + pad };
    });
    const free = (x: number, y: number) => !boxes.some((q) => x > q.l && x < q.r && y > q.t && y < q.b);
    // on phones the text column spans the width: tuck the sun behind the portrait's corner
    const port = document.querySelector('.portrait')?.getBoundingClientRect();
    if (port) {
      // tuck the sun just behind my head (head sits around 27–65% across, top ~12% down)
      const px = port.left - rect.left, py = port.top - rect.top;
      const r = Math.min(W, H) * (narrow ? 0.11 : 0.085);
      sun = narrow
        ? { x: px + port.width * 0.84, y: py + port.height * 0.02, r }
        : { x: px + port.width * 0.7, y: py + port.height * 0.13, r };
    }
    const rnd = mulberry32(42);
    const n = Math.round(Math.min(48, (W * H) / 30000));
    stars = [];
    for (let tries = 0; stars.length < n && tries < n * 20; tries++) {
      const s = { x: rnd() * W, y: rnd() * H * 0.62, s: 2.5 + rnd() * 3.5, k: rnd() };
      if (free(s.x, s.y)) stars.push(s);
    }
    washes = Array.from({ length: VARIANTS }, (_, v) => bakeWash(v, fctx ? 'back' : 'all'));
    frontWash = fctx ? bakeWash(0, 'front') : null;
  }

  // ---------- watercolour ----------
  function washShape(c: CanvasRenderingContext2D, path: (dx: (x: number) => number, dy: (x: number) => number) => void, color: string, rnd: () => number, layers = 7, alpha = 0.12, spread = 7) {
    c.fillStyle = color;
    for (let l = 0; l < layers; l++) {
      const p1 = rnd() * 6.28, p2 = rnd() * 6.28, f1 = 0.004 + rnd() * 0.01, f2 = 0.02 + rnd() * 0.02;
      const s = spread * (1 - (l / layers) * 0.6);
      const dx = (x: number) => Math.sin(x * f2 + p2) * s * 0.5;
      const dy = (x: number) => (Math.sin(x * f1 + p1) * 0.7 + Math.sin(x * f2 + p2) * 0.3) * s;
      c.globalAlpha = alpha;
      c.beginPath();
      path(dx, dy);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function bakeWash(v: number, part: 'all' | 'back' | 'front' = 'all') {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const c = off.getContext('2d')!;
    const rnd = mulberry32(1000 + v * 77);
    const inPart = (i: number) => part === 'all' || (part === 'front' ? i >= FRONT_FROM : i < FRONT_FROM);
    if (part !== 'front') {

    // sky blush
    const g = c.createRadialGradient(W * 0.75, H * 0.12, 0, W * 0.75, H * 0.12, Math.max(W, H) * 0.6);
    g.addColorStop(0, 'rgba(142,195,230,0.22)');
    g.addColorStop(1, 'rgba(142,195,230,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // sun
    washShape(c, (dx, dy) => {
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        const rr = sun.r + dy(a * 40) * 0.6;
        const x = sun.x + Math.cos(t) * rr + dx(a * 30) * 0.3, y = sun.y + Math.sin(t) * rr;
        a ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
    }, PAL.ochre, rnd, 8, 0.13, 6);
    // a warm halo
    const hg = c.createRadialGradient(sun.x, sun.y, sun.r * 0.8, sun.x, sun.y, sun.r * 2.4);
    hg.addColorStop(0, 'rgba(232,170,56,0.16)'); hg.addColorStop(1, 'rgba(232,170,56,0)');
    c.fillStyle = hg; c.fillRect(0, 0, W, H);
    }

    // ridges, back to front. Every part consumes the same rnd sequence (skipped ridges
    // are painted onto a throwaway 1x1 canvas), so the back and front layers line up.
    const scratch = document.createElement('canvas').getContext('2d')!;
    RIDGES.forEach((R, i) => {
      const g = inPart(i) ? c : scratch;
      const ridge = () => {
        g.moveTo(-20, H + 20);
        for (let x = -20; x <= W + 20; x += 6) g.lineTo(x, yOf(i, x));
        g.lineTo(W + 20, H + 20);
        g.closePath();
      };
      // on the front layer the hill must hide what's behind it: lay down opaque paper first
      if (part === 'front' && g === c) { g.fillStyle = PAL.paper; g.beginPath(); ridge(); g.fill(); }
      washShape(g, (dx, dy) => {
        g.moveTo(-20, H + 20);
        for (let x = -20; x <= W + 20; x += 6) g.lineTo(x + dx(x), yOf(i, x) + dy(x));
        g.lineTo(W + 20, H + 20);
        g.closePath();
      }, R.color, rnd, 7, (i === RIDGES.length - 1 ? 0.2 : 0.14) * (part === 'front' ? 1.45 : 1), 7);
      // pigment pools along the top edge
      g.strokeStyle = R.color; g.lineWidth = 2.5; g.globalAlpha = 0.45;
      g.beginPath();
      for (let x = -20; x <= W + 20; x += 6) { const y = yOf(i, x) + 1.5; x === -20 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
      // a few blooms (cauliflower marks) inside the wash
      g.globalAlpha = 0.06;
      for (let b = 0; b < 6; b++) {
        const bx = rnd() * W, by = yOf(i, bx) + 20 + rnd() * H * 0.08, br = 18 + rnd() * 50;
        g.beginPath(); g.ellipse(bx, by, br * 1.6, br, 0, 0, Math.PI * 2); g.fillStyle = PAL.paper; g.fill();
      }
      g.globalAlpha = 1;
    });
    return off;
  }

  // ---------- ink ----------
  let target: CanvasRenderingContext2D = ctx;
  function inkPath(pts: [number, number][], rnd: () => number, j: number, w: number, alpha = 0.9) {
    const g = target;
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const px = x + (rnd() * 2 - 1) * j, py = y + (rnd() * 2 - 1) * j;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      });
      g.lineWidth = pass ? w * 0.45 : w;
      g.globalAlpha = pass ? alpha * 0.4 : alpha;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function draw(boil: number, t: number) {
    const c = ctx!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(washes[0], 0, 0, canvas.width, canvas.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.strokeStyle = PAL.ink; c.fillStyle = PAL.ink;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const rnd = mulberry32(7919); // same seed every frame: stable, hand-drawn wobble

    // stars: little crosses that twinkle
    stars.forEach((s, i) => {
      if (Math.hypot(s.x - sun.x, s.y - sun.y) < sun.r * 1.6) return;
      const z = s.s;
      const tw = 0.3 + 0.18 * Math.sin(t * 0.9 + s.k * 12);
      inkPath([[s.x - z, s.y], [s.x + z, s.y]], rnd, 0.6, 1.2, tw);
      inkPath([[s.x, s.y - z], [s.x, s.y + z]], rnd, 0.6, 1.2, tw);
    });

    // sun: a sketchy double circle
    for (let loop = 0; loop < 2; loop++) {
      const pts: [number, number][] = [];
      const r = sun.r * (1 + loop * 0.05), start = loop * 1.3;
      for (let a = 0; a <= 36; a++) { const th = start + (a / 36) * Math.PI * 2.08; pts.push([sun.x + Math.cos(th) * r, sun.y + Math.sin(th) * r]); }
      inkPath(pts, rnd, 1.1, loop ? 1 : 1.8, loop ? 0.5 : 0.85);
    }

    // birds, drifting on twos
    for (let b = 0; b < 3; b++) {
      const speed = 14 + b * 5;
      const x = ((t * speed + b * W * 0.37) % (W + 200)) - 100;
      const y = H * (0.2 + b * 0.07) + Math.sin(t * 0.8 + b) * 10;
      const flap = Math.sin(t * 6 + b * 2) * 4, s = 7 + b * 1.5;
      inkPath([[x - s, y - 3 - flap], [x - s * 0.4, y - flap * 0.3], [x, y + 1]], rnd, 0.5, 1.5, 0.8);
      inkPath([[x, y + 1], [x + s * 0.4, y - flap * 0.3], [x + s, y - 3 - flap]], rnd, 0.5, 1.5, 0.8);
    }

    // ridges: outline + dry-brush hatching (front ridges go on the front canvas)
    if (fctx) {
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, frontCanvas!.width, frontCanvas!.height);
      if (frontWash) fctx.drawImage(frontWash, 0, 0, frontCanvas!.width, frontCanvas!.height);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.strokeStyle = PAL.ink; fctx.lineCap = 'round'; fctx.lineJoin = 'round';
    }
    RIDGES.forEach((R, i) => {
      target = fctx && i >= FRONT_FROM ? fctx : c;
      const pts: [number, number][] = [];
      for (let x = -10; x <= W + 10; x += 14) pts.push([x, yOf(i, x)]);
      inkPath(pts, rnd, 1.1, i === RIDGES.length - 1 ? 2.2 : 1.6, 0.55 + i * 0.12);
      if (!R.hatch) return;
      const n = Math.round((W / 38) * R.hatch);
      for (let k = 0; k < n; k++) {
        const hx = hash(k * 9.7 + i * 101) * W;
        const top = yOf(i, hx);
        const len = 8 + hash(k + i * 50) * 16;
        const drop = 6 + hash(k * 3 + i) * 26;
        const dir = hash(k * 1.3 + i) > 0.5 ? 1 : -1;
        inkPath([[hx, top + drop], [hx + dir * len * 0.5, top + drop + len]], rnd, 0.7, 1, 0.35);
      }
    });
    target = c;

    // a shooting star every ~7s
    const P = 7, cyc = Math.floor(t / P), ph = (t % P) / 1.1;
    if (ph < 1 && !reduce.matches) {
      const sx = W * (0.15 + hash(cyc) * 0.7), sy = H * (0.05 + hash(cyc + 5) * 0.15);
      const dir = hash(cyc + 9) > 0.5 ? 1 : -1, len = Math.min(W, 900) * 0.35;
      const hx = sx + dir * len * ph, hy = sy + len * 0.45 * ph;
      const tail = len * 0.35 * Math.sin(ph * Math.PI);
      const a = Math.sin(ph * Math.PI);
      inkPath([[hx - dir * tail, hy - tail * 0.45], [hx, hy]], rnd, 0.8, 2, 0.8 * a);
      inkPath([[hx - dir * tail * 0.7, hy - tail * 0.45 * 0.7 - 5], [hx - dir * 4, hy - 3]], rnd, 0.8, 1, 0.4 * a);
      c.globalAlpha = a; c.fillStyle = PAL.clay;
      c.beginPath(); c.arc(hx, hy, 3.2, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    }
  }

  // ---------- loop ----------
  let raf = 0, visible = true, lastBoil = -1;
  const t0 = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    const boil = Math.floor(t * FPS);
    if (boil === lastBoil) return;
    lastBoil = boil;
    draw(boil, t);
  }
  function start() {
    cancelAnimationFrame(raf);
    if (reduce.matches) { draw(0, 3); return; }
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  layout();
  draw(0, 0);
  start();

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(canvas);
  document.addEventListener('visibilitychange', start);
  reduce.addEventListener('change', start);

  let lastW = W, lastH = H, rt: number | undefined;
  new ResizeObserver(() => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      const r = canvas.getBoundingClientRect();
      // ignore small height jitter from mobile toolbars
      if (Math.abs(r.width - lastW) < 2 && Math.abs(r.height - lastH) < 90) return;
      layout(); lastW = W; lastH = H; lastBoil = -1; draw(0, 0); start();
    }, 150);
  }).observe(canvas);
}
