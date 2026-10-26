// Scene: tube — the page line becomes an original, schematic route map. Products branches at Mara and Work
// at Echo; each branch ends at a supplied project or co-op fact. Certificates and programmes are ticks on Education. Education runs from King Saud University
// to the B.Sc. endpoint. Stations appear as their lines draw; hover, tap or focus one to read its detail.
// Phones get the same 45/90-degree geometry running vertically.
// Facts come from the <ol class="tube__list"> in the section (the fallback below is for the harness only).

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const r1 = (n) => Math.round(n * 10) / 10;

const LINES = { edu: 'Education', prod: 'Products', work: 'Work' };

const FALLBACK = {
  edu: { key: 'edu', line: 'edu', name: 'King Saud University', when: '2022', endName: 'B.Sc. Computer Information Systems', endWhen: '2026', time: '2022 – 2026', title: 'King Saud University', paras: [{ text: 'B.Sc. Computer Information Systems' }] },
  mara: { key: 'mara', line: 'prod', name: 'Mara', when: '2025', time: '2025', title: 'Started building Mara', paras: [{ text: 'Misk Launchpad Cohort 9; private beta of 38 users.' }] },
  echo: { key: 'echo', line: 'prod', name: 'Echo', when: 'Jun 2026', time: 'June 2026', title: 'Echo on the App Store', paras: [] },
  coop: { key: 'coop', line: 'work', name: 'Air Connectivity Program', when: 'Jun – Sep 2026', time: 'Jun – Sep 2026', title: 'Digital Systems & Business Analysis Co-op Trainee', paras: [{ text: 'Air Connectivity Program', org: true }, { text: 'QA testing, system reviews, issue analysis and technical documentation.' }] },
  docmara: { key: 'docmara', line: 'prod', name: 'DocMara', when: 'Jul 2026', time: 'July 2026', title: 'DocMara on the App Store', paras: [] },
  rassah: { key: 'rassah', line: 'prod', name: 'Rassah', when: 'Oct 2026', time: 'October 2026', title: 'Rassah', paras: [{ text: "Built in two days, in Tuwaiq Academy's AI product programme." }] },
};

// map order = time order. kind: end (terminus bar), ring (interchange), tick
const STATIONS = [
  { id: 'ksu', key: 'edu', line: 'edu', kind: 'end' },
  { id: 'hcia', key: 'hcia', line: 'edu', kind: 'tick', side: 'below' },
  { id: 'cs50', key: 'cs50', line: 'edu', kind: 'tick', side: 'below' },
  { id: 'mara', key: 'mara', line: 'edu', kind: 'ring' },
  { id: 'dlai', key: 'dlai', line: 'edu', kind: 'tick', side: 'below' },
  { id: 'daleelk', key: 'daleelk', line: 'prod', kind: 'tick' },
  { id: 'tuwaiq', key: 'tuwaiq', line: 'edu', kind: 'tick', side: 'below' },
  { id: 'pitlane', key: 'pitlane', line: 'prod', kind: 'tick' },
  { id: 'echo', key: 'echo', line: 'prod', kind: 'ring' },
  { id: 'coop', key: 'coop', line: 'work', kind: 'end' },
  { id: 'docmara', key: 'docmara', line: 'prod', kind: 'tick' },
  { id: 'tuwaiqai', key: 'tuwaiqai', line: 'edu', kind: 'tick', side: 'below' },
  { id: 'rassah', key: 'rassah', line: 'prod', kind: 'end' },
  { id: 'bsc', key: 'edu', line: 'edu', kind: 'end', alt: true },
];

function readItems(section) {
  const lis = section ? [...section.querySelectorAll('.tube__list li[data-key]')] : [];
  if (!lis.length) return FALLBACK;
  const out = {};
  for (const li of lis) {
    const d = li.dataset;
    out[d.key] = {
      key: d.key, line: d.line, name: d.name, when: d.when, endName: d.endName, endWhen: d.endWhen,
      time: li.querySelector('time')?.textContent.trim() || '',
      title: li.querySelector('h3')?.textContent.trim() || d.name,
      paras: [...li.querySelectorAll('p')].map((p) => ({ text: p.textContent.trim(), org: p.classList.contains('tube__org') })),
    };
  }
  return out;
}

// polyline with rounded corners -> path d + samples [len, x, y] for coordinate -> length lookups
function rounded(pts, rad) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  const S = [[0, pts[0][0], pts[0][1]]];
  let len = 0, cur = pts[0];
  const push = (x, y, l) => { len += l; S.push([len, x, y]); cur = [x, y]; };
  for (let i = 1; i < pts.length; i++) {
    const P = pts[i];
    if (i === pts.length - 1) { d += `L${r1(P[0])} ${r1(P[1])}`; push(P[0], P[1], Math.hypot(P[0] - cur[0], P[1] - cur[1])); break; }
    const A = pts[i - 1], B = pts[i + 1];
    const la = Math.hypot(P[0] - A[0], P[1] - A[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
    const u = [(P[0] - A[0]) / la, (P[1] - A[1]) / la], v = [(B[0] - P[0]) / lb, (B[1] - P[1]) / lb];
    const phi = Math.acos(clamp(u[0] * v[0] + u[1] * v[1], -1, 1));
    let t = rad * Math.tan(phi / 2);
    t = Math.min(t, la / 2, lb / 2);
    const rr = t / Math.tan(phi / 2);
    const p0 = [P[0] - u[0] * t, P[1] - u[1] * t], p1 = [P[0] + v[0] * t, P[1] + v[1] * t];
    const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    d += `L${r1(p0[0])} ${r1(p0[1])}A${r1(rr)} ${r1(rr)} 0 0 ${sweep} ${r1(p1[0])} ${r1(p1[1])}`;
    push(p0[0], p0[1], Math.hypot(p0[0] - cur[0], p0[1] - cur[1]));
    push(p1[0], p1[1], rr * phi);
  }
  return { d, S, len };
}
function lenAt(S, c, ax) {
  const k = ax === 'x' ? 1 : 2;
  if (c <= S[0][k]) return 0;
  for (let i = 1; i < S.length; i++) {
    if (c <= S[i][k]) {
      const a = S[i - 1], b = S[i];
      const t = b[k] === a[k] ? 1 : (c - a[k]) / (b[k] - a[k]);
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return S[S.length - 1][0];
}

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
};
const h = (tag, cls, text, parent) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  if (parent) parent.append(n);
  return n;
};

export function mount(root, { reduced = false } = {}) {
  const section = root.closest('section');
  const items = readItems(section);
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const map = h('div', 'tb-map');
  const svg = el('svg', { class: 'tb-svg', role: 'img',
    'aria-label': 'A line map with Education from King Saud University through five certificates and programmes to a B.Sc. in Computer Information Systems, Products from Mara through Daleelk, Pit Lane Hub, Echo and DocMara to Rassah, and Work from Echo to the co-op at the Air Connectivity Program.' }, map);
  const labels = h('div', 'tb-labels', null, map);
  const panel = h('div', 'tb-panel', null, map);
  const key = h('div', 'tb-key', null, map);
  key.setAttribute('aria-hidden', 'true');
  for (const [k, name] of Object.entries(LINES)) {
    const row = h('span', `tb-key__row tb-key__row--${k}`, null, key);
    h('i', 'tb-key__sw', null, row);
    h('span', '', name, row);
  }
  let hint = null;
  root.append(map);

  let L = null; // current layout
  let parts = null;
  let selected = null, userPicked = false, autoId = null;
  let width = 0;

  function layout(W) {
    if (W >= 1080) {
      const yE = 92, yP = 250, yW = 330, H = 470;
      const X = (f) => Math.round(f * W);
      const xK = 18, xM = X(0.28), xE = X(0.67), xD = X(0.775);
      const xR = X(0.885), xB = W - 18;
      const xC = xE + (yW - yP) + 40;
      const below = (x) => ({ x, y: yE, dir: 'down', lab: { x: x - 3, y: yE + 22, pos: 'below' } });
      const onProd = (x) => ({ x, y: yP, dir: 'up', lab: { x: x - 3, y: yP - 22, pos: 'above' } });
      return {
        mode: 'h', ax: 'x', W, H, lw: 6, rad: 26,
        lines: {
          edu: [[xK, yE], [xB, yE]],
          prod: [[xM, yE], [xM + (yP - yE), yP], [xR, yP]],
          work: [[xE, yP], [xE + (yW - yP), yW], [xC, yW]],
        },
        entry: [[xK, 0], [xK, yE - 12]],
        exit: [[xB, yE + 12], [xB, H]],
        st: {
          ksu: { x: xK, y: yE, dir: 'v', lab: { x: xK + 16, y: yE - 22, pos: 'above' } },
          hcia: below(X(0.095)),
          cs50: below(X(0.19)),
          mara: { x: xM, y: yE, lab: { x: xM - 9, y: yE - 22, pos: 'above' } },
          dlai: below(X(0.43)),
          daleelk: onProd(X(0.46)),
          tuwaiq: below(X(0.555)),
          pitlane: onProd(X(0.565)),
          echo: { x: xE, y: yP, lab: { x: xE - 9, y: yP - 22, pos: 'above' } },
          coop: { x: xC, y: yW, dir: 'v', lab: { x: xC - 3, y: yW + 22, pos: 'below' } },
          docmara: onProd(xD),
          tuwaiqai: below(X(0.845)),
          rassah: { x: xR, y: yP, dir: 'v', lab: { x: xR - 3, y: yP - 22, pos: 'above' } },
          bsc: { x: xB, y: yE, dir: 'v', lab: { x: xB - 16, y: yE - 22, pos: 'above', end: true } },
        },
        panel: { x: xK, y: yP + 44, w: Math.min(460, xE - xK - 80) },
        key: { x: xB - 120, y: yW + 76 },
      };
    }
    // vertical: lanes on the left, labels in a column on the right; rows sized by their labels
    const L0 = 13, L1 = 37, L2 = 61, LX = 88;
    return { mode: 'v', ax: 'y', W, lw: 5, rad: 18, L0, L1, L2, LX };
  }

  function labelText(st, mode) {
    const it = items[st.key];
    if (!it) return null;
    if (st.key === 'edu') return { name: st.alt ? it.endName : it.name, when: st.alt ? it.endWhen : it.when, paras: [] };
    if (mode === 'h') return { name: it.name, when: it.when, paras: [] };
    return { name: it.title, when: it.time, paras: [] };
  }

  function build() {
    width = Math.round(root.clientWidth || 1200);
    L = layout(width);
    root.dataset.mode = L.mode;
    svg.replaceChildren();
    labels.replaceChildren();

    // labels first (vertical mode needs their heights)
    const btns = {};
    for (const st of STATIONS) {
      const t = labelText(st, L.mode);
      if (!t) continue;
      const b = h('button', `tb-stn tb-stn--${st.line}`, null, labels);
      b.type = 'button';
      b.dataset.id = st.id;
      b.setAttribute('aria-pressed', 'false');
      h('span', 'tb-stn__name', t.name, b);
      h('span', 'tb-stn__when', t.when, b);
      for (const p of t.paras) h('span', p.org ? 'tb-stn__org' : 'tb-stn__detail', p.text, b);
      btns[st.id] = b;
    }

    if (L.mode === 'v') {
      const { L0, L1, L2, LX } = L;
      const lw = width - LX;
      for (const id in btns) { btns[id].style.width = `${lw}px`; btns[id].classList.add('tb-stn--side'); }
      const hgt = {};
      for (const id in btns) hgt[id] = btns[id].offsetHeight;
      const gap = 30, ys = {};
      let y = 40;
      for (const st of STATIONS) {
        if (st.id === 'bsc') break;
        ys[st.id] = y;
        y += Math.max((hgt[st.id] || 0) + gap, 40);
        if (st.id === 'docmara') y += 22;
      }
      ys.bsc = y;
      const keyY = y - 12 + hgt.bsc + 34;
      const panelY = keyY + 92;
      const H = panelY + 220;
      Object.assign(L, {
        H,
        lines: {
          edu: [[L0, ys.ksu], [L0, ys.bsc]],
          prod: [[L0, ys.mara], [L1, ys.mara + (L1 - L0)], [L1, ys.rassah]],
          work: [[L1, ys.echo], [L2, ys.echo + (L2 - L1)], [L2, ys.coop]],
        },
        entry: [[L0, 0], [L0, ys.ksu + 4]],
        exit: [[L0, ys.bsc - 4], [L0, H]],
        key: { x: LX, y: keyY },
        hintY: keyY + 66,
        panel: { x: LX, y: panelY, w: width - LX },
        st: {
          ksu: { x: L0, y: ys.ksu, dir: 'h' },
          hcia: { x: L0, y: ys.hcia, dir: 'left' },
          cs50: { x: L0, y: ys.cs50, dir: 'left' },
          mara: { x: L0, y: ys.mara },
          dlai: { x: L0, y: ys.dlai, dir: 'left' },
          daleelk: { x: L1, y: ys.daleelk, dir: 'right' },
          tuwaiq: { x: L0, y: ys.tuwaiq, dir: 'left' },
          pitlane: { x: L1, y: ys.pitlane, dir: 'right' },
          echo: { x: L1, y: ys.echo },
          coop: { x: L2, y: ys.coop, dir: 'h' },
          docmara: { x: L1, y: ys.docmara, dir: 'right' },
          tuwaiqai: { x: L0, y: ys.tuwaiqai, dir: 'left' },
          rassah: { x: L1, y: ys.rassah, dir: 'h' },
          bsc: { x: L0, y: ys.bsc, dir: 'h' },
        },
      });
      for (const id in btns) L.st[id].lab = { x: LX, y: ys[id] - 12, pos: 'side' };
    }

    const { W, H, lw } = L;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    map.style.height = `${H}px`;

    const gLines = el('g', { class: 'tb-lines', 'aria-hidden': 'true' }, svg);
    const gMarks = el('g', { class: 'tb-marks' }, svg);
    const LS = 'stroke-dasharray:1 2;stroke-dashoffset:1';

    const thread = (pts) => el('path', { class: 'tb-thread', d: `M${pts[0][0]} ${pts[0][1]}L${pts[1][0]} ${pts[1][1]}`, pathLength: 1, style: LS }, gLines);
    const entry = thread(L.entry), exit = thread(L.exit);

    const lines = {};
    for (const k of ['work', 'prod', 'edu']) {
      const g = rounded(L.lines[k], L.rad);
      const path = el('path', { class: `tb-line tb-line--${k}`, d: g.d, pathLength: 1, style: LS, 'stroke-width': lw }, gLines);
      lines[k] = { path, S: g.S, len: g.len };
    }

    // markers
    const marks = {};
    for (const st of STATIONS) {
      const s = L.st[st.id];
      const g = el('g', { class: `tb-mark tb-mark--${st.kind} tb-mark--${st.line}`, 'data-id': st.id }, gMarks);
      g.style.transformOrigin = `${s.x}px ${s.y}px`;
      if (st.kind === 'ring') {
        const r = L.mode === 'h' ? 8.5 : 7.5;
        el('circle', { class: 'tb-ring', cx: s.x, cy: s.y, r }, g);
      } else if (st.kind === 'end') {
        const half = L.mode === 'h' ? 12 : 10;
        const d = s.dir === 'v' ? `M${s.x} ${s.y - half}V${s.y + half}` : `M${s.x - half} ${s.y}H${s.x + half}`;
        el('path', { class: 'tb-bar', d, 'stroke-width': lw }, g);
      } else {
        const len = lw / 2 + (L.mode === 'h' ? 9 : 7);
        const d = s.dir === 'up' ? `M${s.x} ${s.y}V${s.y - len}` : s.dir === 'down' ? `M${s.x} ${s.y}V${s.y + len}` : s.dir === 'left' ? `M${s.x} ${s.y}H${s.x - len}` : `M${s.x} ${s.y}H${s.x + len}`;
        el('path', { class: 'tb-tick', d, 'stroke-width': lw }, g);
      }
      el('circle', { class: 'tb-hit', cx: s.x, cy: s.y, r: 16 }, g);
      marks[st.id] = g;
    }

    // place labels
    for (const id in btns) {
      const b = btns[id], lab = L.st[id].lab;
      b.style.left = `${lab.x}px`;
      b.style.top = `${lab.y}px`;
      b.classList.add(`tb-stn--${lab.pos}`);
      if (lab.end) b.classList.add('tb-stn--end');
    }

    panel.style.left = `${L.panel.x}px`;
    panel.style.top = `${L.panel.y}px`;
    panel.style.width = `${L.panel.w}px`;
    key.style.left = `${L.key.x}px`;
    key.style.top = `${L.key.y}px`;

    // hint: only where the panel is used and the device can do it
    if (!hint) {
      hint = h('p', 'tb-hint', canHover ? 'Hover a station' : 'Tap a station');
      hint.setAttribute('aria-hidden', 'true');
    }
    if (!userPicked) {
      panel.before(hint);
      hint.style.left = `${L.panel.x}px`;
      hint.style.top = `${L.mode === 'h' ? L.panel.y - 28 : L.hintY}px`;
    } else hint.remove();

    // axis positions for reveals
    const order = STATIONS.map((st) => ({ st, c: L.ax === 'x' ? L.st[st.id].x : L.st[st.id].y }));
    parts = { entry, exit, lines, marks, btns, order };
    lastF = -1;
    measure();
    if (selected) select(selected, false);
  }

  // ---------- panel ----------
  function fillPanel(id) {
    const st = STATIONS.find((s) => s.id === id);
    const it = st && items[st.key];
    panel.replaceChildren();
    if (!it) { panel.classList.remove('is-on'); return; }
    const title = st.alt ? it.endName : it.title;
    const when = st.alt ? it.endWhen : it.time;
    const paras = st.alt ? [] : it.paras;
    const top = h('p', `tb-panel__line tb-panel__line--${it.line}`, null, panel);
    h('i', 'tb-panel__sw', null, top);
    h('span', '', `${LINES[it.line]} line`, top);
    h('span', 'tb-panel__when', when, top);
    h('p', 'tb-panel__title', title, panel);
    for (const p of paras) h('p', p.org ? 'tb-panel__org' : 'tb-panel__detail', p.text, panel);
    panel.classList.add('is-on');
  }

  function select(id, byUser = true) {
    const st = STATIONS.find((s) => s.id === id);
    if (!st) return;
    selected = id;
    if (byUser && !userPicked) {
      userPicked = true;
      panel.setAttribute('aria-live', 'polite');
      hint?.classList.add('is-used');
    }
    for (const sid in parts.btns) {
      const on = STATIONS.find((s) => s.id === sid).key === st.key;
      parts.btns[sid].setAttribute('aria-pressed', String(sid === id));
      parts.btns[sid].classList.toggle('is-sel', on);
    }
    for (const sid in parts.marks) parts.marks[sid].classList.toggle('is-sel', STATIONS.find((s) => s.id === sid).key === st.key);
    root.classList.add('has-sel');
    fillPanel(id);
  }

  const idFrom = (e) => e.target.closest?.('[data-id]')?.dataset.id;
  const onClick = (e) => { const id = idFrom(e); if (id) select(id); };
  const onOver = (e) => { if (e.pointerType === 'mouse') { const id = idFrom(e); if (id && id !== selected) select(id); } };
  const onFocus = (e) => { const id = idFrom(e); if (id) select(id); };
  map.addEventListener('click', onClick);
  map.addEventListener('pointerover', onOver);
  map.addEventListener('focusin', onFocus);

  // ---------- scroll ----------
  let vh = 900, secH = 500, off = 0, hh = 500;
  function measure() {
    vh = innerHeight || 900;
    const rr = root.getBoundingClientRect();
    hh = rr.height || (L && L.H) || 500;
    if (section) { const sr = section.getBoundingClientRect(); secH = sr.height; off = rr.top - sr.top; }
    else { secH = hh; off = 0; }
  }
  const pen = (p) => {
    const sceneTop = vh - p * (secH + vh) + off;
    const D = Math.min(hh, 0.12 * vh + 0.5 * hh);
    return clamp((0.62 * vh - sceneTop) / D);
  };

  let lastF = -1, lastP = reduced ? 1 : 0;
  function render(p) {
    lastP = p;
    if (!parts) return;
    const F = reduced ? 1 : pen(p);
    if (Math.abs(F - lastF) < 1e-4) return;
    lastF = F;
    const { entry, exit, lines, marks, btns, order } = parts;
    let cur, eF, xF;
    if (L.mode === 'h') {
      eF = clamp(F / 0.08);
      xF = clamp((F - 0.92) / 0.08);
      const t = clamp((F - 0.08) / 0.84);
      const x0 = L.lines.edu[0][0], x1 = L.lines.edu[1][0];
      cur = F <= 0.08 ? -1 : x0 + (x1 - x0) * t + (t >= 1 ? 1 : 0);
    } else {
      cur = F * L.H;
      eF = clamp(cur / L.entry[1][1]);
      xF = clamp((cur - L.exit[0][1]) / (L.H - L.exit[0][1]));
      if (F >= 1) cur = L.H + 1;
    }
    entry.style.strokeDashoffset = String(r1((1 - eF) * 1000) / 1000);
    exit.style.strokeDashoffset = String(r1((1 - xF) * 1000) / 1000);
    for (const k in lines) {
      const o = lines[k];
      const f = cur < 0 ? 0 : lenAt(o.S, cur, L.ax) / o.len;
      o.path.style.strokeDashoffset = String(Math.round((1 - f) * 1e4) / 1e4);
    }
    let latest = null;
    for (const { st, c } of order) {
      const on = cur >= c - 0.5;
      marks[st.id].classList.toggle('is-on', on);
      btns[st.id]?.classList.toggle('is-on', on);
      if (on) latest = st.id;
    }
    if (!userPicked && latest !== autoId) {
      autoId = latest;
      if (latest) { selected = null; fillPanel(latest); } else panel.classList.remove('is-on');
    }
  }

  build();
  render(lastP);

  const ro = new ResizeObserver(() => {
    const w = Math.round(root.clientWidth);
    if (w && Math.abs(w - width) > 1) { build(); render(lastP); }
    else measure();
  });
  ro.observe(root);
  if (section) ro.observe(section);
  const onResize = () => measure();
  addEventListener('resize', onResize);
  let alive = true;
  document.fonts?.ready.then(() => { if (alive && L?.mode === 'v') { build(); render(lastP); } });

  return {
    update(p) { render(clamp(+p)); },
    anchors() {
      if (!L) return null;
      return { entry: { x: L.entry[0][0] / L.W, y: 0 }, exit: { x: L.exit[1][0] / L.W, y: 1 } };
    },
    destroy() {
      alive = false;
      ro.disconnect();
      removeEventListener('resize', onResize);
      map.removeEventListener('click', onClick);
      map.removeEventListener('pointerover', onOver);
      map.removeEventListener('focusin', onFocus);
      root.textContent = '';
      delete root.dataset.mode;
      root.classList.remove('has-sel');
    },
  };
}
