/* Small things for people who look closely. */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

console.log(
  '%cHi, you opened the console.%c\n\nThis site is plain HTML, CSS and JavaScript: no framework, no build step.\n' +
  'Source: https://github.com/justAbdulaziz10/Abdulaziz\n' +
  'If you are hiring, I would like to hear from you: abdulazizalkhlaiwe@gmail.com\n\n' +
  'One more thing: try the Konami code on the page.',
  'font: 700 15px system-ui; padding: 2px 0', 'font: 13px system-ui; line-height: 1.5'
);

/* ↑ ↑ ↓ ↓ ← → ← → B A turns the paper sections to night, and back */
const CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let at = 0, toastTimer;

function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('p');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  at = key === CODE[at] ? at + 1 : (key === CODE[0] ? 1 : 0);
  if (at < CODE.length) return;
  at = 0;
  const root = document.documentElement;
  const on = !root.classList.contains('is-night');
  if (!reduced) root.classList.add('is-switching');
  root.classList.toggle('is-night', on);
  setTimeout(() => root.classList.remove('is-switching'), 700);
  toast(on ? 'Night mode on. Same code turns it off.' : 'Night mode off.');
});
