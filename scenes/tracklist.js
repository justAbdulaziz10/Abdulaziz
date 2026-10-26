// Scene: tracklist — the line drops onto a record, runs the lead-in groove, spirals through the five bands
// of the side to the run-out, and leaves underneath. The record is drawn, not reproduced: black vinyl, five
// track bands, a plain label that takes the colour of the hovered track's world and prints its name.
// Hovering or focusing a track in the sleeve's tracklist spins the record up to speed (33 1/3) and lights
// that track's band; leaving lets it spin down. Scroll scrubs the label round slowly.
import { activateAudio, getAudioContext, getAudioOutput, isOn, onChange, setOn } from '../js/sound.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a));
const f1 = (n) => Math.round(n * 10) / 10;

// geometry (viewBox units)
const W = 600, R = 270, CX = 300, TOP = 58, CY = TOP + R, H = CY + R + 58;
const RO = 0.95 * R, RI = 0.42 * R, BW = (RO - RI) / 5; // playing area, five track bands
const RL = 0.335 * R; // label
const SPIN = 200; // deg/s, 33 1/3 rpm
const TRACK_MS = 4000;
const DROP_MS = 360;
const LIFT_MS = 480;

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
};

function spiralPath() {
  // lead-in from the rim, seven turns of groove (Archimedean), a wide run-out, then the locked groove
  const r0 = 0.935 * R, r1 = 0.43 * R, r2 = 0.365 * R, turns = 7, th0 = 0.24;
  const pt = (r, th) => [CX + r * Math.sin(th), CY - r * Math.cos(th)];
  const [ex, ey] = pt(r0, th0);
  const dx = Math.cos(th0), dy = Math.sin(th0);
  let d = `M${CX} ${CY - R}C${CX} ${CY - R + 16} ${f1(ex - 34 * dx)} ${f1(ey - 34 * dy)} ${f1(ex)} ${f1(ey)}`;
  const n = turns * 120;
  for (let i = 1; i <= n; i++) {
    const t = i / n, th = th0 + t * turns * 2 * Math.PI;
    const [x, y] = pt(r0 + (r1 - r0) * t, th);
    d += `L${f1(x)} ${f1(y)}`;
  }
  const thA = th0 + turns * 2 * Math.PI, m = 90;
  for (let i = 1; i <= m; i++) { // run-out: 0.75 turn, wide pitch
    const t = i / m, e = t * t * (3 - 2 * t);
    const [x, y] = pt(r1 + (r2 - r1) * e, thA + t * 1.5 * Math.PI);
    d += `L${f1(x)} ${f1(y)}`;
  }
  const thB = thA + 1.5 * Math.PI;
  for (let i = 1; i <= 120; i++) { // locked groove
    const [x, y] = pt(r2, thB + (i / 120) * 2 * Math.PI);
    d += `L${f1(x)} ${f1(y)}`;
  }
  return d;
}

function wedge(a, spread, r0, r1) {
  const p = (r, th) => `${f1(CX + r * Math.sin(th))} ${f1(CY - r * Math.cos(th))}`;
  const a0 = a - spread, a1 = a + spread;
  return `M${p(r0, a0)}L${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
}

let uid = 0;

export function mount(root, { reduced = false } = {}) {
  const id = `tl${++uid}`;
  const section = root.closest('section');
  const scope = section || document;
  const tracks = [...scope.querySelectorAll('[data-track]')];
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let inView = false;

  // ---------- build ----------
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'tl-svg',
    'aria-label': 'A drawn vinyl record with five track bands and a centre label. The line runs into its groove, spirals to the centre and leaves underneath.' });
  const defs = el('defs', {}, svg);
  const blur = el('filter', { id: `${id}-blur`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  el('feGaussianBlur', { stdDeviation: '9' }, blur);
  const soft = el('filter', { id: `${id}-soft`, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  el('feGaussianBlur', { stdDeviation: '14' }, soft);

  const deco = el('g', { 'aria-hidden': 'true' }, svg);
  el('ellipse', { class: 'tl-shadow', cx: CX + 10, cy: CY + 22, rx: R * 0.98, ry: R * 0.98, filter: `url(#${id}-soft)` }, deco);
  const rotor = el('g', { class: 'tl-rotor' }, deco);
  el('circle', { class: 'tl-disc', cx: CX, cy: CY, r: R }, rotor);
  el('circle', { class: 'tl-rim', cx: CX, cy: CY, r: R - 1.5 }, rotor);

  // fine grooves: a dense field inside each band, finer rings in the lead-in and run-out
  const grooves = el('g', { class: 'tl-grooves' }, rotor);
  for (let r = RI + 1.2; r < RO; r += 2.6) el('circle', { cx: CX, cy: CY, r: f1(r) }, grooves);
  const gaps = el('g', { class: 'tl-gaps' }, rotor);
  for (let k = 1; k < 5; k++) el('circle', { cx: CX, cy: CY, r: f1(RO - k * BW), 'stroke-width': 3.2 }, gaps);
  el('circle', { cx: CX, cy: CY, r: f1(RO + 3), 'stroke-width': 1.2 }, gaps);
  el('circle', { cx: CX, cy: CY, r: f1(RI - 2), 'stroke-width': 1.2 }, gaps);

  const band = el('circle', { class: 'tl-band', cx: CX, cy: CY, r: f1(RO - BW / 2), 'stroke-width': f1(BW - 4) }, rotor);

  // light on the vinyl: a static bow-tie of sheen (it stays put while the record turns, as it does in life)
  const sheen = el('g', { class: 'tl-sheen', filter: `url(#${id}-blur)` }, rotor);
  for (const a of [-0.78, 2.36]) el('path', { d: wedge(a, 0.2, RL + 10, R - 6) }, sheen);
  for (const a of [-0.78, 2.36]) el('path', { class: 'tl-sheen-core', d: wedge(a, 0.06, RL + 14, R - 10) }, sheen);

  // the label: base + print rotate; the name is set upright on top
  const spin = el('g', { class: 'tl-spin' }, rotor);
  el('circle', { class: 'tl-label', cx: CX, cy: CY, r: RL }, spin);
  el('circle', { class: 'tl-label-ring', cx: CX, cy: CY, r: f1(RL - 9) }, spin);
  // a printed arc on the label ring: the only thing that shows the label turning; it never crosses the name
  const ra = RL - 9, a0 = 2.3, a1 = 3.4;
  el('path', { class: 'tl-label-line', d: `M${f1(CX + ra * Math.sin(a0))} ${f1(CY - ra * Math.cos(a0))}A${ra} ${ra} 0 0 1 ${f1(CX + ra * Math.sin(a1))} ${f1(CY - ra * Math.cos(a1))}` }, spin);
  el('circle', { class: 'tl-label-dot', cx: f1(CX + ra * Math.sin(a1)), cy: f1(CY - ra * Math.cos(a1)), r: 3.4 }, spin);
  const side = el('text', { class: 'tl-side', x: CX, y: f1(CY - RL + 27), 'text-anchor': 'middle' }, spin);
  side.textContent = '';

  // the line: in on top, the groove in light on the black, out underneath
  const LS = 'stroke-dasharray:1 2;stroke-dashoffset:1';
  const lineIn = el('path', { class: 'tl-line', d: `M${CX} 0V${CY - R}`, pathLength: 1, style: LS }, svg);
  const groove = el('path', { class: 'tl-groove-line', d: spiralPath(), pathLength: 1, style: LS }, svg);
  const lineOut = el('path', { class: 'tl-line', d: `M${CX} ${CY + R}V${H}`, pathLength: 1, style: LS }, svg);
  svg.insertBefore(lineOut, deco); // emerges from under the record
  [lineIn, groove, lineOut].forEach((n) => n.setAttribute('aria-hidden', 'true'));

  const type = el('g', { class: 'tl-type', 'aria-hidden': 'true' }, svg);
  const name1 = el('text', { class: 'tl-name', x: CX, 'text-anchor': 'middle' }, type);
  const name2 = el('text', { class: 'tl-name', x: CX, 'text-anchor': 'middle' }, type);
  const meta = el('text', { class: 'tl-meta', x: CX, y: f1(CY + 0.2 * R), 'text-anchor': 'middle' }, type);
  el('circle', { class: 'tl-hole', cx: CX, cy: CY, r: 5.5 }, svg).setAttribute('aria-hidden', 'true');

  const arm = el('g', { class: 'tl-tonearm', 'aria-hidden': 'true' }, svg);
  const armShaft = el('path', { class: 'tl-tonearm__shaft' }, arm);
  const armHighlight = el('path', { class: 'tl-tonearm__highlight' }, arm);
  const armStylus = el('path', { class: 'tl-tonearm__stylus' }, arm);
  const armPivot = el('circle', { class: 'tl-tonearm__pivot', cx: 560, cy: TOP + 20, r: 12 }, arm);
  const armNeedle = el('circle', { class: 'tl-tonearm__needle', r: 3.5 }, arm);

  root.append(svg);

  const controls = document.createElement('div');
  controls.className = 'tl-controls';
  const playButton = document.createElement('button');
  playButton.className = 'tl-control tl-control--play';
  playButton.type = 'button';
  playButton.setAttribute('aria-label', 'Play side A');
  playButton.textContent = 'Play';
  const soundButton = document.createElement('button');
  soundButton.className = 'tl-control tl-control--sound';
  soundButton.type = 'button';
  controls.append(playButton, soundButton);
  root.append(controls);

  let hint = null;
  if (canHover && tracks.length) {
    hint = document.createElement('p');
    hint.className = 'tl-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Hover a track';
    root.append(hint);
  }

  // ---------- label type ----------
  const MAXW = 1.62 * RL;
  const fit = (t, fs) => { t.style.fontSize = `${fs}px`; return t.getComputedTextLength(); };
  function setName(text, metaText, small) {
    const base = (small ? 0.058 : 0.074) * R;
    name1.textContent = text; name2.textContent = '';
    let w = fit(name1, base);
    let two = false;
    if (w > MAXW && text.includes(' ')) {
      // split near the middle on a space
      const words = text.split(' ');
      let best = 1, bestD = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length;
        if (Math.abs(a - b) < bestD) { bestD = Math.abs(a - b); best = i; }
      }
      name1.textContent = words.slice(0, best).join(' ');
      name2.textContent = words.slice(best).join(' ');
      two = true;
      w = Math.max(fit(name1, base), fit(name2, base));
    }
    const fs = w > MAXW ? base * (MAXW / w) : base;
    name1.style.fontSize = name2.style.fontSize = `${f1(fs)}px`;
    const lh = fs * 1.08;
    const y = CY - 0.1 * R;
    if (two) { name1.setAttribute('y', f1(y - lh)); name2.setAttribute('y', f1(y)); }
    else name1.setAttribute('y', f1(y));
    meta.textContent = metaText || '';
  }

  const DEFAULT = { name: 'Abdulaziz Alkhlaiwe', meta: '', tone: '', side: '' };
  function show(info) {
    root.dataset.tone = info.tone || '';
    side.textContent = info.side || '';
    setName(info.name, info.meta, info === DEFAULT);
  }

  // ---------- arm, playback and sound ----------
  let scrollRot = 0, spinRot = 0, vel = 0, target = 0, raf = 0, lastT = 0, ticking = false;
  let previewed = null, leaveTimer = 0, used = false, playback = null, crackle = null;
  const sideATracks = tracks.filter(a => a.dataset.track?.startsWith('A'));
  const applyRot = () => rotor.setAttribute('transform', `rotate(${f1((scrollRot + spinRot) % 360)} ${CX} ${CY})`);
  const radiusFor = i => RO - (i + 0.5) * BW;

  // beside the sleeve the record's right edge is tucked under it, so the arm (and the controls) sit on the left
  const tucked = matchMedia('(min-width: 901px)');
  let armArgs = [RO + 12, 1];
  function drawArm(radius, lift = 0) {
    armArgs = [radius, lift];
    const side = tucked.matches ? -1 : 1;
    const px = CX + side * 260, py = TOP + 20, reach = 245;
    armPivot.setAttribute('cx', px);
    const dx = px - CX, dy = py - CY, distance = Math.hypot(dx, dy);
    const cos = clamp((distance * distance + radius * radius - reach * reach) / (2 * distance * radius), -1, 1);
    const angle = Math.atan2(dy, dx) + side * Math.acos(cos);
    const x = CX + radius * Math.cos(angle), y = CY + radius * Math.sin(angle) - lift * 7;
    const elbowX = px + (x - px) * 0.72, elbowY = py + (y - py) * 0.72;
    const d = `M${px} ${py}L${elbowX} ${elbowY}L${x} ${y}`;
    armShaft.setAttribute('d', d);
    armHighlight.setAttribute('d', `M${px} ${py}L${elbowX} ${elbowY}L${x} ${y}`);
    armStylus.setAttribute('d', `M${x} ${y}L${x + side * 4} ${y + 8}`);
    armNeedle.setAttribute('cx', f1(x + side * 4));
    armNeedle.setAttribute('cy', f1(y + 8));
    armNeedle.style.opacity = String(1 - lift * 0.85);
  }

  function syncPlayButton() {
    const active = Boolean(playback);
    playButton.textContent = active ? 'Pause' : 'Play';
    playButton.setAttribute('aria-label', active ? 'Pause' : 'Play side A');
  }

  function syncSoundButton(on) {
    // a toggle: the name stays "Sound", the pressed state carries on/off
    soundButton.textContent = 'Sound';
    soundButton.setAttribute('aria-pressed', String(on));
  }

  function refreshSelection() {
    const playingTrack = playback && playback.index >= 0 ? sideATracks[playback.index] : null;
    const selected = previewed || playingTrack;
    tracks.forEach(a => {
      const active = a === selected;
      a.classList.toggle('is-current', active);
      if (active) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    root.classList.toggle('is-playback', Boolean(playback));
    if (selected) {
      const list = [...selected.closest('ol').querySelectorAll('[data-track]')];
      const i = Math.max(0, list.indexOf(selected));
      const no = selected.dataset.track || '';
      const year = selected.querySelector('.track__year')?.textContent.trim();
      show({
        name: selected.querySelector('.track__name')?.textContent.trim() || selected.textContent.trim(),
        meta: [no, year].filter(Boolean).join('  ·  '),
        tone: selected.dataset.tone || (no.startsWith('B') ? 'b' : ''),
        side: no.charAt(0),
      });
      band.setAttribute('r', f1(radiusFor(i)));
      root.classList.add('is-playing');
      target = reduced ? 0 : SPIN;
    } else {
      show(DEFAULT);
      root.classList.remove('is-playing');
      target = reduced || !playback ? 0 : SPIN;
    }
    syncPlayButton();
  }

  function makeNoise(ctx, duration, sparse = false) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = sparse
      ? (Math.random() < 0.00012 ? (Math.random() * 2 - 1) * 0.8 : 0)
      : Math.random() * 2 - 1;
    return buffer;
  }

  function note(ctx, out, frequency, when, duration, level = 0.018, type = 'sine', endFrequency = frequency) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    if (endFrequency !== frequency) osc.frequency.linearRampToValueAtTime(endFrequency, when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + Math.min(0.025, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(out);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function noiseHit(ctx, out, when, duration, frequency, level, type = 'bandpass') {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = makeNoise(ctx, duration + 0.04);
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, when);
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(when);
    source.stop(when + duration + 0.025);
  }

  function playMotif(i) {
    if (!isOn()) return;
    const ctx = getAudioContext(), out = getAudioOutput();
    if (!ctx || !out) return;
    const now = ctx.currentTime + 0.015;
    if (i === 0) { // Mara: two quiet heartbeat thumps
      note(ctx, out, 72, now, 0.14, 0.032, 'sine', 52);
      note(ctx, out, 58, now + 0.2, 0.2, 0.022, 'sine', 44);
    } else if (i === 1) { // Echo: shutter click with two softer reflections
      noiseHit(ctx, out, now, 0.045, 2100, 0.045, 'highpass');
      noiseHit(ctx, out, now + 0.12, 0.05, 1450, 0.018, 'bandpass');
      noiseHit(ctx, out, now + 0.24, 0.065, 900, 0.008, 'bandpass');
    } else if (i === 2) { // Daleelk: a short two-note airport chime
      note(ctx, out, 659.25, now, 0.42, 0.018, 'sine');
      note(ctx, out, 880, now + 0.18, 0.52, 0.014, 'sine');
    } else if (i === 3) { // Rassah: a short tearing strip of tape
      noiseHit(ctx, out, now, 0.42, 1650, 0.025, 'bandpass');
    } else { // Pit Lane Hub: a low pass-by sweep from left to right
      const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.72);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(240, now + 0.72);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.022, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
      osc.connect(filter);
      filter.connect(gain);
      if (pan) {
        pan.pan.setValueAtTime(-0.8, now);
        pan.pan.linearRampToValueAtTime(0.8, now + 0.78);
        gain.connect(pan);
        pan.connect(out);
      } else gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.8);
    }
  }

  function startCrackle() {
    if (crackle || !isOn()) return;
    const ctx = getAudioContext(), out = getAudioOutput();
    if (!ctx || !out) return;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = makeNoise(ctx, 0.3, true);
    source.loop = true;
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    gain.gain.value = 0.012;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start();
    crackle = source;
  }

  function stopCrackle() {
    if (!crackle) return;
    try { crackle.stop(); } catch { /* It may already have stopped. */ }
    crackle.disconnect();
    crackle = null;
  }

  function stepReduced(index) {
    if (!playback) return;
    if (index >= sideATracks.length) { stopPlayback(true); return; }
    playback.index = index;
    refreshSelection();
    playMotif(index);
    if (index === 0) startCrackle();
    playback.timer = setTimeout(() => stepReduced(index + 1), TRACK_MS);
  }

  function startPlayback() {
    if (playback) return;
    if (isOn()) activateAudio();
    playback = { index: -1, startedAt: performance.now(), timer: 0 };
    if (reduced) {
      refreshSelection();
      stepReduced(0);
    } else {
      drawArm(RO + 12, 1);
      target = SPIN;
      refreshSelection();
      run();
    }
  }

  function stopPlayback(finished = false) {
    if (!playback) return;
    clearTimeout(playback.timer);
    playback = null;
    stopCrackle();
    if (!reduced && !finished) drawArm(RO + 12, 1);
    refreshSelection();
    run();
  }

  function updatePlayback(now) {
    if (!playback || reduced) return;
    const elapsed = now - playback.startedAt;
    if (elapsed < DROP_MS) {
      const progress = elapsed / DROP_MS;
      drawArm(RO + 12 - 12 * progress, 1 - progress);
      return;
    }
    const playing = elapsed - DROP_MS;
    const fullSide = sideATracks.length * TRACK_MS;
    if (playing < fullSide) {
      const index = Math.min(sideATracks.length - 1, Math.floor(playing / TRACK_MS));
      if (index !== playback.index) {
        playback.index = index;
        refreshSelection();
        playMotif(index);
        if (index === 0) startCrackle();
      }
      const within = (playing - index * TRACK_MS) / TRACK_MS;
      const from = radiusFor(index);
      const to = index < sideATracks.length - 1 ? radiusFor(index + 1) : RI - 10;
      drawArm(from + (to - from) * (within * within * (3 - 2 * within)));
    } else {
      drawArm(RI - 10, Math.min(1, (playing - fullSide) / LIFT_MS));
      if (playing >= fullSide + LIFT_MS) stopPlayback(true);
    }
  }

  function tick(t) {
    raf = 0;
    if (document.hidden || !inView) { lastT = 0; return; }
    ticking = true;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    const k = 1 - Math.exp(-dt / (target > vel ? 0.16 : 0.09)); // both spin-up and spin-down settle within ~0.5 s
    vel += (target - vel) * k;
    if (target === 0 && vel < 2) vel = 0;
    spinRot = (spinRot + vel * dt) % 360;
    applyRot();
    updatePlayback(t);
    if (vel > 0 || target > 0 || playback) {
      ticking = false;
      raf = requestAnimationFrame(tick);
    } else { lastT = 0; ticking = false; }
  }
  const run = () => { if (!raf && !ticking && !reduced && inView && !document.hidden) { lastT = 0; raf = requestAnimationFrame(tick); } };
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) run();
    else {
      if (playback) stopPlayback();
      cancelAnimationFrame(raf);
      raf = 0;
      lastT = 0;
    }
  });
  visibility.observe(root);

  function selectTrack(a) {
    clearTimeout(leaveTimer);
    if (previewed === a) return;
    previewed = a;
    refreshSelection();
    run();
    if (!used) { used = true; hint?.classList.add('is-used'); }
  }
  function clearPreview() {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => { previewed = null; refreshSelection(); run(); }, 90);
  }
  const onOver = (e) => { const a = e.target.closest?.('[data-track]'); if (a) selectTrack(a); };
  const onOut = (e) => {
    const a = e.target.closest?.('[data-track]');
    if (!a) return;
    const to = e.relatedTarget?.closest?.('[data-track]');
    if (!to && document.activeElement?.closest?.('[data-track]') == null) clearPreview();
  };
  const onFocusIn = (e) => { const a = e.target.closest?.('[data-track]'); if (a) selectTrack(a); };
  const onFocusOut = (e) => { if (!e.relatedTarget?.closest?.('[data-track]')) clearPreview(); };
  const onPlayClick = () => playback ? stopPlayback() : startPlayback();
  const onSoundClick = () => setOn(!isOn());
  const onSoundChange = on => {
    syncSoundButton(on);
    if (on && playback) startCrackle();
    else if (!on) stopCrackle();
  };
  const stopOnHide = () => { if (document.hidden && playback) stopPlayback(); };
  const offSound = onChange(onSoundChange);
  playButton.addEventListener('click', onPlayClick);
  soundButton.addEventListener('click', onSoundClick);
  const onVis = () => {
    stopOnHide();
    if (!document.hidden && (vel > 0 || target > 0)) run();
  };
  if (tracks.length) {
    scope.addEventListener('pointerover', onOver);
    scope.addEventListener('pointerout', onOut);
    scope.addEventListener('focusin', onFocusIn);
    scope.addEventListener('focusout', onFocusOut);
  }
  document.addEventListener('visibilitychange', onVis);

  // ---------- scroll ----------
  // Convert the section's progress into "how far the page pen (62% of the viewport) has moved through this
  // scene", finishing by the time the scene sits centred on screen.
  let vh = 900, secH = H, off = 0, h = H;
  function measure() {
    vh = innerHeight || 900;
    const rr = root.getBoundingClientRect();
    h = rr.height || H;
    if (rr.width) root.style.setProperty('--tl-u', String(Math.round((W / rr.width) * 1000) / 1000));
    if (section) { const sr = section.getBoundingClientRect(); secH = sr.height; off = rr.top - sr.top; }
    else { secH = h; off = 0; }
  }
  const pen = (p) => {
    const sceneTop = vh - p * (secH + vh) + off;
    const D = Math.min(h, 0.12 * vh + 0.5 * h);
    return clamp((0.62 * vh - sceneTop) / D);
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(root);
  if (section) ro.observe(section);
  addEventListener('resize', measure);

  let lastF = -1;
  function render(p) {
    const F = reduced ? 1 : pen(p);
    if (!reduced) { scrollRot = p * 300; applyRot(); }
    if (Math.abs(F - lastF) < 1e-4) return;
    lastF = F;
    const a = seg(F, 0, 0.07), b = seg(F, 0.07, 0.93), c = seg(F, 0.93, 1);
    lineIn.style.strokeDashoffset = String(f1((1 - a) * 1000) / 1000);
    groove.style.strokeDashoffset = String(Math.round((1 - b) * 1e4) / 1e4);
    lineOut.style.strokeDashoffset = String(f1((1 - c) * 1000) / 1000);
    groove.style.opacity = b > 0 ? '' : '0';
  }

  show(DEFAULT);
  applyRot();
  drawArm(RO + 12, 1);
  const onTuck = () => drawArm(...armArgs);
  tucked.addEventListener('change', onTuck);
  render(reduced ? 0.6 : 0);

  return {
    update(p) { render(clamp(+p)); },
    anchors() { return { entry: { x: 0.5, y: 0 }, exit: { x: 0.5, y: 1 } }; },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(leaveTimer);
      clearTimeout(playback?.timer);
      playback = null;
      stopCrackle();
      offSound();
      tucked.removeEventListener('change', onTuck);
      playButton.removeEventListener('click', onPlayClick);
      soundButton.removeEventListener('click', onSoundClick);
      visibility.disconnect();
      ro.disconnect();
      removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', onVis);
      if (tracks.length) {
        scope.removeEventListener('pointerover', onOver);
        scope.removeEventListener('pointerout', onOut);
        scope.removeEventListener('focusin', onFocusIn);
        scope.removeEventListener('focusout', onFocusOut);
      }
      tracks.forEach(a => { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
      root.textContent = '';
      delete root.dataset.tone;
      root.classList.remove('is-playing', 'is-playback');
    },
  };
}
