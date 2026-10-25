// Scene: window — the Rear Window courtyard at night.
// The line drops in, climbs over the parapet and zig-zags down as the fire escape, floor by floor;
// each floor's windows are drawn as it passes. Then the windows light up warmly one by one — four of
// them frame the four favourite films as little title cards — and a rooftop neon sign flickers on:
// 1,657 films logged on Letterboxd.

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const f1 = (n) => Math.round(n * 10) / 10;

const FILMS = [
  { title: ['Rear Window'], year: '1954', icon: 'lens' },
  { title: ['The Beatles:', 'Get Back'], year: '2021', icon: 'roof' },
  { title: ['Begin Again'], year: '2013', icon: 'guitar' },
  { title: ['La La Land'], year: '2016', icon: 'lamp' },
];

const LAYOUTS = {
  wide: {
    W: 1200, Ht: 780, plate: [0, 40, 1200, 740], cx: 600, B: 158, ground: 680, rail: 0.46,
    blds: [
      { x0: 0, x1: 300, roof: 290, tone: 'side', floors: [314, 434, 554], bays: [[38, 96], [166, 96]], h: 96 },
      { x0: 300, x1: 900, roof: 170, tone: 'main', floors: [194, 314, 434, 554], bays: [[322, 96], [450, 96], [654, 96], [782, 96]], h: 96, escape: true },
      { x0: 900, x1: 1200, roof: 290, tone: 'side', floors: [314, 434, 554], bays: [[938, 96], [1066, 96]], h: 96 },
    ],
    tower: { x: 150, base: 290, w: 96 },
    sign: { x0: 924, x1: 1184, y0: 118, y1: 262, base: 290, num: 82, label: ['films logged on Letterboxd'], ls: 13 },
    moon: [86, 96, 15],
    stars: [[240, 74], [330, 120], [420, 62], [500, 104], [700, 70], [780, 118], [860, 58], [1030, 76], [1150, 96], [560, 150], [646, 132], [40, 168], [276, 196], [1188, 230]],
    lights: {
      '0-0-1': { film: 0, t: 0.26 },
      '1-0-3': { film: 1, t: 0.34 },
      '1-2-0': { film: 2, t: 0.41 },
      '2-2-0': { film: 3, t: 0.48 },
      '1-1-0': { blind: 0.42, t: 0.22 },
      '1-0-1': { t: 0.3 },
      '0-2-0': { blind: 0.55, t: 0.37 },
      '2-0-1': { t: 0.44 },
      '1-3-2': { t: 0.515 },
      '2-1-0': { blind: 0.3, t: 0.29 },
    },
  },
  tall: {
    W: 380, Ht: 850, plate: [0, 40, 380, 810], cx: 190, B: 52, ground: 744, rail: 0.46,
    blds: [
      { x0: 0, x1: 380, roof: 238, tone: 'main', floors: [262, 380, 498, 616], bays: [[22, 104], [162, 56], [254, 104]], h: 100, escape: true },
    ],
    tower: { x: 76, base: 238, w: 64 },
    sign: { x0: 212, x1: 372, y0: 104, y1: 214, base: 238, num: 50, label: ['films logged', 'on Letterboxd'], ls: 11.5 },
    moon: [34, 84, 11],
    stars: [[120, 60], [160, 112], [26, 140], [300, 70], [250, 90], [354, 82], [140, 170], [210, 70]],
    lights: {
      '0-0-2': { film: 1, t: 0.26 },
      '0-1-0': { film: 0, t: 0.34 },
      '0-2-2': { film: 2, t: 0.41 },
      '0-3-0': { film: 3, t: 0.48 },
      '0-0-0': { blind: 0.45, t: 0.22 },
      '0-1-1': { t: 0.3 },
      '0-3-2': { blind: 0.32, t: 0.37 },
      '0-2-1': { t: 0.44 },
      '0-1-2': { t: 0.515 },
    },
  },
};

let uid = 0;

export function mount(root, { reduced = false } = {}) {
  let mode = null;
  let scene = null;
  let lastP = reduced ? 0.6 : 0;
  const build = (m) => {
    mode = m;
    root.textContent = '';
    scene = buildScene(root, LAYOUTS[m]);
    scene.update(lastP);
  };
  const pick = (w) => (w > 0 && w < 640 ? 'tall' : 'wide');
  build(pick(root.clientWidth || 1200));
  const ro = new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    const m = pick(w);
    if (m !== mode) build(m);
    scene.scaleTo(w);
  });
  ro.observe(root);
  return {
    update(p) {
      if (reduced) return;
      lastP = p;
      scene.update(p);
    },
    destroy() {
      ro.disconnect();
      root.textContent = '';
    },
  };
}

function icon(kind) {
  switch (kind) {
    case 'lens': // Jeff's camera with the long lens
      return `<g class="wn-ink">
        <path d="M-15,-6 h4 l2,-4 h6 l2,4 h2 v13 h-16 Z"/>
        <rect x="1" y="-4.5" width="13" height="9" rx="1.2"/>
        <rect x="13.5" y="-6.5" width="4.5" height="13" rx="1"/>
      </g><circle class="wn-warm" cx="-7" cy="0.5" r="2.6"/>`;
    case 'roof': // the rooftop: parapet, chimney stack, mic stand, amp
      return `<g class="wn-ink">
        <rect x="-19" y="6" width="38" height="3.2" rx="0.6"/>
        <rect x="-17" y="-5" width="7.5" height="11"/>
        <rect x="-16.6" y="-8.4" width="2.6" height="3.6" rx="0.5"/><rect x="-12.6" y="-8.4" width="2.6" height="3.6" rx="0.5"/>
        <rect x="-1.5" y="-12.5" width="3" height="5.4" rx="1.5"/>
        <rect x="8.5" y="-3.5" width="10" height="9.5" rx="1"/>
      </g><path class="wn-stroke" d="M0,-7 V6 M-3.4,6 L0,2.6 L3.4,6"/><circle class="wn-warm" cx="13.5" cy="1.2" r="2.7"/>`;
    case 'guitar':
      return `<g transform="rotate(-38)"><g class="wn-ink">
        <circle cx="0" cy="6.5" r="7.2"/><circle cx="0" cy="-2.6" r="5.4"/>
        <rect x="-1.4" y="-17" width="2.8" height="14" rx="0.6"/>
        <rect x="-2.3" y="-21.5" width="4.6" height="5.4" rx="1"/>
      </g><circle class="wn-warm" cx="0" cy="2.4" r="2.1"/></g>`;
    case 'lamp': // lamp post and stars
      return `<path class="wn-stroke" d="M0,10 V-8 M-4.5,-4 H4.5"/>
        <g class="wn-ink">
          <path d="M-3.4,-14.5 H3.4 L2.4,-8.5 H-2.4 Z"/>
          <rect x="-2.6" y="9" width="5.2" height="2.6" rx="0.6"/>
          ${star(-14, -9, 3.2)}${star(12, -13, 2.4)}${star(15, -3, 1.8)}
        </g>`;
  }
  return '';
}
function star(x, y, r) {
  const k = r * 0.32;
  return `<path d="M${x},${y - r} L${f1(x + k)},${f1(y - k)} L${x + r},${y} L${f1(x + k)},${f1(y + k)} L${x},${y + r} L${f1(x - k)},${f1(y + k)} L${x - r},${y} L${f1(x - k)},${f1(y - k)} Z"/>`;
}

function buildScene(root, L) {
  const id = `wn${++uid}`;
  const { W, Ht, cx, B } = L;
  const G = L.ground;
  const [px0, py0, px1, py1] = L.plate;
  const main = L.blds.find((b) => b.escape);
  const land = main.floors.map((y) => y + main.h + 8);

  // ---- the line: roof ladder → fire escape zig-zag → drop ladder → exit
  const FDX = Math.min(110, 2 * B - 30); // a steep flight, like the real thing
  const pts = [[cx, 0], [cx, land[0]]];
  const flights = [];
  let dir = 1;
  for (let k = 0; k < land.length - 1; k++) {
    const xa = cx + dir * (B - 8), xb = xa - dir * FDX;
    pts.push([xa, land[k]], [xb, land[k + 1]]);
    flights.push([xa, land[k], xb, land[k + 1]]);
    dir = -dir;
  }
  pts.push([cx, land[land.length - 1]], [cx, Ht]);
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const cum = [0];
  lens.forEach((l) => cum.push(cum[cum.length - 1] + l / total));
  const LINE_A = 0.02, LINE_B = 0.4;
  const atP = (frac) => LINE_A + frac * (LINE_B - LINE_A);
  // p at which the line arrives on landing k (point index 1 = roof ladder end, then pairs)
  const landP = land.map((_, k) => atP(cum[k === 0 ? 1 : 2 * k + 1]));
  const lineD = 'M' + pts.map((q) => `${q[0]},${q[1]}`).join(' L');

  // ---- fire-escape details (hairlines)
  let esc = '';
  land.forEach((y, k) => {
    const x0 = cx - B, x1 = cx + B, top = y - 30;
    let bal = '';
    for (let x = x0 + 12; x < x1 - 4; x += 12) bal += `M${f1(x)},${top} V${y}`;
    esc += `<g class="wn-escape" data-floor="${k}">
      <rect class="wn-slab" x="${x0 - 4}" y="${y}" width="${2 * B + 8}" height="4"/>
      <path d="M${x0},${y} V${top} H${x1} V${y} ${bal}"/>
      ${k > 0 ? (([xa, ya, xb, yb]) => `<path d="M${f1(xa)},${ya - 28} L${f1(xb)},${yb - 28} M${f1(xa)},${ya - 28} V${ya} M${f1(xb)},${yb - 28} V${yb}"/>`)(flights[k - 1]) : ''}
    </g>`;
  });

  // ---- buildings & windows
  const wins = [];
  let blds = '';
  L.blds.forEach((b, bi) => {
    blds += `<rect class="wn-bld wn-bld--${b.tone}" x="${b.x0}" y="${b.roof}" width="${b.x1 - b.x0}" height="${py1 - b.roof}"/>
      <rect class="wn-cornice" x="${b.x0}" y="${b.roof}" width="${b.x1 - b.x0}" height="8"/>
      <path class="wn-hair wn-hair--edge" d="M${b.x0},${b.roof + 8} H${b.x1}"/>`;
    b.floors.forEach((y, fi) => {
      blds += `<path class="wn-hair wn-course" data-floor="${fi}" data-b="${bi}" d="M${b.x0},${y + b.h + 16} H${b.x1}"/>`;
      b.bays.forEach(([x, w], ci) => {
        wins.push({ key: `${bi}-${fi}-${ci}`, x, y, w, h: b.h, bi, fi, behind: b.escape && x > cx - B - 4 && x + w < cx + B + 4 });
      });
    });
  });

  // floor reveal time: by matching the nearest main-building floor
  const floorP = (y) => {
    let best = 0;
    main.floors.forEach((fy, k) => { if (Math.abs(fy - y) < Math.abs(main.floors[best] - y)) best = k; });
    return landP[best];
  };

  const winSvg = wins
    .map((w) => {
      const spec = L.lights[w.key] || null;
      const ry = f1(w.h * L.rail);
      const lit = spec
        ? `<g class="wn-lit" data-lit="${w.key}" style="opacity:0">
            <rect class="wn-glow" x="-6" y="-6" width="${w.w + 12}" height="${w.h + 12}" rx="6" filter="url(#${id}-glow)"/>
            <rect class="wn-warmfill" width="${w.w}" height="${w.h}" fill="url(#${id}-warm)"/>
            ${spec.blind ? blind(w, spec.blind) : ''}
          </g>`
        : '';
      const card = spec && spec.film !== undefined ? filmCard(FILMS[spec.film], w, ry, w.key) : '';
      return `<g class="wn-win" data-win="${w.key}" transform="translate(${w.x},${w.y})">
          <rect class="wn-pane" width="${w.w}" height="${w.h}"/>
          <path class="wn-reflect" d="M${f1(w.w * 0.62)},4 L${f1(w.w - 4)},4 L${f1(w.w - 4)},${f1(w.h * 0.3)} Z"/>
          ${lit}${card}
          <path class="wn-sash" d="M0,${ry} H${w.w} ${w.w > 80 ? `M${w.w / 2},0 V${ry}` : ''}"/>
          <rect class="wn-frame" width="${w.w}" height="${w.h}"/>
          <rect class="wn-sill" x="-5" y="${w.h}" width="${w.w + 10}" height="4"/>
          <rect class="wn-lintel" x="-3" y="-7" width="${w.w + 6}" height="4"/>
        </g>`;
    })
    .join('');

  function blind(w, frac) {
    const bh = f1(w.h * frac);
    let slats = '';
    for (let y = 6; y < bh - 2; y += 6) slats += `M0,${y} H${w.w}`;
    return `<rect class="wn-blind" width="${w.w}" height="${bh}"/><path class="wn-slat" d="${slats}"/>
      <rect class="wn-blind-bar" x="0" y="${bh - 3}" width="${w.w}" height="3"/>
      <path class="wn-cord" d="M${w.w * 0.78},${bh} v${f1(w.h * 0.14)}"/><circle class="wn-blind" cx="${w.w * 0.78}" cy="${f1(bh + w.h * 0.14 + 1.6)}" r="1.8"/>`;
  }

  function filmCard(f, w, ry, key) {
    const mid = w.w / 2;
    const two = f.title.length > 1;
    const ts = w.w >= 100 ? 12.5 : 12;
    const tY = two ? ry + 19 : ry + 23;
    const title = f.title.map((t, i) => `<tspan x="${mid}" y="${f1(tY + i * (ts + 1.5))}">${t}</tspan>`).join('');
    const yY = two ? w.h - 9 : w.h - 13;
    return `<g class="wn-card" data-card="${key}" style="opacity:0">
      <g transform="translate(${mid},${f1(ry / 2 + 1)}) scale(${w.w >= 100 ? 1.05 : 1})">${icon(f.icon)}</g>
      <text class="wn-title" text-anchor="middle" style="font-size:${ts}px">${title}</text>
      <text class="wn-year" x="${mid}" y="${f1(yY)}" text-anchor="middle">${f.year}</text>
    </g>`;
  }

  // ---- water tower
  const T = L.tower, tw = T.w, th = tw * 0.95;
  const tTop = T.base - tw * 0.5 - th;
  const tower = `<g class="wn-tower" aria-hidden="true">
    <path class="wn-tower-legs" d="M${f1(T.x - tw * 0.4)},${T.base} L${f1(T.x - tw * 0.34)},${f1(T.base - tw * 0.5)} M${f1(T.x + tw * 0.4)},${T.base} L${f1(T.x + tw * 0.34)},${f1(T.base - tw * 0.5)} M${f1(T.x - tw * 0.12)},${T.base} V${f1(T.base - tw * 0.5)} M${f1(T.x + tw * 0.12)},${T.base} V${f1(T.base - tw * 0.5)} M${f1(T.x - tw * 0.38)},${f1(T.base - 2)} L${f1(T.x + tw * 0.35)},${f1(T.base - tw * 0.48)} M${f1(T.x + tw * 0.38)},${f1(T.base - 2)} L${f1(T.x - tw * 0.35)},${f1(T.base - tw * 0.48)}"/>
    <rect class="wn-tank" x="${f1(T.x - tw * 0.42)}" y="${f1(tTop)}" width="${f1(tw * 0.84)}" height="${f1(th)}" rx="3"/>
    <path class="wn-tank" d="M${f1(T.x - tw * 0.47)},${f1(tTop + 2)} L${T.x},${f1(tTop - tw * 0.36)} L${f1(T.x + tw * 0.47)},${f1(tTop + 2)} Z"/>
    <path class="wn-hair" d="${[0.22, 0.48, 0.74].map((k) => `M${f1(T.x - tw * 0.42)},${f1(tTop + th * k)} H${f1(T.x + tw * 0.42)}`).join(' ')} M${T.x},${f1(tTop - tw * 0.36)} v-6"/>
    <rect class="wn-tank-shade" x="${f1(T.x + tw * 0.14)}" y="${f1(tTop)}" width="${f1(tw * 0.28)}" height="${f1(th)}" rx="2"/>
  </g>`;

  // ---- rooftop neon sign
  const S = L.sign, sw = S.x1 - S.x0, sh = S.y1 - S.y0, smid = (S.x0 + S.x1) / 2;
  let posts = '';
  const nPosts = sw > 200 ? 4 : 3;
  for (let i = 0; i < nPosts; i++) {
    const x = S.x0 + 14 + (i * (sw - 28)) / (nPosts - 1);
    posts += `M${f1(x)},${S.y1} V${S.base}`;
    if (i < nPosts - 1) {
      const x2 = S.x0 + 14 + ((i + 1) * (sw - 28)) / (nPosts - 1);
      posts += ` M${f1(x)},${S.y1} L${f1(x2)},${S.base} M${f1(x2)},${S.y1} L${f1(x)},${S.base}`;
    }
  }
  const labelLH = S.ls * 1.3;
  const numY = S.y0 + sh * 0.5 + S.num * 0.2 - (S.label.length - 1) * labelLH * 0.4;
  const labY = S.y1 - 18 - (S.label.length - 1) * labelLH;
  const signText = `
    <text class="wn-num" x="${smid}" y="${f1(numY)}" text-anchor="middle" style="font-size:${S.num}px">1,657</text>
    <text class="wn-label" text-anchor="middle" style="font-size:${S.ls}px">${S.label.map((t, i) => `<tspan x="${smid}" y="${f1(labY + i * labelLH)}">${t}</tspan>`).join('')}</text>`;
  const sign = `<g aria-hidden="true">
    <path class="wn-truss" d="${posts}"/>
    <rect class="wn-panel" x="${S.x0}" y="${S.y0}" width="${sw}" height="${sh}" rx="4"/>
    <g class="wn-neon" style="opacity:0">
      <g filter="url(#${id}-neon)" class="wn-neon-glow">
        <rect class="wn-tube" x="${S.x0 + 7}" y="${S.y0 + 7}" width="${sw - 14}" height="${sh - 14}" rx="3"/>
        ${signText}
      </g>
      <rect class="wn-tube" x="${S.x0 + 7}" y="${S.y0 + 7}" width="${sw - 14}" height="${sh - 14}" rx="3"/>
      ${signText}
    </g>
  </g>`;

  // ---- moon, stars, courtyard
  const [mx, my, mr] = L.moon;
  const sky = `<g aria-hidden="true">
    ${L.stars.map(([x, y], i) => `<circle class="wn-star" cx="${x}" cy="${y}" r="${i % 3 ? 1.1 : 1.6}"/>`).join('')}
    <path class="wn-moon" d="M${mx},${my - mr} A${mr},${mr} 0 1 0 ${mx},${my + mr} A${f1(mr * 0.72)},${mr} 0 1 1 ${mx},${my - mr} Z"/>
  </g>`;
  const court = `<g aria-hidden="true">
    <rect class="wn-court" x="${px0}" y="${G}" width="${px1 - px0}" height="${py1 - G}"/>
    <rect class="wn-fence" x="${px0}" y="${G - 6}" width="${px1 - px0}" height="34" fill="url(#${id}-picket)"/>
    <path class="wn-hair wn-hair--edge" d="M${px0},${G + 4} H${px1} M${px0},${G + 20} H${px1}"/>
    <rect class="wn-wall" x="${px0}" y="${G + 28}" width="${px1 - px0}" height="${py1 - G - 28}"/>
  </g>`;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'A Rear Window–style courtyard at night: an apartment facade with a fire escape, windows lighting up one by one. Four lit windows show favourite films — Rear Window (1954), The Beatles: Get Back (2021), Begin Again (2013), La La Land (2016) — and a rooftop neon sign reads 1,657 films logged on Letterboxd.');
  svg.innerHTML = `
  <defs>
    <linearGradient id="${id}-warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="wn-w0"/><stop offset="1" class="wn-w1"/>
    </linearGradient>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="wn-s0"/><stop offset="1" class="wn-s1"/>
    </linearGradient>
    <filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="${id}-neon" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
    <pattern id="${id}-picket" patternUnits="userSpaceOnUse" x="${cx - 5}" y="${G - 6}" width="10" height="34">
      <path class="wn-picket" d="M2,3 L5,0 L8,3 V34 H2 Z"/>
    </pattern>
    <clipPath id="${id}-plate"><rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}"/></clipPath>
  </defs>
  <g clip-path="url(#${id}-plate)">
    <rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}" fill="url(#${id}-sky)"/>
    ${sky}
    ${tower}
    ${sign}
    <g aria-hidden="true">${blds}</g>
    <g aria-hidden="true">${winSvg}</g>
    <g aria-hidden="true">${esc}</g>
    ${court}
  </g>
  <path class="wn-line" pathLength="1" d="${lineD}"/>`;
  root.append(svg);

  // ---- refs
  const line = svg.querySelector('.wn-line');
  const floorEls = [...svg.querySelectorAll('[data-floor]')].map((el) => {
    const fi = +el.dataset.floor;
    const b = el.dataset.b !== undefined ? L.blds[+el.dataset.b] : main;
    return { el, p: floorP(b.floors[fi]) };
  });
  const winEls = [...svg.querySelectorAll('.wn-win')].map((el) => {
    const w = wins.find((q) => q.key === el.dataset.win);
    return { el, p: floorP(w.y) };
  });
  const lits = [...svg.querySelectorAll('[data-lit]')].map((el) => ({ el, t: L.lights[el.dataset.lit].t }));
  const cards = [...svg.querySelectorAll('[data-card]')].map((el) => ({ el, t: L.lights[el.dataset.card].t + 0.03 }));
  const neon = svg.querySelector('.wn-neon');

  function update(p) {
    const lt = seg(p, LINE_A, LINE_B);
    line.style.strokeDashoffset = 1 - lt;
    line.style.opacity = lt > 0.002 ? 1 : 0;
    for (const f of floorEls) f.el.style.opacity = seg(p, f.p - 0.03, f.p + 0.03);
    for (const w of winEls) w.el.style.opacity = 0.25 + 0.75 * seg(p, w.p - 0.04, w.p + 0.03);
    for (const l of lits) l.el.style.opacity = seg(p, l.t, l.t + 0.025);
    for (const c of cards) c.el.style.opacity = seg(p, c.t, c.t + 0.04);
    // neon: a short, deterministic flicker, then steady
    const n = seg(p, 0.37, 0.46);
    const flick = n >= 1 ? 1 : n <= 0 ? 0 : (Math.sin(n * 61) > -0.1 ? 1 : 0.18) * (0.35 + 0.65 * n);
    neon.style.opacity = flick;
  }

  // user units per CSS pixel: keeps the line at exactly --line-w without non-scaling-stroke
  // (non-scaling-stroke breaks pathLength-normalised dashes in Chromium)
  const scaleTo = (px) => { if (px > 0) svg.style.setProperty('--wn-u', (W / px).toFixed(4)); };
  scaleTo(root.clientWidth);

  return { update, scaleTo };
}
