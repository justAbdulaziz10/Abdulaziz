// Rassah — the line draws an isometric open carton; products drop into their
// computed slots (3D bin packing), the flaps fold shut and the carton is ticked.
// Round 2: the last three products wait in a tray; the visitor packs them
// (drag, tap or Enter). Scrolling on packs whatever is left, so the story always ends.
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
const AUTO_IDS = ['a', 'book', 'g', 'm'];       // packed by the scroll before the tray appears
const TRAY_IDS = ['bottle', 'y', 's'];          // the three the visitor packs (tray order, back to front)
const TRAY_NAMES = { bottle: 'the bottle', y: 'the small box', s: 'the flat blue box' };

const T = {
  entry: [0.03, 0.09], rim: [0.09, 0.145], vert: [0.14, 0.185], bottom: [0.18, 0.22],
  walls: [0.13, 0.21], open: [0.16, 0.24],
  drop0: 0.22, dropDur: 0.065, dropGap: 0.025,
  tray: [0.34, 0.42],                           // tray slides in; the interactive hold runs to auto0
  auto0: 0.6, autoGap: 0.016, autoDur: 0.045,    // scroll packs whatever is still in the tray
  close: [0.675, 0.79], exit: [0.79, 0.89],
  forget: 0.3,                                  // scrolling back above this restores the tray
};
// sub-phases of the closing progress C (scroll or visitor driven)
const CL = { short: [0, 0.45], long: [0.27, 0.72], solid: [0.1, 0.72], tape: [0.7, 0.86], tick: [0.8, 1] };
const OPEN_BACK = 160, OPEN_FRONT = 192;       // degrees from "closed, pointing inward"
const DROP_Z = 3.6;
const DUR = { pack: 560, ret: 420, pop: 380, close: 600, reopen: 450 };
const SNAP_R = 270, GHOST_R = 430;              // release radius / ghost fade-in radius (viewBox units)

const TRAY = { L: 8.1, D: 2.9, th: 0.32, ly: 1.45, lx: { bottle: 1.2, y: 3.65, s: 6.5 } };
const LAYOUTS = {
  wide: { vb: [-10.5 * U, -5.85 * U, 21 * U, 12.6 * U], tray: { x: -404, y: 72, k: 0.55 }, ui: [-352, 4], reset: [-352, 300] },
  narrow: { vb: [-7.3 * U, -6.4 * U, 14.6 * U, 16.6 * U], tray: { x: -288, y: 330, k: 0.56 }, ui: [-196, 276], reset: [-196, 280] },
};
const EXIT_Y = 10.2 * U;

export function mount(root, { reduced = false } = {}) {
  const mq = matchMedia('(max-width: 640px)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  root.classList.toggle('is-reduced-motion', reduced);
  const svg = el('svg', {
    role: 'img',
    'aria-label': 'An isometric open carton drawn by a single line; products of different sizes drop into computed slots, the flaps fold shut and the carton is ticked as the cheapest safe fit.',
    preserveAspectRatio: 'xMidYMid meet',
  });
  root.appendChild(svg);
  // the tray lives in its own (non-img) svg on top, so its products can be real controls
  const top = el('svg', { class: 'rs-overlay', role: 'group', 'aria-label': 'Products to pack', preserveAspectRatio: 'xMidYMid meet' });
  root.appendChild(top);
  const lines = [];   // {el, a, b} dash-drawn strokes
  const hiddenLines = [];
  let L = LAYOUTS.wide;

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
  el('rect', { x: -20 * U, y: -12 * U, width: 40 * U, height: 26 * U, fill: 'url(#rs-dots)', mask: 'url(#rs-dots-mask)', class: 'rs-dots', 'aria-hidden': 'true' }, svg);
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
  const gTray = el('g', { class: 'rs-tray', 'aria-hidden': 'true' }, top);
  const gLoose = el('g', {}, top);

  // shadow
  const sc = P(W / 2, D / 2, 0);
  el('ellipse', { cx: r3(sc[0] + 0.3 * U), cy: r3(sc[1] + 0.35 * U), rx: r3(6.4 * U), ry: r3(2.6 * U), fill: 'url(#rs-shadow)' }, gShadow);
  el('ellipse', { cx: r3(sc[0] + 0.15 * U), cy: r3(sc[1] + 0.2 * U), rx: r3(4.6 * U), ry: r3(1.55 * U), fill: 'url(#rs-shadow)' }, gShadow);

  // ---------- walls ----------
  el('polygon', { points: pts([[0, 0, 0], [0, D, 0], [0, D, H], [0, 0, H]]), class: 'rs-wall rs-wall--bx' }, gBackWalls);
  el('polygon', { points: pts([[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]]), class: 'rs-wall rs-wall--by' }, gBackWalls);
  el('polygon', { points: pts([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]]), class: 'rs-floor' }, gBackWalls);
  // floor grid (the packing engine's lattice)
  const grid = el('g', { class: 'rs-grid' }, gBackWalls);
  for (let x = 0.5; x < W - 0.01; x += 0.5) el('path', { d: dPath([[x, 0, 0], [x, D, 0]]) }, grid);
  for (let y = 0.5; y < D - 0.01; y += 0.5) el('path', { d: dPath([[0, y, 0], [W, y, 0]]) }, grid);
  el('polygon', { points: pts([[0, D, 0], [W, D, 0], [W, D, H], [0, D, H]]), class: 'rs-wall rs-wall--fy' }, gFrontWalls);
  el('polygon', { points: pts([[W, 0, 0], [W, D, 0], [W, D, H], [W, 0, H]]), class: 'rs-wall rs-wall--fx' }, gFrontWalls);

  // ---------- line ----------
  const mkLine = (d, parent, a, b, extra = '') => {
    const p = el('path', { d, class: 'rs-line ' + extra, pathLength: 1 }, parent);
    const o = { el: p, a, b };
    lines.push(o);
    return o;
  };
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
  const exitLine = mkLine(`M${r3(pB[0])} ${r3(pB[1])}L${r3(pB[0])} ${r3(pB[1] + 0.25 * U)}C${r3(pB[0])} ${r3(pB[1] + 1.0 * U)} 0 ${r3(pB[1] + 0.75 * U)} 0 ${r3(pB[1] + 1.55 * U)}L0 ${EXIT_Y}`, gLine, ...T.exit, 'rs-line--exit');

  // ---------- items ----------
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
  const ell = (rad) => [rad * C30 * U * Math.SQRT2, rad * S30 * U * Math.SQRT2];
  // draws a product at its packed slot; returns its screen bbox [x0, y0, x1, y1]
  function drawItem(it, g, ghost) {
    if (it.kind === 'box') {
      boxFaces(g, it.b);
      if (ghost) wire(ghost, it.b);
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
      return [P(x, y + d, z)[0], P(x, y, z + h)[1], P(x + w, y, z)[0], P(x + w, y + d, z)[1]];
    }
    if (it.kind === 'book') {
      const [x, y, z, w, d, h] = it.b;
      const cv = 0.07;
      el('polygon', { points: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]), class: 'it-pages it-pages--r' }, g);
      el('polygon', { points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-pages' }, g);
      for (let k = 1; k < 4; k++) {
        const zz = z + cv + (h - 2 * cv) * k / 4;
        el('path', { d: dPath([[x + 0.05, y + d, zz], [x + w, y + d, zz], [x + w, y + 0.05, zz]]), class: 'it-page-line' }, g);
      }
      el('polygon', { points: pts([[x, y + d, z + h - cv], [x + w, y + d, z + h - cv], [x + w, y, z + h - cv], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-l' }, g);
      el('polygon', { points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y, z], [x + w, y, z + cv], [x + w, y + d, z + cv], [x, y + d, z + cv]]), class: 'it-r' }, g);
      el('polygon', { points: pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]), class: 'it-t' }, g);
      el('polygon', { points: pts([[x + 0.22, y + 0.22, z + h], [x + w - 0.22, y + 0.22, z + h], [x + w - 0.22, y + d - 0.22, z + h], [x + 0.22, y + d - 0.22, z + h]]), class: 'it-cover-rule' }, g);
      el('path', { d: dPath([[x + w, y + d, z + h], [x, y + d, z + h]]) + dPath([[x + w, y + d, z + h], [x + w, y, z + h]]), class: 'it-hi' }, g);
      if (ghost) wire(ghost, it.b);
      return [P(x, y + d, z)[0], P(x, y, z + h)[1], P(x + w, y, z)[0], P(x + w, y + d, z)[1]];
    }
    // bottle
    const { cx, cy, r, h } = it;
    const [bx, by] = P(cx, cy, 0);
    const [rx, ry] = ell(r);
    const hb = 1.7 * U, hs = 2.12 * U, hn = 2.42 * U, ht = h * U;
    const [nx] = ell(0.27), [qx, qy] = ell(0.31);
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
    const l0 = 0.55 * U, l1 = 1.3 * U;
    el('path', { d: `M${r3(bx - rx)} ${r3(by - l1)}L${r3(bx - rx)} ${r3(by - l0)}A${r3(rx)} ${r3(ry)} 0 0 0 ${r3(bx + rx)} ${r3(by - l0)}L${r3(bx + rx)} ${r3(by - l1)}A${r3(rx)} ${r3(ry)} 0 0 1 ${r3(bx - rx)} ${r3(by - l1)}Z`, class: 'it-bottle-label' }, g);
    el('path', { d: `M${r3(bx - qx)} ${r3(by - ht)}L${r3(bx - qx)} ${r3(by - hn + 0.04 * U)}A${r3(qx)} ${r3(qy)} 0 0 0 ${r3(bx + qx)} ${r3(by - hn + 0.04 * U)}L${r3(bx + qx)} ${r3(by - ht)}Z`, class: 'it-cap' }, g);
    el('ellipse', { cx: r3(bx), cy: r3(by - ht), rx: r3(qx), ry: r3(qy), class: 'it-cap-top' }, g);
    el('path', { d: `M${r3(bx - rx * 0.5)} ${r3(by - hb + 0.05 * U)}L${r3(bx - rx * 0.5)} ${r3(by - l1 - 0.1 * U)}M${r3(bx - rx * 0.5)} ${r3(by - l0 + 0.12 * U)}L${r3(bx - rx * 0.5)} ${r3(by + 0.05 * U)}`, class: 'it-spec' }, g);
    if (ghost) el('path', { d: `M${r3(bx - rx)} ${r3(by)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx + rx)} ${r3(by)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx - rx)} ${r3(by)}M${r3(bx - rx)} ${r3(by)}L${r3(bx - rx)} ${r3(by - hb)}M${r3(bx + rx)} ${r3(by)}L${r3(bx + rx)} ${r3(by - hb)}M${r3(bx - rx)} ${r3(by - hb)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx + rx)} ${r3(by - hb)}A${r3(rx)} ${r3(ry)} 0 1 0 ${r3(bx - rx)} ${r3(by - hb)}`, class: 'rs-ghost' }, ghost);
    return [bx - rx, by - ht - qy, bx + rx, by + ry];
  }
  // bottom-centre of a product's packed slot, in carton space
  const base = (it) => (it.kind === 'bottle' ? [it.cx, it.cy, 0] : [it.b[0] + it.b[3] / 2, it.b[1] + it.b[4] / 2, it.b[2]]);

  const items = {};
  for (const it of ITEMS) {
    const ghost = el('g', { class: 'rs-ghost-g', opacity: 0 }, gItems);
    const g = el('g', { class: 'rs-item rs-item--' + it.id, style: `--c:${it.c}`, opacity: 0 }, gItems);
    drawItem(it, g, ghost);
    items[it.id] = { it, g, ghost };
  }

  // ---------- the tray (visitor's three products) ----------
  const trayBody = el('g', {}, gTray);
  const { L: TL, D: TD, th: TH } = TRAY;
  el('polygon', { points: pts([[0, TD, 0], [TL, TD, 0], [TL, TD, -TH], [0, TD, -TH]]), class: 'rs-tray-l' }, trayBody);
  el('polygon', { points: pts([[TL, 0, 0], [TL, TD, 0], [TL, TD, -TH], [TL, 0, -TH]]), class: 'rs-tray-r' }, trayBody);
  el('polygon', { points: pts([[0, 0, 0], [TL, 0, 0], [TL, TD, 0], [0, TD, 0]]), class: 'rs-tray-t' }, trayBody);
  el('path', { d: dPath([[0, TD, 0], [TL, TD, 0], [TL, 0, 0]]), class: 'rs-tray-hi' }, trayBody);
  // empty footprints, so a packed product leaves its place on the tray
  for (const id of TRAY_IDS) {
    const it = ITEMS.find((q) => q.id === id);
    const lx = TRAY.lx[id], ly = TRAY.ly;
    if (it.kind === 'bottle') {
      const [cx, cy] = P(lx, ly, 0);
      const [rx, ry] = ell(it.r);
      el('ellipse', { cx: r3(cx), cy: r3(cy), rx: r3(rx), ry: r3(ry), class: 'rs-tray-slot' }, trayBody);
    } else {
      const w = it.b[3], d = it.b[4];
      el('polygon', { points: pts([[lx - w / 2, ly - d / 2, 0], [lx + w / 2, ly - d / 2, 0], [lx + w / 2, ly + d / 2, 0], [lx - w / 2, ly + d / 2, 0]]), class: 'rs-tray-slot' }, trayBody);
    }
  }

  const tray = {};   // per tray product: loose copy + interaction state
  TRAY_IDS.forEach((id, idx) => {
    const it = ITEMS.find((q) => q.id === id);
    const g = el('g', { class: 'rs-loose', tabindex: 0, role: 'button', 'aria-label': `Pack ${TRAY_NAMES[id]}`, style: `--c:${it.c}` }, gLoose);
    const bb = drawItem(it, el('g', {}, g), null);
    const pad = 14;
    // focus ring + generous hit area (drawn behind the product)
    const S = P(...base(it));
    const ringR = ell(it.kind === 'bottle' ? it.r + 0.45 : Math.max(it.b[3], it.b[4]) * 0.62);
    const ring = el('ellipse', { cx: r3(S[0]), cy: r3(S[1]), rx: r3(ringR[0]), ry: r3(ringR[1]), class: 'rs-focus' });
    const hit = el('rect', { x: r3(bb[0] - pad), y: r3(bb[1] - pad), width: r3(bb[2] - bb[0] + 2 * pad), height: r3(bb[3] - bb[1] + 2 * pad), class: 'rs-hit' });
    g.insertBefore(hit, g.firstChild);
    g.insertBefore(ring, g.firstChild);
    const zUp = (it.kind === 'bottle' ? 0 : -it.b[2]) + H + 0.6;
    tray[id] = { id, idx, it, g, S, zUp, mode: 'tray', user: false, A: [0, 0], k: 1, A0: [0, 0], k0: 1, t0: 0, gh: 0 };
  });

  // ---------- flaps ----------
  const FLAPS = {
    shortBack: { p0: T00, p1: T0D, n: [1, 0, 0], open: OPEN_BACK, back: true, close: CL.short },
    shortFront: { p0: TW0, p1: TWD, n: [-1, 0, 0], open: OPEN_FRONT, back: false, close: CL.short },
    longBack: { p0: T00, p1: TW0, n: [0, 1, 0], open: OPEN_BACK + 4, back: true, close: CL.long },
    longFront: { p0: T0D, p1: TWD, n: [0, -1, 0], open: OPEN_FRONT + 4, back: false, close: CL.long },
  };
  const flapShape = 'M0 0L1 0L0.985 1L0.015 1Z';
  const mkFlap = (parent) => {
    const g = el('g', {}, parent);
    const path = el('path', { d: flapShape, class: 'rs-flap' }, g);
    return { g, path };
  };
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
  const tc = [3.55, 3.3];
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

  // ---------- HTML: hint, reset, live region ----------
  const ui = document.createElement('div');
  ui.className = 'rs-ui';
  const hint = document.createElement('p');
  hint.className = 'rs-hint';
  const updateHint = () => { hint.textContent = coarsePointer.matches ? 'Drag or tap a product' : 'Drag a product in'; };
  updateHint();
  hint.setAttribute('aria-hidden', 'true');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'rs-reset';
  reset.setAttribute('aria-label', 'Put the products back in the tray');
  reset.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 6.4A5 5 0 1 1 3 9.6"/><path d="M2.6 2.9v3.7h3.7"/></svg><span>Reset</span>';
  ui.append(hint, reset);
  const live = document.createElement('p');
  live.className = 'rs-sr';
  live.setAttribute('aria-live', 'polite');
  root.append(ui, live);
  let hintUsed = false;
  try { hintUsed = sessionStorage.getItem('rs-hint') === '1'; } catch { /* storage blocked */ }
  if (hintUsed) hint.classList.add('is-used');
  const useHint = () => {
    if (hintUsed) return;
    hintUsed = true;
    hint.classList.add('is-used');
    try { sessionStorage.setItem('rs-hint', '1'); } catch { /* storage blocked */ }
  };

  // ---------- layout ----------
  let vbW = LAYOUTS.wide.vb[2];
  const restOf = (s) => {
    const { x, y, k } = L.tray;
    const q = P(TRAY.lx[s.id], TRAY.ly, 0);
    return [x + k * q[0], y + k * q[1]];
  };
  const setLayout = () => {
    L = mq.matches ? LAYOUTS.narrow : LAYOUTS.wide;
    vbW = L.vb[2];
    svg.setAttribute('viewBox', L.vb.join(' '));
    top.setAttribute('viewBox', L.vb.join(' '));
    root.dataset.layout = mq.matches ? 'narrow' : 'wide';
    const [vx, vy, vw, vh] = L.vb;
    const pct = (q, n) => {
      root.style.setProperty(`--rs-${n}-x`, r3(((q[0] - vx) / vw) * 100) + '%');
      root.style.setProperty(`--rs-${n}-y`, r3(((q[1] - vy) / vh) * 100) + '%');
    };
    pct(L.ui, 'hint');
    pct(L.reset, 'reset');
    const bottom = vy + vh;
    exitLine.el.setAttribute('d', `M${r3(pB[0])} ${r3(pB[1])}L${r3(pB[0])} ${r3(pB[1] + 0.25 * U)}C${r3(pB[0])} ${r3(pB[1] + 1.0 * U)} 0 ${r3(pB[1] + 0.75 * U)} 0 ${r3(pB[1] + 1.55 * U)}L0 ${r3(bottom + 4)}`);
  };
  setLayout();
  const ro = new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    if (w) root.style.setProperty('--rs-u', r3(vbW / w));
  });
  ro.observe(root);

  // ---------- state ----------
  const dropT = {};
  AUTO_IDS.forEach((id, i) => { dropT[id] = T.drop0 + i * T.dropGap; });
  const autoT = {};
  TRAY_IDS.forEach((id, i) => { autoT[id] = T.auto0 + i * T.autoGap; });
  const close = { v: 0, from: 0, to: 0, t0: 0, dur: 1 };   // visitor-driven closing progress
  let lastP = 0, lastTv = 0;
  const pEff = (p) => (reduced ? 0.5 : p);
  const anyUser = () => TRAY_IDS.some((id) => tray[id].user);
  const animating = () => TRAY_IDS.some((id) => /pack|return|pop/.test(tray[id].mode)) || close.v !== close.to;

  function setClose(to) {
    if (reduced) { close.v = close.from = close.to = to; return; }
    close.from = close.v; close.to = to; close.t0 = performance.now();
    close.dur = to > close.from ? DUR.close : DUR.reopen;
  }
  // advance time-based animations; returns nothing, mutates state
  function step(now) {
    for (const id of TRAY_IDS) {
      const s = tray[id];
      const d = s.mode === 'pack' ? DUR.pack : s.mode === 'return' ? DUR.ret : s.mode === 'pop' ? DUR.pop : 0;
      if (d && now - s.t0 >= d) {
        s.mode = s.mode === 'pack' ? 'packed' : 'tray';
        if (s.user && s.mode === 'packed') announce();
      }
    }
    if (close.v !== close.to) {
      const t = clamp((now - close.t0) / close.dur);
      close.v = t >= 1 ? close.to : close.from + (close.to - close.from) * t;
    }
    if (close.to === 0 && TRAY_IDS.every((id) => tray[id].mode === 'packed' && tray[id].user)) setClose(1);
  }
  function announce() {
    const left = TRAY_IDS.filter((id) => !tray[id].user).length;
    live.textContent = left ? `Packed. ${left} left in the tray.` : 'All packed. The carton closes and is ticked.';
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const backOut = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  // f in [0,1]: lift from A0 (scale k0) to just above the slot, then drop in with a small settle bounce
  function flight(s, f, A0, k0) {
    const ta = seg(f, 0, 0.55), tb = seg(f, 0.55, 1);
    const up = [s.S[0], s.S[1] - s.zUp * U];
    const e = eio(ta);
    const A = [lerp(A0[0], up[0], e), lerp(A0[1], up[1], e) - Math.sin(Math.PI * ta) * 46];
    const z = tb < 0.55 ? s.zUp * (1 - Math.pow(tb / 0.55, 2)) : 0.16 * Math.sin(Math.PI * (tb - 0.55) / 0.45);
    return { loose: tb > 0 ? 0 : 1, A, k: lerp(k0, 1, eo3(ta)), inside: tb > 0 ? 1 : 0, z, gh: 1 - seg(tb, 0.6, 1) };
  }

  let last = -1;
  function render(p, force) {
    if (p === last && !force) return;
    last = p;
    const now = performance.now();
    if (!reduced && p < T.forget && (anyUser() || close.v)) restoreAll(true);
    step(now);
    for (const o of lines) {
      const t = seg(p, o.a, o.b);
      o.el.style.strokeDashoffset = r3(1 - eio(t));
      o.el.style.opacity = t > 0 ? '' : 0;
    }
    if (reduced) { exitLine.el.style.strokeDashoffset = 0; exitLine.el.style.opacity = ''; }
    const C = Math.max(seg(p, ...T.close), close.v);
    const solid = eio(seg(C, ...CL.solid));
    for (const o of hiddenLines) if (seg(p, o.a, o.b) > 0) o.el.style.opacity = r3(1 - solid);
    const wa = eo3(seg(p, ...T.walls));
    gBackWalls.style.opacity = r3(wa);
    gFrontWalls.style.opacity = r3(wa);
    gShadow.style.opacity = r3(wa);
    root.style.setProperty('--rs-mat', r3(solid));

    // scroll-packed products
    for (const id of AUTO_IDS) {
      const t0 = dropT[id];
      const t = seg(p, t0, t0 + T.dropDur);
      const { g, ghost } = items[id];
      const z = (1 - eo3(t)) * DROP_Z;
      g.setAttribute('transform', `translate(0 ${r3(-z * U)})`);
      g.style.opacity = r3(seg(t, 0, 0.35));
      ghost.style.opacity = r3(seg(p, t0 - 0.035, t0) * (1 - seg(t, 0.75, 1)));
    }

    // tray + the visitor's products
    const tv = eo3(seg(p, ...T.tray));
    lastTv = tv;
    const trayOut = 1 - seg(C, 0.55, 0.95);
    const { x: TX, y: TY, k: TK } = L.tray;
    gTray.setAttribute('transform', `translate(${r3(TX - (1 - tv) * 34)} ${r3(TY)}) scale(${TK})`);
    gTray.style.opacity = r3(tv * trayOut);
    for (const id of TRAY_IDS) {
      const s = tray[id];
      const R = restOf(s);
      const sa = s.mode === 'tray' ? seg(p, autoT[id], autoT[id] + T.autoDur) : 0;
      let st;
      if (s.mode === 'packed') st = { loose: 0, inside: 1, z: 0, gh: 0, A: R, k: TK };
      else if (s.mode === 'pack') st = flight(s, clamp((now - s.t0) / DUR.pack), s.A0, s.k0);
      else if (s.mode === 'drag') st = { loose: 1, inside: 0, z: 0, gh: s.gh, A: s.A, k: s.k };
      else if (s.mode === 'return') {
        const t = clamp((now - s.t0) / DUR.ret), e = backOut(t);
        st = { loose: tv, inside: 0, z: 0, gh: s.gh * (1 - t), A: [lerp(s.A0[0], R[0], e), lerp(s.A0[1], R[1], e)], k: lerp(s.k0, TK, eo3(t)) };
      } else if (s.mode === 'pop') {
        const t = clamp((now - s.t0) / DUR.pop);
        st = { loose: tv * seg(t, 0, 0.4), inside: 0, z: 0, gh: 0, A: R, k: TK * (0.55 + 0.45 * backOut(t)) };
      } else if (sa > 0) st = flight(s, sa, [R[0] - (1 - tv) * 34 * TK, R[1]], TK);
      else st = { loose: tv, inside: 0, z: 0, gh: 0, A: [R[0] - (1 - tv) * 34 * TK, R[1]], k: TK };
      s.A = st.A; s.k = st.k;
      s.g.setAttribute('transform', `translate(${r3(st.A[0] - st.k * s.S[0])} ${r3(st.A[1] - st.k * s.S[1])}) scale(${r3(st.k)})`);
      s.g.style.opacity = r3(st.loose);
      const usable = st.loose > 0.5 && (s.mode === 'tray' || s.mode === 'drag') && sa === 0;
      s.g.style.setProperty('--v', st.loose > 0 ? 'visible' : 'hidden');
      s.g.style.setProperty('--pe', usable ? 'auto' : 'none');
      const { g, ghost } = items[id];
      g.setAttribute('transform', `translate(0 ${r3(-st.z * U)})`);
      g.style.opacity = st.inside;
      ghost.style.opacity = r3(st.gh);
    }
    const userOn = anyUser() && (reduced || (p >= T.tray[0] && p < T.auto0 + 0.06));
    root.style.setProperty('--rs-reset', userOn ? 1 : 0);
    root.style.setProperty('--rs-reset-v', userOn ? 'visible' : 'hidden');
    root.style.setProperty('--rs-hint', userOn ? 0 : r3(tv * (1 - seg(p, T.auto0 - 0.03, T.auto0))));

    // flaps
    const open = eo3(seg(p, ...T.open));
    for (const key in FLAPS) {
      const f = FLAPS[key];
      const c = eio(seg(C, ...f.close));
      const th = (open < 1 ? 90 + (f.open - 90) * open : f.open) * (1 - c);
      const rad = (th * Math.PI) / 180;
      const [nx, ny] = f.n;
      const dir = [Math.cos(rad) * nx, Math.cos(rad) * ny, Math.sin(rad)];
      const hv = V(f.p1[0] - f.p0[0], f.p1[1] - f.p0[1], 0);
      const fv = V(dir[0] * FL, dir[1] * FL, dir[2] * FL);
      const o = P(...f.p0);
      const m = `matrix(${r3(hv[0])} ${r3(hv[1])} ${r3(fv[0])} ${r3(fv[1])} ${r3(o[0])} ${r3(o[1])})`;
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
    const tt = eio(seg(C, ...CL.tape));
    tapeTop.setAttribute('transform', `scale(${r3(tt)} 1)`);
    tapeSide.style.opacity = r3(seg(C, CL.tape[1] - 0.04, CL.tape[1] + 0.04));
    const tk = seg(C, ...CL.tick);
    ring.style.strokeDashoffset = r3(1 - eio(seg(tk, 0, 0.7)));
    tick.style.strokeDashoffset = r3(1 - eo3(seg(tk, 0.35, 1)));
    ring.style.opacity = tk > 0 ? '' : 0;
    disc.style.opacity = r3(eio(seg(tk, 0.3, 0.75)));
    tick.style.opacity = tk > 0.35 ? '' : 0;
    root.style.setProperty('--rs-done', r3(tk));
  }

  // ---------- interaction ----------
  let raf = 0;
  const loop = () => {
    raf = 0;
    render(pEff(lastP), true);
    if (animating()) raf = requestAnimationFrame(loop);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const now = () => performance.now();

  function pack(s, fromCurrent) {
    useHint();
    s.user = true;
    if (reduced) { s.mode = 'packed'; announce(); step(now()); render(pEff(lastP), true); return; }
    s.A0 = fromCurrent ? s.A.slice() : restOf(s);
    s.k0 = fromCurrent ? s.k : L.tray.k;
    s.mode = 'pack'; s.t0 = now();
    kick();
  }
  function sendBack(s) {
    if (reduced) { s.mode = 'tray'; s.gh = 0; render(pEff(lastP), true); return; }
    s.A0 = s.A.slice(); s.k0 = s.k; s.mode = 'return'; s.t0 = now();
    kick();
  }
  function restoreAll(silent) {
    for (const id of TRAY_IDS) {
      const s = tray[id];
      const wasOut = s.user || s.mode !== 'tray';
      s.user = false; s.gh = 0;
      s.mode = !silent && !reduced && wasOut ? 'pop' : 'tray';
      s.t0 = now();
    }
    if (silent || reduced) { close.v = close.from = close.to = 0; } else setClose(0);
    gLoose.append(...TRAY_IDS.map((id) => tray[id].g));
    live.textContent = silent ? '' : 'The products are back in the tray.';
  }
  const toSvg = (e) => {
    const m = top.getScreenCTM();
    if (!m) return [0, 0];
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [q.x, q.y];
  };
  const cartonC = P(W / 2, D / 2, H * 0.55);
  const distC = (q) => Math.hypot(q[0] - cartonC[0], q[1] - cartonC[1]);

  const offs = [];
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)); };
  for (const id of TRAY_IDS) {
    const s = tray[id];
    let pid = null, start = null, grab = null, k0 = 1, dragging = false;
    on(s.g, 'pointerdown', (e) => {
      if (pid !== null || s.mode !== 'tray' || (!reduced && lastTv < 0.6) || e.button > 0) return;
      pid = e.pointerId; start = [e.clientX, e.clientY]; dragging = false;
      const q = toSvg(e);
      grab = [s.A[0] - q[0], s.A[1] - q[1]]; k0 = s.k;
      try { s.g.setPointerCapture(pid); } catch { /* element gone */ }
    });
    on(s.g, 'pointermove', (e) => {
      if (e.pointerId !== pid) return;
      if (!dragging) {
        if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 8) return;
        dragging = true; s.mode = 'drag'; useHint();
        gLoose.appendChild(s.g);  // lift above its neighbours
        s.g.classList.add('is-drag');
      }
      const q = toSvg(e);
      const d = distC(q);
      s.gh = clamp((GHOST_R - d) / (GHOST_R - SNAP_R));
      s.k = lerp(k0, 1, s.gh * 0.85);
      const sc = s.k / k0;
      s.A = [q[0] + grab[0] * sc, q[1] + grab[1] * sc];
      kick();
    });
    const end = (e, cancelled) => {
      if (e.pointerId !== pid) return;
      pid = null;
      s.g.classList.remove('is-drag');
      if (!dragging) { if (!cancelled) pack(s, false); return; }
      dragging = false;
      if (!cancelled && distC(toSvg(e)) < SNAP_R) pack(s, true);
      else sendBack(s);
    };
    on(s.g, 'pointerup', (e) => end(e, false));
    on(s.g, 'pointercancel', (e) => end(e, true));
    // Screen-reader activation dispatches click without a pointer sequence.
    on(s.g, 'click', (e) => {
      if (e.detail !== 0 || s.mode !== 'tray') return;
      pack(s, false);
      kick();
    });
    on(s.g, 'keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (s.mode !== 'tray') return;
      pack(s, false);
      render(pEff(lastP), true);
      const next = TRAY_IDS.map((q) => tray[q]).find((q) => q.mode === 'tray');
      (next ? next.g : reset).focus({ preventScroll: true });
    });
  }
  on(reset, 'click', () => {
    restoreAll(false);
    render(pEff(lastP), true);
    kick();
    if (document.activeElement === reset) tray[TRAY_IDS[0]].g.focus({ preventScroll: true });
  });

  render(pEff(0), true);
  const onMq = () => { setLayout(); render(pEff(lastP), true); };
  mq.addEventListener('change', onMq);
  coarsePointer.addEventListener('change', updateHint);

  return {
    update(p) {
      lastP = clamp(+p);
      render(pEff(lastP));
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      mq.removeEventListener('change', onMq);
      coarsePointer.removeEventListener('change', updateHint);
      ro.disconnect();
      svg.remove(); top.remove(); ui.remove(); live.remove();
    },
  };
}
