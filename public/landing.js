const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.classList.toggle('open', open);
});
nav?.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  nav.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
});
document.querySelectorAll('[data-billing]').forEach(button => {
  button.addEventListener('click', () => {
    const yearly = button.dataset.billing === 'yearly';
    document.querySelectorAll('[data-billing]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-month]').forEach(price => {
      const amount = Number(price.dataset.month) * (yearly ? 0.8 : 1);
      price.textContent = '$' + (Number.isInteger(amount) ? amount : amount.toFixed(2));
      price.parentElement.querySelector('span').textContent = yearly ? '/month, billed yearly' : '/month';
    });
  });
});


// Autoplay all site videos in the browser-supported, silent inline mode.
(() => {
  const setUp = (video) => {
    if (video.dataset.auraAutoplayReady === '1' || video.hasAttribute('data-no-autoplay')) return;
    video.dataset.auraAutoplayReady = '1';
    video.defaultMuted = true;
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    const start = () => {
      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    };
    video.addEventListener('canplay', start, { once: true });
    start();
  };
  const scan = () => document.querySelectorAll('video').forEach(setUp);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) document.querySelectorAll('video[data-aura-autoplay-ready="1"]').forEach(v => v.play().catch(() => {})); });
})();
