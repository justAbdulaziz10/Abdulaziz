// Scene: window — the Rear Window courtyard at night.
// The line drops in, climbs over the parapet and zig-zags down as the fire escape, floor by floor;
// each floor's windows are drawn as it passes. Then the windows light up warmly one by one — four of
// them frame the four favourite films as little title cards — and a rooftop neon sign flickers on:
// 1,657 films logged on Letterboxd.

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const f1 = (n) => Math.round(n * 10) / 10;

const FILMS = [
  { title: ['Rear Window'], year: '1954', icon: 'lens', dir: 'Alfred Hitchcock' },
  { title: ['The Beatles:', 'Get Back'], year: '2021', icon: 'roof', dir: 'Peter Jackson' },
  { title: ['Begin Again'], year: '2013', icon: 'guitar', dir: 'John Carney' },
  { title: ['La La Land'], year: '2016', icon: 'lamp', dir: 'Damien Chazelle' },
];

const LAYOUTS = {
  wide: {
    W: 1200, Ht: 780, plate: [0, 40, 1200, 740], cx: 600, B: 158, ground: 680, rail: 0.46,
    blds: [
      { x0: 0, x1: 300, roof: 290, tone: 'side', floors: [314, 434, 554], bays: [[38, 96], [166, 96]], h: 96 },
      { x0: 300, x1: 900, roof: 170, tone: 'main', floors: [194, 314, 434, 554], bays: [[322, 96], [450, 96], [654, 96], [782, 96]], h: 96, escape: true },
      { x0: 900, x1: 1200, roof: 290, tone: 'side', floors: [314, 434, 554], bays: [[938, 96], [1066, 96]], h: 96 },
    ],
    tower: { x: 150, base: 290, w: 96 },
    sign: { x0: 924, x1: 1184, y0: 118, y1: 262, base: 290, num: 82, label: ['films logged on Letterboxd'], ls: 13 },
    moon: [86, 96, 15],
    stars: [[240, 74], [330, 120], [420, 62], [500, 104], [700, 70], [780, 118], [860, 58], [1030, 76], [1150, 96], [560, 150], [646, 132], [40, 168], [276, 196], [1188, 230]],
    lights: {
      '0-0-1': { film: 0, t: 0.26 },
      '1-0-3': { film: 1, t: 0.34 },
      '1-2-0': { film: 2, t: 0.41 },
      '2-2-0': { film: 3, t: 0.48 },
      '1-1-0': { blind: 0.42, t: 0.22 },
      '1-0-1': { t: 0.3 },
      '0-2-0': { blind: 0.55, t: 0.37 },
      '2-0-1': { t: 0.44 },
      '1-3-2': { t: 0.515 },
      '2-1-0': { blind: 0.3, t: 0.29 },
    },
  },
  tall: {
    W: 380, Ht: 850, plate: [0, 40, 380, 810], cx: 190, B: 52, ground: 744, rail: 0.46,
    blds: [
      { x0: 0, x1: 380, roof: 238, tone: 'main', floors: [262, 380, 498, 616], bays: [[22, 104], [162, 56], [254, 104]], h: 100, escape: true },
    ],
    tower: { x: 76, base: 238, w: 64 },
    sign: { x0: 212, x1: 372, y0: 104, y1: 214, base: 238, num: 50, label: ['films logged', 'on Letterboxd'], ls: 11.5 },
    moon: [34, 84, 11],
    stars: [[120, 60], [160, 112], [26, 140], [300, 70], [250, 90], [354, 82], [140, 170], [210, 70]],
    lights: {
      '0-0-2': { film: 1, t: 0.26 },
      '0-1-0': { film: 0, t: 0.34 },
      '0-2-2': { film: 2, t: 0.41 },
      '0-3-0': { film: 3, t: 0.48 },
      '0-0-0': { blind: 0.45, t: 0.22 },
      '0-1-1': { t: 0.3 },
      '0-3-2': { blind: 0.32, t: 0.37 },
      '0-2-1': { t: 0.44 },
      '0-1-2': { t: 0.515 },
    },
  },
};

let uid = 0;

const HINT_KEY = 'one:window:tapped';

export function mount(root, { reduced = false } = {}) {
  let mode = null;
  let scene = null;
  let lastP = reduced ? 0.6 : 0;
  root.classList.toggle('wn-reduced', reduced);
  const pid = `wnp${++uid}`;
  let films = '1,657'; // instant fallback; replaced by the live count when it arrives
  let dead = false;

  // ---- persistent overlay: hint, scrim, poster dialog
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hint = el('p', 'wn-hint', fine ? 'Click a window' : 'Tap a window');
  hint.setAttribute('aria-hidden', 'true');
  let seen = false;
  try { seen = localStorage.getItem(HINT_KEY) === '1'; } catch { /* storage blocked */ }
  if (seen) hint.hidden = true;
  const scrim = el('div', 'wn-scrim');
  scrim.hidden = true;
  const pop = el('div', 'wn-pop');
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-labelledby', `${pid}-t`);
  pop.innerHTML = `
    <figure class="wn-poster">
      <svg class="wn-art" viewBox="0 0 240 210" aria-hidden="true"></svg>
      <figcaption class="wn-cap">
        <h3 class="wn-pt" id="${pid}-t"></h3>
        <p class="wn-py"></p>
        <p class="wn-pd"><span>Directed by</span> <b></b></p>
      </figcaption>
    </figure>
    <button type="button" class="wn-close" aria-label="Close">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5,5 L15,15 M15,5 L5,15"/></svg>
    </button>`;
  const art = pop.querySelector('.wn-art');
  const closeBtn = pop.querySelector('.wn-close');
  let layer = null; // per-layout buttons
  let open = null; // { film, btn, key }
  let hideTimer = 0, suppress = null;

  const build = (m) => {
    mode = m;
    if (open) closePoster(false, true);
    root.textContent = '';
    scene = buildScene(root, LAYOUTS[m], films);
    layer = buttons(scene);
    root.append(layer, hint, scrim, pop);
    const Lm = LAYOUTS[m];
    root.style.setProperty('--wn-hint-y', `${(((Lm.ground + 28 + Lm.plate[3]) / 2 / Lm.Ht) * 100).toFixed(2)}%`);
    scene.update(lastP);
  };

  function buttons(sc) {
    const box = el('div', 'wn-hits');
    const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
    const place = (b, x, y, w, h) => Object.assign(b.style, { left: pct(x, sc.W), top: pct(y, sc.Ht), width: pct(w, sc.W), height: pct(h, sc.Ht) });
    for (const f of sc.films) {
      const F = FILMS[f.film];
      const b = el('button', 'wn-hit');
      b.type = 'button';
      b.dataset.film = f.film;
      b.dataset.key = f.key;
      b.setAttribute('aria-label', `${F.title.join(' ')} (${F.year}), open poster`);
      b.setAttribute('aria-haspopup', 'dialog');
      place(b, f.x - 3, f.y - 3, f.w + 6, f.h + 6);
      box.append(b);
    }
    const S = sc.sign;
    const nb = el('button', 'wn-hit wn-hit--sign');
    nb.type = 'button';
    nb.dataset.sign = '1';
    nb.setAttribute('aria-label', `${films} films logged on Letterboxd. Flicker the sign`);
    place(nb, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0);
    box.append(nb);
    return box;
  }

  const used = () => {
    if (hint.hidden || hint.classList.contains('is-gone')) return;
    hint.classList.add('is-gone');
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* storage blocked */ }
  };

  function openPoster(filmIdx, btn) {
    used();
    const f = scene.films.find((q) => q.film === filmIdx);
    const F = FILMS[filmIdx];
    clearTimeout(hideTimer);
    pop.dataset.kind = F.icon;
    art.innerHTML = posterArt(F.icon);
    pop.querySelector('.wn-pt').textContent = F.title.join(' ');
    pop.querySelector('.wn-py').textContent = F.year;
    pop.querySelector('.wn-pd b').textContent = F.dir;
    // geometry (event time): the card grows out of its window and settles, tilted a touch, in the scene
    pop.classList.remove('is-open');
    scrim.classList.remove('is-open');
    pop.hidden = false; scrim.hidden = false;
    const r = root.getBoundingClientRect();
    const k = r.width / scene.W;
    const wx = (f.x + f.w / 2) * k, wy = (f.y + f.h / 2) * k;
    const cw = pop.offsetWidth, ch = pop.offsetHeight, m = 12;
    const cx = clamp(wx, cw / 2 + m, r.width - cw / 2 - m);
    // keep the card inside the part of the scene that is actually on screen
    const top = Math.max(0, -r.top), bot = Math.min(r.height, innerHeight - r.top);
    const aim = (wy + (top + bot) / 2) / 2; // between the window and the middle of what's visible
    const cy = bot - top > ch + 2 * m ? clamp(aim, top + ch / 2 + m, bot - ch / 2 - m) : clamp(wy, ch / 2 + m, r.height - ch / 2 - m);
    pop.style.left = `${cx - cw / 2}px`;
    pop.style.top = `${cy - ch / 2}px`;
    pop.style.setProperty('--fx', `${(wx - cx).toFixed(1)}px`);
    pop.style.setProperty('--fy', `${(wy - cy).toFixed(1)}px`);
    pop.style.setProperty('--fs', ((f.w * k) / cw).toFixed(3));
    pop.style.setProperty('--tilt', `${filmIdx % 2 ? 1.6 : -1.6}deg`);
    void pop.offsetWidth; // commit the start state before transitioning
    pop.classList.add('is-open');
    scrim.classList.add('is-open');
    scene.zoom(f.key, true);
    open = { film: filmIdx, btn, key: f.key };
    closeBtn.focus({ preventScroll: true });
  }
  function closePoster(refocus = true, instant = false) {
    if (!open) return;
    const { btn, key } = open;
    open = null;
    pop.classList.remove('is-open');
    scrim.classList.remove('is-open');
    scene.zoom(key, false);
    clearTimeout(hideTimer);
    const done = () => { pop.hidden = true; scrim.hidden = true; };
    if (instant || reduced) done(); else hideTimer = setTimeout(done, 260);
    if (refocus && btn && btn.isConnected) btn.focus({ preventScroll: true });
  }

  // ---- input: one delegated click handler; pointer, touch and keyboard (Enter/Space on buttons) all land here
  function onClick(e) {
    const t = e.target;
    if (t.closest('.wn-close')) return closePoster();
    if (t.closest('.wn-pop')) return;
    const fb = t.closest('[data-film]');
    if (fb) {
      if (suppress === fb && performance.now() - suppress.at < 450) { suppress = null; return; }
      return openPoster(+fb.dataset.film, fb);
    }
    if (t.closest('[data-sign]')) { used(); return scene.flicker(); }
    const win = t.closest('.wn-win');
    if (win && scene.svg.contains(win)) { used(); scene.toggle(win.dataset.win); }
  }
  function onDown(e) { // tap outside closes (anywhere outside the card, scene or page)
    if (!open || pop.contains(e.target)) return;
    const fb = e.target.closest && e.target.closest('[data-film]');
    if (fb && fb === open.btn) { suppress = fb; suppress.at = performance.now(); }
    closePoster(!fb);
  }
  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closePoster(); }
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); } // the card holds one control
  }
  root.addEventListener('click', onClick);
  document.addEventListener('pointerdown', onDown, true);

  // live Letterboxd count (once per mount); the fallback stays if anything fails
  fetch(new URL('../assets/data/live.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const n = data && data.letterboxd && Number(data.letterboxd.films);
      if (dead || !Number.isFinite(n) || n <= 0) return;
      films = new Intl.NumberFormat('en-US').format(Math.round(n));
      scene.setFilms(films);
      const nb = layer && layer.querySelector('[data-sign]');
      if (nb) nb.setAttribute('aria-label', `${films} films logged on Letterboxd. Flicker the sign`);
    })
    .catch(() => { /* offline or missing: keep the fallback */ });
  document.addEventListener('keydown', onKey);

  const pick = (w) => (w > 0 && w < 640 ? 'tall' : 'wide');
  build(pick(root.clientWidth || 1200));
  const ro = new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    const m = pick(w);
    if (m !== mode) build(m);
    else if (open) closePoster(false, true);
    scene.scaleTo(w);
  });
  ro.observe(root);
  return {
    update(p) {
      if (reduced) return;
      lastP = p;
      scene.update(p);
    },
    destroy() {
      dead = true;
      ro.disconnect();
      clearTimeout(hideTimer);
      root.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      root.textContent = '';
    },
  };
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function icon(kind) {
  switch (kind) {
    case 'lens': // Jeff's camera with the long lens
      return `<g class="wn-ink">
        <path d="M-15,-6 h4 l2,-4 h6 l2,4 h2 v13 h-16 Z"/>
        <rect x="1" y="-4.5" width="13" height="9" rx="1.2"/>
        <rect x="13.5" y="-6.5" width="4.5" height="13" rx="1"/>
      </g><circle class="wn-warm" cx="-7" cy="0.5" r="2.6"/>`;
    case 'roof': // the rooftop: parapet, chimney stack, mic stand, amp
      return `<g class="wn-ink">
        <rect x="-19" y="6" width="38" height="3.2" rx="0.6"/>
        <rect x="-17" y="-5" width="7.5" height="11"/>
        <rect x="-16.6" y="-8.4" width="2.6" height="3.6" rx="0.5"/><rect x="-12.6" y="-8.4" width="2.6" height="3.6" rx="0.5"/>
        <rect x="-1.5" y="-12.5" width="3" height="5.4" rx="1.5"/>
        <rect x="8.5" y="-3.5" width="10" height="9.5" rx="1"/>
      </g><path class="wn-stroke" d="M0,-7 V6 M-3.4,6 L0,2.6 L3.4,6"/><circle class="wn-warm" cx="13.5" cy="1.2" r="2.7"/>`;
    case 'guitar':
      return `<g transform="rotate(-38)"><g class="wn-ink">
        <circle cx="0" cy="6.5" r="7.2"/><circle cx="0" cy="-2.6" r="5.4"/>
        <rect x="-1.4" y="-17" width="2.8" height="14" rx="0.6"/>
        <rect x="-2.3" y="-21.5" width="4.6" height="5.4" rx="1"/>
      </g><circle class="wn-warm" cx="0" cy="2.4" r="2.1"/></g>`;
    case 'lamp': // lamp post and stars
      return `<path class="wn-stroke" d="M0,10 V-8 M-4.5,-4 H4.5"/>
        <g class="wn-ink">
          <path d="M-3.4,-14.5 H3.4 L2.4,-8.5 H-2.4 Z"/>
          <rect x="-2.6" y="9" width="5.2" height="2.6" rx="0.6"/>
          ${star(-14, -9, 3.2)}${star(12, -13, 2.4)}${star(15, -3, 1.8)}
        </g>`;
  }
  return '';
}
// Poster art for the pop-out card: same flat language as the window icons, drawn bigger (viewBox 240 x 210).
function posterArt(kind) {
  const grid = (x0, y0, cols, rows, w, h, gx, gy, litAt = -1) => {
    let r = '';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const lit = j * cols + i === litAt;
      r += `<rect class="${lit ? 'wp-lit' : 'wp-faint'}" x="${x0 + i * (w + gx)}" y="${y0 + j * (h + gy)}" width="${w}" height="${h}" rx="1"/>`;
    }
    return r;
  };
  switch (kind) {
    case 'lens': // the facade across the courtyard, and the long lens watching it
      return `${grid(26, 18, 5, 3, 26, 30, 12, 12, 8)}
        <rect class="wp-faint" x="0" y="148" width="240" height="62"/>
        <g class="wp-ink">
          <path d="M36,118 h16 l7,-12 h24 l7,12 h8 v54 h-62 Z"/>
          <rect x="98" y="126" width="74" height="38" rx="4"/>
          <rect x="170" y="117" width="16" height="56" rx="3"/>
          <path d="M186,121 L222,111 V179 L186,169 Z"/>
          <rect x="42" y="110" width="12" height="6" rx="2"/>
        </g>
        <circle class="wp-warm" cx="61" cy="144" r="12"/><circle class="wp-ink" cx="61" cy="144" r="5"/>
        <path class="wp-hi" d="M212,122 L212,138"/>`;
    case 'roof': // a rooftop at lunchtime: parapet, chimney pots, a mic stand, an amp, the wind
      return `<path class="wp-faint" d="M0,150 V122 h22 v-14 h16 v14 h30 v-24 h12 v24 h40 v-10 h26 v10 h44 v-18 h14 v18 h36 V150 Z"/>
        <path class="wp-wind" d="M18,40 C60,30 92,48 140,36 M60,64 C96,56 128,70 176,58 M118,24 C150,18 178,28 214,20"/>
        <g class="wp-ink">
          <rect x="0" y="166" width="240" height="44"/>
          <rect x="0" y="158" width="240" height="10" rx="2"/>
          <rect x="22" y="100" width="34" height="58"/>
          <rect x="24" y="86" width="10" height="16" rx="2"/><rect x="42" y="86" width="10" height="16" rx="2"/>
          <rect x="114" y="74" width="10" height="20" rx="5"/>
          <rect x="162" y="112" width="48" height="46" rx="4"/>
        </g>
        <path class="wp-stroke" d="M119,94 V158 M108,158 L119,146 L130,158"/>
        <rect class="wp-warm" x="169" y="120" width="34" height="24" rx="3"/>
        <path class="wp-grille" d="M169,126 H203 M169,132 H203 M169,138 H203"/>`;
    case 'guitar': // a guitar leaning into the city at night
      return `<path class="wp-faint" d="M0,210 V150 h18 v-26 h20 v26 h12 v-48 h24 v48 h18 v-20 h16 v20 h22 v-62 h26 v62 h14 v-30 h20 v30 h20 v-14 h30 V210 Z"/>
        <circle class="wp-warm-soft" cx="196" cy="42" r="16"/>
        <g transform="translate(112,112) rotate(-38)">
          <g class="wp-ink">
            <circle cx="0" cy="30" r="34"/><circle cx="0" cy="-12" r="25"/>
            <rect x="-6.5" y="-88" width="13" height="70" rx="2"/>
            <rect x="-10.5" y="-110" width="21" height="26" rx="4"/>
          </g>
          <circle class="wp-warm" cx="0" cy="12" r="10"/>
          <rect class="wp-warm" x="-11" y="40" width="22" height="4" rx="1.5"/>
          <path class="wp-strings" d="M-3,-86 V42 M0,-86 V42 M3,-86 V42"/>
        </g>`;
    case 'lamp': // a lamp post on the hill above the city, under a sky full of stars
      return `<g class="wp-star">${star(30, 34, 9)}${star(178, 22, 7)}${star(212, 64, 5)}${star(70, 74, 5)}${star(128, 46, 4)}${star(22, 110, 4)}</g>
        <circle class="wp-glow" cx="150" cy="74" r="34"/><circle class="wp-glow" cx="150" cy="76" r="22"/><circle class="wp-glow wp-glow--core" cx="150" cy="78" r="12"/>
        <path class="wp-ink" d="M0,210 V164 C40,150 80,140 126,142 C170,144 206,154 240,166 V210 Z"/>
        <g class="wp-dots">${Array.from({ length: 14 }, (_, i) => `<circle cx="${10 + i * 17}" cy="${196 + (i % 3) * 4}" r="1.6"/>`).join('')}</g>
        <path class="wp-stroke" d="M150,142 V80 M140,92 H160"/>
        <g class="wp-ink"><path d="M142,62 H158 L155,80 H145 Z"/><rect x="144" y="56" width="12" height="7" rx="2"/></g>
        <path class="wp-warm" d="M145,80 H155 L157,86 H143 Z"/>`;
  }
  return '';
}
function star(x, y, r) {
  const k = r * 0.32;
  return `<path d="M${x},${y - r} L${f1(x + k)},${f1(y - k)} L${x + r},${y} L${f1(x + k)},${f1(y + k)} L${x},${y + r} L${f1(x - k)},${f1(y + k)} L${x - r},${y} L${f1(x - k)},${f1(y - k)} Z"/>`;
}

function buildScene(root, L, count = '1,657') {
  const id = `wn${++uid}`;
  const { W, Ht, cx, B } = L;
  const G = L.ground;
  const [px0, py0, px1, py1] = L.plate;
  const main = L.blds.find((b) => b.escape);
  const land = main.floors.map((y) => y + main.h + 8);

  // ---- the line: roof ladder → fire escape zig-zag → drop ladder → exit
  const FDX = Math.min(110, 2 * B - 30); // a steep flight, like the real thing
  const pts = [[cx, 0], [cx, land[0]]];
  const flights = [];
  let dir = 1;
  for (let k = 0; k < land.length - 1; k++) {
    const xa = cx + dir * (B - 8), xb = xa - dir * FDX;
    pts.push([xa, land[k]], [xb, land[k + 1]]);
    flights.push([xa, land[k], xb, land[k + 1]]);
    dir = -dir;
  }
  pts.push([cx, land[land.length - 1]], [cx, Ht]);
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const cum = [0];
  lens.forEach((l) => cum.push(cum[cum.length - 1] + l / total));
  const LINE_A = 0.02, LINE_B = 0.4;
  const atP = (frac) => LINE_A + frac * (LINE_B - LINE_A);
  // p at which the line arrives on landing k (point index 1 = roof ladder end, then pairs)
  const landP = land.map((_, k) => atP(cum[k === 0 ? 1 : 2 * k + 1]));
  const lineD = 'M' + pts.map((q) => `${q[0]},${q[1]}`).join(' L');

  // ---- fire-escape details (hairlines)
  let esc = '';
  land.forEach((y, k) => {
    const x0 = cx - B, x1 = cx + B, top = y - 30;
    let bal = '';
    for (let x = x0 + 12; x < x1 - 4; x += 12) bal += `M${f1(x)},${top} V${y}`;
    esc += `<g class="wn-escape" data-floor="${k}">
      <rect class="wn-slab" x="${x0 - 4}" y="${y}" width="${2 * B + 8}" height="4"/>
      <path d="M${x0},${y} V${top} H${x1} V${y} ${bal}"/>
      ${k > 0 ? (([xa, ya, xb, yb]) => `<path d="M${f1(xa)},${ya - 28} L${f1(xb)},${yb - 28} M${f1(xa)},${ya - 28} V${ya} M${f1(xb)},${yb - 28} V${yb}"/>`)(flights[k - 1]) : ''}
    </g>`;
  });

  // ---- buildings & windows
  const wins = [];
  let blds = '';
  L.blds.forEach((b, bi) => {
    blds += `<rect class="wn-bld wn-bld--${b.tone}" x="${b.x0}" y="${b.roof}" width="${b.x1 - b.x0}" height="${py1 - b.roof}"/>
      <rect class="wn-cornice" x="${b.x0}" y="${b.roof}" width="${b.x1 - b.x0}" height="8"/>
      <path class="wn-hair wn-hair--edge" d="M${b.x0},${b.roof + 8} H${b.x1}"/>`;
    b.floors.forEach((y, fi) => {
      blds += `<path class="wn-hair wn-course" data-floor="${fi}" data-b="${bi}" d="M${b.x0},${y + b.h + 16} H${b.x1}"/>`;
      b.bays.forEach(([x, w], ci) => {
        wins.push({ key: `${bi}-${fi}-${ci}`, x, y, w, h: b.h, bi, fi, behind: b.escape && x > cx - B - 4 && x + w < cx + B + 4 });
      });
    });
  });

  // floor reveal time: by matching the nearest main-building floor
  const floorP = (y) => {
    let best = 0;
    main.floors.forEach((fy, k) => { if (Math.abs(fy - y) < Math.abs(main.floors[best] - y)) best = k; });
    return landP[best];
  };

  const winSvg = wins
    .map((w, wi) => {
      const spec = L.lights[w.key] || null;
      const ry = f1(w.h * L.rail);
      const film = spec && spec.film !== undefined;
      const lit = spec
        ? `<g class="wn-off"><g class="wn-lit" data-lit="${w.key}" style="opacity:0">
            <rect class="wn-glow" x="-6" y="-6" width="${w.w + 12}" height="${w.h + 12}" rx="6" filter="url(#${id}-glow)"/>
            <rect class="wn-warmfill" width="${w.w}" height="${w.h}" fill="url(#${id}-warm)"/>
            ${spec.blind ? blind(w, spec.blind) : ''}
          </g></g>`
        : '';
      // a light someone switches on when you tap: a lamp, a neighbour, a blind — a little life
      const user = film ? '' : `<g class="wn-user">
            <rect class="wn-glow" x="-6" y="-6" width="${w.w + 12}" height="${w.h + 12}" rx="6" filter="url(#${id}-glow)"/>
            <rect class="wn-warmfill" width="${w.w}" height="${w.h}" fill="url(#${id}-warm)"/>
            ${life(w, wi % 3)}
          </g>`;
      const card = film ? filmCard(FILMS[spec.film], w, ry, w.key) : '';
      return `<g class="wn-win${film ? ' wn-win--film' : ''}" data-win="${w.key}" transform="translate(${w.x},${w.y})"><g class="wn-zoom">
          <rect class="wn-pane" width="${w.w}" height="${w.h}"/>
          <path class="wn-reflect" d="M${f1(w.w * 0.62)},4 L${f1(w.w - 4)},4 L${f1(w.w - 4)},${f1(w.h * 0.3)} Z"/>
          ${lit}${user}${card}
          <path class="wn-sash" d="M0,${ry} H${w.w} ${w.w > 80 ? `M${w.w / 2},0 V${ry}` : ''}"/>
          <rect class="wn-frame" width="${w.w}" height="${w.h}"/>
          <rect class="wn-sill" x="-5" y="${w.h}" width="${w.w + 10}" height="4"/>
          <rect class="wn-lintel" x="-3" y="-7" width="${w.w + 6}" height="4"/>
        </g></g>`;
    })
    .join('');

  function life(w, kind) {
    const W2 = w.w, H2 = w.h;
    if (kind === 0) return blind(w, 0.36);
    if (kind === 1) { // a neighbour at the window, in silhouette
      const x = f1(W2 * (W2 > 80 ? 0.64 : 0.5)), r = f1(Math.min(W2, 90) * 0.085);
      const y = f1(H2 * 0.66), sw = Math.min(W2, 90) * 0.24;
      return `<g class="wn-sil"><circle cx="${x}" cy="${y}" r="${r}"/>
        <path d="M${f1(x - sw)},${H2} C${f1(x - sw)},${f1(y + r * 2.4)} ${f1(x - sw * 0.55)},${f1(y + r * 1.5)} ${x},${f1(y + r * 1.5)} C${f1(x + sw * 0.55)},${f1(y + r * 1.5)} ${f1(x + sw)},${f1(y + r * 2.4)} ${f1(x + sw)},${H2} Z"/></g>`;
    }
    // a table lamp on the sill
    const x = f1(W2 * 0.28), b = H2 - 2;
    return `<g class="wn-sil"><path d="M${f1(x - 9)},${f1(b - 30)} H${f1(x + 9)} L${f1(x + 13)},${f1(b - 17)} H${f1(x - 13)} Z" class="wn-shade"/>
      <rect x="${f1(x - 1.2)}" y="${f1(b - 17)}" width="2.4" height="14"/><rect x="${f1(x - 7)}" y="${f1(b - 3.5)}" width="14" height="3.5" rx="1"/></g>`;
  }

  function blind(w, frac) {
    const bh = f1(w.h * frac);
    let slats = '';
    for (let y = 6; y < bh - 2; y += 6) slats += `M0,${y} H${w.w}`;
    return `<rect class="wn-blind" width="${w.w}" height="${bh}"/><path class="wn-slat" d="${slats}"/>
      <rect class="wn-blind-bar" x="0" y="${bh - 3}" width="${w.w}" height="3"/>
      <path class="wn-cord" d="M${w.w * 0.78},${bh} v${f1(w.h * 0.14)}"/><circle class="wn-blind" cx="${w.w * 0.78}" cy="${f1(bh + w.h * 0.14 + 1.6)}" r="1.8"/>`;
  }

  function filmCard(f, w, ry, key) {
    const mid = w.w / 2;
    const two = f.title.length > 1;
    const ts = w.w >= 100 ? 12.5 : 12;
    const tY = two ? ry + 19 : ry + 23;
    const title = f.title.map((t, i) => `<tspan x="${mid}" y="${f1(tY + i * (ts + 1.5))}">${t}</tspan>`).join('');
    const yY = two ? w.h - 9 : w.h - 13;
    return `<g class="wn-card" data-card="${key}" style="opacity:0">
      <g transform="translate(${mid},${f1(ry / 2 + 1)}) scale(${w.w >= 100 ? 1.05 : 1})">${icon(f.icon)}</g>
      <text class="wn-title" text-anchor="middle" style="font-size:${ts}px">${title}</text>
      <text class="wn-year" x="${mid}" y="${f1(yY)}" text-anchor="middle">${f.year}</text>
    </g>`;
  }

  // ---- water tower
  const T = L.tower, tw = T.w, th = tw * 0.95;
  const tTop = T.base - tw * 0.5 - th;
  const tower = `<g class="wn-tower" aria-hidden="true">
    <path class="wn-tower-legs" d="M${f1(T.x - tw * 0.4)},${T.base} L${f1(T.x - tw * 0.34)},${f1(T.base - tw * 0.5)} M${f1(T.x + tw * 0.4)},${T.base} L${f1(T.x + tw * 0.34)},${f1(T.base - tw * 0.5)} M${f1(T.x - tw * 0.12)},${T.base} V${f1(T.base - tw * 0.5)} M${f1(T.x + tw * 0.12)},${T.base} V${f1(T.base - tw * 0.5)} M${f1(T.x - tw * 0.38)},${f1(T.base - 2)} L${f1(T.x + tw * 0.35)},${f1(T.base - tw * 0.48)} M${f1(T.x + tw * 0.38)},${f1(T.base - 2)} L${f1(T.x - tw * 0.35)},${f1(T.base - tw * 0.48)}"/>
    <rect class="wn-tank" x="${f1(T.x - tw * 0.42)}" y="${f1(tTop)}" width="${f1(tw * 0.84)}" height="${f1(th)}" rx="3"/>
    <path class="wn-tank" d="M${f1(T.x - tw * 0.47)},${f1(tTop + 2)} L${T.x},${f1(tTop - tw * 0.36)} L${f1(T.x + tw * 0.47)},${f1(tTop + 2)} Z"/>
    <path class="wn-hair" d="${[0.22, 0.48, 0.74].map((k) => `M${f1(T.x - tw * 0.42)},${f1(tTop + th * k)} H${f1(T.x + tw * 0.42)}`).join(' ')} M${T.x},${f1(tTop - tw * 0.36)} v-6"/>
    <rect class="wn-tank-shade" x="${f1(T.x + tw * 0.14)}" y="${f1(tTop)}" width="${f1(tw * 0.28)}" height="${f1(th)}" rx="2"/>
  </g>`;

  // ---- rooftop neon sign
  const S = L.sign, sw = S.x1 - S.x0, sh = S.y1 - S.y0, smid = (S.x0 + S.x1) / 2;
  let posts = '';
  const nPosts = sw > 200 ? 4 : 3;
  for (let i = 0; i < nPosts; i++) {
    const x = S.x0 + 14 + (i * (sw - 28)) / (nPosts - 1);
    posts += `M${f1(x)},${S.y1} V${S.base}`;
    if (i < nPosts - 1) {
      const x2 = S.x0 + 14 + ((i + 1) * (sw - 28)) / (nPosts - 1);
      posts += ` M${f1(x)},${S.y1} L${f1(x2)},${S.base} M${f1(x2)},${S.y1} L${f1(x)},${S.base}`;
    }
  }
  const labelLH = S.ls * 1.3;
  const numY = S.y0 + sh * 0.5 + S.num * 0.2 - (S.label.length - 1) * labelLH * 0.4;
  const labY = S.y1 - 18 - (S.label.length - 1) * labelLH;
  const signText = `
    <text class="wn-num" x="${smid}" y="${f1(numY)}" text-anchor="middle" style="font-size:${S.num}px">${count}</text>
    <text class="wn-label" text-anchor="middle" style="font-size:${S.ls}px">${S.label.map((t, i) => `<tspan x="${smid}" y="${f1(labY + i * labelLH)}">${t}</tspan>`).join('')}</text>`;
  const sign = `<g aria-hidden="true">
    <path class="wn-truss" d="${posts}"/>
    <rect class="wn-panel" x="${S.x0}" y="${S.y0}" width="${sw}" height="${sh}" rx="4"/>
    <g class="wn-flick"><g class="wn-neon" style="opacity:0">
      <g filter="url(#${id}-neon)" class="wn-neon-glow">
        <rect class="wn-tube" x="${S.x0 + 7}" y="${S.y0 + 7}" width="${sw - 14}" height="${sh - 14}" rx="3"/>
        ${signText}
      </g>
      <rect class="wn-tube" x="${S.x0 + 7}" y="${S.y0 + 7}" width="${sw - 14}" height="${sh - 14}" rx="3"/>
      ${signText}
    </g></g>
  </g>`;

  // ---- moon, stars, courtyard
  const [mx, my, mr] = L.moon;
  const sky = `<g aria-hidden="true">
    ${L.stars.map(([x, y], i) => `<circle class="wn-star" cx="${x}" cy="${y}" r="${i % 3 ? 1.1 : 1.6}"/>`).join('')}
    <path class="wn-moon" d="M${mx},${my - mr} A${mr},${mr} 0 1 0 ${mx},${my + mr} A${f1(mr * 0.72)},${mr} 0 1 1 ${mx},${my - mr} Z"/>
  </g>`;
  const court = `<g aria-hidden="true">
    <rect class="wn-court" x="${px0}" y="${G}" width="${px1 - px0}" height="${py1 - G}"/>
    <rect class="wn-fence" x="${px0}" y="${G - 6}" width="${px1 - px0}" height="34" fill="url(#${id}-picket)"/>
    <path class="wn-hair wn-hair--edge" d="M${px0},${G + 4} H${px1} M${px0},${G + 20} H${px1}"/>
    <rect class="wn-wall" x="${px0}" y="${G + 28}" width="${px1 - px0}" height="${py1 - G - 28}"/>
  </g>`;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`);
  svg.setAttribute('role', 'img');
  const label = (n) => `A Rear Window–style courtyard at night: an apartment facade with a fire escape, windows lighting up one by one. Four lit windows show favourite films — Rear Window (1954), The Beatles: Get Back (2021), Begin Again (2013), La La Land (2016) — and a rooftop neon sign reads ${n} films logged on Letterboxd.`;
  svg.setAttribute('aria-label', label(count));
  svg.innerHTML = `
  <defs>
    <linearGradient id="${id}-warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="wn-w0"/><stop offset="1" class="wn-w1"/>
    </linearGradient>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="wn-s0"/><stop offset="1" class="wn-s1"/>
    </linearGradient>
    <filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="${id}-neon" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
    <pattern id="${id}-picket" patternUnits="userSpaceOnUse" x="${cx - 5}" y="${G - 6}" width="10" height="34">
      <path class="wn-picket" d="M2,3 L5,0 L8,3 V34 H2 Z"/>
    </pattern>
    <clipPath id="${id}-plate"><rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}"/></clipPath>
  </defs>
  <g clip-path="url(#${id}-plate)">
    <rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}" fill="url(#${id}-sky)"/>
    ${sky}
    ${tower}
    ${sign}
    <g aria-hidden="true">${blds}</g>
    <g aria-hidden="true">${winSvg}</g>
    <g aria-hidden="true">${esc}</g>
    ${court}
  </g>
  <path class="wn-line" pathLength="1" d="${lineD}"/>`;
  root.append(svg);

  // ---- refs
  const line = svg.querySelector('.wn-line');
  const floorEls = [...svg.querySelectorAll('[data-floor]')].map((el) => {
    const fi = +el.dataset.floor;
    const b = el.dataset.b !== undefined ? L.blds[+el.dataset.b] : main;
    return { el, p: floorP(b.floors[fi]) };
  });
  const winEls = [...svg.querySelectorAll('.wn-win')].map((el) => {
    const w = wins.find((q) => q.key === el.dataset.win);
    return { el, p: floorP(w.y) };
  });
  const lits = [...svg.querySelectorAll('[data-lit]')].map((el) => ({ el, t: L.lights[el.dataset.lit].t }));
  const cards = [...svg.querySelectorAll('[data-card]')].map((el) => ({ el, t: L.lights[el.dataset.card].t + 0.03 }));
  const neon = svg.querySelector('.wn-neon');

  let pNow = 0;
  function update(p) {
    pNow = p;
    const lt = seg(p, LINE_A, LINE_B);
    line.style.strokeDashoffset = 1 - lt;
    line.style.opacity = lt > 0.002 ? 1 : 0;
    for (const f of floorEls) f.el.style.opacity = seg(p, f.p - 0.03, f.p + 0.03);
    for (const w of winEls) w.el.style.opacity = 0.25 + 0.75 * seg(p, w.p - 0.04, w.p + 0.03);
    for (const l of lits) l.el.style.opacity = seg(p, l.t, l.t + 0.025);
    for (const c of cards) c.el.style.opacity = seg(p, c.t, c.t + 0.04);
    // neon: a short, deterministic flicker, then steady
    const n = seg(p, 0.37, 0.46);
    const flick = n >= 1 ? 1 : n <= 0 ? 0 : (Math.sin(n * 61) > -0.1 ? 1 : 0.18) * (0.35 + 0.65 * n);
    neon.style.opacity = flick;
  }

  // user units per CSS pixel: keeps the line at exactly --line-w without non-scaling-stroke
  // (non-scaling-stroke breaks pathLength-normalised dashes in Chromium)
  const scaleTo = (px) => { if (px > 0) svg.style.setProperty('--wn-u', (W / px).toFixed(4)); };
  scaleTo(root.clientWidth);

  // ---- interaction surface (geometry for the HTML buttons + light switching)
  const films = wins
    .filter((w) => L.lights[w.key] && L.lights[w.key].film !== undefined)
    .map((w) => ({ key: w.key, film: L.lights[w.key].film, x: w.x, y: w.y, w: w.w, h: w.h }))
    .sort((a, b) => a.film - b.film);
  const winEl = (key) => svg.querySelector(`[data-win="${key}"]`);
  function isLit(key) {
    const el = winEl(key);
    const user = el.querySelector('.wn-user'), off = el.querySelector('.wn-off');
    if (user && user.classList.contains('is-on')) return true;
    const spec = L.lights[key];
    return !!(spec && off && !off.classList.contains('is-off') && seg(pNow, spec.t, spec.t + 0.025) > 0.5);
  }
  function toggle(key) {
    const el = winEl(key);
    if (!el || el.classList.contains('wn-win--film')) return;
    const on = !isLit(key);
    const user = el.querySelector('.wn-user'), off = el.querySelector('.wn-off');
    if (user) user.classList.toggle('is-on', on);
    if (off) off.classList.toggle('is-off', !on);
  }
  const zoom = (key, on) => { const el = winEl(key); if (el) el.querySelector('.wn-zoom').classList.toggle('is-zoom', on); };
  const flick = svg.querySelector('.wn-flick');
  function flicker() {
    flick.classList.remove('is-flicker');
    void flick.getBoundingClientRect(); // restart the keyframes (event time, not update)
    flick.classList.add('is-flicker');
  }
  const onFlickEnd = () => flick.classList.remove('is-flicker');
  flick.addEventListener('animationend', onFlickEnd);

  function setFilms(t) {
    for (const n of svg.querySelectorAll('.wn-num')) n.textContent = t;
    svg.setAttribute('aria-label', label(t));
  }

  return { update, scaleTo, svg, films, sign: L.sign, W, Ht, toggle, zoom, flicker, setFilms };
}
