// Scene: abbey — the zebra crossing, an homage.
// The line drops in as the road's centre line, turns white on the asphalt and becomes the crossing:
// the centre stripe grows out of it, the others are laid outwards pair by pair. Four figures then
// cross left-to-right in single file, in stride, each in his own flat outfit colour.
// Tap / click / Enter ("Walk again") replays the crossing in full stride while the Beetle drives away.

const NS = 'http://www.w3.org/2000/svg';
const D = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const f1 = (n) => Math.round(n * 10) / 10;

// Two compositions: wide (landscape) and tall (portrait). Same world, re-framed.
const LAYOUTS = {
  wide: {
    W: 1200, Ht: 760, plate: [0, 44, 1200, 700],
    H: 330, vx: 600, s: 1.75, yF: 545, yN: 672,
    feetY: 630, figH: 214, spacing: 138, xa: 110, x55: 822, xb: 1075,
    trees: [
      [-1, 343], [-1, 358], [-1, 380], [-1, 410], [-1, 452], [-1, 515],
      [1, 346], [1, 364], [1, 390], [1, 428], [1, 488],
    ],
    beetle: { g: 404, u: -0.62 },
    beacons: true,
  },
  tall: {
    W: 600, Ht: 900, plate: [0, 40, 600, 830],
    H: 380, vx: 300, s: 1.45, yF: 642, yN: 805,
    feetY: 732, figH: 196, spacing: 118, xa: 16, x55: 472, xb: 578,
    trees: [
      [-1, 392], [-1, 406], [-1, 428], [-1, 462], [-1, 515],
      [1, 395], [1, 412], [1, 438], [1, 478], [1, 540],
    ],
    beetle: { g: 456, u: -0.62 },
    beacons: false,
  },
};

// Figure rig (local units, height 180, ground y = 0, facing +x).
const RIG = { Lt: 46, Ls: 42, sole: 4, hip: -92, sh: [1.5, -146], Lu: 32, Lf: 30 };
const CYCLE = 178; // forward travel per full gait cycle at scale 1 (keeps the stance foot planted)

// Each crosser: hair/beard profile, jacket length, scale, phase offset, bare feet.
const CAST = [
  // lead: long hair, full beard, long jacket
  { sc: 1.0, off: 0, hem: -74, bare: false, edge: true,
    hair: 'M7.5,-8 C4,-13.5 -6,-14 -10.5,-7.5 C-13.5,-2 -13,8 -12.5,15 C-12,19.5 -10,22 -7,21.5 L-4.5,10 C-6,4 -4,-1 1,-4.5 C4,-6 6.5,-6.5 7.5,-8 Z',
    beard: 'M-3,3 C-3,11 1,17 6.5,16.5 C10.5,16 12,11 11.5,6 L9,5.5 C7,8 3,8 -0.5,4.5 Z' },
  // second: dark suit, collar-length hair, beard; a touch shorter
  { sc: 0.955, off: 0, hem: -80, bare: false,
    hair: 'M7.5,-8.5 C4,-14 -6.5,-14 -10.5,-7 C-12.5,-3 -12.5,4 -11,8.5 C-9.5,10 -7.5,10 -6,8 C-6.5,3 -4,-1.5 1.5,-4.5 C4.5,-6 6.5,-6.5 7.5,-8.5 Z',
    beard: 'M-2,4 C-2,10 2,14 6.5,13.8 C10,13.6 11.5,10 11,6 L9,5.5 C7,7.5 3,7.5 0,5 Z' },
  // third: barefoot, out of step, clean-shaven, collar-length hair
  { sc: 0.99, off: Math.PI, hem: -80, bare: true, cig: true,
    hair: 'M8,-7.5 C5,-13.5 -6,-14.5 -10.5,-8 C-13,-4 -12.5,3 -10.5,7.5 C-9,9 -7,8.5 -6.5,6.5 C-7,2 -4.5,-2 0,-4.5 C3.5,-6.5 6.5,-5.5 8,-7.5 Z',
    beard: '' },
  // last: denim — short jacket, long full hair, beard
  { sc: 0.985, off: 0, hem: -90, bare: false,
    hair: 'M8,-8 C5,-15 -7.5,-15.5 -12,-8 C-15,-2.5 -14.5,9 -13.5,17 C-13,21 -10.5,23 -7.5,22 L-4.5,10 C-6,4 -3.5,-1.5 1.5,-4.8 C4.5,-6.5 7,-6 8,-8 Z',
    beard: 'M-3,3.5 C-3,11.5 1,16 6.5,15.6 C10.5,15.3 12,11 11.5,6 L9,5.5 C7,8 3,8 -0.5,4.5 Z' },
];

const SHOE = 'M-5,-2.5 C-5,-5 -2,-6 1,-6 L6,-5 C12,-4 17.5,-2 19.5,0.8 C20.6,2.6 19.8,4 17.6,4 L-3.6,4 C-5.6,4 -6,2 -5,-2.5 Z';
const BARE = 'M-4,-2.2 C-3,-4.2 0.5,-4.2 2.5,-3 C8,-1 13.5,0.2 17.5,1.6 C19.6,2.5 19.2,4 16.8,4 L3,4 C1.2,3.1 -1.2,3.5 -3.6,3.9 C-5.6,3.6 -5.2,0.2 -4,-2.2 Z';

let uid = 0;

const HINT_KEY = 'one:abbey:walked';
const STRIDE_S = 0.9; // seconds per full gait cycle on a replayed walk

export function mount(root, { reduced = false } = {}) {
  let mode = null;
  let scene = null;
  let lastP = reduced ? 0.55 : 0; // reduced: the cover moment, full stride

  root.classList.toggle('ab-reduced', reduced);
  // ---- "walk again": a full-cover button plus a one-time hint
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'ab-play';
  play.setAttribute('aria-label', 'Walk again');
  play.innerHTML = '<span class="ab-play-label" aria-hidden="true">Walk again</span>';
  const hint = document.createElement('p');
  hint.className = 'ab-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = matchMedia('(hover: hover) and (pointer: fine)').matches ? 'Click to cross' : 'Tap to cross';
  let seen = false;
  try { seen = localStorage.getItem(HINT_KEY) === '1'; } catch { /* storage blocked */ }
  if (seen) hint.hidden = true;

  // walk state
  let walk = null; // { lead, end, t, dur }
  let raf = 0, last = 0, timer = 0, crossed = false, visible = true;

  const build = (m) => {
    mode = m;
    root.textContent = '';
    scene = buildScene(root, LAYOUTS[m]);
    root.append(play, hint);
    const Lm = LAYOUTS[m];
    root.style.setProperty('--ab-top', `${((Lm.plate[1] / Lm.Ht) * 100).toFixed(2)}%`);
    root.style.setProperty('--ab-bot', `${(((Lm.Ht - Lm.plate[3]) / Lm.Ht) * 100).toFixed(2)}%`);
    if (walk) stopWalk();
    scene.update(lastP);
    if (reduced && crossed) scene.crossed(true);
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

  const used = () => {
    if (hint.hidden || hint.classList.contains('is-gone')) return;
    hint.classList.add('is-gone');
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* storage blocked */ }
  };

  function frame(now) {
    raf = 0;
    if (!walk) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); // hidden tab / long frame: just pause
    last = now;
    walk.t += dt;
    walk.lead += walk.v * dt;
    scene.walkFrame(walk.lead, walk.t / walk.dur);
    if (walk.lead >= walk.end) return finishWalk();
    raf = requestAnimationFrame(frame);
  }
  function startWalk() {
    used();
    if (reduced) { // instant state change instead of movement: the four are across, the car has gone
      crossed = !crossed;
      scene.crossed(crossed);
      if (!crossed) scene.update(lastP);
      return;
    }
    if (walk || !visible) return;
    const r = scene.walkRange();
    walk = { lead: r.start, end: r.end, v: r.v, t: 0, dur: (r.end - r.start) / r.v };
    scene.figsOut(); // the resting four fade, then the crossing starts from the left edge
    timer = setTimeout(() => {
      timer = 0;
      if (!walk) return;
      scene.walkFrame(walk.lead, 0);
      scene.figsShow(true);
      last = 0;
      raf = requestAnimationFrame(frame);
    }, 180);
  }
  function finishWalk() {
    walk = null;
    scene.walkDone(); // blend back: figures + Beetle return to whatever the scroll says
    scene.update(lastP);
  }
  function stopWalk() {
    cancelAnimationFrame(raf); raf = 0;
    clearTimeout(timer); timer = 0;
    walk = null;
  }

  const onClick = () => startWalk();
  play.addEventListener('click', onClick);

  // pause off-screen: a walk that leaves the viewport simply ends
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible && walk) { stopWalk(); scene.walkDone(true); scene.update(lastP); }
  });
  io.observe(root);

  return {
    update(p) {
      if (reduced) return; // finished composition, no movement
      lastP = p;
      scene.update(p, !!walk); // a playing walk owns the figures; scroll only drives the line + stripes
    },
    destroy() {
      stopWalk();
      io.disconnect();
      ro.disconnect();
      play.removeEventListener('click', onClick);
      root.textContent = '';
    },
  };
}

function buildScene(root, L) {
  const id = `ab${++uid}`;
  const { W, Ht, H, vx, s, yF, yN } = L;
  const [px0, py0, px1, py1] = L.plate;
  const hw = (y) => (y - H) * s;
  const X = (u, y) => vx + u * hw(y);
  const m1 = (y) => (2 * hw(y)) / 10; // one metre at ground depth y (road ~10 m wide)
  const P = (pts) => pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

  // ---- road, kerbs, crossing geometry
  const road = P([[vx - 0.6, H], [vx + 0.6, H], [X(1, py1), py1], [X(-1, py1), py1]]);
  const kerb = (sd) => P([[vx, H], [X(sd * 1.022, py1), py1], [X(sd * 1, py1), py1]]);

  // front gardens beyond the pavement: a dark hedge line converging on the vanishing point
  const UG = 1.75;
  const garden = (sd) => P([[vx, H], [X(sd * UG, py1), py1], [sd < 0 ? px0 - 400 : px1 + 400, py1], [sd < 0 ? px0 - 400 : px1 + 400, H]]);
  const hedge = (sd) => P([[vx, H], [X(sd * UG, py1), py1], [X(sd * UG, py1), py1 - 0.24 * hw(py1)]]);
  const N = 4; // stripes each side of the centre one
  const w = 1.9 / (4 * N + 1);
  const stripes = [];
  for (let i = -N; i <= N; i++) {
    const a = i * 2 * w - w / 2, b = i * 2 * w + w / 2;
    const xs = [X(a, yF), X(b, yF), X(b, yN), X(a, yN)];
    stripes.push({ i, pts: P([[xs[0], yF], [xs[1], yF], [xs[2], yN], [xs[3], yN]]), x0: Math.min(...xs) - 2, x1: Math.max(...xs) + 2 });
  }

  // ---- trees (flat rounded canopies receding along both pavements)
  const trees = L.trees
    .map(([sd, g]) => {
      const th = 2.55 * (g - H);
      const x = vx + sd * hw(g) * 1.3;
      return { sd, g, th, x, rx: th * 0.25, ry: th * 0.29, cy: g - th * 0.64, tw: Math.max(1.2, th * 0.016) };
    })
    .sort((a, b) => a.g - b.g);
  const treeSvg = trees
    .map((t, n) => {
      const tone = n % 2 ? 'ab-tree ab-tree--b' : 'ab-tree';
      const fade = clamp(0.26 + ((t.g - H) / (yF - H)) * 1.1, 0.26, 1);
      const sh = `<rect x="${f1(t.x - t.tw / 2)}" y="${f1(t.cy)}" width="${f1(t.tw)}" height="${f1(t.g - t.cy)}"/><ellipse cx="${f1(t.x)}" cy="${f1(t.cy)}" rx="${f1(t.rx)}" ry="${f1(t.ry)}"/>`;
      const cr = `M${f1(t.x)},${f1(t.cy - t.ry)} A${f1(t.rx)},${f1(t.ry)} 0 0 1 ${f1(t.x)},${f1(t.cy + t.ry)} A${f1(t.rx * 0.42)},${f1(t.ry)} 0 0 0 ${f1(t.x)},${f1(t.cy - t.ry)} Z`;
      return `<g class="ab-tree-base">${sh}</g><g class="${tone}" style="opacity:${fade.toFixed(2)}">${sh}<path class="ab-tree-shade" d="${cr}"/></g>`;
    })
    .join('');

  // ---- the Beetle (rear view), parked at the left kerb
  const bg = L.beetle.g, bsc = (m1(bg) * 1.6) / 100;
  const bx = X(L.beetle.u, bg);
  const beetleAt = (g, u) => `translate(${f1(X(u, g))},${f1(g)}) scale(${((m1(g) * 1.6) / 100).toFixed(4)})`;
  const beetle = `<g class="ab-beetle" transform="${beetleAt(bg, L.beetle.u)}">
      <ellipse class="ab-shadow" cx="0" cy="0.5" rx="52" ry="4"/>
      <rect class="ab-tyre" x="-45" y="-13" width="14" height="13" rx="3"/>
      <rect class="ab-tyre" x="31" y="-13" width="14" height="13" rx="3"/>
      <path class="ab-car" d="M-49,-13 L-49,-27 C-49,-35 -45,-39 -38.5,-40.5 C-36,-60 -21,-72.5 0,-72.5 C21,-72.5 36,-60 38.5,-40.5 C45,-39 49,-35 49,-27 L49,-13 Z"/>
      <path class="ab-car-shade" d="M38.5,-40.5 C45,-39 49,-35 49,-27 L49,-13 L34,-13 C36,-22 37,-32 38.5,-40.5 Z"/>
      <rect class="ab-glass" x="-15" y="-64.5" width="30" height="10" rx="4.5"/>
      <path class="ab-lid" d="M-12,-47 L12,-47 C13,-40 14,-31 14.5,-23 L-14.5,-23 C-14,-31 -13,-40 -12,-47 Z"/>
      <path class="ab-louvre" d="M-8,-44 H8 M-8,-41 H8 M-8,-38 H8"/>
      <rect class="ab-tail" x="-44.5" y="-35" width="4" height="9" rx="2"/>
      <rect class="ab-tail" x="40.5" y="-35" width="4" height="9" rx="2"/>
      <rect class="ab-bumper" x="-47" y="-17" width="94" height="3.4" rx="1.7"/>
    </g>`;
  const beetleMask = `<g transform="translate(${f1(bx)},${f1(bg)}) scale(${bsc.toFixed(3)})"><path d="M-49,-13 L-49,-27 C-49,-35 -45,-39 -38.5,-40.5 C-36,-60 -21,-72.5 0,-72.5 C21,-72.5 36,-60 38.5,-40.5 C45,-39 49,-35 49,-27 L49,0 L-49,0 Z"/></g>`;

  // ---- Belisha beacons at the far corners of the crossing
  let beacons = '';
  if (L.beacons) {
    const m = m1(yF), ph = 2.6 * m, pw = 0.1 * m, r = 0.19 * m;
    for (const sd of [-1, 1]) {
      const x = X(sd * 1.075, yF);
      const band = ph / 9;
      let bands = '';
      for (let k = 0; k < 9; k += 2) bands += `<rect class="ab-pole-b" x="${f1(x - pw / 2)}" y="${f1(yF - ph + k * band)}" width="${f1(pw)}" height="${f1(band)}"/>`;
      beacons += `<g class="ab-beacon">
        <rect class="ab-pole" x="${f1(x - pw / 2)}" y="${f1(yF - ph)}" width="${f1(pw)}" height="${f1(ph)}"/>${bands}
        <circle class="ab-globe" cx="${f1(x)}" cy="${f1(yF - ph - r * 0.9)}" r="${f1(r)}"/>
        <rect class="ab-pole" x="${f1(x - pw * 0.8)}" y="${f1(yF - 2)}" width="${f1(pw * 1.6)}" height="3" rx="1"/>
      </g>`;
    }
  }

  const LS = 'fill:none;stroke:var(--ab-ln);stroke-width:calc(var(--line-w) * var(--ab-u, 1));stroke-linecap:round;stroke-dasharray:1 2;stroke-dashoffset:1';
  // ---- the line (three legs so the crossing leg can hand over to the stripe)
  const lineSvg = `
    <path class="ab-line" style="${LS}" data-l="0" pathLength="1" d="M${vx},0 V${yF}"/>
    <path class="ab-line" style="${LS}" data-l="1" pathLength="1" d="M${vx},${yF} V${yN}"/>
    <path class="ab-line" style="${LS}" data-l="2" pathLength="1" d="M${vx},${yN} V${Ht}"/>`;

  // ---- figures
  const figSvg = CAST.map((c, n) => figureMarkup(c, n, id)).join('');

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Four figures walking in single file across a zebra crossing on a tree-lined street, a white Beetle parked at the kerb — an homage to the Abbey Road cover.');
  svg.innerHTML = `
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="ab-sky0"/><stop offset="1" class="ab-sky1"/>
    </linearGradient>
    <linearGradient id="${id}-road" gradientUnits="userSpaceOnUse" x1="0" y1="${H}" x2="0" y2="${yF}">
      <stop offset="0" class="ab-road0"/><stop offset="1" class="ab-road1"/>
    </linearGradient>
    <clipPath id="${id}-plate"><rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}"/></clipPath>
    ${stripes.map((st) => `<clipPath id="${id}-r${st.i}"><rect data-r="${st.i}" x="${f1(st.x0)}" y="${yF - 1}" width="${f1(st.x1 - st.x0)}" height="${yN - yF + 2}"/></clipPath>`).join('')}
    <g id="${id}-stripes">${stripes.map((st) => `<polygon class="ab-stripe" style="fill:var(--ab-sf)" clip-path="url(#${id}-r${st.i})" points="${st.pts}"/>`).join('')}</g>
    <g id="${id}-lines">${lineSvg}</g>
    <mask id="${id}-dark" maskUnits="userSpaceOnUse" x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}">
      <rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}" fill="#000"/>
      <rect x="${px0}" y="${H}" width="${px1 - px0}" height="${py1 - H}" fill="#fff"/>
      <use href="#${id}-stripes" style="--ab-sf:#000"/>
      <g fill="#000">${beetleMask}</g>
    </mask>
  </defs>
  <g clip-path="url(#${id}-plate)">
    <rect class="ab-skyrect" x="${px0}" y="${py0}" width="${px1 - px0}" height="${H - py0 + 1}" fill="url(#${id}-sky)"/>

    <rect class="ab-ground" x="${px0}" y="${H}" width="${px1 - px0}" height="${py1 - H}"/>
    <polygon class="ab-garden" points="${garden(-1)}"/><polygon class="ab-garden" points="${garden(1)}"/>
    <polygon class="ab-hedge" points="${hedge(-1)}"/><polygon class="ab-hedge" points="${hedge(1)}"/>
    <g aria-hidden="true">${treeSvg}</g>
    <polygon class="ab-road" points="${road}" fill="url(#${id}-road)"/>
    <polygon class="ab-kerb" points="${kerb(-1)}"/><polygon class="ab-kerb" points="${kerb(1)}"/>
    <use href="#${id}-stripes"/>
    <g aria-hidden="true">${beetle}</g>
    <g aria-hidden="true">${beacons}</g>
  </g>
  <use class="ab-lines" href="#${id}-lines"/>
  <use class="ab-lines ab-lines--inv" href="#${id}-lines" mask="url(#${id}-dark)"/>
  <g clip-path="url(#${id}-plate)">
    <g id="${id}-figs" class="ab-figs">${figSvg}</g>
  </g>`;
  root.append(svg);

  // ---- refs
  const lines = [...svg.querySelectorAll(`#${id}-lines .ab-line`)];
  const reveals = new Map([...svg.querySelectorAll('[data-r]')].map((r) => [+r.dataset.r, r]));
  const figs = [...svg.querySelectorAll(`#${id}-figs .ab-fig`)].map((g) => ({
    g,
    up: [...g.querySelectorAll('[data-up]')],
    seg: Object.fromEntries([...g.querySelectorAll('[data-s]')].map((e) => [e.dataset.s, e])),
  }));
  const figScale = L.figH / 180;

  const setT = (el, v) => el.setAttribute('transform', v);

  function poseFigure(f, c, x, phase) {
    const sc = figScale * c.sc;
    setT(f.g, `translate(${f1(x)},${L.feetY}) scale(${sc.toFixed(4)})`);
    const { Lt, Ls, sole, hip, sh, Lu, Lf } = RIG;
    const leg = (ph) => {
      const th = 6 + 19 * Math.sin(ph);
      const flex = 4 + 38 * Math.pow(Math.max(0, Math.cos(ph - 0.3)), 2);
      const al = th - flex;
      return { th, al, ext: Lt * Math.cos(th * D) + Ls * Math.cos(al * D) };
    };
    const A = leg(phase), B = leg(phase + Math.PI);
    const hy = -(Math.max(A.ext, B.ext) + sole);
    const dy = (hy - hip) * 0.85;
    const placeLeg = (k, lg) => {
      const kx = Lt * Math.sin(lg.th * D), ky = hy + Lt * Math.cos(lg.th * D);
      const ax = kx + Ls * Math.sin(lg.al * D), ay = ky + Ls * Math.cos(lg.al * D);
      setT(f.seg[k + 't'], `translate(0,${f1(hy)}) rotate(${f1(-lg.th)})`);
      setT(f.seg[k + 's'], `translate(${f1(kx)},${f1(ky)}) rotate(${f1(-lg.al)})`);
      const toe = Math.max(0, -lg.al - 10) * 0.6 - Math.max(0, lg.al - 12) * 0.5;
      setT(f.seg[k + 'f'], `translate(${f1(ax)},${f1(ay)}) rotate(${f1(toe)})`);
    };
    placeLeg('n', A);
    placeLeg('f', B);
    const up = `translate(0,${f1(dy)}) rotate(3.5,0,${hip})`;
    for (const u of f.up) setT(u, up);
    const arm = (k, sw) => {
      const be = sw;
      const el = 10 + 16 * clamp((sw + 20) / 40);
      const ex = Lu * Math.sin(be * D), ey = Lu * Math.cos(be * D);
      setT(f.seg[k + 'u'], `translate(${sh[0]},${sh[1]}) rotate(${f1(-be)})`);
      setT(f.seg[k + 'l'], `translate(${f1(sh[0] + ex)},${f1(sh[1] + ey)}) rotate(${f1(-(be + el))})`);
    };
    arm('n', -19 * Math.sin(phase));
    arm('f', 19 * Math.sin(phase));
  }

  // ease-out exponent chosen so the group is exactly at x55 (centred, mid-stride) at p = 0.55
  const K = Math.log(1 - (L.x55 - L.xa) / (L.xb - L.xa)) / Math.log(1 - (0.55 - 0.18) / 0.82);

  function update(p, walking = false) {
    // line
    const t0 = ease(seg(p, 0.02, 0.15));
    const t1 = ease(seg(p, 0.14, 0.2));
    const t2 = ease(seg(p, 0.38, 0.49));
    const draw = (el, t, o = 1) => {
      el.style.strokeDashoffset = 1 - t;
      el.style.opacity = t > 0.002 ? o : 0; // no stray round-cap dot before a leg starts
    };
    draw(lines[0], t0);
    draw(lines[1], t1, 1 - seg(p, 0.22, 0.27));
    draw(lines[2], t2);

    // stripes: centre grows out of the line, then pairs are laid far-to-near
    const c = ease(seg(p, 0.18, 0.26));
    setT(reveals.get(0), `translate(${vx},0) scale(${Math.max(0.0001, c).toFixed(4)},1) translate(${-vx},0)`);
    for (let k = 1; k <= N; k++) {
      const a = 0.215 + (k - 1) * 0.035;
      const t = Math.max(0.0001, ease(seg(p, a, a + 0.075)));
      const v = `translate(0,${yF}) scale(1,${t.toFixed(4)}) translate(0,${-yF})`;
      setT(reveals.get(k), v);
      setT(reveals.get(-k), v);
    }

    if (walking) return;
    // walkers: ease-out stroll, gait phase locked to distance travelled
    const u = seg(p, 0.18, 1);
    const lead = L.xa + (L.xb - L.xa) * (1 - Math.pow(1 - u, K));
    const phase = ((lead - L.x55) / (CYCLE * figScale)) * Math.PI * 2 + Math.PI / 2 + 0.12; // full stride at rest point
    figs.forEach((f, n) => {
      const cst = CAST[n];
      poseFigure(f, cst, lead - n * L.spacing, phase + cst.off);
    });
  }

  // user units per CSS pixel: keeps the line at exactly --line-w without non-scaling-stroke
  // (non-scaling-stroke breaks pathLength-normalised dashes in Chromium)
  const scaleTo = (px) => { if (px > 0) svg.style.setProperty('--ab-u', (W / px).toFixed(4)); };
  scaleTo(root.clientWidth);

  // ---- replayed walk: constant full stride from beyond the left edge until the last one is gone right
  const figsEl = svg.querySelector('.ab-figs');
  const beetleEl = svg.querySelector('.ab-beetle');
  const stride = CYCLE * figScale;
  const walkRange = () => ({ start: px0 - 34, end: px1 + 3 * L.spacing + 40, v: stride / STRIDE_S });
  function poseAll(lead, at = lead) {
    const phase = ((at - L.x55) / stride) * Math.PI * 2 + Math.PI / 2 + 0.12;
    figs.forEach((f, n) => poseFigure(f, CAST[n], lead - n * L.spacing, phase + CAST[n].off));
  }
  function walkFrame(lead, k) {
    poseAll(lead);
    // the Beetle pulls away up the left lane shortly after they set off, shrinking into the distance
    const d = clamp((k - 0.08) / 0.84);
    const e = d * d * (3 - 2 * d) * 0.55 + d * d * 0.45;
    const g = bg - (bg - (H + 2)) * e;
    setT(beetleEl, beetleAt(g, L.beetle.u + (-0.5 - L.beetle.u) * clamp(d * 3)));
    beetleEl.style.opacity = 1 - seg(d, 0.7, 1);
  }
  const figsOut = () => { figsEl.classList.add('is-out'); };
  const figsShow = (instant) => {
    figsEl.classList.toggle('is-instant', !!instant);
    figsEl.classList.remove('is-out');
  };
  function walkDone(instant) {
    // blend back: hide the (off-frame) walkers, re-pose at the scroll state, fade the four and the car back in
    figsEl.classList.add('is-instant', 'is-out');
    beetleEl.classList.add('is-instant');
    beetleEl.style.opacity = 0;
    setT(beetleEl, beetleAt(bg, L.beetle.u));
    void figsEl.getBoundingClientRect(); // commit the hidden state before fading in (event time, not update)
    figsEl.classList.toggle('is-instant', !!instant);
    beetleEl.classList.toggle('is-instant', !!instant);
    figsEl.classList.remove('is-out');
    beetleEl.style.opacity = '';
  }
  function crossed(on) { // reduced motion: an instant cut to "they made it across, the car has gone"
    if (on) poseAll(Math.min(L.xb, px1 - 78 * figScale), L.x55); // across, still in the cover's full stride
    beetleEl.style.opacity = on ? 0 : '';
  }

  return { update, scaleTo, walkRange, walkFrame, walkDone, figsOut, figsShow, crossed };
}

function figureMarkup(c, n, id) {
  const { Lt, Ls, Lu, Lf, hip } = RIG;
  const foot = c.bare ? BARE : SHOE;
  const legW = c.hem < -86 ? 13.6 : 15; // denim legs slimmer
  // per-part paint: outfit colours live in abbey.css on .ab-fig[data-n]; far side = deeper shade
  const P = (part, far) => `var(--${part}${far ? 'f' : ''})`;
  // stroke widths grow by --eg inside the .ab-edge clone (a one-piece silhouette under the white suit)
  const line = (L, w, col, k = '') => `<line ${k ? `data-s="${k}"` : ''} x1="0" y1="0" x2="0" y2="${L}" style="stroke:${col};stroke-width:calc(${w}px + var(--eg, 0px));stroke-linecap:round"/>`;
  const skin = (far) => (far ? 'var(--ab-skinf)' : 'var(--ab-skin)');
  const edge = 'stroke:var(--egs, none);stroke-width:2.4;stroke-linejoin:round;';
  const shin = (k, far) =>
    c.bare // bare feet: the trouser hem stops short and a slim ankle shows
      ? `<g data-s="${k}s">${line(Ls - 9, legW - 0.6, P('tr', far))}<line x1="0" y1="${Ls - 9}" x2="0" y2="${Ls}" style="stroke:${skin(far)};stroke-width:calc(5.4px + var(--eg, 0px));stroke-linecap:round"/></g>`
      : line(Ls, legW - 1.2, P('tr', far), k + 's');
  const legs = (k, far) =>
    `${line(Lt, legW, P('tr', far), k + 't')}${shin(k, far)}<path data-s="${k}f" style="${edge}fill:${c.bare ? skin(far) : P('sh', far)}" d="${foot}"/>`;
  const cig = c.cig ? `<path d="M1.5,${Lf + 2.5} L7.5,${Lf + 4.2}" style="stroke:var(--zebra);stroke-width:1.4;stroke-linecap:round"/>` : '';
  const arms = (k, far) =>
    `${line(Lu, 11, P('jk', far), k + 'u')}<g data-s="${k}l">${line(Lf - 3, 9.6, P('jk', far))}<circle cy="${Lf + 0.5}" r="4.3" style="${edge}fill:${skin(far)}"/>${far ? '' : cig}</g>`;
  const hem = c.hem;
  const torso = `M-9,-153 C-13,-149 -14.2,-138 -13.6,-126 C-13,-114 -11.6,-104 -11.6,-96 L-13.6,${hem} L13.8,${hem} L12.2,-100 C13.6,-112 15.8,-126 14.8,-138 C13.8,-147 8,-153.5 0,-154.5 Z`;
  const head = `<g transform="translate(2,-166.5) scale(1.06)">
      <circle r="11.4" style="${edge}fill:var(--ab-skin)"/>
      <path d="M10.2,-4 L14.4,1.8 L10.6,3.6 Z" style="fill:var(--ab-skin)"/>
      <circle cx="5.6" cy="-2.2" r="0.95" style="fill:var(--ink)"/>
      ${c.hair ? `<path style="fill:var(--hr)" d="${c.hair}"/>` : ''}
      ${c.beard ? `<path style="fill:var(--hr)" d="${c.beard}"/>` : ''}
    </g>`;
  return `${c.edge ? `<use class="ab-edge" href="#${id}-f${n}"/>` : ''}<g class="ab-fig" id="${id}-f${n}" data-n="${n}">
    <g data-up="1">${arms('f', true)}</g>
    ${legs('f', true)}
    <g data-up="1">
      <rect style="${edge}fill:var(--ab-skin)" x="-3.8" y="-158" width="7.6" height="11" rx="2"/>
      <path style="${edge}fill:var(--jk)" d="${torso}"/>
      <path d="M5.5,-152 L10.5,-128" style="fill:none;stroke:var(--jkf);stroke-width:1.3;stroke-linecap:round"/>
    </g>
    ${legs('n', false)}
    <g data-up="1">${arms('n', false)}${head}</g>
  </g>`;
}
