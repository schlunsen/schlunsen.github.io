const canvas = document.querySelector<HTMLCanvasElement>('#system-canvas');
const toggle = document.querySelector<HTMLButtonElement>('#motion-toggle');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
if (canvas && toggle) {
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, frame = 0, time = 0;
  let paused = reduced.matches, visible = true;
  let pointerX = 0, pointerY = 0;
  const points = Array.from({ length: 430 }, (_, i) => {
    const y = 1 - (i / 429) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = Math.PI * (3 - Math.sqrt(5)) * i;
    return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
  });
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(width, height) * .37;
    const angle = time * .00012 + pointerX * .16;
    const projected = points.map(p => {
      const x = p.x * Math.cos(angle) - p.z * Math.sin(angle);
      const z = p.x * Math.sin(angle) + p.z * Math.cos(angle);
      const y = p.y * Math.cos(.32 + pointerY * .1) - z * Math.sin(.32 + pointerY * .1);
      return { x: width * .53 + x * radius, y: height * .48 + y * radius, z };
    });
    ctx.lineWidth = .6;
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      // Connect spatial neighbors on the sphere, rather than crossing its interior.
      for (const offset of [13, 21, 34]) {
        const j = i + offset;
        if (j >= points.length) continue;
        const a = points[i], b = points[j];
        if (Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) > .35) continue;
        const q = projected[j];
        ctx.strokeStyle = `rgba(92,102,67,${.09 + (p.z+1)*.14})`;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
      }
      ctx.fillStyle = i % 17 === 0 ? '#98703d' : `rgba(72,85,51,${.2+(p.z+1)*.3})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,i%17===0 ? 2.7 : 1.05,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(100,107,81,.15)';
    ctx.beginPath(); ctx.ellipse(width*.53,height*.48,radius*1.2,radius*.34,-.4,0,Math.PI*2);ctx.stroke();
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
    if (paused || !visible || document.hidden) { cancelAnimationFrame(frame); frame=0; previous=0; }
    else if (!frame) frame=requestAnimationFrame(loop);
    draw();
  }
  new ResizeObserver(() => {
    const bounds=canvas.getBoundingClientRect(); width=bounds.width; height=bounds.height;
    const dpr=Math.min(window.devicePixelRatio || 1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx?.setTransform(dpr,0,0,dpr,0,0);draw();
  }).observe(canvas);
  new IntersectionObserver(entries => { visible=entries[0].isIntersecting;sync(); }).observe(canvas);
  document.querySelector('.intro')?.addEventListener('pointermove', (event) => {
    if (paused) return;
    const e=event as PointerEvent; pointerX=e.clientX/window.innerWidth-.5;pointerY=e.clientY/window.innerHeight-.5;
  }, {passive:true});
  toggle.addEventListener('click', () => { paused=!paused; sync(); });
  reduced.addEventListener('change', () => { paused=reduced.matches;sync(); });
  document.addEventListener('visibilitychange',sync);
  sync();
}
