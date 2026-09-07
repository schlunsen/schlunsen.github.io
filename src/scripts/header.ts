const header = document.querySelector<HTMLElement>('#site-header');
if (header) {
  const nav = header.querySelector<HTMLElement>('nav');
  const links = Array.from(header.querySelectorAll<HTMLAnchorElement>('nav a[data-section]'));
  const indicator = header.querySelector<HTMLElement>('.nav-indicator');
  const hh = header.querySelector<HTMLElement>('[data-hh]');
  const mm = header.querySelector<HTMLElement>('[data-mm]');

  // Scroll state: condense the header and track reading progress.
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header!.classList.toggle('is-scrolled', y > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header!.style.setProperty('--progress', String(max > 0 ? Math.min(1, y / max) : 0));
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Amber indicator slides to the hovered link, otherwise to the section being read.
  let active: HTMLAnchorElement | null = null;
  function place(link: HTMLAnchorElement | null) {
    if (!indicator || !nav) return;
    if (!link) { indicator.classList.remove('is-visible'); return; }
    const label = link.querySelector<HTMLElement>('.roll') ?? link;
    indicator.style.left = `${label.offsetLeft + link.offsetLeft}px`;
    indicator.style.width = `${label.offsetWidth}px`;
    indicator.classList.add('is-visible');
  }
  links.forEach(link => {
    link.addEventListener('pointerenter', () => place(link));
    link.addEventListener('pointerleave', () => place(active));
  });
  const sections = links.map(l => document.getElementById(l.dataset.section!)).filter(Boolean) as HTMLElement[];
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) active = links.find(l => l.dataset.section === visible.target.id) ?? null;
    else if (window.scrollY < 200) active = null;
    place(active);
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .1, .5] });
  sections.forEach(s => observer.observe(s));
  window.addEventListener('resize', () => place(active), { passive: true });

  // Live Barcelona time.
  if (hh && mm) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
    const tick = () => {
      const parts = fmt.formatToParts(new Date());
      hh.textContent = parts.find(p => p.type === 'hour')?.value ?? '––';
      mm.textContent = parts.find(p => p.type === 'minute')?.value ?? '––';
    };
    tick();
    setInterval(tick, 15000);
  }
}
