// Pit Lane Hub — Suzuka International Racing Course, drawn as one line.
// Track geometry: bacinger/f1-circuits (circuits/jp-1962.geojson), MIT licence.
// https://github.com/bacinger/f1-circuits
export const credit = 'Track geometry: bacinger/f1-circuits, MIT';

/* Suzuka centreline, 171 points, as [lon, lat] offsets from (136.52 E, 34.83 N) in micro-degrees.
   Point 0 sits on the start/finish straight; travel order is race direction. */
const RAW = [
  20283,13344,21609,12034,23160,10474,23302,10309,23381,10137,23422,9982,23419,9830,23396,9713,23215,9254,23129,
  9134,23004,9043,22899,8994,22710,8956,22538,8961,22349,9013,22173,9127,21994,9349,21079,10502,20906,10623,
  20757,10662,20532,10694,20059,10697,19821,10753,19653,10850,19526,10977,19466,11101,19253,11765,19164,11935,
  19022,12081,18857,12180,18649,12260,18436,12293,17886,12300,17632,12340,17458,12408,17278,12522,17146,12681,
  17065,12843,17028,12996,17030,13142,17064,13266,17334,13872,17375,13995,17382,14157,17353,14264,17282,14419,
  17176,14551,16973,14669,16726,14779,16433,14900,16175,14985,15983,15029,15713,15066,15407,15070,15166,15062,
  14965,15018,14802,14961,14548,14872,14281,14749,13974,14543,13734,14334,12725,13330,12673,13272,12512,13241,
  11038,13132,10943,13142,10842,13198,10801,13293,10783,13373,10559,14129,10260,15549,10203,15810,10189,15942,
  10205,16078,10237,16219,10305,16365,10382,16510,10620,16958,10645,17027,10627,17090,10582,17148,10505,17191,
  10416,17214,10330,17209,10232,17155,10151,17059,9804,16567,9522,16196,9338,15976,9186,15831,9055,15739,8830,
  15593,8593,15489,8345,15428,7913,15376,7504,15362,7196,15381,6829,15447,6427,15540,5977,15678,5693,15786,5444,
  15909,5214,16050,4971,16229,4720,16457,4554,16656,4405,16874,4037,17678,3840,18030,3740,18171,3604,18275,3426,
  18341,3213,18374,2958,18369,2722,18341,2491,18299,2266,18223,2082,18108,1971,17962,1928,17819,1941,17639,1991,
  17505,2064,17370,2189,17257,2436,17067,2745,16856,3047,16639,3430,16401,3868,16156,4316,15926,4817,15730,5265,
  15542,5725,15398,6472,15186,7294,14923,8289,14637,9276,14381,9959,14187,10842,13910,11044,13868,11245,13863,
  11458,13896,11665,13943,12038,14061,12381,14202,12669,14348,12967,14538,13524,14966,14287,15550,14499,15694,
  14650,15781,14788,15856,14886,15904,14939,15908,15009,15884,15181,15758,15305,15673,15406,15649,15501,15664,
  15613,15725,15797,15862,16004,15984,16235,16064,16517,16084,16780,16072,17058,16025,17336,15936,17572,15843,
  17868,15678,18134,15475,18407,15225
];

const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const R_EARTH = 6371008.8;

/* ---------- geometry helpers (pure) ---------- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const f1 = (v) => Math.round(v * 10) / 10;

function projectTrack() {
  const n = RAW.length / 2;
  let lat = 0;
  for (let i = 0; i < n; i++) lat += 34.83 + RAW[2 * i + 1] * 1e-6;
  const k = Math.cos((lat / n) * DEG); // equirectangular, cos(lat) corrected
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push([RAW[2 * i] * 1e-6 * DEG * R_EARTH * k, -RAW[2 * i + 1] * 1e-6 * DEG * R_EARTH]);
  }
  return pts; // metres, north up
}

// light Ramer-Douglas-Peucker; keeps point 0
function simplify(pts, eps) {
  const P = pts.concat([pts[0]]);
  const keep = new Uint8Array(P.length);
  keep[0] = keep[P.length - 1] = 1;
  let far = 1, fd = -1; // closed loop: split at the point farthest from the start first
  for (let i = 1; i < P.length - 1; i++) { const d = len(sub(P[i], P[0])); if (d > fd) { fd = d; far = i; } }
  keep[far] = 1;
  const stack = [[0, far], [far, P.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bi = -1;
    const ab = sub(P[b], P[a]), L = len(ab) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(ab[0] * (P[i][1] - P[a][1]) - ab[1] * (P[i][0] - P[a][0])) / L;
      if (d > best) { best = d; bi = i; }
    }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = [];
  for (let i = 0; i < P.length - 1; i++) if (keep[i]) out.push(P[i]);
  return out;
}

// centripetal Catmull-Rom -> cubic Bézier segments
function catmull(P, closed, head, tail) {
  const n = P.length;
  const get = (i) => {
    if (closed) return P[(i + n) % n];
    if (i < 0) return head || sub(mul(P[0], 2), P[1]);
    if (i >= n) return tail || sub(mul(P[n - 1], 2), P[n - 2]);
    return P[i];
  };
  const segs = [];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const d1 = Math.max(len(sub(p1, p0)), 1e-3), d2 = Math.max(len(sub(p2, p1)), 1e-3), d3 = Math.max(len(sub(p3, p2)), 1e-3);
    const a1 = Math.sqrt(d1), a2 = Math.sqrt(d2), a3 = Math.sqrt(d3);
    const c1 = mul(add(sub(mul(p2, d1), mul(p0, d2)), mul(p1, 2 * d1 + 3 * a1 * a2 + d2)), 1 / (3 * a1 * (a1 + a2)));
    const c2 = mul(add(sub(mul(p1, d3), mul(p3, d2)), mul(p2, 2 * d3 + 3 * a3 * a2 + d2)), 1 / (3 * a3 * (a3 + a2)));
    segs.push([p1, c1, c2, p2]);
  }
  return segs;
}

const bez = (s, t) => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0], a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1]];
};

function segsToD(segs) {
  let d = `M${f1(segs[0][0][0])} ${f1(segs[0][0][1])}`;
  for (const s of segs) d += `C${f1(s[1][0])} ${f1(s[1][1])} ${f1(s[2][0])} ${f1(s[2][1])} ${f1(s[3][0])} ${f1(s[3][1])}`;
  return d;
}
const polyD = (pts) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join('L');

// dense arc-length samples of Bézier segments: {x, y, s (0..1)}, plus total length
function sample(segs, step = 1.5) {
  const X = [], Y = [], S = [];
  let acc = 0, prev = segs[0][0];
  X.push(prev[0]); Y.push(prev[1]); S.push(0);
  for (const s of segs) {
    const est = len(sub(s[1], s[0])) + len(sub(s[2], s[1])) + len(sub(s[3], s[2]));
    const n = Math.max(2, Math.ceil(est / step));
    for (let k = 1; k <= n; k++) {
      const p = bez(s, k / n);
      acc += len(sub(p, prev));
      X.push(p[0]); Y.push(p[1]); S.push(acc);
      prev = p;
    }
  }
  for (let i = 0; i < S.length; i++) S[i] /= acc;
  return { X: Float64Array.from(X), Y: Float64Array.from(Y), S: Float64Array.from(S), L: acc };
}

function search(arr, v) { // last index with arr[i] <= v
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid - 1; }
  return lo;
}
function at(smp, v, key = smp.S) {
  const i = Math.min(search(key, v), key.length - 2);
  const t = (v - key[i]) / ((key[i + 1] - key[i]) || 1);
  return [smp.X[i] + (smp.X[i + 1] - smp.X[i]) * t, smp.Y[i] + (smp.Y[i + 1] - smp.Y[i]) * t, smp.S[i] + (smp.S[i + 1] - smp.S[i]) * t];
}
function nearestS(smp, p) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < smp.S.length; i++) {
    const d = (smp.X[i] - p[0]) ** 2 + (smp.Y[i] - p[1]) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  return smp.S[bi];
}
function rangePts(smp, a, b) { // points with s in [a, b] (b may exceed 1 -> wraps)
  const out = [];
  const push = (lo, hi) => { for (let i = 0; i < smp.S.length; i++) if (smp.S[i] >= lo && smp.S[i] <= hi) out.push([smp.X[i], smp.Y[i]]); };
  if (b <= 1) push(a, b); else { push(a, 1); push(0, b - 1); }
  return out;
}
function offsetPts(pts, d) { // offset polyline by d along left normal (y-down: +d = right of travel)
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = norm(sub(b, a));
    return [p[0] - t[1] * d, p[1] + t[0] * d];
  });
}
function turnSign(pts) { // >0 = right-hander (clockwise on screen)
  let c = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = sub(pts[i], pts[i - 1]), b = sub(pts[i + 1], pts[i]);
    c += a[0] * b[1] - a[1] * b[0];
  }
  return Math.sign(c) || 1;
}
function segIntersect(p, p2, q, q2) {
  const r = sub(p2, p), s = sub(q2, q), den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den;
  const u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? [t, u] : null;
}

/* ---------- layouts ---------- */
// Corner references use indices of the original 171-point centreline.
const CORNERS = {
  sCurves: 27, degner: 63, hairpin: 81, spoon: 114, r130: 147, casio: 156, t1: 6,
};
const KERBS = [
  [21, 25], [27, 30], [33, 37],          // S Curves
  [108, 112], [116, 121],                 // Spoon
  [145, 149],                             // 130R
  [152, 154], [156, 159],                 // Casio Triangle
];

const LAYOUTS = {
  wide: {
    rot: 0,
    pad: { t: 90, x: 110, b: 250 },
    ribbon: 26, kerb: 6, kerbDash: 7,
    // entry: one swoop from the top centre over the Casio Triangle, landing on the straight from outside
    entry: (o) => { const Q = o.straight(-40, 72); return [[o.top, add(o.top, [0, 190]), sub(Q, mul(o.u, 230)), Q], [Q, add(Q, mul(o.u, 120)), sub(o.SF, mul(o.u, 120)), o.SF]]; },
    exitLead: 300, exitBottom: 170,
    labels: [
      { k: 'sCurves', text: 'S Curves', d: [-150, 40], a: 'l' },
      { k: 'degner', text: 'Degner', d: [0, 95], a: 'c', v: 'b' },
      { k: 'hairpin', text: 'Hairpin', d: [0, -70], a: 'c', v: 't' },
      { k: 'spoon', text: 'Spoon', d: [0, -62], a: 'c', v: 't' },
      { k: 'r130', text: '130R', d: [-80, -95], a: 'c', v: 't' },
      { k: 'casio', text: 'Casio Triangle', d: [0, -80], a: 'c', v: 't' },
    ],
    title: [70, 0.64], // x units from left, y as fraction of VH
  },
  tall: {
    rot: 'straight',
    pad: { t: 60, x: 80, b: 240 },
    ribbon: 34, kerb: 9, kerbDash: 10,
    entry: (o) => { const Q = o.straight(-175, 20); return [[o.top, add(o.top, [0, 260]), sub(Q, mul(o.u, 330)), Q], [Q, add(Q, mul(o.u, 160)), sub(o.SF, mul(o.u, 160)), o.SF]]; },
    exitLead: 280, exitBottom: 160,
    labels: [
      { k: 'sCurves', text: 'S Curves', d: [-150, 0], a: 'l' },
      { k: 'degner', text: 'Degner', d: [-90, 60], a: 'l', small: true },
      { k: 'hairpin', text: 'Hairpin', d: [0, -75], a: 'c', v: 't' },
      { k: 'spoon', text: 'Spoon', d: [110, 20], a: 'r' },
      { k: 'r130', text: '130R', d: [-125, -112], a: 'c', v: 't' },
      { k: 'casio', text: 'Casio Triangle', d: [-40, -105], a: 'c', v: 't' },
    ],
    title: [40, 0.7],
  },
};

export function buildGeometry(key) {
  const L = LAYOUTS[key];
  const orig0 = projectTrack();
  const n0 = orig0.length;
  let rot = L.rot;
  if (rot === 'straight') { // make the start/finish straight run straight down the page
    const d = sub(orig0[0], orig0[n0 - 1]);
    rot = 90 - Math.atan2(d[1], d[0]) / DEG;
  }
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG);
  let orig = orig0.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of orig) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const pad = L.pad;
  orig = orig.map(([x, y]) => [x - minX + pad.x, y - minY + pad.t]);
  const vw = maxX - minX + 2 * pad.x, vh = maxY - minY + pad.t + pad.b;
  const cx = vw / 2;

  // the lap
  const lapPts = simplify(orig, 0.6);
  const lapSegs = catmull(lapPts, true);
  const lap = sample(lapSegs);
  const S = (i) => nearestS(lap, orig[i]);

  // straight frame: origin at the last point before the line, u = travel, nOut = away from track centre
  const P170 = orig[n0 - 1], P0 = orig[0];
  const u = norm(sub(P0, P170));
  let nOut = [u[1], -u[0]];
  const mid = [(maxX - minX) / 2 + pad.x, (maxY - minY) / 2 + pad.t];
  if ((P0[0] - mid[0]) * nOut[0] + (P0[1] - mid[1]) * nOut[1] < 0) nOut = mul(nOut, -1);
  const straight = (a, nn) => add(add(P170, mul(u, a)), mul(nOut, nn));
  const o = { top: [cx, 0], cx, vw, vh, pad, straight, u, SF: P0 };

  // entry: top centre -> start/finish line, tangent to the straight
  const entrySegs = L.entry(o);
  const entry = sample(entrySegs);

  // exit: second pass through Turns 1-2, peel off at the bottom of Turn 2, drop to bottom centre
  // lowest point of Turn 2 in this orientation, where the track runs level
  let sT2 = S(12);
  { let by = -Infinity; const a = S(5), b = S(17);
    for (let i = 0; i < lap.S.length; i++) if (lap.S[i] > a && lap.S[i] < b && lap.Y[i] > by) { by = lap.Y[i]; sT2 = lap.S[i]; } }
  const exitTrack = [];
  {
    // reuse lap segments up to the segment containing T2 bottom, then split there
    let acc = 0; const tot = lap.L;
    for (const sg of lapSegs) {
      const sm = sample([sg], 1.5); const l = sm.L;
      if ((acc + l) / tot < sT2) { exitTrack.push(sg); acc += l; continue; }
      // split segment at fraction
      const f = (sT2 * tot - acc) / l;
      // de Casteljau
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const [a, b, cc, d] = sg; const ab = lerp(a, b, f), bc = lerp(b, cc, f), cd = lerp(cc, d, f);
      const abc = lerp(ab, bc, f), bcd = lerp(bc, cd, f), m = lerp(abc, bcd, f);
      exitTrack.push([a, ab, abc, m]);
      break;
    }
  }
  const last = exitTrack[exitTrack.length - 1];
  const tEnd = norm(sub(last[3], last[2]));
  const end = [cx, vh];
  const exitSegs = exitTrack.concat([[last[3], add(last[3], mul(tEnd, L.exitLead)), [cx, vh - L.exitBottom], end]]);
  const exit = sample(exitSegs);
  const exitOverlap = (() => { let a = 0; const tmp = sample(exitTrack); a = tmp.L; return a / exit.L; })();

  // sectors: thirds of the lap
  const sectors = [0, 1, 2].map((k) => polyD(rangePts(lap, k / 3, (k + 1) / 3 + 0.0015)));

  // crossover: Degner→Hairpin passes under the back straight
  let cross = null;
  for (let i = 60; i < 80 && !cross; i++) for (let j = 125; j < 150; j++) {
    const r = segIntersect(orig[i], orig[i + 1], orig[j], orig[j + 1]);
    if (r) { const X = add(orig[i], mul(sub(orig[i + 1], orig[i]), r[0])); cross = { X, i, j }; break; }
  }
  // s on each branch at the crossing
  const sOn = (k) => { const a = S(k), b = S(k + 1); let best = Infinity, out = a;
    for (let i = 0; i < lap.S.length; i++) if (lap.S[i] >= a && lap.S[i] <= b) {
      const d = (lap.X[i] - cross.X[0]) ** 2 + (lap.Y[i] - cross.X[1]) ** 2; if (d < best) { best = d; out = lap.S[i]; } }
    return out; };
  cross.sUnder = sOn(cross.i); cross.sOver = sOn(cross.j);
  const deckHalf = (L.ribbon * 2.2) / lap.L;
  cross.a = cross.sOver - deckHalf; cross.b = cross.sOver + deckHalf;
  const deckPts = rangePts(lap, cross.a, cross.b);
  cross.d = polyD(deckPts);
  cross.sector = Math.floor(cross.sOver * 3);
  // shade on the lower road where it runs beneath the deck
  cross.shade = [2.4, 1.9, 1.4].map((k) => { const h = (L.ribbon * k) / lap.L; return polyD(rangePts(lap, cross.sUnder - h, cross.sUnder + h)); });

  // kerbs
  const kerbs = KERBS.map(([a, b]) => {
    const pts = rangePts(lap, S(a), S(b));
    const side = turnSign(pts); // inside of the corner
    return polyD(offsetPts(pts, side * (L.ribbon / 2 + L.kerb / 2 - 0.5)));
  });

  // start / finish chequer
  const sf = { p: P0, ang: Math.atan2(u[1], u[0]) / DEG };

  // corner anchors
  const corners = {};
  for (const [k, i] of Object.entries(CORNERS)) corners[k] = { p: orig[i], s: S(i) };

  // speed profile for the ambient cars (curvature-limited, accel/brake passes)
  const N = lap.S.length, ds = lap.L / (N - 1);
  const v = new Float64Array(N);
  const K = 8;
  for (let i = 0; i < N; i++) {
    const a = (i - K + N - 1) % (N - 1), b = (i + K) % (N - 1);
    const t1 = Math.atan2(lap.Y[i] - lap.Y[a], lap.X[i] - lap.X[a]);
    const t2 = Math.atan2(lap.Y[b] - lap.Y[i], lap.X[b] - lap.X[i]);
    let dt = Math.abs(t2 - t1); if (dt > Math.PI) dt = 2 * Math.PI - dt;
    const kappa = dt / (2 * K * ds);
    v[i] = Math.min(88, Math.sqrt(38 / Math.max(kappa, 1e-6)));
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < N; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * 11 * ds));
    v[0] = Math.min(v[0], v[N - 1]);
    for (let i = N - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * 36 * ds));
    v[N - 1] = Math.min(v[N - 1], v[0]);
  }
  const T = new Float64Array(N);
  for (let i = 1; i < N; i++) T[i] = T[i - 1] + ds / ((v[i] + v[i - 1]) / 2);
  const lapTime = T[N - 1];
  for (let i = 0; i < N; i++) T[i] /= lapTime;
  lap.T = T;

  return {
    key, rot, vw, vh, cx, L, lap, lapD: segsToD(lapSegs), entry, entryD: segsToD(entrySegs),
    exit, exitD: segsToD(exitSegs), exitOverlap, sectors, cross, kerbs, sf, corners, orig, lapTime,
  };
}


/* ---------- DOM ---------- */
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const html = (tag, cls, parent, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
};

const ARIA = 'Suzuka International Racing Course in Japan, the figure-eight Formula 1 circuit, traced as one continuous line: '
  + '5.807 km and 18 turns, with the crossover bridge, the S Curves, Degner, the Hairpin, Spoon, 130R and the Casio Triangle.';

// timeline (scroll progress p)
const P_ENTRY = [0.03, 0.13];
const P_LAP = [0.13, 0.47];
const P_EXIT = [0.475, 0.6];
const P_CARS = 0.55;
const CAR_LAP_S = 15; // seconds per animated lap for the quickest car
const CARS = [
  { cls: 'a', pace: 1, start: 0.0 },
  { cls: 'b', pace: 1.028, start: 0.035 },
  { cls: 'c', pace: 1.061, start: 0.075 },
];

export function mount(root, { reduced = false } = {}) {
  let g = null, refs = null, layout = '';
  let lastP = reduced ? 0.6 : 0;
  let visible = false, raf = 0, clock = 0, prevTs = 0, carsWanted = false, carsAlpha = 0;
  const cache = new Map();
  const set = (node, prop, value) => { // write-only, skips unchanged values
    const key = node.__cid || (node.__cid = Math.random().toString(36).slice(2));
    const k = key + prop;
    if (cache.get(k) === value) return;
    cache.set(k, value);
    if (prop === 'transform') node.setAttribute('transform', value);
    else node.style.setProperty(prop, value);
  };

  function build(key) {
    g = buildGeometry(key);
    layout = key;
    cache.clear();
    root.textContent = '';
    root.dataset.layout = key;
    const L = g.L, vb = `0 0 ${f1(g.vw)} ${f1(g.vh)}`;
    const stage = html('div', 'c-stage', root);
    stage.style.aspectRatio = `${f1(g.vw)} / ${f1(g.vh)}`;

    /* static base */
    const base = el('svg', { class: 'c-base', viewBox: vb, role: 'img', 'aria-label': ARIA, preserveAspectRatio: 'xMidYMid meet' }, stage);
    const defs = el('defs', {}, base);
    const mid = [g.vw * 0.5, g.vh * 0.46];
    // elliptical floodlight that fades to nothing before the scene edges
    const fr = Math.min(g.vw, g.vh) * 0.5;
    const flood = el('radialGradient', { id: 'circuit-flood', gradientUnits: 'userSpaceOnUse', cx: f1(mid[0]), cy: f1(mid[1]), r: f1(fr),
      gradientTransform: `translate(${f1(mid[0])} ${f1(mid[1])}) scale(${f1((g.vw * 0.5) / fr * 0.98)} ${f1((g.vh * 0.5) / fr * 0.98)}) translate(${f1(-mid[0])} ${f1(-mid[1])})` }, defs);
    [[0, 0.085], [0.3, 0.05], [0.65, 0.016], [1, 0]].forEach(([o, a]) => el('stop', { offset: o, class: 'c-flood-stop', 'stop-opacity': a }, flood));
    const flt = el('filter', { id: 'circuit-shadow', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
    el('feGaussianBlur', { stdDeviation: f1(L.ribbon * 0.35) }, flt);
    el('rect', { width: f1(g.vw), height: f1(g.vh), fill: 'url(#circuit-flood)' }, base);
    el('path', { d: g.lapD, class: 'c-shadow', 'stroke-width': L.ribbon + 6, transform: `translate(0 ${f1(L.ribbon * 0.35)})`, filter: 'url(#circuit-shadow)' }, base);
    el('path', { d: g.lapD, class: 'c-edge', 'stroke-width': L.ribbon + 2.6 }, base);
    el('path', { d: g.lapD, class: 'c-road', 'stroke-width': L.ribbon }, base);
    const kerbs = el('g', { class: 'c-kerbs' }, base);
    for (const d of g.kerbs) {
      el('path', { d, class: 'c-kerb-w', 'stroke-width': L.kerb }, kerbs);
      el('path', { d, class: 'c-kerb-r', 'stroke-width': L.kerb, 'stroke-dasharray': `${L.kerbDash} ${L.kerbDash}` }, kerbs);
    }
    // start/finish chequer: 2 rows across the ribbon
    const sf = el('g', { class: 'c-sf', transform: `translate(${f1(g.sf.p[0])} ${f1(g.sf.p[1])}) rotate(${f1(g.sf.ang)})` }, base);
    const cols = 6, cell = (L.ribbon + 2) / cols;
    for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) {
      el('rect', { x: f1(-cell + r * cell), y: f1(-(L.ribbon + 2) / 2 + c * cell), width: f1(cell), height: f1(cell), class: (r + c) % 2 ? 'c-chq-d' : 'c-chq-l' }, sf);
    }

    /* live layer */
    const live = el('svg', { class: 'c-live', viewBox: vb, 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' }, stage);
    const sectors = g.sectors.map((d, k) => {
      const grp = el('g', { class: `c-sector c-sector--${k + 1}`, opacity: 0 }, live);
      el('path', { d, class: 'c-sector-halo', 'stroke-width': L.ribbon - 3 }, grp);
      el('path', { d, class: 'c-sector-band' }, grp);
      return grp;
    });
    const leaders = el('g', { class: 'c-leaders' }, live);
    const lineEntry = el('path', { d: g.entryD, class: 'c-line', pathLength: 1 }, live);
    const lineLap = el('path', { d: g.lapD, class: 'c-line', pathLength: 1 }, live);
    const lineExit = el('path', { d: g.exitD, class: 'c-line', pathLength: 1 }, live);

    const carsUnder = el('g', { class: 'c-cars', opacity: 0 }, live);
    // the crossover: back straight bridges the Degner -> Hairpin run
    const deck = el('g', { class: 'c-deck' }, live);
    for (const d of g.cross.shade) el('path', { d, class: 'c-deck-shade', 'stroke-width': L.ribbon + 2.6 }, deck); // feathered
    el('path', { d: g.cross.d, class: 'c-deck-cut', 'stroke-width': L.ribbon + 10 }, deck);
    el('path', { d: g.cross.d, class: 'c-edge', 'stroke-width': L.ribbon + 2.6 }, deck);
    el('path', { d: g.cross.d, class: 'c-road', 'stroke-width': L.ribbon }, deck);
    const deckSector = el('g', { class: `c-sector c-sector--${g.cross.sector + 1} c-sector--deck`, opacity: 0 }, deck);
    el('path', { d: g.cross.d, class: 'c-sector-halo', 'stroke-width': L.ribbon - 3 }, deckSector);
    el('path', { d: g.cross.d, class: 'c-sector-band' }, deckSector);
    const lineDeck = el('path', { d: g.cross.d, class: 'c-line', pathLength: 1 }, deck);
    const carsOver = el('g', { class: 'c-cars', opacity: 0 }, live);

    const cars = CARS.map((c) => {
      const trails = [[0.011, 'c-trail c-trail--1'], [0.026, 'c-trail c-trail--2'], [0.05, 'c-trail c-trail--3']].map(([l, cls]) => {
        const t = el('path', { d: g.lapD, class: `${cls} c-car--${c.cls}`, pathLength: 1, 'stroke-dasharray': `${l} ${1 - l}` }, carsUnder);
        return { node: t, l };
      });
      const mk = (parent) => {
        const h = el('g', { class: `c-car c-car--${c.cls}` }, parent);
        el('path', { d: 'M0 0h0.01', class: 'c-car-glow' }, h);
        el('path', { d: 'M0 0h0.01', class: 'c-car-dot' }, h);
        return h;
      };
      return { ...c, trails, under: mk(carsUnder), over: mk(carsOver) };
    });

    const pen = el('g', { class: 'c-pen', opacity: 0 }, live);
    el('path', { d: 'M0 0h0.01', class: 'c-pen-glow' }, pen);
    el('path', { d: 'M0 0h0.01', class: 'c-pen-dot' }, pen);

    /* labels */
    const labels = html('div', 'c-labels', stage);
    labels.setAttribute('aria-hidden', 'true');
    const pct = (p) => [`${((p[0] / g.vw) * 100).toFixed(3)}%`, `${((p[1] / g.vh) * 100).toFixed(3)}%`];
    const corners = L.labels.filter((lb) => !lb.small).map((lb) => {
      const c = g.corners[lb.k];
      const dir = norm(lb.d);
      const anchor = add(c.p, lb.d);
      const lead = el('path', { d: polyD([add(c.p, mul(dir, L.ribbon / 2 + 9)), sub(anchor, mul(dir, 4))]), class: 'c-leader', opacity: 0 }, leaders);
      const n = html('span', `c-corner c-corner--${lb.a}${lb.v ? ` c-corner--${lb.v}` : ''}${lb.small ? ' c-corner--minor' : ''}`, labels, lb.text);
      const [x, y] = pct(anchor);
      n.style.left = x; n.style.top = y;
      n.style.opacity = 0;
      return { n, lead, s: c.s };
    });
    const title = html('div', 'c-title', labels);
    const [tx, ty] = pct([L.title[0], L.title[1] * g.vh]);
    title.style.left = tx; title.style.top = ty;
    html('div', 'c-name', title, 'Suzuka');
    const facts = html('div', 'c-facts', title);
    html('span', '', facts, '5.807 km');
    html('span', '', facts, '18 turns');
    const strip = html('div', 'c-strip', title);
    const chips = [1, 2, 3].map((k) => {
      const w = html('span', `c-chip c-chip--${k}`, strip);
      const bar = html('i', '', w);
      html('b', '', w, `S${k}`);
      return bar;
    });

    refs = { base, lineEntry, lineLap, lineExit, lineDeck, sectors, deckSector, cars, carsUnder, carsOver, pen, corners, title, chips };
  }

  /* ---------- per-frame state ---------- */
  function render(p) {
    const r = refs;
    const fe = reduced ? 1 : clamp01((p - P_ENTRY[0]) / (P_ENTRY[1] - P_ENTRY[0]));
    const tRaw = reduced ? 1.2 : (p - P_LAP[0]) / (P_LAP[1] - P_LAP[0]);
    const t = clamp01(tRaw);
    const fx = reduced ? 1 : clamp01((p - P_EXIT[0]) / (P_EXIT[1] - P_EXIT[0]));
    const ex = g.exitOverlap + (1 - g.exitOverlap) * fx; // the overlap (straight + Turns 1-2) is already drawn

    set(r.base, 'opacity', (reduced ? 1 : 0.42 + 0.58 * smooth(0.0, 0.16, p)).toFixed(3));
    set(r.lineEntry, 'stroke-dashoffset', (1 - fe).toFixed(4));
    set(r.lineLap, 'stroke-dashoffset', (1 - t).toFixed(4));
    set(r.lineExit, 'stroke-dashoffset', (fx > 0 ? 1 - ex : 1).toFixed(4));
    set(r.lineExit, 'opacity', fx > 0 ? '1' : '0');
    const c = g.cross;
    set(r.lineDeck, 'stroke-dashoffset', (1 - clamp01((t - c.a) / (c.b - c.a))).toFixed(4));

    // sectors glow as each third completes
    const sec = [0, 1, 2].map((k) => smooth((k + 1) / 3, (k + 1) / 3 + 0.06, tRaw));
    r.sectors.forEach((n, k) => set(n, 'opacity', sec[k].toFixed(3)));
    set(r.deckSector, 'opacity', sec[c.sector].toFixed(3));
    r.chips.forEach((n, k) => set(n, 'opacity', (0.2 + 0.8 * sec[k]).toFixed(3)));

    // labels appear as the line reaches each corner
    for (const cn of r.corners) {
      const a = smooth(cn.s - 0.01, cn.s + 0.035, tRaw).toFixed(3);
      set(cn.n, 'opacity', a); set(cn.lead, 'opacity', a);
    }
    set(r.title, 'opacity', (reduced ? 1 : smooth(0.04, 0.14, p)).toFixed(3));

    // pen tip follows whichever stroke is being drawn
    let pt = null;
    if (!reduced) {
      if (fe > 0 && fe < 1) pt = at(g.entry, fe);
      else if (t > 0 && t < 1) pt = at(g.lap, t);
      else if (fx > 0 && fx < 1) pt = at(g.exit, ex);
    }
    if (pt) set(r.pen, 'transform', `translate(${f1(pt[0])} ${f1(pt[1])})`);
    set(r.pen, 'opacity', pt ? '1' : '0');

    carsWanted = !reduced && p >= P_CARS;
    tick();
  }

  /* ---------- ambient cars ---------- */
  function drawCars() {
    const r = refs, c = g.cross;
    for (const car of r.cars) {
      const tau = (clock / (CAR_LAP_S * car.pace) + car.start) % 1;
      const [x, y, s] = at(g.lap, tau, g.lap.T);
      const tr = `translate(${f1(x)} ${f1(y)})`;
      const over = s > c.a && s < c.b;
      car.under.setAttribute('transform', tr);
      car.over.setAttribute('transform', tr);
      car.under.style.opacity = over ? 0 : 1;
      car.over.style.opacity = over ? 1 : 0;
      for (const tl of car.trails) tl.node.style.strokeDashoffset = (((tl.l - s) % 1) + 1) % 1;
    }
    r.carsUnder.setAttribute('opacity', carsAlpha.toFixed(3));
    r.carsOver.setAttribute('opacity', carsAlpha.toFixed(3));
  }
  function frame(ts) {
    raf = 0;
    const dt = prevTs ? Math.min(0.05, (ts - prevTs) / 1000) : 0;
    prevTs = ts;
    clock += dt;
    carsAlpha += ((carsWanted ? 1 : 0) - carsAlpha) * Math.min(1, dt * 3.2);
    if (!carsWanted && carsAlpha < 0.01) carsAlpha = 0;
    drawCars();
    tick();
  }
  function tick() {
    const run = !reduced && visible && !document.hidden && (carsWanted || carsAlpha > 0);
    if (run && !raf) raf = requestAnimationFrame(frame);
    if (!run) { if (raf) cancelAnimationFrame(raf); raf = 0; prevTs = 0; }
  }

  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; tick(); });
  io.observe(root);
  const onVis = () => tick();
  document.addEventListener('visibilitychange', onVis);

  const pick = (w) => (w > 0 && w < 640 ? 'tall' : 'wide');
  // dashed strokes can't use non-scaling-stroke (Chrome measures dashes in screen space),
  // so their widths are expressed through --c-u = SVG units per CSS pixel
  const scaleVar = (w) => { if (w > 0) root.style.setProperty('--c-u', (g.vw / w).toFixed(4)); };
  const w0 = root.clientWidth || window.innerWidth;
  build(pick(w0));
  scaleVar(w0);
  render(lastP);
  const ro = new ResizeObserver((es) => {
    const w = es[0].contentRect.width;
    const k = pick(w);
    if (k !== layout) { build(k); render(lastP); if (carsAlpha > 0) drawCars(); }
    scaleVar(w);
  });
  ro.observe(root);

  return {
    update(p) {
      lastP = reduced ? 0.6 : Math.max(0, Math.min(1, +p || 0));
      render(lastP);
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      root.textContent = '';
    },
  };
}
