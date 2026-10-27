/* Rewind: scrub through every published version of this page.
   assets/history/ holds a full-page capture per commit (made by the local history script) and index.json.
   The view pans slowly down the page; every version shares the pan, so scrubbing morphs the same stretch of
   page from one version into the next. */
const root = document.querySelector('#rewind');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE = new URL('../assets/history/', import.meta.url);
const PAGE_W = 1440; // captures are taken at this viewport width
const PAN_S = 46; // seconds for one pass down the page

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// the commit's own wall-clock time, as written in its ISO offset
const when = (iso) => {
  const [, y, m, d, hh, mm] = iso.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);
  return `${+d} ${months[m - 1]} ${y}, ${hh}:${mm}`;
};

async function start() {
  const versions = await fetch(new URL('index.json', BASE), { cache: 'no-cache' }).then(r => r.json());
  if (!versions.length) return;
  const $ = (s) => root.querySelector(s);
  const strip = $('[data-rewind-strip]'), range = $('[data-rewind-range]'), view = $('[data-rewind-view]');
  const whenEl = $('[data-rewind-when]'), whatEl = $('[data-rewind-what]'), shaEl = $('[data-rewind-sha]');
  const tallest = Math.max(...versions.map(v => v.height));

  for (const v of versions) {
    const li = document.createElement('li');
    li.style.setProperty('--h', `${(v.height / tallest * 100).toFixed(1)}%`);
    li.style.backgroundImage = `url("${new URL(`${v.sha}-s.webp`, BASE).href}")`;
    strip.append(li);
  }
  range.max = String(versions.length - 1);
  $('[data-rewind-scrub]').hidden = false;
  if (reduced) view.classList.add('is-static');

  const imgs = new Map();
  const imgFor = (i) => {
    if (imgs.has(i)) return imgs.get(i);
    const v = versions[i], img = new Image();
    img.alt = `This page as published on ${when(v.date)}`;
    img.decoding = 'async';
    img.width = 760; img.height = Math.round(760 * v.height / PAGE_W);
    img.src = new URL(`${v.sha}.webp`, BASE).href;
    img.className = 'is-gone';
    view.append(img);
    imgs.set(i, img);
    return img;
  };

  // the neighbours (about 240KB each) load once someone reaches for the scrubber, not on every visit
  let cur = -1, pan = 0, engaged = false;
  const warm = (i) => { if (engaged && !reduced) [i - 1, i + 1].forEach(n => { if (n >= 0 && n < versions.length) imgFor(n); }); };
  const engage = () => { if (!engaged) { engaged = true; warm(cur); } };
  for (const type of ['pointerenter', 'focusin', 'touchstart']) $('[data-rewind-scrub]').addEventListener(type, engage, { passive: true });
  const place = () => {
    const vw = view.clientWidth, vh = view.clientHeight;
    for (const [i, img] of imgs) {
      const h = vw * versions[i].height / PAGE_W;
      img.style.setProperty('--y', `${(-pan * Math.max(0, h - vh)).toFixed(1)}px`);
    }
  };
  const show = (i) => {
    if (i === cur) return;
    const prev = imgs.get(cur);
    cur = i;
    const v = versions[i], img = imgFor(i);
    if (reduced) { for (const [k, other] of imgs) if (k !== i) { other.remove(); imgs.delete(k); } }
    img.classList.remove('is-gone');
    if (prev && prev !== img) prev.classList.add('is-gone');
    warm(i);
    [...strip.children].forEach((li, k) => li.classList.toggle('is-on', k === i));
    whenEl.textContent = `Version ${i + 1} of ${versions.length}, ${when(v.date)}`;
    whatEl.textContent = v.subject;
    shaEl.textContent = `justabdulaziz10.github.io/Abdulaziz @ ${v.sha}`;
    range.value = String(i);
    range.setAttribute('aria-valuetext', `Version ${i + 1} of ${versions.length}, ${when(v.date)}: ${v.subject}`);
    place();
  };
  range.addEventListener('input', () => show(+range.value));
  show(versions.length - 1);
  if (reduced) return;

  // slow pan down the page and back, only while the stage is on screen and nobody is pointing at it
  let visible = false, held = false, last = 0, dir = 1, raf = 0;
  const tick = (t) => {
    raf = 0;
    if (!visible || held || document.hidden) { last = 0; return; }
    if (last) {
      pan = clamp(pan + dir * (t - last) / 1000 / PAN_S);
      if (pan === 1 || pan === 0) dir = -dir;
      place();
    }
    last = t;
    raf = requestAnimationFrame(tick);
  };
  const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(view);
  view.addEventListener('pointerenter', () => { held = true; });
  view.addEventListener('pointerleave', () => { held = false; run(); });
  document.addEventListener('visibilitychange', run);
  addEventListener('resize', place, { passive: true });
}

if (root) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    start().catch(() => {});
  }, { rootMargin: '800px 0px' });
  io.observe(root);
}
