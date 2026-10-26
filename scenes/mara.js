// Mara — a calm heartbeat trace that curls into a recovery ring around the real app.
const NS = 'http://www.w3.org/2000/svg';
const IMG = new URL('../assets/img/', import.meta.url).href;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Two compositions. Units are viewBox units; the phone is placed with the same numbers as %.
const LAYOUTS = {
  wide: { w: 1200, h: 800, cx: 600, ecg: [12, 128], amp: 0.95, curlTo: 172, r: 296, phoneW: 250, ringW: 12 },
  narrow: { w: 390, h: 760, cx: 195, ecg: [10, 108], amp: 0.72, curlTo: 0, r: 180, phoneW: 236, ringW: 8 },
};
const PHONE_RATIO = 2.129; // frame height / width for a 773x1680 screen inside a 1.9% bezel

function geometry(L) {
  const phoneH = L.phoneW * PHONE_RATIO;
  let cy, phoneTop;
  if (L.curlTo) { cy = L.curlTo + L.r; phoneTop = cy - phoneH / 2; }
  else { phoneTop = L.ecg[1] + 16; cy = phoneTop + phoneH / 2; }
  return { phoneH, cy, phoneTop };
}

// Vertical ECG: time runs down the page, voltage swings to the right.
function ecgPath(L, cy) {
  const { cx } = L, [y0, y1] = L.ecg, a = L.amp;
  const span = y1 - y0;
  const u = (t) => y0 + span * t;
  const pts = [[cx, 0], [cx, u(0)]];
  const bump = (t0, t1, h, n = 10) => {
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      pts.push([cx + Math.sin(Math.PI * k) * h * a, u(lerp(t0, t1, k))]);
    }
  };
  pts.push([cx, u(0.1)]);
  bump(0.1, 0.24, 8);                  // P
  pts.push([cx, u(0.31)]);
  pts.push([cx - 5 * a, u(0.345)]);    // Q
  pts.push([cx + 58 * a, u(0.4)]);     // R
  pts.push([cx - 19 * a, u(0.455)]);   // S
  pts.push([cx, u(0.5)]);
  pts.push([cx, u(0.58)]);
  bump(0.58, 0.86, 15, 14);            // T
  pts.push([cx, u(1)]);
  const r = L.r, top = cy - r, bot = cy + r;
  let d = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  // curl: from heading down to heading right at the top of the ring (bulges left)
  const k = Math.min(top - y1, 46);
  d += ` C${cx} ${(y1 + k * 0.7).toFixed(1)} ${(cx - k * 1.15).toFixed(1)} ${top} ${cx} ${top}`;
  // one and a half turns, clockwise, ending at the bottom heading left
  d += ` A${r} ${r} 0 0 1 ${cx} ${bot} A${r} ${r} 0 0 1 ${cx} ${top} A${r} ${r} 0 0 1 ${cx} ${bot}`;
  // mirrored curl out, exiting at bottom centre
  const k2 = Math.min(L.h - bot, 60);
  d += ` C${(cx - k2 * 1.15).toFixed(1)} ${bot} ${cx} ${(L.h - k2 * 0.7).toFixed(1)} ${cx} ${L.h}`;
  return d;
}

// Readout strip: a continuous ECG with one spike every BEAT_W units, newest beat at the cursor (x=96).
const BEAT_W = 36;
function stripPath(n) {
  const xs = [];
  for (let k = n + 1; k >= 0; k--) xs.push(132 - k * BEAT_W);
  const f = (v) => v.toFixed(1);
  let d = `M${f(xs[0] - BEAT_W)} 14`;
  for (const x of xs) {
    d += ` L${f(x - 24)} 14 Q${f(x - 21)} 10.5 ${f(x - 18)} 14 L${f(x - 4)} 14 L${f(x - 2)} 16 L${f(x)} 3 L${f(x + 2)} 20 L${f(x + 4)} 14 L${f(x + 9)} 14 Q${f(x + 13)} 8.5 ${f(x + 17)} 14`;
  }
  return d + ` L${f(xs[xs.length - 1] + BEAT_W)} 14`;
}

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
}

export function mount(root, { reduced = false } = {}) {
  root.innerHTML = '';
  const stage = document.createElement('div');
  stage.className = 'mara__stage';
  root.append(stage);

  const glow = document.createElement('div');
  glow.className = 'mara__glow';
  glow.setAttribute('aria-hidden', 'true');

  const svg = el('svg', { class: 'mara__art', role: 'img', 'aria-label': 'A heartbeat trace that curls into a recovery ring around a phone showing the Mara app' });
  const defs = el('defs', {}, svg);
  const grad = el('linearGradient', { id: 'mara-line-grad', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
  const stops = [['0', 'mara__stop-ink'], ['0.16', 'mara__stop-c'], ['0.9', 'mara__stop-c'], ['1', 'mara__stop-ink']]
    .map(([o, c]) => el('stop', { offset: o, class: c }, grad));
  const track = el('circle', { class: 'mara__track', 'aria-hidden': 'true' }, svg);
  const line = el('path', { class: 'mara__line', pathLength: 1, stroke: 'url(#mara-line-grad)', 'aria-hidden': 'true' }, svg);

  const device = document.createElement('div');
  device.className = 'mara__device';
  device.innerHTML = `
    <div class="mara__shadow" aria-hidden="true"></div>
    <div class="mara__phone">
      ${Array.from({ length: 7 }, (_, i) => `<div class="mara__edge" style="--i:${i + 1}" aria-hidden="true"></div>`).join('')}
      <div class="mara__frame">
        <div class="mara__screen">
          <img class="mara__img mara__img--home" alt="Mara home screen: body map with recovery score and health cards"
            src="${IMG}screen-mara-home.webp" srcset="${IMG}screen-mara-home-m.webp 552w, ${IMG}screen-mara-home.webp 773w"
            sizes="(max-width: 640px) 52vw, 150px" width="773" height="1680" decoding="async">
          <img class="mara__img mara__img--chat" alt="Mara chat screen: How can I help?"
            src="${IMG}screen-mara-chat.webp" srcset="${IMG}screen-mara-chat-m.webp 552w, ${IMG}screen-mara-chat.webp 773w"
            sizes="(max-width: 640px) 52vw, 150px" width="773" height="1680" decoding="async" loading="lazy">
          <div class="mara__island" aria-hidden="true"></div>
          <div class="mara__glass" aria-hidden="true"></div>
          <button class="mara__tap" type="button" aria-label="Show the Mara chat screen"></button>
        </div>
      </div>
      <div class="mara__btn mara__btn--a" aria-hidden="true"></div>
      <div class="mara__btn mara__btn--b" aria-hidden="true"></div>
      <div class="mara__btn mara__btn--c" aria-hidden="true"></div>
    </div>`;
  const ring = document.createElement('div');
  ring.className = 'mara__ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.innerHTML = '<div class="mara__sweep"><i class="mara__head"></i></div>';
  const sweep = ring.firstChild;
  const head = sweep.firstChild;
  const pulse = document.createElement('div');
  pulse.className = 'mara__pulse';
  pulse.setAttribute('aria-hidden', 'true');

  const hud = document.createElement('div');
  hud.className = 'mara__hud';
  hud.innerHTML = `
    <div class="mara__hr">
      <svg class="mara__strip" viewBox="0 0 100 24" aria-hidden="true">
        <g class="mara__strip-run"><path d="${stripPath(4)}"/></g>
        <circle class="mara__strip-dot" cx="96" cy="14" r="2.2"/>
      </svg>
      <span class="mara__bpm"><span class="mara__bpm-n">64</span> bpm</span>
      <span class="mara__hr-label">Heart rate: your scroll speed</span>
    </div>
    <p class="mara__hint">${matchMedia('(hover: hover) and (pointer: fine)').matches ? 'Click' : 'Tap'} the phone</p>`;
  stage.append(glow, pulse, ring, svg, device, hud);
  const run = hud.querySelector('.mara__strip-run');
  const dot = hud.querySelector('.mara__strip-dot');
  const bpmN = hud.querySelector('.mara__bpm-n');
  const hint = hud.querySelector('.mara__hint');
  const tap = device.querySelector('.mara__tap');

  const phone = device.querySelector('.mara__phone');
  const shadow = device.querySelector('.mara__shadow');
  const chat = device.querySelector('.mara__img--chat');
  const glass = device.querySelector('.mara__glass');

  let layout = null;
  function build(name) {
    if (name === layout) return;
    layout = name;
    const L = LAYOUTS[name];
    const G = geometry(L);
    root.dataset.layout = name;
    svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
    stage.style.aspectRatio = `${L.w} / ${L.h}`;
    grad.setAttribute('y2', L.h);
    for (const c of [track]) { c.setAttribute('cx', L.cx); c.setAttribute('cy', G.cy); c.setAttribute('r', L.r); }
    line.setAttribute('d', ecgPath(L, G.cy));
    const pct = (v, of) => (v / of * 100).toFixed(3) + '%';
    Object.assign(device.style, {
      left: pct(L.cx - L.phoneW / 2, L.w), width: pct(L.phoneW, L.w),
      top: pct(G.phoneTop, L.h), height: pct(G.phoneH, L.h),
    });
    const bw = L.ringW;
    Object.assign(ring.style, {
      left: pct(L.cx - L.r - bw / 2, L.w), width: pct(L.r * 2 + bw, L.w),
      top: pct(G.cy - L.r - bw / 2, L.h), height: pct(L.r * 2 + bw, L.h),
    });
    Object.assign(pulse.style, {
      left: pct(L.cx - L.r, L.w), width: pct(L.r * 2, L.w),
      top: pct(G.cy - L.r, L.h), height: pct(L.r * 2, L.h),
    });
    if (name === 'wide') Object.assign(hud.style, { left: pct(L.cx + 78, L.w), top: pct(L.ecg[0] + 8, L.h), bottom: '' });
    else Object.assign(hud.style, { left: '50%', top: pct(G.phoneTop + G.phoneH + 20, L.h), bottom: '' });
    Object.assign(glow.style, {
      left: pct(L.cx - L.r * 1.25, L.w), width: pct(L.r * 2.5, L.w),
      top: pct(G.cy - L.r * 1.25, L.h), height: pct(L.r * 2.5, L.h),
    });
  }

  const ro = new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    build(w < 640 ? 'narrow' : 'wide');
    const L = LAYOUTS[layout];
    root.style.setProperty('--mara-bw', (L.ringW * w / L.w).toFixed(2) + 'px');
    rootH = entries[0].contentRect.height;
  });
  ro.observe(root);
  build((root.clientWidth || 1200) < 640 ? 'narrow' : 'wide');

  // state
  let P = 0.6;
  let rootH = root.clientHeight || 800;
  let manual = null;          // null = scroll decides; 'home' | 'chat' = tapped
  let scrollChat = false;     // which screen the scroll alone would show
  let pulseAmt = 0;           // 0..1, decays after each beat
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = 0;

  function render() {
    const p = P;
    const draw = easeOut(clamp((p - 0.06) / 0.46));
    line.style.strokeDashoffset = (1 - draw).toFixed(4);
    const ringIn = smooth(0.12, 0.42, p);
    track.style.opacity = ringIn.toFixed(3);
    ring.style.opacity = smooth(0.2, 0.42, p).toFixed(3);
    sweep.style.transform = `rotate(${lerp(-330, -20, smooth(0.15, 0.95, p)).toFixed(2)}deg)`;
    glow.style.opacity = (0.25 + 0.75 * smooth(0.1, 0.5, p)).toFixed(3);

    const e = easeOut(clamp((p - 0.1) / 0.32));
    const turn = smooth(0.12, 1, p);
    const ry = lerp(-30, 12, turn) + tilt.x * 9;
    const rx = lerp(9, -3, turn) - tilt.y * 6;
    const lift = (1 - e) * 70;
    phone.style.transform = `translate3d(0, ${lift.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${(0.92 + 0.08 * e).toFixed(4)})`;
    device.style.opacity = e.toFixed(3);
    shadow.style.transform = `translate3d(${(-ry * 0.9).toFixed(1)}%, ${(lift * 0.4).toFixed(1)}px, 0) scaleX(${(1 - Math.abs(ry) / 140).toFixed(3)})`;
    glass.style.transform = `translate3d(${(-ry * 2.2).toFixed(1)}%, 0, 0)`;
    const sc = smooth(0.74, 0.8, p);
    const nowChat = sc > 0.5;
    if (nowChat !== scrollChat) { scrollChat = nowChat; manual = null; root.classList.remove('is-manual'); }
    const showChat = manual ? manual === 'chat' : nowChat;
    chat.style.opacity = (manual ? (showChat ? 1 : 0) : sc).toFixed(3);
    tap.setAttribute('aria-label', showChat ? 'Show the Mara home screen' : 'Show the Mara chat screen');
    hud.style.opacity = smooth(0.28, 0.44, p).toFixed(3);
  }

  function onTap() {
    const showingChat = manual ? manual === 'chat' : scrollChat;
    manual = showingChat ? 'home' : 'chat';
    root.classList.add('is-manual');
    hint.classList.add('is-used');
    render();
  }
  tap.addEventListener('click', onTap);

  function loop() {
    tilt.x += (tilt.tx - tilt.x) * 0.12;
    tilt.y += (tilt.ty - tilt.y) * 0.12;
    render();
    if (Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 0.002) raf = requestAnimationFrame(loop);
    else raf = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  const fine = !reduced && matchMedia('(hover: hover) and (pointer: fine)').matches;
  let rect = null;
  const onEnter = () => { rect = root.getBoundingClientRect(); };
  const onMove = (ev) => {
    if (!rect) rect = root.getBoundingClientRect();
    tilt.tx = clamp(((ev.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    tilt.ty = clamp(((ev.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    kick();
  };
  const onLeave = () => { tilt.tx = 0; tilt.ty = 0; rect = null; kick(); };
  if (fine) {
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    addEventListener('scroll', onEnter, { passive: true });
  }

  // ---- heart rate: follows how fast you scroll ----
  const REST = 64, MAX = 170;
  let bpm = REST, shownBpm = REST, phase = 0, lastT = 0, lastY = scrollY, pDelta = 0, hrRaf = 0, visible = false;
  const writePulse = () => {
    const k = pulseAmt;
    pulse.style.transform = `scale(${(1 + 0.085 * (1 - k)).toFixed(4)})`;
    pulse.style.opacity = (0.55 * k).toFixed(3);
    head.style.transform = `scale(${(1 + 0.7 * k).toFixed(3)})`;
    glow.style.transform = `scale(${(1 + 0.035 * k).toFixed(4)})`;
    dot.style.transform = `scale(${(1 + 0.8 * k).toFixed(3)})`;
  };
  function heart(t) {
    hrRaf = 0;
    if (!visible || document.hidden) { lastT = 0; return; }
    const dt = lastT ? Math.min(64, t - lastT) : 16;
    lastT = t;
    const y = scrollY;
    const vScroll = Math.abs(y - lastY) / dt * 1000;           // px/s
    const vP = pDelta * (innerHeight + rootH * 1.6) / dt * 1000; // px/s, from update(p)
    lastY = y; pDelta = 0;
    const v = Math.max(vScroll, vP);
    const target = REST + (MAX - REST) * Math.pow(clamp((v - 60) / 2600), 0.75);
    const tau = target > bpm ? 140 : 650;
    bpm += (target - bpm) * (1 - Math.exp(-dt / tau));
    const n = Math.round(bpm);
    if (n !== shownBpm) { shownBpm = n; bpmN.textContent = n; }
    if (!reduced) {
      phase += (bpm / 60) * (dt / 1000);
      if (phase >= 1) { phase %= 1; pulseAmt = 1; }
      pulseAmt *= Math.exp(-dt / 220);
      run.style.transform = `translateX(${(-phase * BEAT_W).toFixed(2)}px)`;
      writePulse();
    }
    hrRaf = requestAnimationFrame(heart);
  }
  const startHeart = () => { if (!hrRaf && visible && !document.hidden) { lastY = scrollY; hrRaf = requestAnimationFrame(heart); } };
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) startHeart(); }, { rootMargin: '10% 0px' });
  io.observe(root);
  const onVis = () => startHeart();
  document.addEventListener('visibilitychange', onVis);

  if (reduced) { root.classList.add('is-reduced'); P = 0.6; render(); }

  let lastP = null;
  return {
    update(p) {
      const np = clamp(+p || 0);
      if (lastP !== null) pDelta += Math.abs(np - lastP);
      lastP = np;
      if (reduced) return;
      P = np;
      render();
    },
    destroy() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(hrRaf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      tap.removeEventListener('click', onTap);
      if (fine) {
        root.removeEventListener('pointerenter', onEnter);
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', onLeave);
        removeEventListener('scroll', onEnter);
      }
      root.innerHTML = '';
    },
  };
}
