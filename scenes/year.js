// The year: weekly GitHub contributions drawn as the line, with real milestones marked on it.
// Daily pushes to GitLab hang below the axis on the same calendar, kept apart from the GitHub total.
const NS = 'http://www.w3.org/2000/svg';
const MARKS = [
  { date: '2026-06-02', label: 'Echo on the App Store' },
  { date: '2026-07-22', label: 'DocMara on the App Store' },
  { date: '2026-09-10', label: 'Busiest day: 194' },
  { date: '2026-10-23', label: 'Rassah, built in two days' },
];

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}

// monotone cubic through points (Fritsch–Carlson), returns path data
function smooth(pts) {
  const n = pts.length, dx = [], dy = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i][0] + h).toFixed(1)} ${(pts[i][1] + h * t[i]).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)} ${(pts[i + 1][1] - h * t[i + 1]).toFixed(1)} ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

// GitLab's own activity calendar: one square per day, a column per week, Sunday on top.
function drawCalendar(host, lab) {
  const DAY = 864e5, C = 20, G = 5, top = 22, left = 34;
  const counts = new Map(lab.days);
  const first = Date.parse(lab.days[0][0]), end = Date.parse(lab.to);
  const start = first - new Date(first).getUTCDay() * DAY;
  const cols = Math.floor((end - start) / DAY / 7) + 1;
  const sorted = lab.days.map(d => d[1]).sort((a, b) => a - b);
  const q = f => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = n => (n ? 1 + cuts.filter(c => n > c).length : 0);
  const W = left + cols * (C + G) - G, H = top + 7 * (C + G) - G;
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const total = lab.days.reduce((s, d) => s + d[1], 0);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `GitLab activity calendar: ${total.toLocaleString('en-US')} pushes on ${lab.days.length} days, busiest ${Math.max(...sorted)} in a day.` });
  ['Mon', 'Wed', 'Fri'].forEach((d, i) => {
    el('text', { x: 0, y: top + (1 + i * 2) * (C + G) + C - 3, class: 'lab__axis', 'aria-hidden': 'true' }, svg).textContent = d;
  });
  let lastMonth = -1;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const t = start + (c * 7 + r) * DAY;
      if (t > end) break;
      const dt = new Date(t);
      if (dt.getUTCMonth() !== lastMonth && dt.getUTCDate() <= 7 && r === 0) {
        lastMonth = dt.getUTCMonth();
        el('text', { x: left + c * (C + G), y: 13, class: 'lab__axis', 'aria-hidden': 'true' }, svg).textContent = dt.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      }
      const n = counts.get(dt.toISOString().slice(0, 10)) ?? 0;
      const sq = el('rect', { x: left + c * (C + G), y: top + r * (C + G), width: C, height: C, rx: 3, fill: `var(--lab-${level(n)})`, class: 'lab__day', style: `transition-delay:${c * 45 + r * 12}ms` }, svg);
      el('title', {}, sq).textContent = `${n ? n : 'No'} ${n === 1 ? 'push' : 'pushes'} on ${fmt.format(dt)}`;
    }
  }
  host.replaceChildren(svg);
}

export function mount(root, { reduced }) {
  const mq = matchMedia('(min-width: 761px)');
  let labIO = null, data = null, lab = null, L = null, line, area, marks = [], months = [];
  let lastP = reduced ? 1 : 0;

  function render() {
    if (!data) return;
    const wide = mq.matches;
    const S = lab ? (wide ? 64 : 44) : 0; // room for the GitLab strip under the axis
    const W = wide ? 1200 : 360, H = (wide ? 380 : 360) + S;
    const padT = wide ? 70 : 64, padB = 36 + S;
    const weeks = data.weeks.slice(0, -1); // drop the partial current week
    const max = Math.max(...weeks.map(w => w[1]));
    const x = i => (i / (weeks.length - 1)) * W;
    const y = v => padT + (1 - Math.sqrt(v / max)) * (H - padT - padB);
    const pts = weeks.map((w, i) => [x(i), y(w[1])]);
    L = { W, H, pts, base: H - padB };
    const total = lab ? lab.days.reduce((s, d) => s + d[1], 0) : 0;
    root.replaceChildren();
    root.style.aspectRatio = `${W} / ${H}`;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Weekly GitHub contributions from ${data.from} to ${data.to}, ${data.total.toLocaleString('en-US')} in total. Activity climbs through the year and peaks in September and October 2026.${lab ? ` Below the axis, ${total.toLocaleString('en-US')} pushes to GitLab, one bar per day.` : ''}` }, root);
    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id: 'year-fill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': 'currentColor', 'stop-opacity': '.14' }, grad);
    el('stop', { offset: '1', 'stop-color': 'currentColor', 'stop-opacity': '0' }, grad);
    const clip = el('clipPath', { id: 'year-reveal' }, defs);
    const reveal = el('rect', { x: 0, y: 0, width: 0, height: H, class: 'year__reveal' }, clip);
    // month ticks
    const g = el('g', { class: 'year__axis', 'aria-hidden': 'true' }, svg);
    el('line', { x1: 0, x2: W, y1: L.base, y2: L.base, class: 'year__base' }, g);
    months = [];
    let lastMonth = '';
    weeks.forEach((w, i) => {
      const dt = new Date(w[0] + 'T00:00:00Z');
      const mon = dt.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      if (mon !== lastMonth && dt.getUTCDate() <= 7) {
        lastMonth = mon;
        if (!wide && dt.getUTCMonth() % 3 !== 1) return;
        const t = el('text', { x: x(i), y: H - 10, class: 'year__month' }, g);
        t.textContent = mon;
      }
    });
    if (lab) {
      // one bar per day, hanging from the axis; square-root scale like the line
      const t0 = Date.parse(data.from), span = Date.parse(data.to) - t0;
      const dmax = Math.max(...lab.days.map(dd => dd[1]));
      const bw = Math.max(1.4, (W / (span / 864e5)) * 0.62);
      const gl = el('g', { class: 'year__lab', 'clip-path': 'url(#year-reveal)', 'aria-hidden': 'true' }, svg);
      let firstX = W;
      for (const [day, n] of lab.days) {
        const cx = ((Date.parse(day) - t0) / span) * W;
        if (cx < 0 || cx > W) continue;
        firstX = Math.min(firstX, cx);
        el('rect', { x: (cx - bw / 2).toFixed(1), y: L.base + 3, width: bw.toFixed(1), height: (Math.sqrt(n / dmax) * (S - 12)).toFixed(1), rx: Math.min(bw / 2, 1.5), class: 'year__push' }, gl);
      }
      const t = el('text', { x: firstX - 10, y: L.base + 18, 'text-anchor': 'end', class: 'year__lab-label' }, svg);
      t.setAttribute('aria-hidden', 'true');
      t.textContent = 'GitLab';
    }
    const d = smooth(pts);
    area = el('path', { d: `${d}L${W} ${L.base}L0 ${L.base}Z`, class: 'year__area', fill: 'url(#year-fill)', 'clip-path': 'url(#year-reveal)' }, svg);
    // after the last week the line drops past the axis, so the thread leaves below the months
    line = el('path', { d: `${d}V${H}`, pathLength: 1, class: 'year__line' }, svg);
    // milestones
    marks = MARKS.map((m, j) => {
      const idx = weeks.findIndex((w, i) => i === weeks.length - 1 || weeks[i + 1][0] > m.date);
      const px = x(idx), py = pts[idx][1];
      const mg = el('g', { class: 'year__mark', 'aria-hidden': 'true' }, svg);
      const top = wide ? padT - 46 + (j % 2) * 26 : 14 + j * 0;
      if (wide) {
        el('line', { x1: px, x2: px, y1: top + 8, y2: py - 8, class: 'year__stem' }, mg);
        const t = el('text', { x: px, y: top, 'text-anchor': px > W - 160 ? 'end' : 'middle', class: 'year__label' }, mg);
        t.textContent = m.label;
      }
      el('circle', { cx: px, cy: py, r: wide ? 5 : 4, class: 'year__dot' }, mg);
      return { g: mg, t: idx / (weeks.length - 1) };
    });
    if (!wide) {
      // compact legend under the title on phones: only the two launches
      const lg = el('g', { class: 'year__legend', 'aria-hidden': 'true' }, svg);
      ['Echo launched', 'DocMara launched'].forEach((s, i) => {
        const m = marks[i];
        const c = pts[Math.round(m.t * (weeks.length - 1))];
        el('line', { x1: c[0], x2: c[0], y1: 20 + i * 22, y2: c[1] - 8, class: 'year__stem' }, lg);
        const t = el('text', { x: c[0] - 6, y: 24 + i * 22, 'text-anchor': 'end', class: 'year__label' }, lg);
        t.textContent = s;
      });
      marks.slice(2).forEach(m => m.g.remove());
      marks = marks.slice(0, 2);
    }
    L.reveal = reveal;
    update(lastP);
  }

  function update(p) {
    lastP = p;
    if (!L) return;
    const k = reduced ? 1 : Math.min(1, Math.max(0, (p - 0.12) / 0.4));
    line.style.strokeDashoffset = String(1 - k);
    L.reveal.setAttribute('width', (L.W * k).toFixed(1));
    marks.forEach(m => m.g.classList.toggle('is-on', k >= m.t - 0.005));
  }

  Promise.all([
    fetch('assets/data/weeks.json').then(r => r.json()),
    fetch('assets/data/gitlab.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([j, g]) => {
    data = j; lab = g?.days?.length ? g : null;
    const host = root.closest('section')?.querySelector('[data-lab-cal]');
    if (lab && host) {
      drawCalendar(host, lab);
      const block = host.closest('.lab');
      if (reduced) block.classList.add('is-on');
      else {
        labIO = new IntersectionObserver(([e]) => { if (e.isIntersecting) { block.classList.add('is-on'); labIO.disconnect(); } }, { threshold: 0.3 });
        labIO.observe(host);
      }
    }
    render();
  });
  const onChange = () => render();
  mq.addEventListener('change', onChange);
  return {
    update,
    anchors: () => L ? { entry: { x: 0, y: L.pts[0][1] / L.H }, exit: { x: 1, y: 1 } } : null,
    destroy() { labIO?.disconnect(); mq.removeEventListener('change', onChange); root.replaceChildren(); },
  };
}
