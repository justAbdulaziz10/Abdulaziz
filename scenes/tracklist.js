// Scene: tracklist — the line drops onto a record, runs the lead-in groove, spirals through the five bands
// of the side to the run-out, and leaves underneath. The record is drawn, not reproduced: black vinyl, five
// track bands, a plain label that takes the colour of the hovered track's world and prints its name.
// Hovering or focusing a track in the sleeve's tracklist spins the record up to speed (33 1/3) and lights
// that track's band; leaving lets it spin down. Scroll scrubs the label round slowly.

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const f1 = (n) => Math.round(n * 10) / 10;

// geometry (viewBox units)
const W = 600, R = 270, CX = 300, TOP = 58, CY = TOP + R, H = CY + R + 58;
const RO = 0.95 * R, RI = 0.42 * R, BW = (RO - RI) / 5; // playing area, five track bands
const RL = 0.335 * R; // label
const SPIN = 200; // deg/s, 33 1/3 rpm

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
};

function spiralPath() {
  // lead-in from the rim, seven turns of groove (Archimedean), a wide run-out, then the locked groove
  const r0 = 0.935 * R, r1 = 0.43 * R, r2 = 0.365 * R, turns = 7, th0 = 0.24;
  const pt = (r, th) => [CX + r * Math.sin(th), CY - r * Math.cos(th)];
  const [ex, ey] = pt(r0, th0);
  const dx = Math.cos(th0), dy = Math.sin(th0);
  let d = `M${CX} ${CY - R}C${CX} ${CY - R + 16} ${f1(ex - 34 * dx)} ${f1(ey - 34 * dy)} ${f1(ex)} ${f1(ey)}`;
  const n = turns * 120;
  for (let i = 1; i <= n; i++) {
    const t = i / n, th = th0 + t * turns * 2 * Math.PI;
    const [x, y] = pt(r0 + (r1 - r0) * t, th);
    d += `L${f1(x)} ${f1(y)}`;
  }
  const thA = th0 + turns * 2 * Math.PI, m = 90;
  for (let i = 1; i <= m; i++) { // run-out: 0.75 turn, wide pitch
    const t = i / m, e = t * t * (3 - 2 * t);
    const [x, y] = pt(r1 + (r2 - r1) * e, thA + t * 1.5 * Math.PI);
    d += `L${f1(x)} ${f1(y)}`;
  }
  const thB = thA + 1.5 * Math.PI;
  for (let i = 1; i <= 120; i++) { // locked groove
    const [x, y] = pt(r2, thB + (i / 120) * 2 * Math.PI);
    d += `L${f1(x)} ${f1(y)}`;
  }
  return d;
}

function wedge(a, spread, r0, r1) {
  const p = (r, th) => `${f1(CX + r * Math.sin(th))} ${f1(CY - r * Math.cos(th))}`;
  const a0 = a - spread, a1 = a + spread;
  return `M${p(r0, a0)}L${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
}

let uid = 0;

export function mount(root, { reduced = false } = {}) {
  const id = `tl${++uid}`;
  const section = root.closest('section');
  const scope = section || document;
  const tracks = [...scope.querySelectorAll('[data-track]')];
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let inView = false;

  // ---------- build ----------
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'tl-svg',
    'aria-label': 'A drawn vinyl record with five track bands and a centre label. The line runs into its groove, spirals to the centre and leaves underneath.' });
  const defs = el('defs', {}, svg);
  const blur = el('filter', { id: `${id}-blur`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  el('feGaussianBlur', { stdDeviation: '9' }, blur);
  const soft = el('filter', { id: `${id}-soft`, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  el('feGaussianBlur', { stdDeviation: '14' }, soft);

  const deco = el('g', { 'aria-hidden': 'true' }, svg);
  el('ellipse', { class: 'tl-shadow', cx: CX + 10, cy: CY + 22, rx: R * 0.98, ry: R * 0.98, filter: `url(#${id}-soft)` }, deco);
  const rotor = el('g', { class: 'tl-rotor' }, deco);
  el('circle', { class: 'tl-disc', cx: CX, cy: CY, r: R }, rotor);
  el('circle', { class: 'tl-rim', cx: CX, cy: CY, r: R - 1.5 }, rotor);

  // fine grooves: a dense field inside each band, finer rings in the lead-in and run-out
  const grooves = el('g', { class: 'tl-grooves' }, rotor);
  for (let r = RI + 1.2; r < RO; r += 2.6) el('circle', { cx: CX, cy: CY, r: f1(r) }, grooves);
  const gaps = el('g', { class: 'tl-gaps' }, rotor);
  for (let k = 1; k < 5; k++) el('circle', { cx: CX, cy: CY, r: f1(RO - k * BW), 'stroke-width': 3.2 }, gaps);
  el('circle', { cx: CX, cy: CY, r: f1(RO + 3), 'stroke-width': 1.2 }, gaps);
  el('circle', { cx: CX, cy: CY, r: f1(RI - 2), 'stroke-width': 1.2 }, gaps);

  const band = el('circle', { class: 'tl-band', cx: CX, cy: CY, r: f1(RO - BW / 2), 'stroke-width': f1(BW - 4) }, rotor);

  // light on the vinyl: a static bow-tie of sheen (it stays put while the record turns, as it does in life)
  const sheen = el('g', { class: 'tl-sheen', filter: `url(#${id}-blur)` }, rotor);
  for (const a of [-0.78, 2.36]) el('path', { d: wedge(a, 0.2, RL + 10, R - 6) }, sheen);
  for (const a of [-0.78, 2.36]) el('path', { class: 'tl-sheen-core', d: wedge(a, 0.06, RL + 14, R - 10) }, sheen);

  // the label: base + print rotate; the name is set upright on top
  const spin = el('g', { class: 'tl-spin' }, rotor);
  el('circle', { class: 'tl-label', cx: CX, cy: CY, r: RL }, spin);
  el('circle', { class: 'tl-label-ring', cx: CX, cy: CY, r: f1(RL - 9) }, spin);
  // a printed arc on the label ring: the only thing that shows the label turning; it never crosses the name
  const ra = RL - 9, a0 = 2.3, a1 = 3.4;
  el('path', { class: 'tl-label-line', d: `M${f1(CX + ra * Math.sin(a0))} ${f1(CY - ra * Math.cos(a0))}A${ra} ${ra} 0 0 1 ${f1(CX + ra * Math.sin(a1))} ${f1(CY - ra * Math.cos(a1))}` }, spin);
  el('circle', { class: 'tl-label-dot', cx: f1(CX + ra * Math.sin(a1)), cy: f1(CY - ra * Math.cos(a1)), r: 3.4 }, spin);
  const side = el('text', { class: 'tl-side', x: CX, y: f1(CY - RL + 27), 'text-anchor': 'middle' }, spin);
  side.textContent = '';

  // the line: in on top, the groove in light on the black, out underneath
  const LS = 'stroke-dasharray:1 2;stroke-dashoffset:1';
  const lineIn = el('path', { class: 'tl-line', d: `M${CX} 0V${CY - R}`, pathLength: 1, style: LS }, svg);
  const groove = el('path', { class: 'tl-groove-line', d: spiralPath(), pathLength: 1, style: LS }, svg);
  const lineOut = el('path', { class: 'tl-line', d: `M${CX} ${CY + R}V${H}`, pathLength: 1, style: LS }, svg);
  svg.insertBefore(lineOut, deco); // emerges from under the record
  [lineIn, groove, lineOut].forEach((n) => n.setAttribute('aria-hidden', 'true'));

  const type = el('g', { class: 'tl-type', 'aria-hidden': 'true' }, svg);
  const name1 = el('text', { class: 'tl-name', x: CX, 'text-anchor': 'middle' }, type);
  const name2 = el('text', { class: 'tl-name', x: CX, 'text-anchor': 'middle' }, type);
  const meta = el('text', { class: 'tl-meta', x: CX, y: f1(CY + 0.2 * R), 'text-anchor': 'middle' }, type);
  el('circle', { class: 'tl-hole', cx: CX, cy: CY, r: 5.5 }, svg).setAttribute('aria-hidden', 'true');

  root.append(svg);

  let hint = null;
  if (canHover && tracks.length) {
    hint = document.createElement('p');
    hint.className = 'tl-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Hover a track';
    root.append(hint);
  }

  // ---------- label type ----------
  const MAXW = 1.62 * RL;
  const fit = (t, fs) => { t.style.fontSize = `${fs}px`; return t.getComputedTextLength(); };
  function setName(text, metaText, small) {
    const base = (small ? 0.058 : 0.074) * R;
    name1.textContent = text; name2.textContent = '';
    let w = fit(name1, base);
    let two = false;
    if (w > MAXW && text.includes(' ')) {
      // split near the middle on a space
      const words = text.split(' ');
      let best = 1, bestD = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length;
        if (Math.abs(a - b) < bestD) { bestD = Math.abs(a - b); best = i; }
      }
      name1.textContent = words.slice(0, best).join(' ');
      name2.textContent = words.slice(best).join(' ');
      two = true;
      w = Math.max(fit(name1, base), fit(name2, base));
    }
    const fs = w > MAXW ? base * (MAXW / w) : base;
    name1.style.fontSize = name2.style.fontSize = `${f1(fs)}px`;
    const lh = fs * 1.08;
    const y = CY - 0.1 * R;
    if (two) { name1.setAttribute('y', f1(y - lh)); name2.setAttribute('y', f1(y)); }
    else name1.setAttribute('y', f1(y));
    meta.textContent = metaText || '';
  }

  const DEFAULT = { name: 'Abdulaziz Alkhlaiwe', meta: '', tone: '', side: '' };
  function show(info) {
    root.dataset.tone = info.tone || '';
    side.textContent = info.side || '';
    setName(info.name, info.meta, info === DEFAULT);
  }

  // ---------- spin ----------
  let scrollRot = 0, spinRot = 0, vel = 0, target = 0, raf = 0, lastT = 0;
  const applyRot = () => rotor.setAttribute('transform', `rotate(${f1((scrollRot + spinRot) % 360)} ${CX} ${CY})`);
  function tick(t) {
    raf = 0;
    if (document.hidden || !inView) { lastT = 0; return; }
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    const k = 1 - Math.exp(-dt / (target > vel ? 0.16 : 0.09)); // both spin-up and spin-down settle within ~0.5 s
    vel += (target - vel) * k;
    if (target === 0 && vel < 2) vel = 0;
    spinRot = (spinRot + vel * dt) % 360;
    applyRot();
    if (vel > 0 || target > 0) raf = requestAnimationFrame(tick);
    else lastT = 0;
  }
  const run = () => { if (!raf && !reduced && inView && !document.hidden) { lastT = 0; raf = requestAnimationFrame(tick); } };
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) run();
    else { cancelAnimationFrame(raf); raf = 0; lastT = 0; }
  });
  visibility.observe(root);

  let current = null, leaveTimer = 0, used = false;
  function play(a) {
    clearTimeout(leaveTimer);
    if (current === a) return;
    current = a;
    const i = Math.max(0, [...a.closest('ol').querySelectorAll('[data-track]')].indexOf(a));
    const no = a.dataset.track || '';
    const year = a.querySelector('.track__year')?.textContent.trim();
    show({
      name: a.querySelector('.track__name')?.textContent.trim() || a.textContent.trim(),
      meta: [no, year].filter(Boolean).join('  ·  '),
      tone: a.dataset.tone || (no.startsWith('B') ? 'b' : ''),
      side: no.charAt(0),
    });
    band.setAttribute('r', f1(RO - (i + 0.5) * BW));
    root.classList.add('is-playing');
    target = SPIN;
    run();
    if (!used) { used = true; hint?.classList.add('is-used'); }
  }
  function stop() {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      current = null;
      root.classList.remove('is-playing');
      target = 0;
      run();
      show(DEFAULT);
    }, 90);
  }

  const onOver = (e) => { const a = e.target.closest?.('[data-track]'); if (a) play(a); };
  const onOut = (e) => {
    const a = e.target.closest?.('[data-track]');
    if (!a) return;
    const to = e.relatedTarget?.closest?.('[data-track]');
    if (!to && document.activeElement?.closest?.('[data-track]') == null) stop();
  };
  const onFocusIn = (e) => { const a = e.target.closest?.('[data-track]'); if (a) play(a); };
  const onFocusOut = (e) => { if (!e.relatedTarget?.closest?.('[data-track]')) stop(); };
  const onVis = () => { if (!document.hidden && (vel > 0 || target > 0)) run(); };
  if (tracks.length) {
    scope.addEventListener('pointerover', onOver);
    scope.addEventListener('pointerout', onOut);
    scope.addEventListener('focusin', onFocusIn);
    scope.addEventListener('focusout', onFocusOut);
  }
  document.addEventListener('visibilitychange', onVis);

  // ---------- scroll ----------
  // Convert the section's progress into "how far the page pen (62% of the viewport) has moved through this
  // scene", finishing by the time the scene sits centred on screen.
  let vh = 900, secH = H, off = 0, h = H;
  function measure() {
    vh = innerHeight || 900;
    const rr = root.getBoundingClientRect();
    h = rr.height || H;
    if (rr.width) root.style.setProperty('--tl-u', String(Math.round((W / rr.width) * 1000) / 1000));
    if (section) { const sr = section.getBoundingClientRect(); secH = sr.height; off = rr.top - sr.top; }
    else { secH = h; off = 0; }
  }
  const pen = (p) => {
    const sceneTop = vh - p * (secH + vh) + off;
    const D = Math.min(h, 0.12 * vh + 0.5 * h);
    return clamp((0.62 * vh - sceneTop) / D);
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(root);
  if (section) ro.observe(section);
  addEventListener('resize', measure);

  let lastF = -1;
  function render(p) {
    const F = reduced ? 1 : pen(p);
    if (!reduced) { scrollRot = p * 300; applyRot(); }
    if (Math.abs(F - lastF) < 1e-4) return;
    lastF = F;
    const a = seg(F, 0, 0.07), b = seg(F, 0.07, 0.93), c = seg(F, 0.93, 1);
    lineIn.style.strokeDashoffset = String(f1((1 - a) * 1000) / 1000);
    groove.style.strokeDashoffset = String(Math.round((1 - b) * 1e4) / 1e4);
    lineOut.style.strokeDashoffset = String(f1((1 - c) * 1000) / 1000);
    groove.style.opacity = b > 0 ? '' : '0';
  }

  show(DEFAULT);
  applyRot();
  render(reduced ? 0.6 : 0);

  return {
    update(p) { render(clamp(+p)); },
    anchors() { return { entry: { x: 0.5, y: 0 }, exit: { x: 0.5, y: 1 } }; },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(leaveTimer);
      visibility.disconnect();
      ro.disconnect();
      removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', onVis);
      if (tracks.length) {
        scope.removeEventListener('pointerover', onOver);
        scope.removeEventListener('pointerout', onOut);
        scope.removeEventListener('focusin', onFocusIn);
        scope.removeEventListener('focusout', onFocusOut);
      }
      root.textContent = '';
      delete root.dataset.tone;
      root.classList.remove('is-playing');
    },
  };
}
