const canvas = document.querySelector<HTMLCanvasElement>('#system-canvas');
const toggle = document.querySelector<HTMLButtonElement>('#motion-toggle');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
type Vec = { x: number; y: number; z: number };
type Pulse = { dist: Int16Array; start: number; strength: number; span: number };
if (canvas && toggle) {
  const ctx = canvas.getContext('2d');
  const intro = document.querySelector<HTMLElement>('.intro');
  let width = 0, height = 0, frame = 0, time = 0;
  let paused = reduced.matches, visible = true;
  let pointerX = 0, pointerY = 0;
  // The signature interaction: the figure reaches toward the pointer and passes a signal through its edges.
  const cursor = { x: 0, y: 0, tx: 0, ty: 0, active: false, reach: 0, impulse: 0, near: -1 };
  let settle = 1; // 1 at the top of the page, easing to 0 as the hero scrolls away
  let nextPulse = 2600, lastHoverPulse = 0;
  const pulses: Pulse[] = [];
  const COUNT = 430;
  const points: Vec[] = Array.from({ length: COUNT }, (_, i) => {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
  });
  // Edges connect spatial neighbours on the sphere; the same topology survives every morph.
  const edges: [number, number][] = [];
  const adjacency: number[][] = Array.from({ length: COUNT }, () => []);
  points.forEach((a, i) => {
    for (const offset of [13, 21, 34]) {
      const j = i + offset;
      if (j >= COUNT) continue;
      const b = points[j];
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= .35) { edges.push([i, j]); adjacency[i].push(j); adjacency[j].push(i); }
    }
  });

  // A pulse is a wavefront in graph distance from its origin, so it visibly travels along connections.
  function emit(origin: number, strength: number) {
    if (origin < 0 || pulses.length >= 4) return;
    const dist = new Int16Array(COUNT).fill(-1);
    const queue = [origin]; dist[origin] = 0; let span = 0;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      for (const j of adjacency[i]) if (dist[j] < 0) { dist[j] = dist[i] + 1; span = dist[j]; queue.push(j); }
    }
    pulses.push({ dist, start: time, strength, span });
  }

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
  const HOLD = 4200, MORPH = 2600, STAGE = HOLD + MORPH;
  // Start on a random shape each load (stages alternate shape/sphere, so pick a non-sphere stage).
  const startStage = 1 + 2 * Math.floor(Math.random() * (shapes.length / 2));
  time = startStage * STAGE;
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

  const OLIVE = [92, 102, 67], AMBER = [176, 122, 52];
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(width, height) * .37;
    const cx = width * .53, cy = height * .48;
    const angle = time * .00012 + pointerX * .16;
    const tilt = .32 + pointerY * .1;
    // Direction of the pointer in view space, biased toward the viewer so the reach reads as depth too.
    const reach = cursor.reach * settle * (1 + cursor.impulse * .6);
    const dl = Math.hypot(cursor.x, cursor.y, .6) || 1;
    const dx = cursor.x / dl, dy = cursor.y / dl, dz = .6 / dl;
    let nearest = -1, nearestDistance = Infinity;
    const projected = morphed().map((p, i) => {
      const rx = p.x * Math.cos(angle) - p.z * Math.sin(angle);
      const rz = p.x * Math.sin(angle) + p.z * Math.cos(angle);
      let x = rx, y = p.y * Math.cos(tilt) - rz * Math.sin(tilt), z = p.y * Math.sin(tilt) + rz * Math.cos(tilt);
      if (reach > .002) {
        // Points facing the pointer stretch toward it; points right under it are drawn in a little more.
        const len = Math.hypot(x, y, z) || 1;
        const facing = Math.max(0, (x * dx + y * dy + z * dz) / len);
        const stretch = reach * .38 * facing ** 4;
        const gap = Math.hypot(x - cursor.x, y - cursor.y);
        const pull = reach * .16 * Math.exp(-gap * gap * 4.5);
        x += dx * stretch + (cursor.x - x) * pull; y += dy * stretch + (cursor.y - y) * pull; z += dz * stretch;
      }
      const sx = cx + x * radius, sy = cy + y * radius;
      if (z > -.1) {
        const gap = Math.hypot(x - cursor.x, y - cursor.y);
        if (gap < nearestDistance) { nearestDistance = gap; nearest = i; }
      }
      return { x: sx, y: sy, z };
    });
    cursor.near = nearestDistance < 1.15 ? nearest : -1;
    // Signal intensity per point from every live pulse.
    const glow = new Float32Array(COUNT);
    for (let k = pulses.length - 1; k >= 0; k--) {
      const pulse = pulses[k];
      const front = (time - pulse.start) * .0055;
      const fade = Math.max(0, 1 - front / (pulse.span + 6));
      if (fade <= 0) { pulses.splice(k, 1); continue; }
      const amp = pulse.strength * fade * settle;
      for (let i = 0; i < COUNT; i++) {
        const d = pulse.dist[i]; if (d < 0) continue;
        const off = d - front; const g = amp * Math.exp(-off * off * .9);
        if (g > glow[i]) glow[i] = g;
      }
    }
    for (const [i, j] of edges) {
      const p = projected[i], q = projected[j];
      if (Math.hypot(p.x - q.x, p.y - q.y) > radius * .5) continue;
      const g = Math.max(glow[i], glow[j]);
      const depth = .09 + (p.z + 1) * .14;
      if (g < .02) { ctx.lineWidth = .6; ctx.strokeStyle = `rgba(92,102,67,${depth})`; }
      else {
        ctx.lineWidth = .6 + g * 1.1;
        ctx.strokeStyle = `rgba(${OLIVE[0] + (AMBER[0] - OLIVE[0]) * g | 0},${OLIVE[1] + (AMBER[1] - OLIVE[1]) * g | 0},${OLIVE[2] + (AMBER[2] - OLIVE[2]) * g | 0},${Math.min(1, depth + g * .75)})`;
      }
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    projected.forEach((p, i) => {
      const accent = i % 17 === 0, g = glow[i];
      if (g > .02) {
        ctx.fillStyle = `rgba(176,122,52,${Math.min(1, .35 + g * .65)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, (accent ? 2.7 : 1.05) + g * 2.2, 0, Math.PI * 2); ctx.fill();
        return;
      }
      ctx.fillStyle = accent ? '#98703d' : `rgba(72,85,51,${.2 + (p.z + 1) * .3})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, accent ? 2.7 : 1.05, 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(100,107,81,.15)';
    ctx.beginPath(); ctx.ellipse(cx, cy, radius * 1.2, radius * .34, -.4, 0, Math.PI * 2); ctx.stroke();
  }

  function step(dt: number) {
    time += dt;
    // Smooth the pointer so the figure follows with a little weight instead of snapping.
    const k = 1 - Math.exp(-dt / 140);
    cursor.x += (cursor.tx - cursor.x) * k; cursor.y += (cursor.ty - cursor.y) * k;
    cursor.reach += ((cursor.active ? 1 : 0) - cursor.reach) * (1 - Math.exp(-dt / (cursor.active ? 260 : 520)));
    cursor.impulse *= Math.exp(-dt / 320);
    if (cursor.active && cursor.reach > .5 && time - lastHoverPulse > 1100 && cursor.near >= 0) {
      lastHoverPulse = time; emit(cursor.near, .45);
    }
    // At rest the system still passes a quiet signal now and then, so it reads as alive before you touch it.
    if (time > nextPulse) {
      nextPulse = time + 3200 + Math.random() * 3600;
      if (!cursor.active) emit(Math.floor(Math.random() * COUNT), .38);
    }
  }
  let previous = 0;
  function loop(now: number) {
    if (paused || !visible || document.hidden) { frame = 0; previous = 0; return; }
    if (previous) step(Math.min(now - previous, 40));
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
  function track(e: PointerEvent) {
    pointerX = e.clientX / window.innerWidth - .5; pointerY = e.clientY / window.innerHeight - .5;
    const bounds = canvas.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) * .37 || 1;
    cursor.tx = (e.clientX - bounds.left - bounds.width * .53) / radius;
    cursor.ty = (e.clientY - bounds.top - bounds.height * .48) / radius;
    // Only reach when the pointer is near the figure, so reading the headline leaves it calm.
    cursor.active = Math.hypot(cursor.tx, cursor.ty) < 2.4;
  }
  intro?.addEventListener('pointermove', (event) => { if (!paused) track(event as PointerEvent); }, { passive: true });
  intro?.addEventListener('pointerleave', () => { cursor.active = false; });
  intro?.addEventListener('pointerdown', (event) => {
    if (paused) return;
    const e = event as PointerEvent;
    if ((e.target as HTMLElement).closest('a,button')) return;
    track(e);
    if (!cursor.active) return;
    // A tap or click sends a strong signal from the point under the pointer and gives the figure a nudge.
    cursor.reach = Math.max(cursor.reach, .6); cursor.impulse = 1; lastHoverPulse = time;
    draw(); emit(cursor.near, .85);
    // Touch has no pointerleave, so let the reach relax on its own after a tap.
    if (e.pointerType !== 'mouse') setTimeout(() => { cursor.active = false; }, 900);
  });
  window.addEventListener('scroll', () => {
    const range = (intro?.offsetHeight || window.innerHeight) * .7;
    settle = 1 - Math.min(1, Math.max(0, window.scrollY / range));
    if (settle < .05) cursor.active = false;
  }, { passive: true });
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  sync();
}
