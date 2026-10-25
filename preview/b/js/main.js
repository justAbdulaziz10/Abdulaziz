/* Abdulaziz Alkhlaiwe — Direction B "Craft"
   Interactions: theme (View Transition), command menu, copy email, Riyadh clock,
   nav spy, hero tilt + scroll depth, scroll-linked 3D phone, scrubbed counters,
   masked heading reveals, Daleelk flow, work list preview + shared-element expand.
   Every motion answers scroll or input, pauses off-screen and has a reduced-motion path. */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  const mqDesk = matchMedia('(min-width: 960px)');
  const mqPreview = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
  let reduce = mqReduce.matches;
  mqReduce.addEventListener('change', (e) => {
    reduce = e.matches;
    root.classList.toggle('motion', !reduce);
    schedule();
  });

  const EMAIL = 'abdulazizalkhlaiwe@gmail.com';
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
  if (!isMac) $$('[data-mod]').forEach((n) => { n.textContent = 'Ctrl '; });

  /* ------------------------------------------------------------------ toast */
  const toast = $('[data-toast]');
  let toastTimer;
  function say(msg) {
    if (!toast) return;
    toast.textContent = '';
    requestAnimationFrame(() => {
      toast.textContent = msg;
      toast.classList.add('is-on');
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2400);
  }

  /* ------------------------------------------------------------------ copy */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = d.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      d.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = d.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  async function copyEmail(btn) {
    const ok = await copyText(EMAIL);
    if (!ok) { say(`Copy did not work. The address is ${EMAIL}`); return; }
    say('Email address copied');
    if (btn) {
      btn.classList.remove('is-done');
      void btn.offsetWidth;
      btn.classList.add('is-done');
      clearTimeout(btn._t);
      btn._t = setTimeout(() => btn.classList.remove('is-done'), 1900);
    }
  }
  $$('[data-copy]').forEach((b) => b.addEventListener('click', () => copyEmail(b)));

  /* ------------------------------------------------------------------ clock */
  const clock = $('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    let timer;
    const tick = () => {
      const now = new Date();
      const parts = fmt.formatToParts(now);
      const hh = parts.find((p) => p.type === 'hour')?.value || '--';
      const mm = parts.find((p) => p.type === 'minute')?.value || '--';
      clock.innerHTML = `${hh}<span class="colon">:</span>${mm}`;
      clock.setAttribute('datetime', `${hh}:${mm}`);
      clock.setAttribute('aria-label', `Local time in Riyadh, ${hh}:${mm}`);
      clearTimeout(timer);
      timer = setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
    };
    tick();
    d.addEventListener('visibilitychange', () => { if (!d.hidden) tick(); else clearTimeout(timer); });
  }

  /* ------------------------------------------------------------------ theme */
  const themeBtn = $('[data-theme-toggle]');
  const metaThemes = $$('meta[name="theme-color"]');
  function applyTheme(t) {
    root.dataset.theme = t;
    if (themeBtn) themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    metaThemes.forEach((m) => m.setAttribute('content', t === 'dark' ? '#111110' : '#fafaf9'));
  }
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  function toggleTheme(origin) {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const commit = () => {
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    };
    if (!d.startViewTransition || reduce) { commit(); return; }
    let x = innerWidth - 40, y = 28;
    if (origin && origin.getBoundingClientRect) {
      const r = origin.getBoundingClientRect();
      if (r.width) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    }
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = d.startViewTransition(commit);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  }
  if (themeBtn) themeBtn.addEventListener('click', () => toggleTheme(themeBtn));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let stored = null;
    try { stored = localStorage.getItem('theme'); } catch (err) { /* ignore */ }
    if (!stored) applyTheme(e.matches ? 'dark' : 'light');
  });

  /* ------------------------------------------------------------------ frame scheduler
     One rAF per scroll/resize; each scrubber only runs while it is on screen. */
  const scrubbers = [];
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }
  function frame() {
    queued = false;
    const vh = innerHeight;
    for (const s of scrubbers) if (s.visible) s.update(vh);
  }
  const visIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const s = e.target._scrub;
      if (s) s.visible = e.isIntersecting;
    }
    schedule();
  }, { rootMargin: '15% 0px 15% 0px' });
  function addScrubber(el, update) {
    if (!el) return null;
    const s = { el, update, visible: false };
    el._scrub = s;
    scrubbers.push(s);
    visIO.observe(el);
    return s;
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });

  /* ------------------------------------------------------------------ bar, dock, nav spy */
  const bar = $('.bar');
  const dock = $('.dock');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (bar) bar.classList.toggle('is-scrolled', y > 8);
    if (dock) {
      const nearEnd = y + innerHeight > d.documentElement.scrollHeight - 140;
      if (y > lastY + 6 && y > 400 && !nearEnd) dock.classList.add('is-hidden');
      else if (y < lastY - 6 || nearEnd) dock.classList.remove('is-hidden');
    }
    lastY = y;
  }, { passive: true });

  const nav = $('.nav');
  const pill = $('.nav__pill');
  const navLinks = $$('.nav__list a');
  const dockLinks = $$('.dock a');
  const spyMap = { about: 'about', work: 'work', mara: 'work', experience: 'experience', skills: 'skills', certifications: 'skills', more: 'work', contact: 'contact' };
  let current = null;
  let hovering = null;
  function placePill(link) {
    if (!nav || !pill) return;
    if (!link) { nav.style.setProperty('--po', 0); return; }
    const nr = nav.getBoundingClientRect();
    const lr = link.getBoundingClientRect();
    nav.style.setProperty('--px', `${lr.left - nr.left}px`);
    nav.style.setProperty('--pw', `${lr.width}px`);
    nav.style.setProperty('--po', 1);
  }
  function setCurrent(id) {
    if (id === current) return;
    current = id;
    [...navLinks, ...dockLinks].forEach((a) => {
      if (a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (!hovering) placePill(navLinks.find((a) => a.getAttribute('href') === `#${id}`) || null);
  }
  navLinks.forEach((a) => {
    a.addEventListener('pointerenter', () => { hovering = a; placePill(a); });
    a.addEventListener('focus', () => { hovering = a; placePill(a); });
    a.addEventListener('blur', () => { hovering = null; placePill(navLinks.find((l) => l.getAttribute('aria-current')) || null); });
  });
  if (nav) nav.addEventListener('pointerleave', () => { hovering = null; placePill(navLinks.find((l) => l.getAttribute('aria-current')) || null); });
  const spyIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) setCurrent(spyMap[e.target.id]);
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(spyMap).forEach((id) => { const el = d.getElementById(id); if (el) spyIO.observe(el); });
  addEventListener('scroll', () => { if (scrollY < 200) setCurrent(null); }, { passive: true });
  addEventListener('resize', () => placePill(hovering || navLinks.find((l) => l.getAttribute('aria-current')) || null), { passive: true });

  /* ------------------------------------------------------------------ masked heading reveals */
  function escapeHTML(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function splitLines(el) {
    const original = el.innerHTML;
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="rv-w" style="display:inline-block">${escapeHTML(w)}</span>`).join(' ');
    const lines = [];
    let top = null;
    $$('.rv-w', el).forEach((w) => {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w.textContent);
    });
    el.innerHTML = lines.map((l, i) => `<span class="rv-line" style="--li:${i}"><span>${escapeHTML(l.join(' '))}</span></span>`).join('');
    el._original = original;
  }
  function initReveals() {
    if (reduce || !('IntersectionObserver' in window)) return;
    const targets = $$('.h2, .contact__title, .case__name');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        io.unobserve(el);
        requestAnimationFrame(() => el.classList.add('is-revealed'));
        const n = $$('.rv-line', el).length;
        setTimeout(() => {
          if (el._original != null) el.innerHTML = el._original;
          el.classList.remove('is-revealed', 'rv');
        }, 1100 + n * 70);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (r.bottom < innerHeight * 0.9) continue; // already on screen at load: leave it as is
      splitLines(el);
      el.classList.add('rv');
      io.observe(el);
    }
  }
  (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(initReveals);

  /* ------------------------------------------------------------------ scrubbed counters */
  const proof = $('[data-proof]');
  if (proof) {
    const counters = $$('[data-count]', proof).map((el) => {
      const target = Number(el.dataset.count);
      const sr = d.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = el.textContent;
      el.after(sr);
      el.setAttribute('aria-hidden', 'true');
      return { el, target, last: -1 };
    });
    const nf = new Intl.NumberFormat('en-US');
    let done = false;
    const startRect = proof.getBoundingClientRect();
    if (!reduce && startRect.top > innerHeight * 0.85) {
      counters.forEach((c) => { c.el.textContent = '0'; });
      addScrubber(proof, (vh) => {
        if (done || reduce) return;
        const r = proof.getBoundingClientRect();
        const p = clamp((vh * 0.98 - r.top) / (vh * 0.5));
        counters.forEach((c, i) => {
          const local = clamp(p * 1.15 - i * 0.075);
          const v = Math.round(c.target * easeOut(local));
          if (v !== c.last) { c.el.textContent = nf.format(v); c.last = v; }
        });
        if (p >= 1) {
          done = true;
          counters.forEach((c) => { c.el.textContent = nf.format(c.target); });
        }
      });
    }
  }

  /* ------------------------------------------------------------------ contribution graph */
  const graph = $('[data-graph]');
  if (graph && window.CONTRIB) {
    const { start, days } = window.CONTRIB;
    const s0 = new Date(`${start}T00:00:00Z`);
    const offset = s0.getUTCDay();
    const cell = 11, gap = 3, step = cell + gap, top = 18;
    const weeks = Math.ceil((days.length + offset) / 7);
    const W = weeks * step - gap, H = top + 7 * step - gap;
    const level = (n) => (n === 0 ? 0 : n < 6 ? 1 : n < 16 ? 2 : n < 40 ? 3 : 4);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let out = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">`;
    let lastMonth = -1;
    days.forEach((n, i) => {
      const k = i + offset;
      const col = Math.floor(k / 7), row = k % 7;
      const date = new Date(s0.getTime() + i * 86400000);
      if (row === 0 || i === 0) {
        const m = date.getUTCMonth();
        if (m !== lastMonth && date.getUTCDate() <= 7 && col < weeks - 2) {
          out += `<text class="m" x="${col * step}" y="10">${months[m]}</text>`;
          lastMonth = m;
        }
      }
      out += `<rect class="l${level(n)}" x="${col * step}" y="${top + row * step}" width="${cell}" height="${cell}" data-n="${n}" data-d="${date.toISOString().slice(0, 10)}" style="--i:${col}"/>`;
    });
    out += '</svg>';
    graph.innerHTML = out;
    const gscroll = graph.parentElement;
    if (gscroll && gscroll.scrollWidth > gscroll.clientWidth) gscroll.scrollLeft = gscroll.scrollWidth;
    const readout = $('[data-graph-readout]');
    const base = readout ? readout.textContent : '';
    const dfmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    let hot = null;
    graph.addEventListener('pointerover', (e) => {
      const r = e.target.closest('rect');
      if (!r || !readout) return;
      if (hot) hot.classList.remove('is-hot');
      hot = r;
      r.classList.add('is-hot');
      graph.classList.add('is-hovering');
      const n = Number(r.dataset.n);
      readout.textContent = `${n === 0 ? 'No' : nf2(n)} contribution${n === 1 ? '' : 's'} on ${dfmt.format(new Date(`${r.dataset.d}T00:00:00Z`))}`;
    });
    graph.addEventListener('pointerleave', () => {
      if (hot) hot.classList.remove('is-hot');
      hot = null;
      graph.classList.remove('is-hovering');
      if (readout) readout.textContent = base;
    });
    function nf2(n) { return new Intl.NumberFormat('en-US').format(n); }
    if (!reduce && graph.getBoundingClientRect().top > innerHeight) {
      graph.classList.add('is-pending');
      const gio = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          gio.disconnect();
          graph.classList.add('is-in');
          requestAnimationFrame(() => graph.classList.remove('is-pending'));
        }
      }, { rootMargin: '0px 0px -15% 0px' });
      gio.observe(graph);
    }
  }

  /* ------------------------------------------------------------------ hero stage: pointer tilt + scroll depth */
  const stage = $('[data-tilt]');
  if (stage) {
    const rig = $('.stage__phones', stage);
    const glares = $$('.phone__glare', stage);
    const cur = { rx: 0, ry: 0, mx: 0, my: 0 };
    const tgt = { rx: 0, ry: 0, mx: 0, my: 0 };
    let scrollQ = 0;
    let running = false;
    let onScreen = true;
    const write = () => {
      rig.style.setProperty('--rx', `${(cur.rx + scrollQ * 7).toFixed(3)}deg`);
      rig.style.setProperty('--ry', `${cur.ry.toFixed(3)}deg`);
      rig.style.setProperty('--mx', `${cur.mx.toFixed(2)}px`);
      rig.style.setProperty('--my', `${cur.my.toFixed(2)}px`);
      rig.style.setProperty('--fan', `${(scrollQ * 4).toFixed(3)}cqi`);
      rig.style.setProperty('--lift', `${(-scrollQ * 70).toFixed(2)}px`);
      const gx = (cur.ry / 8).toFixed(3);
      glares.forEach((g) => g.style.setProperty('--gx', gx));
    };
    const loop = () => {
      let moving = false;
      for (const k in cur) {
        const dlt = tgt[k] - cur[k];
        if (Math.abs(dlt) > 0.01) { cur[k] += dlt * 0.085; moving = true; } else cur[k] = tgt[k];
      }
      write();
      if (moving && onScreen) requestAnimationFrame(loop); else running = false;
    };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
    addEventListener('pointermove', (e) => {
      if (reduce || !mqFine.matches || !onScreen || e.pointerType !== 'mouse') return;
      const r = stage.getBoundingClientRect();
      const nx = clamp(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)), -1.2, 1.2);
      const ny = clamp(((e.clientY - (r.top + r.height / 2)) / (innerHeight / 1.4)), -1.2, 1.2);
      tgt.ry = nx * 7;
      tgt.rx = -ny * 5;
      tgt.mx = nx * 16;
      tgt.my = ny * 10;
      kick();
    }, { passive: true });
    d.addEventListener('pointerleave', () => { tgt.rx = tgt.ry = tgt.mx = tgt.my = 0; kick(); });
    addScrubber(stage, (vh) => {
      if (reduce) { if (scrollQ) { scrollQ = 0; write(); } return; }
      const r = stage.getBoundingClientRect();
      scrollQ = clamp((vh * 0.35 - r.top) / (r.height * 0.9));
      write();
    });
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; if (onScreen) kick(); }).observe(stage);
  }

  /* ------------------------------------------------------------------ Rassah: pointer tilt + scroll settle */
  const duo = $('[data-tilt-soft]');
  if (duo) {
    const rig = $('.duo__rig', duo);
    let px = 0, py = 0, sq = 1;
    const write = () => {
      rig.style.setProperty('--rx', `${(sq * 14 + py).toFixed(2)}deg`);
      rig.style.setProperty('--ry', `${(-sq * 10 + px).toFixed(2)}deg`);
    };
    duo.addEventListener('pointermove', (e) => {
      if (reduce || e.pointerType !== 'mouse') return;
      const r = duo.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 8;
      py = -((e.clientY - r.top) / r.height - 0.5) * 6;
      write();
    });
    duo.addEventListener('pointerleave', () => { px = py = 0; write(); });
    addScrubber(duo, (vh) => {
      if (reduce) { sq = 0; px = py = 0; write(); return; }
      const r = duo.getBoundingClientRect();
      sq = 1 - easeOut(clamp((vh - r.top) / (vh * 0.75)));
      write();
    });
  }

  /* ------------------------------------------------------------------ 3D phones */
  function setPhone(rigEl, floor, glare, ry, rx, tz) {
    rigEl.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    rigEl.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    rigEl.style.setProperty('--tz', `${tz.toFixed(1)}px`);
    const c = Math.abs(Math.cos((ry * Math.PI) / 180));
    if (floor) floor.style.setProperty('--fs', (0.45 + 0.55 * c).toFixed(3));
    if (glare) glare.style.setProperty('--gx', (Math.sin((ry * Math.PI) / 180) * 1.6).toFixed(3));
  }
  // Screens wipe up from the bottom (clip-path), like the next screen sliding in.
  function setScreens(screens, reveals) {
    screens.forEach((s, i) => {
      if (i === 0) return;
      const r = Math.round(reveals[i] * 1000) / 1000;
      if (s._r === r) return;
      s._r = r;
      s.style.setProperty('--r', r);
    });
  }

  // Sticky phone that follows the Mara and Echo case studies (desktop)
  const cases = $('[data-cases]');
  const main = $('[data-p3d-main]');
  if (cases && main) {
    const text = $('.cases__text', cases);
    const caseEls = $$('.case', text);
    const rigEl = $('.p3d__rig', main);
    const floor = $('.p3d__floor', main);
    const glare = $('.phone__glare', main);
    const screens = $$('.p3d__screen', main);
    let activeIdx = -1;
    addScrubber(cases, (vh) => {
      if (!mqDesk.matches) { cases.classList.remove('is-live'); return; }
      cases.classList.add('is-live');
      const r = text.getBoundingClientRect();
      const p = clamp((vh * 0.5 - r.top) / r.height);
      const t = p * 3; // 0..3 across four screens
      const idx = t < 1.5 ? 0 : 1;
      if (idx !== activeIdx) {
        activeIdx = idx;
        caseEls.forEach((c, i) => c.classList.toggle('is-active', i === idx));
      }
      if (reduce) {
        const on = Math.min(3, Math.round(t));
        setScreens(screens, screens.map((_, i) => (i <= on ? 1 : 0)));
        setPhone(rigEl, floor, glare, 0, 0, 0);
        return;
      }
      const spin = easeInOut(smooth(1.12, 1.88, t));
      const ry = lerp(-17, 13, t / 3) + 360 * spin;
      const rx = lerp(7, 2, t / 3) + Math.sin(spin * Math.PI) * 6;
      const tz = -110 * Math.sin(spin * Math.PI);
      const a = smooth(0.4, 0.62, t);
      const b = smooth(2.38, 2.6, t);
      const first = t < 1.5;
      setScreens(screens, first ? [1, a, 0, 0] : [1, 1, 1, b]);
      setPhone(rigEl, floor, glare, ry, rx, tz);
    });
  }

  // Inline phones inside each case (phones and tablets)
  $$('[data-p3d]').forEach((el) => {
    const rigEl = $('.p3d__rig', el);
    const floor = $('.p3d__floor', el);
    const glare = $('.phone__glare', el);
    const screens = $$('.p3d__screen', el);
    addScrubber(el, (vh) => {
      if (mqDesk.matches) return;
      const r = el.getBoundingClientRect();
      const q = clamp((vh - r.top) / (vh + r.height));
      if (reduce) {
        setScreens(screens, [1, q > 0.55 ? 1 : 0]);
        setPhone(rigEl, floor, glare, 0, 0, 0);
        return;
      }
      const ry = lerp(-30, 22, easeInOut(q));
      const rx = lerp(12, -8, q);
      const f = smooth(0.47, 0.6, q);
      setScreens(screens, [1, f]);
      setPhone(rigEl, floor, glare, ry, rx, 0);
    });
  });

  /* ------------------------------------------------------------------ Daleelk flow, drawn by scroll */
  const flow = $('[data-flow]');
  if (flow) {
    const nodes = $$('.flow__node', flow);
    const paint = (p) => {
      nodes.forEach((n, i) => {
        n.style.setProperty('--seg', clamp(p * 2.2 - i * 1.05).toFixed(3));
        n.classList.toggle('is-on', p * 2.2 >= i * 1.05 - 0.02);
      });
    };
    paint(1);
    addScrubber(flow, (vh) => {
      if (reduce) { paint(1); return; }
      const r = flow.getBoundingClientRect();
      paint(clamp((vh * 0.85 - r.top) / (r.height + vh * 0.25)));
    });
  }

  /* ------------------------------------------------------------------ work list: floating preview + shared-element expand */
  const preview = $('[data-preview-el]');
  let pimg = null;
  if (preview) { pimg = d.createElement('img'); pimg.alt = ''; pimg.decoding = 'async'; preview.appendChild(pimg); }
  const items = $$('.work__item');
  const PW = 360, PH = 225;
  const pv = { x: 0, y: 0, tx: 0, ty: 0, s: 0.92, ts: 0.92, rot: 0, on: false, item: null, raf: 0, flying: false };

  function pvLoop() {
    pv.raf = 0;
    if (pv.flying) return;
    const dx = pv.tx - pv.x;
    pv.x += dx * 0.16;
    pv.y += (pv.ty - pv.y) * 0.16;
    pv.s += (pv.ts - pv.s) * 0.18;
    pv.rot += (clamp(dx * 0.05, -7, 7) - pv.rot) * 0.2;
    preview.style.transform = `translate3d(${pv.x.toFixed(1)}px, ${pv.y.toFixed(1)}px, 0) rotate(${pv.rot.toFixed(2)}deg) scale(${pv.s.toFixed(3)})`;
    const settled = Math.abs(dx) < 0.3 && Math.abs(pv.ty - pv.y) < 0.3 && Math.abs(pv.ts - pv.s) < 0.002 && Math.abs(pv.rot) < 0.05;
    if (!settled) pv.raf = requestAnimationFrame(pvLoop);
  }
  const pvKick = () => { if (!pv.raf) pv.raf = requestAnimationFrame(pvLoop); };
  function pvTarget(e) {
    let x = e.clientX + 28;
    if (x + PW > innerWidth - 16) x = e.clientX - PW - 28;
    pv.tx = x;
    pv.ty = clamp(e.clientY - PH * 0.55, 72, innerHeight - PH - 16);
  }
  function pvShow(item, e) {
    if (!preview || reduce || !mqPreview.matches || item.classList.contains('is-open')) return;
    const src = item.dataset.preview;
    if (!src) return;
    if (pimg.getAttribute('src') !== src) pimg.setAttribute('src', src);
    pvTarget(e);
    if (!pv.on) { pv.x = pv.tx; pv.y = pv.ty + 12; pv.s = 0.9; pv.rot = 0; }
    pv.ts = 1;
    pv.on = true;
    pv.item = item;
    preview.classList.add('is-on');
    pvKick();
  }
  function pvHide() {
    if (!preview || pv.flying) return;
    pv.on = false;
    pv.item = null;
    pv.ts = 0.92;
    preview.classList.remove('is-on');
    pvKick();
  }

  function openItem(item, open) {
    const btn = $('.work__row', item);
    const panel = $('.work__panel', item);
    const shot = $('[data-shared]', item);
    btn.setAttribute('aria-expanded', String(open));
    if (!open) { item.classList.remove('is-open'); return; }

    const fly = !reduce && preview && pv.on && pv.item === item && shot && mqPreview.matches;
    if (fly) {
      const A = preview.getBoundingClientRect();
      panel.style.transition = 'none';
      item.classList.add('is-open');
      const B = shot.getBoundingClientRect();
      item.classList.remove('is-open');
      void panel.offsetHeight;
      panel.style.transition = '';
      item.classList.add('is-open');
      if (B.bottom < 0 || B.top > innerHeight || !A.width) { pvHide(); return; }
      shot.style.opacity = '0';
      pv.flying = true;
      if (pv.raf) { cancelAnimationFrame(pv.raf); pv.raf = 0; }
      const from = preview.style.transform;
      const to = `translate3d(${B.left}px, ${B.top}px, 0) rotate(0deg) scale(${B.width / PW}, ${B.height / PH})`;
      const anim = preview.animate([{ transform: from, borderRadius: '12px' }, { transform: to, borderRadius: `${10 * PW / B.width}px` }], {
        duration: 560, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards',
      });
      anim.onfinish = () => {
        shot.style.opacity = '';
        preview.classList.add('is-instant');
        preview.classList.remove('is-on');
        anim.cancel();
        pv.flying = false;
        pv.on = false;
        pv.item = null;
        pv.s = pv.ts = 0.92;
        preview.style.transform = `translate3d(${pv.x}px, ${pv.y}px, 0) scale(0.92)`;
        requestAnimationFrame(() => preview.classList.remove('is-instant'));
      };
      return;
    }
    pvHide();
    item.classList.add('is-open');
    if (!reduce) {
      const inner = $('.work__inner', item);
      const kids = Array.from(inner.children);
      kids.forEach((k, i) => k.animate(
        [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 520, delay: 60 + i * 50, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
      ));
    }
  }

  items.forEach((item) => {
    const btn = $('.work__row', item);
    btn.addEventListener('click', () => openItem(item, btn.getAttribute('aria-expanded') !== 'true'));
    item.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pvShow(item, e); });
    item.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (item.classList.contains('is-open')) { if (pv.item === item) pvHide(); return; }
      if (!pv.on || pv.item !== item) { pvShow(item, e); return; }
      pvTarget(e);
      pvKick();
    });
    item.addEventListener('pointerleave', () => { if (pv.item === item) pvHide(); });
  });
  addEventListener('scroll', () => { if (pv.on && !pv.flying) pvHide(); }, { passive: true });

  /* ------------------------------------------------------------------ command menu */
  const dlg = $('[data-cmdk]');
  const input = $('[data-cmdk-input]');
  const list = $('[data-cmdk-list]');
  const empty = $('[data-cmdk-empty]');
  const closeBtn = $('[data-cmdk-close]');
  const ICON = {
    section: '<svg viewBox="0 0 16 16"><path d="M3 4.5h10M3 8h10M3 11.5h6"/></svg>',
    link: '<svg viewBox="0 0 16 16"><path d="M6.5 9.5 9.5 6.5M7 4.5l1.2-1.2a2.6 2.6 0 0 1 3.6 3.6L10.5 8M9 11.5l-1.2 1.2a2.6 2.6 0 0 1-3.6-3.6L5.5 8"/></svg>',
    mail: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="2"/><path d="m3 5 5 3.5L13 5"/></svg>',
    copy: '<svg viewBox="0 0 16 16"><rect x="5.25" y="5.25" width="8" height="8" rx="2"/><path d="M10.75 5.25V4.5a1.75 1.75 0 0 0-1.75-1.75H4.5A1.75 1.75 0 0 0 2.75 4.5V9a1.75 1.75 0 0 0 1.75 1.75h.75"/></svg>',
    theme: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.25"/><path d="M8 2.75v10.5A5.25 5.25 0 0 0 8 2.75Z" fill="currentColor"/></svg>',
  };
  const go = (id) => () => {
    const el = d.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    const focusEl = $('h2, h3', el) || el;
    if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
    focusEl.focus({ preventScroll: true });
  };
  const open = (url) => () => { if (url.startsWith('mailto:')) location.href = url; else window.open(url, '_blank', 'noopener'); };
  const COMMANDS = [
    { g: 'Sections', label: 'About', icon: 'section', run: go('about'), k: 'summary proof numbers' },
    { g: 'Sections', label: 'Selected work', icon: 'section', run: go('work'), k: 'projects case studies' },
    { g: 'Sections', label: 'Mara', hint: 'AI health & wellness platform', icon: 'section', run: go('mara') },
    { g: 'Sections', label: 'Echo', hint: 'iOS photo-memory app', icon: 'section', run: go('echo') },
    { g: 'Sections', label: 'Daleelk', hint: 'AI Gulf travel platform', icon: 'section', run: go('daleelk') },
    { g: 'Sections', label: 'Rassah', hint: 'AI packing assistant', icon: 'section', run: go('rassah') },
    { g: 'Sections', label: 'Experience', icon: 'section', run: go('experience'), k: 'education co-op king saud university' },
    { g: 'Sections', label: 'Skills', icon: 'section', run: go('skills') },
    { g: 'Sections', label: 'Certifications', icon: 'section', run: go('certifications') },
    { g: 'Sections', label: 'More work', icon: 'section', run: go('more'), k: 'docmara pit lane hub obsessionsystem halo deadware photo manager' },
    { g: 'Sections', label: 'Contact', icon: 'section', run: go('contact') },
    { g: 'Links', label: 'Email', hint: EMAIL, icon: 'mail', run: open(`mailto:${EMAIL}`) },
    { g: 'Links', label: 'LinkedIn', hint: 'abdulaziz-alkhlaiwe', icon: 'link', run: open('https://www.linkedin.com/in/abdulaziz-alkhlaiwe') },
    { g: 'Links', label: 'GitHub', hint: 'justAbdulaziz10', icon: 'link', run: open('https://github.com/justAbdulaziz10') },
    { g: 'Links', label: 'GitLab', hint: 'abdulaziz.alkhlaiwe', icon: 'link', run: open('https://gitlab.com/abdulaziz.alkhlaiwe') },
    { g: 'Links', label: 'X', hint: '@AlkhlaiweA', icon: 'link', run: open('https://x.com/AlkhlaiweA') },
    { g: 'Links', label: 'Mara website', hint: 'iammara.com', icon: 'link', run: open('https://iammara.com') },
    { g: 'Links', label: 'Echo on the App Store', icon: 'link', run: open('https://apps.apple.com/sa/app/echo-photo-journal-memories/id6775021634') },
    { g: 'Actions', label: 'Copy email address', icon: 'copy', run: () => copyEmail(null), k: 'clipboard' },
    { g: 'Actions', label: 'Toggle theme', hint: 'T', icon: 'theme', run: () => toggleTheme(themeBtn), k: 'dark light mode' },
  ];
  let filtered = COMMANDS;
  let sel = 0;
  let opener = null;

  function score(c, q) {
    if (!q) return 1;
    const hay = `${c.label} ${c.hint || ''} ${c.k || ''} ${c.g}`.toLowerCase();
    const label = c.label.toLowerCase();
    if (label.startsWith(q)) return 4;
    if (label.includes(q)) return 3;
    if (hay.includes(q)) return 2;
    let i = 0;
    for (const ch of label) if (ch === q[i]) i++;
    return i === q.length ? 1 : 0;
  }
  function render() {
    const q = input.value.trim().toLowerCase();
    filtered = COMMANDS.map((c) => ({ c, s: score(c, q) })).filter((x) => x.s > 0)
      .sort((a, b) => (q ? b.s - a.s : 0)).map((x) => x.c);
    if (!q) filtered = COMMANDS.slice();
    sel = Math.min(sel, Math.max(0, filtered.length - 1));
    let html = '';
    let group = null;
    filtered.forEach((c, i) => {
      if (!q && c.g !== group) {
        group = c.g;
        html += `<li class="cmdk__group" role="presentation">${c.g}</li>`;
      }
      const t = c.label === 'Toggle theme' ? (root.dataset.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') : c.label;
      html += `<li class="cmdk__item" role="option" id="cmdk-opt-${i}" data-i="${i}" aria-selected="${i === sel}">`
        + `<span class="cmdk__ico" aria-hidden="true">${ICON[c.icon]}</span><span>${escapeHTML(t)}</span>`
        + (c.hint ? `<small>${escapeHTML(c.hint)}</small>` : '') + '</li>';
    });
    list.innerHTML = html;
    empty.hidden = filtered.length > 0;
    list.hidden = filtered.length === 0;
    syncSel(false);
  }
  function syncSel(scroll = true) {
    $$('.cmdk__item', list).forEach((li) => li.setAttribute('aria-selected', String(Number(li.dataset.i) === sel)));
    const cur = $(`#cmdk-opt-${sel}`, list);
    if (cur) {
      input.setAttribute('aria-activedescendant', cur.id);
      if (scroll) cur.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function runSel() {
    const c = filtered[sel];
    if (!c) return;
    closeMenu(false);
    c.run();
  }
  function openMenu() {
    if (!dlg || dlg.open) return;
    opener = d.activeElement;
    input.value = '';
    sel = 0;
    render();
    dlg.showModal();
    input.focus();
  }
  function closeMenu(restore = true) {
    if (!dlg || !dlg.open) return;
    dlg._restore = restore;
    dlg.close();
  }
  if (dlg) {
    dlg.addEventListener('close', () => {
      if (dlg._restore !== false && opener && opener.focus) opener.focus();
      dlg._restore = true;
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeMenu(); });
    if (closeBtn) closeBtn.addEventListener('click', () => closeMenu());
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', (e) => {
      const n = filtered.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { sel = (sel + 1) % n; syncSel(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { sel = (sel - 1 + n) % n; syncSel(); } }
      else if (e.key === 'Home' && !input.value) { e.preventDefault(); sel = 0; syncSel(); }
      else if (e.key === 'End' && !input.value) { e.preventDefault(); sel = Math.max(0, n - 1); syncSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); runSel(); }
    });
    // Focus trap: Tab cycles between the search field and the close button.
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [input, closeBtn].filter((x) => x && x.offsetParent !== null);
      if (!f.length) return;
      e.preventDefault();
      const i = f.indexOf(d.activeElement);
      const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
      f[next].focus();
    });
    list.addEventListener('pointermove', (e) => {
      const li = e.target.closest('.cmdk__item');
      if (!li) return;
      const i = Number(li.dataset.i);
      if (i !== sel) { sel = i; syncSel(false); }
    });
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.cmdk__item');
      if (!li) return;
      sel = Number(li.dataset.i);
      runSel();
    });
  }
  $$('[data-cmdk-open]').forEach((b) => b.addEventListener('click', openMenu));

  /* ------------------------------------------------------------------ keyboard shortcuts */
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  d.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dlg && dlg.open) closeMenu(); else openMenu();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || (dlg && dlg.open)) return;
    if (e.key === '/') { e.preventDefault(); openMenu(); }
    else if (e.key === 't' || e.key === 'T') toggleTheme(themeBtn);
  });

  schedule();
})();
