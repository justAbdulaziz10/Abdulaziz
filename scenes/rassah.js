// Rassah — the line draws an isometric open carton; products drop into their
// computed slots (3D bin packing), the flaps fold shut and the carton is ticked.
const NS = 'http://www.w3.org/2000/svg';
const U = 50;                                  // viewBox units per carton unit
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const W = 6, D = 4.4, H = 3.2, FL = 2.2;       // carton (x = width, y = depth, z = height), flap length

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const eo3 = (t) => 1 - Math.pow(1 - t, 3);
const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const r3 = (n) => Math.round(n * 1000) / 1000;

const P = (x, y, z) => [(x - y) * C30 * U, ((x + y) * S30 - z) * U];
const V = (x, y, z) => P(x, y, z);             // projection is linear: same for vectors
const pts = (list) => list.map((q) => P(...q).map(r3).join(',')).join(' ');
const dPath = (list, close) => 'M' + list.map((q) => P(...q).map(r3).join(' ')).join('L') + (close ? 'Z' : '');

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// Final packed positions [x, y, z, w, d, h] — computed slots, hand-checked for no overlap.
const ITEMS = [
  { id: 'a', kind: 'box', b: [0, 0, 0, 3.2, 2.4, 1.7], c: 'var(--paper)', tape: true },
  { id: 's', kind: 'box', b: [0, 0, 1.7, 2.2, 2.4, 1.0], c: 'var(--sky)' },
  { id: 'g', kind: 'box', b: [3.2, 0, 0, 2.8, 1.7, 2.3], c: 'var(--window-warm)', label: true },
  { id: 'book', kind: 'book', b: [0, 2.4, 0, 3.2, 2.0, 0.5], c: 'var(--night-2)' },
  { id: 'y', kind: 'box', b: [0, 2.4, 0.5, 1.7, 2.0, 0.9], c: 'var(--rassah-ink)' },
  { id: 'bottle', kind: 'bottle', cx: 4.05, cy: 3.1, r: 0.7, h: 2.75, c: 'var(--echo)' },
  { id: 'm', kind: 'box', b: [4.9, 1.7, 0, 1.1, 2.7, 1.4], c: 'var(--mara)' },
]; // listed back-to-front (painter's order)
const DROP_ORDER = ['a', 'book', 'g', 'm', 'bottle', 'y', 's'];

const T = {
  entry: [0.03, 0.1], rim: [0.1, 0.165], vert: [0.16, 0.21], bottom: [0.205, 0.25],
  walls: [0.15, 0.24], open: [0.18, 0.27],
  drop0: 0.25, dropDur: 0.07, dropGap: 0.023,
  closeShort: [0.5, 0.55], closeLong: [0.53, 0.58], solid: [0.51, 0.58],
  tape: [0.575, 0.6], tick: [0.59, 0.625], exit: [0.6, 0.7],
};
const OPEN_BACK = 160, OPEN_FRONT = 192;       // degrees from "closed, pointing inward"
const DROP_Z = 3.6;

const LAYOUTS = {
  wide: { vb: [-10.5 * U, -5.85 * U, 21 * U, 12.6 * U] },
  narrow: { vb: [-7.3 * U, -6.4 * U, 14.6 * U, 13.8 * U] },
};

export function mount(root, { reduced = false } = {}) {
  const mq = matchMedia('(max-width: 640px)');
  const svg = el('svg', {
    role: 'img',
    'aria-label': 'An isometric open carton drawn by a single line; products of different sizes drop into computed slots, the flaps fold shut and the carton is ticked as the cheapest safe fit.',
    preserveAspectRatio: 'xMidYMid meet',
  });
  root.appendChild(svg);
  const lines = [];   // {el, a, b} dash-drawn strokes
  const hiddenLines = [];

  let vbW = LAYOUTS.wide.vb[2];
  const setLayout = () => {
    const L = mq.matches ? LAYOUTS.narrow : LAYOUTS.wide;
    vbW = L.vb[2];
    svg.setAttribute('viewBox', L.vb.join(' '));
    root.dataset.layout = mq.matches ? 'narrow' : 'wide';
  };
  setLayout();
  // user units per CSS pixel, so dash-drawn strokes keep a true --line-w without non-scaling-stroke
  const ro = new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    if (w) root.style.setProperty('--rs-u', r3(vbW / w));
  });
  ro.observe(root);

  // ---------- defs ----------
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'rs-dots', patternUnits: 'userSpaceOnUse', width: r3(2 * C30 * U), height: U }, defs);
  for (const [x, y] of [[0, 0], [2 * C30 * U, 0], [0, U], [2 * C30 * U, U], [C30 * U, U / 2]]) el('circle', { cx: r3(x), cy: y, r: 1.3, class: 'rs-dot' }, pat);
  const rg = el('radialGradient', { id: 'rs-dots-fade', cx: '50%', cy: '48%', r: '55%' }, defs);
  el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '1' }, rg);
  el('stop', { offset: '1', 'stop-color': '#fff', 'stop-opacity': '0' }, rg);
  const mask = el('mask', { id: 'rs-dots-mask', maskContentUnits: 'objectBoundingBox' }, defs);
  el('rect', { width: 1, height: 1, fill: 'url(#rs-dots-fade)' }, mask);
  const sg = el('radialGradient', { id: 'rs-shadow' }, defs);
  el('stop', { offset: '0', class: 'rs-shadow-stop', 'stop-opacity': '0.8' }, sg);
  el('stop', { offset: '1', class: 'rs-shadow-stop', 'stop-opacity': '0' }, sg);
  const bg = el('linearGradient', { id: 'rs-bottle', x1: '0', x2: '1', y1: '0', y2: '0' }, defs);
  [[0, 'b0'], [0.22, 'b1'], [0.34, 'b2'], [0.62, 'b3'], [1, 'b4']].forEach(([o, c]) => el('stop', { offset: o, class: 'rs-' + c }, bg));

  // ---------- layers ----------
  const gDots = el('rect', { x: -20 * U, y: -12 * U, width: 40 * U, height: 24 * U, fill: 'url(#rs-dots)', mask: 'url(#rs-dots-mask)', class: 'rs-dots', 'aria-hidden': 'true' }, svg);
  const world = el('g', { 'aria-hidden': 'true' }, svg);
  const gShadow = el('g', {}, world);
  const gBackFlapsBehind = el('g', {}, world);
  const gBackWalls = el('g', { class: 'rs-walls' }, world);
  const gHidden = el('g', {}, world);
  const gItems = el('g', {}, world);
  const gFrontWalls = el('g', { class: 'rs-walls' }, world);
  const gEdges = el('g', {}, world);
  const gFlapsFront = el('g', {}, world);
  const gTop = el('g', {}, world);
  const gRim = el('g', {}, world);
  const gLine = el('g', {}, world);

  // shadow
  const sc = P(W / 2, D / 2, 0);
  el('ellipse', { cx: r3(sc[0] + 0.3 * U), cy: r3(sc[1] + 0.35 * U), rx: r3(6.4 * U), ry: r3(2.6 * U), fill: 'url(#rs-shadow)' }, gShadow);
  el('ellipse', { cx: r3(sc[0] + 0.15 * U), cy: r3(sc[1] + 0.2 * U), rx: r3(4.6 * U), ry: r3(1.55 * U), fill: 'url(#rs-shadow)' }, gShadow);

  // ---------- walls ----------
  const wallBackX = el('polygon', { points: pts([[0, 0, 0], [0, D, 0], [0, D, H], [0, 0, H]]), class: 'rs-wall rs-wall--bx' }, gBackWalls);
  const wallBackY = el('polygon', { points: pts([[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]]), class: 'rs-wall rs-wall--by' }, gBackWalls);
  const floor = el('polygon', { points: pts([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]]), class: 'rs-floor' }, gBackWalls);
  // floor grid (the packing engine's lattice)
  const grid = el('g', { class: 'rs-grid' }, gBackWalls);
  for (let x = 0.5; x < W - 0.01; x += 0.5) el('path', { d: dPath([[x, 0, 0], [x, D, 0]]) }, grid);
  for (let y = 0.5; y < D - 0.01; y += 0.5) el('path', { d: dPath([[0, y, 0], [W, y, 0]]) }, grid);
  const wallFrontY = el('polygon', { points: pts([[0, D, 0], [W, D, 0], [W, D, H], [0, D, H]]), class: 'rs-wall rs-wall--fy' }, gFrontWalls);
  const wallFrontX = el('polygon', { points: pts([[W, 0, 0], [W, D, 0], [W, D, H], [W, 0, H]]), class: 'rs-wall rs-wall--fx' }, gFrontWalls);

  // ---------- line ----------
  const mkLine = (d, parent, a, b, extra = '') => {
    const p = el('path', { d, class: 'rs-line ' + extra, pathLength: 1 }, parent);
    const o = { el: p, a, b };
    lines.push(o);
    return o;
  };
  const vb = LAYOUTS.wide.vb;
  const topY = -6.4 * U; // top edge of the tallest layout
  const T00 = [0, 0, H], TW0 = [W, 0, H], TWD = [W, D, H], T0D = [0, D, H];
  const B00 = [0, 0, 0], BW0 = [W, 0, 0], BWD = [W, D, 0], B0D = [0, D, 0];
  const pT00 = P(...T00);
  mkLine(`M0 ${topY}L${r3(pT00[0])} ${r3(pT00[1])}`, gLine, ...T.entry, 'rs-line--entry');
  mkLine(dPath([T00, TW0, TWD]), gRim, ...T.rim);
  mkLine(dPath([T00, T0D, TWD]), gRim, ...T.rim);
  mkLine(dPath([T0D, B0D]), gEdges, ...T.vert);
  mkLine(dPath([TW0, BW0]), gEdges, ...T.vert);
  mkLine(dPath([TWD, BWD]), gEdges, ...T.vert);
  hiddenLines.push(mkLine(dPath([T00, B00]), gHidden, ...T.vert, 'rs-line--hidden'));
  mkLine(dPath([B0D, BWD]), gEdges, ...T.bottom);
  mkLine(dPath([BW0, BWD]), gEdges, ...T.bottom);
  hiddenLines.push(mkLine(dPath([B00, BW0]), gHidden, ...T.bottom, 'rs-line--hidden'));
  hiddenLines.push(mkLine(dPath([B00, B0D]), gHidden, ...T.bottom, 'rs-line--hidden'));
  const pB = P(...BWD);
  const exitY = 7.4 * U;
  const exitLine = mkLine(`M${r3(pB[0])} ${r3(pB[1])}L${r3(pB[0])} ${r3(pB[1] + 0.25 * U)}C${r3(pB[0])} ${r3(pB[1] + 1.0 * U)} 0 ${r3(pB[1] + 0.75 * U)} 0 ${r3(pB[1] + 1.55 * U)}L0 ${exitY}`, gLine, ...T.exit, 'rs-line--exit');

  // ---------- items ----------
  const items = {};
  const boxFaces = (g, [x, y, z, w, d, h]) => {
    el('polygon', { points: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), class: 'it-r' }, g);
    el('polygon', { points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-l' }, g);
    el('polygon', { points: pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-t' }, g);
    el('path', { d: dPath([[x, y + d, z + h], [x + w, y + d, z + h], [x + w, y, z + h]]), class: 'it-hi' }, g);
    el('path', { d: dPath([[x + w, y + d, z], [x + w, y + d, z + h]]), class: 'it-crease' }, g);
  };
  const wire = (g, [x, y, z, w, d, h]) => {
    const c = [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]];
    const t = c.map(([a, b]) => [a, b, z + h]);
    let d0 = dPath(c, true) + dPath(t, true);
    for (let i = 0; i < 4; i++) d0 += dPath([c[i], t[i]]);
    el('path', { d: d0, class: 'rs-ghost' }, g);
  };
  for (const it of ITEMS) {
    const ghost = el('g', { class: 'rs-ghost-g', opacity: 0 }, gItems);
    const g = el('g', { class: 'rs-item rs-item--' + it.id, style: `--c:${it.c}`, opacity: 0 }, gItems);
    if (it.kind === 'box') {
      boxFaces(g, it.b);
      wire(ghost, it.b);
      const [x, y, z, w, d, h] = it.b;
      if (it.tape) { // tape strip across the top along y
        const tw = 0.28;
        el('polygon', { points: pts([[x + w / 2 - tw, y, z + h], [x + w / 2 + tw, y, z + h], [x + w / 2 + tw, y + d, z + h], [x + w / 2 - tw, y + d, z + h]]), class: 'it-tape' }, g);
        el('polygon', { points: pts([[x + w / 2 - tw, y + d, z + h], [x + w / 2 + tw, y + d, z + h], [x + w / 2 + tw, y + d, z + h - 0.45], [x + w / 2 - tw, y + d, z + h - 0.45]]), class: 'it-tape it-tape--side' }, g);
      }
      if (it.label) { // printed label block on the front-left face
        el('polygon', { points: pts([[x + 0.35, y + d, z + 0.5], [x + 1.45, y + d, z + 0.5], [x + 1.45, y + d, z + 1.25], [x + 0.35, y + d, z + 1.25]]), class: 'it-label' }, g);
        for (const zz of [1.05, 0.88, 0.71]) el('path', { d: dPath([[x + 0.5, y + d, z + zz], [x + (zz === 0.71 ? 0.95 : 1.3), y + d, z + zz]]), class: 'it-label-line' }, g);
      }
    } else if (it.kind === 'book') {
      const [x, y, z, w, d, h] = it.b;
      const cv = 0.07;
      // pages
      el('polygon', { points: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), class: 'it-pages it-pages--r' }, g);
      el('polygon', { points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-pages' }, g);
      for (let k = 1; k < 4; k++) {
        const zz = z + cv + (h - 2 * cv) * k / 4;
        el('path', { d: dPath([[x + 0.05, y + d, zz], [x + w, y + d, zz], [x + w, y + 0.05, zz]]), class: 'it-page-line' }, g);
      }
      // boards (top & bottom bands in cover colour)
      el('polygon', { points: pts([[x, y + d, z + h - cv], [x + w, y + d, z + h - cv], [x + w, y, z + h - cv], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-l' }, g);
      el('polygon', { points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y, z], [x + w, y, z + cv], [x + w, y + d, z + cv], [x, y + d, z + cv]]), class: 'it-r' }, g);
      el('polygon', { points: pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-t' }, g);
      // cover inset rule + spine band
      el('polygon', { points: pts([[x + 0.22, y + 0.22, z + h], [x + w - 0.22, y + 0.22, z + h], [x + w - 0.22, y + d - 0.22, z + h], [x + 0.22, y + d - 0.22, z + h]]), class: 'it-cover-rule' }, g);
      el('path', { d: dPath([[x + w, y + d, z + h], [x, y + d, z + h]]) + dPath([[x + w, y + d, z + h], [x + w, y, z + h]]), class: 'it-hi' }, g);
      wire(ghost, it.b);
    } else if (it.kind === 'bottle') {
      const { cx, cy, r, h } = it;
      const [bx, by] = P(cx, cy, 0);
      const k = U * Math.SQRT2;
      const ell = (rad) => [rad * C30 * k, rad * S30 * k];
      const [rx, ry] = ell(r);
      const hb = 1.7 * U, hs = 2.12 * U, hn = 2.42 * U, ht = h * U;
      const [nx, ny] = ell(0.27), [qx, qy] = ell(0.31);
      const d0 = [
        `M${r3(bx - rx)} ${r3(by - hb)}`,
        `L${r3(bx - rx)} ${r3(by)}`,
        `A${r3(rx)} ${r3(ry)} 0 0 0 ${r3(bx + rx)} ${r3(by)}`,
        `L${r3(bx + rx)} ${r3(by - hb)}`,
        `C${r3(bx + rx)} ${r3(by - hb - 0.28 * U)} ${r3(bx + nx)} ${r3(by - hs + 0.12 * U)} ${r3(bx + nx)} ${r3(by - hs)}`,
        `L${r3(bx + nx)} ${r3(by - hn)}`,
        `L${r3(bx - nx)} ${r3(by - hn)}`,
        `L${r3(bx - nx)} ${r3(by - hs)}`,
        `C${r3(bx - nx)} ${r3(by - hs + 0.12 * U)} ${r3(bx - rx)} ${r3(by - hb - 0.28 * U)} ${r3(bx - rx)} ${r3(by - hb)}Z`,
      ].join('');
      el('path', { d: d0, class: 'it-bottle' }, g);
      // label band
      const l0 = 0.55 * U, l1 = 1.3 * U;
      el('path', { d: `M${r3(bx - rx)} ${r3(by - l1)}L${r3(bx - rx)} ${r3(by - l0)}A${r3(rx)} ${r3(ry)} 0 0 0 ${r3(bx + rx)} ${r3(by - l0)}L${r3(bx + rx)} ${r3(by - l1)}A${r3(rx)} ${r3(ry)} 0 0 1 ${r3(bx - rx)} ${r3(by - l1)}Z`, class: 'it-bottle-label' }, g);
      // cap
      el('path', { d: `M${r3(bx - qx)} ${r3(by - ht)}L${r3(bx - qx)} ${r3(by - hn + 0.04 * U)}A${r3(qx)} ${r3(qy)} 0 0 0 ${r3(bx + qx)} ${r3(by - hn + 0.04 * U)}L${r3(bx + qx)} ${r3(by - ht)}Z`, class: 'it-cap' }, g);
      el('ellipse', { cx: r3(bx), cy: r3(by - ht), rx: r3(qx), ry: r3(qy), class: 'it-cap-top' }, g);
      // specular
      el('path', { d: `M${r3(bx - rx * 0.5)} ${r3(by - hb + 0.05 * U)}L${r3(bx - rx * 0.5)} ${r3(by - l1 - 0.1 * U)}M${r3(bx - rx * 0.5)} ${r3(by - l0 + 0.12 * U)}L${r3(bx - rx * 0.5)} ${r3(by + 0.05 * U)}`, class: 'it-spec' }, g);
      // ghost cylinder
      el('path', { d: `M${r3(bx - rx)} ${r3(by)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx + rx)} ${r3(by)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx - rx)} ${r3(by)}M${r3(bx - rx)} ${r3(by)}L${r3(bx - rx)} ${r3(by - hb)}M${r3(bx + rx)} ${r3(by)}L${r3(bx + rx)} ${r3(by - hb)}M${r3(bx - rx)} ${r3(by - hb)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx + rx)} ${r3(by - hb)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx - rx)} ${r3(by - hb)}`, class: 'rs-ghost' }, ghost);
    }
    items[it.id] = { g, ghost };
  }

  // ---------- flaps ----------
  // hinge P0 -> P1 on the rim, inward horizontal normal n.
  const FLAPS = {
    shortBack: { p0: T00, p1: T0D, n: [1, 0, 0], open: OPEN_BACK, back: true, close: T.closeShort },
    shortFront: { p0: TW0, p1: TWD, n: [-1, 0, 0], open: OPEN_FRONT, back: false, close: T.closeShort },
    longBack: { p0: T00, p1: TW0, n: [0, 1, 0], open: OPEN_BACK + 4, back: true, close: T.closeLong },
    longFront: { p0: T0D, p1: TWD, n: [0, -1, 0], open: OPEN_FRONT + 4, back: false, close: T.closeLong },
  };
  const flapShape = 'M0 0L1 0L0.985 1L0.015 1Z';
  const mkFlap = (parent) => {
    const g = el('g', {}, parent);
    const path = el('path', { d: flapShape, class: 'rs-flap' }, g);
    return { g, path };
  };
  // order matters for closing: short flaps under long flaps
  FLAPS.shortBack.behind = mkFlap(gBackFlapsBehind);
  FLAPS.longBack.behind = mkFlap(gBackFlapsBehind);
  FLAPS.shortBack.front = mkFlap(gFlapsFront);
  FLAPS.shortFront.front = mkFlap(gFlapsFront);
  FLAPS.longBack.front = mkFlap(gFlapsFront);
  FLAPS.longFront.front = mkFlap(gFlapsFront);
  const LIGHT = (() => { const v = [-0.25, 0.45, 1]; const m = Math.hypot(...v); return v.map((a) => a / m); })();

  // ---------- top: tape + tick ----------
  const topPlane = el('g', { transform: `matrix(${r3(C30 * U)} ${r3(S30 * U)} ${r3(-C30 * U)} ${r3(S30 * U)} 0 ${r3(-H * U)})` }, gTop);
  const tw = 0.3;
  const tapeTop = el('rect', { x: 0, y: r3(D / 2 - tw), width: W, height: r3(2 * tw), class: 'rs-tape', transform: 'scale(0 1)' }, topPlane);
  const sidePlane = el('g', { transform: `matrix(${r3(-C30 * U)} ${r3(S30 * U)} 0 ${-U} ${r3(P(W, 0, 0)[0])} ${r3(P(W, 0, 0)[1])})` }, gTop);
  const tapeSide = el('rect', { x: r3(D / 2 - tw), y: r3(H - 1.0), width: r3(2 * tw), height: 1.0, class: 'rs-tape rs-tape--side', opacity: 0 }, sidePlane);
  const tc = [3.55, 3.3]; // tick centre on the lid (front half, clear of the tape)
  const ax = [Math.SQRT1_2, -Math.SQRT1_2], dn = [Math.SQRT1_2, Math.SQRT1_2];
  const tp = (rr, dd) => P(tc[0] + rr * ax[0] + dd * dn[0], tc[1] + rr * ax[1] + dd * dn[1], H).map(r3).join(' ');
  let ringD = '';
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2 - Math.PI * 0.75;
    ringD += (i ? 'L' : 'M') + P(tc[0] + 0.92 * Math.cos(a), tc[1] + 0.92 * Math.sin(a), H).map(r3).join(' ');
  }
  const disc = el('path', { d: ringD + 'Z', class: 'rs-tick-disc', opacity: 0 }, gTop);
  const ring = el('path', { d: ringD, class: 'rs-tick-ring', pathLength: 1 }, gTop);
  const tick = el('path', { d: `M${tp(-0.46, 0.02)}L${tp(-0.12, 0.36)}L${tp(0.5, -0.34)}`, class: 'rs-tick', pathLength: 1 }, gTop);

  // ---------- update ----------
  const dropT = {};
  DROP_ORDER.forEach((id, i) => { dropT[id] = T.drop0 + i * T.dropGap; });

  let last = -1;
  function render(p) {
    if (p === last) return;
    last = p;
    for (const o of lines) {
      const t = seg(p, o.a, o.b);
      o.el.style.strokeDashoffset = r3(1 - eio(t));
      o.el.style.opacity = t > 0 ? '' : 0;
    }
    const solid = eio(seg(p, ...T.solid));
    for (const o of hiddenLines) if (seg(p, o.a, o.b) > 0) o.el.style.opacity = r3(1 - solid);
    const wa = eo3(seg(p, ...T.walls));
    gBackWalls.style.opacity = r3(wa);
    gFrontWalls.style.opacity = r3(wa);
    gShadow.style.opacity = r3(wa);
    root.style.setProperty('--rs-mat', r3(solid));

    // items
    for (const it of ITEMS) {
      const t0 = dropT[it.id];
      const t = seg(p, t0, t0 + T.dropDur);
      const { g, ghost } = items[it.id];
      const z = (1 - eo3(t)) * DROP_Z;
      g.setAttribute('transform', `translate(0 ${r3(-z * U)})`);
      g.style.opacity = r3(seg(t, 0, 0.35));
      const gh = seg(p, t0 - 0.035, t0) * (1 - seg(t, 0.75, 1));
      ghost.style.opacity = r3(gh);
    }

    // flaps
    const open = eo3(seg(p, ...T.open));
    for (const key in FLAPS) {
      const f = FLAPS[key];
      const c = eio(seg(p, ...f.close));
      const th = (open < 1 ? 90 + (f.open - 90) * open : f.open) * (1 - c);
      const rad = (th * Math.PI) / 180;
      const [nx, ny] = f.n;
      const dir = [Math.cos(rad) * nx, Math.cos(rad) * ny, Math.sin(rad)];
      const hv = V(f.p1[0] - f.p0[0], f.p1[1] - f.p0[1], 0);
      const fv = V(dir[0] * FL, dir[1] * FL, dir[2] * FL);
      const o = P(...f.p0);
      const m = `matrix(${r3(hv[0])} ${r3(hv[1])} ${r3(fv[0])} ${r3(fv[1])} ${r3(o[0])} ${r3(o[1])})`;
      // outer-surface normal; which side faces the viewer (view vector (1,1,1))
      const nOut = [-Math.sin(rad) * nx, -Math.sin(rad) * ny, Math.cos(rad)];
      const outer = nOut[0] + nOut[1] + nOut[2] > 0;
      const nv = outer ? nOut : nOut.map((a) => -a);
      const lit = clamp(nv[0] * LIGHT[0] + nv[1] * LIGHT[1] + nv[2] * LIGHT[2]);
      const k = Math.round(25 + 75 * lit);
      const vis = open > 0 ? 1 : 0;
      const apply = (fl, show) => {
        if (!fl) return;
        fl.g.setAttribute('transform', m);
        fl.path.style.setProperty('--k', k);
        fl.path.style.setProperty('--side', outer ? 0 : 1);
        fl.path.style.fillOpacity = f.back ? 1 : r3(0.16 + 0.84 * eio(seg(c, 0.25, 1)));
        fl.g.style.opacity = show ? r3(clamp(open * 1.6) * vis) : 0;
      };
      apply(f.behind, th > 90);
      apply(f.front, !f.back || th <= 90);
    }

    // tape + tick
    const tt = eio(seg(p, ...T.tape));
    tapeTop.setAttribute('transform', `scale(${r3(tt)} 1)`);
    tapeSide.style.opacity = r3(seg(p, T.tape[1] - 0.006, T.tape[1] + 0.006));
    const tk = seg(p, ...T.tick);
    ring.style.strokeDashoffset = r3(1 - eio(seg(tk, 0, 0.7)));
    tick.style.strokeDashoffset = r3(1 - eo3(seg(tk, 0.35, 1)));
    ring.style.opacity = tk > 0 ? '' : 0;
    disc.style.opacity = r3(eio(seg(tk, 0.3, 0.75)));
    tick.style.opacity = tk > 0.35 ? '' : 0;
    root.style.setProperty('--rs-done', r3(seg(p, T.tick[0], T.tick[1])));
  }

  const FINAL = 1;
  render(reduced ? FINAL : 0);
  const onMq = () => setLayout();
  mq.addEventListener('change', onMq);

  return {
    update(p) { if (!reduced) render(clamp(+p)); },
    destroy() { mq.removeEventListener('change', onMq); ro.disconnect(); svg.remove(); },
  };
}
