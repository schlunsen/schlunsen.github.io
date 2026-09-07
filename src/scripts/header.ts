const header = document.querySelector<HTMLElement>('#site-header');
if (header) {
  const links = Array.from(header.querySelectorAll<HTMLAnchorElement>('a[data-section]'));
  const sections = links.map(link => document.getElementById(link.dataset.section!));
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.style.setProperty('--progress', String(max > 0 ? Math.max(0, Math.min(1, y / max)) : 0));
    let active = -1;
    sections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= window.innerHeight * .4) active = index;
    });
    links.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    ticking = false;
  };
  const schedule = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  update();
}
