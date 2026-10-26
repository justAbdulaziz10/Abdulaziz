// Echo — a voice waveform that settles into the edge of a hand of photo memories.
const NS = 'http://www.w3.org/2000/svg';
const IMG = new URL('../assets/img/', import.meta.url).href;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Crops are in the 924x2000 display space of the 1284x2778 App Store panels.
const CARDS = [
  { k: -2, name: 'Family', file: 'echo-screen-07', crop: [478, 700, 878, 1272], alt: 'Echo memory card: a garden lane in bloom, labelled Family' },
  { k: -1, name: 'Travel', file: 'echo-screen-07', crop: [46, 700, 446, 1272], alt: 'Echo memory card: clouds seen from a plane window, labelled Travel' },
  { k: 0, name: 'Big Ben', file: 'echo-screen-02', crop: [105, 587, 820, 1608], alt: 'Echo memory card: Big Ben at night with the story written beneath it' },
  { k: 1, name: 'Book and voice note', file: 'echo-screen-03', crop: [105, 560, 820, 1581], alt: 'Echo memory card: an open book beside a coffee cup, with a voice note player' },
  { k: 2, name: 'Riyadh at night', file: 'echo-screen-05', crop: [120, 440, 820, 1440], alt: 'Echo memory card: the Riyadh skyline at night' },
];
const MESS = { '-2': -5, '-1': 3.5, '0': -1.2, '1': 2.4, '2': -2.6 };

const LAYOUTS = {
  wide: { w: 1200, h: 760, cx: 600, wave: [14, 204], amp: 50, cardW: 268, cardTop: 254,
    rot: [0, 10.5, 20], tx: [0, 4, 8], lift: [0, 0, 0], scale: [1, 1, 1], origin: '50% 165%' },
  narrow: { w: 390, h: 650, cx: 195, wave: [10, 166], amp: 34, cardW: 206, cardTop: 206,
    rot: [0, 9, 15], tx: [0, 2, 4], lift: [0, 0, 0], scale: [1, 0.96, 0.88], origin: '50% 150%' },
};
const CARD_RATIO = 0.045 + 0.91 / 0.7 + 0.16; // polaroid height / width

// Seeded noise so the waveform reads like speech, not a sine.
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function wavePath(L) {
  const { cx, h } = L, [y0, y1] = L.wave;
  const r = rand(7);
  const bursts = [[0.14, 0.07, 0.42], [0.3, 0.08, 1], [0.47, 0.06, 0.66], [0.6, 0.07, 0.84], [0.76, 0.06, 0.38], [0.88, 0.05, 0.16]];
  const env = (t) => bursts.reduce((m, [c, w, a]) => Math.max(m, a * Math.exp(-((t - c) ** 2) / (2 * w * w))), 0);
  const pts = [[cx, 0], [cx, y0]];
  const step = L.w > 600 ? 5.8 : 4.6;
  let side = 1;
  for (let y = y0 + step; y < y1 - step; y += step) {
    const t = (y - y0) / (y1 - y0);
    const a = env(t) * L.amp * (0.55 + 0.45 * r());
    pts.push([cx + side * a, y]);
    side = -side;
  }
  pts.push([cx, y1]);
  pts.push([cx, h]);
  return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
}

function bars(seed, n = 22) {
  const r = rand(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const env = Math.sin(Math.PI * (i + 0.5) / n) ** 0.6;
    const hgt = Math.max(2, Math.round((0.25 + 0.75 * r()) * env * 18));
    out += `<rect x="${i * 4}" y="${(20 - hgt) / 2}" width="2" height="${hgt}" rx="1"/>`;
  }
  return `<svg class="echo__bars" viewBox="0 0 ${n * 4 - 2} 20" aria-hidden="true" preserveAspectRatio="xMinYMid meet">${out}</svg>`;
}

function cardHTML(c, i) {
  const [x0, y0, x1] = c.crop;
  const wPct = (924 / (x1 - x0)) * 100;
  const tx = (x0 / 924) * 100, ty = (y0 / 2000) * 100;
  return `<div class="echo__card${c.k === 0 ? ' echo__card--hero' : ''}" style="--k:${c.k}" role="button" tabindex="${c.k === 0 ? 0 : -1}" aria-describedby="echo-keys">
    <div class="echo__photo">
      <img src="${IMG}${c.file}.webp" alt="${c.alt}" width="1284" height="2778" decoding="async" ${c.k === 0 ? '' : 'loading="lazy"'}
        style="width:${wPct.toFixed(3)}%;transform:translate(-${tx.toFixed(3)}%,-${ty.toFixed(3)}%)">
      <span class="echo__light" aria-hidden="true"></span>
    </div>
    <div class="echo__cap" aria-hidden="true"><span class="echo__play"></span>${bars(11 + i * 7)}</div>
  </div>`;
}

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
}

const interp = (arr, a) => (a <= 1 ? lerp(arr[0], arr[1], a) : lerp(arr[1], arr[2], Math.min(1, a - 1)));
function spring(c, x, v, target, k, d, dt) {
  const acc = k * (target - c[x]) - d * c[v];
  c[v] += acc * dt;
  c[x] += c[v] * dt;
}

export function mount(root, { reduced = false } = {}) {
  root.innerHTML = '';
  const stage = document.createElement('div');
  stage.className = 'echo__stage';
  root.append(stage);

  const haze = document.createElement('div');
  haze.className = 'echo__haze';
  haze.setAttribute('aria-hidden', 'true');
  const sun = document.createElement('div');
  sun.className = 'echo__sun';
  sun.setAttribute('aria-hidden', 'true');

  const svg = el('svg', { class: 'echo__art', role: 'img', 'aria-label': 'A voice waveform that settles into a fanned hand of Echo photo memory cards' });
  const grad = el('linearGradient', { id: 'echo-line-grad', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: 0, y2: 1 }, el('defs', {}, svg));
  [[0, 'ink'], [0.06, 'echo'], [0.26, 'echo'], [0.36, 'deep'], [0.86, 'deep'], [1, 'ink']]
    .forEach(([o, c]) => el('stop', { offset: o, class: `echo__stop-${c}` }, grad));
  const line = el('path', { class: 'echo__line', pathLength: 1, stroke: 'url(#echo-line-grad)', 'aria-hidden': 'true' }, svg);

  const fanWrap = document.createElement('div');
  fanWrap.className = 'echo__fanwrap';
  fanWrap.innerHTML = `<div class="echo__fan" role="group" aria-label="Echo memory cards">${CARDS.map(cardHTML).join('')}</div>`;
  const fan = fanWrap.firstChild;
  const cards = [...fan.children].map((node, i) => ({
    node, id: i, name: CARDS[i].name, mess: MESS[CARDS[i].k],
    s: CARDS[i].k, vs: 0, z: Math.abs(CARDS[i].k), vz: 0, dx: 0, vdx: 0, dy: 0, vdy: 0, lift: 0, vlift: 0, dip: 0, vdip: 0, liftT: 0,
  }));
  let order = [0, 1, 2, 3, 4]; // card ids left to right; order[2] is the hero

  const hint = document.createElement('p');
  hint.className = 'echo__hint';
  hint.textContent = 'Drag the cards';
  hint.setAttribute('aria-hidden', 'true');
  const keys = document.createElement('p');
  keys.className = 'echo__sr';
  keys.id = 'echo-keys';
  keys.textContent = 'Use the left and right arrow keys to bring the previous or next card to the front. Enter, like a click on the front card, deals the next one.';
  const live = document.createElement('p');
  live.className = 'echo__sr';
  live.setAttribute('aria-live', 'polite');

  stage.append(haze, sun, svg, fanWrap, hint, keys, live);

  let layout = null, L = LAYOUTS.wide, cardPx = 268;
  function build(name) {
    if (name === layout) return;
    layout = name;
    L = LAYOUTS[name];
    root.dataset.layout = name;
    svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
    stage.style.aspectRatio = `${L.w} / ${L.h}`;
    grad.setAttribute('y2', L.h);
    line.setAttribute('d', wavePath(L));
    const pct = (v, of) => (v / of * 100).toFixed(3) + '%';
    const cardH = L.cardW * CARD_RATIO;
    Object.assign(fan.style, {
      left: pct(L.cx - L.cardW / 2, L.w), width: pct(L.cardW, L.w),
      top: pct(L.cardTop, L.h), height: pct(cardH, L.h),
    });
    for (const c of cards) c.node.style.transformOrigin = L.origin;
    const sunD = L.cardW * 1.3;
    Object.assign(sun.style, {
      left: pct(L.cx - sunD / 2, L.w), width: pct(sunD, L.w),
      top: pct(L.cardTop - sunD * 0.34, L.h), height: pct(sunD, L.h),
    });
    Object.assign(hint.style, name === 'wide'
      ? { left: pct(L.cx + 72, L.w), top: pct((L.wave[0] + L.wave[1]) / 2 - 10, L.h) }
      : { left: pct(L.cx + 44, L.w), top: pct((L.wave[0] + L.wave[1]) / 2 - 10, L.h) });
  }

  const ro = new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    build(w < 640 ? 'narrow' : 'wide');
    cardPx = w * L.cardW / L.w;
  });
  ro.observe(root);
  build((root.clientWidth || 1200) < 640 ? 'narrow' : 'wide');

  let P = 0.6;
  function render() {
    const p = P;
    const draw = easeOut(clamp((p - 0.05) / 0.45));
    line.style.strokeDashoffset = (1 - draw).toFixed(4);

    const inn = easeOut(clamp((p - 0.08) / 0.24));
    const f = smooth(0.26, 0.56, p);
    const drift = smooth(0.58, 1, p);
    const spread = f * (1 + 0.1 * drift);
    fanWrap.style.opacity = inn.toFixed(3);
    fan.style.transform = `translate3d(0, ${((1 - inn) * 80).toFixed(1)}px, 0) rotateX(${lerp(14, 4, f).toFixed(2)}deg)`;
    for (const c of cards) {
      const a = Math.min(2, Math.abs(c.s)), sg = Math.sign(c.s);
      const rz = lerp(c.mess, sg * interp(L.rot, a), spread) + c.dx * 0.025;
      const tx = sg * interp(L.tx, a) * spread + (1 - f) * c.s * 0.8;
      const ty = (1 - f) * a * -0.9;
      const z = (2 - c.z) * (26 * f + 3) + c.lift * 90 - c.dip * 90 + c.id * 0.3;
      const ry = -c.s * 5 * f * (1 - c.lift);
      const sc = lerp(1, interp(L.scale, a), f) * (1 + 0.035 * c.lift);
      c.node.style.transform = `translate3d(${c.dx.toFixed(1)}px, ${c.dy.toFixed(1)}px, 0) translate3d(${tx.toFixed(2)}%, ${ty.toFixed(2)}%, ${z.toFixed(1)}px) rotateZ(${rz.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    }
    sun.style.opacity = smooth(0.26, 0.56, p).toFixed(3);
    sun.style.transform = `translate3d(0, ${lerp(22, 0, smooth(0.15, 0.6, p)).toFixed(2)}%, 0)`;
    haze.style.opacity = smooth(0.1, 0.55, p).toFixed(3);
    hint.style.opacity = used ? 0 : smooth(0.4, 0.55, p).toFixed(3);
  }

  // ---- physics ----
  let raf = 0, lastT = 0, drag = null, used = false;
  function settled(c) {
    const t = order.indexOf(c.id) - 2;
    return Math.abs(c.s - t) < 0.002 && Math.abs(c.vs) < 0.01 && Math.abs(c.z - Math.abs(t)) < 0.002 && Math.abs(c.vz) < 0.01
      && Math.abs(c.dx) < 0.3 && Math.abs(c.vdx) < 2 && Math.abs(c.dy) < 0.3 && Math.abs(c.vdy) < 2
      && Math.abs(c.lift - c.liftT) < 0.002 && Math.abs(c.dip) < 0.002 && Math.abs(c.vdip) < 0.02;
  }
  function snapAll() {
    for (const c of cards) {
      const t = order.indexOf(c.id) - 2;
      Object.assign(c, { s: t, vs: 0, z: Math.abs(t), vz: 0, vdx: 0, vdy: 0, lift: c.liftT, vlift: 0, dip: 0, vdip: 0 });
      if (!drag || drag.card !== c) { c.dx = 0; c.dy = 0; }
    }
  }
  function tick(t) {
    raf = 0;
    const dt = lastT ? Math.min(0.034, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    const steps = 2, h = dt / steps;
    let busy = !!drag;
    for (const c of cards) {
      const ts = order.indexOf(c.id) - 2;
      for (let i = 0; i < steps; i++) {
        spring(c, 's', 'vs', ts, 210, 27, h);
        spring(c, 'z', 'vz', Math.abs(ts), 520, 46, h);
        spring(c, 'lift', 'vlift', c.liftT, 420, 40, h);
        spring(c, 'dip', 'vdip', 0, 160, 24, h);
        if (!drag || drag.card !== c) {
          spring(c, 'dx', 'vdx', 0, 300, 26, h);
          spring(c, 'dy', 'vdy', 0, 300, 26, h);
        }
      }
      if (!settled(c)) busy = true;
    }
    render();
    if (busy) raf = requestAnimationFrame(tick);
    else { lastT = 0; snapAll(); render(); }
  }
  function kick() {
    if (reduced) { snapAll(); render(); return; }
    if (!raf) { lastT = 0; raf = requestAnimationFrame(tick); }
  }

  function markHero(announce) {
    const heroId = order[2];
    for (const c of cards) {
      const hero = c.id === heroId;
      c.node.classList.toggle('echo__card--hero', hero);
      c.node.tabIndex = hero ? 0 : -1;
      c.node.setAttribute('aria-label', `${c.name} memory card${hero ? ', in front' : ''}`);
    }
    if (announce) live.textContent = `${cards[heroId].name} in front`;
  }
  function useOnce() { if (!used) { used = true; hint.classList.add('is-used'); render(); } }
  function setOrder(next, moved = []) {
    const before = order.map((id) => id);
    order = next;
    for (const c of cards) {
      const d = Math.abs(order.indexOf(c.id) - before.indexOf(c.id));
      if (d >= 2 || moved.includes(c.id)) c.vdip += 7; // tuck behind while crossing the hand
    }
    markHero(true);
    useOnce();
    kick();
  }
  const rotNext = () => setOrder(order.slice(1).concat(order[0]));
  const rotPrev = () => setOrder([order[4], ...order.slice(0, 4)]);
  function bringToFront(id) {
    const j = order.indexOf(id) - 2;
    if (j === 0) return rotNext();
    let o = order;
    for (let i = 0; i < Math.abs(j); i++) o = j > 0 ? o.slice(1).concat(o[0]) : [o[4], ...o.slice(0, 4)];
    setOrder(o);
  }
  function fling(id, dir) {
    let o = dir < 0 ? order.slice(1).concat(order[0]) : [order[4], ...order.slice(0, 4)];
    o = o.filter((x) => x !== id);
    o = dir < 0 ? [id, ...o] : [...o, id];
    setOrder(o, [id]);
  }

  // ---- pointer: tap, drag, fling ----
  const cardOf = (t) => cards.find((c) => c.node === t.closest?.('.echo__card'));
  function onDown(e) {
    if (e.button > 0) return;
    const c = cardOf(e.target);
    if (!c) return;
    drag = null;
    pend = { c, id: e.pointerId, x0: e.clientX, y0: e.clientY, type: e.pointerType, samples: [[e.timeStamp, e.clientX]] };
  }
  let pend = null;
  function onMove(e) {
    if (pend && e.pointerId === pend.id && !drag) {
      const dx = e.clientX - pend.x0, dy = e.clientY - pend.y0;
      if (Math.hypot(dx, dy) < 8) return;
      if (pend.type !== 'mouse' && Math.abs(dy) > Math.abs(dx)) { pend = null; return; } // vertical: let the page scroll
      drag = { card: pend.c, ...pend };
      pend = null;
      try { drag.c.node.setPointerCapture(e.pointerId); } catch {}
      drag.card.liftT = 1;
      drag.card.node.classList.add('is-lifted');
      root.classList.add('is-dragging');
      kick();
    }
    if (drag && e.pointerId === drag.id) {
      e.preventDefault();
      const c = drag.card;
      c.dx = e.clientX - drag.x0;
      c.dy = (e.clientY - drag.y0) * (drag.type === 'mouse' ? 0.7 : 0.35);
      c.vdx = 0; c.vdy = 0;
      drag.samples.push([e.timeStamp, e.clientX]);
      while (drag.samples.length > 2 && e.timeStamp - drag.samples[0][0] > 90) drag.samples.shift();
      if (reduced) render();
    }
  }
  function onUp(e) {
    if (pend && e.pointerId === pend.id) { const c = pend.c; pend = null; bringToFront(c.id); return; }
    if (!drag || e.pointerId !== drag.id) return;
    const c = drag.card;
    const s0 = drag.samples[0], s1 = [e.timeStamp, e.clientX];
    const vx = (s1[1] - s0[1]) / Math.max(16, s1[0] - s0[0]); // px/ms
    const isHero = order[2] === c.id;
    const thrown = e.type === 'pointerup' && (Math.abs(vx) > 0.45 || Math.abs(c.dx) > cardPx * 0.55);
    c.liftT = 0;
    c.node.classList.remove('is-lifted');
    root.classList.remove('is-dragging');
    c.vdx = vx * 1000 * 0.35;
    drag = null;
    if (thrown && isHero) fling(c.id, Math.sign(Math.abs(vx) > 0.2 ? vx : c.dx) || 1);
    else { useOnce(); kick(); }
  }
  function onKey(e) {
    const c = cardOf(e.target);
    if (e.key === 'ArrowRight') { e.preventDefault(); rotNext(); focusHero(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); rotPrev(); focusHero(); }
    else if ((e.key === 'Enter' || e.key === ' ') && c) { e.preventDefault(); bringToFront(c.id); focusHero(); }
  }
  function focusHero() { cards[order[2]].node.focus({ preventScroll: true }); }
  const onClickBlock = (e) => e.preventDefault();

  fan.addEventListener('pointerdown', onDown);
  fan.addEventListener('pointermove', onMove);
  fan.addEventListener('pointerup', onUp);
  fan.addEventListener('pointercancel', onUp);
  fan.addEventListener('keydown', onKey);
  fan.addEventListener('dragstart', onClickBlock);

  markHero(false);
  if (reduced) { root.classList.add('is-reduced'); P = 0.6; render(); }

  return {
    update(p) {
      if (reduced) return;
      P = clamp(+p || 0);
      render();
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      fan.removeEventListener('pointerdown', onDown);
      fan.removeEventListener('pointermove', onMove);
      fan.removeEventListener('pointerup', onUp);
      fan.removeEventListener('pointercancel', onUp);
      fan.removeEventListener('keydown', onKey);
      fan.removeEventListener('dragstart', onClickBlock);
      root.innerHTML = '';
    },
  };
}
