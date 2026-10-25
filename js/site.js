// One line — page shell: worlds, scenes, the connecting thread, small interactions.
import './tools.js';
import { signature, toD } from '../scenes/sign.js';

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
function onScrollHeader() {
  const y = scrollY;
  top.toggleAttribute('data-scrolled', y > 24);
  const goingDown = y > lastY && y > 400;
  top.toggleAttribute('data-hidden', goingDown && !top.contains(document.activeElement));
  lastY = y;
  const mid = y + cachedViewportHeight * 0.4;
  let current = -1;
  navTargetTops.forEach((t, i) => { if (t < mid) current = i; });
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
let maraBeatPhase = 0;
let maraPulse = 0;

if (!reduced) for (const rec of worldRecords) {
  if (rec.world === 'paper') continue;
  rec.el.style.setProperty('--world-radius', '0px');
  rec.el.style.setProperty('--world-content-opacity', '0');
  rec.el.style.setProperty('--world-content-visibility', 'hidden');
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
document.querySelector('main').prepend(thread);
let connectors = []; // { path, y0, y1 }

const obstacleSel = '.project__text, .project--pitlane .project__name, .pm, .section-title, .year__title, .year__sub, .off__caption, .off__meta, .exp__lead, .timeline, .more__list, .notes__groups, .skills__grid, .learn, .hero__inner, .contact__title, .contact__body, .contact__links, .foot__credits, .shot';

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
    rec.el.style.setProperty('--world-content-visibility', ready ? 'visible' : 'hidden');
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

function buildThread() {
  const docH = document.documentElement.scrollHeight;
  thread.setAttribute('width', innerWidth);
  thread.setAttribute('height', docH);
  thread.setAttribute('viewBox', `0 0 ${innerWidth} ${docH}`);
  thread.style.height = docH + 'px';
  thread.replaceChildren();
  connectors = [];
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

  function addPath(d, y0, y1) {
    if (!d || y1 <= y0) return;
    // joined routes repeat their meeting point as a new M; keep one subpath so the dash draws in order
    d = d[0] + d.slice(1).replace(/M/g, 'L');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('pathLength', '1');
    path.style.strokeDasharray = '1';
    path.style.strokeDashoffset = reduced ? '0' : '1';
    thread.append(path);
    connectors.push({ path, y0, y1 });
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
  }
  finishWorldLayout(sy);
  for (const title of titles) updateTitleState(title, sy, cachedViewportHeight, true);
  queue();
}

function drawThread(y = scrollY, viewportHeight = cachedViewportHeight) {
  if (reduced) return;
  // near the end of the page the anchor slides to the bottom edge, so the last stretch can finish drawing
  const maxY = cachedDocumentHeight - viewportHeight;
  const near = clamp((y - (maxY - viewportHeight)) / viewportHeight);
  const anchor = y + viewportHeight * (0.62 + 0.38 * near);
  for (const c of connectors) {
    const t = clamp((anchor - c.y0) / (c.y1 - c.y0));
    c.path.style.strokeDashoffset = String(1 - t);
  }
  if (footSignPath && footSignDot && footSignSvg) {
    if (footerVisibleOnArrival === null) {
      const r = footSignSvg.getBoundingClientRect();
      footerVisibleOnArrival = r.top < innerHeight && r.bottom > 0;
    }
    const signMax = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const signStart = Math.max(0, signMax - innerHeight);
    // Use the actual remaining scroll range when the page/footer is shorter than a viewport.
    const signProgress = footerVisibleOnArrival || signMax === 0
      ? 1
      : clamp((scrollY - signStart) / Math.max(1, signMax - signStart));
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
  const elapsed = lastFrameTime ? Math.max(1, now - lastFrameTime) : 16.7;
  const dt = Math.min(80, elapsed);
  const speed = Math.abs(y - lastMotionScrollY) / elapsed;
  lastFrameTime = now;
  lastMotionScrollY = y;
  onScrollHeader();
  if (!reduced) updateMaraPulse(dt, speed);
  for (const world of worldRecords) updateWorldState(world, y, viewportHeight);
  for (const title of titles) updateTitleState(title, y, viewportHeight);
  for (const s of scenes) {
    if (!s.visible || !s.height) continue;
    const p = sectionProgress(s.top, s.height, y, viewportHeight);
    if (Math.abs(p - s.p) > 0.0005) { s.p = p; s.api.update(p); }
  }
  drawThread(y, viewportHeight);
  if (timeline && timelineLayout?.height && !reduced) {
    timeline.style.setProperty('--tl', clamp((viewportHeight * 0.75 - (timelineLayout.top - y)) / timelineLayout.height).toFixed(3));
  }
  if (!reduced && maraPulse > 0) queue();
}
addEventListener('scroll', queue, { passive: true });

let rebuildTimer;
function scheduleRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(buildThread, 120); }
addEventListener('resize', scheduleRebuild);
new ResizeObserver(scheduleRebuild).observe(document.querySelector('main'));

Promise.all(slots.map(mountScene)).then(() => {
  buildThread();
  scenes.forEach(s => { s.p = sectionProgress(s.top, s.height); s.api.update(reduced ? 0.6 : s.p); });
  root.dataset.ready = '1';
});
if (document.fonts) document.fonts.ready.then(scheduleRebuild);
addEventListener('load', scheduleRebuild);
