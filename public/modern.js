(() => {
  const nav = document.querySelector('#primary-nav, #mainNav');
  const toggle = document.querySelector('.menu-toggle, #mobileToggle');
  // Standalone guide pages do not load the homepage's builder/pricing scripts.
  if (document.body.classList.contains('aura-guide')) {
    toggle?.addEventListener('click', () => {
      const open = nav?.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(Boolean(open)));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav?.addEventListener('click', event => {
      if (!event.target.closest('a')) return;
      nav.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { nav?.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); }
  });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;
  const targets = document.querySelectorAll('main > section, .guide-card, .guide-faq details, .feature-card, .price-card, .am-template-card, .am-process-grid article, .am-price-card');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.remove('aura-pending'); entry.target.classList.add('aura-visible'); observer.unobserve(entry.target); }
  }), { threshold: .08, rootMargin: '0px 0px -24px 0px' });
  document.documentElement.classList.add('aura-motion');
  targets.forEach((element, index) => {
    element.dataset.scrollReveal = '';
    if (element.getBoundingClientRect().top < innerHeight - 24) { element.classList.add('aura-visible'); return; }
    element.style.setProperty('--reveal-delay', `${(index % 3) * 60}ms`);
    element.classList.add('aura-pending'); observer.observe(element);
  });
  const progress = document.createElement('div'); progress.className = 'aura-progress'; progress.setAttribute('aria-hidden', 'true'); document.body.appendChild(progress);
  let queued = false;
  const update = () => { const max = document.documentElement.scrollHeight - innerHeight; progress.style.transform = `scaleX(${max > 0 ? Math.max(0, Math.min(1, scrollY / max)) : 0})`; queued = false; };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true }); update();
  motion.addEventListener('change', () => { if (motion.matches) { observer.disconnect(); targets.forEach(el => el.classList.remove('aura-pending')); progress.remove(); } });
})();
