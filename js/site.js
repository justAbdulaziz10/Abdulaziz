// One line — page shell: worlds, scenes, the connecting thread, small interactions.
import './tools.js';
import { signature, toD } from '../scenes/sign.js';
import { activateAudio, getAudioContext, getAudioOutput, isOn } from './sound.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const body = document.body;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const SCROLL_TAU = 90;

/* ---------- hero entrance ---------- */
const hero = document.querySelector('.hero');
const startHero = () => requestAnimationFrame(() => hero.classList.add('is-in'));
(document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]) : Promise.resolve()).then(startHero);

/* ---------- worlds ---------- */
const worldSections = [...document.querySelectorAll('main [data-world]')];
const worldRecords = worldSections.map(el => ({
  el, world: el.dataset.world, top: 0, left: 0, width: 0, height: 0,
  firstEntry: null, entry: null, radius: 0, lastRadius: NaN, lastReady: null,
}));
const worldRecordOf = new Map(worldRecords.map(rec => [rec.el, rec]));
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
let navTargetTops = navTargets.map(() => Infinity);
let headerHalf = 34;

// phones: Menu opens the section links under the bar; a pick, a tap outside or Escape closes it
const menuBtn = top.querySelector('.top__menu');
function setMenu(open) {
  top.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? 'Close' : 'Menu';
}
menuBtn.addEventListener('click', () => setMenu(!top.classList.contains('is-open')));
navLinks.forEach(a => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && top.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
});
addEventListener('pointerdown', e => { if (top.classList.contains('is-open') && !top.contains(e.target)) setMenu(false); });
matchMedia('(min-width: 761px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
function onScrollHeader() {
  const y = scrollY;
  top.toggleAttribute('data-scrolled', y > 24);
  const goingDown = y > lastY && y > 400;
  top.toggleAttribute('data-hidden', goingDown && !top.contains(document.activeElement) && !top.classList.contains('is-open'));
  lastY = y;
  // the header takes the colours of the section right under it, not the one in the middle of the screen
  const under = y + headerHalf;
  const rec = worldRecords.find(r => r.height && under >= r.top && under < r.top + r.height);
  const world = rec ? rec.world : 'paper';
  if (top.dataset.world !== world) top.dataset.world = world;
  const mid = y + cachedViewportHeight * 0.4;
  let current = -1;
  navTargetTops.forEach((t, i) => { if (t < mid) current = i; });
  navLinks.forEach((a, i) => a.toggleAttribute('aria-current', i === current));
}

/* ---------- reveals ---------- */
const revealElements = [...document.querySelectorAll('.shot, .progress, .contact')];
const revealRecords = revealElements.map(el => ({ el, top: 0, height: 0 }));
let revealFallback = false;
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
}, { rootMargin: '0px 0px -15% 0px' });
function useRevealFallback() {
  if (revealFallback) return;
  revealFallback = true;
  revealRecords.forEach(({ el }) => { if (!el.classList.contains('is-in')) revealIO.observe(el); });
}
function updateArrivalReveals(anchor) {
  for (const rec of revealRecords) {
    if (!rec.el.classList.contains('is-in') && anchor >= rec.top + rec.height * 0.12) rec.el.classList.add('is-in');
  }
}
if (reduced) revealElements.forEach(el => revealIO.observe(el));

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
  // printing mid-count would put "0" on the CV; jump to the real figure
  addEventListener('beforeprint', () => { io.disconnect(); counter.textContent = fmt.format(+counter.dataset.count); });
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
const titles = [...document.querySelectorAll('.project__name')].map(el => ({
  el, section: el.closest('section'), world: worldRecordOf.get(el.closest('section')),
  kind: el.closest('section')?.id, lastT: NaN, lastStyle: '',
}));
const timeline = document.querySelector('.timeline');
let cachedDocumentHeight = document.documentElement.scrollHeight;
let cachedViewportHeight = innerHeight;
let cachedViewportWidth = innerWidth;
let timelineLayout = null;
let lastFrameTime = 0;
let lastMotionScrollY = scrollY;
let smoothY = scrollY;
let maraBeatPhase = 0;
let maraPulse = 0;

if (!reduced) for (const rec of worldRecords) {
  if (rec.world === 'paper') continue;
  rec.el.style.setProperty('--world-radius', '0px');
  rec.el.style.setProperty('--world-content-opacity', '0');
}

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
    const rec = { slot, el, api, visible: false, p: -1, section: null, top: 0, height: 0 };
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

function sectionProgress(top, height, y = scrollY, viewportHeight = cachedViewportHeight) {
  return clamp((viewportHeight - (top - y)) / (height + viewportHeight));
}

/* ---------- the thread: one line connecting every scene ---------- */
const NS = 'http://www.w3.org/2000/svg';
const footSignSvg = document.querySelector('.foot__sign');
const footSignature = footSignSvg ? signature() : null;
let footSignPath = null, footSignDot = null, footerVisibleOnArrival = null;
if (footSignSvg && footSignature) {
  const bw = footSignature.box.x1 - footSignature.box.x0;
  const bh = footSignature.box.y1 - footSignature.box.y0;
  footSignSvg.setAttribute('viewBox', `0 0 ${bw} ${bh}`);
  footSignPath = footSignSvg.querySelector('.foot__sign-path');
  footSignDot = footSignSvg.querySelector('.foot__sign-dot');
  footSignPath.setAttribute('d', toD(footSignature.segs, p => ({ x: p.x - footSignature.box.x0, y: p.y - footSignature.box.y0 })));
  footSignPath.setAttribute('pathLength', '1');
  footSignPath.style.strokeDasharray = '1';
  footSignPath.style.strokeDashoffset = reduced ? '0' : '1';
  footSignDot.setAttribute('cx', (footSignature.dot.x - footSignature.box.x0).toFixed(2));
  footSignDot.setAttribute('cy', (footSignature.dot.y - footSignature.box.y0).toFixed(2));
  footSignDot.style.opacity = reduced ? '1' : '0';
}
const thread = document.createElementNS(NS, 'svg');
thread.classList.add('thread');
thread.setAttribute('aria-hidden', 'true');
const main = document.querySelector('main');
main.prepend(thread);
const threadInteraction = document.createElementNS(NS, 'svg');
threadInteraction.classList.add('thread__interaction');
threadInteraction.setAttribute('aria-hidden', 'true');
main.append(threadInteraction);
const nib = document.createElementNS(NS, 'circle');
nib.classList.add('thread__nib', 'is-away');
nib.setAttribute('r', '3.2');
thread.append(nib);
// while the line is pulled, this mask cuts the resting stretch out of the thread so only the pulled copy shows
const pullMask = document.createElementNS(NS, 'mask');
pullMask.id = 'thread-pull-cut';
pullMask.setAttribute('maskUnits', 'userSpaceOnUse');
pullMask.innerHTML = '<rect x="-100000" y="-100000" width="300000" height="10000000" fill="#fff"/><path fill="none" stroke="#000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
const pullMaskCut = pullMask.lastChild;
const pullDefs = document.createElementNS(NS, 'defs');
pullDefs.append(pullMask);
thread.prepend(pullDefs);
const setPullMask = (on) => {
  for (const child of thread.children) if (child !== pullDefs) {
    if (on) child.setAttribute('mask', 'url(#thread-pull-cut)');
    else child.removeAttribute('mask');
  }
};
const pulsePath = document.createElementNS(NS, 'path');
pulsePath.classList.add('thread__pulse');
const pullPath = document.createElementNS(NS, 'path');
pullPath.classList.add('thread__pull');
threadInteraction.append(pulsePath, pullPath);
const threadStatus = document.createElement('p');
threadStatus.className = 'thread__status';
threadStatus.setAttribute('role', 'status');
threadStatus.setAttribute('aria-live', 'polite');
document.querySelector('main').prepend(threadStatus);
let connectors = []; // { path, length, y0, y1 }
let lastNibPoint = null;
let oldThreadGroup = null;
let hasBuiltThread = false;
let threadSamples = [];
let threadSegments = [];
let threadSegmentIds = [];
let threadSegmentRanges = [];
let threadRouteSegments = [];
let threadDistances = [];
let threadRouteLength = 0;
let heartbeatCount = null;
let heartbeatReady = false;
let heartbeatTimer = 0;
let heartbeatAnimation = null;
let pullState = null;
const PULSE_SIZE = 48;
const PULSE_REST = 5200;
const MAX_PULL = 34;
const PULL_SPAN = 140;

const obstacleSel = '.project__text, .project__live, .project--pitlane .project__name, .pm, .section-title, .year__title, .year__sub, .lab, .off__caption, .off__meta, .exp__lead, .timeline, .more__list, .notes__groups, .skills__grid, .learn, .hero__inner, .contact__title, .contact__body, .contact__links, .foot__credits, .shot';

function pseudoCenter(el, pseudo) {
  const s = getComputedStyle(el, pseudo);
  if (s.display === 'none' || s.content === 'none') return null;
  const r = el.getBoundingClientRect();
  const px = v => Number.parseFloat(v) || 0;
  const w = px(s.width), h = px(s.height);
  if (!w || !h) return null;
  return { x: r.left + px(s.left) + w / 2, y: r.top + px(s.top) + h / 2 + scrollY };
}

function flowAnchorsFor(rec) {
  if (!root.classList.contains('is-pm')) return null;
  const project = rec.slot.closest('.project');
  const pm = project?.querySelector('.pm');
  if (!pm || pm.hidden || !pm.classList.contains('is-open')) return null;
  const flow = pm.querySelector('.pm__flow');
  const stops = flow ? [...flow.children].filter(el => el.matches('li')) : [];
  if (!stops.length) return null;
  const entry = pseudoCenter(stops[0], '::after');
  const exit = pseudoCenter(stops[stops.length - 1], '::after');
  if (!entry || !exit) return null;
  return { entry, exit, flow: { pm, text: project.querySelector('.project__text') } };
}

function anchorsOf(rec) {
  const flow = flowAnchorsFor(rec);
  if (flow) return flow;
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

// how far a horizontal run of the thread stays from text above or below it
const CLEAR = 24;

function route(E, N, rects, laneX) {
  const hHit = (y, xa, xb) => rects.find(q => y > q.t - CLEAR + 4 && y < q.b + CLEAR - 4 && Math.max(xa, xb) > q.l - 12 && Math.min(xa, xb) < q.r + 12);
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
  const directOk = !blocked(E.x, E.y, midY, rects) && !blocked(N.x, midY, N.y, rects) && !rects.some(q => midY > q.t - CLEAR && midY < q.b + CLEAR && Math.max(E.x, N.x) > q.l && Math.min(E.x, N.x) < q.r);
  if (directOk) {
    const dir = Math.sign(N.x - E.x);
    return `M${E.x} ${E.y}V${midY - r}Q${E.x} ${midY} ${E.x + dir * r} ${midY}H${N.x - dir * r}Q${N.x} ${midY} ${N.x} ${midY + r}V${N.y}`;
  }
  // route through the margin lane, clear of text; the two horizontal legs slide until they miss every block
  const rr = Math.max(4, Math.min(40, (N.y - E.y) / 6, Math.abs(N.x - laneX) / 2 || 40, Math.abs(laneX - E.x) / 2 || 40));
  let y1 = E.y + Math.min(56, (N.y - E.y) / 5), y2 = N.y - Math.min(56, (N.y - E.y) / 5), q;
  for (let i = 0; i < 6 && (q = hHit(y1, E.x, laneX)); i++) y1 = Math.max(E.y + 4, q.t - CLEAR);
  for (let i = 0; i < 6 && (q = hHit(y2, laneX, N.x)); i++) y2 = Math.min(N.y - 4, q.b + CLEAR);
  // a leg squeezed into a short gap keeps its distance from the text and takes a tighter bend instead
  const r1 = Math.max(4, Math.min(rr, y1 - E.y)), r2 = Math.max(4, Math.min(rr, N.y - y2));
  const d1 = Math.sign(laneX - E.x) || -1, d2 = Math.sign(N.x - laneX) || 1;
  return `M${E.x} ${E.y}V${y1 - r1}Q${E.x} ${y1} ${E.x + d1 * r1} ${y1}H${laneX - d1 * r1}Q${laneX} ${y1} ${laneX} ${y1 + r1}V${y2 - r2}Q${laneX} ${y2} ${laneX + d2 * r2} ${y2}H${N.x - d2 * r2}Q${N.x} ${y2} ${N.x} ${y2 + r2}V${N.y}`;
}

// The Flow row's top and bottom rules: the thread rides along them, so it never crosses the "Flow" label.
function flowRow(flow) {
  const row = flow.pm.querySelector('.pm__flow')?.closest('dl > div');
  if (!row) return null;
  const b = row.getBoundingClientRect();
  const dt = row.querySelector('dt')?.getBoundingClientRect();
  return { top: b.top + scrollY, bottom: b.bottom + scrollY, dt: dt && { l: dt.left, r: dt.right } };
}

function routeFlowEntry(E, N, rects, laneX, flow) {
  // Down the margin lane, along the row's top rule to above the first dot, then down into it.
  const row = flowRow(flow);
  const y = row ? row.top : N.y;
  const lo = Math.min(laneX, N.x), hi = Math.max(laneX, N.x);
  const blockedLeg = rects.some(r => {
    if (r.el === flow.pm || r.el === flow.text) return false;
    return y > r.t - 12 && y < r.b + 12 && hi > r.l - 12 && lo < r.r + 12;
  });
  // stacked rows (narrow screens) put the "Flow" label right above the dots: enter from the side instead
  const labelAbove = row?.dt && N.x > row.dt.l - 8 && N.x < row.dt.r + 8;
  if (blockedLeg || !row || labelAbove || N.y - y < 4) return route(E, { x: laneX, y: N.y, tail: N.x }, rects, laneX);
  const r = Math.min(12, (N.y - y) / 2, Math.abs(N.x - laneX) / 2);
  const d = Math.sign(N.x - laneX) || 1;
  return route(E, { x: laneX, y, tail: N.x - d * r }, rects, laneX) + `Q${N.x} ${y} ${N.x} ${y + r}V${N.y}`;
}

function routeFlowExit(E, N, rects, laneX, flow, onward = S => route(S, N, rects, laneX)) {
  // Down from the last dot to the row's bottom rule, along it back to the lane, then on to the next anchor.
  const row = flowRow(flow);
  const y = row && row.bottom - E.y >= 4 ? row.bottom : E.y;
  const lo = Math.min(E.x, laneX), hi = Math.max(E.x, laneX);
  const blockedLeg = rects.some(r => {
    if (r.el === flow.pm || r.el === flow.text) return false;
    return y > r.t - 12 && y < r.b + 12 && hi > r.l - 12 && lo < r.r + 12;
  });
  if (blockedLeg) return onward(E);
  const dir = Math.sign(laneX - E.x) || -1;
  const r = Math.max(1, Math.min(32, (N.y - y) / 6, Math.abs(E.x - laneX) / 2 || 32));
  const rd = Math.min(12, (y - E.y) / 2, Math.abs(E.x - laneX) / 2);
  const down = y > E.y ? `M${E.x} ${E.y}V${y - rd}Q${E.x} ${y} ${E.x + dir * rd} ${y}` : `M${E.x} ${E.y}`;
  const out = `${down}H${laneX - dir * r}Q${laneX} ${y} ${laneX} ${y + r}`;
  // Start the next leg at the lane corner, keeping every segment's y monotonic.
  return out + onward({ x: laneX, y: y + r });
}

function routeSignOff(E, N) {
  // From the end of the email underline: straight down beside the contact block, across the gap above the
  // footer, then down into the signature's first stroke. The column at E.x is right of the links and left of
  // the copy button at every width, so only the horizontal height needs choosing.
  const below = ['.contact__mail', '.contact__links'].map(s => document.querySelector(s)).filter(Boolean)
    .reduce((m, el) => Math.max(m, el.getBoundingClientRect().bottom + scrollY), E.y);
  const foot = document.querySelector('.foot');
  const footTop = foot ? foot.getBoundingClientRect().top + scrollY : N.y;
  const y = Math.min((below + footTop) / 2, N.y - 16);
  const r = Math.max(2, Math.min(24, (y - E.y) / 2, (N.y - y) / 2, Math.abs(N.x - E.x) / 2));
  const d = Math.sign(N.x - E.x) || -1;
  return `M${E.x} ${E.y}V${y - r}Q${E.x} ${y} ${E.x + d * r} ${y}H${N.x - d * r}Q${N.x} ${y} ${N.x} ${y + r}V${N.y}`;
}

function footerSignAnchor() {
  if (!footSignSvg || !footSignature) return null;
  const b = footSignSvg.getBoundingClientRect();
  const first = footSignature.segs[0][0];
  const bw = footSignature.box.x1 - footSignature.box.x0;
  const bh = footSignature.box.y1 - footSignature.box.y0;
  // The SVG viewBox is exactly the signature bounds, so this maps its M point to page space.
  return {
    x: b.left + (first.x - footSignature.box.x0) / bw * b.width,
    y: b.top + scrollY + (first.y - footSignature.box.y0) / bh * b.height,
  };
}

function pathCrossingAtY(path, y) {
  try {
    let lo = 0, hi = path.getTotalLength();
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (path.getPointAtLength(mid).y < y) lo = mid;
      else hi = mid;
    }
    return path.getPointAtLength((lo + hi) / 2);
  } catch {
    return null;
  }
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function nearViewport(topY, height, y, viewportHeight) {
  return topY < y + viewportHeight && topY + height > y;
}

function updateWorldState(rec, y, viewportHeight, force = false) {
  if (!force && !nearViewport(rec.top, rec.height, y, viewportHeight)) return;
  const nightPaper = root.classList.contains('is-night') && rec.world === 'paper';
  const progress = reduced || nightPaper ? 1 : smoothstep(clamp((viewportHeight - (rec.top - y)) / (viewportHeight * 0.3)));
  const radius = progress >= 1 ? rec.radius : rec.radius * progress;
  if (!(Math.abs(radius - rec.lastRadius) <= 0.5)) { // lastRadius starts as NaN, which must count as changed
    rec.el.style.setProperty('--world-radius', `${radius.toFixed(1)}px`);
    rec.lastRadius = radius;
  }
  const ready = progress >= 1;
  if (rec.world !== 'paper' && ready !== rec.lastReady) {
    rec.el.style.setProperty('--world-content-opacity', ready ? '1' : '0');
    rec.lastReady = ready;
  }
}

function updateTitleState(rec, y, viewportHeight, force = false) {
  if (reduced || !rec.world) return;
  const world = rec.world;
  const near = nearViewport(world.top, world.height, y, viewportHeight);
  if (!force && !near && rec.kind !== 'mara') return;
  const p = sectionProgress(world.top, world.height, y, viewportHeight);
  if (near && Math.abs(p - rec.lastT) > 0.004) {
    rec.el.style.setProperty('--t', p.toFixed(3));
    rec.lastT = p;
  }

  let width = 118, weight = 800, tracking = -0.035;
  let echoA = '0 0 0 transparent', echoB = '0 0 0 transparent';
  if (rec.kind === 'mara') {
    weight = 800 + 100 * maraPulse;
  } else if (rec.kind === 'echo') {
    const spread = Math.sin(Math.PI * p);
    const offset = 1 + spread * 9;
    const alpha = spread * 15;
    echoA = `${offset.toFixed(1)}px 0 1px color-mix(in srgb, var(--accent) ${alpha.toFixed(1)}%, transparent)`;
    echoB = `${(-offset).toFixed(1)}px 1px 1px color-mix(in srgb, var(--accent) ${(alpha * 0.7).toFixed(1)}%, transparent)`;
  } else if (rec.kind === 'daleelk') {
    width = 85 + 33 * smoothstep(clamp(p / 0.55));
  } else if (rec.kind === 'rassah') {
    tracking = 0.04 - 0.075 * smoothstep(clamp(p / 0.55));
  } else if (rec.kind === 'pitlane') {
    const stretch = cachedViewportWidth <= 640 ? 8 : cachedViewportWidth <= 1100 ? 18 : 33;
    width = 92 + stretch * p;
    tracking = -0.035 - 0.02 * p;
  }
  const style = `${width.toFixed(2)}|${weight.toFixed(1)}|${tracking.toFixed(4)}|${echoA}|${echoB}`;
  if (style === rec.lastStyle) return;
  rec.el.style.setProperty('--name-width', `${width.toFixed(2)}%`);
  rec.el.style.setProperty('--name-weight', weight.toFixed(1));
  rec.el.style.setProperty('--name-tracking', `${tracking.toFixed(4)}em`);
  rec.el.style.setProperty('--echo-shadow-a', echoA);
  rec.el.style.setProperty('--echo-shadow-b', echoB);
  rec.lastStyle = style;
}

function cacheMotionLayout(sy, docH) {
  cachedDocumentHeight = docH;
  cachedViewportHeight = innerHeight;
  cachedViewportWidth = innerWidth;
  navTargetTops = navTargets.map(target => target ? target.getBoundingClientRect().top + sy : Infinity);
  headerHalf = top.offsetHeight / 2;
  for (const rec of revealRecords) {
    const r = rec.el.getBoundingClientRect();
    rec.top = r.top + sy;
    rec.height = r.height;
  }
  if (footSignSvg && footerVisibleOnArrival === null) {
    const r = footSignSvg.getBoundingClientRect();
    footerVisibleOnArrival = r.top < cachedViewportHeight && r.bottom > 0;
  }
  if (timeline) {
    const r = timeline.getBoundingClientRect();
    timelineLayout = { top: r.top + sy, height: r.height };
  } else timelineLayout = null;
  for (const rec of worldRecords) {
    const r = rec.el.getBoundingClientRect();
    rec.top = r.top + sy;
    rec.left = r.left;
    rec.width = r.width;
    rec.height = r.height;
    rec.firstEntry = null;
    rec.entry = null;
  }
  for (const rec of scenes) {
    rec.section = rec.slot.closest('section') || rec.slot;
    const r = rec.section.getBoundingClientRect();
    rec.top = r.top + sy;
    rec.height = r.height;
  }
}

function recordFirstSceneEntries(ordered, points) {
  ordered.forEach((scene, i) => {
    const world = worldRecordOf.get(scene.slot.closest('section'));
    if (world && !world.firstEntry) world.firstEntry = {
      x: points[i].entry.x - world.left,
      y: points[i].entry.y - world.top,
    };
  });
}

function recordFloodCrossings(path, E, N) {
  for (const world of worldRecords) {
    if (world.entry || world.top < E.y || world.top > N.y) continue;
    const crossing = pathCrossingAtY(path, world.top);
    if (crossing) world.entry = { x: crossing.x - world.left, y: crossing.y - world.top };
  }
}

function finishWorldLayout(y) {
  for (const world of worldRecords) {
    world.entry ||= world.firstEntry || { x: world.width / 2, y: 0 };
    world.entry.x = clamp(world.entry.x, 0, world.width);
    world.entry.y = clamp(world.entry.y, 0, world.height);
    world.radius = Math.max(
      Math.hypot(world.entry.x, world.entry.y),
      Math.hypot(world.width - world.entry.x, world.entry.y),
      Math.hypot(world.entry.x, world.height - world.entry.y),
      Math.hypot(world.width - world.entry.x, world.height - world.entry.y),
    ) + 2;
    world.el.style.setProperty('--world-x', `${world.entry.x.toFixed(1)}px`);
    world.el.style.setProperty('--world-y', `${world.entry.y.toFixed(1)}px`);
    world.lastRadius = NaN;
    world.lastReady = null;
    updateWorldState(world, y, cachedViewportHeight, true);
  }
}

function pathPageSamples(path) {
  let length, matrix;
  try {
    length = path.getTotalLength();
    matrix = path.getScreenCTM();
  } catch { return []; }
  if (!length || !matrix) return [];
  const steps = Math.max(1, Math.ceil(length / 10));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const local = path.getPointAtLength(length * i / steps);
    const screen = new DOMPoint(local.x, local.y).matrixTransform(matrix);
    points.push({ x: screen.x + scrollX, y: screen.y + scrollY });
  }
  return points;
}

function appendThreadSamples(path) {
  let points = pathPageSamples(path);
  if (!points.length) return;
  let segment = threadSegments.at(-1);
  const last = segment?.at(-1);
  if (last) {
    const firstGap = Math.hypot(points[0].x - last.x, points[0].y - last.y);
    const lastGap = Math.hypot(points.at(-1).x - last.x, points.at(-1).y - last.y);
    if (lastGap < firstGap) points.reverse();
    const gap = Math.hypot(points[0].x - last.x, points[0].y - last.y);
    if (gap > 64) segment = null;
  }
  if (!segment) { segment = []; threadSegments.push(segment); }
  const segmentId = threadSegments.length - 1;
  for (const point of points) {
    const previous = segment.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5) {
      segment.push(point);
      threadSamples.push(point);
      threadSegmentIds.push(segmentId);
    }
  }
}

function sceneThreadPaths(rec) {
  const paths = [...rec.el.querySelectorAll('path')].filter(path => {
    if (path.getAttribute('pathLength') !== '1' && path.getAttribute('pathlength') !== '1') return false;
    return [...path.classList].some(name => name === 'tl-groove-line' ||
      (/(?:^|[_-])(?:line|thread)$/.test(name) && !/label|page/.test(name)));
  });
  return paths.some(path => path.classList.contains('tb-thread'))
    ? paths.filter(path => path.classList.contains('tb-thread'))
    : paths;
}

function finishPulseRoute() {
  threadDistances = new Array(threadSamples.length);
  threadRouteLength = 0;
  threadRouteSegments = [];
  threadSegmentRanges = [];
  let flatIndex = 0;
  for (let segmentId = 0; segmentId < threadSegments.length; segmentId++) {
    const points = threadSegments[segmentId];
    if (points.length < 2) { flatIndex += points.length; continue; }
    let length = 0;
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      distances.push(length);
      threadDistances[flatIndex + i] = threadRouteLength + length;
    }
    threadDistances[flatIndex] = threadRouteLength;
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    threadRouteSegments.push({ points, distances, length, d });
    threadSegmentRanges[segmentId] = { start: flatIndex, end: flatIndex + points.length - 1 };
    threadRouteLength += length;
    flatIndex += points.length;
  }
  if (!threadRouteSegments.length || !threadRouteLength) {
    pulsePath.setAttribute('d', '');
    pulsePath.style.opacity = '0';
    heartbeatReady = true;
    if (heartbeatCount > 0) scheduleHeartbeat(0);
    return;
  }
  pulsePath.setAttribute('d', threadRouteSegments[0].d);
  pulsePath.style.strokeDasharray = `${PULSE_SIZE} ${threadRouteSegments[0].length + PULSE_SIZE}`;
  pulsePath.style.strokeDashoffset = '0';
  pulsePath.style.opacity = '0';
  heartbeatReady = true;
  if (heartbeatCount > 0) scheduleHeartbeat(0);
}

function distanceAtSegmentY(segment, y, after = 0) {
  for (let i = 1; i < segment.points.length; i++) {
    const a = segment.points[i - 1], b = segment.points[i];
    if (segment.distances[i] < after || (y - a.y) * (y - b.y) > 0) continue;
    const dy = b.y - a.y;
    const t = Math.abs(dy) < 0.001 ? 0 : clamp((y - a.y) / dy);
    const distance = segment.distances[i - 1] + (segment.distances[i] - segment.distances[i - 1]) * t;
    if (distance >= after) return distance;
  }
  return null;
}

function pulseWindow() {
  const topY = scrollY;
  const bottomY = Math.min(topY + cachedViewportHeight, threadAnchor(smoothY, cachedViewportHeight));
  let best = null;
  for (const segment of threadRouteSegments) {
    const start = distanceAtSegmentY(segment, topY);
    const end = start === null ? null : distanceAtSegmentY(segment, bottomY, start);
    if (start !== null && end !== null && end - start > (best?.end - best?.start || 0)) best = { segment, start, end };
  }
  return best && best.end > best.start ? best : null;
}

function clearHeartbeat() {
  clearTimeout(heartbeatTimer);
  heartbeatTimer = 0;
  if (heartbeatAnimation) heartbeatAnimation.cancel();
  heartbeatAnimation = null;
  pulsePath.style.opacity = '0';
}

function animateHeartbeat() {
  if (reduced || document.hidden || !heartbeatReady || !(heartbeatCount > 0) || !threadRouteSegments.length) return;
  const range = pulseWindow();
  if (!range) return;
  const span = range.end - range.start;
  const start = -range.start, end = -range.end;
  const duration = clamp(span * 1.1, 520, 980);
  pulsePath.setAttribute('d', range.segment.d);
  pulsePath.style.strokeDasharray = `${PULSE_SIZE} ${range.segment.length + PULSE_SIZE}`;
  pulsePath.style.opacity = '0';
  heartbeatAnimation = pulsePath.animate([
    { strokeDashoffset: String(start), opacity: 0 },
    { strokeDashoffset: String(start - span * 0.08), opacity: 0.92, offset: 0.08 },
    { strokeDashoffset: String(end + span * 0.08), opacity: 0.92, offset: 0.92 },
    { strokeDashoffset: String(end), opacity: 0 },
  ], { duration, easing: 'linear' });
  heartbeatAnimation.onfinish = () => {
    pulsePath.style.opacity = '0';
    heartbeatAnimation = null;
  };
}

function scheduleHeartbeat(delay = 0) {
  clearTimeout(heartbeatTimer);
  if (reduced || document.hidden || !heartbeatReady || !(heartbeatCount > 0)) return;
  let inBurst = 0;
  const count = heartbeatCount;
  const pulseDuration = clamp(7600 / count, 380, 880);
  const interval = Math.max(pulseDuration + 160, 7000 / count);
  const next = () => {
    if (document.hidden || reduced || !(heartbeatCount > 0)) return;
    animateHeartbeat();
    inBurst++;
    const wait = inBurst >= count ? Math.max(PULSE_REST, interval) : interval;
    if (inBurst >= count) inBurst = 0;
    heartbeatTimer = setTimeout(next, wait);
  };
  heartbeatTimer = setTimeout(next, delay);
}

function nearestThreadPoint(x, y, radius = Infinity, around = null) {
  const start = around === null ? 0 : Math.max(0, around - 28);
  const end = around === null ? threadSamples.length : Math.min(threadSamples.length, around + 29);
  let nearest = null, best = radius * radius;
  for (let i = start; i < end; i++) {
    const point = threadSamples[i];
    if (Math.abs(point.y - y) > radius) continue;
    const dx = point.x - x, dy = point.y - y, distance = dx * dx + dy * dy;
    if (distance < best) { best = distance; nearest = { index: i, point, distance: Math.sqrt(distance) }; }
  }
  return nearest;
}

function pullNormal(index) {
  const range = threadSegmentRanges[threadSegmentIds[index]];
  const before = threadSamples[Math.max(range?.start ?? 0, index - 1)];
  const after = threadSamples[Math.min(range?.end ?? threadSamples.length - 1, index + 1)];
  const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function drawPull(amplitude) {
  if (!pullState || Math.abs(amplitude) < 0.12) {
    pullPath.classList.remove('is-active');
    pullPath.style.opacity = '0';
    setPullMask(false);
    return;
  }
  const center = pullState.index;
  const range = threadSegmentRanges[threadSegmentIds[center]];
  const centerDistance = threadDistances[center] || 0;
  const from = Math.max(range?.start ?? 0, center - 28), to = Math.min(range?.end ?? threadSamples.length - 1, center + 28);
  const points = [], rest = [];
  for (let i = from; i <= to; i++) {
    const p = threadSamples[i], normal = pullNormal(i);
    rest.push(p);
    const along = (threadDistances[i] || 0) - centerDistance;
    const weight = Math.exp(-2.2 * (along / PULL_SPAN) ** 2);
    points.push({ x: p.x + normal.x * amplitude * weight, y: p.y + normal.y * amplitude * weight });
  }
  pullPath.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
  pullPath.style.opacity = '1';
  pullPath.classList.add('is-active');
  // cut all but the two ends, so the pulled copy joins the resting line without a seam
  pullMaskCut.setAttribute('d', rest.slice(2, -2).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
  setPullMask(true);
}

function clearPull() {
  pullState = null;
  pullPath.setAttribute('d', '');
  pullPath.style.opacity = '0';
  pullPath.classList.remove('is-active');
  setPullMask(false);
  body.classList.remove('thread-near', 'thread-pulling');
}

function updatePull(now) {
  if (!pullState || pullState.dragging) return;
  const elapsed = (now - pullState.releasedAt) / 1000;
  const amplitude = pullState.releaseAmplitude * Math.exp(-elapsed / 0.23) * Math.cos(elapsed * Math.PI * 2 * 5.2);
  if (elapsed > 0.92 || Math.abs(amplitude) < 0.22) { clearPull(); return; }
  drawPull(amplitude);
}

function pluckThread(amplitude) {
  if (!isOn()) return;
  const ctx = getAudioContext(), out = getAudioOutput();
  if (!ctx || !out || Math.abs(amplitude) < 1.8) return;
  const frequency = 440 - clamp(Math.abs(amplitude) / MAX_PULL) * 220;
  const now = ctx.currentTime + 0.01;
  for (const [multiplier, level] of [[1, 0.048], [2, 0.012], [3, 0.005]]) {
    const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency * multiplier;
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level * clamp(Math.abs(amplitude) / MAX_PULL, 0.2, 1), now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.74);
  }
}

function pullInteractive(target) {
  return Boolean(target.closest?.('a, button, input, textarea, select, summary, [contenteditable="true"], [role="button"], [data-interactive], [tabindex]:not([tabindex="-1"])'));
}

function onThreadPointerMove(event) {
  if (!matchMedia('(pointer: fine)').matches || reduced) return;
  const x = event.clientX + scrollX, y = event.clientY + scrollY;
  if (pullState?.dragging && event.pointerId === pullState.pointerId) {
    event.preventDefault();
    const hit = nearestThreadPoint(x, y, Infinity, pullState.index) || nearestThreadPoint(x, y);
    if (hit) {
      pullState.index = hit.index;
      const normal = pullNormal(hit.index);
      pullState.amplitude = clamp((x - hit.point.x) * normal.x + (y - hit.point.y) * normal.y, -MAX_PULL, MAX_PULL);
      drawPull(pullState.amplitude);
      queue();
    }
    return;
  }
  if (pullInteractive(event.target)) { body.classList.remove('thread-near'); return; }
  const drawnTo = threadAnchor(smoothY, cachedViewportHeight);
  const hit = y <= drawnTo + 14 ? nearestThreadPoint(x, y, 14) : null;
  body.classList.toggle('thread-near', Boolean(hit));
}

function onThreadPointerDown(event) {
  if (!matchMedia('(pointer: fine)').matches || reduced || event.button !== 0 || !event.isPrimary) return;
  const selection = getSelection();
  if (pullInteractive(event.target) || (selection && !selection.isCollapsed)) return;
  const x = event.clientX + scrollX, y = event.clientY + scrollY;
  if (y > threadAnchor(smoothY, cachedViewportHeight) + 14) return;
  const hit = nearestThreadPoint(x, y, 14);
  if (!hit) return;
  event.preventDefault();
  pullState = { pointerId: event.pointerId, index: hit.index, amplitude: 0, dragging: true };
  body.classList.add('thread-pulling');
  if (isOn()) activateAudio();
  event.target.setPointerCapture?.(event.pointerId);
}

function releaseThreadPull(event, playSound = true) {
  if (!pullState?.dragging || (event && event.pointerId !== pullState.pointerId)) return;
  event?.preventDefault();
  pullState.dragging = false;
  pullState.releasedAt = performance.now();
  pullState.releaseAmplitude = pullState.amplitude;
  body.classList.remove('thread-pulling', 'thread-near');
  if (playSound && isOn()) pluckThread(pullState.amplitude);
  queue();
}

const canPullThread = matchMedia('(pointer: fine)').matches && !reduced;
if (canPullThread) {
  addEventListener('pointermove', onThreadPointerMove, { passive: false });
  addEventListener('pointerdown', onThreadPointerDown, { passive: false });
  addEventListener('pointerup', releaseThreadPull, { passive: false });
  addEventListener('pointercancel', event => releaseThreadPull(event, false), { passive: false });
}

const GITHUB_EVENTS_URL = 'https://api.github.com/users/justAbdulaziz10/events/public?per_page=100';
const GITHUB_CACHE_KEY = 'one-github-events-v1';
const GITHUB_CACHE_AGE = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function cachedGitHubEvents() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(GITHUB_CACHE_KEY) || 'null');
    const age = cached ? Date.now() - cached.savedAt : -1;
    return cached && age >= 0 && age < GITHUB_CACHE_AGE && Array.isArray(cached.events) ? cached.events : null;
  } catch { return null; }
}

async function fetchGitHubEvents() {
  const cached = cachedGitHubEvents();
  if (cached) return cached;
  const response = await fetch(GITHUB_EVENTS_URL, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (!response.ok) throw new Error('GitHub activity is unavailable');
  const events = await response.json();
  if (!Array.isArray(events)) throw new Error('GitHub activity is unavailable');
  const compact = events.map(event => ({ type: event.type, created_at: event.created_at }));
  try { sessionStorage.setItem(GITHUB_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events: compact })); }
  catch { /* The live count still works when session storage is full. */ }
  return compact;
}

function countRecentPushEvents(events, now = Date.now()) {
  const cutoff = now - DAY;
  return events.filter(event => {
    if (event.type !== 'PushEvent') return false;
    const created = Date.parse(event.created_at);
    return Number.isFinite(created) && created >= cutoff && created <= now;
  }).length;
}

async function localPushCount(now = Date.now()) {
  const response = await fetch(new URL('../assets/data/live.json', import.meta.url));
  if (!response.ok) throw new Error('Local activity is unavailable');
  const data = await response.json();
  const cutoff = now - DAY;
  return (data.week?.items || []).reduce((sum, item) => {
    if (item.kind !== 'push') return sum;
    const created = Date.parse(item.date);
    if (!Number.isFinite(created) || created < cutoff || created > now) return sum;
    return sum + Math.max(0, Math.floor(Number(item.count) || 0));
  }, 0); // these are commit counts, not pushes
}

async function updateHeartbeat() {
  let count = null, unit = ['push', 'pushes'];
  try { count = countRecentPushEvents(await fetchGitHubEvents()); }
  catch {
    try { count = await localPushCount(); unit = ['commit', 'commits']; }
    catch { /* Activity is optional; keep errors silent. */ }
  }
  if (count === null) return;
  heartbeatCount = count;
  threadStatus.textContent = `${count} ${unit[count === 1 ? 0 : 1]} to GitHub in the last 24 hours`;
  if (heartbeatReady) scheduleHeartbeat(0);
}

function onHeartbeatVisibility() {
  if (document.hidden) { clearHeartbeat(); clearPull(); }
  else if (heartbeatCount > 0) scheduleHeartbeat(0);
}

document.addEventListener('visibilitychange', onHeartbeatVisibility);
void updateHeartbeat();

function buildThread() {
  clearHeartbeat();
  heartbeatReady = false;
  const docH = document.documentElement.scrollHeight;
  thread.setAttribute('width', innerWidth);
  thread.setAttribute('height', docH);
  thread.setAttribute('viewBox', `0 0 ${innerWidth} ${docH}`);
  thread.style.height = docH + 'px';
  threadInteraction.setAttribute('width', innerWidth);
  threadInteraction.setAttribute('height', docH);
  threadInteraction.setAttribute('viewBox', `0 0 ${innerWidth} ${docH}`);
  threadInteraction.style.height = docH + 'px';
  oldThreadGroup?.remove();
  oldThreadGroup = null;
  const previousPaths = [...thread.children].filter(el => el.localName === 'path' && el !== pulsePath && el !== pullPath);
  previousPaths.forEach(path => path.classList.remove('thread__new', 'is-in'));
  const crossfade = hasBuiltThread && !reduced && previousPaths.length > 0;
  if (crossfade) {
    oldThreadGroup = document.createElementNS(NS, 'g');
    oldThreadGroup.classList.add('thread__old');
    previousPaths.forEach(path => oldThreadGroup.append(path));
    thread.append(oldThreadGroup);
  } else previousPaths.forEach(path => path.remove());
  connectors = [];
  threadSamples = [];
  threadSegments = [];
  threadSegmentIds = [];
  threadSegmentRanges = [];
  threadRouteSegments = [];
  threadDistances = [];
  threadRouteLength = 0;
  lastNibPoint = null;
  const sy = scrollY;
  cacheMotionLayout(sy, docH);
  const rects = [...document.querySelectorAll(obstacleSel)].map(el => {
    const b = el.getBoundingClientRect();
    return { el, l: b.left, r: b.right, t: b.top + sy, b: b.bottom + sy };
  }).filter(r => r.b > r.t && r.r > r.l);
  const wrap = document.querySelector('.wrap').getBoundingClientRect();
  const gutter = parseFloat(getComputedStyle(document.querySelector('.wrap')).paddingLeft);
  const laneX = Math.max(10, wrap.left + gutter / 2);
  const ordered = scenes.filter(s => !s.slot.hidden).sort((a, b) => a.slot.compareDocumentPosition(b.slot) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const points = ordered.map(anchorsOf);
  recordFirstSceneEntries(ordered, points);
  // The contact underline's authored path starts at (2,26) and ends at (598,14) in a 600×40 viewBox.
  const sign = document.querySelector('.contact__sign');
  if (sign) {
    const b = sign.getBoundingClientRect();
    const sx = b.width / 600, sySign = b.height / 40;
    points.push({
      entry: { x: laneX, y: b.top + sy + 26 * sySign, tail: b.left + 2 * sx },
      exit: { x: b.left + 598 * sx, y: b.top + sy + 14 * sySign },
    });
  }

  const footEntry = footerSignAnchor();
  if (footEntry) points.push({ entry: footEntry, exit: null, signOff: true });

  const newPaths = [];
  function addPath(d, y0, y1) {
    if (!d || y1 <= y0) return;
    // joined routes repeat their meeting point as a new M; keep one subpath so the dash draws in order
    d = d[0] + d.slice(1).replace(/M/g, 'L');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('pathLength', '1');
    path.style.strokeDasharray = '1';
    path.style.strokeDashoffset = reduced ? '0' : '1';
    if (crossfade) {
      path.classList.add('thread__new');
      newPaths.push(path);
    }
    thread.append(path);
    const length = path.getTotalLength();
    connectors.push({ path, length, y0, y1 });
    appendThreadSamples(path);
    // where the routed line crosses each section's top edge becomes that section's flood origin
    recordFloodCrossings(path, { y: y0 }, { y: y1 });
  }

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    if (i > 0) {
      const previous = points[i - 1];
      const E = previous.exit, N = current.entry;
      if (E && N && N.y > E.y) {
        // leaving a flow comes first (down to its bottom rule and out to the lane), whatever comes next
        const onward = S => (current.flow ? routeFlowEntry(S, N, rects, laneX, current.flow) : route(S, N, rects, laneX));
        const d = previous.flow
          ? routeFlowExit(E, N, rects, laneX, previous.flow, onward)
          : current.flow
            ? routeFlowEntry(E, N, rects, laneX, current.flow)
            : current.signOff
              ? routeSignOff(E, N)
              : route(E, N, rects, laneX);
        addPath(d, E.y, N.y);
      }
    }
    if (current.flow && current.exit.y > current.entry.y) {
      // The ::after centres share x, so the main thread runs straight through each station dot.
      addPath(`M${current.entry.x} ${current.entry.y}V${current.exit.y}`, current.entry.y, current.exit.y);
    }
    if (ordered[i]) sceneThreadPaths(ordered[i]).forEach(appendThreadSamples);
    else if (i === ordered.length && sign) {
      const signPath = sign.querySelector('path');
      if (signPath) appendThreadSamples(signPath);
    } else if (i > ordered.length && footSignPath) appendThreadSamples(footSignPath);
  }
  finishWorldLayout(reduced ? sy : smoothY);
  finishPulseRoute();
  for (const title of titles) updateTitleState(title, reduced ? sy : smoothY, cachedViewportHeight, true);
  thread.append(nib);
  threadInteraction.append(pulsePath, pullPath);
  if (!reduced) {
    if (connectors.length) {
      if (revealFallback) { revealIO.disconnect(); revealFallback = false; }
      updateArrivalReveals(threadAnchor(smoothY, cachedViewportHeight));
    } else useRevealFallback();
  }
  if (crossfade && oldThreadGroup) {
    const fadingGroup = oldThreadGroup;
    requestAnimationFrame(() => {
      if (!fadingGroup.isConnected) return;
      fadingGroup.classList.add('is-fading');
      newPaths.forEach(path => path.classList.add('is-in'));
    });
    const pathFadeListeners = [];
    const cleanup = () => {
      fadingGroup.remove();
      if (oldThreadGroup === fadingGroup) oldThreadGroup = null;
      newPaths.forEach(path => path.classList.remove('thread__new', 'is-in'));
      pathFadeListeners.forEach(([path, listener]) => path.removeEventListener('transitionend', listener));
    };
    fadingGroup.addEventListener('transitionend', e => {
      if (e.target === fadingGroup && e.propertyName === 'opacity') cleanup();
    });
    newPaths.forEach(path => {
      const listener = e => {
        if (e.target !== path || e.propertyName !== 'opacity') return;
        path.classList.remove('thread__new', 'is-in');
        path.removeEventListener('transitionend', listener);
      };
      pathFadeListeners.push([path, listener]);
      path.addEventListener('transitionend', listener);
    });
    setTimeout(cleanup, 1200);
  }
  hasBuiltThread = true;
  queue();
}

function threadAnchor(y, viewportHeight) {
  // near the end of the page the anchor slides to the bottom edge, so the last stretch can finish drawing
  const maxY = cachedDocumentHeight - viewportHeight;
  const near = clamp((y - (maxY - viewportHeight)) / viewportHeight);
  return y + viewportHeight * (0.62 + 0.38 * near);
}

function hideThreadNib() {
  lastNibPoint = null;
  nib.classList.remove('is-moving');
  nib.classList.add('is-away');
}

function drawThread(y = smoothY, viewportHeight = cachedViewportHeight) {
  if (reduced) { hideThreadNib(); return; }
  const anchor = threadAnchor(y, viewportHeight);
  let tip = null;
  for (const c of connectors) {
    const t = clamp((anchor - c.y0) / (c.y1 - c.y0));
    c.path.style.strokeDashoffset = String(1 - t);
    if (!tip && t > 0 && t < 1) tip = { connector: c, t };
  }
  if (tip) {
    const point = tip.connector.path.getPointAtLength(tip.t * tip.connector.length);
    if (point.x >= 0 && point.x <= cachedViewportWidth && point.y >= y && point.y <= y + viewportHeight) {
      nib.setAttribute('cx', point.x.toFixed(2));
      nib.setAttribute('cy', point.y.toFixed(2));
      const moved = !lastNibPoint || Math.hypot(point.x - lastNibPoint.x, point.y - lastNibPoint.y) > 0.001;
      lastNibPoint = { x: point.x, y: point.y };
      nib.classList.remove('is-away');
      nib.classList.toggle('is-moving', moved);
    } else hideThreadNib();
  } else hideThreadNib();
  if (connectors.length) updateArrivalReveals(anchor);
  if (footSignPath && footSignDot && footSignSvg) {
    const signMax = Math.max(0, cachedDocumentHeight - viewportHeight);
    const signStart = Math.max(0, signMax - viewportHeight);
    // Use the actual remaining scroll range when the page/footer is shorter than a viewport.
    const signProgress = footerVisibleOnArrival || signMax === 0
      ? 1
      : clamp((y - signStart) / Math.max(1, signMax - signStart));
    footSignPath.style.strokeDashoffset = String(1 - signProgress);
    footSignDot.style.opacity = signProgress >= 1 ? '1' : '0';
  }
}

/* ---------- frame loop ---------- */
let pending = false;
function queue() { if (!pending) { pending = true; requestAnimationFrame(frame); } }
function updateMaraPulse(dt, speed) {
  if (speed > 0.008) {
    const frequency = 1.1 + 2.8 * clamp(speed / 0.75);
    maraBeatPhase += dt * frequency * Math.PI * 2 / 1000;
    const beat = Math.pow(Math.max(0, Math.sin(maraBeatPhase)), 8);
    maraPulse = Math.max(beat * clamp(speed / 0.3), maraPulse * Math.exp(-dt / 115));
  } else maraPulse *= Math.exp(-dt / 115);
  if (maraPulse < 0.004) maraPulse = 0;
}

function frame(now) {
  pending = false;
  const y = scrollY;
  const viewportHeight = cachedViewportHeight;
  const dt = lastFrameTime ? Math.max(1, now - lastFrameTime) : 16.7;
  const pulseDt = Math.min(80, dt);
  const speed = Math.abs(y - lastMotionScrollY) / dt;
  lastFrameTime = now;
  lastMotionScrollY = y;
  onScrollHeader();
  if (reduced) smoothY = y;
  else {
    const delta = y - smoothY;
    if (Math.abs(delta) > viewportHeight * 1.5) smoothY = y;
    else {
      // the loop sleeps when idle, so the first frame after a pause has a huge dt; cap it to one or two frames
      smoothY += delta * (1 - Math.exp(-Math.min(dt, 34) / SCROLL_TAU));
      if (Math.abs(y - smoothY) <= 0.5) smoothY = y;
    }
  }
  if (!reduced) updateMaraPulse(pulseDt, speed);
  for (const world of worldRecords) updateWorldState(world, smoothY, viewportHeight);
  for (const title of titles) updateTitleState(title, smoothY, viewportHeight);
  for (const s of scenes) {
    if (!s.visible || !s.height) continue;
    const p = sectionProgress(s.top, s.height, smoothY, viewportHeight);
    if (Math.abs(p - s.p) > 0.0005) { s.p = p; s.api.update(p); }
  }
  drawThread(smoothY, viewportHeight);
  updatePull(now);
  if (timeline && timelineLayout?.height && !reduced) {
    timeline.style.setProperty('--tl', clamp((viewportHeight * 0.75 - (timelineLayout.top - smoothY)) / timelineLayout.height).toFixed(3));
  }
  if (!reduced && (Math.abs(y - smoothY) > 0.5 || maraPulse > 0 || nib.classList.contains('is-moving') || (pullState && !pullState.dragging))) queue();
}
addEventListener('scroll', () => {
  if (!pullState?.dragging) body.classList.remove('thread-near');
  queue();
}, { passive: true });

let rebuildTimer;
function scheduleRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(buildThread, 120); }
addEventListener('resize', scheduleRebuild);
new ResizeObserver(scheduleRebuild).observe(document.querySelector('main'));

Promise.all(slots.map(mountScene)).then(() => {
  buildThread();
  scenes.forEach(s => { s.p = sectionProgress(s.top, s.height, reduced ? scrollY : smoothY, cachedViewportHeight); s.api.update(reduced ? 0.6 : s.p); });
  root.dataset.ready = '1';
});
if (document.fonts) document.fonts.ready.then(scheduleRebuild);
addEventListener('load', scheduleRebuild);
