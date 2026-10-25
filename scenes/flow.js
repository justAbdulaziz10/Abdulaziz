// Hero scene: the statement drawn as one line — problem → requirements → workflows → APIs → shipped products.
// On load the same line first signs his name across the hero (scenes/sign.js) and its tail runs into station one.
import { mountSign } from './sign.js';

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
  return { W, H, d, stations: ys.map((y, i) => ({ x, y, lx: x + 26, ly: y + 6, anchor: 'start', t: [0, .19, .38, .57, .76][i] })), icons: { x: 44, y: 490, size: 50, gap: 12, dir: 'row' }, exit: { x: .5, y: 1 } };
}

// a quick squash-and-stretch hop, settling well inside 600 ms
const hop = (a) => [
  { transform: 'translateY(0) scale(1, 1)', easing: 'ease-out' },
  { transform: 'translateY(0) scale(1.07, .9)', offset: .14, easing: 'cubic-bezier(.2, .7, .3, 1)' },
  { transform: `translateY(-${a}%) scale(.95, 1.06)`, offset: .42, easing: 'cubic-bezier(.5, 0, .8, .4)' },
  { transform: 'translateY(0) scale(1.06, .93)', offset: .66, easing: 'ease-out' },
  { transform: `translateY(-${a / 4}%) scale(1, 1)`, offset: .82, easing: 'ease-in' },
  { transform: 'translateY(0) scale(1, 1)' },
];

export function mount(root, { reduced }) {
  const mq = matchMedia('(min-width: 761px)');
  let L, svg, path, ship, dots = [], labels = [], icons = [], hops = [];

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
    dots = []; labels = []; icons = []; hops = [];
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
      const hop = el('g', { class: 'flow__hop' }, g);
      el('rect', { x, y: y + 6, width: I.size, height: I.size, rx: I.size * .225, class: 'flow__icon-shadow' }, hop);
      const img = el('image', { href: ic.src, x, y, width: I.size, height: I.size, 'clip-path': `url(#${id})`, preserveAspectRatio: 'xMidYMid slice' }, hop);
      img.setAttribute('aria-label', ic.label);
      icons.push(g);
      hops.push(hop);
    });
    // "Shipped products" is touchable: hover, focus or tap and the three apps hop
    const last = L.stations[4];
    ship = document.createElement('button');
    ship.type = 'button';
    ship.className = 'flow__ship';
    ship.setAttribute('aria-label', 'Shipped products: Mara, Echo and DocMara');
    root.append(ship);
    placeShip(last);
    ship.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') bounce(); });
    ship.addEventListener('focus', bounce);
    ship.addEventListener('click', bounce);
    if (sign) sign.relayout();
    update(lastP);
  }

  function placeShip(s) {
    // cover the dot and its label; measured from the drawn text so it fits whatever font is loaded
    const label = labels[4].querySelector('text');
    let w = 150;
    try { w = label.getComputedTextLength(); } catch { /* not rendered yet */ }
    const padX = 12, top = s.y - 16, bottom = s.ly + 10;
    const x0 = Math.min(s.x - padX, s.lx - padX), x1 = s.lx + w + padX;
    Object.assign(ship.style, {
      left: `${(x0 / L.W) * 100}%`, top: `${(top / L.H) * 100}%`,
      width: `${((x1 - x0) / L.W) * 100}%`, height: `${((bottom - top) / L.H) * 100}%`,
    });
  }

  let hopping = false;
  function bounce() {
    if (hopping) return;
    hopping = true;
    const runs = hops.map((h, i) => reduced
      // reduced motion: an instant blink of state instead of movement
      ? h.animate([{ opacity: 1 }, { opacity: .45 }, { opacity: 1 }], { duration: 320, delay: i * 60, easing: 'steps(1, end)' })
      : h.animate(hop(mq.matches ? 26 : 16), { duration: 540, delay: i * 70 }));
    Promise.all(runs.map(a => a.finished.catch(() => {}))).then(() => { hopping = false; });
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

  // station one, in viewport coordinates: where the signature's tail lands
  function stationPoint() {
    const r = svg.getBoundingClientRect(), s = L.stations[0];
    return { x: r.left + (s.x / L.W) * r.width, y: r.top + (s.y / L.H) * r.height };
  }

  let sign = null, signTimer = 0, heroMO = null;
  const hero = root.closest('.hero');
  const signSvg = hero && hero.querySelector('.hero__sign');

  const onChange = () => render();
  mq.addEventListener('change', onChange);
  render();

  if (signSvg) {
    sign = mountSign({ hero, svg: signSvg, reduced, station: stationPoint });
    // start once the giant name has begun to stretch in, so the pen signs over a name already on the page
    const go = () => { signTimer = setTimeout(() => sign.play(), 160); };
    if (hero.classList.contains('is-in')) go();
    else {
      heroMO = new MutationObserver(() => { if (hero.classList.contains('is-in')) { heroMO.disconnect(); heroMO = null; go(); } });
      heroMO.observe(hero, { attributes: true, attributeFilter: ['class'] });
    }
  }
  const onFonts = () => { if (ship) placeShip(L.stations[4]); };
  if (document.fonts) document.fonts.ready.then(onFonts);

  return {
    update,
    anchors: () => ({ entry: { x: L.stations[0].x / L.W, y: L.stations[0].y / L.H }, exit: L.exit }),
    destroy() {
      mq.removeEventListener('change', onChange);
      clearTimeout(signTimer);
      heroMO?.disconnect();
      sign?.destroy();
      root.replaceChildren();
    },
  };
}
