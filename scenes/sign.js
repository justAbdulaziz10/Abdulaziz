// The line signs his name: one stroke writes "Abdulaziz", then its tail pulls out and becomes the flow line.
// The signature is authored as pen knots (upright, baseline y = 0, x-height 40, y down), joined with a
// centripetal Catmull-Rom spline. 'c' marks a cusp (the pen turns sharply). 'u' marks the underline
// flourish, which ignores the baseline rise so it can land dead level and hand over to the straight line.
const NS = 'http://www.w3.org/2000/svg';
const SLANT = Math.tan(17 * Math.PI / 180);
const RISE = 0.045;
const I_DOT = [472, -33]; // center over the i's spike after the signature's slant is applied

const KNOTS = [
  // A
  [122, -64], [84, -70], [44, -70], [14, -60], [-2, -40], [-2, -14], [8, 2], [22, -16], [31, -60],
  [44, -114], [60, -156], [74, -174, 'c'], [83, -124], [90, -66], [97, -18], [107, 2], [122, -6],
  // b
  [144, -44], [162, -96], [174, -128], [176, -140], [168, -140], [162, -126], [158, -80], [155, -30], [156, -2],
  [164, 2], [178, -12], [188, -32], [188, -46], [178, -46], [178, -36], [192, -32], [208, -28], [222, -36],
  [232, -46, 'c'],
  // d
  [218, -48], [206, -36], [204, -12], [212, 1], [226, -6], [236, -40], [244, -92], [252, -130], [252, -142],
  [244, -136], [240, -110], [236, -60], [235, -18], [240, 2], [252, 0],
  // u
  [262, -18], [270, -40, 'c'], [268, -14], [275, 1], [288, -6], [298, -40, 'c'], [296, -12], [302, 1], [314, -8],
  // l
  [328, -50], [342, -104], [350, -136], [348, -146], [340, -140], [334, -110], [328, -56], [326, -14], [330, 2],
  [342, -2],
  // a
  [354, -26], [370, -42, 'c'], [356, -42], [346, -28], [346, -6], [356, 2], [368, -10], [376, -40, 'c'], [374, -14],
  [380, 1], [392, -8],
  // z: flat top, diagonal, a short foot, then the descending loop
  [400, -28], [407, -40], [414, -42], [436, -42, 'c'], [423, -22], [408, -2, 'c'], [424, -1], [434, 8], [437, 26],
  [432, 48], [420, 62], [407, 62], [408, 46], [428, 24], [450, 4], [466, -14],
  // i: a short x-height spike (its dot is placed after the stroke lands)
  [474, -27, 'c'], [472, -12], [477, 1], [488, -6],
  // z again, same form; its loop opens into the underline flourish
  [496, -28], [503, -40], [510, -42], [532, -42, 'c'], [519, -22], [504, -2, 'c'], [520, -1], [530, 8], [533, 26],
  [528, 48], [516, 62], [503, 62], [500, 74], [484, 84], [458, 90, 'u'], [400, 90, 'u'], [330, 90, 'u'], [270, 90, 'u'],
];

// centripetal Catmull-Rom → cubic Bézier, per run between cusps
function spline(pts) {
  const segs = [];
  const runs = [];
  let run = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    run.push(pts[i]);
    if (pts[i].c && i < pts.length - 1) { runs.push(run); run = [pts[i]]; }
  }
  runs.push(run);
  for (const r of runs) {
    const n = r.length;
    if (n < 2) continue;
    const P = (i) => {
      if (i < 0) return { x: 2 * r[0].x - r[1].x, y: 2 * r[0].y - r[1].y };
      if (i >= n) return { x: 2 * r[n - 1].x - r[n - 2].x, y: 2 * r[n - 1].y - r[n - 2].y };
      return r[i];
    };
    for (let i = 0; i < n - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const d1 = Math.max(1e-3, Math.hypot(p1.x - p0.x, p1.y - p0.y) ** 0.5);
      const d2 = Math.max(1e-3, Math.hypot(p2.x - p1.x, p2.y - p1.y) ** 0.5);
      const d3 = Math.max(1e-3, Math.hypot(p3.x - p2.x, p3.y - p2.y) ** 0.5);
      const b1 = {
        x: (d1 * d1 * p2.x - d2 * d2 * p0.x + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.x) / (3 * d1 * (d1 + d2)),
        y: (d1 * d1 * p2.y - d2 * d2 * p0.y + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1.y) / (3 * d1 * (d1 + d2)),
      };
      const b2 = {
        x: (d3 * d3 * p1.x - d2 * d2 * p3.x + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.x) / (3 * d3 * (d3 + d2)),
        y: (d3 * d3 * p1.y - d2 * d2 * p3.y + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2.y) / (3 * d3 * (d3 + d2)),
      };
      segs.push([p1, b1, b2, p2]);
    }
  }
  return segs;
}

// signature geometry in design units (slanted, risen), plus the point and level where the underline lands
export function signature() {
  let lift = 0;
  const pts = KNOTS.map(([x, y, f]) => {
    if (f !== 'u') lift = RISE * x; // the underline keeps the last letter's lift, so it stays level
    const yy = y - lift;
    return { x: x - SLANT * yy, y: yy, c: f === 'c' };
  });
  const segs = spline(pts);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of segs) for (const p of s) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const end = pts[pts.length - 1];
  const dy = I_DOT[1] - RISE * I_DOT[0];
  const dot = { x: I_DOT[0] - SLANT * dy, y: dy };
  return { segs, box: { x0, x1, y0, y1 }, end, dot, xh: 40 };
}

export function toD(segs, map = (p) => p) {
  const f = (v) => Math.round(v * 100) / 100;
  let d = '';
  segs.forEach(([a, b, c, e], i) => {
    const A = map(a), B = map(b), C = map(c), E = map(e);
    if (i === 0) d += `M${f(A.x)} ${f(A.y)}`;
    d += `C${f(B.x)} ${f(B.y)} ${f(C.x)} ${f(C.y)} ${f(E.x)} ${f(E.y)}`;
  });
  return d;
}

// ---- pen timing -------------------------------------------------------------------------------
// Pieces are plain geometry (line / quad / cubic, in px), sampled in JS: no DOM path queries on load.
function sample(pieces) {
  const pts = [];
  const push = (x, y) => pts.push({ x, y });
  for (const pc of pieces) {
    const [a] = pc.p;
    if (!pts.length) push(a.x, a.y);
    const n = pc.t === 'L' ? 2 : pc.t === 'Q' ? 12 : 24;
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      if (pc.t === 'L') { const [, b] = pc.p; push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
      else if (pc.t === 'Q') { const [, c, b] = pc.p; push(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y); }
      else { const [, b, c, e] = pc.p; push(u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * e.x, u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * e.y); }
    }
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum };
}

// time → length: the pen speeds up on straights and slows into loops and turns; the ruled tail runs fastest
function penTimeline(pieces, sigPieces, xhPx) {
  const { pts, cum } = sample(pieces);
  const total = cum[cum.length - 1];
  const sigLen = sample(sigPieces).cum.at(-1);
  // resample evenly
  const ds = Math.max(1, total / 1600), N = Math.ceil(total / ds);
  const even = [];
  let j = 0;
  for (let i = 0; i <= N; i++) {
    const s = Math.min(total, i * ds);
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    even.push({ x: pts[j].x + (pts[j + 1].x - pts[j].x) * f, y: pts[j].y + (pts[j + 1].y - pts[j].y) * f });
  }
  const ang = even.map((_, i) => { const a = even[Math.max(0, i - 1)], b = even[Math.min(N, i + 1)]; return Math.atan2(b.y - a.y, b.x - a.x); });
  const curv = ang.map((_, i) => {
    let d = ang[Math.min(N, i + 1)] - ang[Math.max(0, i - 1)];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d) / (2 * ds);
  });
  const W = Math.max(2, Math.round(xhPx * 0.5 / ds)); // smooth over half an x-height so the pen eases into turns
  const pre = [0];
  for (let i = 0; i <= N; i++) pre.push(pre[i] + curv[i]);
  const ts = [0];
  for (let i = 1; i <= N; i++) {
    const lo = Math.max(0, i - W), hi = Math.min(N, i + W);
    const k = ((pre[hi + 1] - pre[lo]) / (hi - lo + 1)) * xhPx;
    let v = 1 / (1 + 1.1 * k);
    if (i * ds > sigLen) v = 2.4; // past the signature: the hand lets go, the ruled line runs
    ts.push(ts[i - 1] + ds / v);
  }
  const T = ts[N];
  return {
    total,
    at(u) {
      const t = u * T;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
      const f = (t - ts[lo]) / Math.max(1e-6, ts[hi] - ts[lo]);
      return Math.min(total, (lo + f) * ds) / total; // fraction of the drawn length
    },
  };
}

const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
// gentle start and a soft landing; mostly linear so the pen's own rhythm shows through
const pace = (u) => 0.8 * u + 0.2 * easeInOut(u);

function piecesToD(pieces) {
  const f = (v) => Math.round(v * 100) / 100;
  let d = '';
  pieces.forEach((pc, i) => {
    const [a, ...rest] = pc.p;
    if (i === 0) d += `M${f(a.x)} ${f(a.y)}`;
    d += pc.t + rest.map(q => `${f(q.x)} ${f(q.y)}`).join(' ');
  });
  return d;
}

export function mountSign({ hero, svg, reduced, station }) {
  const seat = hero.querySelector('.hero__seat');
  const foot = hero.querySelector('.hero__foot');
  const wrap = seat.closest('.wrap');
  const sig = signature();
  const bw = sig.box.x1 - sig.box.x0;
  const DURATION = 2150;
  let path, dot, dotted = reduced, dotTimer = 0, start = 0, done = reduced, raf = 0, timeline = null, key = '';
  let prog = reduced ? 1 : 0;

  function layout() {
    const hr = hero.getBoundingClientRect();
    const sr = seat.getBoundingClientRect();
    const st = station();
    // the foot slides up as it reveals; measure where the seat will rest, not where it is mid-slide
    const tf = getComputedStyle(foot).transform;
    const ty = tf && tf !== 'none' ? new DOMMatrixReadOnly(tf).m42 : 0;
    const seatL = sr.left - hr.left, seatT = sr.top - hr.top - ty;
    const k = [hr.width, hr.height, seatL, seatT, sr.width, sr.height, st.x - hr.left, st.y - hr.top].map(Math.round).join();
    if (k === key) return;
    key = k;
    svg.setAttribute('viewBox', `0 0 ${hr.width} ${hr.height}`);
    // the signature fills the seat's width and sits on its floor; whatever rises above tucks into the name
    const fill = parseFloat(getComputedStyle(seat).getPropertyValue('--sign-fill')) || 1;
    const s = (sr.width * fill) / bw;
    const ox = seatL - sig.box.x0 * s;
    const oy = seatT + sr.height - sig.box.y1 * s;
    const map = (p) => ({ x: ox + p.x * s, y: oy + p.y * s });
    const sigPieces = sig.segs.map(g => ({ t: 'C', p: g.map(map) }));
    // the tail: level to the margin lane, down past the statement, into station one of the flow
    const E = map(sig.end);
    const gutter = parseFloat(getComputedStyle(wrap).paddingLeft) || 20;
    const lane = Math.max(8, wrap.getBoundingClientRect().left - hr.left + gutter / 2);
    const sx = st.x - hr.left, sy = st.y - hr.top;
    const r = Math.max(4, Math.min(40, (sy - E.y) / 3, (sx - lane) / 1.2, (E.x - lane) / 2));
    const P = (x, y) => ({ x, y });
    const tail = [
      { t: 'L', p: [E, P(lane + r, E.y)] },
      { t: 'Q', p: [P(lane + r, E.y), P(lane, E.y), P(lane, E.y + r)] },
      { t: 'L', p: [P(lane, E.y + r), P(lane, sy - r)] },
      { t: 'Q', p: [P(lane, sy - r), P(lane, sy), P(lane + r, sy)] },
      { t: 'L', p: [P(lane + r, sy), P(sx, sy)] },
    ];
    const pieces = sigPieces.concat(tail);
    if (!path) {
      path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'hero__sign-line');
      path.setAttribute('pathLength', '1');
      svg.append(path);
    }
    path.setAttribute('d', piecesToD(pieces));
    // the i's dot: a separate touch of the pen, made after the line has landed
    if (!dot) {
      dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'hero__sign-dot');
      dot.setAttribute('fill', '#fff'); // white under the difference blend, like the line
      dot.style.transformBox = 'fill-box';
      dot.style.transformOrigin = 'center';
      dot.style.opacity = dotted ? '1' : '0';
      svg.append(dot);
    }
    const D = map(sig.dot);
    dot.setAttribute('cx', D.x.toFixed(2));
    dot.setAttribute('cy', D.y.toFixed(2));
    dot.setAttribute('r', s > 0.8 ? '2.6' : '2');
    path.style.strokeDasharray = '1 2';
    timeline = reduced ? null : penTimeline(pieces, sigPieces, sig.xh * s);
    paint();
  }

  function paint() {
    if (!path) return;
    const f = done || !timeline ? 1 : timeline.at(pace(prog));
    path.style.strokeDashoffset = String(1 - f);
  }

  function tick(now) {
    prog = Math.min(1, (now - start) / DURATION);
    if (prog >= 1) { done = true; svg.dataset.state = 'signed'; dotTimer = setTimeout(dotI, 120); }
    paint();
    if (!done) raf = requestAnimationFrame(tick);
  }

  function dotI(instant) {
    if (dotted || !dot) return;
    dotted = true;
    dot.style.opacity = '1';
    if (instant !== true && !reduced) dot.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.35)', offset: .6 }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
    svg.dataset.dot = '1';
  }

  function play() {
    if (done || start) { if (done) { svg.dataset.state = 'signed'; dotI(true); } return; }
    // opened somewhere below the hero: nobody would see the signing, so it is simply signed
    if (hero.getBoundingClientRect().bottom < 0) { done = true; svg.dataset.state = 'signed'; paint(); dotI(true); return; }
    start = performance.now();
    svg.dataset.state = 'signing';
    raf = requestAnimationFrame(tick);
  }

  layout();
  if (reduced) { svg.dataset.state = 'signed'; svg.dataset.dot = '1'; }
  const ro = new ResizeObserver(() => layout());
  ro.observe(hero);
  return {
    play,
    relayout() { key = ''; layout(); },
    destroy() { cancelAnimationFrame(raf); clearTimeout(dotTimer); ro.disconnect(); path?.remove(); dot?.remove(); },
  };
}
