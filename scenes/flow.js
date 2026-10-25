// Hero scene: the statement drawn as one line — problem → requirements → workflows → APIs → shipped products.
const NS = 'http://www.w3.org/2000/svg';
const STATIONS = ['User and business problems', 'Requirements', 'System workflows', 'API integrations', 'Shipped products'];
const ICONS = [
  { src: 'assets/img/icon-mara.webp', label: 'Mara' },
  { src: 'assets/img/icon-echo.webp', label: 'Echo' },
  { src: 'assets/img/icon-docmara.webp', label: 'DocMara' },
];

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}

function layout(wide) {
  if (wide) {
    // 1200 × 300. Starts at a dot on the left, runs right through the stations, turns down to bottom-centre.
    const W = 1200, H = 300, y = 120;
    const xs = [24, 256, 488, 720, 952];
    const d = `M${xs[0]} ${y}H1136Q1176 ${y} 1176 ${y + 40}V196Q1176 236 1136 236H640Q600 236 600 276V${H}`;
    return { W, H, d, stations: xs.map((x, i) => ({ x, y, lx: x, ly: y + 34, anchor: 'start', t: [0, .2, .4, .6, .8][i] })), icons: { x: 952 - 6, y: y - 96, size: 58, gap: 14, dir: 'row' }, exit: { x: .5, y: 1 } };
  }
  // 360 × 640 portrait. Runs down the left, curls to the centre bottom.
  const W = 360, H = 640, x = 18;
  const ys = [16, 128, 240, 352, 464];
  const d = `M${x} ${ys[0]}V556Q${x} 590 52 590H146Q180 590 180 624V${H}`;
  return { W, H, d, stations: ys.map((y, i) => ({ x, y, lx: x + 26, ly: y + 6, anchor: 'start', t: [0, .19, .38, .57, .76][i] })), icons: { x: 44, y: 476, size: 50, gap: 12, dir: 'row' }, exit: { x: .5, y: 1 } };
}

export function mount(root, { reduced }) {
  const mq = matchMedia('(min-width: 761px)');
  let L, svg, path, dots = [], labels = [], icons = [];

  function render() {
    L = layout(mq.matches);
    root.replaceChildren();
    root.style.aspectRatio = `${L.W} / ${L.H}`;
    svg = el('svg', { viewBox: `0 0 ${L.W} ${L.H}`, role: 'img', 'aria-label': 'A single line passing through five steps: user and business problems, requirements, system workflows, API integrations and shipped products, ending at the Mara, Echo and DocMara app icons.' }, root);
    const defs = el('defs', {}, svg);
    path = el('path', { d: L.d, pathLength: 1, class: 'flow__line' }, svg);
    // where each station sits along the line, so labels appear as the stroke reaches them
    const total = path.getTotalLength(), s0 = L.stations[0];
    L.stations.forEach(s => { s.t = (Math.abs(s.x - s0.x) + Math.abs(s.y - s0.y)) / total; });
    dots = []; labels = []; icons = [];
    L.stations.forEach((s, i) => {
      const g = el('g', { class: 'flow__station', 'aria-hidden': 'true' }, svg);
      dots.push(el('circle', { cx: s.x, cy: s.y, r: i === 0 ? 6 : 5, class: i === 0 ? 'flow__dot flow__dot--start' : 'flow__dot' }, g));
      const t = el('text', { x: s.lx, y: s.ly, 'text-anchor': s.anchor, class: 'flow__label' }, g);
      // the first label is long; on wide layouts it wraps so it never reaches the next station
      const lines = mq.matches && i === 0 ? ['User and business', 'problems'] : [STATIONS[i]];
      lines.forEach((ln, j) => { const ts = el('tspan', { x: s.lx, dy: j ? '1.2em' : 0 }, t); ts.textContent = ln; });
      labels.push(g);
    });
    const I = L.icons;
    ICONS.forEach((ic, i) => {
      const x = I.x + i * (I.size + I.gap), y = I.y;
      const id = `flow-clip-${i}-${mq.matches ? 'w' : 'n'}`;
      const cp = el('clipPath', { id }, defs);
      el('rect', { x, y, width: I.size, height: I.size, rx: I.size * .225 }, cp);
      const g = el('g', { class: 'flow__icon', style: `--i:${i}; transform-origin: ${x + I.size / 2}px ${y + I.size}px` }, svg);
      el('rect', { x, y: y + 6, width: I.size, height: I.size, rx: I.size * .225, class: 'flow__icon-shadow' }, g);
      const img = el('image', { href: ic.src, x, y, width: I.size, height: I.size, 'clip-path': `url(#${id})`, preserveAspectRatio: 'xMidYMid slice' }, g);
      img.setAttribute('aria-label', ic.label);
      icons.push(g);
    });
    update(lastP);
  }

  let lastP = reduced ? 1 : 0;
  function update(p) {
    lastP = p;
    const k = reduced ? 1 : Math.min(1, Math.max(0, (p - 0.02) / 0.42));
    path.style.strokeDashoffset = String(1 - k);
    L.stations.forEach((s, i) => {
      const on = k >= s.t + 0.01 || reduced;
      labels[i].classList.toggle('is-on', on);
    });
    const shipped = k >= L.stations[4].t || reduced;
    icons.forEach(g => g.classList.toggle('is-on', shipped));
  }

  const onChange = () => render();
  mq.addEventListener('change', onChange);
  render();
  return {
    update,
    anchors: () => ({ entry: { x: L.stations[0].x / L.W, y: L.stations[0].y / L.H }, exit: L.exit }),
    destroy() { mq.removeEventListener('change', onChange); root.replaceChildren(); },
  };
}
