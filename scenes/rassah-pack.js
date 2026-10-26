// Port of Rassah's packUnits engine (MIT License).
// Copyright (c) 2026 Abdulaziz Alkhlaiwe, Hana, Bayan (Rassah team).
// Source: Rassah, packer.ts and 03-packing-engine.md.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

export const CARTONS = [
  { id: 'S', inner: [20, 15, 10], maxWeightG: 3000, tareG: 120, costSar: 0.9 },
  { id: 'FLAT', inner: [35, 25, 6], maxWeightG: 3000, tareG: 150, costSar: 1.1 },
  { id: 'M', inner: [30, 20, 15], maxWeightG: 8000, tareG: 250, costSar: 1.6 },
  { id: 'L', inner: [40, 30, 25], maxWeightG: 15000, tareG: 450, costSar: 2.6 },
  { id: 'XL', inner: [50, 40, 35], maxWeightG: 20000, tareG: 700, costSar: 3.8 },
];

export const SHIPPING_RATES = { baseSar: 18, perKgSar: 3, volumetricDivisor: 5000 };
export const ENGINE_CONFIG = {
  eps: 1e-6,
  minSupport: 0.7,
  maxSearchMs: 1500,
  restarts: 40,
  anchorNodes: 10000,
  wallCm: 0.5,
};

const volume = (d) => d[0] * d[1] * d[2];
const near = (a, b, eps) => Math.abs(a - b) < eps;

export function rotations(unit) {
  const [a, b, c] = unit.dims;
  const all = [
    [a, b, c], [a, c, b], [b, a, c],
    [b, c, a], [c, a, b], [c, b, a],
  ];
  const allowed = unit.liquid
    ? all.filter((d) => near(d[2], unit.uprightHeight, ENGINE_CONFIG.eps))
    : all;
  const seen = new Set();
  return allowed.filter((d) => {
    const k = d.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function boxesOverlap(a, b, eps) {
  return a.x < b.x + b.dx - eps && b.x < a.x + a.dx - eps
    && a.y < b.y + b.dy - eps && b.y < a.y + a.dy - eps
    && a.z < b.z + b.dz - eps && b.z < a.z + a.dz - eps;
}

function contactArea(a, b, eps) {
  if (!near(b.z + b.dz, a.z, eps)) return 0;
  const dx = Math.max(0, Math.min(a.x + a.dx, b.x + b.dx) - Math.max(a.x, b.x));
  const dy = Math.max(0, Math.min(a.y + a.dy, b.y + b.dy) - Math.max(a.y, b.y));
  return dx * dy;
}

export function estimateCost(carton, units, rates = SHIPPING_RATES, wallCm = ENGINE_CONFIG.wallCm) {
  const outerCm = carton.inner.map((d) => d + 2 * wallCm);
  const volumetricKg = volume(outerCm) / rates.volumetricDivisor;
  const actualKg = (units.reduce((sum, u) => sum + u.weightG, 0) + carton.tareG) / 1000;
  const chargeableKg = Math.max(actualKg, volumetricKg);
  const shippingSar = rates.baseSar + rates.perKgSar * Math.max(0, Math.ceil(chargeableKg) - 1);
  return {
    outerCm,
    actualKg,
    volumetricKg,
    chargeableKg,
    cartonSar: carton.costSar,
    shippingSar,
    totalSar: carton.costSar + shippingSar,
  };
}

const byVolume = (u) => volume(u.dims);
const byBaseArea = (u) => u.dims[0] * u.dims[1];
const STRATEGIES = [
  { name: 'volume', key: byVolume, fragileLast: true, score: 'lowest_top' },
  { name: 'base_area', key: byBaseArea, fragileLast: true, score: 'lowest_top' },
  { name: 'weight', key: (u) => u.weightG, fragileLast: true, score: 'lowest_top' },
  { name: 'longest_side', key: (u) => u.dims[0], fragileLast: true, score: 'lowest_top' },
  { name: 'volume_base_first', key: byVolume, fragileLast: true, score: 'lowest_base' },
  { name: 'volume_fragile_anywhere', key: byVolume, fragileLast: false, score: 'lowest_top' },
  { name: 'base_area_fragile_anywhere', key: byBaseArea, fragileLast: false, score: 'lowest_base' },
  { name: 'volume_tight_x', key: byVolume, fragileLast: true, score: 'tight_x' },
  { name: 'volume_tight_y', key: byVolume, fragileLast: true, score: 'tight_y' },
];
const RESTART_SCORES = ['lowest_top', 'tight_x', 'lowest_base', 'tight_y'];

function orderUnits(units, strategy) {
  const byKey = (a, b) => strategy.key(b) - strategy.key(a) || a.unitId.localeCompare(b.unitId);
  if (!strategy.fragileLast) return [...units].sort(byKey);
  return [
    ...units.filter((u) => !u.fragile).sort(byKey),
    ...units.filter((u) => u.fragile).sort(byKey),
  ];
}

function scoreOf(p, mode) {
  switch (mode) {
    case 'lowest_top': return [p.z + p.dz, p.z, p.y, p.x];
    case 'lowest_base': return [p.z, p.y, p.x, p.z + p.dz];
    case 'tight_x': return [p.z, p.x + p.dx, p.y + p.dy, p.z + p.dz];
    case 'tight_y': return [p.z, p.y + p.dy, p.x + p.dx, p.z + p.dz];
  }
}

function better(a, b, eps) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i] - eps) return true;
    if (a[i] > b[i] + eps) return false;
  }
  return false;
}

function fitsInCarton(d, inner, eps) {
  return d[0] <= inner[0] + eps && d[1] <= inner[1] + eps && d[2] <= inner[2] + eps;
}

function canPlace(cand, candFragile, placed, placedUnits, carton, cfg, voids = []) {
  const { eps, minSupport } = cfg;
  const [L, W, H] = carton.inner;
  if (cand.x + cand.dx > L + eps || cand.y + cand.dy > W + eps || cand.z + cand.dz > H + eps) return false;
  for (const p of placed) if (boxesOverlap(cand, p, eps)) return false;
  for (const v of voids) if (boxesOverlap(cand, v, eps)) return false;
  if (cand.z > eps) {
    let support = 0;
    for (let i = 0; i < placed.length; i++) {
      const area = contactArea(cand, placed[i], eps);
      if (area <= eps) continue;
      if (placedUnits[i].fragile) return false;
      support += area;
    }
    if (support + eps < minSupport * cand.dx * cand.dy) return false;
  }
  if (candFragile) for (const p of placed) if (contactArea(p, cand, eps) > eps) return false;
  return true;
}

function gridAxes(placed, carton, eps) {
  const [L, W, H] = carton.inner;
  const uniq = (vals, limit) => {
    const out = [];
    for (const v of vals.sort((a, b) => a - b)) {
      if (v >= limit - eps) continue;
      if (out.length === 0 || v - out[out.length - 1] > eps) out.push(v);
    }
    return out;
  };
  return [
    uniq([0, ...placed.map((b) => b.x + b.dx)], L),
    uniq([0, ...placed.map((b) => b.y + b.dy)], W),
    uniq([0, ...placed.map((b) => b.z + b.dz)], H),
  ];
}

function cornerGrid(placed, carton, eps) {
  const [xs, ys, zs] = gridAxes(placed, carton, eps);
  const points = [];
  for (const z of zs) for (const y of ys) for (const x of xs) points.push([x, y, z]);
  return points;
}

function greedyPlace(order, carton, cfg, state, mode) {
  const { eps } = cfg;
  const placed = [];
  const placedUnits = [];
  for (const unit of order) {
    if (state.now() > state.deadline) return { kind: 'timeout' };
    let best = null;
    let bestScore = null;
    for (const [x, y, z] of cornerGrid(placed, carton, eps)) {
      for (const [dx, dy, dz] of rotations(unit)) {
        state.candidatesChecked++;
        const cand = { unitId: unit.unitId, x, y, z, dx, dy, dz };
        if (!canPlace(cand, unit.fragile, placed, placedUnits, carton, cfg)) continue;
        const score = scoreOf(cand, mode);
        if (!bestScore || better(score, bestScore, eps)) {
          best = cand;
          bestScore = score;
        }
      }
    }
    if (!best) return { kind: 'incomplete' };
    placed.push(best);
    placedUnits.push(unit);
  }
  return { kind: 'complete', placements: placed };
}

function shapeKey(u) {
  return `${u.dims.join(',')}|${u.fragile ? 1 : 0}|${u.liquid ? u.uprightHeight : '-'}`;
}

function anchorSearch(units, carton, cfg, state, nodeLimit, softDeadline) {
  const { eps } = cfg;
  const n = units.length;
  const order = [...units].sort((a, b) => volume(b.dims) - volume(a.dims) || a.unitId.localeCompare(b.unitId));
  const rots = order.map((u) => rotations(u).filter((d) => fitsInCarton(d, carton.inner, eps)));
  const [L, W, H] = carton.inner;
  const slack = volume(carton.inner) - order.reduce((s, u) => s + volume(u.dims), 0);
  const tolerance = 1e-6 * volume(carton.inner);
  const used = new Array(n).fill(false);
  const placed = [];
  const placedUnits = [];
  const voids = [];
  let waste = 0;
  let nodes = 0;
  let stop = null;

  const anchor = () => {
    const obstacles = voids.length ? [...placed, ...voids] : placed;
    const [xs, ys, zs] = gridAxes(obstacles, carton, eps);
    for (const z of zs) {
      const layer = obstacles.filter((b) => z >= b.z - eps && z < b.z + b.dz - eps);
      for (const y of ys) {
        const row = layer.filter((b) => y >= b.y - eps && y < b.y + b.dy - eps);
        let i = 0;
        while (i < xs.length) {
          const x = xs[i];
          const cover = row.find((b) => x >= b.x - eps && x < b.x + b.dx - eps);
          if (!cover) return [x, y, z];
          const end = cover.x + cover.dx - eps;
          while (i < xs.length && xs[i] < end) i++;
        }
      }
    }
    return null;
  };

  const voidAt = ([x, y, z], minSide) => {
    const obstacles = voids.length ? [...placed, ...voids] : placed;
    const spans = (a0, a1, b0, b1) => a0 < b1 - eps && b0 < a1 - eps;
    let x1 = L;
    for (const b of obstacles) {
      if (b.x >= x + eps && b.x < x1 && spans(y, y + eps, b.y, b.y + b.dy) && spans(z, z + eps, b.z, b.z + b.dz)) x1 = b.x;
    }
    let y1 = W;
    for (const b of obstacles) {
      if (b.y >= y + eps && b.y < y1 && spans(x, x1, b.x, b.x + b.dx) && spans(z, z + eps, b.z, b.z + b.dz)) y1 = b.y;
    }
    let z1 = Math.min(H, z + minSide);
    for (const b of obstacles) {
      const top = b.z + b.dz;
      if (top > z + eps && top < z1) z1 = top;
      if (b.z > z + eps && b.z < z1 && spans(x, x1, b.x, b.x + b.dx) && spans(y, y1, b.y, b.y + b.dy)) z1 = b.z;
    }
    return { unitId: '', x, y, z, dx: x1 - x, dy: y1 - y, dz: z1 - z };
  };

  const dfs = (depth) => {
    if (depth === n) return true;
    if (++nodes > nodeLimit) {
      stop = 'limit';
      return false;
    }
    if ((nodes & 63) === 0) {
      const t = state.now();
      if (t > state.deadline || t > softDeadline) {
        stop = 'timeout';
        return false;
      }
    }
    const p = anchor();
    if (!p) return false;
    const [x, y, z] = p;
    const tried = new Set();
    let minSide = Infinity;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const u = order[i];
      minSide = Math.min(minSide, u.dims[2]);
      const key = shapeKey(u);
      if (tried.has(key)) continue;
      tried.add(key);
      for (const [dx, dy, dz] of rots[i]) {
        state.candidatesChecked++;
        const cand = { unitId: u.unitId, x, y, z, dx, dy, dz };
        if (!canPlace(cand, u.fragile, placed, placedUnits, carton, cfg, voids)) continue;
        used[i] = true;
        placed.push(cand);
        placedUnits.push(u);
        if (dfs(depth + 1)) return true;
        used[i] = false;
        placed.pop();
        placedUnits.pop();
        if (stop) return false;
      }
    }
    const gap = voidAt(p, minSide);
    const gapVolume = gap.dx * gap.dy * gap.dz;
    if (gapVolume > eps && waste + gapVolume <= slack + tolerance) {
      voids.push(gap);
      waste += gapVolume;
      if (dfs(depth)) return true;
      voids.pop();
      waste -= gapVolume;
    }
    return false;
  };

  const ok = dfs(0);
  if (ok) return { kind: 'complete', placements: placed };
  if (stop === 'timeout' && state.now() > state.deadline) return { kind: 'timeout' };
  return { kind: 'incomplete' };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function canonical(units) {
  return [...units].sort((a, b) => a.unitId.localeCompare(b.unitId));
}

function restartOrders(units, cartonId, count) {
  const sorted = canonical(units);
  const rand = mulberry32(seedOf(sorted.map((u) => u.unitId).join('|') + '@' + cartonId));
  const out = [];
  for (let k = 0; k < count; k++) {
    const shuffled = [...sorted];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const fragileLast = k % 2 === 0;
    const order = fragileLast
      ? [...shuffled.filter((u) => !u.fragile), ...shuffled.filter((u) => u.fragile)]
      : shuffled;
    out.push({ name: `restart_${k + 1}`, order, score: RESTART_SCORES[Math.floor(k / 2) % RESTART_SCORES.length] });
  }
  return out;
}

function validateLayout(units, carton, placements, cfg) {
  const errors = [];
  const byId = new Map(units.map((u) => [u.unitId, u]));
  const counts = new Map();
  for (const p of placements) counts.set(p.unitId, (counts.get(p.unitId) || 0) + 1);
  for (const u of units) if (counts.get(u.unitId) !== 1) errors.push('incomplete');
  for (const id of counts.keys()) if (!byId.has(id) || counts.get(id) !== 1) errors.push('duplicate');
  const [L, W, H] = carton.inner;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i], unit = byId.get(p.unitId);
    if (!unit) continue;
    if (p.x < -cfg.eps || p.y < -cfg.eps || p.z < -cfg.eps || p.x + p.dx > L + cfg.eps || p.y + p.dy > W + cfg.eps || p.z + p.dz > H + cfg.eps) errors.push('bounds');
    if (!rotations(unit).some((d) => near(d[0], p.dx, cfg.eps) && near(d[1], p.dy, cfg.eps) && near(d[2], p.dz, cfg.eps))) errors.push('rotation');
    let support = 0;
    for (let j = 0; j < placements.length; j++) {
      if (i === j) continue;
      const other = placements[j], otherUnit = byId.get(other.unitId);
      if (boxesOverlap(p, other, cfg.eps)) errors.push('overlap');
      const area = contactArea(p, other, cfg.eps);
      if (area > cfg.eps) {
        if (otherUnit?.fragile) errors.push('fragile_support');
        support += area;
      }
      if (unit.fragile && contactArea(other, p, cfg.eps) > cfg.eps) errors.push('on_fragile');
    }
    if (p.z > cfg.eps && support + cfg.eps < cfg.minSupport * p.dx * p.dy) errors.push('support');
  }
  const weight = units.reduce((s, u) => s + u.weightG, 0) + carton.tareG;
  if (weight > carton.maxWeightG + cfg.eps) errors.push('weight');
  return { valid: errors.length === 0, violations: errors };
}

export function packUnits(input, cartons = CARTONS, opts = {}) {
  const units = canonical(input);
  const cfg = { ...ENGINE_CONFIG, ...opts.config };
  const rates = opts.rates || SHIPPING_RATES;
  const now = opts.now || (() => (typeof performance === 'undefined' ? Date.now() : performance.now()));
  const start = now();
  const state = { candidatesChecked: 0, deadline: start + cfg.maxSearchMs, now };
  const attempts = [];
  const violations = [];
  let validatorRejections = 0;
  let timedOut = false;
  const found = [];
  const unitsWeight = units.reduce((s, u) => s + u.weightG, 0);
  const unitsVolume = units.reduce((s, u) => s + volume(u.dims), 0);
  const ordered = [...cartons].sort((a, b) => a.costSar - b.costSar || volume(a.inner) - volume(b.inner) || a.id.localeCompare(b.id));
  const rejected = new Set();
  const outcome = new Map();
  const searchable = [];
  const costOf = new Map(ordered.map((c) => [c.id, estimateCost(c, units, rates, cfg.wallCm).totalSar]));
  const beats = (a, b) => costOf.get(a.id) < costOf.get(b.id)
    || (costOf.get(a.id) === costOf.get(b.id) && volume(a.inner) < volume(b.inner));

  const runTries = (carton, tries, softDeadline) => {
    for (const t of tries) {
      if (t.extra && now() > softDeadline) break;
      const result = t.run(softDeadline);
      if (result.kind === 'timeout') {
        timedOut = true;
        return null;
      }
      if (result.kind === 'incomplete') continue;
      const check = validateLayout(units, carton, result.placements, cfg);
      if (!check.valid) {
        validatorRejections++;
        rejected.add(carton.id);
        violations.push(...check.violations.map((code) => ({ code, cartonId: carton.id })));
        continue;
      }
      found.push({ carton, placements: result.placements, strategy: t.name });
      return t.name;
    }
    return null;
  };

  for (const carton of ordered) {
    if (timedOut) {
      outcome.set(carton.id, { cartonId: carton.id, outcome: 'search_budget', strategy: null });
      continue;
    }
    if (units.some((u) => !rotations(u).some((d) => fitsInCarton(d, carton.inner, cfg.eps)))) {
      outcome.set(carton.id, { cartonId: carton.id, outcome: 'oversize', strategy: null });
      continue;
    }
    if (unitsWeight + carton.tareG > carton.maxWeightG + cfg.eps) {
      outcome.set(carton.id, { cartonId: carton.id, outcome: 'overweight', strategy: null });
      continue;
    }
    if (unitsVolume > volume(carton.inner) + cfg.eps) {
      outcome.set(carton.id, { cartonId: carton.id, outcome: 'no_layout', strategy: null });
      continue;
    }
    const cartonsLeft = ordered.length - ordered.indexOf(carton);
    const softDeadline = now() + (state.deadline - now()) / cartonsLeft;
    const tries = [
      ...STRATEGIES.map((s) => {
        const order = orderUnits(units, s);
        return { name: s.name, extra: false, run: () => greedyPlace(order, carton, cfg, state, s.score) };
      }),
      ...restartOrders(units, carton.id, cfg.restarts).map((r) => ({
        name: r.name,
        extra: true,
        run: () => greedyPlace(r.order, carton, cfg, state, r.score),
      })),
    ];
    const packedWith = runTries(carton, tries, softDeadline);
    if (packedWith) outcome.set(carton.id, { cartonId: carton.id, outcome: 'packed', strategy: packedWith });
    else if (timedOut) outcome.set(carton.id, { cartonId: carton.id, outcome: 'search_budget', strategy: null });
    else searchable.push(carton);
  }

  searchable.sort((a, b) => (beats(a, b) ? -1 : beats(b, a) ? 1 : a.id.localeCompare(b.id)));
  for (const carton of searchable) {
    if (timedOut) {
      outcome.set(carton.id, { cartonId: carton.id, outcome: 'search_budget', strategy: null });
      continue;
    }
    const worthIt = found.every((f) => beats(carton, f.carton));
    let packedWith = null;
    if (worthIt) {
      const left = searchable.length - searchable.indexOf(carton);
      const softDeadline = now() + (state.deadline - now()) / left;
      packedWith = runTries(carton, [{
        name: 'anchor_search', extra: true,
        run: (d) => anchorSearch(units, carton, cfg, state, cfg.anchorNodes, d),
      }], softDeadline);
    }
    if (packedWith) outcome.set(carton.id, { cartonId: carton.id, outcome: 'packed', strategy: packedWith });
    else if (timedOut) outcome.set(carton.id, { cartonId: carton.id, outcome: 'search_budget', strategy: null });
    else {
      const code = rejected.has(carton.id) ? 'validator_rejected' : worthIt ? 'no_layout' : 'not_needed';
      outcome.set(carton.id, { cartonId: carton.id, outcome: code, strategy: null });
    }
  }
  for (const carton of ordered) attempts.push(outcome.get(carton.id));
  const searchMs = Math.round(now() - start);
  const common = { attempts, candidatesChecked: state.candidatesChecked, validatorRejections, violations, searchMs };
  if (found.length === 0) return { status: 'no_box', reason: 'No valid carton found within the search budget', ...common };
  const scored = found.map((f) => ({ ...f, cost: estimateCost(f.carton, units, rates, cfg.wallCm) }));
  scored.sort((a, b) => a.cost.totalSar - b.cost.totalSar || volume(a.carton.inner) - volume(b.carton.inner));
  const best = scored[0];
  return { status: 'box_found', carton: best.carton, placements: best.placements, units, strategy: best.strategy, cost: best.cost, ...common };
}
