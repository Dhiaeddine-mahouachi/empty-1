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
