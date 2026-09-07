const canvas = document.querySelector<HTMLCanvasElement>('#system-canvas');
const toggle = document.querySelector<HTMLButtonElement>('#motion-toggle');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
type Vec = { x: number; y: number; z: number };
if (canvas && toggle) {
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, frame = 0, time = 0;
  let paused = reduced.matches, visible = true;
  let pointerX = 0, pointerY = 0;
  const COUNT = 430;
  const points: Vec[] = Array.from({ length: COUNT }, (_, i) => {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
  });
  // Edges connect spatial neighbours on the sphere; the same topology survives every morph.
  const edges: [number, number][] = [];
  points.forEach((a, i) => {
    for (const offset of [13, 21, 34]) {
      const j = i + offset;
      if (j >= COUNT) continue;
      const b = points[j];
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= .35) edges.push([i, j]);
    }
  });

  // Every shape is a continuous deformation of the sphere, so points never jump.
  const shapes: ((p: Vec, i: number, t: number) => Vec)[] = [
    p => p,
    // Torus: latitude wraps around the tube, poles meet on the inner ring.
    p => {
      const ring = Math.hypot(p.x, p.z) || 1e-6;
      const psi = Math.asin(Math.max(-1, Math.min(1, p.y))) * 2;
      const r = .68 + .34 * Math.cos(psi);
      return { x: (p.x / ring) * r, y: .34 * Math.sin(psi), z: (p.z / ring) * r };
    },
    p => p,
    // Rounded cube: push toward the max-norm surface.
    p => {
      const m = Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) || 1e-6;
      const k = .74 / m;
      return { x: p.x * (.3 + .7 * k), y: p.y * (.3 + .7 * k), z: p.z * (.3 + .7 * k) };
    },
    p => p,
    // Breathing blob: a slow travelling ripple across the surface.
    (p, _i, t) => {
      const phi = Math.asin(Math.max(-1, Math.min(1, p.y)));
      const theta = Math.atan2(p.z, p.x);
      const s = 1 + .09 * Math.sin(3 * phi + 2 * theta + t * .0009) + .04 * Math.cos(5 * theta - t * .0006);
      return { x: p.x * s, y: p.y * s, z: p.z * s };
    },
  ];
  const HOLD = 6500, MORPH = 3800, STAGE = HOLD + MORPH;
  const ease = (x: number) => x * x * (3 - 2 * x);

  function morphed(): Vec[] {
    const stage = Math.floor(time / STAGE) % shapes.length;
    const next = (stage + 1) % shapes.length;
    const local = time % STAGE;
    const mix = local < HOLD ? 0 : ease((local - HOLD) / MORPH);
    const from = shapes[stage], to = shapes[next];
    return points.map((p, i) => {
      const a = from(p, i, time);
      if (mix === 0) return a;
      const b = to(p, i, time);
      return { x: a.x + (b.x - a.x) * mix, y: a.y + (b.y - a.y) * mix, z: a.z + (b.z - a.z) * mix };
    });
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(width, height) * .37;
    const angle = time * .00012 + pointerX * .16;
    const tilt = .32 + pointerY * .1;
    const projected = morphed().map(p => {
      const x = p.x * Math.cos(angle) - p.z * Math.sin(angle);
      const z = p.x * Math.sin(angle) + p.z * Math.cos(angle);
      const y = p.y * Math.cos(tilt) - z * Math.sin(tilt);
      return { x: width * .53 + x * radius, y: height * .48 + y * radius, z };
    });
    ctx.lineWidth = .6;
    for (const [i, j] of edges) {
      const p = projected[i], q = projected[j];
      if (Math.hypot(p.x - q.x, p.y - q.y) > radius * .5) continue;
      ctx.strokeStyle = `rgba(92,102,67,${.09 + (p.z + 1) * .14})`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    projected.forEach((p, i) => {
      const accent = i % 17 === 0;
      ctx.fillStyle = accent ? '#98703d' : `rgba(72,85,51,${.2 + (p.z + 1) * .3})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, accent ? 2.7 : 1.05, 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(100,107,81,.15)';
    ctx.beginPath(); ctx.ellipse(width * .53, height * .48, radius * 1.2, radius * .34, -.4, 0, Math.PI * 2); ctx.stroke();
  }
  let previous = 0;
  function loop(now: number) {
    if (paused || !visible || document.hidden) { frame = 0; previous = 0; return; }
    if (previous) time += Math.min(now - previous, 40);
    previous = now; draw(); frame = requestAnimationFrame(loop);
  }
  function sync() {
    toggle!.setAttribute('aria-pressed', String(paused));
    toggle!.innerHTML = paused ? 'Play motion <span>▷</span>' : 'Pause motion <span>Ⅱ</span>';
    document.documentElement.classList.toggle('motion-paused', paused);
    if (paused || !visible || document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
    else if (!frame) frame = requestAnimationFrame(loop);
    draw();
  }
  new ResizeObserver(() => {
    const bounds = canvas.getBoundingClientRect(); width = bounds.width; height = bounds.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }).observe(canvas);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(canvas);
  document.querySelector('.intro')?.addEventListener('pointermove', (event) => {
    if (paused) return;
    const e = event as PointerEvent; pointerX = e.clientX / window.innerWidth - .5; pointerY = e.clientY / window.innerHeight - .5;
  }, { passive: true });
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  sync();
}
