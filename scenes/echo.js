// Echo — a voice waveform that settles into the edge of a hand of photo memories.
const NS = 'http://www.w3.org/2000/svg';
const IMG = new URL('../assets/img/', import.meta.url).href;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Crops are in the 924x2000 display space of the 1284x2778 App Store panels.
const CARDS = [
  { k: -2, file: 'echo-screen-07', crop: [478, 700, 878, 1272], alt: 'Echo memory card: a garden lane in bloom, labelled Family' },
  { k: -1, file: 'echo-screen-07', crop: [46, 700, 446, 1272], alt: 'Echo memory card: clouds seen from a plane window, labelled Travel' },
  { k: 0, file: 'echo-screen-02', crop: [105, 587, 820, 1608], alt: 'Echo memory card: Big Ben at night with the story written beneath it' },
  { k: 1, file: 'echo-screen-03', crop: [105, 560, 820, 1581], alt: 'Echo memory card: an open book beside a coffee cup, with a voice note player' },
  { k: 2, file: 'echo-screen-05', crop: [120, 440, 820, 1440], alt: 'Echo memory card: the Riyadh skyline at night' },
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
  return `<figure class="echo__card${c.k === 0 ? ' echo__card--hero' : ''}" style="--k:${c.k}">
    <div class="echo__photo">
      <img src="${IMG}${c.file}.webp" alt="${c.alt}" width="1284" height="2778" decoding="async" ${c.k === 0 ? '' : 'loading="lazy"'}
        style="width:${wPct.toFixed(3)}%;transform:translate(-${tx.toFixed(3)}%,-${ty.toFixed(3)}%)">
      <span class="echo__light" aria-hidden="true"></span>
    </div>
    <figcaption class="echo__cap" aria-hidden="true"><span class="echo__play"></span>${bars(11 + i * 7)}</figcaption>
  </figure>`;
}

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
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
  const stopDefs = [[0, 'ink'], [0.06, 'echo'], [0.26, 'echo'], [0.36, 'deep'], [0.86, 'deep'], [1, 'ink']];
  const stops = stopDefs.map(([o, c]) => el('stop', { offset: o, class: `echo__stop-${c}` }, grad));
  const line = el('path', { class: 'echo__line', pathLength: 1, stroke: 'url(#echo-line-grad)', 'aria-hidden': 'true' }, svg);

  const fanWrap = document.createElement('div');
  fanWrap.className = 'echo__fanwrap';
  fanWrap.innerHTML = `<div class="echo__fan">${CARDS.map(cardHTML).join('')}</div>`;
  const fan = fanWrap.firstChild;
  const cards = [...fan.children].map((node, i) => ({ node, k: CARDS[i].k }));

  stage.append(haze, sun, svg, fanWrap);

  let layout = null, L = LAYOUTS.wide;
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
  }

  const ro = new ResizeObserver((entries) => build(entries[0].contentRect.width < 640 ? 'narrow' : 'wide'));
  ro.observe(root);
  build((root.clientWidth || 1200) < 640 ? 'narrow' : 'wide');

  function render(p) {
    const draw = easeOut(clamp((p - 0.05) / 0.45));
    line.style.strokeDashoffset = (1 - draw).toFixed(4);

    const inn = easeOut(clamp((p - 0.08) / 0.24));
    const f = smooth(0.26, 0.56, p);
    const drift = smooth(0.58, 1, p);
    const spread = f * (1 + 0.1 * drift);
    fanWrap.style.opacity = inn.toFixed(3);
    fan.style.transform = `translate3d(0, ${((1 - inn) * 80).toFixed(1)}px, 0) rotateX(${lerp(14, 4, f).toFixed(2)}deg)`;
    for (const c of cards) {
      const a = Math.abs(c.k), s = Math.sign(c.k);
      const rz = lerp(MESS[c.k], s * L.rot[a], spread);
      const tx = s * L.tx[a] * spread + (1 - f) * c.k * 0.8;
      const ty = (1 - f) * a * -0.9;
      const z = (2 - a) * 26 * f + (2 - a) * 3;
      const ry = -c.k * 5 * f;
      const sc = lerp(1, L.scale[a], f);
      c.node.style.transform = `translate3d(${tx.toFixed(2)}%, ${ty.toFixed(2)}%, ${z.toFixed(1)}px) rotateZ(${rz.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    }
    sun.style.opacity = smooth(0.26, 0.56, p).toFixed(3);
    sun.style.transform = `translate3d(0, ${lerp(22, 0, smooth(0.15, 0.6, p)).toFixed(2)}%, 0)`;
    haze.style.opacity = smooth(0.1, 0.55, p).toFixed(3);
  }

  if (reduced) { root.classList.add('is-reduced'); render(0.6); }

  return {
    update(p) {
      if (reduced) return;
      render(clamp(+p || 0));
    },
    destroy() {
      ro.disconnect();
      root.innerHTML = '';
    },
  };
}
