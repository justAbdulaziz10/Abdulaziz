// One line — page shell: worlds, scenes, the connecting thread, small interactions.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const body = document.body;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------- hero entrance ---------- */
const hero = document.querySelector('.hero');
const startHero = () => requestAnimationFrame(() => hero.classList.add('is-in'));
(document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]) : Promise.resolve()).then(startHero);

/* ---------- worlds ---------- */
const worldSections = [...document.querySelectorAll('main [data-world]')];
const worldIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) body.dataset.world = e.target.dataset.world;
}, { rootMargin: '-50% 0px -50% 0px' });
worldSections.forEach(s => worldIO.observe(s));
const themeMeta = document.querySelector('meta[name="theme-color"]');
new MutationObserver(() => { themeMeta.content = getComputedStyle(body).getPropertyValue('--bg').trim() || '#f2f3ee'; })
  .observe(body, { attributes: true, attributeFilter: ['data-world'] });

/* ---------- header ---------- */
const top = document.querySelector('.top');
let lastY = scrollY;
const navLinks = [...document.querySelectorAll('.top__nav a')];
const navTargets = navLinks.map(a => document.querySelector(a.getAttribute('href')));
function onScrollHeader() {
  const y = scrollY;
  top.toggleAttribute('data-scrolled', y > 24);
  const goingDown = y > lastY && y > 400;
  top.toggleAttribute('data-hidden', goingDown && !top.contains(document.activeElement));
  lastY = y;
  const mid = innerHeight * 0.4;
  let current = -1;
  navTargets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < mid) current = i; });
  navLinks.forEach((a, i) => a.toggleAttribute('aria-current', i === current));
}

/* ---------- reveals ---------- */
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
}, { rootMargin: '0px 0px -15% 0px' });
document.querySelectorAll('.shot, .progress, .contact').forEach(el => revealIO.observe(el));

/* count-up for the year number */
const counter = document.querySelector('[data-count]');
if (counter && !reduced) {
  const fmt = new Intl.NumberFormat('en-US');
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const target = +counter.dataset.count; // read late: js/live.js may have refreshed it
    const t0 = performance.now(), dur = 1400;
    const tick = (t) => {
      const k = clamp((t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 4);
      counter.textContent = fmt.format(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(tick);
    };
    counter.textContent = '0';
    requestAnimationFrame(tick);
  }, { rootMargin: '0px 0px -20% 0px' });
  io.observe(counter);
}

/* ---------- copy email ---------- */
document.querySelectorAll('[data-copy]').forEach(btn => {
  const status = document.querySelector('[data-copy-status]');
  const label = btn.textContent;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = 'Copied';
      btn.setAttribute('data-copied', '');
      status.textContent = 'Email address copied to the clipboard';
    } catch {
      btn.textContent = 'Select and copy above';
      status.textContent = 'Copy failed. The address is shown above.';
    }
    setTimeout(() => { btn.textContent = label; btn.removeAttribute('data-copied'); status.textContent = ''; }, 2200);
  });
});

/* ---------- scenes ---------- */
const slots = [...document.querySelectorAll('.scene-slot[data-scene]')];
const scenes = []; // { slot, el, api, visible }

async function mountScene(slot) {
  const id = slot.dataset.scene;
  const el = document.createElement('div');
  el.className = `scene scene--${id}`;
  slot.append(el);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = `scenes/${id}.css`;
  const cssReady = new Promise(r => { css.onload = r; css.onerror = r; });
  document.head.append(css);
  try {
    const [mod] = await Promise.all([import(`../scenes/${id}.js`), cssReady]);
    const api = mod.mount(el, { reduced });
    const rec = { slot, el, api, visible: false, p: -1 };
    scenes.push(rec);
    sceneIO.observe(slot);
    return rec;
  } catch (err) {
    console.warn(`Scene ${id} failed to load`, err);
    slot.hidden = true;
  }
}

const sceneIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const rec = scenes.find(s => s.slot === e.target);
    if (rec) rec.visible = e.isIntersecting;
  }
  queue();
}, { rootMargin: '25% 0px 25% 0px' });

function sectionProgress(el) {
  const r = el.getBoundingClientRect();
  return clamp((innerHeight - r.top) / (r.height + innerHeight));
}

/* ---------- the thread: one line connecting every scene ---------- */
const NS = 'http://www.w3.org/2000/svg';
const thread = document.createElementNS(NS, 'svg');
thread.classList.add('thread');
thread.setAttribute('aria-hidden', 'true');
document.querySelector('main').prepend(thread);
let connectors = []; // { path, y0, y1 }

const obstacleSel = '.project__text, .section-title, .year__title, .year__sub, .off__caption, .off__meta, .exp__lead, .timeline, .more__list, .skills__grid, .learn, .hero__inner, .contact__title, .contact__body, .shot';

function anchorsOf(rec) {
  const r = rec.el.getBoundingClientRect();
  const a = rec.api.anchors ? rec.api.anchors() : null;
  const en = a?.entry ?? { x: 0.5, y: 0 };
  const ex = a?.exit ?? { x: 0.5, y: 1 };
  const sy = scrollY;
  return {
    entry: { x: r.left + r.width * en.x, y: r.top + sy + r.height * en.y },
    exit: { x: r.left + r.width * ex.x, y: r.top + sy + r.height * ex.y },
  };
}

function blocked(x, y0, y1, rects) {
  const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
  return rects.some(r => x > r.l - 14 && x < r.r + 14 && r.b > lo && r.t < hi);
}

function route(E, N, rects, laneX) {
  const hHit = (y, xa, xb) => rects.find(q => y > q.t - 12 && y < q.b + 12 && Math.max(xa, xb) > q.l - 12 && Math.min(xa, xb) < q.r + 12);
  // ending in the lane itself: run down the lane and turn into the target from the side
  if (Math.abs(N.x - laneX) < 1 && N.tail) {
    const t = 14, d1 = Math.sign(laneX - E.x) || -1;
    let r1 = Math.max(4, Math.min(40, Math.abs(laneX - E.x) / 2)), y1 = E.y + Math.min(56, (N.y - E.y) / 5), q;
    // text right under the exit: turn early, halfway into the gap, with a tighter bend
    if ((q = hHit(y1, E.x, laneX))) { y1 = (E.y + q.t) / 2; r1 = Math.max(4, Math.min(r1, y1 - E.y)); }
    const head = Math.abs(laneX - E.x) < 1 ? `M${E.x} ${E.y}` : `M${E.x} ${E.y}V${y1 - r1}Q${E.x} ${y1} ${E.x + d1 * r1} ${y1}H${laneX - d1 * r1}Q${laneX} ${y1} ${laneX} ${y1 + r1}`;
    return `${head}V${N.y - t}Q${laneX} ${N.y} ${laneX + t} ${N.y}H${N.tail}`;
  }
  const r = Math.max(8, Math.min(48, Math.abs(N.y - E.y) / 4, Math.abs(N.x - E.x) / 2 || 48));
  const midY = (E.y + N.y) / 2;
  const straight = Math.abs(N.x - E.x) < 1;
  if (straight && !blocked(E.x, E.y, N.y, rects)) return `M${E.x} ${E.y}V${N.y}`;
  const directOk = !blocked(E.x, E.y, midY, rects) && !blocked(N.x, midY, N.y, rects) && !rects.some(q => midY > q.t - 10 && midY < q.b + 10 && Math.max(E.x, N.x) > q.l && Math.min(E.x, N.x) < q.r);
  if (directOk) {
    const dir = Math.sign(N.x - E.x);
    return `M${E.x} ${E.y}V${midY - r}Q${E.x} ${midY} ${E.x + dir * r} ${midY}H${N.x - dir * r}Q${N.x} ${midY} ${N.x} ${midY + r}V${N.y}`;
  }
  // route through the margin lane, clear of text; the two horizontal legs slide until they miss every block
  const rr = Math.max(4, Math.min(40, (N.y - E.y) / 6, Math.abs(N.x - laneX) / 2 || 40, Math.abs(laneX - E.x) / 2 || 40));
  let y1 = E.y + Math.min(56, (N.y - E.y) / 5), y2 = N.y - Math.min(56, (N.y - E.y) / 5), q;
  for (let i = 0; i < 6 && (q = hHit(y1, E.x, laneX)); i++) y1 = Math.max(E.y + rr, q.t - 16);
  for (let i = 0; i < 6 && (q = hHit(y2, laneX, N.x)); i++) y2 = Math.min(N.y - rr, q.b + 16);
  const d1 = Math.sign(laneX - E.x) || -1, d2 = Math.sign(N.x - laneX) || 1;
  return `M${E.x} ${E.y}V${y1 - rr}Q${E.x} ${y1} ${E.x + d1 * rr} ${y1}H${laneX - d1 * rr}Q${laneX} ${y1} ${laneX} ${y1 + rr}V${y2 - rr}Q${laneX} ${y2} ${laneX + d2 * rr} ${y2}H${N.x - d2 * rr}Q${N.x} ${y2} ${N.x} ${y2 + rr}V${N.y}`;
}

function buildThread() {
  const docH = document.documentElement.scrollHeight;
  thread.setAttribute('width', innerWidth);
  thread.setAttribute('height', docH);
  thread.setAttribute('viewBox', `0 0 ${innerWidth} ${docH}`);
  thread.style.height = docH + 'px';
  thread.replaceChildren();
  connectors = [];
  const sy = scrollY;
  const rects = [...document.querySelectorAll(obstacleSel)].map(el => {
    const b = el.getBoundingClientRect();
    return { l: b.left, r: b.right, t: b.top + sy, b: b.bottom + sy };
  });
  const wrap = document.querySelector('.wrap').getBoundingClientRect();
  const gutter = parseFloat(getComputedStyle(document.querySelector('.wrap')).paddingLeft);
  const laneX = Math.max(10, wrap.left + gutter / 2);
  const ordered = scenes.filter(s => !s.slot.hidden).sort((a, b) => a.slot.compareDocumentPosition(b.slot) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const points = ordered.map(anchorsOf);
  // the line ends by becoming the hand-drawn underline under the email
  const sign = document.querySelector('.contact__sign') || document.querySelector('.contact__email');
  if (sign) {
    const b = sign.getBoundingClientRect();
    points.push({ entry: { x: laneX, y: b.top + sy + b.height * 0.65, tail: b.left + 2 }, exit: null }); // the underline path starts at y 26 of 40
  }
  for (let i = 0; i < points.length - 1; i++) {
    const E = points[i].exit, N = points[i + 1].entry;
    if (!E || !N || N.y <= E.y) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', route(E, N, rects, laneX));
    path.setAttribute('pathLength', '1');
    path.style.strokeDasharray = '1';
    path.style.strokeDashoffset = reduced ? '0' : '1';
    thread.append(path);
    connectors.push({ path, y0: E.y, y1: N.y });
  }
  queue();
}

function drawThread() {
  if (reduced) return;
  // near the end of the page the anchor slides to the bottom edge, so the last stretch can finish drawing
  const maxY = document.documentElement.scrollHeight - innerHeight;
  const near = clamp((scrollY - (maxY - innerHeight)) / innerHeight);
  const anchor = scrollY + innerHeight * (0.62 + 0.38 * near);
  for (const c of connectors) {
    const t = clamp((anchor - c.y0) / (c.y1 - c.y0));
    c.path.style.strokeDashoffset = String(1 - t);
  }
}

/* ---------- frame loop ---------- */
let pending = false;
function queue() { if (!pending) { pending = true; requestAnimationFrame(frame); } }
function frame() {
  pending = false;
  onScrollHeader();
  for (const s of scenes) {
    if (!s.visible) continue;
    const p = sectionProgress(s.slot.closest('section') || s.slot);
    if (Math.abs(p - s.p) > 0.0005) { s.p = p; s.api.update(p); }
  }
  drawThread();
  const tl = document.querySelector('.timeline');
  if (tl && !reduced) {
    const r = tl.getBoundingClientRect();
    tl.style.setProperty('--tl', clamp((innerHeight * 0.75 - r.top) / r.height).toFixed(3));
  }
}
addEventListener('scroll', queue, { passive: true });

let rebuildTimer;
function scheduleRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(buildThread, 120); }
addEventListener('resize', scheduleRebuild);
new ResizeObserver(scheduleRebuild).observe(document.querySelector('main'));

Promise.all(slots.map(mountScene)).then(() => {
  scenes.forEach(s => { s.p = sectionProgress(s.slot.closest('section') || s.slot); s.api.update(reduced ? 0.6 : s.p); });
  buildThread();
  root.dataset.ready = '1';
});
if (document.fonts) document.fonts.ready.then(scheduleRebuild);
addEventListener('load', scheduleRebuild);
